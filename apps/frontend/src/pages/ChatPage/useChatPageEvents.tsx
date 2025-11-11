import React, { useCallback, useRef } from "react";
import { renderCardByType } from "@/entities/messages/cardRouter";
import { Message, useChatMessagesContext } from "@/entities/messages/context/ChatMessagesContext";
import {
  useChatQueryApiOrchestratorChatQueryPost,
  TrendsListResponse,
  DraftVariantRender,
  CoworkerLeaseState,
  ChatCard,
  bffRagExpandApiBffRagNodesNodeIdNeighborsGet,
  RagRelatedEdge,
} from "@/lib/api/generated";
import { TrendQueryCard } from "@/features/trends/components/TrendQueryCard";
import { TrendResultCard } from "@/entities/trends/components/TrendResultCard";
import { CampaignToolCard } from "@/features/campaigns/components/CampaignToolCard";
import { CreateCampaignForm } from "@/features/campaigns/components/CreateCampaignForm";
import { CampaignList } from "@/entities/campaigns/components/CampaignList";
import { CampaignDetail } from "@/entities/campaigns/components/CampaignDetail";
import { DraftToolCard } from "@/features/drafts/components/DraftToolCard";
import { CreateDraftForm } from "@/features/drafts/components/CreateDraftForm";
import { DraftList } from "@/entities/drafts/components/DraftList";
import { DraftDetail } from "@/entities/drafts/components/DraftDetail";
import { PersonaToolCard } from "@/features/personas/components/PersonaToolCard";
import { CreatePersonaForm } from "@/features/personas/components/CreatePersonaForm";
import { PersonaList } from "@/entities/personas/components/PersonaList";
import { PersonaDetail } from "@/entities/personas/components/PersonaDetail";
import { LinkedAccountList } from "@/entities/personas/components/LinkedAccountList";
import { AccountToolCard } from "@/features/accounts/components/AccountToolCard";
import { CreateAccountForm } from "@/features/accounts/components/CreateAccountForm";
import { AccountList } from "@/entities/accounts/components/AccountList";
import { AccountDetail } from "@/entities/accounts/components/AccountDetail";
import { PersonaAccountList } from "@/entities/accounts/components/PersonaAccountList";
import { DraftVariantList } from "@/entities/drafts/components/DraftVariantList";
import { DraftVariantDetail } from "@/entities/drafts/components/DraftVariantDetail";
import { useTranslation } from 'react-i18next';
import { CoworkerToolCard } from "@/features/coworkers/components/CoworkerToolCard";
import { ScheduleToolCard } from "@/features/schedules/components/ScheduleToolCard";
import { CreateRawScheduleForm } from "@/features/schedules/components/CreateRawScheduleForm";
import { CreatePostScheduleForm } from "@/features/schedules/components/CreatePostScheduleForm";
import { CoWorkerDetail } from "@/entities/coworkers/components/CoWorkerDetail";
import { EditCoworkerForm } from "@/features/coworkers/components/EditCoworkerForm";
import { CancelScheduleForm } from "@/features/schedules/components/CancelScheduleForm";
import { CreateSyncMetricsScheduleForm } from "@/features/schedules/components/CreateSyncMetricsScheduleForm";
import ABTestToolCard from "@/features/abtests/components/ABTestToolCard";
import ABTestCreateForm from "@/features/abtests/components/ABTestCreateForm";
import ABTestList from "@/entities/abtests/components/ABTestList";
import ABTestDetail from "@/entities/abtests/components/ABTestDetail";
import PostPublicationList from "@/entities/post-publications/components/PostPublicationList";
import { PlaybookList } from "@/entities/playbooks/components/PlaybookList";
import { PlaybookDetail } from "@/entities/playbooks/components/PlaybookDetail";
import { PlaybookAnalysisDashboard } from "@/entities/playbooks/components/PlaybookAnalysisDashboard";
import { PlaybookToolCard } from "@/features/playbooks/components/PlaybookToolCard";
import { RuleOverviewCard } from "@/entities/reactive/components/RuleOverviewCard";
import { RuleDetailCard } from "@/entities/reactive/components/RuleDetailCard";
import { ActionLogCard } from "@/entities/reactive/components/ActionLogCard";
import { ActionLogDetailCard } from "@/entities/reactive/components/ActionLogDetailCard";
import { RuleToolCard } from "@/entities/reactive/components/RuleToolCard";
import { RuleComposeDrawer } from "@/features/reactive-rule/components/RuleComposeDrawer";
import { RulePublicationModal } from "@/features/reactive-rule/components/RulePublicationModal";
import { TemplateManager } from "@/features/reactive-rule/components/template/TemplateManager";

const isMessageOfComponent = (content: Message["content"], component: React.ComponentType<any>): boolean => (
  React.isValidElement(content) && content.type === component
);
const isCardMessage = (message: Message, component: React.ComponentType<any>) => (
  message.type === 'card' && isMessageOfComponent(message.content, component)
);

type CardContentFactory = (messageId: number) => React.ReactNode;

type TrendSubmitHandler = (query: string, results: TrendsListResponse, sourceMessageId?: number) => void;

type EntitySelectHandler = (entityId: number, sourceMessageId?: number) => void;

type EntitySuccessHandler = (entityId: number, sourceMessageId?: number) => void;

export function useChatPageEvents() {
  const { appendMessage, updateMessages, removeMessage, clearMessages } = useChatMessagesContext();
  const chatMutation = useChatQueryApiOrchestratorChatQueryPost();
  const messageIdRef = useRef<number>(Date.now());
  const { t } = useTranslation();

  const handleCoworkerSelect = useCallback(() => {
    // Placeholder for future implementation
  }, []);

  const getNextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  }, []);

  const addTextMessage = useCallback((content: string, type: 'user' | 'bot') => {
    const id = getNextMessageId();
    appendMessage({ id, type, content });
    return id;
  }, [appendMessage, getNextMessageId]);

  const addCardMessage = useCallback((factory: CardContentFactory) => {
    const id = getNextMessageId();
    console.log('addCardMessage: creating message with id', id);
    const content = factory(id);
    console.log('addCardMessage: factory returned content', content);
    appendMessage({
      id,
      type: 'card',
      content,
    });
    return id;
  }, [appendMessage, getNextMessageId]);

  const removeMessagesByComponent = useCallback((component: React.ComponentType<any>) => {
    updateMessages(prev => prev.filter(message => !isCardMessage(message, component)));
  }, [updateMessages]);

  const handleCardDelete = useCallback((messageId: number) => {
    removeMessage(messageId);
  }, [removeMessage]);

  const handleTrendQuerySubmit = useCallback<TrendSubmitHandler>((query, results, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(() => (
      <TrendResultCard query={query} results={results} />
    ));
  }, [addCardMessage, removeMessage]);

  const addTrendQueryCard = useCallback(() => {
    removeMessagesByComponent(TrendQueryCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <TrendQueryCard
          onSubmit={(query, results) => handleTrendQuerySubmit(query, results, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleTrendQuerySubmit, removeMessagesByComponent]);

  const handleCampaignCreateSuccess = useCallback<EntitySuccessHandler>((campaignId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    } else {
      removeMessagesByComponent(CreateCampaignForm);
    }
    addCardMessage(messageId => (
      <CampaignDetail
        campaignId={campaignId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleCampaignSelect = useCallback<EntitySelectHandler>((campaignId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    removeMessagesByComponent(CampaignToolCard);
    addCardMessage(messageId => (
      <CampaignDetail
        campaignId={campaignId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleNewCampaign = useCallback(() => {
    removeMessagesByComponent(CampaignToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateCampaignForm
          onSuccess={campaignId => handleCampaignCreateSuccess(campaignId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleCampaignCreateSuccess, removeMessagesByComponent]);

  const handleSelectCampaign = useCallback(() => {
    removeMessagesByComponent(CampaignToolCard);
    removeMessagesByComponent(CampaignList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CampaignList
          onSelectCampaign={campaignId => handleCampaignSelect(campaignId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleCampaignSelect, removeMessagesByComponent]);

  const handleDraftCreateSuccess = useCallback<EntitySuccessHandler>((draftId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    } else {
      removeMessagesByComponent(CreateDraftForm);
    }
    addCardMessage(messageId => (
      <DraftDetail
        draftId={draftId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleDraftSelect = useCallback<EntitySelectHandler>((draftId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    removeMessagesByComponent(DraftToolCard);
    addCardMessage(messageId => (
      <DraftDetail
        draftId={draftId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleNewDraft = useCallback(() => {
    removeMessagesByComponent(DraftToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateDraftForm
          onSuccess={draftId => handleDraftCreateSuccess(draftId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleDraftCreateSuccess, removeMessagesByComponent]);

  const handleSelectDraft = useCallback(() => {
    removeMessagesByComponent(DraftToolCard);
    removeMessagesByComponent(DraftList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <DraftList
          onSelectDraft={draftId => handleDraftSelect(draftId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleDraftSelect, removeMessagesByComponent]);

  const handleDraftVariantSelect = useCallback((variant: DraftVariantRender, sourceMessageId: number) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
      removeMessagesByComponent(DraftVariantList);
      addCardMessage(messageId => (
        <DraftVariantDetail
          draftId={variant.draft_id as number}
          platform={variant.platform as string}
        />
      ));
  }, [addCardMessage, removeMessage, removeMessagesByComponent]);

  const handlePersonaCreateSuccess = useCallback<EntitySuccessHandler>((personaId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    else {
      removeMessagesByComponent(CreatePersonaForm);
    }
    addCardMessage(messageId => (
      <PersonaDetail
        personaId={personaId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handlePersonaSelect = useCallback<EntitySelectHandler>((personaId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    removeMessagesByComponent(PersonaToolCard);
    addCardMessage(messageId => (
      <PersonaDetail
        personaId={personaId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleNewPersona = useCallback(() => {
    removeMessagesByComponent(PersonaToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreatePersonaForm
          onSuccess={personaId => handlePersonaCreateSuccess(personaId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handlePersonaCreateSuccess, removeMessagesByComponent]);

  const handleSelectPersona = useCallback(() => {
    removeMessagesByComponent(PersonaToolCard);
    removeMessagesByComponent(PersonaList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <PersonaList
          onSelectPersona={personaId => handlePersonaSelect(personaId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handlePersonaSelect, removeMessagesByComponent]);

  const handleAccountCreateSuccess = useCallback<EntitySuccessHandler>((accountId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    else {
      removeMessagesByComponent(CreateAccountForm);
    }
    addCardMessage(messageId => (
      <AccountDetail
        accountId={accountId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, removeMessage, removeMessagesByComponent, handleCardDelete]);

  const handleAccountSelect = useCallback<EntitySelectHandler>((accountId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    removeMessagesByComponent(AccountToolCard);
    addCardMessage(messageId => (
      <AccountDetail
        accountId={accountId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, removeMessage, removeMessagesByComponent, handleCardDelete]);

  const handleNewAccount = useCallback(() => {
    removeMessagesByComponent(AccountToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateAccountForm
          onSuccess={(account) => handleAccountCreateSuccess(account.id, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleAccountCreateSuccess, removeMessagesByComponent]);

  const handleSelectAccount = useCallback(() => {
    removeMessagesByComponent(AccountToolCard);
    removeMessagesByComponent(AccountList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <AccountList
          onSelectAccount={accountId => handleAccountSelect(accountId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleAccountSelect, removeMessagesByComponent]);

  const handleShowPersonaAccountLinks = useCallback((accountId: number, sourceMessageId?: number) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(() => <PersonaAccountList accountId={accountId} />);
  }, [addCardMessage, removeMessage]);

  const handleShowLinkedAccounts = useCallback((personaId: number, sourceMessageId?: number) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(() => <LinkedAccountList personaId={personaId} />);
  }, [addCardMessage, removeMessage]);

  const handleSelectPersonaForLinks = useCallback(() => {
    removeMessagesByComponent(AccountToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <PersonaList 
          onSelectPersona={personaId => handleShowLinkedAccounts(personaId, messageId)} 
        />
      )
    });
  }, [appendMessage, getNextMessageId, removeMessagesByComponent, handleShowLinkedAccounts]);

  const handleScheduleCreateSuccess = useCallback<EntitySuccessHandler>((scheduleId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addTextMessage(`Schedule(s) created successfully.`, 'bot');
    removeMessagesByComponent(ScheduleToolCard);
  }, [addTextMessage, removeMessage, removeMessagesByComponent]);

  const handleSelectABTestForScheduling = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <ABTestList
          onSelectABTest={abTestId => {
            removeMessage(messageId);
            addCardMessage(messageId => (
              <ABTestDetail
                abTestId={abTestId}
                onDelete={() => handleCardDelete(messageId)}
              />
            ));
          }}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, removeMessage, removeMessagesByComponent, addCardMessage, handleCardDelete]);

  const handleNewPostSchedule = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreatePostScheduleForm
          onCreated={(scheduleIds) => handleScheduleCreateSuccess(scheduleIds[0], messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleScheduleCreateSuccess, removeMessagesByComponent]);

  const handleNewSyncMetricsSchedule = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateSyncMetricsScheduleForm
          onCreated={(scheduleIds) => handleScheduleCreateSuccess(scheduleIds[0], messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleScheduleCreateSuccess, removeMessagesByComponent]);

  const handleNewRawSchedule = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateRawScheduleForm
          onCreated={(scheduleIds) => handleScheduleCreateSuccess(scheduleIds[0], messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleScheduleCreateSuccess, removeMessagesByComponent]);

  const handleCancelScheduleSuccess = useCallback((sourceMessageId?: number) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addTextMessage(`Schedule(s) cancelled successfully.`, 'bot');
    removeMessagesByComponent(ScheduleToolCard);
  }, [addTextMessage, removeMessage, removeMessagesByComponent]);

  const handleCancelSchedule = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CancelScheduleForm
          onCancelled={() => handleCancelScheduleSuccess(messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleCancelScheduleSuccess, removeMessagesByComponent]);

  const handleViewCoworkerDetails = useCallback(() => {
    removeMessagesByComponent(CoworkerToolCard);
    addCardMessage(() => <CoWorkerDetail />);
  }, [addCardMessage, removeMessagesByComponent]);

  const handleEditCoworker = useCallback((lease: CoworkerLeaseState) => {
    removeMessagesByComponent(CoworkerToolCard);
    const messageId = getNextMessageId();
    appendMessage({
        id: messageId,
        type: 'card',
        content: (
            <EditCoworkerForm 
                lease={lease} 
                onSuccess={() => removeMessage(messageId)} 
            />
        )
    });
  }, [addCardMessage, removeMessagesByComponent, removeMessage, getNextMessageId]);

  const handleABTestCreateSuccess = useCallback<EntitySuccessHandler>((abTestId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    } else {
      removeMessagesByComponent(ABTestCreateForm);
    }
    addCardMessage(messageId => (
      <ABTestDetail
        abTestId={abTestId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage, removeMessagesByComponent]);

  const handleNewABTest = useCallback(() => {
    removeMessagesByComponent(ABTestToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <ABTestCreateForm
          onSuccess={(abTestId) => handleABTestCreateSuccess(abTestId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handleABTestCreateSuccess, removeMessagesByComponent]);

  const handleSelectABTest = useCallback(() => {
    removeMessagesByComponent(ABTestToolCard);
    removeMessagesByComponent(ABTestList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <ABTestList
          onSelectABTest={abTestId => {
            addCardMessage(messageId => (
              <ABTestDetail
                abTestId={abTestId}
                onDelete={() => handleCardDelete(messageId)}
              />
            ));
          }}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, addCardMessage, handleCardDelete, removeMessagesByComponent]);

  const handleSelectListPublications = useCallback(() => {
    removeMessagesByComponent(DraftToolCard);
    addCardMessage(() => <PostPublicationList />);
  }, [addCardMessage, removeMessagesByComponent]);

  const handlePlaybookSelect = useCallback<EntitySelectHandler>((playbookId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(messageId => (
      <PlaybookDetail
        playbookId={playbookId}
        onDelete={() => handleCardDelete(messageId)}
      />
    ));
  }, [addCardMessage, handleCardDelete, removeMessage]);

  const handlePlaybookAnalyze = useCallback<EntitySelectHandler>((playbookId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(messageId => (
      <PlaybookAnalysisDashboard playbookId={playbookId} />
    ));
  }, [addCardMessage, removeMessage]);

  const handleSelectPlaybook = useCallback(() => {
    removeMessagesByComponent(PlaybookToolCard);
    removeMessagesByComponent(PlaybookList);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <PlaybookList
          onSelectPlaybook={playbookId => handlePlaybookSelect(playbookId, messageId)}
          onAnalyzePlaybook={playbookId => handlePlaybookAnalyze(playbookId, messageId)}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, handlePlaybookSelect, handlePlaybookAnalyze, removeMessagesByComponent]);

  // Reactive 핸들러들
  const handleReactiveRuleSelect = useCallback<EntitySelectHandler>((ruleId, sourceMessageId) => {
    if (sourceMessageId) {
      removeMessage(sourceMessageId);
    }
    addCardMessage(messageId => (
      <RuleDetailCard
        ruleId={ruleId}
        onRequestLinker={(ruleId) => {
          // RulePublicationModal을 열기 위한 메시지 추가
          const modalMessageId = getNextMessageId();
          appendMessage({
            id: modalMessageId,
            type: 'card',
            content: (
              <RulePublicationModal
                open={true}
                onOpenChange={(open) => {
                  if (!open) removeMessage(modalMessageId);
                }}
                ruleId={ruleId}
                ruleName={`Rule ${ruleId}`}
              />
            ),
          });
        }}
        onEditRule={(ruleId) => {
          // RuleComposeDrawer를 열기 위한 메시지 추가
          const drawerMessageId = getNextMessageId();
          appendMessage({
            id: drawerMessageId,
            type: 'card',
            content: (
              <RuleComposeDrawer
                open={true}
                onOpenChange={(open) => {
                  if (!open) removeMessage(drawerMessageId);
                }}
                ruleId={ruleId}
                initialData={undefined}
              />
            ),
          });
        }}
      />
    ));
  }, [addCardMessage, removeMessage, appendMessage, getNextMessageId]);

  const handleReactiveCreateRule = useCallback((sourceMessageId: number) => {
    // RuleComposeDrawer를 열기 위한 메시지 추가
    const drawerMessageId = getNextMessageId();
    appendMessage({
      id: drawerMessageId,
      type: 'card',
      content: (
        <RuleComposeDrawer
          open={true}
          onOpenChange={(open) => {
            if (!open) removeMessage(drawerMessageId);
          }}
        />
      ),
    });
  }, [appendMessage, getNextMessageId, removeMessage]);

  const handleReactiveSelectActionLog = useCallback((actionLogId: number, sourceMessageId?: number) => {
    console.log('handleReactiveSelectActionLog called', actionLogId, sourceMessageId);
    try {
      if (sourceMessageId) {
        console.log('Removing message', sourceMessageId);
        removeMessage(sourceMessageId);
      }

      const messageId = getNextMessageId();
      console.log('Creating new message', messageId);

      appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <ActionLogDetailCard
          actionLogId={actionLogId}
          onBack={() => {
            // Go back to activity log list
            removeMessage(messageId);
            const backMessageId = getNextMessageId();
            appendMessage({
              id: backMessageId,
              type: 'card',
              content: <ActionLogCard onSelectLog={handleReactiveSelectActionLog} sourceMessageId={backMessageId} />,
            });
          }}
        />
      ),
    });
    } catch (error) {
      console.error('Error in handleReactiveSelectActionLog:', error);
    }
  }, [appendMessage, getNextMessageId, removeMessage]);

  const handleReactiveViewActivity = useCallback((sourceMessageId: number) => {
    addCardMessage((messageId) => <ActionLogCard onSelectLog={handleReactiveSelectActionLog} sourceMessageId={messageId} />);
  }, [addCardMessage, handleReactiveSelectActionLog]);

  const handleManageTemplates = useCallback(() => {
    removeMessagesByComponent(RuleToolCard);
    addCardMessage(() => <TemplateManager />);
  }, [addCardMessage, removeMessagesByComponent]);

  const handleRagNavigate = useCallback(async (nodeId: string, nodeType: string, sourceMessageId: number) => {
    console.log('handleRagNavigate called', nodeId, nodeType, sourceMessageId);

    // 노드 타입에 따라 적절한 리스트 카드 표시
    switch (nodeType) {
      case 'campaign':
        addCardMessage(messageId => renderCardByType({
          card_type: 'campaign.list',
          data: {},
          title: 'Select Campaign'
        }, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onCampaignSelect: handleCampaignSelect,
          }
        }));
        break;
      case 'draft':
        addCardMessage(messageId => renderCardByType({
          card_type: 'draft.list',
          data: {},
          title: 'Select Draft'
        }, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onDraftSelect: handleDraftSelect,
          }
        }));
        break;
      case 'persona':
        addCardMessage(messageId => renderCardByType({
          card_type: 'account.persona.list',
          data: {},
          title: 'Select Persona'
        }, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onPersonaSelect: handlePersonaSelect,
          }
        }));
        break;
      case 'playbook':
        addCardMessage(messageId => renderCardByType({
          card_type: 'playbook.list',
          data: {},
          title: 'Select Playbook'
        }, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onPlaybookSelect: handlePlaybookSelect,
          }
        }));
        break;
      case 'account':
        addCardMessage(messageId => renderCardByType({
          card_type: 'account.pa.list',
          data: {},
          title: 'Select Account'
        }, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onAccountSelect: handleAccountSelect,
          }
        }));
        break;
      case 'insight_comment':
        break;
      default:
        // 다른 타입들은 아직 처리하지 않음
        console.log('Navigation not implemented for node type:', nodeType);
        break;
    }
  }, [addCardMessage, renderCardByType, handleCardDelete, handleCampaignSelect, handleDraftSelect, handlePersonaSelect, handlePlaybookSelect, handleAccountSelect]);

  const handleRagExpand = useCallback(async (nodeId: string, nodeType: string, sourceMessageId: number, nodeInfo?: RagRelatedEdge) => {
    try {
      const result = await bffRagExpandApiBffRagNodesNodeIdNeighborsGet(
        nodeId,
        null, // edge_types
        { limit: 20 } // params
      );

      // 확장된 결과를 새로운 카드로 표시
      addCardMessage(messageId => renderCardByType({
        card_type: 'rag.search.result',
        data: {
          expandData: result,
          parentNode: {
            nodeId,
            nodeType,
            title: nodeInfo?.title || `${nodeType.replace('_', ' ')} connections`,
            meta: nodeInfo?.node_meta || nodeInfo?.meta || (nodeInfo as any)?.meta
          }
        },
        title: `Expanded ${nodeType}`
      }, {
        messageId,
        callbacks: {
          onRemoveMessage: handleCardDelete,
          onRagExpand: handleRagExpand,
          onRagNavigate: handleRagNavigate,
        }
      }));
    } catch (error) {
      console.error('Failed to expand node:', error);
      addTextMessage('Failed to expand node', 'bot');
    }
  }, [addCardMessage, renderCardByType, handleCardDelete, addTextMessage, handleRagNavigate]);

  const handleReactiveSelectRule = useCallback(() => {
    removeMessagesByComponent(RuleToolCard);
    addCardMessage(() => (
      <RuleOverviewCard
        onCreateRule={() => {
          const messageId = getNextMessageId();
          appendMessage({
            id: messageId,
            type: 'card',
            content: (
              <RuleComposeDrawer
                open={true}
                onOpenChange={(open) => {
                  if (!open) removeMessage(messageId);
                }}
              />
            ),
          });
        }}
        onViewActivity={() => <ActionLogCard onSelectLog={handleReactiveSelectActionLog} sourceMessageId={messageIdRef.current} />}
        onSelectRule={handleReactiveRuleSelect}
        onManageTemplates={handleManageTemplates}
      />
    ));
  }, [addCardMessage, removeMessagesByComponent, getNextMessageId, appendMessage, removeMessage, handleReactiveRuleSelect, handleManageTemplates]);

  const handleToolClick = useCallback(
    (toolId: string) => {
      switch (toolId) {
        case "campaigns":
          removeMessagesByComponent(CampaignToolCard);
          addCardMessage(() => (
            <CampaignToolCard onNew={handleNewCampaign} onSelect={handleSelectCampaign} />
          ));
          break;
        case "draft":
          removeMessagesByComponent(DraftToolCard);
          addCardMessage(() => (
            <DraftToolCard
              onNew={handleNewDraft}
              onSelect={handleSelectDraft}
              onSelectListPublications={handleSelectListPublications}
            />
          ));
          break;
        case "personas":
          removeMessagesByComponent(PersonaToolCard);
          addCardMessage(() => (
            <PersonaToolCard onNew={handleNewPersona} onSelect={handleSelectPersona} />
          ));
          break;
        case "accounts":
          removeMessagesByComponent(AccountToolCard);
          addCardMessage(() => (
            <AccountToolCard
              onNew={handleNewAccount}
              onSelect={handleSelectAccount}
              onSelectLinks={handleSelectPersonaForLinks}
            />
          ));
          break;
        case "schedules":
          removeMessagesByComponent(ScheduleToolCard);
          addCardMessage(() => (
            <ScheduleToolCard
              onScheduleAction={(template) => {
                if (template.key.startsWith("post.")) {
                  handleNewPostSchedule();
                } else if (template.key.startsWith("insights.")) {
                  handleNewSyncMetricsSchedule();
                } else if (template.key.startsWith("abtest.")) {
                  handleSelectABTestForScheduling();
                } else {
                  console.log("Unknown template:", template.key);
                }
              }}
              onNewRawSchedule={handleNewRawSchedule}
              onCancel={handleCancelSchedule}
            />
          ));
          break;
        case "coworker":
          removeMessagesByComponent(CoworkerToolCard);
          addCardMessage(() => (
            <CoworkerToolCard
              onViewDetails={handleViewCoworkerDetails}
              onEdit={handleEditCoworker}
            />
          ));
          break;
        case "ab-tests":
          removeMessagesByComponent(ABTestToolCard);
          addCardMessage(() => (
            <ABTestToolCard onNew={handleNewABTest} onSelect={handleSelectABTest} />
          ));
          break;
        case "playbooks":
          removeMessagesByComponent(PlaybookToolCard);
          addCardMessage(() => (
            <PlaybookToolCard onSelect={handleSelectPlaybook} />
          ));
          break;
        case "reactive":
          removeMessagesByComponent(RuleToolCard);
          addCardMessage(() => (
            <RuleToolCard
              onCreateRule={() => {
                const messageId = getNextMessageId();
                appendMessage({
                  id: messageId,
                  type: 'card',
                  content: (
                    <RuleComposeDrawer
                      open={true}
                      onOpenChange={(open) => {
                        if (!open) removeMessage(messageId);
                      }}
                    />
                  ),
                });
              }}
              onViewActivity={() => handleReactiveViewActivity(messageIdRef.current)}
              onSelectRule={handleReactiveSelectRule}
              onManageTemplates={handleManageTemplates}
            />
          ));
          break;
        default:
          break;
      }
    },
    [
      addCardMessage,
      handleNewCampaign,
      handleNewDraft,
      handleNewPersona,
      handleSelectCampaign,
      handleSelectDraft,
      handleSelectPersona,
      handleNewAccount,
      handleSelectAccount,
      handleSelectPersonaForLinks,
      removeMessagesByComponent,
      handleNewPostSchedule,
      handleNewRawSchedule,
      handleCancelSchedule,
      handleNewABTest,
      handleSelectABTest,
      handleSelectListPublications,
      handleSelectPlaybook,
      handleReactiveSelectRule,
      handleManageTemplates,
      handleReactiveSelectActionLog,
      PlaybookToolCard,
      RuleToolCard,
    ]
  );

  const clearChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleChatSend = useCallback(async (content: string) => {
    addTextMessage(content, 'user');

    try {
      const response = await chatMutation.mutateAsync({
        data: {
          message: content,
          session_id: null,
        },
      });

      response.messages?.forEach(message => {
        addTextMessage(message, 'bot');
      });

      const cardsByType = new Map<string, ChatCard>();
      response.cards?.forEach(card => {
        cardsByType.set(card.card_type, card);
      });

      cardsByType.forEach(card => {
        addCardMessage(messageId => renderCardByType(card, {
          messageId,
          callbacks: {
            onRemoveMessage: handleCardDelete,
            onCampaignSelect: handleCampaignSelect,
            onDraftSelect: handleDraftSelect,
            onPersonaSelect: handlePersonaSelect,
            onAccountSelect: handleAccountSelect,
            onDraftVariantSelect: handleDraftVariantSelect,
            onPlaybookSelect: handlePlaybookSelect,
            onCoworkerSelect: handleCoworkerSelect,
            onReactiveRuleSelect: handleReactiveRuleSelect,
            onReactiveCreateRule: handleReactiveCreateRule,
            onReactiveViewActivity: handleReactiveViewActivity,
            onReactiveSelectActionLog: handleReactiveSelectActionLog,
            onRagExpand: handleRagExpand,
            // 확장 결과인 경우에만 onRagNavigate 추가
            ...(card.card_type === 'rag.search.result' && card.data?.parentNode ? {
              onRagNavigate: handleRagNavigate,
            } : {}),
          },
        }));
      });
    } catch (error) {
      console.error('Chat error:', error);
      addTextMessage(t('chat.error_message'), 'bot');
    }
  }, [addCardMessage, addTextMessage, chatMutation, handleCampaignSelect, handleCardDelete, handleDraftSelect, handlePersonaSelect, handleAccountSelect, handleDraftVariantSelect, handleCoworkerSelect, handleReactiveRuleSelect, handleReactiveCreateRule, handleReactiveViewActivity, handleRagNavigate, t]);

  return {
    handleChatSend,
    addTrendQueryCard,
    clearChat,
    handleToolClick,
    handleSelectCampaign,
    handleSelectDraft,
  };
}