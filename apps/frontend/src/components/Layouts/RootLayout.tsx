
import { Outlet } from 'react-router-dom';
import { GenerateTextDialog } from '@/features/generate-text/components/GenerateTextDialog';
import { useGenerateTextShortcut } from '@/features/generate-text/hooks/useGenerateTextShortcut';

export function RootLayout() {
  useGenerateTextShortcut();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <Outlet />
      </main>
      <GenerateTextDialog />
    </div>
  );
}
