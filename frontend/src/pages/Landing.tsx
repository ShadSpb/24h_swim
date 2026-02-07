import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Waves, Timer, Users, Trophy, ClipboardCheck, BarChart3 } from 'lucide-react';

export default function Landing() {
  const { t } = useLanguage();

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Waves className="h-4 w-4" />
              {t.landing.professionalTracking}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {t.landing.heroTitle}{' '}
              <span className="text-primary">{t.landing.heroTitleHighlight}</span>{' '}
              {t.landing.heroTitleEnd}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t.landing.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild>
                <Link to="/register">{t.landing.getStarted}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/faq">{t.landing.learnMore}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t.landing.featuresTitle}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <Timer className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.realTimeTracking}</CardTitle>
                <CardDescription>
                  {t.landing.realTimeTrackingDesc}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.teamManagement}</CardTitle>
                <CardDescription>
                  {t.landing.teamManagementDesc}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <ClipboardCheck className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.refereeControls}</CardTitle>
                <CardDescription>
                  {t.landing.refereeControlsDesc}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <Trophy className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.liveLeaderboard}</CardTitle>
                <CardDescription>
                  {t.landing.liveLeaderboardDesc}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.statistics}</CardTitle>
                <CardDescription>
                  {t.landing.statisticsDesc}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <Waves className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t.landing.multiLaneSupport}</CardTitle>
                <CardDescription>
                  {t.landing.multiLaneSupportDesc}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
