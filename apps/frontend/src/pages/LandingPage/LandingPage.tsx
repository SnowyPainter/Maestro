import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ArrowRight, Menu, X, Star, CheckCircle, Users, Zap, Globe, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { InteractiveWorkflow } from './components/InteractiveWorkflow';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export function LandingPage() {
  const { t } = useTranslation();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const typingPhrases = [
    t('landing.typing_phrases.0'),
    t('landing.typing_phrases.1'),
    t('landing.typing_phrases.2'),
    t('landing.typing_phrases.3'),
  ];

  useEffect(() => {
    const currentPhrase = typingPhrases[phraseIndex];
    let charIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const typeNextChar = () => {
      if (charIndex < currentPhrase.length) {
        setTypedText(currentPhrase.substring(0, charIndex + 1));
        charIndex++;
        timeoutId = setTimeout(typeNextChar, 50);
      } else {
        // 타이핑 완료 후 다음 문구로 전환
        timeoutId = setTimeout(() => {
          setPhraseIndex((prevIndex) => (prevIndex + 1) % typingPhrases.length);
        }, 2000);
      }
    };

    // 타이핑 시작
    typeNextChar();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [phraseIndex]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
  };

  const features = [
    {
      title: t('landing.features_section.features.0.title'),
      description: t('landing.features_section.features.0.description'),
    },
    {
      title: t('landing.features_section.features.1.title'),
      description: t('landing.features_section.features.1.description'),
    },
    {
      title: t('landing.features_section.features.2.title'),
      description: t('landing.features_section.features.2.description'),
    },
    {
      title: t('landing.features_section.features.3.title'),
      description: t('landing.features_section.features.3.description'),
    },
  ];

  const testimonials = [
    {
      name: t('landing.testimonials_section.testimonials.0.name'),
      role: t('landing.testimonials_section.testimonials.0.role'),
      company: t('landing.testimonials_section.testimonials.0.company'),
      content: t('landing.testimonials_section.testimonials.0.content'),
      avatar: t('landing.testimonials_section.testimonials.0.avatar'),
    },
    {
      name: t('landing.testimonials_section.testimonials.1.name'),
      role: t('landing.testimonials_section.testimonials.1.role'),
      company: t('landing.testimonials_section.testimonials.1.company'),
      content: t('landing.testimonials_section.testimonials.1.content'),
      avatar: t('landing.testimonials_section.testimonials.1.avatar'),
    },
    {
      name: t('landing.testimonials_section.testimonials.2.name'),
      role: t('landing.testimonials_section.testimonials.2.role'),
      company: t('landing.testimonials_section.testimonials.2.company'),
      content: t('landing.testimonials_section.testimonials.2.content'),
      avatar: t('landing.testimonials_section.testimonials.2.avatar'),
    },
  ];

  // SEO 메타 태그를 위한 더미 데이터 (실제로는 react-helmet-async 등 사용)
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
        <motion.section
          className="pt-20 py-20 sm:py-28 text-center container"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          role="main"
        >
          <motion.div variants={itemVariants} className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t('landing.hero_title')}
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground">
              {t('landing.hero_description')}
            </p>
            <div
              className="mt-10 h-12 text-lg sm:text-xl text-muted-foreground"
              role="textbox"
              aria-live="polite"
              aria-label="Typing animation showing example content types"
            >
              <span>{typedText}</span>
              <span className="animate-pulse">|</span>
            </div>
          </motion.div>
        </motion.section>

        <InteractiveWorkflow />

        {/* Features Section */}
        <motion.section
          className="py-20 sm:py-28 container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {t('landing.features_section.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features_section.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="text-center p-6 rounded-lg border border-border/40 bg-card/50"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                  {index === 0 && <Zap className="h-6 w-6 text-primary" />}
                  {index === 1 && <Globe className="h-6 w-6 text-primary" />}
                  {index === 2 && <CheckCircle className="h-6 w-6 text-primary" />}
                  {index === 3 && <MessageSquare className="h-6 w-6 text-primary" />}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          className="py-20 sm:py-28 bg-muted/30"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {t('landing.testimonials_section.title')}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 container">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="bg-card p-6 rounded-lg border border-border/40"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{testimonial.name}</h4>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.company}</p>
                  </div>
                </div>
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">"{testimonial.content}"</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="py-20 sm:py-28 text-center container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={itemVariants}
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('landing.ready_to_get_started_title')}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('landing.ready_to_get_started_description')}
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="group">
                <Link
                  to="/signup"
                  aria-label="Start using Maestro for free"
                >
                  {t('landing.start_for_free')}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.section>
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
          <p>{t('landing.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
