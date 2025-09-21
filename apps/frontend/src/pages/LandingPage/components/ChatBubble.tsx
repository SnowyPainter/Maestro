
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  message: string;
  from: 'user' | 'bot';
  className?: string;
}

export function ChatBubble({ message, from, className }: ChatBubbleProps) {
  const isUser = from === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'flex items-start gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {message}
      </div>
    </motion.div>
  );
}
