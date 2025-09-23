
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { useBffMeReadMeApiBffMeGet } from '@/lib/api/generated';
import { useSessionStore } from '@/store/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: user, isLoading, error } = useBffMeReadMeApiBffMeGet({});
  const clearToken = useSessionStore((state) => state.clearSession);

  const handleLogout = () => {
    clearToken();
    toast.success(t('settings.logout_success'));
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
      return <p className="text-destructive">{t('settings.load_user_info_failed')}</p>;
    }

    return (
      <div className="space-y-2 text-lg">
        <p><span className="font-semibold">{t('settings.email')}:</span> {user.email}</p>
        <p><span className="font-semibold">{t('settings.username')}:</span> {user.display_name || t('settings.not_set')}</p>
      </div>
    );
  }, [user, isLoading, error, t]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">{t('settings.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold border-b pb-2">{t('settings.user_information')}</h2>
              {userInfo}
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold border-b pb-2">{t('settings.language')}</h2>
              <LanguageSwitcher />
            </div>
            <div className="text-center">
              <Button variant="destructive" size="lg" onClick={handleLogout}>
                {t('settings.log_out')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
