
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
import { useSignupApiOrchestratorAuthSignupPost } from '@/lib/api/generated';
import { signupApiOrchestratorAuthSignupPostBody } from '@/lib/schemas/api.zod';

type SignupFormValues = z.infer<typeof signupApiOrchestratorAuthSignupPostBody>;

export function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signupMutation = useSignupApiOrchestratorAuthSignupPost();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupApiOrchestratorAuthSignupPostBody),
    defaultValues: {
      display_name: '',
      email: '',
      password: '',
    },
  });

  const handleSignup = (values: SignupFormValues) => {
    signupMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast.success(t('signup.success_message'), {
          description: t('signup.success_description'),
        });
        navigate('/login');
      },
      onError: (error) => {
        toast.error(t('signup.error_title'), {
          description: error.detail?.[0]?.msg || t('signup.error_description'),
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
            <CardTitle className="text-2xl">{t('signup.title')}</CardTitle>
            <CardDescription>{t('signup.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="display_name">{t('signup.username_label')}</label>
                <Input id="display_name" {...form.register('display_name')} />
                {form.formState.errors.display_name && <p className="text-sm text-destructive">{form.formState.errors.display_name.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="email">{t('signup.email_label')}</label>
                <Input id="email" type="email" placeholder="m@example.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="password">{t('signup.password_label')}</label>
                <Input id="password" type="password" {...form.register('password')} />
                {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
                {signupMutation.isPending ? t('signup.creating_account_button') : t('signup.create_account_button')}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm">
            <p>{t('signup.has_account_text')} <Link to="/login" className="font-semibold text-primary hover:underline">{t('signup.login_link')}</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
