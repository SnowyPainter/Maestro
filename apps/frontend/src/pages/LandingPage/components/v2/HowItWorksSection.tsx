import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Sparkles, Play, BookOpen } from 'lucide-react';

export function HowItWorksSection() {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.7 } },
  };

  const steps = [
    {
      icon: Search,
      title: t('landing_v2.how_it_works.steps.1.title'),
      description: t('landing_v2.how_it_works.steps.1.description'),
    },
    {
      icon: Sparkles,
      title: t('landing_v2.how_it_works.steps.2.title'),
      description: t('landing_v2.how_it_works.steps.2.description'),
    },
    {
      icon: Play,
      title: t('landing_v2.how_it_works.steps.3.title'),
      description: t('landing_v2.how_it_works.steps.3.description'),
    },
    {
      icon: BookOpen,
      title: t('landing_v2.how_it_works.steps.4.title'),
      description: t('landing_v2.how_it_works.steps.4.description'),
    },
  ];

  return (
    <motion.section
      className="py-20 sm:py-28 bg-background text-foreground"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={containerVariants}
    >
      <div className="container text-center max-w-4xl mx-auto">
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-12"
        >
          {t('landing_v2.how_it_works.title')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-6 rounded-lg border border-border/40 bg-card/50 flex flex-col items-center text-center"
            >
              <step.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          variants={itemVariants}
          className="mt-16 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          {t('landing_v2.how_it_works.subtitle')}
        </motion.p>
      </div>
    </motion.section>
  );
}
