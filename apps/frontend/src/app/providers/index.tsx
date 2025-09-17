
import { ThemeProvider } from "./theme";
import { QueryProvider } from "./query";
import { I18nProvider } from "./i18n";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <I18nProvider>
          {children}
          <Toaster />
        </I18nProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
