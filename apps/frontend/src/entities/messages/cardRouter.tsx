import React from "react";
import { ChatCard, TrendsListResponse } from "@/lib/api/generated";
import { TableCard } from "./components/Table";
import { ChartCard } from "./components/ChartCard";
import { EditorCard } from "./components/EditorCard";
import { ProfileCard } from "./components/ProfileCard";
import { InfoCard } from "./components/InfoCard";
import { GenericCard } from "./components/GenericCard";
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { CampaignDetail } from "@/entities/campaigns/components/CampaignDetail";
import { CampaignList } from "@/entities/campaigns/components/CampaignList";
import { DraftDetail } from "@/entities/drafts/components/DraftDetail";
import { DraftList } from "@/entities/drafts/components/DraftList";
import { PersonaDetail } from "@/entities/personas/components/PersonaDetail";
import { PersonaList } from "@/entities/personas/components/PersonaList";
import { AccountList } from "../accounts/components/AccountList";
import { AccountDetail } from "../accounts/components/AccountDetail";
import { PersonaAccountList } from "../accounts/components/PersonaAccountList";

export interface CardRenderCallbacks {
  onRemoveMessage?: (messageId: number) => void;
  onCampaignSelect?: (campaignId: number, sourceMessageId: number) => void;
  onDraftSelect?: (draftId: number, sourceMessageId: number) => void;
  onPersonaSelect?: (personaId: number, sourceMessageId: number) => void;
  onAccountSelect?: (accountId: number, sourceMessageId: number) => void;
}

export interface RenderCardOptions {
  messageId: number;
  callbacks?: CardRenderCallbacks;
}

/**
 * 카드 타입에 따른 컴포넌트를 렌더링하는 라우터
 */
export const renderCardByType = (card: ChatCard, options?: RenderCardOptions): React.ReactNode => {
  const { card_type, data, title } = card;
  const messageId = options?.messageId ?? -1;
  const callbacks = options?.callbacks ?? {};

  // Trends 카드 특별 처리
  if (card_type === 'trends' || (data && data.source && data.items)) {
    return <TrendResultCard query={title || "Trends"} results={data as unknown as TrendsListResponse} />;
  }

  // Campaign 관련 특수 처리
  if (card_type === 'campaign.detail' && data?.id) {
    return (
      <CampaignDetail
        campaignId={data.id as number}
        onDelete={() => callbacks.onRemoveMessage?.(messageId)}
      />
    );
  }
  if (card_type === 'campaign.list') {
    return (
      <CampaignList
        onSelectCampaign={(campaignId) => callbacks.onCampaignSelect?.(campaignId, messageId)}
      />
    );
  }

  // Draft 관련 특수 처리
  if (card_type === 'draft.detail' && data?.id) {
    return (
      <DraftDetail
        draftId={data.id as number}
        onDelete={() => callbacks.onRemoveMessage?.(messageId)}
      />
    );
  }
  if (card_type === 'draft.list') {
    return (
      <DraftList
        onSelectDraft={(draftId) => callbacks.onDraftSelect?.(draftId, messageId)}
      />
    );
  }

  // Persona 관련 특수 처리
  if (card_type === 'account.persona.detail' && data?.id) {
    return (
      <PersonaDetail
        personaId={data.id as number}
        onDelete={() => callbacks.onRemoveMessage?.(messageId)}
      />
    );
  }
  if (card_type === 'account.persona.list') {
    return (
      <PersonaList
        onSelectPersona={(personaId) => callbacks.onPersonaSelect?.(personaId, messageId)}
      />
    );
  }

  // PersonaAccount 관련 특수 처리
  if (card_type === 'account.persona_account.list') {
    return (
      <PersonaAccountList
        //accountId={data.account_id as number}
        palist={data.items as any}
      />
    );
  }

  // Account 관련 특수 처리
  if (card_type === 'account.pa.list') {
    return (
      <AccountList
        onSelectAccount={(accountId) => callbacks.onAccountSelect?.(accountId, messageId)}
      />
    );
  }

  if (card_type === 'account.pa.detail' && data?.id) {
    return (
      <AccountDetail
        accountId={data.id as number}
        onDelete={() => callbacks.onRemoveMessage?.(messageId)}
      />
    );
  }

  // 카드 타입에 따라 컴포넌트 선택
  switch (card_type) {
    case 'table':
    case 'list':
    case 'series':
    case 'collection':
    case 'campaign.kpi_def':
    case 'draft.variant.list':
      return <TableCard title={title || "Data"} data={data || card} />;

    case 'chart':
    case 'kpi':
    case 'metric':
    case 'campaign.kpi':
      return <ChartCard title={title || "Data"} data={data || card} />;

    case 'editor':
    case 'draft':
    case 'draft.variant.detail':
      return <EditorCard title={title || "Data"} data={data || card} />;

    case 'profile':
    case 'persona':
    case 'user':
    case 'account.pa.detail':
      return <ProfileCard title={title || "Data"} data={data || card} />;

    case 'info':
    case 'message':
      return <InfoCard title={title || "Data"} data={data || card} />;

    case 'trends':
    case 'trends.list':
      return <TrendResultCard query={title || "Trends"} results={data as unknown as TrendsListResponse} />;

    default:
      return <GenericCard title={title || "Data"} data={data || card} />;
  }
};
