import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <Waves className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">SwimTrack 24</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t.landing.professionalTracking}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">{t.footer.navigation}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.home}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.about}
                </Link>
              </li>
              <li>
                <Link to="/rules" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.rules}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.privacy}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">{t.footer.access}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.login}
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.register}
                </Link>
              </li>
              <li>
                <Link to="/monitor" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.liveMonitor}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">{t.footer.forOrganizers}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/organizer" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.common.dashboard}
                </Link>
              </li>
              <li>
                <Link to="/referee" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.referee.referees}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
