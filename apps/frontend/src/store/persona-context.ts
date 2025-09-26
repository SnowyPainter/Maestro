import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PersonaContextInput {
  personaAccountId: number;
  personaId: number;
  personaName: string;
  personaAvatarUrl?: string | null;
  accountId: number;
  accountHandle: string;
  accountPlatform?: string | null;
  accountAvatarUrl?: string | null;
}

interface PersonaContextState {
  personaAccountId: number | null;
  personaId: number | null;
  personaName: string | null;
  personaAvatarUrl: string | null;
  accountId: number | null;
  accountHandle: string | null;
  accountPlatform: string | null;
  accountAvatarUrl: string | null;
  draftId: number | null;
  draftEnabled: boolean;
  campaignId: number | null;
  campaignEnabled: boolean;
  userMemo: string | null;
  userMemoEnabled: boolean;
  setPersonaContext: (context: PersonaContextInput | null) => void;
  clearPersonaContext: () => void;
  setDraftContext: (draftId: number | null) => void;
  clearDraftContext: () => void;
  setDraftEnabled: (enabled: boolean) => void;
  setCampaignContext: (campaignId: number | null) => void;
  clearCampaignContext: () => void;
  setCampaignEnabled: (enabled: boolean) => void;
  setUserMemo: (memo: string | null) => void;
  clearUserMemo: () => void;
  setUserMemoEnabled: (enabled: boolean) => void;
}

const initialState = {
  personaAccountId: null,
  personaId: null,
  personaName: null,
  personaAvatarUrl: null,
  accountId: null,
  accountHandle: null,
  accountPlatform: null,
  accountAvatarUrl: null,
  draftId: null,
  draftEnabled: false,
  campaignId: null,
  campaignEnabled: false,
  userMemo: null,
  userMemoEnabled: false,
} satisfies Omit<
  PersonaContextState,
  |
    'setPersonaContext'
    | 'clearPersonaContext'
    | 'setDraftContext'
    | 'clearDraftContext'
    | 'setDraftEnabled'
    | 'setCampaignContext'
    | 'clearCampaignContext'
    | 'setCampaignEnabled'
    | 'setUserMemo'
    | 'clearUserMemo'
    | 'setUserMemoEnabled'
    | 'setActiveTool'
>;

export const usePersonaContextStore = create<PersonaContextState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setPersonaContext: (context) => {
        if (!context) {
          const state = get();
          const isAlreadyInitial = Object.entries(initialState).every(
            ([key, value]) => (state as unknown as Record<string, unknown>)[key] === value
          );
          if (isAlreadyInitial) return;
          set({ ...initialState });
          return;
        }

        const state = get();
        if (
          state.personaAccountId === context.personaAccountId &&
          state.personaId === context.personaId &&
          state.personaName === context.personaName &&
          state.personaAvatarUrl === (context.personaAvatarUrl ?? null) &&
          state.accountId === context.accountId &&
          state.accountHandle === context.accountHandle &&
          state.accountPlatform === (context.accountPlatform ?? null) &&
          state.accountAvatarUrl === (context.accountAvatarUrl ?? null)
        ) {
          return;
        }

        set({
          personaAccountId: context.personaAccountId,
          personaId: context.personaId,
          personaName: context.personaName,
          personaAvatarUrl: context.personaAvatarUrl ?? null,
          accountId: context.accountId,
          accountHandle: context.accountHandle,
          accountPlatform: context.accountPlatform ?? null,
          accountAvatarUrl: context.accountAvatarUrl ?? null,
        });
      },
      clearPersonaContext: () => {
        const state = get();
        if (
          state.personaAccountId === null &&
          state.personaId === null &&
          state.personaName === null
        ) {
          return;
        }
        set({ ...initialState });
      },
      setDraftContext: (draftId) => {
        const nextEnabled = draftId !== null;
        const state = get();
        if (state.draftId === draftId && state.draftEnabled === nextEnabled) {
          return;
        }
        set({
          draftId,
          draftEnabled: nextEnabled,
        });
      },
      clearDraftContext: () => {
        const state = get();
        if (state.draftId === null && !state.draftEnabled) {
          return;
        }
        set({
          draftId: null,
          draftEnabled: false,
        });
      },
      setDraftEnabled: (enabled) => {
        const state = get();
        const nextEnabled = enabled && state.draftId !== null;
        if (state.draftEnabled === nextEnabled) {
          return;
        }
        set({
          draftEnabled: nextEnabled,
        });
      },
      setCampaignContext: (campaignId) => {
        const nextEnabled = campaignId !== null;
        const state = get();
        if (state.campaignId === campaignId && state.campaignEnabled === nextEnabled) {
          return;
        }
        set({
          campaignId,
          campaignEnabled: nextEnabled,
        });
      },
      clearCampaignContext: () => {
        const state = get();
        if (state.campaignId === null && !state.campaignEnabled) {
          return;
        }
        set({
          campaignId: null,
          campaignEnabled: false,
        });
      },
      setCampaignEnabled: (enabled) => {
        const state = get();
        const nextEnabled = enabled && state.campaignId !== null;
        if (state.campaignEnabled === nextEnabled) {
          return;
        }
        set({
          campaignEnabled: nextEnabled,
        });
      },
      setUserMemo: (memo) => {
        const normalized = memo ?? null;
        const hasContent = Boolean(normalized?.trim());
        const state = get();
        if (state.userMemo === normalized && state.userMemoEnabled === hasContent) {
          return;
        }
        set({
          userMemo: normalized,
          userMemoEnabled: hasContent,
        });
      },
      clearUserMemo: () => {
        const state = get();
        if (state.userMemo === null && !state.userMemoEnabled) {
          return;
        }
        set({
          userMemo: null,
          userMemoEnabled: false,
        });
      },
      setUserMemoEnabled: (enabled) => {
        const state = get();
        const nextEnabled = enabled && Boolean(state.userMemo?.trim());
        if (state.userMemoEnabled === nextEnabled) {
          return;
        }
        set({
          userMemoEnabled: nextEnabled,
        });
      },
    }),
    {
      name: 'maestro-persona-context',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
