import React from "react";
import {
  ChatCard,
  TrendsListResponse,
  DraftVariantRender,
  InsightCommentList,
  ReactionMessageTemplateOut,
  DraftVariantRenderDetail,
  RagRelatedEdge,
  RagExpandResponse,
  RagSearchResponse,
  TrackingLinkListResponse,
  GraphRagActionAck,
} from "@/lib/api/generated";

// Generic Cards
import { InfoCard } from "./components/InfoCard";
import { SeriesTableCard } from "./components/SeriesTableCard";

// Feature-specific Cards
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { CampaignDetail } from "@/entities/campaigns/components/CampaignDetail";
import { CampaignList } from "@/entities/campaigns/components/CampaignList";
import { DraftDetail } from "@/entities/drafts/components/DraftDetail";
import { DraftList } from "@/entities/drafts/components/DraftList";
import { DraftVariantList } from "../drafts/components/DraftVariantList";
import { DraftVariantDetail } from "../drafts/components/DraftVariantDetail";
import { PersonaDetail } from "@/entities/personas/components/PersonaDetail";
import { PersonaList } from "@/entities/personas/components/PersonaList";
import { AccountList } from "../accounts/components/AccountList";
import { AccountDetail } from "../accounts/components/AccountDetail";
import { PersonaAccountList } from "../accounts/components/PersonaAccountList";
import { PersonaAccountCard } from "../accounts/components/PersonaAccountCard";
import { TimelineCard } from "@/entities/timeline/components/TimelineCard";
import { TimelineEvent } from "@/entities/timeline/model/types";
import { CoWorkerDetail } from "@/entities/coworkers/components/CoWorkerDetail";
import { PlaybookList } from "@/entities/playbooks/components/PlaybookList";
import { PlaybookDetail } from "@/entities/playbooks/components/PlaybookDetail";
import { PlaybookAnalysisDashboard } from "@/entities/playbooks/components/PlaybookAnalysisDashboard";
import PostPublicationList from "@/entities/post-publications/components/PostPublicationList";
import CommentList from "@/entities/comments/components/CommentList";
import { RuleOverviewCard } from "@/entities/reactive/components/RuleOverviewCard";
import { RuleDetailCard } from "@/entities/reactive/components/RuleDetailCard";
import { ActionLogCard } from "@/entities/reactive/components/ActionLogCard";
import { ActionLogDetailCard } from "@/entities/reactive/components/ActionLogDetailCard";
import { TemplateDetailCard } from "@/entities/reactive/components/template/TemplateDetailCard";
import { TrackingLinkList } from "@/entities/tracking/components/TrackingLinkList";
import GraphExplorer from "@/entities/rag/components/GraphExplorer";
import ActionAck from "@/entities/rag/components/ActionAck";

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
  onRagExpand?: (nodeId: string, nodeType: string, sourceMessageId: number, expandedData?: any) => void;
  onRagNavigate?: (nodeId: string, nodeType: string, sourceMessageId: number) => void;
  onValueClick?: (key: string, value: unknown) => void;
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

  console.log('renderCardByType called with:', { card_type, data, title, messageId });

  // Playbook Dashboard 페이지 매핑
  const dashboardPages: Record<string, string> = {
    'playbook.dashboard.overview': 'overview',
    'playbook.dashboard.event_chain': 'eventChain',
    'playbook.dashboard.performance': 'performance',
    'playbook.dashboard.insights': 'insights',
    'playbook.dashboard.recommendations': 'recommendations',
    'playbook.dashboard.trend_correlation': 'trendCorrelation',
  };

  switch (card_type) {
    // ==================== Timeline ====================
    case 'timeline.events.composed':
      if (data?.events) {
        return <TimelineCard title={title || "Timeline"} events={data.events as TimelineEvent[]} />;
      }
      break;

    // ==================== Trends ====================
    case 'trends':
    case 'trends.list':
      return <TrendResultCard query={title || "Trends"} results={data as unknown as TrendsListResponse} />;

    // ==================== Campaign ====================
    case 'campaign.detail':
      if (data?.id) {
        return (
          <CampaignDetail
            campaignId={data.id as number}
            onDelete={() => callbacks.onRemoveMessage?.(messageId)}
          />
        );
      }
      break;

    case 'campaign.list':
      return (
        <CampaignList
          onSelectCampaign={(campaignId) => callbacks.onCampaignSelect?.(campaignId, messageId)}
        />
      );

    // ==================== Tracking ====================
    case 'tracking.links.list':
      return (
        <TrackingLinkList
          data={data as unknown as TrackingLinkListResponse}
          onDraftVariantSelect={(variant, sourceMessageId) => callbacks.onDraftVariantSelect?.(variant, sourceMessageId || messageId)}
        />
      );

    // ==================== Draft ====================
    case 'draft.detail':
      if (data?.id) {
        return (
          <DraftDetail
            draftId={data.id as number}
            onDelete={() => callbacks.onRemoveMessage?.(messageId)}
          />
        );
      }
      break;

    case 'draft.list':
      return (
        <DraftList
          onSelectDraft={(draftId) => callbacks.onDraftSelect?.(draftId, messageId)}
        />
      );

    case 'draft.variant.list':
      return (
        <DraftVariantList
          onSelect={(variant) => callbacks.onDraftVariantSelect?.(variant, messageId)}
          variants={data.items as DraftVariantRender[]}
        />
      );

    case 'draft.variant.detail':
      if (data.variant_id) {
        return (
          <DraftVariantDetail
            draftId={data.draft_id as number}
            platform={data.platform as string}
            variantData={data as unknown as DraftVariantRenderDetail}
          />
        );
      }
      break;

    case 'draft.post_publications.list':
      return (
        <PostPublicationList
          onSelectPublication={(publicationId) => callbacks.onPostPublicationSelect?.(publicationId, messageId)}
        />
      );

    // ==================== Persona ====================
    case 'account.persona.detail':
      if (data?.id) {
        return (
          <PersonaDetail
            personaId={data.id as number}
            onDelete={() => callbacks.onRemoveMessage?.(messageId)}
          />
        );
      }
      break;

    case 'account.persona.list':
      return (
        <PersonaList
          onSelectPersona={(personaId) => callbacks.onPersonaSelect?.(personaId, messageId)}
        />
      );

    // ==================== PersonaAccount ====================
    case 'account.persona_account.list':
      return <PersonaAccountList palist={data.items as any} />;

    case 'account.persona_account.detail':
      if (data?.id) {
        return <PersonaAccountCard link={data as any} />;
      }
      break;

    // ==================== Account ====================
    case 'account.pa.list':
      return (
        <AccountList
          onSelectAccount={(accountId) => callbacks.onAccountSelect?.(accountId, messageId)}
        />
      );

    case 'account.pa.detail':
      if (data?.id) {
        return (
          <AccountDetail
            accountId={data.id as number}
            onDelete={() => callbacks.onRemoveMessage?.(messageId)}
          />
        );
      }
      break;

    // ==================== Playbook ====================
    case 'playbook.detail':
      if (data && typeof data === 'object' && 'playbook' in data &&
        data.playbook && typeof data.playbook === 'object' &&
        'id' in data.playbook && data.playbook.id) {
        return (
          <PlaybookDetail
            playbookId={data.playbook.id as number}
            onDelete={() => callbacks.onRemoveMessage?.(messageId)}
          />
        );
      }
      break;

    case 'playbook.list':
      return (
        <PlaybookList
          onSelectPlaybook={(playbookId) => callbacks.onPlaybookSelect?.(playbookId, messageId)}
        />
      );

    case 'playbook.dashboard.overview':
    case 'playbook.dashboard.event_chain':
    case 'playbook.dashboard.performance':
    case 'playbook.dashboard.insights':
    case 'playbook.dashboard.recommendations':
    case 'playbook.dashboard.trend_correlation':
      if (data && typeof data === 'object' && 'playbook_id' in data) {
        return (
          <PlaybookAnalysisDashboard
            playbookId={data.playbook_id as number}
            initialPage={dashboardPages[card_type]}
          />
        );
      }
      break;

    // ==================== Comments ====================
    case 'insights.comments.list':
      return (
        <CommentList
          data={data as unknown as InsightCommentList}
          onSelectComment={(commentId) => callbacks.onCommentSelect?.(commentId, messageId)}
        />
      );

    // ==================== CoWorker ====================
    case 'coworker.detail':
      return <CoWorkerDetail />;

    // ==================== Reactive ====================
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
              // TODO: Linker modal을 열기 위한 로직 (ChatStream에서 구현)
            }}
            onEditRule={(ruleId) => {
              // TODO: Edit rule 로직 (ChatStream에서 구현)
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
          onSelectLog={(logId, sourceMessageId) =>
            callbacks.onReactiveSelectActionLog?.(logId, sourceMessageId || messageId)
          }
          sourceMessageId={messageId}
        />
      );

    case 'reactive.action_log.detail':
      if (data?.id) {
        return (
          <ActionLogDetailCard
            actionLogId={data.id as number}
            onBack={() => callbacks.onReactiveViewActivity?.(messageId)}
          />
        );
      }
      break;

    // ==================== RAG ====================
    case 'rag.search.result':
      return (
        <GraphExplorer
          data={data.edges || data.expandData ? undefined : (data as RagSearchResponse)}
          expandData={data.expandData as RagExpandResponse | undefined}
          edges={data.edges as RagRelatedEdge[] | undefined}
          parentNode={
            data.parentNode as
            { nodeId: string; nodeType: string; title?: string; meta?: Record<string, any> } |
            undefined
          }
          onExpandNode={async (nodeId, nodeType, nodeInfo) => {
            callbacks.onRagExpand?.(nodeId, nodeType, messageId, nodeInfo);
          }}
          onNavigate={(nodeId, nodeType) => {
            callbacks.onRagNavigate?.(nodeId, nodeType, messageId);
          }}
        />
      );

    case 'action.graph_rag.ack':
      console.log('cardRouter: action.graph_rag.ack case triggered', { card_type, data, title });
      if (data) {
        console.log('cardRouter: returning ActionAck component');
        try {
          return <ActionAck
            data={data as unknown as GraphRagActionAck}
            title={title}
            onValueClick={callbacks?.onValueClick}
          />;
        } catch (error) {
          console.error('cardRouter: ActionAck component error', error);
          // Fallback to InfoCard if ActionAck fails
          return <InfoCard title={title || "Action Result"} data={data} />;
        }
      }
      console.log('cardRouter: no data, breaking to default');
      break;

    // ==================== Generic Cards ====================
    case 'info':
    case 'message':
      return <InfoCard title={title || "Data"} data={data || card} />;

    default:
      console.log('renderCardByType: falling back to default case for card_type:', card_type);
      return <SeriesTableCard title={title || "Data"} data={data || card} />;
  }
};
