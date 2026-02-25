import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Competition } from '@/types';
import { dataApi } from '@/lib/api';
import { downloadPDF, generateCompetitionResultsPDF } from '@/lib/utils/pdfGenerator';
import { Play, Square, Clock, Pause, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CompetitionControlsProps {
  competition: Competition;
  onUpdate: (competition: Competition) => void;
}

export function CompetitionControls({ competition, onUpdate }: CompetitionControlsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [hasTeams, setHasTeams] = useState(false);
  const [hasSwimmers, setHasSwimmers] = useState(false);
  const [hasReferees, setHasReferees] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadRequirements = async () => {
      try {
        const [teams, swimmers, referees] = await Promise.all([
          dataApi.getTeamsByCompetition(competition.id),
          dataApi.getSwimmersByCompetition(competition.id),
          dataApi.getRefereesByCompetition(competition.id),
        ]);
        if (!cancelled) {
          setHasTeams(teams.length > 0);
          setHasSwimmers(swimmers.length > 0);
          setHasReferees(referees.length > 0);
        }
      } catch (error) {
        if (!cancelled) {
          setHasTeams(false);
          setHasSwimmers(false);
          setHasReferees(false);
        }
      }
    };

    void loadRequirements();
    return () => { cancelled = true; };
  }, [competition.id, competition.status]);

  const canStart = hasTeams && hasSwimmers && hasReferees;

  const handleStart = async () => {
    try {
      if (!canStart) {
        toast({
          title: t.toast.cannotStart || 'Cannot start competition',
          description: t.toast.missingRequirements || 'Please add teams, swimmers, and referees first',
          variant: 'destructive'
        });
        return;
      }

      const updated: Competition = {
        ...competition,
        status: 'active',
        actualStartTime: new Date().toISOString(),
      };
      await dataApi.saveCompetition(updated);
      onUpdate(updated);
      toast({ title: t.toast.competitionStarted });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start competition';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handlePause = async () => {
    try {
      const updated: Competition = {
        ...competition,
        status: 'paused',
      };
      await dataApi.saveCompetition(updated);
      onUpdate(updated);
      toast({ title: t.toast.competitionPaused || 'Competition paused' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause competition';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleResume = async () => {
    try {
      const updated: Competition = {
        ...competition,
        status: 'active',
      };
      await dataApi.saveCompetition(updated);
      onUpdate(updated);
      toast({ title: t.toast.competitionResumed || 'Competition resumed' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume competition';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
  };

  const handleFinish = async () => {
    try {
      // Get all data for PDF generation
      const [teams, swimmers, lapCounts] = await Promise.all([
        dataApi.getTeamsByCompetition(competition.id),
        dataApi.getSwimmersByCompetition(competition.id),
        dataApi.getLapCountsByCompetition(competition.id),
      ]);

      // Generate PDF with results
      const pdfDataUri = generateCompetitionResultsPDF(competition, teams, swimmers, lapCounts);
      const filename = `${competition.name.replace(/\s+/g, '_')}_results.pdf`;
      downloadPDF(pdfDataUri, filename);

      const updated: Competition = {
        ...competition,
        status: 'completed',
        actualEndTime: new Date().toISOString(),
        resultsPdf: pdfDataUri,
      };
      try {
        await dataApi.saveCompetition(updated);
      } catch (saveError) {
        // If backend rejects storing the PDF payload, still complete competition.
        const fallbackUpdate: Competition = {
          ...updated,
          resultsPdf: undefined,
        };
        await dataApi.saveCompetition(fallbackUpdate);
        onUpdate(fallbackUpdate);
        toast({
          title: t.toast.competitionFinished,
          description: 'Results PDF was downloaded, but could not be saved on server.',
        });
        return;
      }

      onUpdate(updated);
      toast({ title: t.toast.competitionFinished, description: 'Results PDF has been generated' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to finish competition';
      toast({ title: t.common.error, description: errorMessage, variant: 'destructive' });
    }
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

  const getMissingRequirements = () => {
    const missing: string[] = [];
    if (!hasTeams) missing.push('Teams');
    if (!hasSwimmers) missing.push('Swimmers');
    if (!hasReferees) missing.push('Referees');
    return missing;
  };

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
        {/* Missing requirements warning */}
        {competition.status === 'upcoming' && !canStart && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t.toast.missingRequirements}: {getMissingRequirements().join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Controls */}
        <div className="flex flex-wrap gap-3">
          {competition.status === 'upcoming' && (
            <Button
              onClick={() => { void handleStart(); }}
              disabled={!canStart}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t.competition.startCompetition}
            </Button>
          )}

          {competition.status === 'paused' && (
            <Button
              onClick={() => { void handleResume(); }}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t.competition.resumeCompetition}
            </Button>
          )}

          {canPause && (
            <Button
              onClick={() => { void handlePause(); }}
              variant="outline"
              className="gap-2"
            >
              <Pause className="h-4 w-4" />
              {t.competition.pauseCompetition}
            </Button>
          )}

          <Button
            onClick={() => { void handleFinish(); }}
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
