import React from "react";
import { ChatSidebar } from "../../widgets/ChatSidebar";
import { ChatStream } from "@/widgets/ChatStream";
import { ChatContextPanel } from "../../widgets/ChatContextPanel";
import { ChatMessagesProvider, useChatMessages } from "@/entities/messages/context/ChatMessagesContext";
import { useChatPageEvents } from "./useChatPageEvents";
import { useGetAvailableFlowsApiOrchestratorChatFlowsGet } from "@/lib/api/generated";

function ChatPageContent() {
  const messages = useChatMessages();
  const { handleChatSend, addTrendQueryCard, clearChat, handleToolClick } = useChatPageEvents();
  const { data: flows } = useGetAvailableFlowsApiOrchestratorChatFlowsGet();

  return (
    <div className="grid md:grid-cols-[256px_1fr] lg:grid-cols-[256px_1fr_280px] h-screen bg-muted/20">
      <ChatSidebar
        onQueryTrendsClick={addTrendQueryCard}
        onNewChatClick={clearChat}
        onToolClick={handleToolClick}
      />
      <ChatStream messages={messages} onSendMessage={handleChatSend} onClearChat={clearChat} />
      <ChatContextPanel flows={flows || []} />
    </div>
  );
}

export function ChatPage() {
  return (
    <ChatMessagesProvider>
      <ChatPageContent />
    </ChatMessagesProvider>
  );
}
