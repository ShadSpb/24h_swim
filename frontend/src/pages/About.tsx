import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Waves, Heart, Target, Zap, AlertTriangle, Info } from 'lucide-react';

export default function About() {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="container py-12 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Waves className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">{t.about.title}</h1>
            <p className="text-xl text-muted-foreground">
              {t.landing.professionalTracking}
            </p>
          </div>

          {/* Social Project Notice */}
          <Alert className="mb-8">
            <Info className="h-4 w-4" />
            <AlertTitle>{t.about.socialProject}</AlertTitle>
            <AlertDescription>
              {t.about.socialProjectDesc}
            </AlertDescription>
          </Alert>

          {/* No Warranty Notice */}
          <Alert variant="destructive" className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.about.noWarranty}</AlertTitle>
            <AlertDescription>
              {t.about.noWarrantyDesc}
            </AlertDescription>
          </Alert>

          <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
            <p>
              SwimTrack 24 was created to solve the unique challenges of managing 
              24-hour endurance swimming competitions. When teams compete around the clock, 
              accurate lap counting becomes crucial—and that's where we come in.
            </p>
            <p>
              Our platform provides real-time tracking, team management, and live 
              statistics that keep everyone informed from the first splash to the final lap.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader className="text-center">
                <Target className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Our Mission</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Make lap counting accurate, transparent, and effortless for every 
                24-hour swimming event.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <Heart className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Built with Care</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Designed by swimming enthusiasts who understand the demands of 
                endurance events.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <Zap className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Real-Time</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Instant updates ensure everyone sees the latest counts the moment 
                they happen.
              </CardContent>
            </Card>
          </div>

          <div className="bg-muted/50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Key Features</h2>
            <ul className="text-left max-w-md mx-auto space-y-2 text-muted-foreground">
              <li>✓ Multi-lane competition support</li>
              <li>✓ Team and individual swimmer tracking</li>
              <li>✓ Double-count prevention (15-second rule)</li>
              <li>✓ Early Bird & Late Bird statistics</li>
              <li>✓ Live leaderboard with countdown timer</li>
              <li>✓ Referee shift management</li>
              <li>✓ Support for swimmers under 12 with parent tracking</li>
              <li>✓ Bilingual support (Deutsch / English)</li>
            </ul>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground italic">
              {t.about.asIs}
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
