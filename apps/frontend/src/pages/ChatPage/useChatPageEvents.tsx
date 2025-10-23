import React, { useCallback, useRef } from "react";
import { renderCardByType } from "@/entities/messages/cardRouter";
import { Message, useChatMessagesContext } from "@/entities/messages/context/ChatMessagesContext";
import {
  useChatQueryApiOrchestratorChatQueryPost,
  TrendsListResponse,
  bffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet,
  DraftVariantRender,
  CoworkerLeaseState,
  ChatCard,
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
import { EditAccountForm } from "@/features/accounts/components/EditAccountForm";
import { AccountList } from "@/entities/accounts/components/AccountList";
import { AccountDetail } from "@/entities/accounts/components/AccountDetail";
import { PersonaAccountList } from "@/entities/accounts/components/PersonaAccountList";
import { PlatformAccountOut } from "@/lib/api/generated";
import { DraftVariantList } from "@/entities/drafts/components/DraftVariantList";
import { DraftVariantDetail } from "@/entities/drafts/components/DraftVariantDetail";
import { useTranslation } from 'react-i18next';
import { CoworkerToolCard } from "@/features/coworkers/components/CoworkerToolCard";
import { ScheduleToolCard } from "@/features/schedules/components/ScheduleToolCard";
import { CreateRawScheduleForm } from "@/features/schedules/components/CreateRawScheduleForm";
import { CreatePostScheduleForm } from "@/features/schedules/components/CreatePostScheduleForm";
import { CreateTrendsMailScheduleForm } from "@/features/schedules/components/CreateTrendsMailScheduleForm";
import { CoWorkerDetail } from "@/entities/coworkers/components/CoWorkerDetail";
import { EditCoworkerForm } from "@/features/coworkers/components/EditCoworkerForm";
import { CancelScheduleForm } from "@/features/schedules/components/CancelScheduleForm";
import { CreateSyncMetricsScheduleForm } from "@/features/schedules/components/CreateSyncMetricsScheduleForm";
import ABTestToolCard from "@/features/abtests/components/ABTestToolCard";
import ABTestCreateForm from "@/features/abtests/components/ABTestCreateForm";
import ABTestList from "@/entities/abtests/components/ABTestList";
import ABTestDetail from "@/entities/abtests/components/ABTestDetail";

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
    appendMessage({
      id,
      type: 'card',
      content: factory(id),
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
    removeMessagesByComponent(ScheduleToolCard); // Close the tool card on success
  }, [addTextMessage, removeMessage, removeMessagesByComponent]);

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

  const handleNewMailSchedule = useCallback(() => {
    removeMessagesByComponent(ScheduleToolCard);
    const messageId = getNextMessageId();
    appendMessage({
      id: messageId,
      type: 'card',
      content: (
        <CreateTrendsMailScheduleForm
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
    removeMessagesByComponent(ScheduleToolCard); // Close the tool card on success
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
    addCardMessage(() => (
      <ABTestList />
    ));
  }, [addCardMessage, removeMessagesByComponent]);

  const handleToolClick = useCallback((toolId: string) => {
    switch (toolId) {
      case 'campaigns':
        removeMessagesByComponent(CampaignToolCard);
        addCardMessage(() => (
          <CampaignToolCard
            onNew={handleNewCampaign}
            onSelect={handleSelectCampaign}
          />
        ));
        break;
      case 'draft':
        removeMessagesByComponent(DraftToolCard);
        addCardMessage(() => (
          <DraftToolCard
            onNew={handleNewDraft}
            onSelect={handleSelectDraft}
          />
        ));
        break;
      case 'personas':
        removeMessagesByComponent(PersonaToolCard);
        addCardMessage(() => (
          <PersonaToolCard
            onNew={handleNewPersona}
            onSelect={handleSelectPersona}
          />
        ));
        break;
      case 'accounts':
        removeMessagesByComponent(AccountToolCard);
        addCardMessage(() => (
          <AccountToolCard
            onNew={handleNewAccount}
            onSelect={handleSelectAccount}
            onSelectLinks={handleSelectPersonaForLinks}
          />
        ));
        break;
      case 'schedules':
        removeMessagesByComponent(ScheduleToolCard);
        addCardMessage(() => (
          <ScheduleToolCard
            onScheduleAction={(template) => {
              if (template.key.startsWith('mail.')) {
                handleNewMailSchedule();
              } else if (template.key.startsWith('post.')) {
                handleNewPostSchedule();
              } else if (template.key.startsWith('insights.')) {
                handleNewSyncMetricsSchedule();
              } else {
                console.log('Unknown template:', template.key);
              }
            }}
            onNewRawSchedule={handleNewRawSchedule}
            onCancel={handleCancelSchedule}
          />
        ));
        break;
      case 'coworker':
        removeMessagesByComponent(CoworkerToolCard);
        addCardMessage(() => (
          <CoworkerToolCard 
            onViewDetails={handleViewCoworkerDetails}
            onEdit={handleEditCoworker}
          />
        ));
        break;
      case 'ab-tests':
        removeMessagesByComponent(ABTestToolCard);
        addCardMessage(() => (
          <ABTestToolCard
            onNew={handleNewABTest}
            onSelect={handleSelectABTest}
          />
        ));
        break;
      default:
        break;
    }
  }, [addCardMessage, handleNewCampaign, handleNewDraft, handleNewPersona, handleSelectCampaign, handleSelectDraft, handleSelectPersona, handleNewAccount, handleSelectAccount, handleSelectPersonaForLinks, removeMessagesByComponent, handleNewPostSchedule, handleNewMailSchedule, handleNewRawSchedule, handleCancelSchedule, handleNewABTest, handleSelectABTest]);

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

      // Group cards by card_type and only render the last one for each type
      const cardsByType = new Map<string, ChatCard>();
      response.cards?.forEach(card => {
        cardsByType.set(card.card_type, card);
      });

      // Render only the last card for each card_type
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
            onCoworkerSelect: handleCoworkerSelect,
          },
        }));
      });
    } catch (error) {
      console.error('Chat error:', error);
      addTextMessage(t('chat.error_message'), 'bot');
    }
  }, [addCardMessage, addTextMessage, chatMutation, handleCampaignSelect, handleCardDelete, handleDraftSelect, handlePersonaSelect, handleAccountSelect, handleDraftVariantSelect, handleCoworkerSelect, t]);

  return {
    handleChatSend,
    addTrendQueryCard,
    clearChat,
    handleToolClick,
  };
}
