
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SessionState {
  token: string | null;
  setToken: (token: string | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clearSession: () => set({ token: null }),
    }),
    {
      name: 'maestro-session',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
