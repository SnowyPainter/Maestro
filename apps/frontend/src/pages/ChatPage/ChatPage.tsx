import React from "react";
import { ChatSidebar } from "../../widgets/ChatSidebar";
import { ChatStream } from "@/widgets/ChatStream";
import { ChatContextPanel } from "../../widgets/ChatContextPanel";
import { ChatMessagesProvider, useChatMessages } from "@/entities/messages/context/ChatMessagesContext";
import { useChatPageEvents } from "./useChatPageEvents";

function ChatPageContent() {
  const messages = useChatMessages();
  const {
    handleChatSend,
    addTrendQueryCard,
    clearChat,
    handleToolClick,
    handleSelectCampaign,
    handleSelectDraft,
    handleExecuteAction
  } = useChatPageEvents();

  return (
    <div className="grid md:grid-cols-[256px_1fr] lg:grid-cols-[256px_1fr_280px] h-screen bg-muted/20 min-h-[100dvh] overflow-hidden">
      <ChatSidebar
        onQueryTrendsClick={addTrendQueryCard}
        onNewChatClick={clearChat}
        onToolClick={handleToolClick}
      />
      <ChatStream messages={messages} onSendMessage={handleChatSend} onClearChat={clearChat} />
      <ChatContextPanel
        onSelectCampaign={handleSelectCampaign}
        onSelectDraft={handleSelectDraft}
        onExecuteAction={handleExecuteAction}
      />
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
