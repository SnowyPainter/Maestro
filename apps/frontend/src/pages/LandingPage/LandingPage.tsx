import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

// Import new sections
import { HeroSection } from './components/v2/HeroSection';
import { ProblemSection } from './components/v2/ProblemSection';
import { WhatIsMaestroSection } from './components/v2/WhatIsMaestroSection';
import { CoreComponentsSection } from './components/v2/CoreComponentsSection';
import { ExperienceSection } from './components/v2/ExperienceSection';
import { HowItWorksSection } from './components/v2/HowItWorksSection';
import { InsightSection } from './components/v2/InsightSection';
import { PhilosophySection } from './components/v2/PhilosophySection';
import { TestimonialsSection } from './components/v2/TestimonialsSection';
import { CtaSection } from './components/v2/CtaSection';
import { UseCasesSection } from './components/v2/UseCasesSection';

export function LandingPage() {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // SEO meta tags
  useEffect(() => {
    document.title = "Maestro - AI-Powered Content Orchestration Platform";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Maestro helps you create, manage, and deploy domain-adapted content with a seamless chat-first workflow.');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* SEO와 접근성을 위한 숨겨진 제목들 */}
      <div className="sr-only">
        <h1>Maestro - AI Content Orchestration Platform</h1>
        <p>Revolutionize your content strategy with AI-powered generation, multi-platform distribution, and intelligent scheduling.</p>
      </div>

      <header
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        role="banner"
      >
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
              Skip to main content
            </a>
            <Logo />
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center space-x-2" role="navigation" aria-label="Main navigation">
              <div className="hidden md:flex items-center space-x-2">
                <LanguageSwitcher />
                <Button asChild variant="ghost">
                  <Link to="/login" aria-label="Log in to your account">{t('landing.login')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup" aria-label="Sign up for a new account">{t('landing.get_started')}</Link>
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </nav>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="container py-4 space-y-2">
              <LanguageSwitcher />
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>{t('landing.login')}</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>{t('landing.get_started')}</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </header>

      <main id="main" className="flex-1">
        <HeroSection />
        <ProblemSection />
        <WhatIsMaestroSection />
        <CoreComponentsSection />
        <ExperienceSection />
        <HowItWorksSection />
        <UseCasesSection />
        <InsightSection />
        <PhilosophySection />
        <TestimonialsSection />
        <CtaSection />
      </main>

      <footer className="bg-muted/50" role="contentinfo">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <div className="mb-4">
            <p>{t('landing.contact_info', { email: 'snowypainter@gmail.com' })}</p>
          </div>
          <nav className="flex justify-center gap-x-6 mb-4" aria-label="Legal links">
            <Link
              to="/terms-of-service"
              className="hover:text-foreground transition-colors"
              aria-label="Read our Terms of Service"
            >
              {t('terms_of_service.title')}
            </Link>
            <Link
              to="/privacy-policy"
              className="hover:text-foreground transition-colors"
              aria-label="Read our Privacy Policy"
            >
              {t('privacy_policy.title')}
            </Link>
            <Link
              to="/data-deletion-policy"
              className="hover:text-foreground transition-colors"
              aria-label="Read our Data Deletion Policy"
            >
              {t('data_deletion_policy.title')}
            </Link>
          </nav>
          <p>{t('landing_v2.footer.text')}</p> { /* Updated footer text */}
          <p>{t('landing.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}