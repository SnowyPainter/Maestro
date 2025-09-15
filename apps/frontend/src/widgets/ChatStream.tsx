import { useEffect, useRef } from "react";
import { Message } from "@/pages/ChatPage/ChatPage";
import { ChatInput } from "@/pages/ChatPage/components/ChatInput";
import { Logo } from "@/components/Logo";

interface ChatStreamProps {
    messages: Message[];
    onSendMessage: (content: string, type: 'user' | 'bot') => void;
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
            <div className="w-full max-w-2xl p-4">
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
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.type === 'card' ? (
                <div className="w-full">{m.content}</div>
            ) : (
                <div className={`p-3 rounded-2xl shadow-sm max-w-2xl ${
                    m.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground border'
                }`}>
                    {m.content}
                </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-card">
        <ChatInput onSendMessage={onSendMessage} />
      </div>
    </main>
  );
}