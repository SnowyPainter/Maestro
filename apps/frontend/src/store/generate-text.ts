import { create } from 'zustand';

function getElementTitle(element: HTMLElement): string {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label && label.textContent) {
      return label.textContent;
    }
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) {
      return element.placeholder;
    }
  }
  return "Generate Text with AI"; // Fallback title
}

type GenerateTextState = {
  isOpen: boolean;
  originalElement: HTMLInputElement | HTMLTextAreaElement | null;
  title: string;
  open: (element: HTMLInputElement | HTMLTextAreaElement) => void;
  close: () => void;
};

export const useGenerateTextStore = create<GenerateTextState>((set) => ({
  isOpen: false,
  originalElement: null,
  title: 'Generate Text',
  open: (element) => set({ 
    isOpen: true, 
    originalElement: element, 
    title: getElementTitle(element) 
  }),
  close: () => set({ isOpen: false, originalElement: null, title: 'Generate Text' }),
}));
