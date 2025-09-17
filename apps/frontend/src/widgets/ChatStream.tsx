import { useEffect, useRef } from "react";
import { Message } from "@/entities/messages/context/ChatMessagesContext";
import { ChatInput } from "@/pages/ChatPage/components/ChatInput";
import { Logo } from "@/components/Logo";
import { MessageBubble } from "@/entities/messages/components/MessageBubble";

interface ChatStreamProps {
    messages: Message[];
    onSendMessage: (content: string) => Promise<void>;
}

export function ChatStream({ messages, onSendMessage }: ChatStreamProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-background">
            <div className="flex-1 flex items-center justify-center">
                <Logo size="lg" />
            </div>
            <div className="w-full max-w-3xl px-4">
                <ChatInput onSendMessage={onSendMessage} placeholder="Ask me anything..."/>
            </div>
            <div className="text-xs text-muted-foreground p-2">
                Maestro can make mistakes. Consider checking important information.
            </div>
        </div>
    )
  }

  return (
    <main className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        <div className="mx-auto max-w-3xl w-full">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
              <MessageBubble message={m} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="p-4 border-t bg-card">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSendMessage={onSendMessage} />
        </div>
      </div>
    </main>
  );
}
