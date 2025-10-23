import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';

export function InsightSection() {
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
      viewport={{ once: true, amount: 0.3 }}
      variants={containerVariants}
    >
      <div className="container text-center max-w-4xl mx-auto">
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-8"
        >
          {t('landing_v2.insight.title')}
        </motion.h2>
        <motion.p
          variants={itemVariants}
          className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12"
        >
          {t('landing_v2.insight.body')}
        </motion.p>

        <motion.div variants={itemVariants} className="relative w-full max-w-3xl mx-auto">
          {/* Placeholder for Playbook Dashboard Screenshot */}
          <div className="bg-gray-800 h-64 rounded-lg flex items-center justify-center text-gray-400 text-sm border border-border/40">
            <BarChart2 className="h-16 w-16 mb-2" />
            <p>{t('landing_v2.insight.image_caption')}</p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
