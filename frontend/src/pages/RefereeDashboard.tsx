import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Competition, Team, Swimmer, Referee, SwimSession } from '@/types';
import { 
  competitionStorage, 
  teamStorage, 
  swimmerStorage, 
  refereeStorage, 
  swimSessionStorage,
  lapCountStorage,
  canCountLap,
  LapCount
} from '@/lib/storage';
import { Waves, AlertCircle, UserCheck, UserX, RefreshCw } from 'lucide-react';

export default function RefereeDashboard() {
  const { isAuthenticated, user } = useAuth();
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
    loadCompetitions();
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

  const loadCompetitions = useCallback(() => {
    if (!user) return;
    
    const allReferees = refereeStorage.getAll();
    const userRefereeAssignments = allReferees.filter(r => r.userId === user.email || r.email === user.email);
    const competitionIds = [...new Set(userRefereeAssignments.map(r => r.competitionId))];
    const userCompetitions = competitionIds.map(id => competitionStorage.getById(id)).filter(Boolean) as Competition[];
    
    setCompetitions(userCompetitions);
  }, [user]);

  const selectCompetition = (competitionId: string) => {
    const comp = competitionStorage.getById(competitionId);
    if (comp) {
      setSelectedCompetition(comp);
      
      const referees = refereeStorage.getByCompetition(competitionId);
      const myReferee = referees.find(r => r.userId === user?.email || r.email === user?.email);
      setAssignedReferee(myReferee || null);
      
      // Load all teams and swimmers for this competition
      setAllTeams(teamStorage.getByCompetition(competitionId));
      setAllSwimmers(swimmerStorage.getByCompetition(competitionId));
      
      // Load lap counts for all teams
      const teams = teamStorage.getByCompetition(competitionId);
      const counts: Record<string, number> = {};
      teams.forEach(team => {
        const teamLaps = lapCountStorage.getByTeam(team.id);
        counts[team.id] = teamLaps.length;
      });
      setLapCounts(counts);
      
      // Load all active sessions for this competition
      const sessions = swimSessionStorage.getActive(competitionId);
      setActiveSessions(sessions.filter(s => s.isActive));
    }
  };

  const refreshCompetition = () => {
    if (!selectedCompetition) return;
    const updated = competitionStorage.getById(selectedCompetition.id);
    if (updated) {
      setSelectedCompetition(updated);
      // Also refresh active sessions
      const sessions = swimSessionStorage.getActive(updated.id);
      setActiveSessions(sessions.filter(s => s.isActive));
      toast({ title: 'Status refreshed' });
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

  const startSwimmerSession = (swimmer: Swimmer, laneNumber: number) => {
    if (!selectedCompetition || !assignedReferee) return;
    
    const team = allTeams.find(t => t.id === swimmer.teamId);
    if (!team) return;
    
    // Check if team already has active swimmer
    const existingSession = getActiveSessionForTeam(team.id);
    if (existingSession) {
      toast({ 
        title: 'Cannot register swimmer', 
        description: 'This team already has an active swimmer.',
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
    
    swimSessionStorage.save(session);
    setActiveSessions(prev => [...prev, session]);
    setShowSwimmerDialog(false);
    setSelectedLane('');
    setSelectedTeamForSwimmer('');
    toast({ title: `${swimmer.name} is now swimming in Lane ${laneNumber}` });
  };

  const endSwimmerSession = (session: SwimSession) => {
    session.endTime = new Date().toISOString();
    session.isActive = false;
    swimSessionStorage.save(session);
    setActiveSessions(prev => prev.filter(s => s.id !== session.id));
    toast({ title: `${getSwimmerName(session.swimmerId)} session ended` });
  };

  const countLap = (session: SwimSession) => {
    if (!selectedCompetition || !assignedReferee) return;
    
    // Check if competition is active
    if (selectedCompetition.status !== 'active') {
      let description = 'The competition has ended.';
      if (selectedCompetition.status === 'upcoming') {
        description = 'The competition has not started yet.';
      } else if (selectedCompetition.status === 'paused') {
        description = 'The competition is paused. Wait for organizer to resume.';
      }
      toast({ 
        title: 'Cannot count laps', 
        description,
        variant: 'destructive'
      });
      return;
    }
    
    // Check double-count prevention
    const timeout = selectedCompetition.doubleCountTimeout || 15;
    if (!canCountLap(session.swimmerId, timeout)) {
      const lastLapTime = lastCountTime[session.swimmerId];
      const timeSinceLastCount = lastLapTime 
        ? Math.floor((Date.now() - lastLapTime) / 1000)
        : 0;
      toast({ 
        title: 'Too soon!', 
        description: `Wait ${timeout - timeSinceLastCount} more seconds`,
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
    
    lapCountStorage.add(lapCount);
    
    // Update session lap count
    session.lapCount = newLapNumber;
    swimSessionStorage.save(session);
    
    // Update local state
    setLapCounts(prev => ({ ...prev, [teamId]: newLapNumber }));
    setLastCountTime(prev => ({ ...prev, [session.swimmerId]: Date.now() }));
    
    toast({ title: `Lap ${newLapNumber} counted for ${getTeamName(teamId)}!` });
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

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Referee Dashboard</h1>
            <p className="text-muted-foreground">Count laps for swimmers</p>
          </div>
        </div>

        {/* Competition Selection */}
        {!selectedCompetition && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Select Competition</CardTitle>
              <CardDescription>Choose the competition you're refereeing</CardDescription>
            </CardHeader>
            <CardContent>
              {competitions.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No assignments</AlertTitle>
                  <AlertDescription>
                    You haven't been assigned to any competitions yet.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select onValueChange={selectCompetition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a competition" />
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
                <AlertTitle>
                  {selectedCompetition.status === 'upcoming' 
                    ? 'Competition Not Started' 
                    : selectedCompetition.status === 'paused'
                    ? 'Competition Paused'
                    : 'Competition Ended'}
                </AlertTitle>
                <AlertDescription>
                  {selectedCompetition.status === 'upcoming' 
                    ? 'Lap counting will be available once the organizer starts the competition.'
                    : selectedCompetition.status === 'paused'
                    ? 'The competition is paused. Lap counting will resume when the organizer continues.'
                    : 'The competition has ended. Lap counting is no longer available.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Status Bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Competition</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{selectedCompetition.name}</p>
                      <Badge variant={
                        selectedCompetition.status === 'active' ? 'default' 
                        : selectedCompetition.status === 'paused' ? 'outline'
                        : selectedCompetition.status === 'upcoming' ? 'outline' 
                        : 'secondary'
                      }>
                        {selectedCompetition.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Elapsed Time - Only show if competition has started */}
                  {selectedCompetition.actualStartTime && (
                    <div>
                      <p className="text-sm text-muted-foreground">Elapsed Time</p>
                      <p className="font-semibold text-2xl font-mono">{elapsedTime}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Active Swimmers</p>
                    <p className="font-semibold text-2xl">{activeSessions.length}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refreshCompetition}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCompetition(null)}>
                      Change Competition
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Register New Swimmer Button */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Register Swimmer</CardTitle>
                  <CardDescription>
                    {activeSessions.length > 0 
                      ? `${activeSessions.length} swimmer(s) currently in the water` 
                      : 'No swimmers in the water'}
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
                      Register Swimmer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register Swimmer</DialogTitle>
                      <DialogDescription>Select lane, team, then swimmer to enter the water</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Step 1: Select Lane */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">1. Select Lane</label>
                        <Select value={selectedLane} onValueChange={(value) => {
                          setSelectedLane(value);
                          setSelectedTeamForSwimmer('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select lane" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => {
                              const laneTeams = getTeamsForLane(i + 1);
                              return (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  Lane {i + 1} ({laneTeams.length} teams)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Step 2: Select Team */}
                      {selectedLane && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">2. Select Team</label>
                          <Select value={selectedTeamForSwimmer} onValueChange={setSelectedTeamForSwimmer}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select team" />
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
                                      {hasActive && <Badge variant="secondary" className="ml-1">Swimming</Badge>}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {getTeamsForLane(parseInt(selectedLane)).length === 0 && (
                            <p className="text-sm text-muted-foreground">No teams assigned to this lane</p>
                          )}
                        </div>
                      )}
                      
                      {/* Step 3: Select Swimmer */}
                      {selectedTeamForSwimmer && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">3. Select Swimmer</label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {getSwimmersForTeam(selectedTeamForSwimmer).map(swimmer => (
                              <Button
                                key={swimmer.id}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => startSwimmerSession(swimmer, parseInt(selectedLane))}
                              >
                                {swimmer.name}
                                {swimmer.isUnder12 && <Badge variant="secondary" className="ml-2">Under 12</Badge>}
                              </Button>
                            ))}
                            {getSwimmersForTeam(selectedTeamForSwimmer).length === 0 && (
                              <p className="text-sm text-muted-foreground">No swimmers in this team</p>
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
                    <span className="text-sm font-medium">Filter by Lane:</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={laneFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLaneFilter('all')}
                      >
                        All Lanes
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
                            Lane {lane}
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
                            <span className="font-bold text-lg">Lane {lane}</span>
                          </div>
                          <div className="flex-1 h-1 bg-primary/20 rounded" />
                          <Badge variant="secondary">{laneSessions.length} active</Badge>
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
                                    onClick={() => endSwimmerSession(session)}
                                  >
                                    <UserX className="h-4 w-4 mr-1" />
                                    End
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center justify-between">
                                  <div className="text-4xl font-bold">
                                    {lapCounts[session.teamId] || 0}
                                    <span className="text-lg font-normal text-muted-foreground ml-2">laps</span>
                                  </div>
                                  <Button
                                    size="lg"
                                    className="h-20 w-20 rounded-full text-xl"
                                    disabled={selectedCompetition.status !== 'active'}
                                    onClick={() => countLap(session)}
                                    style={{ backgroundColor: getTeamColor(session.teamId) }}
                                  >
                                    +1
                                  </Button>
                                </div>
                                {selectedCompetition.status !== 'active' && (
                                  <p className="text-xs text-destructive mt-2">
                                    Counting disabled - competition is {selectedCompetition.status}
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
                  <p className="text-lg text-muted-foreground">Register swimmers to start counting laps</p>
                  <p className="text-sm text-muted-foreground">Each team can have one swimmer in the water at a time</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
