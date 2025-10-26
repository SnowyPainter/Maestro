import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, MessageSquare, Bot } from 'lucide-react';

const flowVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.4, duration: 0.5 },
  }),
};

export function AutomatedCommunityManagement() {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
      <div className="space-y-4">
        <h3 className="text-3xl font-bold tracking-tight text-foreground">
          {t('use_cases.community_management.title')}
        </h3>
        <p className="text-lg text-muted-foreground">
          {t('use_cases.community_management.description')}
        </p>
      </div>
      <div className="space-y-2">
        <motion.div custom={0} initial="hidden" animate="visible" variants={flowVariants}>
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg">{t('use_cases.community_management.rule_card.title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('use_cases.community_management.rule_card.if_label')}</p>
                        <Badge variant="secondary">{t('use_cases.community_management.rule_card.keyword')}</Badge>
                    </div>
                    <ArrowDown className="w-6 h-6 text-muted-foreground shrink-0" />
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('use_cases.community_management.rule_card.then_label')}</p>
                        <Badge variant="outline">{t('use_cases.community_management.rule_card.template')}</Badge>
                    </div>
                </CardContent>
            </Card>
        </motion.div>

        <motion.div custom={1} initial="hidden" animate="visible" variants={flowVariants} className="flex justify-center">
            <ArrowDown className="w-8 h-8 text-muted-foreground" />
        </motion.div>

        <motion.div custom={2} initial="hidden" animate="visible" variants={flowVariants}>
            <Card className="bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <MessageSquare size={20} />
                    <h4 className="font-semibold">{t('use_cases.community_management.interaction.comment_author')}</h4>
                </CardHeader>
                <CardContent>
                    <p>“{t('use_cases.community_management.interaction.comment_text')}”</p>
                </CardContent>
            </Card>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={flowVariants} className="flex justify-center">
            <ArrowDown className="w-8 h-8 text-muted-foreground" />
        </motion.div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={flowVariants}>
            <Card className="border-primary/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <Bot size={20} className="text-primary"/>
                    <h4 className="font-semibold text-primary">{t('use_cases.community_management.interaction.bot_reply_author')}</h4>
                </CardHeader>
                <CardContent>
                    <p>“{t('use_cases.community_management.interaction.bot_reply_text')}”</p>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
}