import { useTranslation } from 'react-i18next';
import { InteractiveChat } from './InteractiveChat';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram, Edit, Send, Calendar } from 'lucide-react';

function DraftCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Instagram size={18} />
                    {t('use_cases.common.card_title_draft')}
                </CardTitle>
            </div>
            <Badge variant="outline">{t('use_cases.ai_creation.draft_card.platform')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/90">
          {t('use_cases.ai_creation.draft_card.content')}
        </p>
        <p className="text-sm font-medium text-primary">
          {t('use_cases.ai_creation.draft_card.hashtags')}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="sm"><Edit size={14} className="mr-2"/>{t('use_cases.common.action_edit')}</Button>
        <Button variant="outline" size="sm"><Calendar size={14} className="mr-2"/>{t('use_cases.common.action_schedule')}</Button>
        <Button size="sm"><Send size={14} className="mr-2"/>{t('use_cases.common.action_publish')}</Button>
      </CardFooter>
    </Card>
  );
}

export function TrendBasedAiContentCreation() {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
      <div className="space-y-4">
        <h3 className="text-3xl font-bold tracking-tight text-foreground">
          {t('use_cases.ai_creation.title')}
        </h3>
        <p className="text-lg text-muted-foreground">
          {t('use_cases.ai_creation.description')}
        </p>
      </div>
      <div>
        <InteractiveChat
          userMessage={t('use_cases.ai_creation.chat.user_message')}
          botResponse={<DraftCard />}
        />
      </div>
    </div>
  );
}