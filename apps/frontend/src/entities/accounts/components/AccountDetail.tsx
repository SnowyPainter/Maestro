
import { useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet, useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet, PlatformKind, useAccountsPlatformDeleteApiOrchestratorAccountsPlatformAccountIdDelete } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, WifiOff, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PersonaBadge } from "@/entities/personas/components/PersonaBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { EditAccountForm } from "@/features/accounts/components/EditAccountForm";
import { useQueryClient } from "@tanstack/react-query";

interface AccountDetailProps {
  accountId: number;
  onDelete: () => void;
}

const platformColors: Record<PlatformKind, string> = {
  [PlatformKind.instagram]: "bg-pink-500",
  [PlatformKind.threads]: "bg-gray-800",
};

export function AccountDetail({ accountId, onDelete }: AccountDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: account, isLoading, isError, error, refetch } = useBffAccountsReadPlatformAccountApiBffAccountsPlatformAccountIdGet(accountId);
  const { data: personas } = useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet(accountId);

  const { mutate: deleteAccount } = useAccountsPlatformDeleteApiOrchestratorAccountsPlatformAccountIdDelete({
    mutation: {
      onSuccess: () => {
        onDelete();
      }
    }
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteAccount({ accountId });
    setIsDeleteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-grow space-y-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-md p-8">
        <WifiOff className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-destructive">Failed to load account details</h3>
        <p className="text-muted-foreground text-sm mt-2">{error?.detail?.[0]?.msg || "An unexpected error occurred."}</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-md p-8">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Account Not Found</h3>
        <p className="text-muted-foreground text-sm mt-2">The requested account could not be found.</p>
      </div>
    );
  }

  if (isEditing) {
    return <EditAccountForm account={account} onSuccess={() => { setIsEditing(false); refetch(); }} />
  }

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={account.avatar_url || ''} alt={account.handle} />
            <AvatarFallback>{account.handle.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-grow">
            <CardTitle>{account.handle}</CardTitle>
            <CardDescription>{account.bio || "No bio available."}</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${platformColors[account.platform]}`} />
            <span>{account.platform}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="font-semibold">Linked Personas</h4>
          {personas && personas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {personas.map(p => <PersonaBadge key={p.id} personaId={p.persona_id} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No personas linked to this account.</p>
          )}
        </div>
        <div className="border-t mt-4 pt-4 space-y-2">
            <p className="text-sm"><strong className="font-semibold">External ID:</strong> {account.external_id || 'N/A'}</p>
            <p className="text-sm"><strong className="font-semibold">Active:</strong> {account.is_active ? 'Yes' : 'No'}</p>
            <p className="text-sm"><strong className="font-semibold">Last Checked:</strong> {account.last_checked_at ? new Date(account.last_checked_at).toLocaleString() : 'Never'}</p>
        </div>
      </CardContent>
      <CardFooter className="border-t flex justify-end gap-2 px-6 py-4">
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this account? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
