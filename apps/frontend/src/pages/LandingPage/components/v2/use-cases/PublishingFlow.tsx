import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Bot, Send, User, Instagram, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';

function ChatBubble({ role, children, isThinking }: { role: 'user' | 'bot', children: React.ReactNode, isThinking?: boolean }) {
    return (
        <div className={`flex items-start gap-3 ${role === 'user' ? 'justify-end' : ''}`}>
            {role === 'bot' && <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Bot size={18}/></span>}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                {isThinking ? (
                    <motion.div className="flex space-x-1.5 p-1">
                        <motion.span className="h-1.5 w-1.5 rounded-full bg-foreground/50" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} />
                        <motion.span className="h-1.5 w-1.5 rounded-full bg-foreground/50" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} />
                        <motion.span className="h-1.5 w-1.5 rounded-full bg-foreground/50" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} />
                    </motion.div>
                ) : children}
            </div>
            {role === 'user' && <span className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center"><User size={18}/></span>}
        </div>
    );
}

export function PublishingFlow() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
        setTimeout(() => setStep(1), 500),
        setTimeout(() => setStep(2), 1500),
        setTimeout(() => setStep(3), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('use_cases.publishing_flow.title')}</h3>
        <p className="mt-3 text-lg text-muted-foreground">{t('use_cases.publishing_flow.description')}</p>
      </div>
      <div className="bg-background/50 rounded-xl border p-4 md:p-6 space-y-4">
        {step >= 1 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><ChatBubble role="user">{t('use_cases.publishing_flow.chat.user_message')}</ChatBubble></motion.div>}
        {step >= 2 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><ChatBubble role="bot" isThinking={true} /></motion.div>}
        {step >= 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <ChatBubble role="bot">{t('use_cases.publishing_flow.chat.bot_response')}</ChatBubble>
                <Card className="bg-card/80 backdrop-blur-sm ml-11">
                    <CardHeader>
                        <CardTitle>{t('use_cases.common.card_title_draft')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="threads">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="threads"><MessageCircle className="w-4 h-4 mr-2"/>Threads</TabsTrigger>
                                <TabsTrigger value="instagram"><Instagram className="w-4 h-4 mr-2"/>Instagram</TabsTrigger>
                            </TabsList>
                            <TabsContent value="threads" className="pt-4 text-sm">{t('use_cases.publishing_flow.draft_card.threads_content')}</TabsContent>
                            <TabsContent value="instagram" className="pt-4 text-sm">{t('use_cases.publishing_flow.draft_card.instagram_content')}</TabsContent>
                        </Tabs>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button><Send className="w-4 h-4 mr-2"/>{t('use_cases.publishing_flow.draft_card.schedule_all')}</Button>
                    </CardFooter>
                </Card>
            </motion.div>
        )}
      </div>
    </div>
  );
}
