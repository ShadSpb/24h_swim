import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Team, Swimmer } from '@/types';
import { dataApi } from '@/lib/api';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface SwimmerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  teams: Team[];
  onImported: () => void;
}

interface ParsedRow {
  line: number;
  name: string;
  teamName: string;
  dobRaw: string;
  parentName: string;
  parentContact: string;
  teamId: string | null;
  dateOfBirth: string | null; // ISO YYYY-MM-DD
  isUnder12: boolean;
  error: string | null;
}

// Replace {placeholders} in a translated template.
function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// Cap a value so a stray huge cell (e.g. a wrong, comma-separated file where
// the whole line becomes one "name") can't blow out error messages.
function clip(s: string, n = 48): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

// Whole years between dob and today.
function ageInYears(isoDob: string): number {
  const born = new Date(isoDob);
  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) years--;
  return years;
}

// DD.MM.YYYY (1-2 digit day/month allowed) -> ISO YYYY-MM-DD, or null if invalid.
function parseDob(raw: string): { iso: string | null; valid: boolean } {
  if (!raw) return { iso: null, valid: true }; // empty DOB is allowed
  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return { iso: null, valid: false };
  const [, d, mo, y] = m;
  const dd = d.padStart(2, '0');
  const mm = mo.padStart(2, '0');
  const iso = `${y}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00`);
  const ok = !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(y)
    && date.getMonth() + 1 === Number(mm)
    && date.getDate() === Number(dd);
  return ok ? { iso, valid: true } : { iso: null, valid: false };
}

export function SwimmerImportDialog({
  open, onOpenChange, competitionId, teams, onImported,
}: SwimmerImportDialogProps) {
  const { t } = useLanguage();
  const od = t.organizerDashboard;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [wrongDelimiter, setWrongDelimiter] = useState(false);

  // Reset when the dialog is closed.
  useEffect(() => {
    if (!open) {
      setFileName(null);
      setRows([]);
      setImporting(false);
      setWrongDelimiter(false);
    }
  }, [open]);

  const teamByName = (raw: string): Team | undefined => {
    const key = raw.trim().toLowerCase();
    return teams.find(team => team.name.trim().toLowerCase() === key);
  };

  const looksLikeHeader = (cells: string[]): boolean => {
    const c0 = (cells[0] || '').toLowerCase();
    const c1 = (cells[1] || '').toLowerCase();
    return c0.includes('name') && c1.includes('team');
  };

  const parseCsv = (text: string): ParsedRow[] => {
    const lines = text.split(/\r?\n/);
    const result: ParsedRow[] = [];

    lines.forEach((rawLine, idx) => {
      const lineNo = idx + 1;
      if (!rawLine.trim()) return; // skip blank lines
      const cells = rawLine.split(';').map(c => c.trim());
      if (result.length === 0 && looksLikeHeader(cells)) return; // skip a header row

      const name = cells[0] || '';
      const teamName = cells[1] || '';
      const dobRaw = cells[2] || '';
      const parentName = cells[3] || '';
      const parentContact = cells[4] || '';

      const { iso, valid: dobValid } = parseDob(dobRaw);
      const isUnder12 = iso ? ageInYears(iso) < 12 : false;
      const team = teamName ? teamByName(teamName) : undefined;

      let error: string | null = null;
      if (!name) {
        error = fmt(od.importErrNoName, { line: lineNo });
      } else if (!teamName) {
        error = fmt(od.importErrEmptyTeam, { name: clip(name) });
      } else if (!team) {
        error = fmt(od.importErrTeamNotFound, { name: clip(name), team: clip(teamName) });
      } else if (!dobValid) {
        error = fmt(od.importErrInvalidDate, { name: clip(name) });
      } else if (isUnder12 && (!parentName || !parentContact)) {
        error = fmt(od.importErrNoParent, { name: clip(name) });
      }

      result.push({
        line: lineNo, name, teamName, dobRaw, parentName, parentContact,
        teamId: team?.id ?? null, dateOfBirth: iso, isUnder12, error,
      });
    });

    return result;
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      setRows(parsed);
      // Heuristic: a file with no ';' but with ',' is almost certainly the
      // wrong format (e.g. an exported full-log CSV).
      setWrongDelimiter(parsed.length > 0 && !text.includes(';') && text.includes(','));
    };
    reader.readAsText(file);
  };

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);
  const canImport = rows.length > 0 && errorRows.length === 0 && !importing;

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    try {
      for (const row of validRows) {
        const swimmer: Swimmer = {
          id: crypto.randomUUID(),
          name: row.name,
          teamId: row.teamId as string,
          competitionId,
          dateOfBirth: row.dateOfBirth,
          isUnder12: row.isUnder12,
          parentName: row.parentName || undefined,
          parentContact: row.parentContact || undefined,
          createdAt: new Date().toISOString(),
        };
        await dataApi.saveSwimmer(swimmer);
        imported += 1;
      }
      onImported();
      onOpenChange(false);
      toast({ title: fmt(od.importSuccess, { count: imported }) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : od.errorSaveSwimmer;
      toast({
        title: t.common.error,
        description: imported > 0 ? `${fmt(od.importSuccess, { count: imported })} — ${detail}` : detail,
        variant: 'destructive',
      });
      if (imported > 0) onImported();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{od.importDialogTitle}</DialogTitle>
          <DialogDescription>{od.importDialogDesc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground font-mono bg-muted rounded p-2">
            {od.importFormatHint}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {rows.length > 0 || fileName ? od.importChooseAnother : od.importChooseFile}
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" /> {fileName}
              </span>
            )}
          </div>

          {fileName && rows.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{od.importNoRows}</AlertDescription>
            </Alert>
          )}

          {wrongDelimiter && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{od.importWrongDelimiter}</AlertDescription>
            </Alert>
          )}

          {rows.length > 0 && (
            <>
              <div>
                <p className="font-medium">{od.importPreview}</p>
                <p className="text-sm text-muted-foreground">{od.importReviewHint}</p>
              </div>

              <div className="max-h-80 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{od.importColLine}</TableHead>
                      <TableHead>{od.swimmerName}</TableHead>
                      <TableHead>{od.team}</TableHead>
                      <TableHead>{od.importColDob}</TableHead>
                      <TableHead>{od.importColParent}</TableHead>
                      <TableHead>{od.importColContact}</TableHead>
                      <TableHead>{od.importColStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.line} className={`align-top ${row.error ? 'bg-destructive/5' : ''}`}>
                        <TableCell className="text-muted-foreground">{row.line}</TableCell>
                        <TableCell className="font-medium">
                          <div className="max-w-[160px] truncate" title={row.name}>{row.name || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[110px] truncate" title={row.teamName}>{row.teamName || '—'}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.dobRaw || '—'}</TableCell>
                        <TableCell>
                          <div className="max-w-[110px] truncate" title={row.parentName}>{row.parentName || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[130px] truncate" title={row.parentContact}>{row.parentContact || '—'}</div>
                        </TableCell>
                        <TableCell>
                          {row.error ? (
                            <div className="max-w-[240px] text-destructive text-xs flex items-start gap-1">
                              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span className="break-words">{row.error}</span>
                            </div>
                          ) : (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              {od.importStatusOk}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-sm">
                {fmt(od.importSummary, { valid: validRows.length, errors: errorRows.length })}
              </p>
              {errorRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{od.importHasErrors}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => { void handleImport(); }}
            disabled={!canImport}
          >
            {importing ? od.importing : fmt(od.importButton, { count: validRows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
