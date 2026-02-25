// PDF Generator for competition results
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
}

export function generateCompetitionResultsPDF(
  competition: Competition,
  teams: Team[],
  swimmers: Swimmer[],
  lapCounts: LapCount[]
): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
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
  
  // Calculate team statistics
  const teamStats: TeamStats[] = teams.map(team => {
    const teamLaps = lapCounts.filter(lc => lc.teamId === team.id);
    const totalLaps = teamLaps.length;
    const totalMeters = totalLaps * competition.laneLength;
    
    let lapsPerHour = 0;
    let fastestLap: number | null = null;
    
    if (teamLaps.length >= 2) {
      const sortedLaps = [...teamLaps].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Calculate fastest lap
      for (let i = 1; i < sortedLaps.length; i++) {
        const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i-1].timestamp).getTime();
        if (fastestLap === null || diff < fastestLap) {
          fastestLap = diff;
        }
      }
      
      // Calculate laps per hour
      const firstLap = new Date(sortedLaps[0].timestamp).getTime();
      const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
      const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
      lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;
    }
    
    return { team, totalLaps, totalMeters, lapsPerHour, fastestLap };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
  
  // Team Leaderboard
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
  
  // Get the Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page for swimmer stats
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  // Swimmer Statistics
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Swimmers', 14, yPos);
  yPos += 6;
  
  const swimmerStats: SwimmerStats[] = swimmers.map(swimmer => {
    const team = teams.find(t => t.id === swimmer.teamId);
    const swimmerLaps = lapCounts.filter(lc => lc.swimmerId === swimmer.id);
    const totalLaps = swimmerLaps.length;
    const totalMeters = totalLaps * competition.laneLength;
    
    return { swimmer, team, totalLaps, totalMeters };
  }).sort((a, b) => b.totalLaps - a.totalLaps).slice(0, 20);
  
  const swimmerTableData = swimmerStats.map((stats, index) => [
    (index + 1).toString(),
    stats.swimmer.name,
    stats.team?.name || '-',
    stats.totalLaps.toString(),
    `${stats.totalMeters}m`,
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Rank', 'Swimmer', 'Team', 'Laps', 'Distance']],
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

export function downloadPDF(dataUri: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
