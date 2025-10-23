import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HeroSection() {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.3, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.7 } },
  };

  return (
    <motion.section
      className="relative flex flex-col items-center justify-center text-center min-h-[80vh] bg-black text-white overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Background visual effect */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-grid-white/[0.07]" />
      </div>
      
      <div className="container z-10 flex flex-col items-center">
        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent"
        >
          {t('landing_v2.hero.title')}
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="mt-6 text-lg sm:text-xl text-neutral-300 max-w-2xl"
        >
          {t('landing_v2.hero.subtitle')}
        </motion.p>
        <motion.div variants={itemVariants} className="mt-10">
          <Button asChild size="lg" className="group bg-white text-black hover:bg-neutral-200">
            <Link
              to="/signup"
              aria-label="Start Brand Intelligence"
            >
              {t('landing_v2.hero.cta')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-neutral-400">{t('landing_v2.hero.cta_subtitle')}</p>
        </motion.div>
      </div>
    </motion.section>
  );
}
