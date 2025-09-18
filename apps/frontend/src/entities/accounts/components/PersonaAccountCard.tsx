import { useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet, useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet, PersonaAccountOut, useAccountsLinkDeleteApiOrchestratorAccountsPersonaAccountLinksPersonaIdAccountIdDelete } from "@/lib/api/generated";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const { data: persona } = useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet(link.persona_id);
  const { data: account } = useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet(link.account_id);

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

  if (!persona || !account) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md relative group">
      <CardContent className="p-4 flex items-center justify-between">
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

        <Link2 className="w-6 h-6 text-muted-foreground" />

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
