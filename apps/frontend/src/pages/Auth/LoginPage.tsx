
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { useLoginApiOrchestratorAuthLoginPost } from '@/lib/api/generated';
import { useSessionStore } from '@/store/session';
import { loginApiOrchestratorAuthLoginPostBody } from '@/lib/schemas/api.zod';

type LoginFormValues = z.infer<typeof loginApiOrchestratorAuthLoginPostBody>;

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setToken = useSessionStore((state) => state.setToken);
  const loginMutation = useLoginApiOrchestratorAuthLoginPost();

  const form = useForm<z.infer<typeof loginApiOrchestratorAuthLoginPostBody>>({
    resolver: zodResolver(loginApiOrchestratorAuthLoginPostBody),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = (values: LoginFormValues) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setToken(data.access_token);
        toast.success(t('login.success_message'), {
          description: t('login.welcome_back'),
        });
        navigate('/chat');
      },
      onError: (error) => {
        toast.error(t('login.error_title'), {
          description: error.detail?.[0]?.msg || t('login.error_description'),
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="shadow-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>{t('login.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email">{t('login.email_label')}</label>
                <Input id="email" type="email" placeholder="m@example.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="password">{t('login.password_label')}</label>
                <Input id="password" type="password" {...form.register('password')} />
                {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? t('login.logging_in_button') : t('login.login_button')}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm">
            <p>{t('login.no_account_text')} <Link to="/signup" className="font-semibold text-primary hover:underline">{t('login.signup_link')}</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
