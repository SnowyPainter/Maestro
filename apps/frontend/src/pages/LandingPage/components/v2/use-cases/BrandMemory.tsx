import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BrainCircuit, Calendar, Clock, Sparkles, TrendingUp, ThumbsUp } from 'lucide-react';

export function BrandMemory() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('use_cases.brand_memory.title')}</h3>
        <p className="mt-3 text-lg text-muted-foreground">{t('use_cases.brand_memory.description')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader><CardTitle>{t('use_cases.brand_memory.actions_title')}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50"><ThumbsUp className="w-4 h-4 text-green-500"/><span>{t('use_cases.brand_memory.action_1')}</span></div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50"><ThumbsUp className="w-4 h-4 text-red-500"/><span>{t('use_cases.brand_memory.action_2')}</span></div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50"><TrendingUp className="w-4 h-4 text-blue-500"/><span>{t('use_cases.brand_memory.action_3')}</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex justify-center items-center">
            <ArrowRight className="w-8 h-8 text-muted-foreground"/>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="lg:col-span-1 space-y-4">
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary"/>{t('use_cases.brand_memory.insights_title')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    <p className="font-semibold text-primary">{t('use_cases.brand_memory.insight_1')}</p>
                    <p className="font-semibold text-primary">{t('use_cases.brand_memory.insight_2')}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="text-primary"/>{t('use_cases.brand_memory.schedule_title')}</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                            <p className="font-medium">{t('use_cases.brand_memory.post_title')}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock size={14}/> 9:30 AM</p>
                        </div>
                        <Badge className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30"><Sparkles size={14} className="mr-2"/>{t('use_cases.brand_memory.optimal_badge')}</Badge>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
}
