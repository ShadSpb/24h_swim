import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { adminApi, AdminConfig, StorageConfig, ApiEndpointConfig } from '@/lib/api';
import { 
  Settings, 
  Mail, 
  Shield, 
  Users, 
  BarChart3, 
  AlertTriangle,
  Lock,
  Server,
  Eye,
  EyeOff,
  Database,
  Cloud,
  HardDrive,
  FileText
} from 'lucide-react';

export default function Admin() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
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

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const handleSaveConfig = async () => {
    if (config) {
      await adminApi.saveConfig(config);
      toast({ title: t.toast.settingsSaved });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: t.validation.passwordMismatch, variant: 'destructive' });
      return;
    }

    const success = await adminApi.changeAdminPassword(oldPassword, newPassword);
    if (success) {
      toast({ title: t.toast.passwordChanged });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast({ title: t.auth.invalidCredentials, variant: 'destructive' });
    }
  };

  const handleTestEmail = async () => {
    const success = await adminApi.sendTestEmail(config?.smtpFrom || 'test@example.com');
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t.admin.title}</h1>
            <p className="text-muted-foreground">admin</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            {t.common.logout}
          </Button>
        </div>

        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.competitionStats}</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Storage</span>
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.authType}</span>
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">SMTP</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.maintenance}</span>
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

          {/* Storage Settings */}
          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Storage Configuration
                </CardTitle>
                <CardDescription>
                  Choose between local browser storage or remote API for data persistence
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Storage Type Selection */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config?.storage.type === 'local' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Local Storage</p>
                      <p className="text-sm text-muted-foreground">Data stored in browser (default)</p>
                    </div>
                  </div>
                  <Switch
                    checked={config?.storage.type === 'remote'}
                    onCheckedChange={(checked) => 
                      setConfig(prev => prev ? { 
                        ...prev, 
                        storage: { ...prev.storage, type: checked ? 'remote' : 'local' }
                      } : null)
                    }
                  />
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config?.storage.type === 'remote' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Remote API</p>
                      <p className="text-sm text-muted-foreground">Data stored on external server</p>
                    </div>
                  </div>
                </div>

                <Badge variant={config?.storage.type === 'local' ? 'secondary' : 'default'}>
                  {config?.storage.type === 'local' ? 'Using Local Storage' : 'Using Remote API'}
                </Badge>

                {/* Remote API Configuration */}
                {config?.storage.type === 'remote' && (
                  <div className="space-y-6 border-t pt-6">
                    <h4 className="font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      API Configuration
                    </h4>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Base URL</Label>
                        <Input
                          value={config.storage.baseUrl}
                          onChange={(e) => setConfig(prev => prev ? { 
                            ...prev, 
                            storage: { ...prev.storage, baseUrl: e.target.value }
                          } : null)}
                          placeholder="https://api.yourserver.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={config.storage.apiKey}
                          onChange={(e) => setConfig(prev => prev ? { 
                            ...prev, 
                            storage: { ...prev.storage, apiKey: e.target.value }
                          } : null)}
                          placeholder="Enter your API key"
                        />
                      </div>
                    </div>

                    {/* Endpoint Configuration */}
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
                        {/* Competition Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-muted-foreground">Competition Endpoints</h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Get Competitions</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">GET</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.getCompetitions.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        getCompetitions: { ...prev.storage.endpoints.getCompetitions, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Save Competition</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">POST</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.saveCompetition.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        saveCompetition: { ...prev.storage.endpoints.saveCompetition, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Team & Swimmer Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-muted-foreground">Team & Swimmer Endpoints</h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Get Teams</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">GET</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.getTeams.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        getTeams: { ...prev.storage.endpoints.getTeams, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Get Swimmers</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">GET</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.getSwimmers.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        getSwimmers: { ...prev.storage.endpoints.getSwimmers, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Lap Counting Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-muted-foreground">Lap Counting Endpoints</h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Get Lap Counts</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">GET</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.getLapCounts.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        getLapCounts: { ...prev.storage.endpoints.getLapCounts, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Add Lap Count</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">POST</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.addLapCount.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        addLapCount: { ...prev.storage.endpoints.addLapCount, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Authentication Endpoints */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-muted-foreground">Authentication Endpoints</h5>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Login</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">POST</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.login.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        login: { ...prev.storage.endpoints.login, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Register</Label>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="shrink-0">POST</Badge>
                                <Input
                                  className="h-8 text-sm"
                                  value={config.storage.endpoints.register.url}
                                  onChange={(e) => setConfig(prev => prev ? { 
                                    ...prev, 
                                    storage: { 
                                      ...prev.storage, 
                                      endpoints: { 
                                        ...prev.storage.endpoints, 
                                        register: { ...prev.storage.endpoints.register, url: e.target.value }
                                      }
                                    }
                                  } : null)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={handleSaveConfig}>{t.common.save}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Settings */}
          <TabsContent value="auth" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.admin.authType}</CardTitle>
                <CardDescription>
                  Configure authentication method
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.authType}</Label>
                  <Select
                    value={config?.authType || 'builtin'}
                    onValueChange={(value: 'builtin' | 'external') => 
                      setConfig(prev => prev ? { ...prev, authType: value } : null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="builtin">{t.admin.authBuiltIn}</SelectItem>
                      <SelectItem value="external">{t.admin.authExternal}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config?.authType === 'external' && (
                  <div className="space-y-2">
                    <Label>{t.admin.backendUrl}</Label>
                    <Input
                      value={config.backendUrl}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, backendUrl: e.target.value } : null)}
                      placeholder="https://api.example.com"
                    />
                  </div>
                )}

                <Button onClick={handleSaveConfig}>{t.common.save}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMTP Settings */}
          <TabsContent value="smtp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.admin.smtpConfig}</CardTitle>
                <CardDescription>
                  Configure email sending for notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.admin.smtpHost}</Label>
                    <Input
                      value={config?.smtpHost || ''}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, smtpHost: e.target.value } : null)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpPort}</Label>
                    <Input
                      type="number"
                      value={config?.smtpPort || 587}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, smtpPort: parseInt(e.target.value) } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpUser}</Label>
                    <Input
                      value={config?.smtpUser || ''}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, smtpUser: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.smtpPassword}</Label>
                    <Input
                      type="password"
                      value={config?.smtpPassword || ''}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, smtpPassword: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.admin.smtpFrom}</Label>
                    <Input
                      type="email"
                      value={config?.smtpFrom || ''}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, smtpFrom: e.target.value } : null)}
                      placeholder="noreply@example.com"
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
                        onCheckedChange={(checked) => 
                          setConfig(prev => prev ? { 
                            ...prev, 
                            emailNotifications: { ...prev.emailNotifications, organizerRegistration: checked }
                          } : null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailPasswordReset}</Label>
                      <Switch
                        checked={config?.emailNotifications.passwordReset || false}
                        onCheckedChange={(checked) => 
                          setConfig(prev => prev ? { 
                            ...prev, 
                            emailNotifications: { ...prev.emailNotifications, passwordReset: checked }
                          } : null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailCompetitionResult}</Label>
                      <Switch
                        checked={config?.emailNotifications.competitionResult || false}
                        onCheckedChange={(checked) => 
                          setConfig(prev => prev ? { 
                            ...prev, 
                            emailNotifications: { ...prev.emailNotifications, competitionResult: checked }
                          } : null)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t.admin.emailFaqFeedback}</Label>
                      <Switch
                        checked={config?.emailNotifications.faqFeedback || false}
                        onCheckedChange={(checked) => 
                          setConfig(prev => prev ? { 
                            ...prev, 
                            emailNotifications: { ...prev.emailNotifications, faqFeedback: checked }
                          } : null)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveConfig}>{t.common.save}</Button>
                  <Button variant="outline" onClick={handleTestEmail}>{t.admin.testEmail}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Mode */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t.admin.maintenance}
                </CardTitle>
                <CardDescription>
                  Enable maintenance mode to prevent access to all pages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{t.admin.enableMaintenance}</p>
                    <p className="text-sm text-muted-foreground">{t.admin.maintenanceMessage}</p>
                  </div>
                  <Switch
                    checked={config?.maintenanceMode || false}
                    onCheckedChange={(checked) => 
                      setConfig(prev => prev ? { ...prev, maintenanceMode: checked } : null)
                    }
                  />
                </div>
                <Button onClick={handleSaveConfig}>{t.common.save}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Change Password */}
          <TabsContent value="password" className="space-y-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>{t.admin.changePassword}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.currentPassword}</Label>
                  <Input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.newPassword}</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.confirmPassword}</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button onClick={handleChangePassword}>{t.common.save}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
