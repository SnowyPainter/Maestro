import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export function ProblemSection() {
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
      className="py-20 sm:py-28 bg-background text-foreground"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={containerVariants}
    >
      <div className="container text-center max-w-3xl mx-auto">
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl font-bold tracking-tight"
        >
          {t('landing_v2.problem.title')}
        </motion.h2>
        <motion.div
          variants={itemVariants}
          className="mt-8 space-y-4 text-lg text-muted-foreground"
        >
          <p>{t('landing_v2.problem.body_1')}</p>
          <p>{t('landing_v2.problem.body_2')}</p>
          <p className="text-foreground font-medium">{t('landing_v2.problem.body_3')}</p>
        </motion.div>
      </div>
    </motion.section>
  );
}
