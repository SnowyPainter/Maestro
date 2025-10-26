import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  TrendBasedAiContentCreation,
  SmartSchedulingAndAutomation,
  AutomatedCommunityManagement,
  DataDrivenContentStrategy,
  BrandPlaybook,
} from './use-cases';
import { Sparkles, CalendarClock, MessageCircleReply, LineChart, BookMarked } from 'lucide-react';

const useCases = [
  {
    id: 'ai-creation',
    name: 'use_cases.tabs.ai_creation',
    component: <TrendBasedAiContentCreation />,
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: 'community',
    name: 'use_cases.tabs.community_management',
    component: <AutomatedCommunityManagement />,
    icon: <MessageCircleReply className="h-5 w-5" />,
  },
  {
    id: 'data-driven',
    name: 'use_cases.tabs.data_strategy',
    component: <DataDrivenContentStrategy />,
    icon: <LineChart className="h-5 w-5" />,
  },
  {
    id: 'scheduling',
    name: 'use_cases.tabs.scheduling',
    component: <SmartSchedulingAndAutomation />,
    icon: <CalendarClock className="h-5 w-5" />,
  },
  {
    id: 'playbook',
    name: 'use_cases.tabs.playbook',
    component: <BrandPlaybook />,
    icon: <BookMarked className="h-5 w-5" />,
  },
];

export function UseCasesSection() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(useCases[0].id);

  const activeComponent = useCases.find((uc) => uc.id === activeTab)?.component;

  return (
    <section id="use-cases" className="py-16 sm:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('use_cases.section_title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('use_cases.section_description')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {useCases.map((uc) => (
            <Button
              key={uc.id}
              variant={activeTab === uc.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(uc.id)}
              className="gap-2"
            >
              {uc.icon}
              {t(uc.name)}
            </Button>
          ))}
        </div>

        <div className="relative min-h-[450px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeComponent}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
