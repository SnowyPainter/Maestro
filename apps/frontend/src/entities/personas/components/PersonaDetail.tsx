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
import { components } from "@/lib/types/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Persona = components["schemas"]["PersonaOut"];

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 items-start gap-1 text-sm md:grid-cols-3 md:gap-2">
    <span className="text-muted-foreground font-medium">{label}</span>
    <div className="md:col-span-2">
      {children === null || children === undefined || (Array.isArray(children) && children.length === 0) ? (
        <span className="text-muted-foreground">Not set</span>
      ) : (
        children
      )}
    </div>
  </div>
);

const renderValue = (value: any) => {
    if (typeof value === 'boolean') {
        return <Badge variant={value ? 'default' : 'outline'}>{value ? 'Yes' : 'No'}</Badge>;
    }
    if (typeof value === 'string' && value) {
        return <span>{value}</span>;
    }
    if (typeof value === 'number') {
        return <span>{value}</span>;
    }
    return null;
};

const PersonaDetailView = ({ persona }: { persona: Persona }) => {
    const hashtagRules = persona.hashtag_rules as Record<string, any> | undefined;
    const linkPolicy = persona.link_policy as Record<string, any> | undefined;
    const utm = linkPolicy?.utm as Record<string, string> | undefined;
    const inlineLinkPolicy = linkPolicy?.inline_link as { strategy?: string; replacement_text?: string } | undefined;
    const mediaPrefs = persona.media_prefs as Record<string, any> | undefined;
    const postingWindows = persona.posting_windows as { dow: string; start: string; end: string }[] | undefined;
    const replaceMap = (persona.extras as Record<string, any> | undefined)?.replace_map as Record<string, string> | undefined;

    return (
        <CardContent className="text-sm">
            <Accordion type="multiple" defaultValue={['Core Identity', 'Content Strategy']} className="w-full">
                <AccordionItem value="Core Identity">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Core Identity</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Language">{renderValue(persona.language)}</DetailItem>
                        <DetailItem label="Tone">{renderValue(persona.tone)}</DetailItem>
                        <DetailItem label="Schema Version">{renderValue(persona.schema_version)}</DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Content Strategy">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Content Strategy</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Style Guide">
                            {persona.style_guide ? <p className="text-muted-foreground bg-muted p-3 rounded-lg">{persona.style_guide}</p> : null}
                        </DetailItem>
                        <DetailItem label="Content Pillars">
                            {persona.pillars && persona.pillars.length > 0 && <div className="flex flex-wrap gap-2">{persona.pillars.map(p => <Badge key={p}>{p}</Badge>)}</div>}
                        </DetailItem>
                        <DetailItem label="Banned Words">
                            {persona.banned_words && persona.banned_words.length > 0 && <div className="flex flex-wrap gap-2">{persona.banned_words.map(w => <Badge variant="destructive" key={w}>{w}</Badge>)}</div>}
                        </DetailItem>
                        <DetailItem label="Default Hashtags">
                            {persona.default_hashtags && persona.default_hashtags.length > 0 && <div className="flex flex-wrap gap-2">{persona.default_hashtags.map(h => <Badge variant="secondary" key={h}>{h}</Badge>)}</div>}
                        </DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Hashtag Rules">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Hashtag Rules</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Max Count">{renderValue(hashtagRules?.max_count)}</DetailItem>
                        <DetailItem label="Casing">{renderValue(hashtagRules?.casing)}</DetailItem>
                        <DetailItem label="Pinned Hashtags">
                            {hashtagRules?.pinned && hashtagRules.pinned.length > 0 && <div className="flex flex-wrap gap-2">{hashtagRules.pinned.map((p: string) => <Badge key={p}>{p}</Badge>)}</div>}
                        </DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Link Policy">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Link Policy</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Link in Bio">{renderValue(linkPolicy?.link_in_bio)}</DetailItem>
                        <DetailItem label="Inline Link Strategy">
                            {inlineLinkPolicy?.strategy ? <Badge variant="outline">{inlineLinkPolicy.strategy}</Badge> : null}
                        </DetailItem>
                        {inlineLinkPolicy?.strategy === 'replace' && (
                            <DetailItem label="Replacement Text">{renderValue(inlineLinkPolicy?.replacement_text)}</DetailItem>
                        )}
                        <DetailItem label="UTM Parameters">
                            {utm && Object.keys(utm).length > 0 ? (
                                <div className="space-y-2 rounded-md border p-2">
                                    {Object.entries(utm).map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-2 text-xs">
                                            <span className="font-mono bg-muted px-2 py-1 rounded">{key}</span>
                                            <span className="truncate">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Media Preferences">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Media Preferences</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Preferred Ratio">{renderValue(mediaPrefs?.preferred_ratio)}</DetailItem>
                        <DetailItem label="Allow Carousel">{renderValue(mediaPrefs?.allow_carousel)}</DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Posting Windows">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Posting Windows</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Scheduled Times">
                            {postingWindows && postingWindows.length > 0 ? (
                                <div className="space-y-2">
                                    {postingWindows.map((w, i) => (
                                        <div key={i} className="flex gap-2 items-center text-xs">
                                            <Badge className="w-12 justify-center">{w.dow}</Badge>
                                            <span className="font-mono">{w.start} → {w.end}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </DetailItem>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Advanced">
                    <AccordionTrigger className="py-2 text-sm font-semibold">Advanced</AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                        <DetailItem label="Replace Map">
                            {replaceMap && Object.keys(replaceMap).length > 0 ? (
                                <div className="space-y-2 rounded-md border p-2">
                                    {Object.entries(replaceMap).map(([key, value]) => (
                                        <div key={key} className="grid grid-cols-2 items-center gap-2 text-xs">
                                            <span className="font-mono bg-muted px-2 py-1 rounded truncate">{key}</span>
                                            <span className="truncate">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </DetailItem>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
    );
};


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
    return <Skeleton className="h-[40rem] w-full" />;
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
        <Avatar className="w-12 h-12 border">
          <AvatarImage src={persona.avatar_url || ''} alt={persona.name} />
          <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <CardTitle className="text-lg">{persona.name}</CardTitle>
            <CardDescription className="text-sm mt-1">{persona.bio || "No bio."}</CardDescription>
        </div>
      </CardHeader>
      <PersonaDetailView persona={persona as Persona} />
      <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-4">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Persona: {persona.name}</DialogTitle>
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