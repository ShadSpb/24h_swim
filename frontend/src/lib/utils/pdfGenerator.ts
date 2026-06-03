// PDF / CSV generators for competition results
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Competition, Team, Swimmer } from '@/types';
import { LapCount } from '@/lib/api/types';

interface TeamStats {
  team: Team;
  totalLaps: number;
  totalMeters: number;
  lapsPerHour: number;
  fastestLap: number | null;
}

interface SwimmerStats {
  swimmer: Swimmer;
  team?: Team;
  totalLaps: number;
  totalMeters: number;
  teamSharePct: number | null; // share of the swimmer's team result, 0..100
  age: number | null;
}

// Age in whole years at the competition date (falls back to "today").
function computeAge(dateOfBirth: string | null | undefined, refDate: Date): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  let years = refDate.getFullYear() - born.getFullYear();
  const m = refDate.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < born.getDate())) years--;
  return years;
}

// dd.mm.yyyy for display, raw ISO untouched.
function formatDob(dateOfBirth: string | null | undefined): string {
  if (!dateOfBirth) return '-';
  const [y, m, d] = dateOfBirth.split('-');
  if (!y || !m || !d) return dateOfBirth;
  return `${d}.${m}.${y}`;
}

// Reference date used to compute swimmer ages.
function referenceDate(competition: Competition): Date {
  const candidate = competition.actualEndTime || competition.date;
  const parsed = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function computeTeamStats(
  competition: Competition,
  teams: Team[],
  lapCounts: LapCount[]
): TeamStats[] {
  return teams.map(team => {
    const teamLaps = lapCounts.filter(lc => lc.teamId === team.id);
    const totalLaps = teamLaps.length;
    const totalMeters = totalLaps * competition.laneLength;

    let lapsPerHour = 0;
    let fastestLap: number | null = null;

    if (teamLaps.length >= 2) {
      const sortedLaps = [...teamLaps].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 1; i < sortedLaps.length; i++) {
        const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i - 1].timestamp).getTime();
        if (fastestLap === null || diff < fastestLap) {
          fastestLap = diff;
        }
      }

      const firstLap = new Date(sortedLaps[0].timestamp).getTime();
      const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
      const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
      lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;
    }

    return { team, totalLaps, totalMeters, lapsPerHour, fastestLap };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}

function computeSwimmerStats(
  competition: Competition,
  teams: Team[],
  swimmers: Swimmer[],
  lapCounts: LapCount[]
): SwimmerStats[] {
  const refDate = referenceDate(competition);
  // Total laps per team to derive each swimmer's share.
  const teamLapTotals = new Map<string, number>();
  for (const lc of lapCounts) {
    teamLapTotals.set(lc.teamId, (teamLapTotals.get(lc.teamId) || 0) + 1);
  }

  return swimmers.map(swimmer => {
    const team = teams.find(t => t.id === swimmer.teamId);
    const totalLaps = lapCounts.filter(lc => lc.swimmerId === swimmer.id).length;
    const totalMeters = totalLaps * competition.laneLength;
    const teamTotal = teamLapTotals.get(swimmer.teamId) || 0;
    const teamSharePct = teamTotal > 0 ? (totalLaps / teamTotal) * 100 : null;
    const age = computeAge(swimmer.dateOfBirth, refDate);

    return { swimmer, team, totalLaps, totalMeters, teamSharePct, age };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}

export function generateCompetitionResultsPDF(
  competition: Competition,
  teams: Team[],
  swimmers: Swimmer[],
  lapCounts: LapCount[]
): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(competition.name, pageWidth / 2, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Competition Results', pageWidth / 2, 28, { align: 'center' });

  // Competition info
  doc.setFontSize(10);
  let yPos = 40;
  doc.text(`Date: ${competition.date}`, 14, yPos);
  doc.text(`Location: ${competition.location}`, 14, yPos + 6);
  doc.text(`Lanes: ${competition.numberOfLanes} × ${competition.laneLength}m`, 14, yPos + 12);

  if (competition.actualStartTime) {
    doc.text(`Started: ${new Date(competition.actualStartTime).toLocaleString()}`, 14, yPos + 18);
  }
  if (competition.actualEndTime) {
    doc.text(`Finished: ${new Date(competition.actualEndTime).toLocaleString()}`, 14, yPos + 24);
  }

  yPos += 36;

  // ---- Team Leaderboard ----
  const teamStats = computeTeamStats(competition, teams, lapCounts);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Team Leaderboard', 14, yPos);
  yPos += 6;

  const teamTableData = teamStats.map((stats, index) => [
    (index + 1).toString(),
    stats.team.name,
    `Lane ${stats.team.assignedLane}`,
    stats.totalLaps.toString(),
    `${stats.totalMeters}m`,
    stats.lapsPerHour > 0 ? stats.lapsPerHour.toFixed(1) : '-',
    stats.fastestLap ? formatTime(stats.fastestLap) : '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Rank', 'Team', 'Lane', 'Laps', 'Distance', 'Laps/Hour', 'Fastest Lap']],
    body: teamTableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // ---- Interesting Facts ----
  const swimmerStats = computeSwimmerStats(competition, teams, swimmers, lapCounts);
  const participants = swimmerStats.filter(s => s.totalLaps > 0);

  const totalLapsAll = lapCounts.length;
  const totalMetersAll = totalLapsAll * competition.laneLength;

  const topSwimmer = participants.length > 0
    ? participants.reduce((best, s) => (s.totalLaps > best.totalLaps ? s : best))
    : null;

  const aged = participants.filter(s => s.age !== null);
  const oldestSwimmer = aged.length > 0
    ? aged.reduce((oldest, s) => ((s.age as number) > (oldest.age as number) ? s : oldest))
    : null;
  const youngestSwimmer = aged.length > 0
    ? aged.reduce((youngest, s) => ((s.age as number) < (youngest.age as number) ? s : youngest))
    : null;

  if (yPos > pageHeight - 70) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Interesting Facts', 14, yPos);
  yPos += 6;

  const facts: string[] = [];
  facts.push(`Overall distance swum by all teams: ${totalMetersAll.toLocaleString()} m (${(totalMetersAll / 1000).toFixed(2)} km, ${totalLapsAll} laps)`);
  if (topSwimmer) {
    facts.push(`Top swimmer by distance: ${topSwimmer.swimmer.name} (${topSwimmer.team?.name || '-'}) - ${topSwimmer.totalMeters.toLocaleString()} m / ${topSwimmer.totalLaps} laps`);
  }
  if (oldestSwimmer) {
    facts.push(`Oldest participant: ${oldestSwimmer.swimmer.name} (${oldestSwimmer.age} y, ${oldestSwimmer.team?.name || '-'}) - ${oldestSwimmer.totalMeters.toLocaleString()} m`);
  }
  if (youngestSwimmer) {
    facts.push(`Youngest participant: ${youngestSwimmer.swimmer.name} (${youngestSwimmer.age} y, ${youngestSwimmer.team?.name || '-'}) - ${youngestSwimmer.totalMeters.toLocaleString()} m`);
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  for (const fact of facts) {
    const lines = doc.splitTextToSize(`• ${fact}`, pageWidth - 28) as string[];
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 2;
  }

  yPos += 8;

  // ---- Full Swimmer List ----
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('All Swimmers', 14, yPos);
  yPos += 6;

  const swimmerTableData = swimmerStats.map(stats => [
    stats.swimmer.name,
    formatDob(stats.swimmer.dateOfBirth),
    stats.team?.name || '-',
    stats.totalLaps.toString(),
    stats.teamSharePct !== null ? `${stats.teamSharePct.toFixed(1)}%` : '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Name Surname', 'Date of Birth', 'Team', 'Laps', '% of Team']],
    body: swimmerTableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Return as base64 data URL
  return doc.output('datauristring');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// Escape a single CSV field per RFC 4180 (quote if it contains separator,
// quote, or newline; double up embedded quotes).
function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Raw, per-swimmer CSV export for the organizer. One row per swimmer with all
 * underlying fields so the data can be re-analysed in a spreadsheet.
 */
export function generateCompetitionResultsCSV(
  competition: Competition,
  teams: Team[],
  swimmers: Swimmer[],
  lapCounts: LapCount[]
): string {
  const swimmerStats = computeSwimmerStats(competition, teams, swimmers, lapCounts);

  const header = [
    'Name', 'Date of Birth', 'Team', 'Lane', 'Laps', 'Distance (m)', '% of Team', 'Under 12',
  ];

  const rows = swimmerStats.map(stats => [
    stats.swimmer.name,
    stats.swimmer.dateOfBirth || '',
    stats.team?.name || '',
    stats.team?.assignedLane ?? '',
    stats.totalLaps,
    stats.totalMeters,
    stats.teamSharePct !== null ? stats.teamSharePct.toFixed(2) : '',
    stats.swimmer.isUnder12 ? 'yes' : 'no',
  ]);

  const lines = [header, ...rows]
    .map(cols => cols.map(escapeCsv).join(','))
    .join('\r\n');

  // Prepend a BOM so Excel detects UTF-8 (umlauts in German names).
  const bom = String.fromCharCode(0xfeff);
  const csv = bom + lines;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

// Generic data-URI download trigger (used for both PDF and CSV).
export function downloadDataUri(dataUri: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
