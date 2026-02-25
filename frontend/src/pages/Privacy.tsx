import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Shield, FileText, Cookie, UserCheck, Mail, Send } from 'lucide-react';

export default function Privacy() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [question, setQuestion] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({ title: t.faq.questionSubmitted });
    setQuestion('');
    setEmail('');
    setIsSubmitting(false);
  };

  return (
    <MainLayout>
      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">{t.privacy.title}</h1>
            <p className="text-muted-foreground">
              {t.privacy.lastUpdated}: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="prose prose-lg max-w-none mb-8">
            <p className="text-lg text-muted-foreground">{t.privacy.intro}</p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.privacy.responsibleParty}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.privacy.responsiblePartyDesc}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.privacy.dataCollection}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.privacy.dataCollectionDesc}</p>
                <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
                  <li>IP-Adresse / IP Address</li>
                  <li>Browser-Typ und -Version / Browser type and version</li>
                  <li>Verwendetes Betriebssystem / Operating system</li>
                  <li>Referrer URL</li>
                  <li>Hostname des zugreifenden Rechners / Hostname</li>
                  <li>Uhrzeit der Serveranfrage / Time of request</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-primary" />
                  {t.privacy.cookies}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.privacy.cookiesDesc}</p>
                <p className="text-muted-foreground mt-4">
                  Diese Website verwendet ausschließlich technisch notwendige Cookies zur Speicherung von Sitzungsinformationen und Benutzereinstellungen.
                  / This website only uses technically necessary cookies to store session information and user preferences.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  {t.privacy.dataProtectionRights}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.privacy.dataProtectionRightsDesc}</p>
                <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
                  <li>Recht auf Auskunft (Art. 15 DSGVO) / Right to information</li>
                  <li>Recht auf Berichtigung (Art. 16 DSGVO) / Right to rectification</li>
                  <li>Recht auf Löschung (Art. 17 DSGVO) / Right to erasure</li>
                  <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO) / Right to restriction</li>
                  <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO) / Right to data portability</li>
                  <li>Widerspruchsrecht (Art. 21 DSGVO) / Right to object</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {t.privacy.contact}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.privacy.contactDesc}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Hinweis / Notice</h3>
            <p className="text-sm text-muted-foreground">
              Diese Datenschutzerklärung kann von Zeit zu Zeit aktualisiert werden. Wir empfehlen Ihnen, diese Seite regelmäßig zu besuchen.
              / This privacy policy may be updated from time to time. We recommend visiting this page regularly.
            </p>
          </div>

          {/* Contact Form */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {t.faq.askQuestion}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitQuestion} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.faq.yourEmail}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.faq.emailPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question">{t.faq.yourQuestion}</Label>
                  <Textarea
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t.faq.questionPlaceholder}
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" disabled={isSubmitting || !question.trim()}>
                  {isSubmitting ? t.common.loading : t.faq.submit}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
