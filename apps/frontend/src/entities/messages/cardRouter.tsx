import React from "react";
import { ChatCard, TrendsListResponse, DraftVariantRender, InsightCommentList, ReactionMessageTemplateOut, DraftVariantRenderDetail } from "@/lib/api/generated";
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
import { PersonaAccountCard } from "../accounts/components/PersonaAccountCard";
import { DraftVariantList } from "../drafts/components/DraftVariantList";
import { DraftVariantDetail } from "../drafts/components/DraftVariantDetail";
import { TimelineCard } from "@/entities/timeline/components/TimelineCard";
import { TimelineEvent } from "@/entities/timeline/model/types";
import { CoWorkerDetail } from "@/entities/coworkers/components/CoWorkerDetail";
import { PlaybookList } from "@/entities/playbooks/components/PlaybookList";
import { PlaybookDetail } from "@/entities/playbooks/components/PlaybookDetail";
import PostPublicationList from "@/entities/post-publications/components/PostPublicationList";
import CommentList from "@/entities/comments/components/CommentList";
import { RuleOverviewCard } from "@/entities/reactive/components/RuleOverviewCard";
import { RuleDetailCard } from "@/entities/reactive/components/RuleDetailCard";
import { ActionLogCard } from "@/entities/reactive/components/ActionLogCard";
import { ActionLogDetailCard } from "@/entities/reactive/components/ActionLogDetailCard";
import { TemplateDetailCard } from "@/entities/reactive/components/template/TemplateDetailCard";

export interface CardRenderCallbacks {
  onRemoveMessage?: (messageId: number) => void;
  onCampaignSelect?: (campaignId: number, sourceMessageId: number) => void;
  onDraftSelect?: (draftId: number, sourceMessageId: number) => void;
  onPersonaSelect?: (personaId: number, sourceMessageId: number) => void;
  onAccountSelect?: (accountId: number, sourceMessageId: number) => void;
  onDraftVariantSelect?: (variant: DraftVariantRender, sourceMessageId: number) => void;
  onPlaybookSelect?: (playbookId: number, sourceMessageId: number) => void;
  onCoworkerSelect?: () => void;
  onPostPublicationSelect?: (publicationId: number, sourceMessageId: number) => void;
  onCommentSelect?: (commentId: number, sourceMessageId: number) => void;
  onReactiveRuleSelect?: (ruleId: number, sourceMessageId: number) => void;
  onReactiveCreateRule?: (sourceMessageId: number) => void;
  onReactiveViewActivity?: (sourceMessageId: number) => void;
  onReactiveSelectActionLog?: (actionLogId: number, sourceMessageId: number) => void;
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
  
  if (card_type === 'timeline.events.composed' && data?.events) {
    return <TimelineCard title={title || "Timeline"} events={data.events as TimelineEvent[]} />;
  }

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

  if (card_type === 'draft.variant.list') {
    return (
      <DraftVariantList
        onSelect={(variant) => callbacks.onDraftVariantSelect?.(variant, messageId)}
        variants={data.items as DraftVariantRender[]}
      />
    );
  }

  if (card_type === 'draft.variant.detail' && data.variant_id) {
    return (
      <DraftVariantDetail
        draftId={data.draft_id as number}
        platform={data.platform as string}
        variantData={data as unknown as DraftVariantRenderDetail}
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
  if (card_type === 'account.persona_account.detail' && data?.id) {
    return (
      <PersonaAccountCard link={data as any} />
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

  // Playbook 관련 특수 처리
  if (card_type === 'playbook.detail' && data && typeof data === 'object' && 'playbook' in data && data.playbook && typeof data.playbook === 'object' && 'id' in data.playbook && data.playbook.id) {
    return (
      <PlaybookDetail
        playbookId={data.playbook.id as number}
        onDelete={() => callbacks.onRemoveMessage?.(messageId)}
      />
    );
  }
  if (card_type === 'playbook.list') {
    return (
      <PlaybookList
        onSelectPlaybook={playbookId => callbacks.onPlaybookSelect?.(playbookId, messageId)}
      />
    );
  }

  if (card_type === 'draft.post_publications.list') {
    return (
      <PostPublicationList
        onSelectPublication={(publicationId) => callbacks.onPostPublicationSelect?.(publicationId, messageId)}
      />
    );
  }

  if (card_type === 'insights.comments.list') {
    return (
      <CommentList
        data={data as unknown as InsightCommentList}
        onSelectComment={(commentId) => callbacks.onCommentSelect?.(commentId, messageId)}
      />
    );
  }

  if (card_type === 'coworker.detail') {
    return <CoWorkerDetail />;
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

    // Reactive 관련 카드들
    case 'reactive.rule.overview':
      return (
        <RuleOverviewCard
          onCreateRule={() => callbacks.onReactiveCreateRule?.(messageId)}
          onViewActivity={() => callbacks.onReactiveViewActivity?.(messageId)}
          onSelectRule={(ruleId) => callbacks.onReactiveRuleSelect?.(ruleId, messageId)}
        />
      );

    case 'reactive.rule.detail':
      if (data?.id) {
        return (
          <RuleDetailCard
            ruleId={data.id as number}
            onRequestLinker={(ruleId) => {
              // Linker modal을 열기 위한 로직 (ChatStream에서 구현)
              console.log('Request linker for rule:', ruleId);
            }}
            onEditRule={(ruleId) => {
              // Edit rule 로직 (ChatStream에서 구현)
              console.log('Edit rule:', ruleId);
            }}
          />
        );
      }
      break;

    case 'reactive.template.detail':
      return (
        <TemplateDetailCard
          template={data as unknown as ReactionMessageTemplateOut}
        />
      );

    case 'reactive.activity.log':
      return (
        <ActionLogCard
          onSelectLog={(logId, sourceMessageId) => callbacks.onReactiveSelectActionLog?.(logId, sourceMessageId || messageId)}
          sourceMessageId={messageId}
        />
      );

    case 'reactive.action_log.detail':
      if (data?.id) {
        return (
          <ActionLogDetailCard
            actionLogId={data.id as number}
            onBack={() => {
              // Go back to activity log list
              callbacks.onReactiveViewActivity?.(messageId);
            }}
          />
        );
      }
      break;

    default:
      return <GenericCard title={title || "Data"} data={data || card} />;
  }
};
