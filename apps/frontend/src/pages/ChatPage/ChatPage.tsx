import React, { useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatStream } from "@/widgets/ChatStream";
import { ChatContextPanel } from "./components/ChatContextPanel";
import { TrendQueryCard } from "@/features/trends/components/TrendQueryCard";
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { TableCard } from "@/entities/messages/components/Table";
import { ChartCard } from "@/entities/messages/components/ChartCard";
import { EditorCard } from "@/entities/messages/components/EditorCard";
import { ProfileCard } from "@/entities/messages/components/ProfileCard";
import { InfoCard } from "@/entities/messages/components/InfoCard";
import { GenericCard } from "@/entities/messages/components/GenericCard";
import { ChatCard, TrendsListResponse } from "@/lib/api/generated";
import { useChatQueryApiOrchestratorChatQueryPost, useGetAvailableFlowsApiOrchestratorChatFlowsGet } from "@/lib/api/generated";

export type Message = {
    id: number;
    type: 'user' | 'bot' | 'card';
    content: string | React.ReactNode;
};

// 카드 타입에 따른 컴포넌트 선택 함수
const renderCardByType = (card: ChatCard) => {
  const { card_type, data, title, source_flow } = card;

  // Trends 카드 특별 처리
  if (card_type === 'trends' || (data && data.source && data.items)) {
    return <TrendResultCard query={title || "Trends"} results={data as unknown as TrendsListResponse} />;
  }

  // 카드 타입에 따라 컴포넌트 선택
  switch (card_type) {
    case 'table':
    case 'list':
    case 'series':
    case 'collection':
      return <TableCard title={title || "Data"} data={data || card} />;

    case 'chart':
    case 'kpi':
    case 'metric':
      return <ChartCard title={title || "Data"} data={data || card} />;

    case 'editor':
    case 'draft':
      return <EditorCard title={title || "Data"} data={data || card} />;

    case 'profile':
    case 'persona':
    case 'user':
      return <ProfileCard title={title || "Data"} data={data || card} />;

    case 'info':
    case 'message':
      return <InfoCard title={title || "Data"} data={data || card} />;

    case 'campaign_kpi':
    case 'campaign_kpi_def':
      return <ChartCard title={title || "Data"} data={data || card} />;

    default:
      return <GenericCard title={title || "Data"} data={data || card} />;
  }
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

      // 카드들 추가
      if (response.cards && response.cards.length > 0) {
        response.cards.forEach(card => {
          const cardComponent = renderCardByType(card);
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'card',
            content: cardComponent
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
