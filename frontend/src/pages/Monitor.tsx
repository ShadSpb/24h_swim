import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Competition, Team, Swimmer } from '@/types';
import { dataApi, getTeamStats, getSwimmerStats, isRemoteMode } from '@/lib/api';
import { Trophy, Clock, Zap, Moon, Sun, Waves, RefreshCw, ArrowUpDown, Users, User, MapPin, Calendar, Ruler, AlertCircle } from 'lucide-react';

type SortDirection = 'asc' | 'desc';
type TeamSortKey = 'rank' | 'name' | 'laps' | 'lapsPerHour' | 'fastestLap' | 'lateBird' | 'earlyBird';
type SwimmerSortKey = 'rank' | 'name' | 'team' | 'laps' | 'lapsPerHour' | 'fastestLap' | 'lateBird' | 'earlyBird';


interface TeamStatWithRank {
  team: Team;
  totalLaps: number;
  lapsPerHour: number;
  fastestLap: number | null;
  lateBirdLaps: number;
  earlyBirdLaps: number;
  rank: number;
}

interface SwimmerStatWithRank {
  swimmer: Swimmer;
  team: Team | undefined;
  totalLaps: number;
  lapsPerHour: number;
  fastestLap: number | null;
  lateBirdLaps: number;
  earlyBirdLaps: number;
  rank: number;
}

const REFRESH_INTERVALS = [
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
];


export default function Monitor() {
  const { competitionId } = useParams();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [teamStats, setTeamStats] = useState<Awaited<ReturnType<typeof getTeamStats>>>([]);
  const [swimmerStats, setSwimmerStats] = useState<Awaited<ReturnType<typeof getSwimmerStats>>>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'team' | 'swimmer'>('team');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sorting state
  const [teamSortKey, setTeamSortKey] = useState<TeamSortKey>('rank');
  const [teamSortDir, setTeamSortDir] = useState<SortDirection>('asc');
  const [swimmerSortKey, setSwimmerSortKey] = useState<SwimmerSortKey>('rank');
  const [swimmerSortDir, setSwimmerSortDir] = useState<SortDirection>('asc');

  useEffect(() => {
    const loadCompetitions = async () => {
      try {
        setApiError(null);
        const allCompetitions = await dataApi.getCompetitions();
        setCompetitions(allCompetitions);
        
        if (competitionId) {
          const comp = await dataApi.getCompetitionById(competitionId);
          if (comp) setSelectedCompetition(comp);
        }
      } catch (error) {
        console.error('Error loading competitions:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to load competitions. Please check your API configuration.');
      }
    };
    loadCompetitions();
  }, [competitionId]);

  const loadStats = useCallback(async () => {
    if (selectedCompetition) {
      try {
        setApiError(null);
        setIsLoading(true);
        
        // Refresh competition data to get latest status
        const updatedComp = await dataApi.getCompetitionById(selectedCompetition.id);
        if (updatedComp) setSelectedCompetition(updatedComp);
        
        const stats = await getTeamStats(selectedCompetition.id);
        setTeamStats(stats);
        const sStats = await getSwimmerStats(selectedCompetition.id);
        setSwimmerStats(sStats);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error loading stats:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to load statistics. Please check your API configuration.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [selectedCompetition?.id]);

  // Initial load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (autoRefresh && selectedCompetition) {
      intervalRef.current = setInterval(loadStats, refreshInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, loadStats, selectedCompetition]);

  // Countdown timer - pauses when competition is paused
  const frozenCountdownRef = useRef<string | null>(null);
  const competitionRef = useRef<Competition | null>(null);
  
  // Keep ref updated with latest competition data
  useEffect(() => {
    competitionRef.current = selectedCompetition;
  }, [selectedCompetition]);
  
  useEffect(() => {
    if (!selectedCompetition) return;

    const calculateTime = () => {
      const now = new Date();
      const comp = competitionRef.current;
      if (!comp) return;
      
      // If not started yet, show full 24 hours
      if (!comp.actualStartTime) {
        setCountdown('24:00:00');
        frozenCountdownRef.current = null;
        return;
      }
      
      // Completed competition
      if (comp.status === 'completed' || comp.actualEndTime) {
        setCountdown('00:00:00');
        frozenCountdownRef.current = null;
        return;
      }

      // If competition is paused, freeze the countdown at current value
      if (comp.status === 'paused') {
        // If we don't have a frozen value yet, calculate it once
        if (frozenCountdownRef.current === null) {
          const startDate = new Date(comp.actualStartTime);
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          const remainingMs = Math.max(0, endDate.getTime() - now.getTime());
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          frozenCountdownRef.current = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        // Keep showing the frozen value - don't update
        setCountdown(frozenCountdownRef.current);
        return;
      }

      // Competition is active (running) - clear frozen value and countdown normally
      frozenCountdownRef.current = null;
      
      const startDate = new Date(comp.actualStartTime);
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      // Active competition - countdown
      if (now < endDate) {
        const remainingMs = endDate.getTime() - now.getTime();
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown('00:00:00');
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [selectedCompetition?.id]);

  const formatTime = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Add ranks to stats
  const teamStatsWithRank: TeamStatWithRank[] = useMemo(() => {
    return teamStats.map((stat, index) => ({
      ...stat,
      rank: index + 1
    }));
  }, [teamStats]);

  const swimmerStatsWithRank: SwimmerStatWithRank[] = useMemo(() => {
    return swimmerStats.map((stat, index) => ({
      ...stat,
      rank: index + 1
    }));
  }, [swimmerStats]);

  // Sorted team stats
  const sortedTeamStats = useMemo(() => {
    const sorted = [...teamStatsWithRank];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (teamSortKey) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'name': cmp = a.team.name.localeCompare(b.team.name); break;
        case 'laps': cmp = a.totalLaps - b.totalLaps; break;
        case 'lapsPerHour': cmp = a.lapsPerHour - b.lapsPerHour; break;
        case 'fastestLap': cmp = (a.fastestLap || Infinity) - (b.fastestLap || Infinity); break;
        case 'lateBird': cmp = a.lateBirdLaps - b.lateBirdLaps; break;
        case 'earlyBird': cmp = a.earlyBirdLaps - b.earlyBirdLaps; break;
      }
      return teamSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [teamStatsWithRank, teamSortKey, teamSortDir]);

  // Sorted swimmer stats
  const sortedSwimmerStats = useMemo(() => {
    const sorted = [...swimmerStatsWithRank];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (swimmerSortKey) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'name': cmp = a.swimmer.name.localeCompare(b.swimmer.name); break;
        case 'team': cmp = (a.team?.name || '').localeCompare(b.team?.name || ''); break;
        case 'laps': cmp = a.totalLaps - b.totalLaps; break;
        case 'lapsPerHour': cmp = a.lapsPerHour - b.lapsPerHour; break;
        case 'fastestLap': cmp = (a.fastestLap || Infinity) - (b.fastestLap || Infinity); break;
        case 'lateBird': cmp = a.lateBirdLaps - b.lateBirdLaps; break;
        case 'earlyBird': cmp = a.earlyBirdLaps - b.earlyBirdLaps; break;
      }
      return swimmerSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [swimmerStatsWithRank, swimmerSortKey, swimmerSortDir]);

  const handleTeamSort = (key: TeamSortKey) => {
    if (teamSortKey === key) {
      setTeamSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTeamSortKey(key);
      setTeamSortDir('asc');
    }
  };

  const handleSwimmerSort = (key: SwimmerSortKey) => {
    if (swimmerSortKey === key) {
      setSwimmerSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSwimmerSortKey(key);
      setSwimmerSortDir('asc');
    }
  };

  const SortButton = ({ active, direction }: { active: boolean; direction: SortDirection }) => (
    <ArrowUpDown className={`h-4 w-4 ml-1 inline ${active ? 'text-primary' : 'text-muted-foreground'}`} />
  );

  const totalLaps = teamStats.reduce((sum, ts) => sum + ts.totalLaps, 0);
  const totalDistance = selectedCompetition 
    ? (totalLaps * selectedCompetition.laneLength * 2) / 1000 
    : 0;

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Live Monitor</h1>
            <p className="text-muted-foreground">Real-time competition standings</p>
          </div>
          
          {!competitionId && (
            <Select onValueChange={async (id) => {
              try {
                const comp = await dataApi.getCompetitionById(id);
                if (comp) setSelectedCompetition(comp);
              } catch (error) {
                console.error('Error selecting competition:', error);
                setApiError(error instanceof Error ? error.message : 'Failed to load competition');
              }
            }}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select competition" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map(comp => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* API Error Alert */}
        {apiError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription>
              {apiError}
              {isRemoteMode() && (
                <p className="mt-2 text-sm">
                  Remote API mode is enabled. Please ensure your API endpoints are properly configured in the Admin panel.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!selectedCompetition ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Waves className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a competition to view</p>
              <p className="text-sm">Choose from the dropdown above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Competition Metadata Header */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl">{selectedCompetition.name}</CardTitle>
                <CardDescription>Competition Details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{new Date(selectedCompetition.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium">{selectedCompetition.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Planned Start</p>
                      <p className="font-medium">{selectedCompetition.startTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Lane Length</p>
                      <p className="font-medium">{selectedCompetition.laneLength} m</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Remaining
                    {selectedCompetition.status === 'paused' && (
                      <Badge variant="secondary" className="ml-2">Paused</Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold font-mono ${selectedCompetition.status === 'paused' ? 'text-muted-foreground' : 'text-primary'}`}>
                    {countdown}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    Total Laps
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalLaps.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Total Distance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalDistance.toFixed(1)} km</p>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard */}
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadStats}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                    Refresh
                  </Button>
                </div>
                
                {/* Auto-refresh controls */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-refresh"
                      checked={autoRefresh}
                      onCheckedChange={setAutoRefresh}
                    />
                    <Label htmlFor="auto-refresh" className="text-sm">
                      Auto-refresh
                    </Label>
                  </div>
                  
                  {autoRefresh && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Interval:</Label>
                      <Select
                        value={refreshInterval.toString()}
                        onValueChange={(v) => setRefreshInterval(parseInt(v))}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REFRESH_INTERVALS.map((interval) => (
                            <SelectItem key={interval.value} value={interval.value.toString()}>
                              {interval.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {autoRefresh && (
                    <Badge variant="outline" className="text-xs">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" style={{ animationDuration: '2s' }} />
                      Live
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'team' | 'swimmer')}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="team" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      By Team
                    </TabsTrigger>
                    <TabsTrigger value="swimmer" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      By Swimmer
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="team">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 cursor-pointer" onClick={() => handleTeamSort('rank')}>
                            Rank <SortButton active={teamSortKey === 'rank'} direction={teamSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleTeamSort('name')}>
                            Team <SortButton active={teamSortKey === 'name'} direction={teamSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleTeamSort('laps')}>
                            Laps / Meters <SortButton active={teamSortKey === 'laps'} direction={teamSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleTeamSort('lapsPerHour')}>
                            Laps/Hour <SortButton active={teamSortKey === 'lapsPerHour'} direction={teamSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleTeamSort('fastestLap')}>
                            Fastest Lap <SortButton active={teamSortKey === 'fastestLap'} direction={teamSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleTeamSort('lateBird')}>
                            <span className="flex items-center justify-end gap-1">
                              <Moon className="h-4 w-4" />
                              Late Bird <SortButton active={teamSortKey === 'lateBird'} direction={teamSortDir} />
                            </span>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleTeamSort('earlyBird')}>
                            <span className="flex items-center justify-end gap-1">
                              <Sun className="h-4 w-4" />
                              Early Bird <SortButton active={teamSortKey === 'earlyBird'} direction={teamSortDir} />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTeamStats.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No laps recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedTeamStats.map((stat) => (
                            <TableRow key={stat.team.id}>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  {stat.rank <= 3 && <Trophy className={`h-4 w-4 ${stat.rank === 1 ? 'text-yellow-500' : stat.rank === 2 ? 'text-gray-400' : 'text-amber-600'}`} />}
                                  <span className="font-medium">{stat.rank}</span>
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-6 h-6 rounded-full"
                                    style={{ backgroundColor: stat.team.color }}
                                  />
                                  <div>
                                    <p className="font-medium">{stat.team.name}</p>
                                    <p className="text-xs text-muted-foreground">Lane {stat.team.assignedLane}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-lg">{stat.totalLaps}</span>
                                <span className="text-muted-foreground text-sm ml-2">/ {stat.totalLaps * (selectedCompetition?.laneLength || 25) * 2}m</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.lapsPerHour.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatTime(stat.fastestLap)}
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.lateBirdLaps > 0 ? (
                                  <Badge variant="secondary">{stat.lateBirdLaps}</Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.earlyBirdLaps > 0 ? (
                                  <Badge variant="secondary">{stat.earlyBirdLaps}</Badge>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  
                  <TabsContent value="swimmer">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 cursor-pointer" onClick={() => handleSwimmerSort('rank')}>
                            Rank <SortButton active={swimmerSortKey === 'rank'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSwimmerSort('name')}>
                            Swimmer <SortButton active={swimmerSortKey === 'name'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSwimmerSort('team')}>
                            Team <SortButton active={swimmerSortKey === 'team'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSwimmerSort('laps')}>
                            Laps / Meters <SortButton active={swimmerSortKey === 'laps'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSwimmerSort('lapsPerHour')}>
                            Laps/Hour <SortButton active={swimmerSortKey === 'lapsPerHour'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSwimmerSort('fastestLap')}>
                            Fastest Lap <SortButton active={swimmerSortKey === 'fastestLap'} direction={swimmerSortDir} />
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSwimmerSort('lateBird')}>
                            <span className="flex items-center justify-end gap-1">
                              <Moon className="h-4 w-4" />
                              Late Bird <SortButton active={swimmerSortKey === 'lateBird'} direction={swimmerSortDir} />
                            </span>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSwimmerSort('earlyBird')}>
                            <span className="flex items-center justify-end gap-1">
                              <Sun className="h-4 w-4" />
                              Early Bird <SortButton active={swimmerSortKey === 'earlyBird'} direction={swimmerSortDir} />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSwimmerStats.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              No laps recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedSwimmerStats.map((stat) => (
                            <TableRow key={stat.swimmer.id}>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  {stat.rank <= 3 && <Trophy className={`h-4 w-4 ${stat.rank === 1 ? 'text-yellow-500' : stat.rank === 2 ? 'text-gray-400' : 'text-amber-600'}`} />}
                                  <span className="font-medium">{stat.rank}</span>
                                </span>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">{stat.swimmer.name}</p>
                              </TableCell>
                              <TableCell>
                                {stat.team && (
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded-full"
                                      style={{ backgroundColor: stat.team.color }}
                                    />
                                    <span className="text-sm">{stat.team.name}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-lg">{stat.totalLaps}</span>
                                <span className="text-muted-foreground text-sm ml-2">/ {stat.totalLaps * (selectedCompetition?.laneLength || 25) * 2}m</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.lapsPerHour.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatTime(stat.fastestLap)}
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.lateBirdLaps > 0 ? (
                                  <Badge variant="secondary">{stat.lateBirdLaps}</Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {stat.earlyBirdLaps > 0 ? (
                                  <Badge variant="secondary">{stat.earlyBirdLaps}</Badge>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
