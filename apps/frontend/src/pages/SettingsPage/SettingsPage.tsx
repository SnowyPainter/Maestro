
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useMeApiMeGet } from '@/lib/api/generated';
import { useSessionStore } from '@/store/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useMeApiMeGet();
  const clearToken = useSessionStore((state) => state.clearToken);

  const handleLogout = () => {
    clearToken();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const userInfo = useMemo(() => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      );
    }

    if (error || !user) {
      return <p className="text-destructive">Failed to load user information.</p>;
    }

    return (
      <div className="space-y-2 text-lg">
        <p><span className="font-semibold">Email:</span> {user.email}</p>
        <p><span className="font-semibold">Username:</span> {user.display_name || 'Not set'}</p>
      </div>
    );
  }, [user, isLoading, error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold border-b pb-2">User Information</h2>
              {userInfo}
            </div>
            <div className="text-center">
              <Button variant="destructive" size="lg" onClick={handleLogout}>
                Log Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
