import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Waves, Loader2, CheckCircle, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';
import { sendPasswordResetEmail } from '@/lib/utils/emailService';
import { User } from '@/types';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(255),
  password: z.string().min(1, 'Password is required').max(100),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result) {
        toast({
          title: t.common.success,
          description: 'You have been logged in successfully.',
        });
        // Navigate will happen after auth state updates - check saved auth
        const savedAuth = localStorage.getItem('swimtrack_auth');
        if (savedAuth) {
          const auth = JSON.parse(savedAuth);
          if (auth.user?.role === 'referee') {
            navigate('/referee');
          } else {
            navigate('/organizer');
          }
        } else {
          navigate('/organizer');
        }
      } else {
        toast({
          title: t.auth.invalidCredentials,
          description: 'Invalid email or password.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast({
        title: t.common.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    try {
      // Check if user exists
      const users = await authApi.getUsers();
      const user = users.find((u: User) => u.email === resetEmail.trim());
      
      if (!user) {
        toast({
          title: 'User not found',
          description: 'No account found with this email address.',
          variant: 'destructive',
        });
        setIsResetting(false);
        return;
      }

      // Reset password and send via email
      const result = await authApi.resetPassword(user.id, sendPasswordResetEmail);
      
      if (result.success) {
        setEmailSent(true);
        toast({
          title: 'Password reset successful',
          description: 'Your new password has been sent to your email.',
        });
      } else {
        toast({
          title: 'Reset failed',
          description: result.error || 'Could not reset password. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast({
        title: t.common.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDialogClose = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setEmailSent(false);
  };

  return (
    <MainLayout>
      <div className="container flex items-center justify-center min-h-[calc(100vh-16rem)] py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Waves className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t.auth.loginTitle}</CardTitle>
            <CardDescription>
              {t.auth.loginSubtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.common.email}</FormLabel>
                      <FormControl>
                        <Input placeholder={t.auth.emailPlaceholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t.common.password}</FormLabel>
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 h-auto font-normal text-sm text-muted-foreground hover:text-primary"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.auth.loginButton}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">
              {t.auth.noAccount}{' '}
              <Link to="/register" className="text-primary hover:underline">
                {t.common.register}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {emailSent 
                ? 'Your password has been reset and sent to your email address.'
                : 'Enter your email address and we\'ll send you a new password.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {!emailSent ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button onClick={handleForgotPassword} disabled={isResetting}>
                  {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Email
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Email Sent!
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      We've sent your new password to:
                    </p>
                    <p className="font-medium text-foreground">{resetEmail}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Please check your inbox (and spam folder) for the email with your new password.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleDialogClose} className="w-full">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}