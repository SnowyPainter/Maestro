import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react'; // Removed Download, PlayCircle
import { Link } from 'react-router-dom';

export function CtaSection() {
  const { t } = useTranslation();

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.7 } },
  };

  // Placeholder YouTube video ID
  const youtubeVideoId = 'dQw4w9WgXcQ'; // Replace with actual video ID

  return (
    <motion.section
      className="py-20 sm:py-28 text-center container bg-background text-foreground"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={itemVariants}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('landing_v2.cta.title')}</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {t('landing_v2.cta.subtitle')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button asChild size="lg" className="group">
            <Link
              to="/signup"
              aria-label="Start using Maestro"
            >
              {t('landing_v2.cta.button_start')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
        {/* YouTube Video Embed */}
        <div className="mt-12 w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            title="Maestro Demo Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
      </div>
    </motion.section>
  );
}