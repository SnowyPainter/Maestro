import { useEffect, useRef } from "react";
import { Message } from "@/entities/messages/context/ChatMessagesContext";
import { ChatInput } from "@/widgets/ChatInput";
import { ContextCard } from "@/features/contexts/ContextCard";
import { SelectPersonaAccount } from "@/features/contexts/SelectPersonaAccount";
import { usePersonaContextStore } from "@/store/persona-context";
import { MessageBubble } from "@/entities/messages/components/MessageBubble";
import { User, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatStreamProps {
    messages: Message[];
    onSendMessage: (content: string) => Promise<void>;
    onClearChat: () => void;
}

export function ChatStream({ messages, onSendMessage, onClearChat }: ChatStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);


  const {
    personaAccountId,
    personaName,
    accountHandle,
    accountPlatform,
    personaAvatarUrl,
    draftId,
    draftEnabled,
    setDraftEnabled,
    clearDraftContext,
    campaignId,
    campaignEnabled,
    setCampaignEnabled,
    clearCampaignContext,
  } = usePersonaContextStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  if (messages.length === 0) {
    // Always show SelectPersonaAccount when chat is empty
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <SelectPersonaAccount />
        </div>
        <div className="w-full max-w-3xl px-4">
          <ChatInput onSendMessage={onSendMessage} onClearChat={onClearChat} placeholder="Ask me anything..." />
        </div>
        <div className="text-xs text-muted-foreground p-2">
          Maestro can make mistakes. Consider checking important information.
        </div>
      </div>
    );
  }
  return (
    <main className="flex flex-col h-screen bg-background">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-0">
        <div className="mx-auto max-w-3xl w-full">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
              <MessageBubble message={m} />
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t bg-card flex-shrink-0">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSendMessage={onSendMessage} onClearChat={onClearChat} />
        </div>
      </div>
    </main>
  );
}