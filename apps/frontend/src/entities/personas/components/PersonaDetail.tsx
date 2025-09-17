import { useState } from "react";
import { 
    useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet,
    useAccountsPersonaDeleteApiOrchestratorAccountsPersonasPersonaIdDelete,
    getBffAccountsListPersonasApiBffAccountsPersonasGetQueryKey,
} from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditPersonaForm } from "@/features/personas/components/EditPersonaForm";
import { useQueryClient } from "@tanstack/react-query";

export function PersonaDetail({ personaId, onDelete }: { personaId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { data: persona, isLoading, isError } = useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet(personaId);

  const { mutate: deletePersona, isPending: isDeleting } = useAccountsPersonaDeleteApiOrchestratorAccountsPersonasPersonaIdDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffAccountsListPersonasApiBffAccountsPersonasGetQueryKey() });
        onDelete();
      },
    }
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !persona) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load persona details.</p>
        </CardContent>
      </Card>
    );
  }

  const handleDelete = () => {
    deletePersona({ personaId });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={persona.avatar_url || ''} alt={persona.name} />
          <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <CardTitle>{persona.name}</CardTitle>
            <CardDescription>{persona.bio || "No bio."}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between">
            <span className="text-muted-foreground">Language:</span>
            <span>{persona.language}</span>
        </div>
        <div className="flex justify-between">
            <span className="text-muted-foreground">Tone:</span>
            <span>{persona.tone || 'Not set'}</span>
        </div>
        {persona.style_guide && <div><h4 className="font-semibold mb-1">Style Guide</h4><p className="text-muted-foreground bg-muted p-2 rounded-md">{persona.style_guide}</p></div>}
        {persona.pillars && persona.pillars.length > 0 && <div><h4 className="font-semibold mb-1">Pillars</h4><div className="flex flex-wrap gap-2">{persona.pillars.map(p => <Badge key={p}>{p}</Badge>)}</div></div>}
        {persona.banned_words && persona.banned_words.length > 0 && <div><h4 className="font-semibold mb-1">Banned Words</h4><div className="flex flex-wrap gap-2">{persona.banned_words.map(w => <Badge variant="destructive" key={w}>{w}</Badge>)}</div></div>}
        {persona.default_hashtags && persona.default_hashtags.length > 0 && <div><h4 className="font-semibold mb-1">Default Hashtags</h4><div className="flex flex-wrap gap-2">{persona.default_hashtags.map(h => <Badge variant="secondary" key={h}>{h}</Badge>)}</div></div>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Persona</DialogTitle>
                </DialogHeader>
                <EditPersonaForm persona={persona} onSuccess={() => setIsEditing(false)} />
            </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this persona.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}