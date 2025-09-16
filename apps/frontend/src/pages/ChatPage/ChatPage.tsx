import React, { useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatStream } from "@/widgets/ChatStream";
import { ChatContextPanel } from "./components/ChatContextPanel";
import { TrendQueryCard } from "@/features/trends/components/TrendQueryCard";
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { TrendsListResponse } from "@/lib/api/generated";
import { useChatQueryApiOrchestratorChatQueryPost, useGetAvailableFlowsApiOrchestratorChatFlowsGet } from "@/lib/api/generated";

export type Message = {
    id: number;
    type: 'user' | 'bot' | 'card';
    content: string | React.ReactNode;
};

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);

  // 채팅 API mutation
  const chatMutation = useChatQueryApiOrchestratorChatQueryPost();

  // FLOWS 리스트 query
  const { data: flows } = useGetAvailableFlowsApiOrchestratorChatFlowsGet();

  const addMessage = (content: string, type: 'user' | 'bot') => {
    setMessages(prev => [...prev, { id: Date.now(), type, content }]);
  };

  const handleChatSend = async (content: string) => {
    // 사용자 메시지 추가
    addMessage(content, 'user');

    try {
      // 채팅 API 호출
      const response = await chatMutation.mutateAsync({
        data: {
          message: content,
          session_id: null
        }
      });

      // 응답 메시지들 추가
      if (response.messages) {
        response.messages.forEach(message => {
          addMessage(message, 'bot');
        });
      }

      // 카드들 추가 (나중에 구현)
      if (response.cards && response.cards.length > 0) {
        response.cards.forEach(card => {
          // 카드 타입에 따라 적절한 컴포넌트로 변환해서 표시
          // 일단은 JSON으로 표시
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'card',
            content: <div className="p-4 bg-card rounded-lg border">
              <pre className="text-sm">{JSON.stringify(card, null, 2)}</pre>
            </div>
          }]);
        });
      }

    } catch (error) {
      console.error('Chat error:', error);
      addMessage('죄송합니다. 채팅 처리 중 오류가 발생했습니다.', 'bot');
    }
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
      <ChatSidebar onQueryTrendsClick={addTrendQueryCard} onNewChatClick={clearChat} flows={flows} />
      <ChatStream messages={messages} onSendMessage={handleChatSend} />
      <ChatContextPanel flows={flows} />
    </div>
  );
}
