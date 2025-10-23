import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GitFork, Brain, Workflow, Users, ArrowRight } from 'lucide-react'; // Icons for Persona, Playbook, Orchestrator, CoWorker

export function WhatIsMaestroSection() {
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

  return (
    <motion.section
      className="py-20 sm:py-28 bg-muted/30 text-foreground"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={containerVariants}
    >
      <div className="container text-center max-w-4xl mx-auto">
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl font-bold tracking-tight"
        >
          {t('landing_v2.what_is_maestro.title')}
        </motion.h2>
        <motion.div
          variants={itemVariants}
          className="mt-8 space-y-4 text-lg text-muted-foreground"
        >
          <p>{t('landing_v2.what_is_maestro.body_1')}</p>
          <p>{t('landing_v2.what_is_maestro.body_2')}</p>
        </motion.div>

        {/* Visual: Persona -> Playbook -> Orchestrator -> CoWorker loop */}
        <motion.div
          variants={itemVariants}
          className="mt-16 flex flex-col items-center justify-center space-y-8 md:space-y-0 md:flex-row md:space-x-12"
        >
          <div className="flex flex-col items-center">
            <Brain className="h-12 w-12 text-primary mb-2" />
            <p className="text-lg font-semibold">Persona</p>
          </div>
          <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
          <div className="flex flex-col items-center">
            <GitFork className="h-12 w-12 text-primary mb-2" />
            <p className="text-lg font-semibold">Playbook</p>
          </div>
          <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
          <div className="flex flex-col items-center">
            <Workflow className="h-12 w-12 text-primary mb-2" />
            <p className="text-lg font-semibold">Orchestrator</p>
          </div>
          <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
          <div className="flex flex-col items-center">
            <Users className="h-12 w-12 text-primary mb-2" />
            <p className="text-lg font-semibold">CoWorker</p>
          </div>
        </motion.div>
        <motion.p variants={itemVariants} className="mt-8 text-sm text-muted-foreground">
          {t('landing_v2.what_is_maestro.flow')}
        </motion.p>
      </div>
    </motion.section>
  );
}
