import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'bot';
  children: React.ReactNode;
  className?: string;
}

export function ChatBubble({ role, children, className }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex items-start gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {!isUser && (
        <Avatar className="w-8 h-8 border bg-primary text-primary-foreground">
          <AvatarFallback><Bot size={18} /></AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted rounded-bl-none'
        )}
      >
        {children}
      </div>
      {isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback><User size={18} /></AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}
