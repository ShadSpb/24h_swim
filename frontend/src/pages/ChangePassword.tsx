import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { authApi } from '@/lib/api';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirm: z.string().min(1, 'Required'),
}).refine((v) => v.newPassword === v.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
}).refine((v) => v.newPassword !== v.currentPassword, {
  message: 'New password must be different from the current one',
  path: ['newPassword'],
});

type Schema = z.infer<typeof schema>;

export default function ChangePassword() {
  const { t } = useLanguage();
  const { user, isAuthenticated, patchUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  // Forced means the user landed here because the backend flagged
  // forcePasswordChange after a server-side reset.
  const forced = search.get('forced') === '1' || !!user?.forcePasswordChange;

  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'organizer') {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const onSubmit = async (data: Schema) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const result = await authApi.changePassword(user.id, data.currentPassword, data.newPassword);
      if (result.success) {
        // Clear the forced-change flag locally so the dashboard guard releases.
        patchUser({ forcePasswordChange: false });
        toast({ title: t.auth.passwordChanged });
        navigate('/organizer');
      } else {
        toast({
          title: t.auth.changeFailed,
          description: result.error || t.auth.invalidCredentials,
          variant: 'destructive',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      toast({ title: t.common.error, description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <MainLayout>
      <div className="container flex items-center justify-center min-h-[calc(100vh-16rem)] py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <KeyRound className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t.auth.changePassword}</CardTitle>
            <CardDescription>{t.auth.changePasswordDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {forced && (
              <Alert variant="default" className="mb-4">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{t.auth.passwordChangeRequired}</AlertTitle>
                <AlertDescription>{t.auth.passwordChangeRequiredDesc}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.auth.currentPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.auth.newPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.auth.confirmPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.auth.changePassword}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
