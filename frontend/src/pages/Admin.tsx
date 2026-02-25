import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { adminApi, AdminConfig, StorageConfig } from '@/lib/api';
import { 
  Settings, 
  Mail, 
  Shield, 
  Users, 
  BarChart3, 
  Lock,
  Server,
  Eye,
  EyeOff,
  Database,
  Cloud,
  HardDrive,
  FileText,
  Info
} from 'lucide-react';

export default function Admin() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [stats, setStats] = useState({
    activeOrganizers: 0,
    activeReferees: 0,
    plannedCompetitions: 0,
    completedCompetitions: 0,
  });

  useEffect(() => {
    // Check if already logged in via session
    const adminSession = sessionStorage.getItem('swimtrack_admin_session');
    if (adminSession === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const loadData = async () => {
    const [configData, statsData] = await Promise.all([
      adminApi.getConfig(),
      adminApi.getStats(),
    ]);
    setConfig(configData);
    setStats(statsData);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await adminApi.adminLogin(username, password);
    if (success) {
      setIsAuthenticated(true);
      sessionStorage.setItem('swimtrack_admin_session', 'true');
      loadData();
      toast({ title: t.toast.settingsSaved });
    } else {
      toast({ title: t.auth.invalidCredentials, variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('swimtrack_admin_session');
    setUsername('');
    setPassword('');
  };

  const handleTestEmail = async () => {
    const success = await adminApi.sendTestEmail(config?.smtpFrom || 'test@24swim.de');
    if (success) {
      toast({ title: t.toast.emailSent });
    } else {
      toast({ title: t.common.error, variant: 'destructive' });
    }
  };

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="container py-12">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>{t.admin.title}</CardTitle>
                <CardDescription>{t.auth.loginSubtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.common.name}</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.common.password}</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {t.common.login}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t.admin.title}</h1>
              <p className="text-muted-foreground">admin</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              {t.common.logout}
            </Button>
          </div>

          {/* Read-only notice */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-4 w-4" />
            <span>Configuration is read-only. Edit <code className="bg-background px-1 rounded">src/config/config.json</code> and rebuild to change settings.</span>
          </div>
        </div>

        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.competitionStats}</span>
            </TabsTrigger>
            <TabsTrigger value="site" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Site</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Storage & API</span>
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">SMTP</span>
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.changePassword}</span>
            </TabsTrigger>
          </TabsList>

          {/* Statistics */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t.admin.organizersOnline}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeOrganizers}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t.admin.refereesOnline}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeReferees}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t.admin.plannedCompetitions}</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.plannedCompetitions}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{t.admin.completedCompetitions}</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedCompetitions}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Site Configuration */}
          <TabsContent value="site" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Site Configuration
                </CardTitle>
                <CardDescription>
                  Site-wide settings (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="siteDomain">Site Domain</Label>
                  <Input
                    id="siteDomain"
                    placeholder="https://yourdomain.com"
                    value={config?.siteDomain || ''}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    The public URL where this site is hosted. Used for generating QR codes and share links.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Settings */}
          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Storage & API Configuration
                </CardTitle>
                <CardDescription>
                  Current storage and API settings (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Storage Type Display */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config?.storage.type === 'local' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Local Storage</p>
                      <p className="text-sm text-muted-foreground">Data stored in browser</p>
                    </div>
                  </div>
                  <Switch
                    checked={config?.storage.type === 'remote'}
                    disabled
                  />
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config?.storage.type === 'remote' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Remote API</p>
                      <p className="text-sm text-muted-foreground">Data stored on server</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={config?.storage.type === 'local' ? 'secondary' : 'default'}>
                    {config?.storage.type === 'local' ? 'Using Local Storage' : 'Using Remote API'}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {config?.storage.type === 'remote' ? 'Auth via API' : t.admin.authBuiltIn}
                  </Badge>
                </div>

                {/* Authentication Info */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Authentication Mode
                  </h4>
                  {config?.storage.type === 'remote' ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                      <strong>Remote API Mode:</strong> All authentication requests (login, register, password reset) 
                      are routed through the configured API endpoints.
                    </div>
                  ) : (
                    <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
                      <strong>Built-in Mode:</strong> Authentication is handled locally using browser storage.
                    </div>
                  )}
                </div>

                {/* Remote API Configuration Display */}
                {config?.storage.type === 'remote' && (
                  <div className="space-y-6 border-t pt-6">
                    <h4 className="font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      API Configuration
                    </h4>
                    
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={config.storage.baseUrl}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        Session tokens are generated per-user on login
                      </p>
                    </div>

                    {/* Endpoint Configuration Display */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">API Endpoints</h4>
                        <Button variant="outline" size="sm" asChild>
                          <a href="/docs/API_DOCUMENTATION.md" target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-2" />
                            View API Docs
                          </a>
                        </Button>
                      </div>
                      
                      <div className="grid gap-4">
                        {/* Authentication Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3 border-primary/30 bg-primary/5">
                          <h5 className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            Authentication Endpoints
                          </h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Login</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.login}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Register</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.register}
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        {/* Resource Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-muted-foreground">Resource Endpoints (RESTful)</h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Competitions</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.competitions}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Teams</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.teams}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Swimmers</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.swimmers}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Referees</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.referees}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Lap Counts</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.lapCounts}
                                disabled
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Swim Sessions</Label>
                              <Input
                                className="h-8 text-sm"
                                value={config.storage.endpoints.swimSessions}
                                disabled
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMTP Settings */}
          <TabsContent value="smtp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.admin.smtpConfig}</CardTitle>
                <CardDescription>
                  Email server settings (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.admin.smtpHost}</Label>
                    <Input
                      value={config?.smtpHost || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpPort}</Label>
                    <Input
                      type="number"
                      value={config?.smtpPort || 587}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpUser}</Label>
                    <Input
                      value={config?.smtpUser || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpPassword}</Label>
                    <Input
                      type="password"
                      value={config?.smtpPassword ? '••••••••' : ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.admin.smtpFrom}</Label>
                    <Input
                      type="email"
                      value={config?.smtpFrom || ''}
                      disabled
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">{t.admin.emailNotifications}</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailOrganizerRegistration}</Label>
                      <Switch
                        checked={config?.emailNotifications.organizerRegistration || false}
                        disabled
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailPasswordReset}</Label>
                      <Switch
                        checked={config?.emailNotifications.passwordReset || false}
                        disabled
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailCompetitionResult}</Label>
                      <Switch
                        checked={config?.emailNotifications.competitionResult || false}
                        disabled
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailFaqFeedback}</Label>
                      <Switch
                        checked={config?.emailNotifications.faqFeedback || false}
                        disabled
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={handleTestEmail}>{t.admin.testEmail}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Change Password */}
          <TabsContent value="password" className="space-y-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>{t.admin.changePassword}</CardTitle>
                <CardDescription>
                  Password stored in <code className="bg-muted px-1 rounded">src/config/config.json</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Read-only notice */}
                <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
                  <strong>Read-only:</strong> Edit <code className="bg-background px-1 rounded">src/config/config.json</code> and rebuild to change admin password.
                  <br /><br />
                  Look for: <code className="bg-background px-1 rounded">"admin": {"{"} "passwordHash": "..." {"}"}</code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
