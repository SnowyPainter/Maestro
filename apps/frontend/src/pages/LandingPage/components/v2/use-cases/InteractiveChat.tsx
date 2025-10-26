import { ReactNode, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InteractiveChatProps {
  userMessage: ReactNode;
  botResponse: ReactNode;
}

export function InteractiveChat({ userMessage, botResponse }: InteractiveChatProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    if (step === 0) {
      timers.push(setTimeout(() => setStep(1), 500));
      timers.push(setTimeout(() => setStep(2), 2000));
    }
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const handleReplay = () => {
    setStep(0);
  };

  return (
    <div className="bg-background/50 rounded-xl border p-4 md:p-6 min-h-[300px]">
      <div className="space-y-4">
        <AnimatePresence>
          {step >= 1 && <ChatBubble role="user">{userMessage}</ChatBubble>}
          {step >= 2 && (
            <ChatBubble role="bot">
              <div className="flex items-center">
                <motion.div
                  className="flex space-x-1.5"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.2 } },
                  }}
                >
                  <motion.span className="h-2 w-2 rounded-full bg-foreground/50" variants={{ visible: { y: [0, -3, 0] }, hidden: { y: 0 } }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} />
                  <motion.span className="h-2 w-2 rounded-full bg-foreground/50" variants={{ visible: { y: [0, -3, 0] }, hidden: { y: 0 } }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} />
                  <motion.span className="h-2 w-2 rounded-full bg-foreground/50" variants={{ visible: { y: [0, -3, 0] }, hidden: { y: 0 } }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} />
                </motion.div>
              </div>
            </ChatBubble>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {step >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.5 }}
            className="mt-4"
          >
            {botResponse}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center mt-4">
        <Button variant="ghost" size="sm" onClick={handleReplay} className="gap-2">
          <RefreshCw size={14} />
          {t('use_cases.common.replay_animation')}
        </Button>
      </div>
    </div>
  );
}
