import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function TestimonialsSection() {
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

  const testimonials = [
    {
      quote: t('landing_v2.testimonials.quote_1'),
      author: t('landing_v2.testimonials.author_1'),
    },
    {
      quote: t('landing_v2.testimonials.quote_2'),
      author: t('landing_v2.testimonials.author_2'),
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
          {t('landing_v2.testimonials.title')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-6 rounded-lg border border-border/40 bg-card/50 flex flex-col items-center text-center"
            >
              <Quote className="h-10 w-10 text-primary mb-4" />
              <p className="text-lg italic text-muted-foreground mb-4">"{testimonial.quote}"</p>
              <p className="font-semibold text-foreground">{testimonial.author}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
