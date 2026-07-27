import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Competition, Team, Swimmer, Referee, User } from '@/types';
import { dataApi, getSessionToken, getStorageConfig, isRemoteMode } from '@/lib/api';
import { Plus, Calendar, MapPin, Users, Trash2, Edit, Eye, UserPlus, Waves, Copy, Key, Clock, FileText, Download, ScrollText, Upload, EyeOff } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CompetitionControls } from '@/components/competition/CompetitionControls';
import { SwimmerImportDialog } from '@/components/competition/SwimmerImportDialog';
import { generateHumanPassword, generateRefereeId, hashPassword } from '@/lib/utils/password';
import { downloadDataUri, generateCompetitionFullLogCSV, generateCompetitionRawDataCSV, generateCompetitionResultsPDF } from '@/lib/utils/pdfGenerator';
import { SWATCH_BORDER } from '@/lib/utils/color';

export default function OrganizerDashboard() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const od = t.organizerDashboard;
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  
  const [showCompetitionDialog, setShowCompetitionDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [showSwimmerDialog, setShowSwimmerDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showRefereeDialog, setShowRefereeDialog] = useState(false);
  
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [anonymizingComp, setAnonymizingComp] = useState<Competition | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'organizer') {
      navigate('/login');
      return;
    }
    // After a server-side reset, organizers must pick a new password
    // before they can use the dashboard.
    if (user.forcePasswordChange) {
      navigate('/change-password?forced=1');
      return;
    }
    void loadCompetitions();
  }, [isAuthenticated, user, navigate]);

  const loadCompetitions = async () => {
    if (user) {
      try {
        const userCompetitions = await dataApi.getCompetitionsByOrganizer(user.id);
        setCompetitions(userCompetitions);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : od.errorLoadCompetitions;
        toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
        setCompetitions([]);
      }
    }
  };

  const loadCompetitionData = async (competition: Competition) => {
    try {
      setSelectedCompetition(competition);
      const [competitionTeams, competitionSwimmers, competitionReferees] = await Promise.all([
        dataApi.getTeamsByCompetition(competition.id),
        dataApi.getSwimmersByCompetition(competition.id),
        dataApi.getRefereesByCompetition(competition.id),
      ]);
      setTeams(competitionTeams);
      setSwimmers(competitionSwimmers);
      setReferees(competitionReferees);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorLoadCompetitionData;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent<HTMLFormElement>) => {
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
          title: od.invalidDateTime,
          description: od.invalidDateTimeDesc,
          variant: 'destructive'
        });
        return;
      }
    }
    
    try {
      const earlyBirdHour = parseInt(formData.get('earlyBirdHour') as string);
      const lateBirdHour = parseInt(formData.get('lateBirdHour') as string);
      const birdWindowMinutes = parseInt(formData.get('birdWindowMinutes') as string) || 60;

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
        earlyBirdHour: Number.isFinite(earlyBirdHour) ? earlyBirdHour : 5,
        lateBirdHour: Number.isFinite(lateBirdHour) ? lateBirdHour : 0,
        birdWindowMinutes,
        actualStartTime: editingCompetition?.actualStartTime || null,
        actualEndTime: editingCompetition?.actualEndTime || null,
        createdAt: editingCompetition?.createdAt || new Date().toISOString(),
      };

      await dataApi.saveCompetition(competition);
      await loadCompetitions();
      setShowCompetitionDialog(false);
      setEditingCompetition(null);
      toast({ title: editingCompetition ? od.competitionUpdated : od.competitionCreated });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorSaveCompetition;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompetition) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      const lane = parseInt(formData.get('lane') as string);
      const color = formData.get('color') as string;

      // Check for duplicate color on same lane
      const existingTeams = await dataApi.getTeamsByLane(selectedCompetition.id, lane);
      if (existingTeams.some(t => t.color === color && t.id !== editingTeam?.id)) {
        toast({ title: od.colorConflict, description: od.colorConflictDesc, variant: 'destructive' });
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

      await dataApi.saveTeam(team);
      await loadCompetitionData(selectedCompetition);
      setShowTeamDialog(false);
      setEditingTeam(null);
      toast({ title: editingTeam ? od.teamUpdated : od.teamCreated });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorSaveTeam;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCreateSwimmer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompetition) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      
      const dobInput = (formData.get('dateOfBirth') as string || '').trim();
      const dateOfBirth = dobInput || null;

      // Derive isUnder12 client-side so the API contract stays the same
      // (backend will recompute authoritatively from dateOfBirth).
      let isUnder12 = false;
      if (dateOfBirth) {
        const born = new Date(dateOfBirth);
        if (!Number.isNaN(born.getTime())) {
          const today = new Date();
          let years = today.getFullYear() - born.getFullYear();
          const m = today.getMonth() - born.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < born.getDate())) years--;
          isUnder12 = years < 12;
        }
      }

      const swimmer: Swimmer = {
        id: crypto.randomUUID(),
        name: formData.get('name') as string,
        teamId: formData.get('teamId') as string,
        competitionId: selectedCompetition.id,
        dateOfBirth,
        isUnder12,
        parentName: (formData.get('parentName') as string) || undefined,
        parentContact: (formData.get('parentContact') as string) || undefined,
        createdAt: new Date().toISOString(),
      };

      await dataApi.saveSwimmer(swimmer);
      await loadCompetitionData(selectedCompetition);
      setShowSwimmerDialog(false);
      toast({ title: od.swimmerAdded });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorSaveSwimmer;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  // State for showing referee credentials after creation
  const [newRefereeCredentials, setNewRefereeCredentials] = useState<{ userId: string; password: string; name?: string } | null>(null);

  const handleCreateReferee = async () => {
    if (!selectedCompetition) return;
    
    try {
      if (isRemoteMode()) {
        const storage = getStorageConfig();
        const url = `${storage.baseUrl}${storage.endpoints.referees}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        const sessionToken = getSessionToken();
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ competitionId: selectedCompetition.id }),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const createdReferee = body?.data ?? body;
        const userId = createdReferee?.userId ?? createdReferee?.uniqueId;
        const password = createdReferee?.password;

        if (!userId || !password) {
          throw new Error('Backend did not return referee credentials (userId/password).');
        }

        setNewRefereeCredentials({ userId, password });
        await loadCompetitionData(selectedCompetition);

        toast({
          title: od.refereeAdded,
          description: `${od.loginId}: ${userId}`,
        });
        return;
      }

      // Generate a referee ID and password immediately
      const refUserId = generateRefereeId();
      const password = generateHumanPassword();
      const passwordHash = await hashPassword(password);
      
      const referee: Referee = {
        id: crypto.randomUUID(),
        userId: refUserId,
        name: refUserId, // Use ID as name
        passwordHash,
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
          passwordHash,
          name: refUserId,
          role: 'referee',
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      await dataApi.saveReferee(referee);
      await loadCompetitionData(selectedCompetition);
      
      // Show credentials immediately (plain text for user to see)
      setNewRefereeCredentials({ userId: refUserId, password });
      
      toast({
        title: od.refereeAdded,
        description: `${od.loginId}: ${refUserId}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorCreateReferee;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleResetRefereePassword = async (referee: Referee) => {
    try {
      if (isRemoteMode()) {
        const storage = getStorageConfig();
        const url = `${storage.baseUrl}${storage.endpoints.referees}/${referee.id}/reset-password`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        const sessionToken = getSessionToken();
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const newPassword = body?.newPassword ?? body?.data?.newPassword;
        if (!newPassword) {
          throw new Error('Backend did not return a new password.');
        }

        if (selectedCompetition) await loadCompetitionData(selectedCompetition);

        setNewRefereeCredentials({ userId: referee.userId, password: newPassword, name: referee.name });
        toast({ title: od.passwordResetSuccess });
        return;
      }

      const newPassword = generateHumanPassword();
      const newPasswordHash = await hashPassword(newPassword);
      
      // Update referee record
      const updatedReferee = { ...referee, passwordHash: newPasswordHash };
      await dataApi.saveReferee(updatedReferee);
      
      // Update user account
      const USERS_KEY = 'swimtrack_users';
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
      const userIndex = users.findIndex(u => u.email === referee.userId);
      if (userIndex !== -1) {
        users[userIndex].passwordHash = newPasswordHash;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      
      // Clear any active sessions for this referee
      const AUTH_KEY = 'swimtrack_auth';
      const currentAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (currentAuth.user?.email === referee.userId) {
        localStorage.removeItem(AUTH_KEY);
      }
      
      // Refresh data
      if (selectedCompetition) await loadCompetitionData(selectedCompetition);
      
      // Show new credentials (plain text for user to see)
      setNewRefereeCredentials({ userId: referee.userId, password: newPassword, name: referee.name });
      
      toast({ title: od.passwordResetSuccess });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorResetPassword;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: od.copiedToClipboard });
  };

  const deleteCompetition = async (id: string) => {
    try {
      await dataApi.deleteCompetition(id);
      await loadCompetitions();
      if (selectedCompetition?.id === id) {
        setSelectedCompetition(null);
      }
      toast({ title: od.competitionDeleted, description: od.competitionDeletedDesc });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorDeleteCompetition;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleAnonymize = async () => {
    const comp = anonymizingComp;
    if (!comp) return;
    try {
      await dataApi.anonymizeCompetition(comp.id);
      await loadCompetitions();
      if (selectedCompetition?.id === comp.id) await loadCompetitionData(comp);
      toast({ title: od.anonymized, description: od.anonymizedDesc });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorAnonymize;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    } finally {
      setAnonymizingComp(null);
    }
  };

  const fetchCompetitionRawData = async (comp: Competition) => {
    const [compTeams, compSwimmers, compLapCounts] = await Promise.all([
      dataApi.getTeamsByCompetition(comp.id),
      dataApi.getSwimmersByCompetition(comp.id),
      dataApi.getLapCountsByCompetition(comp.id),
    ]);
    return { compTeams, compSwimmers, compLapCounts };
  };

  const handleDownloadPDF = async (comp: Competition) => {
    try {
      const { compTeams, compSwimmers, compLapCounts } = await fetchCompetitionRawData(comp);
      const pdfDataUri = generateCompetitionResultsPDF(comp, compTeams, compSwimmers, compLapCounts);
      downloadDataUri(pdfDataUri, `${comp.name.replace(/\s+/g, '_')}_results.pdf`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorLoadCompetitionData;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleDownloadCSV = async (comp: Competition) => {
    try {
      // Full raw dump: every entity, not a summary. Pull the extra entities
      // (referees, swim sessions) the summary export didn't include.
      const [compTeams, compSwimmers, compReferees, compSessions, compLapCounts] = await Promise.all([
        dataApi.getTeamsByCompetition(comp.id),
        dataApi.getSwimmersByCompetition(comp.id),
        dataApi.getRefereesByCompetition(comp.id),
        dataApi.getSwimSessionsByCompetition(comp.id),
        dataApi.getLapCountsByCompetition(comp.id),
      ]);
      const csvDataUri = generateCompetitionRawDataCSV(
        comp, compTeams, compSwimmers, compReferees, compSessions, compLapCounts,
      );
      downloadDataUri(csvDataUri, `${comp.name.replace(/\s+/g, '_')}_raw_data.csv`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorLoadCompetitionData;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleDownloadFullLog = async (comp: Competition) => {
    try {
      const { compTeams, compSwimmers, compLapCounts } = await fetchCompetitionRawData(comp);
      const logDataUri = generateCompetitionFullLogCSV(comp, compTeams, compSwimmers, compLapCounts);
      downloadDataUri(logDataUri, `${comp.name.replace(/\s+/g, '_')}_full_log.csv`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorLoadCompetitionData;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await dataApi.deleteTeam(id);
      if (selectedCompetition) await loadCompetitionData(selectedCompetition);
      toast({ title: od.teamDeleted });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorDeleteTeam;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const deleteSwimmer = async (id: string) => {
    try {
      await dataApi.deleteSwimmer(id);
      if (selectedCompetition) await loadCompetitionData(selectedCompetition);
      toast({ title: od.swimmerRemoved });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorDeleteSwimmer;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const deleteReferee = async (id: string) => {
    try {
      await dataApi.deleteReferee(id);
      if (selectedCompetition) await loadCompetitionData(selectedCompetition);
      toast({ title: od.refereeRemoved });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : od.errorDeleteReferee;
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
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
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
    { name: 'Silver', value: '#c0c0c0' },
  ];

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{od.title}</h1>
            <p className="text-muted-foreground">{od.subtitle}</p>
          </div>
          <Dialog open={showCompetitionDialog} onOpenChange={setShowCompetitionDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCompetition(null)}>
                <Plus className="h-4 w-4 mr-2" />
                {od.newCompetition}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCompetition ? od.editCompetition : od.createCompetition}</DialogTitle>
                <DialogDescription>{od.competitionDialogDesc}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCompetition} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{od.competitionName}</Label>
                  <Input id="name" name="name" defaultValue={editingCompetition?.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">{od.date}</Label>
                    <Input id="date" name="date" type="date" defaultValue={editingCompetition?.date} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">{od.location}</Label>
                    <Input id="location" name="location" defaultValue={editingCompetition?.location} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">{od.startTime}</Label>
                  <Input id="startTime" name="startTime" type="time" defaultValue={editingCompetition?.startTime || '08:00'} required />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numberOfLanes">{od.numberOfLanes}</Label>
                    <Input id="numberOfLanes" name="numberOfLanes" type="number" min="1" max="10" defaultValue={editingCompetition?.numberOfLanes || 6} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="laneLength">{od.laneLength}</Label>
                    <Input id="laneLength" name="laneLength" type="number" min="25" defaultValue={editingCompetition?.laneLength || 25} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doubleCountTimeout">{od.doubleCountTimeout}</Label>
                    <Input id="doubleCountTimeout" name="doubleCountTimeout" type="number" min="5" max="60" defaultValue={editingCompetition?.doubleCountTimeout || 15} required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="earlyBirdHour">{od.earlyBirdHour}</Label>
                    <Input id="earlyBirdHour" name="earlyBirdHour" type="number" min="0" max="23" defaultValue={editingCompetition?.earlyBirdHour ?? 5} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lateBirdHour">{od.lateBirdHour}</Label>
                    <Input id="lateBirdHour" name="lateBirdHour" type="number" min="0" max="23" defaultValue={editingCompetition?.lateBirdHour ?? 0} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birdWindowMinutes">{od.birdWindowMinutes}</Label>
                    <Input id="birdWindowMinutes" name="birdWindowMinutes" type="number" min="15" max="240" defaultValue={editingCompetition?.birdWindowMinutes ?? 60} required />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{od.birdConfigHint}</p>
                <DialogFooter>
                  <Button type="submit">{editingCompetition ? od.update : od.create}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Competitions List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold">{od.yourCompetitions}</h2>
            {competitions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Waves className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{od.noCompetitions}</p>
                  <p className="text-sm">{od.noCompetitionsDesc}</p>
                </CardContent>
              </Card>
            ) : (
              competitions.map(comp => (
                <Card 
                  key={comp.id} 
                  className={`cursor-pointer transition-colors ${selectedCompetition?.id === comp.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => { void loadCompetitionData(comp); }}
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
                        {t.competition.status[comp.status]}
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
                        {comp.numberOfLanes} {od.lanes} × {comp.laneLength}m
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
                      {/* CSV summary: available any time, before and after finish. */}
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void handleDownloadCSV(comp); }} title={od.downloadCsv}>
                        <Download className="h-3 w-3" />
                      </Button>
                      {/* Protocol PDF and full lap log: only once finished. */}
                      {comp.status === 'completed' && (
                        <>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void handleDownloadPDF(comp); }} title={od.downloadProtocol}>
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void handleDownloadFullLog(comp); }} title={od.downloadFullLog}>
                            <ScrollText className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setAnonymizingComp(comp); }} title={od.anonymize}>
                            <EyeOff className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); void deleteCompetition(comp.id); }}>
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
                    <CardDescription>{od.competitionOverview}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">{od.date}</p>
                          <p className="font-medium">{selectedCompetition.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">{od.location}</p>
                          <p className="font-medium">{selectedCompetition.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">{od.startTime}</p>
                          <p className="font-medium">{selectedCompetition.startTime}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                      {selectedCompetition.numberOfLanes} {od.lanes} × {selectedCompetition.laneLength}m | {od.doubleCountTimeoutShort}: {selectedCompetition.doubleCountTimeout}s
                    </div>
                  </CardContent>
                </Card>

                {/* Competition Controls - Start/Stop */}
                <CompetitionControls
                  competition={selectedCompetition}
                  teamCount={teams.length}
                  swimmerCount={swimmers.length}
                  refereeCount={referees.length}
                  onUpdate={(updated) => {
                    setSelectedCompetition(updated);
                    void loadCompetitions();
                    // Reload data in case referees were removed on completion
                    void loadCompetitionData(updated);
                  }}
                />

                {/* Teams */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{od.teams}</CardTitle>
                      <CardDescription>{teams.length} {od.teamsRegistered}</CardDescription>
                    </div>
                    <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setEditingTeam(null)} disabled={selectedCompetition.status === 'completed'}>
                          <Plus className="h-4 w-4 mr-1" />
                          {od.addTeam}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingTeam ? od.editTeam : od.addTeam}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateTeam} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="teamName">{od.teamName}</Label>
                            <Input id="teamName" name="name" defaultValue={editingTeam?.name} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lane">{od.assignedLane}</Label>
                            <Select name="lane" defaultValue={editingTeam?.assignedLane?.toString() || '1'}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: selectedCompetition.numberOfLanes }, (_, i) => (
                                  <SelectItem key={i + 1} value={(i + 1).toString()}>{od.lane} {i + 1}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{od.teamColor}</Label>
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
                                    className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 peer-checked:border-foreground transition-all"
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">{editingTeam ? od.update : od.add}</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {teams.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{od.noTeamsYet}</p>
                    ) : (
                      <div className="space-y-2">
                        {teams.map(team => (
                          <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full ${SWATCH_BORDER}`} style={{ backgroundColor: team.color }} />
                              <div>
                                <p className="font-medium">{team.name}</p>
                                <p className="text-sm text-muted-foreground">{od.lane} {team.assignedLane}</p>
                              </div>
                            </div>
                            {selectedCompetition.status !== 'completed' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingTeam(team); setShowTeamDialog(true); }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { void deleteTeam(team.id); }}>
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
                      <CardTitle className="text-lg">{od.swimmers}</CardTitle>
                      <CardDescription>{swimmers.length} {od.swimmersRegistered}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowImportDialog(true)}
                      disabled={teams.length === 0 || selectedCompetition.status === 'completed'}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {od.importSwimmers}
                    </Button>
                    <Dialog open={showSwimmerDialog} onOpenChange={setShowSwimmerDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={teams.length === 0 || selectedCompetition.status === 'completed'}>
                          <UserPlus className="h-4 w-4 mr-1" />
                          {od.addSwimmer}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{od.addSwimmer}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateSwimmer} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="swimmerName">{od.swimmerName}</Label>
                            <Input id="swimmerName" name="name" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="teamId">{od.team}</Label>
                            <Select name="teamId" required>
                              <SelectTrigger>
                                <SelectValue placeholder={od.selectTeam} />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">{od.dateOfBirthLabel}</Label>
                            <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parentName">{od.parentNameLabel}</Label>
                            <Input id="parentName" name="parentName" placeholder={od.parentNamePlaceholder} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parentContact">{od.parentContactLabel}</Label>
                            <Input id="parentContact" name="parentContact" placeholder={od.parentContactPlaceholder} />
                          </div>
                          <DialogFooter>
                            <Button type="submit">{od.addSwimmer}</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    </div>
                    <SwimmerImportDialog
                      open={showImportDialog}
                      onOpenChange={setShowImportDialog}
                      competitionId={selectedCompetition.id}
                      teams={teams}
                      onImported={() => { void loadCompetitionData(selectedCompetition); }}
                    />
                  </CardHeader>
                  <CardContent>
                    {swimmers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{od.noSwimmersYet}</p>
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
                                    {swimmer.dateOfBirth && (() => {
                                      const [y, m, d] = swimmer.dateOfBirth.split('-');
                                      return <span className="ml-2 text-xs text-muted-foreground">{`${d}.${m}.${y}`}</span>;
                                    })()}
                                    {swimmer.isUnder12 && <Badge variant="secondary" className="ml-2">{od.underTwelveBadge}</Badge>}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{team?.name || od.unknownTeam}</p>
                                </div>
                              </div>
                              {selectedCompetition.status !== 'completed' && (
                                <Button size="sm" variant="ghost" onClick={() => { void deleteSwimmer(swimmer.id); }}>
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
                      <CardTitle className="text-lg">{od.referees}</CardTitle>
                      <CardDescription>{referees.length} {od.refereesAssigned}</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { void handleCreateReferee(); }} disabled={selectedCompetition.status === 'completed'}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      {od.addReferee}
                    </Button>

                    {/* Credentials Dialog */}
                    <Dialog open={!!newRefereeCredentials} onOpenChange={() => setNewRefereeCredentials(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            {od.refereeCredentials}
                          </DialogTitle>
                          <DialogDescription>
                            {od.refereeCredentialsDesc}
                          </DialogDescription>
                        </DialogHeader>
                        {newRefereeCredentials && (
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>{od.loginId}</Label>
                              <div className="flex gap-2">
                                <Input readOnly value={newRefereeCredentials.userId} className="font-mono" />
                                <Button size="icon" variant="outline" onClick={() => copyToClipboard(newRefereeCredentials.userId)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>{od.password}</Label>
                              <div className="flex gap-2">
                                <Input readOnly value={newRefereeCredentials.password} className="font-mono" />
                                <Button size="icon" variant="outline" onClick={() => copyToClipboard(newRefereeCredentials.password)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {od.saveCredsWarning}
                            </p>
                          </div>
                        )}
                        <DialogFooter>
                          <Button onClick={() => setNewRefereeCredentials(null)}>{od.done}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {referees.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{od.noRefereesYet}</p>
                    ) : (
                      <div className="space-y-2">
                        {referees.map(referee => (
                          <div key={referee.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium font-mono">{referee.userId}</p>
                            </div>
                            {selectedCompetition.status !== 'completed' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => { void handleResetRefereePassword(referee); }} title={od.resetPassword}>
                                  <Key className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { void deleteReferee(referee.id); }} title={od.deleteReferee}>
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
                  <p className="text-lg">{od.selectCompetitionToManage}</p>
                  <p className="text-sm">{od.selectCompetitionDesc}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!anonymizingComp} onOpenChange={(open) => { if (!open) setAnonymizingComp(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{od.anonymizeTitle}</AlertDialogTitle>
            <AlertDialogDescription>{od.anonymizeDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleAnonymize(); }}>
              {od.anonymizeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
