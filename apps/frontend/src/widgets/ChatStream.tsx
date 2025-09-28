import { useEffect, useRef } from "react";
import { Message } from "@/entities/messages/context/ChatMessagesContext";
import { ChatInput } from "@/widgets/ChatInput";
import { ContextCard } from "@/features/contexts/ContextCard";
import { SelectPersonaAccount } from "@/features/contexts/SelectPersonaAccount";
import { usePersonaContextStore } from "@/store/persona-context";
import { MessageBubble } from "@/entities/messages/components/MessageBubble";
import { User, FileText, Target, StickyNote } from "lucide-react";
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
    userMemo,
    userMemoEnabled,
    setUserMemoEnabled,
    clearUserMemo,
  } = usePersonaContextStore();

  const hasPersona = personaAccountId !== null;

  const contextCards = [
    // 1순위: 페르소나 계정
    ...(hasPersona ? [{
      icon: User,
      label: "Persona Account",
      value: personaName || "Unknown",
      enabled: true, // 페르소나 계정은 항상 enabled
      toggleDisabled: true,
      variant: 'persona' as const,
      personaAvatarUrl: personaAvatarUrl || undefined,
      accountHandle: accountHandle || undefined,
      accountPlatform: accountPlatform || undefined,
      helper: "Your active persona account context",
    }] : []),
    // Draft
    ...(draftId ? [{
      icon: FileText,
      label: "Draft",
      value: `Draft ID ${draftId}`,
      enabled: draftEnabled,
      onToggle: setDraftEnabled,
      toggleDisabled: false,
      onClear: clearDraftContext,
      clearDisabled: false,
      helper: "Include the draft when sending requests.",
    }] : []),
    // Campaign
    ...(campaignId ? [{
      icon: Target,
      label: "Campaign",
      value: `Campaign ID ${campaignId}`,
      enabled: campaignEnabled,
      onToggle: setCampaignEnabled,
      toggleDisabled: false,
      onClear: clearCampaignContext,
      clearDisabled: false,
      helper: "Attach the campaign context to outgoing calls.",
    }] : []),
    // User memo
    ...(userMemo ? [{
      icon: StickyNote,
      label: "User memo",
      value: userMemo.length > 200 ? `${userMemo.slice(0, 197)}...` : userMemo,
      enabled: userMemoEnabled,
      onToggle: setUserMemoEnabled,
      toggleDisabled: false,
      onClear: clearUserMemo,
      clearDisabled: false,
      helper: "Share this memo with the assistant when enabled.",
    }] : []),
  ].flat();
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
    // If no persona account is selected, show persona selection carousel
    if (!hasPersona) {
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

    // If persona account is selected, show context cards
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          {contextCards.length > 0 ? (
            <div className="w-full max-w-md relative">
              <div className="relative overflow-hidden">
                {contextCards.map((card, index) => (
                  <div
                    key={card.label}
                    className={cn(
                      "transition-opacity duration-300",
                      index === 0 ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
                    )}
                  >
                    <ContextCard {...card} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No active context</p>
                <p className="text-xs text-muted-foreground">Select a persona to start chatting</p>
              </div>
            </div>
          )}
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