import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Send } from 'lucide-react';

export default function FAQ() {
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
      <div className="container py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <HelpCircle className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">{t.faq.title}</h1>
            <p className="text-xl text-muted-foreground">{t.faq.subtitle}</p>
          </div>

          {/* All-in-one Accordion */}
          <Card className="mb-12">
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {/* About Section */}
                <AccordionItem value="about-social">
                  <AccordionTrigger>{t.about.socialProject}</AccordionTrigger>
                  <AccordionContent>{t.about.socialProjectDesc}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="about-warranty">
                  <AccordionTrigger>{t.about.noWarranty}</AccordionTrigger>
                  <AccordionContent>{t.about.noWarrantyDesc}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="about-mission">
                  <AccordionTrigger>{t.about.ourMission}</AccordionTrigger>
                  <AccordionContent>{t.about.ourMissionDesc}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="about-features">
                  <AccordionTrigger>{t.about.keyFeatures}</AccordionTrigger>
                  <AccordionContent>{t.about.keyFeaturesDesc}</AccordionContent>
                </AccordionItem>

                {/* FAQ Questions */}
                <AccordionItem value="faq-1">
                  <AccordionTrigger>{t.faq.q1}</AccordionTrigger>
                  <AccordionContent>{t.faq.a1}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-2">
                  <AccordionTrigger>{t.faq.q2}</AccordionTrigger>
                  <AccordionContent>{t.faq.a2}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-3">
                  <AccordionTrigger>{t.faq.q3}</AccordionTrigger>
                  <AccordionContent>{t.faq.a3}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-4">
                  <AccordionTrigger>{t.faq.q4}</AccordionTrigger>
                  <AccordionContent>{t.faq.a4}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-5">
                  <AccordionTrigger>{t.faq.q5}</AccordionTrigger>
                  <AccordionContent>{t.faq.a5}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-6">
                  <AccordionTrigger>{t.faq.q6}</AccordionTrigger>
                  <AccordionContent>{t.faq.a6}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-7">
                  <AccordionTrigger>{t.faq.q7}</AccordionTrigger>
                  <AccordionContent>{t.faq.a7}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-8">
                  <AccordionTrigger>{t.faq.q8}</AccordionTrigger>
                  <AccordionContent>{t.faq.a8}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-9">
                  <AccordionTrigger>{t.faq.q9}</AccordionTrigger>
                  <AccordionContent>{t.faq.a9}</AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-10">
                  <AccordionTrigger>{t.faq.q10}</AccordionTrigger>
                  <AccordionContent>{t.faq.a10}</AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Ask a Question Form */}
          <Card>
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
