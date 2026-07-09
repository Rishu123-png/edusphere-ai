import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your school and account preferences</p>
      </div>

      {/* School Info */}
      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">School Name</div>
              <div className="font-medium">Delhi Public School, CBSE</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">School ID</div>
              <div className="font-medium">SCH-2026-001</div>
            </div>
          </div>
          <Button variant="outline">Update School Details</Button>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Dark Mode</div>
              <div className="text-sm text-muted-foreground">Switch between light and dark theme</div>
            </div>
            <Button 
              variant={darkMode ? "default" : "outline"} 
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? 'Enabled' : 'Enable Dark Mode'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Push Notifications</div>
              <div className="text-sm text-muted-foreground">Receive attendance alerts and AI recommendations</div>
            </div>
            <Button 
              variant={notifications ? "default" : "outline"} 
              onClick={() => setNotifications(!notifications)}
            >
              {notifications ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Logged in as</div>
            <div className="font-medium">{currentUser?.displayName} ({currentUser?.role})</div>
            <div className="text-sm">{currentUser?.email}</div>
          </div>
          <Button variant="outline">Change Password</Button>
          <Button variant="outline">Manage Roles (Admin Only)</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;