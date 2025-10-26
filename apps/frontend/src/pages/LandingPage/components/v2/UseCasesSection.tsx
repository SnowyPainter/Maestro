import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PublishingFlow } from './use-cases/PublishingFlow';
import { ReactiveAutomation } from './use-cases/ReactiveAutomation';
import { BrandMemory } from './use-cases/BrandMemory';

export function UseCasesSection() {
  const { t } = useTranslation();

  const tabs = [
    { id: 'publishing', key: 'use_cases.tabs.publishing_flow', component: <PublishingFlow /> },
    { id: 'automation', key: 'use_cases.tabs.reactive_automation', component: <ReactiveAutomation /> },
    { id: 'memory', key: 'use_cases.tabs.brand_memory', component: <BrandMemory /> },
  ];

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

        <Tabs defaultValue={tabs[0].id} className="w-full">
          <TabsList className="grid max-w-md mx-auto w-full grid-cols-3">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>{t(tab.key)}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="mt-10">
              {tab.component}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
