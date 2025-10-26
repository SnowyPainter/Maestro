import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, Bot, MessageSquare, ShieldCheck } from 'lucide-react';

export function ReactiveAutomation() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('use_cases.reactive_automation.title')}</h3>
        <p className="mt-3 text-lg text-muted-foreground">{t('use_cases.reactive_automation.description')}</p>
      </div>
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg">{t('use_cases.reactive_automation.rule_card.title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center gap-4 text-center">
                    <div>
                        <p className="text-sm font-semibold">{t('use_cases.reactive_automation.rule_card.if_label')}</p>
                        <Badge variant="secondary" className="mt-1">{t('use_cases.reactive_automation.rule_card.keyword')}</Badge>
                    </div>
                    <ArrowDown className="w-6 h-6 text-muted-foreground shrink-0" />
                    <div>
                        <p className="text-sm font-semibold">{t('use_cases.reactive_automation.rule_card.then_label')}</p>
                        <Badge variant="outline" className="mt-1">{t('use_cases.reactive_automation.rule_card.template')}</Badge>
                    </div>
                </CardContent>
            </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex justify-center">
            <ArrowDown className="w-8 h-8 text-muted-foreground" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <Card className="bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <MessageSquare size={20} />
                    <h4 className="font-semibold">{t('use_cases.reactive_automation.interaction.comment_author')}</h4>
                </CardHeader>
                <CardContent><p>“{t('use_cases.reactive_automation.interaction.comment_text')}”</p></CardContent>
            </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex justify-center">
            <ArrowDown className="w-8 h-8 text-muted-foreground" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
            <Card className="border-primary/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <Bot size={20} className="text-primary"/>
                    <h4 className="font-semibold text-primary">{t('use_cases.reactive_automation.interaction.bot_reply_author')}</h4>
                </CardHeader>
                <CardContent>
                    <p>“{t('use_cases.reactive_automation.interaction.bot_reply_text')}”</p>
                    <Badge variant="outline" className="mt-2 border-green-500/50 text-green-600"><ShieldCheck size={14} className="mr-2"/>{t('use_cases.reactive_automation.interaction.persona_badge')}</Badge>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
}
