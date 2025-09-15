import React, { useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatStream } from "@/widgets/ChatStream";
import { ChatContextPanel } from "./components/ChatContextPanel";
import { TrendQueryCard } from "@/features/trends/components/TrendQueryCard";
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { TrendsListResponse } from "@/lib/api/generated";

export type Message = {
    id: number;
    type: 'user' | 'bot' | 'card';
    content: string | React.ReactNode;
};

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (content: string, type: 'user' | 'bot') => {
    setMessages(prev => [...prev, { id: Date.now(), type, content }]);
  };

  const handleTrendQuerySubmit = (query: string, results: TrendsListResponse) => {
    // Remove the query card and show the result card
    setMessages(prev => {
        const newMessages = prev.filter(m => m.type !== 'card' || (m.content as React.ReactElement).type !== TrendQueryCard);
        return [...newMessages, { id: Date.now(), type: 'card', content: <TrendResultCard query={query} results={results} /> }];
    });
  };

  const addTrendQueryCard = () => {
    // Prevent adding multiple query cards
    if (messages.some(m => m.type === 'card' && (m.content as React.ReactElement).type === TrendQueryCard)) {
        return;
    }
    setMessages(prev => [...prev, { id: Date.now(), type: 'card', content: <TrendQueryCard onSubmit={handleTrendQuerySubmit} /> }]);
  }

  const clearChat = () => {
    setMessages([]);
  }

  return (
    <div className="grid md:grid-cols-[256px_1fr] lg:grid-cols-[256px_1fr_280px] h-screen bg-muted/20">
      <ChatSidebar onQueryTrendsClick={addTrendQueryCard} onNewChatClick={clearChat} />
      <ChatStream messages={messages} onSendMessage={addMessage} />
      <ChatContextPanel />
    </div>
  );
}
