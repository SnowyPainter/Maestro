import { useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet, useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet, PersonaAccountOut, useAccountsLinkDeleteApiOrchestratorAccountsPersonaAccountLinksPersonaIdAccountIdDelete } from "@/lib/api/generated";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersonaContextStore } from "@/store/persona-context";
import { useState } from "react";
import { toast } from "sonner";
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
        toast.success("Successfully unlinked persona from account");
      },
      onError: (error: any) => {
        const errorMessage = error?.data?.detail || "Failed to unlink persona from account";
        toast.error(errorMessage);
      }
    }
  });

  const handleUnlink = () => {
    unlink({ personaId: link.persona_id, accountId: link.account_id });
  };


  if (!persona || !account) {
    return <Skeleton className="h-16 w-full" />;
  }

  const isLinkActive = persona.is_active !== false && account.is_active !== false;
  const isActive = activePersonaAccountId === link.id;

  return (
    <Card className={cn(
      "rounded-xl border bg-card text-card-foreground shadow-sm relative group transition-all duration-200 hover:shadow-md overflow-hidden",
      isActive && isLinkActive && "border-primary/60 shadow-md ring-1 ring-primary/20",
      !isLinkActive && "border-amber-500/40 bg-amber-500/5"
    )}>
      {!isLinkActive && (
        <div className="px-3 py-2 text-xs text-amber-800 bg-amber-400/60 flex items-center gap-2 border-b border-amber-400/30">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <p className="font-medium leading-tight">Inactive link</p>
        </div>
      )}
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={persona.avatar_url || ''} />
            <AvatarFallback className="text-xs">{persona.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{persona.name}</p>
            <p className="text-xs text-muted-foreground">Persona</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link2 className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
          <div className="text-right min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{account.handle}</p>
            <p className="text-xs text-muted-foreground">@{account.platform}</p>
          </div>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={account.avatar_url || ''} />
            <AvatarFallback className="text-xs">{account.handle.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
      <div className="px-3 pb-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-mono">
          ID: {link.id}
        </div>
        <div className="flex items-center gap-2">
          {isActive && isLinkActive && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 h-5">
              Active
            </Badge>
          )}
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
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