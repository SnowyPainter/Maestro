
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ArrowRight } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 sm:p-6">
        <Logo />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Chat-first AI Orchestration
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground">
            Maestro is a chat-first AI orchestration system for domain-adapted content creation.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/signup">Get Started <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </main>
      <footer className="p-4 sm:p-6 text-center text-muted-foreground text-sm">
        &copy; {new Date().getFullYear()} Maestro. All Rights Reserved.
      </footer>
    </div>
  );
}
