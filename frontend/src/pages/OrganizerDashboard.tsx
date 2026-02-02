import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Competition, Team, Swimmer, Referee, User } from '@/types';
import { competitionStorage, teamStorage, swimmerStorage, refereeStorage, laneAssignmentStorage, lapCountStorage, swimSessionStorage, LaneAssignment } from '@/lib/storage';
import { Plus, Calendar, MapPin, Users, Trash2, Edit, Eye, UserPlus, Waves, Copy, Key, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { CompetitionControls } from '@/components/competition/CompetitionControls';
import { generateHumanPassword, generateRefereeId } from '@/lib/utils/password';
import { downloadPDF } from '@/lib/utils/pdfGenerator';

export default function OrganizerDashboard() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  
  const [showCompetitionDialog, setShowCompetitionDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [showSwimmerDialog, setShowSwimmerDialog] = useState(false);
  const [showRefereeDialog, setShowRefereeDialog] = useState(false);
  
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'organizer') {
      navigate('/login');
      return;
    }
    loadCompetitions();
  }, [isAuthenticated, user, navigate]);

  const loadCompetitions = () => {
    if (user) {
      try {
        const userCompetitions = competitionStorage.getByOrganizer(user.id);
        setCompetitions(userCompetitions);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load competitions';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        setCompetitions([]);
      }
    }
  };

  const loadCompetitionData = (competition: Competition) => {
    try {
      setSelectedCompetition(competition);
      setTeams(teamStorage.getByCompetition(competition.id));
      setSwimmers(swimmerStorage.getByCompetition(competition.id));
      setReferees(refereeStorage.getByCompetition(competition.id));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load competition data';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateCompetition = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const date = formData.get('date') as string;
    const startTime = formData.get('startTime') as string;
    
    // Validate date/time is not in the past (only for new competitions)
    if (!editingCompetition) {
      const competitionDateTime = new Date(`${date}T${startTime}`);
      const now = new Date();
      if (competitionDateTime < now) {
        toast({ 
          title: 'Invalid date/time', 
          description: 'Competition cannot be scheduled in the past',
          variant: 'destructive' 
        });
        return;
      }
    }
    
    try {
      const competition: Competition = {
        id: editingCompetition?.id || crypto.randomUUID(),
        name: formData.get('name') as string,
        description: '', // No longer used
        date,
        startTime,
        endTime: editingCompetition?.endTime || '', // Not used - 24h competition
        location: formData.get('location') as string,
        numberOfLanes: parseInt(formData.get('numberOfLanes') as string),
        laneLength: parseInt(formData.get('laneLength') as string),
        doubleCountTimeout: parseInt(formData.get('doubleCountTimeout') as string) || 15,
        organizerId: user!.id,
        status: editingCompetition?.status || 'upcoming',
        autoStart: false,
        autoFinish: false,
        actualStartTime: editingCompetition?.actualStartTime || null,
        actualEndTime: editingCompetition?.actualEndTime || null,
        createdAt: editingCompetition?.createdAt || new Date().toISOString(),
      };

      competitionStorage.save(competition);
      
      // Initialize lane assignments if new competition
      if (!editingCompetition) {
        for (let i = 1; i <= competition.numberOfLanes; i++) {
          const laneAssignment: LaneAssignment = {
            id: crypto.randomUUID(),
            competitionId: competition.id,
            laneNumber: i,
            refereeId: null,
            activeSwimmerId: null,
            registeredAt: null,
            startTime: null,
            endTime: null,
          };
          laneAssignmentStorage.save(laneAssignment);
        }
      }

      loadCompetitions();
      setShowCompetitionDialog(false);
      setEditingCompetition(null);
      toast({ title: editingCompetition ? 'Competition updated' : 'Competition created' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save competition';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateTeam = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompetition) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      const lane = parseInt(formData.get('lane') as string);
      const color = formData.get('color') as string;

      // Check for duplicate color on same lane
      const existingTeams = teamStorage.getByLane(selectedCompetition.id, lane);
      if (existingTeams.some(t => t.color === color && t.id !== editingTeam?.id)) {
        toast({ title: 'Color conflict', description: 'Two teams on the same lane cannot have the same color', variant: 'destructive' });
        return;
      }

      const team: Team = {
        id: editingTeam?.id || crypto.randomUUID(),
        name: formData.get('name') as string,
        color,
        competitionId: selectedCompetition.id,
        assignedLane: lane,
        createdAt: editingTeam?.createdAt || new Date().toISOString(),
      };

      teamStorage.save(team);
      loadCompetitionData(selectedCompetition);
      setShowTeamDialog(false);
      setEditingTeam(null);
      toast({ title: editingTeam ? 'Team updated' : 'Team created' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save team';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateSwimmer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompetition) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      
      const swimmer: Swimmer = {
        id: crypto.randomUUID(),
        name: formData.get('name') as string,
        teamId: formData.get('teamId') as string,
        competitionId: selectedCompetition.id,
        isUnder12: formData.get('isUnder12') === 'true',
        parentContact: formData.get('parentContact') as string || undefined,
        createdAt: new Date().toISOString(),
      };

      swimmerStorage.save(swimmer);
      loadCompetitionData(selectedCompetition);
      setShowSwimmerDialog(false);
      toast({ title: 'Swimmer added' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save swimmer';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  // State for showing referee credentials after creation
  const [newRefereeCredentials, setNewRefereeCredentials] = useState<{ userId: string; password: string; name?: string } | null>(null);

  const handleCreateReferee = () => {
    if (!selectedCompetition) return;
    
    try {
      // Generate a referee ID and password immediately
      const refUserId = generateRefereeId();
      const password = generateHumanPassword();
      
      const referee: Referee = {
        id: crypto.randomUUID(),
        userId: refUserId,
        name: refUserId, // Use ID as name
        password,
        competitionId: selectedCompetition.id,
        createdAt: new Date().toISOString(),
      };

      // Create the user account for login
      const USERS_KEY = 'swimtrack_users';
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
      if (!users.find(u => u.email === refUserId)) {
        const newUser: User = {
          id: crypto.randomUUID(),
          email: refUserId,
          password,
          name: refUserId,
          role: 'referee',
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      refereeStorage.save(referee);
      loadCompetitionData(selectedCompetition);
      
      // Show credentials immediately
      setNewRefereeCredentials({ userId: refUserId, password });
      
      toast({ 
        title: 'Referee added',
        description: `Login ID: ${refUserId}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create referee';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleResetRefereePassword = (referee: Referee) => {
    try {
      const newPassword = generateHumanPassword();
      
      // Update referee record
      const updatedReferee = { ...referee, password: newPassword };
      refereeStorage.save(updatedReferee);
      
      // Update user account
      const USERS_KEY = 'swimtrack_users';
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
      const userIndex = users.findIndex(u => u.email === referee.userId);
      if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      
      // Clear any active sessions for this referee
      const AUTH_KEY = 'swimtrack_auth';
      const currentAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (currentAuth.user?.email === referee.userId) {
        localStorage.removeItem(AUTH_KEY);
      }
      
      // Refresh data
      if (selectedCompetition) loadCompetitionData(selectedCompetition);
      
      // Show new credentials
      setNewRefereeCredentials({ userId: referee.userId, password: newPassword, name: referee.name });
      
      toast({ title: 'Password reset successfully' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const deleteCompetition = (id: string) => {
    try {
      // Cascade delete all related data
      const competition = competitionStorage.getById(id);
      if (!competition) return;
    
    // Delete teams
    const teamsToDelete = teamStorage.getByCompetition(id);
    teamsToDelete.forEach(team => teamStorage.delete(team.id));
    
    // Delete swimmers
    const swimmersToDelete = swimmerStorage.getByCompetition(id);
    swimmersToDelete.forEach(swimmer => swimmerStorage.delete(swimmer.id));
    
    // Delete referees and their user accounts
    const refereesToDelete = refereeStorage.getByCompetition(id);
    const USERS_KEY = 'swimtrack_users';
    const AUTH_KEY = 'swimtrack_auth';
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
    
    refereesToDelete.forEach(referee => {
      // Remove user account
      const filteredUsers = users.filter(u => u.email !== referee.userId);
      localStorage.setItem(USERS_KEY, JSON.stringify(filteredUsers));
      
      // Clear session if referee is logged in
      const currentAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (currentAuth.user?.email === referee.userId) {
        localStorage.removeItem(AUTH_KEY);
      }
      
      refereeStorage.delete(referee.id);
    });
    
    // Delete lane assignments
    const assignmentsToDelete = laneAssignmentStorage.getByCompetition(id);
    assignmentsToDelete.forEach(a => laneAssignmentStorage.delete(a.id));
    
    // Delete lap counts
    const lapCountsToDelete = lapCountStorage.getByCompetition(id);
    lapCountsToDelete.forEach(lc => lapCountStorage.delete(lc.id));
    
    // Delete swim sessions
    const sessionsToDelete = swimSessionStorage.getByCompetition(id);
    sessionsToDelete.forEach(s => swimSessionStorage.delete(s.id));
    
    // Finally delete the competition
    competitionStorage.delete(id);
    
    loadCompetitions();
    if (selectedCompetition?.id === id) {
      setSelectedCompetition(null);
    }
    toast({ title: 'Competition deleted', description: 'All related data has been removed' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete competition';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleDownloadPDF = (comp: Competition) => {
    if (comp.resultsPdf) {
      downloadPDF(comp.resultsPdf, `${comp.name.replace(/\s+/g, '_')}_results.pdf`);
    }
  };

  const deleteTeam = (id: string) => {
    try {
      teamStorage.delete(id);
      if (selectedCompetition) loadCompetitionData(selectedCompetition);
      toast({ title: 'Team deleted' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete team';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const deleteSwimmer = (id: string) => {
    try {
      swimmerStorage.delete(id);
      if (selectedCompetition) loadCompetitionData(selectedCompetition);
      toast({ title: 'Swimmer removed' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete swimmer';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const deleteReferee = (id: string) => {
    try {
      refereeStorage.delete(id);
      if (selectedCompetition) loadCompetitionData(selectedCompetition);
      toast({ title: 'Referee removed' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete referee';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const TEAM_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Cyan', value: '#06b6d4' },
  ];

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Organizer Dashboard</h1>
            <p className="text-muted-foreground">Manage your swimming competitions</p>
          </div>
          <Dialog open={showCompetitionDialog} onOpenChange={setShowCompetitionDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCompetition(null)}>
                <Plus className="h-4 w-4 mr-2" />
                New Competition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCompetition ? 'Edit Competition' : 'Create Competition'}</DialogTitle>
                <DialogDescription>Fill in the details for your 24-hour swimming event.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCompetition} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Competition Name</Label>
                  <Input id="name" name="name" defaultValue={editingCompetition?.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" defaultValue={editingCompetition?.date} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" defaultValue={editingCompetition?.location} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" name="startTime" type="time" defaultValue={editingCompetition?.startTime || '08:00'} required />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numberOfLanes">Number of Lanes</Label>
                    <Input id="numberOfLanes" name="numberOfLanes" type="number" min="1" max="10" defaultValue={editingCompetition?.numberOfLanes || 6} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="laneLength">Lane Length (m)</Label>
                    <Input id="laneLength" name="laneLength" type="number" min="25" defaultValue={editingCompetition?.laneLength || 25} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doubleCountTimeout">Double-Count Timeout (s)</Label>
                    <Input id="doubleCountTimeout" name="doubleCountTimeout" type="number" min="5" max="60" defaultValue={editingCompetition?.doubleCountTimeout || 15} required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingCompetition ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Competitions List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold">Your Competitions</h2>
            {competitions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Waves className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No competitions yet</p>
                  <p className="text-sm">Create your first competition to get started</p>
                </CardContent>
              </Card>
            ) : (
              competitions.map(comp => (
                <Card 
                  key={comp.id} 
                  className={`cursor-pointer transition-colors ${selectedCompetition?.id === comp.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => loadCompetitionData(comp)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{comp.name}</CardTitle>
                      <Badge variant={
                        comp.status === 'active' ? 'default' 
                        : comp.status === 'paused' ? 'outline'
                        : comp.status === 'completed' ? 'secondary' 
                        : comp.status === 'stopped' ? 'destructive'
                        : 'outline'
                      }>
                        {comp.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex flex-col gap-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {comp.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {comp.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Waves className="h-3 w-3" />
                        {comp.numberOfLanes} lanes × {comp.laneLength}m
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex gap-2 flex-wrap">
                      {comp.status !== 'completed' && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingCompetition(comp); setShowCompetitionDialog(true); }}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/monitor/${comp.id}`); }}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      {comp.status === 'completed' && comp.resultsPdf && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(comp); }} title="Download Results PDF">
                          <FileText className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteCompetition(comp.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Competition Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCompetition ? (
              <>
                {/* Competition Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Waves className="h-5 w-5" />
                      {selectedCompetition.name}
                    </CardTitle>
                    <CardDescription>Competition Overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Date</p>
                          <p className="font-medium">{selectedCompetition.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="font-medium">{selectedCompetition.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Start Time</p>
                          <p className="font-medium">{selectedCompetition.startTime}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                      {selectedCompetition.numberOfLanes} lanes × {selectedCompetition.laneLength}m | Double-count timeout: {selectedCompetition.doubleCountTimeout}s
                    </div>
                  </CardContent>
                </Card>

                {/* Competition Controls - Start/Stop */}
                <CompetitionControls 
                  competition={selectedCompetition} 
                  onUpdate={(updated) => {
                    setSelectedCompetition(updated);
                    loadCompetitions();
                    // Reload data in case referees were removed on completion
                    loadCompetitionData(updated);
                  }} 
                />

                {/* Teams */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Teams</CardTitle>
                      <CardDescription>{teams.length} teams registered</CardDescription>
                    </div>
                    <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setEditingTeam(null)} disabled={selectedCompetition.status === 'completed'}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Team
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingTeam ? 'Edit Team' : 'Add Team'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateTeam} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="teamName">Team Name</Label>
                            <Input id="teamName" name="name" defaultValue={editingTeam?.name} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lane">Assigned Lane</Label>
                            <Select name="lane" defaultValue={editingTeam?.assignedLane?.toString() || '1'}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => (
                                  <SelectItem key={i + 1} value={(i + 1).toString()}>Lane {i + 1}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Team Color</Label>
                            <div className="flex flex-wrap gap-2">
                              {TEAM_COLORS.map(color => (
                                <label key={color.value} className="cursor-pointer">
                                  <input
                                    type="radio"
                                    name="color"
                                    value={color.value}
                                    defaultChecked={editingTeam?.color === color.value || (!editingTeam && color.value === '#3b82f6')}
                                    className="sr-only peer"
                                  />
                                  <div 
                                    className="w-8 h-8 rounded-full border-2 border-transparent peer-checked:border-foreground transition-all"
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">{editingTeam ? 'Update' : 'Add'}</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {teams.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No teams added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {teams.map(team => (
                          <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: team.color }} />
                              <div>
                                <p className="font-medium">{team.name}</p>
                                <p className="text-sm text-muted-foreground">Lane {team.assignedLane}</p>
                              </div>
                            </div>
                            {selectedCompetition.status !== 'completed' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingTeam(team); setShowTeamDialog(true); }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteTeam(team.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Swimmers */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Swimmers</CardTitle>
                      <CardDescription>{swimmers.length} swimmers registered</CardDescription>
                    </div>
                    <Dialog open={showSwimmerDialog} onOpenChange={setShowSwimmerDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={teams.length === 0 || selectedCompetition.status === 'completed'}>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add Swimmer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Swimmer</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateSwimmer} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="swimmerName">Swimmer Name</Label>
                            <Input id="swimmerName" name="name" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="teamId">Team</Label>
                            <Select name="teamId" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select team" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="isUnder12">Under 12 years old?</Label>
                            <Select name="isUnder12" defaultValue="false">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="false">No</SelectItem>
                                <SelectItem value="true">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parentContact">Parent Contact (if under 12)</Label>
                            <Input id="parentContact" name="parentContact" placeholder="Phone or email" />
                          </div>
                          <DialogFooter>
                            <Button type="submit">Add Swimmer</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {swimmers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No swimmers added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {swimmers.map(swimmer => {
                          const team = teams.find(t => t.id === swimmer.teamId);
                          return (
                            <div key={swimmer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {swimmer.name}
                                    {swimmer.isUnder12 && <Badge variant="secondary" className="ml-2">Under 12</Badge>}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{team?.name || 'Unknown team'}</p>
                                </div>
                              </div>
                              {selectedCompetition.status !== 'completed' && (
                                <Button size="sm" variant="ghost" onClick={() => deleteSwimmer(swimmer.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Referees */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Referees</CardTitle>
                      <CardDescription>{referees.length} referees assigned</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleCreateReferee} disabled={selectedCompetition.status === 'completed'}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add Referee
                    </Button>

                    {/* Credentials Dialog */}
                    <Dialog open={!!newRefereeCredentials} onOpenChange={() => setNewRefereeCredentials(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Referee Credentials
                          </DialogTitle>
                          <DialogDescription>
                            Share these credentials with the referee. They will need them to login.
                          </DialogDescription>
                        </DialogHeader>
                        {newRefereeCredentials && (
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Login ID</Label>
                              <div className="flex gap-2">
                                <Input readOnly value={newRefereeCredentials.userId} className="font-mono" />
                                <Button size="icon" variant="outline" onClick={() => copyToClipboard(newRefereeCredentials.userId)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Password</Label>
                              <div className="flex gap-2">
                                <Input readOnly value={newRefereeCredentials.password} className="font-mono" />
                                <Button size="icon" variant="outline" onClick={() => copyToClipboard(newRefereeCredentials.password)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              ⚠️ Make sure to save these credentials - the password cannot be recovered.
                            </p>
                          </div>
                        )}
                        <DialogFooter>
                          <Button onClick={() => setNewRefereeCredentials(null)}>Done</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {referees.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No referees assigned yet</p>
                    ) : (
                      <div className="space-y-2">
                        {referees.map(referee => (
                          <div key={referee.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium font-mono">{referee.userId}</p>
                            </div>
                            {selectedCompetition.status !== 'completed' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleResetRefereePassword(referee)} title="Reset password">
                                  <Key className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteReferee(referee.id)} title="Delete referee">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Waves className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a competition to manage</p>
                  <p className="text-sm">Or create a new one to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
