import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Competition, Team, Swimmer, Referee, SwimSession } from '@/types';
import { 
  dataApi,
  canCountLap,
  LapCount
} from '@/lib/api';
import { Waves, AlertCircle, UserCheck, UserX, RefreshCw } from 'lucide-react';

export default function RefereeDashboard() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [assignedReferee, setAssignedReferee] = useState<Referee | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
  // Support multiple active sessions (one per team)
  const [activeSessions, setActiveSessions] = useState<SwimSession[]>([]);
  const [lapCounts, setLapCounts] = useState<Record<string, number>>({});
  const [lastCountTime, setLastCountTime] = useState<Record<string, number>>({});
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  
  const [showSwimmerDialog, setShowSwimmerDialog] = useState(false);
  const [selectedLane, setSelectedLane] = useState<string>('');
  const [selectedTeamForSwimmer, setSelectedTeamForSwimmer] = useState<string>('');
  const [laneFilter, setLaneFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'referee') {
      navigate('/login');
      return;
    }
    void loadCompetitions();
  }, [isAuthenticated, user, navigate]);

  // Elapsed time timer - only when competition is active and started
  useEffect(() => {
    if (!selectedCompetition?.actualStartTime || selectedCompetition.status !== 'active') {
      return;
    }

    const updateElapsed = () => {
      const start = new Date(selectedCompetition.actualStartTime!).getTime();
      const now = Date.now();
      const diff = now - start;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [selectedCompetition?.actualStartTime, selectedCompetition?.status]);

  const loadCompetitions = useCallback(async () => {
    if (!user) return;

    try {
      const userRefereeAssignments = await dataApi.getRefereesByUserId(user.email);
      const competitionIds = [...new Set(userRefereeAssignments.map(r => r.competitionId))];
      const competitionList = await Promise.all(competitionIds.map(id => dataApi.getCompetitionById(id)));
      const userCompetitions = competitionList.filter(Boolean) as Competition[];
      setCompetitions(userCompetitions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load competitions';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
      setCompetitions([]);
    }
  }, [user, toast, t]);

  const selectCompetition = async (competitionId: string) => {
    try {
      const comp = await dataApi.getCompetitionById(competitionId);
      if (!comp) return;

      setSelectedCompetition(comp);

      const [referees, teams, swimmers, laps, sessions] = await Promise.all([
        dataApi.getRefereesByCompetition(competitionId),
        dataApi.getTeamsByCompetition(competitionId),
        dataApi.getSwimmersByCompetition(competitionId),
        dataApi.getLapCountsByCompetition(competitionId),
        dataApi.getActiveSwimSessions(competitionId),
      ]);

      const userEmail = user?.email || '';
      const userEmailLocalPart = userEmail.split('@')[0];
      const myReferee = referees.find(r =>
        r.userId === userEmail ||
        r.email === userEmail ||
        r.userId === userEmailLocalPart
      );
      setAssignedReferee(myReferee || null);
      setAllTeams(teams);
      setAllSwimmers(swimmers);

      const counts: Record<string, number> = {};
      teams.forEach(team => {
        counts[team.id] = laps.filter(lap => lap.teamId === team.id).length;
      });
      setLapCounts(counts);
      setActiveSessions(sessions.filter(s => s.isActive));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load competition data';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const refreshCompetition = async () => {
    if (!selectedCompetition) return;
    try {
      const updated = await dataApi.getCompetitionById(selectedCompetition.id);
      if (updated) {
        setSelectedCompetition(updated);
        // Also refresh active sessions
        const sessions = await dataApi.getActiveSwimSessions(updated.id);
        setActiveSessions(sessions.filter(s => s.isActive));
        toast({ title: t.refereeDashboard.statusRefreshed });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh competition';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const getTeamsForLane = (laneNumber: number) => {
    return allTeams.filter(t => t.assignedLane === laneNumber);
  };

  const getSwimmersForTeam = (teamId: string) => {
    return allSwimmers.filter(s => s.teamId === teamId);
  };

  const getActiveSessionForTeam = (teamId: string) => {
    return activeSessions.find(s => s.teamId === teamId);
  };

  const startSwimmerSession = async (swimmer: Swimmer, laneNumber: number) => {
    if (!selectedCompetition) return;
    if (!assignedReferee) {
      toast({
        title: t.common.error,
        description: 'No referee assignment was found for this account in the selected competition.',
        variant: 'destructive',
      });
      return;
    }
    
    const team = allTeams.find(t => t.id === swimmer.teamId);
    if (!team) return;
    
    // Check if team already has active swimmer
    const existingSession = getActiveSessionForTeam(team.id);
    if (existingSession) {
      toast({ 
        title: t.refereeDashboard.cannotRegister, 
        description: t.refereeDashboard.teamHasActiveSwimmer,
        variant: 'destructive'
      });
      return;
    }
    
    const session: SwimSession = {
      id: crypto.randomUUID(),
      competitionId: selectedCompetition.id,
      swimmerId: swimmer.id,
      teamId: team.id,
      laneNumber,
      startTime: new Date().toISOString(),
      endTime: null,
      lapCount: 0,
      isActive: true,
    };
    
    try {
      await dataApi.saveSwimSession(session);
      const sessions = await dataApi.getActiveSwimSessions(selectedCompetition.id);
      setActiveSessions(sessions.filter(s => s.isActive));
      setShowSwimmerDialog(false);
      setSelectedLane('');
      setSelectedTeamForSwimmer('');
      toast({ title: `${swimmer.name} ${t.refereeDashboard.nowSwimming} ${laneNumber}` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start swimmer session';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const endSwimmerSession = async (session: SwimSession) => {
    try {
      const endedSession: SwimSession = {
        ...session,
        endTime: new Date().toISOString(),
        isActive: false,
      };
      await dataApi.saveSwimSession(endedSession);
      const sessions = await dataApi.getActiveSwimSessions(session.competitionId);
      setActiveSessions(sessions.filter(s => s.isActive));
      toast({ title: `${getSwimmerName(session.swimmerId)} ${t.refereeDashboard.sessionEnded}` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end swimmer session';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const countLap = async (session: SwimSession) => {
    if (!selectedCompetition || !assignedReferee) return;
    
    // Check if competition is active
    if (selectedCompetition.status !== 'active') {
      let description: string = t.refereeDashboard.competitionEndedDesc;
      if (selectedCompetition.status === 'upcoming') {
        description = t.refereeDashboard.competitionNotStartedDesc;
      } else if (selectedCompetition.status === 'paused') {
        description = t.refereeDashboard.competitionPausedDesc;
      }
      toast({ 
        title: t.refereeDashboard.cannotCountLaps, 
        description,
        variant: 'destructive'
      });
      return;
    }
    
    // Check double-count prevention
    const timeout = selectedCompetition.doubleCountTimeout || 15;
    const canCount = await canCountLap(session.swimmerId, timeout);
    if (!canCount) {
      const lastLapTime = lastCountTime[session.swimmerId];
      const timeSinceLastCount = lastLapTime 
        ? Math.floor((Date.now() - lastLapTime) / 1000)
        : 0;
      toast({ 
        title: t.refereeDashboard.tooSoon, 
        description: `${t.refereeDashboard.waitMore} ${timeout - timeSinceLastCount} ${t.refereeDashboard.moreSeconds}`,
        variant: 'destructive'
      });
      return;
    }
    
    const teamId = session.teamId;
    const newLapNumber = (lapCounts[teamId] || 0) + 1;
    
    const lapCount: LapCount = {
      id: crypto.randomUUID(),
      competitionId: selectedCompetition.id,
      laneNumber: session.laneNumber,
      teamId,
      swimmerId: session.swimmerId,
      refereeId: assignedReferee.id,
      timestamp: new Date().toISOString(),
      lapNumber: newLapNumber,
    };
    
    try {
      await dataApi.addLapCount(lapCount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to count lap';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
      return;
    }
    
    // Update local state
    setLapCounts(prev => ({ ...prev, [teamId]: newLapNumber }));
    setLastCountTime(prev => ({ ...prev, [session.swimmerId]: Date.now() }));
    
    toast({ title: `${t.refereeDashboard.lapCounted} ${getTeamName(teamId)}!` });
  };

  const getSwimmerName = (swimmerId: string) => {
    return allSwimmers.find(s => s.id === swimmerId)?.name || 'Unknown';
  };

  const getTeamName = (teamId: string) => {
    return allTeams.find(t => t.id === teamId)?.name || 'Unknown';
  };

  const getTeamColor = (teamId: string) => {
    return allTeams.find(t => t.id === teamId)?.color || '#888';
  };

  // Check if a team already has an active swimmer
  const teamHasActiveSwimmer = (teamId: string) => {
    return activeSessions.some(s => s.teamId === teamId);
  };

  const getStatusAlertTitle = () => {
    if (selectedCompetition?.status === 'upcoming') return t.refereeDashboard.competitionNotStarted;
    if (selectedCompetition?.status === 'paused') return t.refereeDashboard.competitionPaused;
    return t.refereeDashboard.competitionEnded;
  };

  const getStatusAlertDesc = () => {
    if (selectedCompetition?.status === 'upcoming') return t.refereeDashboard.competitionNotStartedDesc;
    if (selectedCompetition?.status === 'paused') return t.refereeDashboard.competitionPausedDesc;
    return t.refereeDashboard.competitionEndedDesc;
  };

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t.refereeDashboard.title}</h1>
            <p className="text-muted-foreground">{t.refereeDashboard.subtitle}</p>
          </div>
        </div>

        {/* Competition Selection */}
        {!selectedCompetition && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>{t.refereeDashboard.selectCompetition}</CardTitle>
              <CardDescription>{t.refereeDashboard.selectCompetitionDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {competitions.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.refereeDashboard.noAssignments}</AlertTitle>
                  <AlertDescription>
                    {t.refereeDashboard.noAssignmentsDesc}
                  </AlertDescription>
                </Alert>
              ) : (
                <Select onValueChange={selectCompetition}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.refereeDashboard.selectCompetition} />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.map(comp => (
                      <SelectItem key={comp.id} value={comp.id}>
                        {comp.name} - {comp.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Referee Interface */}
        {selectedCompetition && (
          <div className="space-y-6">
            {/* Competition Status Warning */}
            {selectedCompetition.status !== 'active' && (
              <Alert variant={selectedCompetition.status === 'upcoming' || selectedCompetition.status === 'paused' ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{getStatusAlertTitle()}</AlertTitle>
                <AlertDescription>{getStatusAlertDesc()}</AlertDescription>
              </Alert>
            )}

            {/* Status Bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.competition.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{selectedCompetition.name}</p>
                      <Badge variant={
                        selectedCompetition.status === 'active' ? 'default' 
                        : selectedCompetition.status === 'paused' ? 'outline'
                        : selectedCompetition.status === 'upcoming' ? 'outline' 
                        : 'secondary'
                      }>
                        {t.competition.status[selectedCompetition.status]}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Elapsed Time - Only show if competition has started */}
                  {selectedCompetition.actualStartTime && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t.refereeDashboard.elapsedTime}</p>
                      <p className="font-semibold text-2xl font-mono">{elapsedTime}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">{t.refereeDashboard.activeSwimmers}</p>
                    <p className="font-semibold text-2xl">{activeSessions.length}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { void refreshCompetition(); }}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t.refereeDashboard.refresh}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCompetition(null)}>
                      {t.refereeDashboard.changeCompetition}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Register New Swimmer Button */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t.refereeDashboard.registerSwimmer}</CardTitle>
                  <CardDescription>
                    {activeSessions.length > 0 
                      ? `${activeSessions.length} ${t.refereeDashboard.swimmersInWater}` 
                      : t.refereeDashboard.noSwimmersInWater}
                  </CardDescription>
                </div>
                <Dialog open={showSwimmerDialog} onOpenChange={(open) => {
                  setShowSwimmerDialog(open);
                  if (!open) {
                    setSelectedLane('');
                    setSelectedTeamForSwimmer('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserCheck className="h-4 w-4 mr-2" />
                      {t.refereeDashboard.registerSwimmer}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t.refereeDashboard.registerSwimmer}</DialogTitle>
                      <DialogDescription>{t.refereeDashboard.registerSwimmerDesc}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Step 1: Select Lane */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t.refereeDashboard.step1}</label>
                        <Select value={selectedLane} onValueChange={(value) => {
                          setSelectedLane(value);
                          setSelectedTeamForSwimmer('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder={t.refereeDashboard.selectLane} />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => {
                              const laneTeams = getTeamsForLane(i + 1);
                              return (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {t.refereeDashboard.lane} {i + 1} ({laneTeams.length} {t.refereeDashboard.teams})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Step 2: Select Team */}
                      {selectedLane && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.refereeDashboard.step2}</label>
                          <Select value={selectedTeamForSwimmer} onValueChange={setSelectedTeamForSwimmer}>
                            <SelectTrigger>
                              <SelectValue placeholder={t.refereeDashboard.selectTeam} />
                            </SelectTrigger>
                            <SelectContent>
                              {getTeamsForLane(parseInt(selectedLane)).map(team => {
                                const hasActive = teamHasActiveSwimmer(team.id);
                                return (
                                  <SelectItem 
                                    key={team.id} 
                                    value={team.id}
                                    disabled={hasActive}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                                      {team.name}
                                      {hasActive && <Badge variant="secondary" className="ml-1">{t.refereeDashboard.swimming}</Badge>}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {getTeamsForLane(parseInt(selectedLane)).length === 0 && (
                            <p className="text-sm text-muted-foreground">{t.refereeDashboard.noTeamsOnLane}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Step 3: Select Swimmer */}
                      {selectedTeamForSwimmer && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.refereeDashboard.step3}</label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {getSwimmersForTeam(selectedTeamForSwimmer).map(swimmer => (
                              <Button
                                key={swimmer.id}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => { void startSwimmerSession(swimmer, parseInt(selectedLane)); }}
                              >
                                {swimmer.name}
                                {swimmer.isUnder12 && <Badge variant="secondary" className="ml-2">{t.refereeDashboard.underTwelve}</Badge>}
                              </Button>
                            ))}
                            {getSwimmersForTeam(selectedTeamForSwimmer).length === 0 && (
                              <p className="text-sm text-muted-foreground">{t.refereeDashboard.noSwimmersInTeam}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
            </Card>

            {/* Lane Filter */}
            {activeSessions.length > 0 && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{t.refereeDashboard.filterByLane}</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={laneFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLaneFilter('all')}
                      >
                        {t.refereeDashboard.allLanes}
                      </Button>
                      {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => i + 1)
                        .filter(lane => activeSessions.some(s => s.laneNumber === lane))
                        .map(lane => (
                          <Button
                            key={lane}
                            variant={laneFilter === lane.toString() ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setLaneFilter(lane.toString())}
                          >
                            {t.refereeDashboard.lane} {lane}
                          </Button>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Swimmers - Lap Counting Cards Grouped by Lane */}
            {activeSessions.length > 0 && (
              <div className="space-y-6">
                {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => i + 1)
                  .filter(lane => {
                    if (laneFilter !== 'all' && laneFilter !== lane.toString()) return false;
                    return activeSessions.some(s => s.laneNumber === lane);
                  })
                  .map(lane => {
                    const laneSessions = activeSessions.filter(s => s.laneNumber === lane);
                    return (
                      <div key={lane} className="space-y-4">
                        {/* Lane Header with Visual Separator */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg">
                            <Waves className="h-5 w-5" />
                            <span className="font-bold text-lg">{t.refereeDashboard.lane} {lane}</span>
                          </div>
                          <div className="flex-1 h-1 bg-primary/20 rounded" />
                          <Badge variant="secondary">{laneSessions.length} {t.refereeDashboard.active}</Badge>
                        </div>
                        
                        {/* Sessions for this lane */}
                        <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-4 border-primary/30">
                          {laneSessions.map(session => (
                            <Card key={session.id} className="ring-2 ring-primary">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground font-bold"
                                      style={{ backgroundColor: getTeamColor(session.teamId) }}
                                    >
                                      {getTeamName(session.teamId).charAt(0)}
                                    </div>
                                    <div>
                                      <CardTitle className="text-lg">{getTeamName(session.teamId)}</CardTitle>
                                      <CardDescription className="flex items-center gap-1">
                                        <Waves className="h-3 w-3" />
                                        {getSwimmerName(session.swimmerId)}
                                      </CardDescription>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => { void endSwimmerSession(session); }}
                                  >
                                    <UserX className="h-4 w-4 mr-1" />
                                    {t.refereeDashboard.end}
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center justify-between">
                                  <div className="text-4xl font-bold">
                                    {lapCounts[session.teamId] || 0}
                                    <span className="text-lg font-normal text-muted-foreground ml-2">{t.refereeDashboard.laps}</span>
                                  </div>
                                  <Button
                                    size="lg"
                                    className="h-20 w-20 rounded-full text-xl"
                                    disabled={selectedCompetition.status !== 'active'}
                                    onClick={() => { void countLap(session); }}
                                    style={{ backgroundColor: getTeamColor(session.teamId) }}
                                  >
                                    +1
                                  </Button>
                                </div>
                                {selectedCompetition.status !== 'active' && (
                                  <p className="text-xs text-destructive mt-2">
                                    {t.refereeDashboard.countingDisabled} {t.competition.status[selectedCompetition.status]}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* No active swimmers message */}
            {activeSessions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Waves className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg text-muted-foreground">{t.refereeDashboard.registerToStart}</p>
                  <p className="text-sm text-muted-foreground">{t.refereeDashboard.oneSwimmerPerTeam}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
