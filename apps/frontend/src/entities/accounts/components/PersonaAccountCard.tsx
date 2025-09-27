import { useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet, useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet, PersonaAccountOut, useAccountsLinkDeleteApiOrchestratorAccountsPersonaAccountLinksPersonaIdAccountIdDelete } from "@/lib/api/generated";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, X, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersonaContextStore } from "@/store/persona-context";
import { useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PersonaAccountCardProps {
  link: PersonaAccountOut;
  refetchLinks?: () => void;
}

export function PersonaAccountCard({ link, refetchLinks }: PersonaAccountCardProps) {
  const { data: persona } = useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet(link.persona_id);
  const { data: account } = useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet(link.account_id);

  const setPersonaContext = usePersonaContextStore(state => state.setPersonaContext);
  const activePersonaAccountId = usePersonaContextStore(state => state.personaAccountId);

  const { mutate: unlink } = useAccountsLinkDeleteApiOrchestratorAccountsPersonaAccountLinksPersonaIdAccountIdDelete({
    mutation: {
      onSuccess: () => {
        refetchLinks?.();
      }
    }
  });

  const handleUnlink = () => {
    unlink({ personaId: link.persona_id, accountId: link.account_id });
  };

  const handleInject = useCallback(() => {
    if (!persona || !account) return;

    setPersonaContext({
      personaAccountId: link.id,
      personaId: link.persona_id,
      personaName: persona.name,
      personaAvatarUrl: persona.avatar_url ?? null,
      accountId: link.account_id,
      accountHandle: account.handle,
      accountPlatform: account.platform,
      accountAvatarUrl: account.avatar_url ?? null,
    });
  }, [persona, account, setPersonaContext, link]);

  if (!persona || !account) {
    return <Skeleton className="h-24 w-full" />;
  }

  const isLinkActive = persona.is_active !== false && account.is_active !== false;
  const isActive = activePersonaAccountId === link.id;

  return (
    <Card className={cn(
      "rounded-2xl border bg-card text-card-foreground shadow-md relative group transition-shadow overflow-hidden",
      isActive && isLinkActive && "border-primary/70 shadow-lg",
      !isLinkActive && "border-amber-500/50 bg-amber-500/5"
    )}>
      {!isLinkActive && (
        <div className="p-2 text-xs text-amber-900 bg-amber-400/80 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <p className="font-medium">This link is inactive because the persona or account has been archived.</p>
        </div>
      )}
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={persona.avatar_url || ''} />
            <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{persona.name}</p>
            <p className="text-sm text-muted-foreground">Persona</p>
          </div>
        </div>

        <Link2 className="w-6 h-6 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-3 text-right">
          <div className="text-right">
            <p className="font-semibold">{account.handle}</p>
            <p className="text-sm text-muted-foreground">@{account.platform}</p>
          </div>
          <Avatar className="w-10 h-10">
            <AvatarImage src={account.avatar_url || ''} />
            <AvatarFallback>{account.handle.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Persona Account ID: <span className="font-mono text-foreground">{link.id}</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && isLinkActive && <Badge variant="secondary">Active</Badge>}
          <button
            onClick={handleInject}
            disabled={isActive || !isLinkActive}
            className={`p-2 rounded-md transition-colors ${
              isActive && isLinkActive
                ? 'bg-emerald-500 text-white cursor-not-allowed opacity-75'
                : 'hover:bg-muted/50 cursor-pointer'
            } ${!isLinkActive && 'cursor-not-allowed opacity-50'}`}
          >
            <Zap className={`h-4 w-4 ${
              isActive && isLinkActive
                ? 'text-white'
                : 'text-emerald-500'
            }  ${!isLinkActive && 'text-muted-foreground'}`} />
          </button>
        </div>
      </CardFooter>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink the persona "{persona.name}" from the account "@{account.handle}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}