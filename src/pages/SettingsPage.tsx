import { Card, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

export default function SettingsPage(){
  const { profile } = useAuth();
  const { theme, toggle, setTheme } = useTheme();
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Settings</h1>
    <Card><CardTitle>Theme – Dark / Light Mode</CardTitle>
      <p className="text-sm text-muted-foreground mt-2">Current: <b>{theme}</b> – fixed, persists across reloads.</p>
      <div className="flex gap-2 mt-3">
        <Button variant={theme==='light'?'default':'secondary'} onClick={()=>setTheme('light')}>Light</Button>
        <Button variant={theme==='dark'?'default':'secondary'} onClick={()=>setTheme('dark')}>Dark</Button>
        <Button variant="outline" onClick={toggle}>Toggle</Button>
      </div>
    </Card>
    <Card><CardTitle>School Info</CardTitle>
      <div className="text-sm mt-2">Name: {profile?.schoolId || '—'}<br/>User: {profile?.name} • {profile?.email} • {profile?.role}</div>
    </Card>
    <Card><CardTitle>Notification Settings</CardTitle>
      <p className="text-sm text-muted-foreground mt-2">FCM Push • Email • WhatsApp – toggles can be stored per-user in users/{'{uid}'}.</p>
    </Card>
  </div>
}
