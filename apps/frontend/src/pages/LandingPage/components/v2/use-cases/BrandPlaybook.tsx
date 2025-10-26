import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked } from 'lucide-react';

export function BrandPlaybook() {
  const { t } = useTranslation();

  return (
    <div className="text-center">
        <h3 className="text-3xl font-bold tracking-tight text-foreground">
            {t('use_cases.playbook.title')}
        </h3>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            {t('use_cases.playbook.description')}
        </p>
        <Card className="mt-8 bg-card/50">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <BookMarked />
                    Coming Soon
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">A more interactive demo for this use case is on its way!</p>
            </CardContent>
        </Card>
    </div>
  );
}