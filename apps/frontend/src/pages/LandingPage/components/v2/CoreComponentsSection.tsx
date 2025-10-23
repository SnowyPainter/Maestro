import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Brain, Book, GitFork, Users } from 'lucide-react';

export function CoreComponentsSection() {
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

  const components = [
    {
      icon: Brain,
      title: t('landing_v2.core_components.persona.title'),
      description: t('landing_v2.core_components.persona.description'),
      keywords: t('landing_v2.core_components.persona.keywords'),
    },
    {
      icon: Book,
      title: t('landing_v2.core_components.playbook.title'),
      description: t('landing_v2.core_components.playbook.description'),
      keywords: t('landing_v2.core_components.playbook.keywords'),
    },
    {
      icon: GitFork,
      title: t('landing_v2.core_components.orchestrator.title'),
      description: t('landing_v2.core_components.orchestrator.description'),
      keywords: t('landing_v2.core_components.orchestrator.keywords'),
    },
    {
      icon: Users,
      title: t('landing_v2.core_components.coworker.title'),
      description: t('landing_v2.core_components.coworker.description'),
      keywords: t('landing_v2.core_components.coworker.keywords'),
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
      <div className="container text-center max-w-5xl mx-auto">
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-12"
        >
          {t('landing_v2.core_components.title')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {components.map((component, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-6 rounded-lg border border-border/40 bg-card/50 flex flex-col items-center text-center"
            >
              <component.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{component.title}</h3>
              <p className="text-muted-foreground text-sm mb-4">{component.description}</p>
              <p className="text-xs text-primary/70 font-mono">{component.keywords}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          variants={itemVariants}
          className="mt-16 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          {t('landing_v2.core_components.subtitle')}
        </motion.p>
      </div>
    </motion.section>
  );
}
