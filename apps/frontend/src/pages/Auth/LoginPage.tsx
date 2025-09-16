
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

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
        toast.success('Login successful!', {
          description: 'Welcome back!',
        });
        navigate('/chat');
      },
      onError: (error) => {
        toast.error('Login Failed', {
          description: error.detail?.[0]?.msg || 'Please check your credentials and try again.',
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
            <CardTitle className="text-2xl">Log In</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email">Email</label>
                <Input id="email" type="email" placeholder="m@example.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="password">Password</label>
                <Input id="password" type="password" {...form.register('password')} />
                {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Logging in...' : 'Log In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm">
            <p>Don't have an account? <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
