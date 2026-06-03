import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConnectionIndicatorProps {
  online: boolean;
  lastSyncedAt: number | null;
}

/**
 * Compact connectivity badge for the referee screen: shows whether the backend
 * is reachable and how long ago the last successful sync happened, so a referee
 * notices a dropped connection instead of tapping "+1" into the void.
 */
export function ConnectionIndicator({ online, lastSyncedAt }: ConnectionIndicatorProps) {
  const { t } = useLanguage();
  const rc = t.refereeDashboard;

  // Re-render periodically so the "last synced" relative time stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const relativeSynced = (): string | null => {
    if (!lastSyncedAt) return null;
    const secs = Math.max(0, Math.floor((Date.now() - lastSyncedAt) / 1000));
    if (secs < 5) return rc.syncedJustNow;
    if (secs < 60) return `${rc.agoPrefix}${secs}s${rc.agoSuffix}`;
    const mins = Math.floor(secs / 60);
    return `${rc.agoPrefix}${mins}m${rc.agoSuffix}`;
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        {online ? (
          <Wifi className="h-4 w-4 text-green-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-destructive animate-pulse" />
        )}
        <span className={`text-sm font-medium ${online ? 'text-green-600' : 'text-destructive'}`}>
          {online ? rc.connected : rc.disconnected}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {lastSyncedAt
          ? `${rc.lastSynced}: ${relativeSynced()}`
          : rc.notSyncedYet}
      </span>
    </div>
  );
}
