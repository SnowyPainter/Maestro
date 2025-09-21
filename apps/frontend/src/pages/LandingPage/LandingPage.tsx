import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { InteractiveWorkflow } from './components/InteractiveWorkflow';

const typingPhrases = [
  "a marketing campaign for the new product launch...",
  "a series of blog posts about AI in healthcare...",
  "social media content for the next week...",
  "a script for a promotional video...",
];

export function LandingPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const currentPhrase = typingPhrases[phraseIndex];
    let charIndex = 0;
    const interval = setInterval(() => {
      if (charIndex <= currentPhrase.length) {
        setTypedText(currentPhrase.substring(0, charIndex));
        charIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setPhraseIndex((prevIndex) => (prevIndex + 1) % typingPhrases.length);
        }, 2000);
      }
    }, 50);
    return () => clearInterval(interval);
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <Logo />
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center space-x-2">
              <Button asChild variant="ghost">
                <Link to="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <motion.section
          className="pt-20 py-20 sm:py-28 text-center container"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
              Your Own Orchestra for Content Propagation
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground">
              Maestro helps you create, manage, and deploy domain-adapted content with a seamless chat-first workflow.
            </p>
            <div className="mt-10 h-12 text-lg sm:text-xl text-muted-foreground typing-cursor">
              <span>{typedText}</span>
            </div>
          </motion.div>
        </motion.section>

        <InteractiveWorkflow />

        <motion.section
          className="py-20 sm:py-28 text-center container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={itemVariants}
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to Get Started?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Transform your content workflow today.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/signup">Start for Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="bg-muted/50">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <div className="mb-4">
            <p>Contact: Minwoo Yu (snowypainter@gmail.com)</p>
          </div>
          <div className="flex justify-center gap-x-6">
            <Link to="/terms-of-service" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/data-deletion-policy" className="hover:text-foreground">Data Deletion Policy</Link>
          </div>
          <p className="mt-4">&copy; {new Date().getFullYear()} Maestro. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
