import { useTranslation } from 'react-i18next';
import { Bot, Link, Mic, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = [
    <Mic key={1} className="w-8 h-8"/>,
    <Share2 key={2} className="w-8 h-8"/>,
    <Link key={3} className="w-8 h-8"/>,
    <Bot key={4} className="w-8 h-8"/>
];

export function HowToGetStartedSection() {
  const { t } = useTranslation();

  const steps = Array.from({ length: 4 }, (_, i) => ({
    title: t(`how_to_get_started.steps.${i + 1}.title`),
    description: t(`how_to_get_started.steps.${i + 1}.description`),
    icon: icons[i],
  }));

  return (
    <section className="py-16 sm:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('how_to_get_started.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('how_to_get_started.description')}
          </p>
        </div>

        <div className="relative">
            <div aria-hidden="true" className="absolute hidden md:block top-12 bottom-12 left-1/2 -translate-x-1/2 w-px bg-border"></div>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                {steps.map((step, i) => (
                    <div key={i} className={cn("flex gap-6 items-start", i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse md:text-right')}>
                        <div className={cn("relative md:w-1/2", i % 2 === 0 ? 'md:text-right' : 'md:text-left')}>
                            <div className={cn("w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 mx-auto md:mx-0", i % 2 === 0 ? 'md:ml-auto' : 'md:mr-auto')}>
                                {step.icon}
                            </div>
                        </div>
                        <div className="relative md:w-1/2 pt-6">
                             <div aria-hidden="true" className={cn("absolute top-1/2 -translate-y-1/2 h-px w-12 bg-border hidden md:block", i % 2 === 0 ? '-left-12' : '-right-12')}></div>
                            <p className="text-primary font-semibold mb-1">Step {i + 1}</p>
                            <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                            <p className="text-muted-foreground">{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <p className="text-center text-lg text-muted-foreground mt-12">{t('how_to_get_started.final_note')}</p>
      </div>
    </section>
  );
}