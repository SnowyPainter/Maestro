import { useEffect } from 'react';
import { useGenerateTextStore } from '@/store/generate-text';

export function useGenerateTextShortcut() {
  const { open } = useGenerateTextStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement
        ) {
          event.preventDefault();
          (window as any).isGeneratingText = true;
          open(activeElement as HTMLInputElement | HTMLTextAreaElement);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
}
