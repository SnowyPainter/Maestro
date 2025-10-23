import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Keyboard, Lightbulb, TrendingUp, CheckCircle } from 'lucide-react';

export function ExperienceSection() {
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

  const experiences = [
    {
      icon: Keyboard,
      text: t('landing_v2.experience.item_1'),
    },
    {
      icon: Lightbulb,
      text: t('landing_v2.experience.item_2'),
    },
    {
      icon: TrendingUp,
      text: t('landing_v2.experience.item_3'),
    },
    {
      icon: CheckCircle,
      text: t('landing_v2.experience.item_4'),
    },
  ];

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
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-12"
        >
          {t('landing_v2.experience.title')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {experiences.map((exp, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-6 rounded-lg border border-border/40 bg-card/50 flex items-start text-left"
            >
              <exp.icon className="h-8 w-8 text-primary mr-4 flex-shrink-0" />
              <p className="text-lg text-muted-foreground">{exp.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.blockquote
          variants={itemVariants}
          className="mt-16 text-xl italic text-foreground max-w-2xl mx-auto border-l-4 border-primary pl-4"
        >
          "{t('landing_v2.experience.quote')}"
        </motion.blockquote>
      </div>
    </motion.section>
  );
}
