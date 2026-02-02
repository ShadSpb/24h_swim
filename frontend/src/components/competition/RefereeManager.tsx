import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Referee, User } from '@/types';
import { refereeStorage } from '@/lib/storage';
import { generateHumanPassword, generateRefereeId, isGeneratedRefereeId } from '@/lib/utils/password';
import { UserPlus, Trash2, Key, Mail, Copy, Eye, EyeOff } from 'lucide-react';

interface RefereeManagerProps {
  referees: Referee[];
  competitionId: string;
  onUpdate: () => void;
}

export function RefereeManager({ referees, competitionId, onUpdate }: RefereeManagerProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ id: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [refereeName, setRefereeName] = useState('');
  const [refereeEmail, setRefereeEmail] = useState('');

  const handleAddReferee = () => {
    const hasEmail = refereeEmail.trim().length > 0;
    const userId = hasEmail ? refereeEmail.trim() : generateRefereeId();
    const password = generateHumanPassword();
    
    const referee: Referee = {
      id: crypto.randomUUID(),
      userId,
      name: refereeName.trim(),
      email: userId,
      password,
      competitionId,
      createdAt: new Date().toISOString(),
    };

    refereeStorage.save(referee);
    
    // Also create the user account if it's a generated ID
    if (!hasEmail) {
      const USERS_KEY = 'swimtrack_users';
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
      
      // Check if user already exists
      if (!users.find(u => u.email === userId)) {
        const newUser: User = {
          id: crypto.randomUUID(),
          email: userId,
          password,
          name: refereeName.trim(),
          role: 'referee',
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      
      // Show the generated credentials
      setGeneratedCredentials({ id: userId, password });
      setShowPasswordDialog(true);
    } else {
      // Create user with email
      const USERS_KEY = 'swimtrack_users';
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
      
      if (!users.find(u => u.email === refereeEmail)) {
        const newUser: User = {
          id: crypto.randomUUID(),
          email: refereeEmail.trim(),
          password,
          name: refereeName.trim(),
          role: 'referee',
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        // Show password for email users too
        setGeneratedCredentials({ id: refereeEmail, password });
        setShowPasswordDialog(true);
      }
    }

    setRefereeName('');
    setRefereeEmail('');
    setShowAddDialog(false);
    onUpdate();
    
    toast({ 
      title: t.toast.refereeAdded,
      description: hasEmail ? `Login: ${refereeEmail}` : `Generated ID: ${userId}`,
    });
  };

  const handleResetPassword = (referee: Referee) => {
    const newPassword = generateHumanPassword();
    
    // Update referee record
    const updatedReferee = { ...referee, password: newPassword };
    refereeStorage.save(updatedReferee);
    
    // Update user account
    const USERS_KEY = 'swimtrack_users';
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as User[];
    const userIndex = users.findIndex(u => u.email === referee.email);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    
    // Clear any active sessions for this user
    const AUTH_KEY = 'swimtrack_auth';
    const currentAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    if (currentAuth.user?.email === referee.email) {
      localStorage.removeItem(AUTH_KEY);
    }
    
    setGeneratedCredentials({ id: referee.email, password: newPassword });
    setShowPasswordDialog(true);
    onUpdate();
    
    toast({ title: t.referee.passwordReset });
  };

  const handleDeleteReferee = (id: string) => {
    refereeStorage.delete(id);
    onUpdate();
    toast({ title: t.toast.refereeRemoved });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{t.referee.referees}</CardTitle>
          <CardDescription>{referees.length} {t.referee.referees.toLowerCase()}</CardDescription>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-1" />
              {t.referee.addReferee}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.referee.addReferee}</DialogTitle>
              <DialogDescription>
                Add a referee by email or generate login credentials automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t.referee.refereeName}</Label>
                <Input
                  value={refereeName}
                  onChange={(e) => setRefereeName(e.target.value)}
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.referee.refereeEmail}</Label>
                <Input
                  type="email"
                  value={refereeEmail}
                  onChange={(e) => setRefereeEmail(e.target.value)}
                  placeholder="Leave empty to generate ID"
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, a user ID (ref_XXXXX) and password will be generated.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleAddReferee} disabled={!refereeName.trim()}>
                {t.common.add}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {referees.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.referee.noReferees}</p>
        ) : (
          <div className="space-y-2">
            {referees.map(referee => (
              <div key={referee.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{referee.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isGeneratedRefereeId(referee.email) ? (
                      <Badge variant="outline" className="text-xs">
                        {referee.email}
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {referee.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleResetPassword(referee)}
                    title={t.referee.resetPassword}
                  >
                    <Key className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleDeleteReferee(referee.id)}
                    title={t.common.delete}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Password Display Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.referee.generatedPassword}</DialogTitle>
            <DialogDescription>
              Save these credentials. The password will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {generatedCredentials && (
            <div className="space-y-4 py-4">
              <Alert>
                <AlertDescription className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Login ID:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded">
                        {generatedCredentials.id}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedCredentials.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.common.password}:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded">
                        {showPassword ? generatedCredentials.password : '••••••••'}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedCredentials.password)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => {
              setShowPasswordDialog(false);
              setGeneratedCredentials(null);
              setShowPassword(false);
            }}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
