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
  setPersonaContext: (context: PersonaContextInput | null) => void;
  clearPersonaContext: () => void;
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
} satisfies Omit<PersonaContextState, 'setPersonaContext' | 'clearPersonaContext'>;

export const usePersonaContextStore = create<PersonaContextState>()(
  persist(
    (set) => ({
      ...initialState,
      setPersonaContext: (context) => {
        if (!context) {
          set(() => ({ ...initialState }));
          return;
        }

        set(() => ({
          personaAccountId: context.personaAccountId,
          personaId: context.personaId,
          personaName: context.personaName,
          personaAvatarUrl: context.personaAvatarUrl ?? null,
          accountId: context.accountId,
          accountHandle: context.accountHandle,
          accountPlatform: context.accountPlatform ?? null,
          accountAvatarUrl: context.accountAvatarUrl ?? null,
        }));
      },
      clearPersonaContext: () => set(() => ({ ...initialState })),
    }),
    {
      name: 'maestro-persona-context',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
