import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Link } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ReactionRulePublicationCommand, useReactiveLinkRulePublicationApiOrchestratorReactiveRulesRuleIdPublicationsPost, useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RulePublicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: number;
  ruleName: string;
}

export function RulePublicationModal({
  open,
  onOpenChange,
  ruleId,
  ruleName,
}: RulePublicationModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPublicationId, setSelectedPublicationId] = useState<number | null>(null);

  const { personaAccountId } = usePersonaContextStore();

  const createLinkMutation = useReactiveLinkRulePublicationApiOrchestratorReactiveRulesRuleIdPublicationsPost();

  // Fetch publication list
  const publicationsMutation = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

  useEffect(() => {
    if (personaAccountId) {
      publicationsMutation.mutate({
        data: {
          account_persona_id: personaAccountId,
        },
      });
    }
  }, [personaAccountId, publicationsMutation]);

  const publications = publicationsMutation.data || [];
  const isLoadingPublications = publicationsMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReactionRulePublicationCommand>({
    defaultValues: {
      post_publication_id: 0,
      priority: 100,
      active_from: null,
      active_until: null,
      is_active: true,
    },
  });

  const activeFrom = watch("active_from");
  const activeUntil = watch("active_until");

  const onSubmit = async (data: ReactionRulePublicationCommand) => {
    try {
      await createLinkMutation.mutateAsync({
        ruleId,
        data: {
          ...data,
          active_from: data.active_from || null,
          active_until: data.active_until || null,
        },
      });
      toast.success("Successfully linked publication");
      onOpenChange(false);
      reset();
      setSelectedPublicationId(null);
      setSearchTerm("");
    } catch (error) {
      toast.error("Failed to link publication");
    }
  };

  const handlePublicationSelect = (publicationId: number) => {
    setSelectedPublicationId(publicationId);
    setValue("post_publication_id", publicationId);
  };

  // Filter publications by search term
  const filteredPublications = publications.filter(pub =>
    pub.variant_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pub.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Publication - {ruleName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Publication Search and Selection */}
          <div className="space-y-4">
            <div>
              <Label>Search Publication</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search publication by title or platform..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <div className="p-2 space-y-2">
                {isLoadingPublications ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading publications...
                  </div>
                ) : filteredPublications.length > 0 ? (
                  filteredPublications.map((pub) => (
                    <Card
                      key={pub.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        selectedPublicationId === pub.id && "ring-2 ring-primary"
                      )}
                      onClick={() => handlePublicationSelect(pub.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">
                              {pub.variant_content || `Publication ${pub.id}`}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {pub.platform}
                              </Badge>
                              {getStatusBadge(pub.status)}
                            </div>
                          </div>
                          {selectedPublicationId === pub.id && (
                            <div className="text-primary font-medium text-sm">Selected</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No search results." : "No publications found."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Link Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Link Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min={0}
                  max={100}
                  {...register("priority", { valueAsNumber: true })}
                />
                {errors.priority && (
                  <p className="text-sm text-destructive mt-1">{String(errors.priority)}</p>
                )}
              </div>
              <div>
                <Label>Active Status</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    {...register("is_active")}
                    className="rounded"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Active Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !activeFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {activeFrom ? (
                        format(activeFrom, "yyyy-MM-dd")
                      ) : (
                        "Select Date"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={activeFrom ? new Date(activeFrom) : undefined}
                      onSelect={(date) => setValue("active_from", date?.toISOString() || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !activeUntil && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {activeUntil ? (
                        format(activeUntil, "yyyy-MM-dd")
                      ) : (
                        "Select Date"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={activeUntil ? new Date(activeUntil) : undefined}
                      onSelect={(date) => setValue("active_until", date?.toISOString() || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLinkMutation.isPending || !selectedPublicationId}
            >
              {createLinkMutation.isPending ? "Linking..." : "Link Publication"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
