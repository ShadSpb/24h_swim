import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Competition, User } from '@/types';
import { competitionStorage, refereeStorage, teamStorage, swimmerStorage, lapCountStorage } from '@/lib/storage';
import { generateCompetitionResultsPDF } from '@/lib/utils/pdfGenerator';
import { Play, Square, Clock, Pause } from 'lucide-react';
interface CompetitionControlsProps {
  competition: Competition;
  onUpdate: (competition: Competition) => void;
}

export function CompetitionControls({ competition, onUpdate }: CompetitionControlsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleStart = () => {
    const updated: Competition = {
      ...competition,
      status: 'active',
      actualStartTime: new Date().toISOString(),
    };
    competitionStorage.save(updated);
    onUpdate(updated);
    toast({ title: t.toast.competitionStarted });
  };

  const handlePause = () => {
    const updated: Competition = {
      ...competition,
      status: 'paused',
    };
    competitionStorage.save(updated);
    onUpdate(updated);
    toast({ title: t.toast.competitionPaused || 'Competition paused' });
  };

  const handleResume = () => {
    const updated: Competition = {
      ...competition,
      status: 'active',
    };
    competitionStorage.save(updated);
    onUpdate(updated);
    toast({ title: t.toast.competitionResumed || 'Competition resumed' });
  };

  const handleFinish = () => {
    // Get all data for PDF generation
    const teams = teamStorage.getByCompetition(competition.id);
    const swimmers = swimmerStorage.getByCompetition(competition.id);
    const lapCounts = lapCountStorage.getByCompetition(competition.id);
    
    // Generate PDF with results
    const pdfDataUri = generateCompetitionResultsPDF(competition, teams, swimmers, lapCounts);
    
    // Remove all referees for this competition
    const referees = refereeStorage.getByCompetition(competition.id);
    const USERS_KEY = 'swimtrack_users';
    const AUTH_KEY = 'swimtrack_auth';
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
    
    referees.forEach(referee => {
      // Remove user account
      const filteredUsers = users.filter(u => u.email !== referee.userId);
      localStorage.setItem(USERS_KEY, JSON.stringify(filteredUsers));
      
      // Clear session if referee is logged in
      const currentAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (currentAuth.user?.email === referee.userId) {
        localStorage.removeItem(AUTH_KEY);
      }
      
      // Delete referee record
      refereeStorage.delete(referee.id);
    });
    
    const updated: Competition = {
      ...competition,
      status: 'completed',
      actualEndTime: new Date().toISOString(),
      resultsPdf: pdfDataUri,
    };
    competitionStorage.save(updated);
    onUpdate(updated);
    toast({ title: t.toast.competitionFinished, description: 'Results PDF has been generated' });
  };

  const getStatusBadge = () => {
    switch (competition.status) {
      case 'upcoming':
        return <Badge variant="outline">{t.competition.status.upcoming}</Badge>;
      case 'active':
        return <Badge variant="default">{t.competition.status.active}</Badge>;
      case 'paused':
        return <Badge variant="outline" className="border-warning text-warning">{t.competition.status.paused}</Badge>;
      case 'completed':
        return <Badge variant="secondary">{t.competition.status.completed}</Badge>;
      case 'stopped':
        return <Badge variant="destructive">{t.competition.status.stopped}</Badge>;
      default:
        return null;
    }
  };

  const canPause = competition.status === 'active';
  const canFinish = competition.status === 'active' || competition.status === 'paused';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t.competition.controls}
            </CardTitle>
            <CardDescription>
              {t.competition.manualControl}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manual Controls */}
        <div className="flex flex-wrap gap-3">
          {competition.status === 'upcoming' && (
            <Button
              onClick={handleStart}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t.competition.startCompetition}
            </Button>
          )}

          {competition.status === 'paused' && (
            <Button
              onClick={handleResume}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t.competition.resumeCompetition}
            </Button>
          )}

          {canPause && (
            <Button
              onClick={handlePause}
              variant="outline"
              className="gap-2"
            >
              <Pause className="h-4 w-4" />
              {t.competition.pauseCompetition}
            </Button>
          )}

          <Button
            onClick={handleFinish}
            disabled={!canFinish}
            variant="secondary"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            {t.competition.finishCompetition}
          </Button>
        </div>

        {/* Status info */}
        {competition.actualStartTime && (
          <div className="text-sm text-muted-foreground pt-4 border-t">
            <p>Started: {new Date(competition.actualStartTime).toLocaleString()}</p>
            {competition.actualEndTime && (
              <p>Ended: {new Date(competition.actualEndTime).toLocaleString()}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
