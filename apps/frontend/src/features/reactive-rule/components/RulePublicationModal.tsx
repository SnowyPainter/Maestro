import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Link } from "lucide-react";
import { ReactionRulePublicationCommand, useReactiveLinkRulePublicationApiOrchestratorReactiveRulesRuleIdPublicationsPost, useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost, useBffReactiveListRuleLinksApiBffReactiveRulesRuleIdPublicationsGet, useReactiveUnlinkRulePublicationApiOrchestratorReactivePublicationsLinkIdDelete } from "@/lib/api/generated";
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
  const [selectedPublicationIds, setSelectedPublicationIds] = useState<number[]>([]);

  const { personaAccountId } = usePersonaContextStore();

  const createLinkMutation = useReactiveLinkRulePublicationApiOrchestratorReactiveRulesRuleIdPublicationsPost();
  const unlinkMutation = useReactiveUnlinkRulePublicationApiOrchestratorReactivePublicationsLinkIdDelete();

  // Fetch existing links for this rule
  const { data: existingLinks, isLoading: linksLoading } = useBffReactiveListRuleLinksApiBffReactiveRulesRuleIdPublicationsGet(ruleId);

  // Fetch publication list
  const publicationsMutation = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

  useEffect(() => {
    if (personaAccountId && !publications.length && !isLoadingPublications) {
      publicationsMutation.mutate({
        data: {
          account_persona_id: personaAccountId,
        },
      });
    }
  }, [personaAccountId]);

  const publications = publicationsMutation.data || [];
  const isLoadingPublications = publicationsMutation.isPending;

  // Get IDs of already linked publications
  const linkedPublicationIds = existingLinks?.map((link: any) => link.post_publication_id) || [];

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
      rule_id: ruleId,
      priority: 100,
      active_from: null,
      active_until: null,
      is_active: true,
    },
  });


  const onSubmit = async (data: Omit<ReactionRulePublicationCommand, 'post_publication_id'>) => {
    if (selectedPublicationIds.length === 0) {
      toast.error("Please select publications to modify");
      return;
    }

    try {
      const linkPromises = [];
      const unlinkPromises = [];

      // 선택된 publication들 처리
      for (const publicationId of selectedPublicationIds) {
        const isCurrentlyLinked = linkedPublicationIds.includes(publicationId);

        if (isCurrentlyLinked) {
          // 이미 연결된 것은 unlink
          const link = existingLinks?.find(link => link.post_publication_id === publicationId);
          if (link) {
            unlinkPromises.push(
              unlinkMutation.mutateAsync({
                linkId: link.id,
              })
            );
          }
        } else {
          // 연결되지 않은 것은 link
          linkPromises.push(
            createLinkMutation.mutateAsync({
              ruleId,
              data: {
                ...data,
                post_publication_id: publicationId,
                active_from: data.active_from || null,
                active_until: data.active_until || null,
              },
            })
          );
        }
      }

      // 모든 API 호출 실행
      const allPromises = [...linkPromises, ...unlinkPromises];
      await Promise.all(allPromises);

      const linkedCount = linkPromises.length;
      const unlinkedCount = unlinkPromises.length;

      let message = "";
      if (linkedCount > 0 && unlinkedCount > 0) {
        message = `Linked ${linkedCount}, unlinked ${unlinkedCount} publication(s)`;
      } else if (linkedCount > 0) {
        message = `Successfully linked ${linkedCount} publication(s)`;
      } else if (unlinkedCount > 0) {
        message = `Successfully unlinked ${unlinkedCount} publication(s)`;
      }

      toast.success(message);
      onOpenChange(false);
      reset();
      setSelectedPublicationIds([]);
      setSearchTerm("");
    } catch (error) {
      toast.error("Failed to modify publication links");
    }
  };

  const handlePublicationSelect = (publicationId: number) => {
    setSelectedPublicationIds(prev => {
      if (prev.includes(publicationId)) {
        // 이미 선택된 경우 제거
        return prev.filter(id => id !== publicationId);
      } else {
        // 선택되지 않은 경우 추가
        return [...prev, publicationId];
      }
    });
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
            {selectedPublicationIds.length > 0 && (
              <div className="flex gap-2 ml-2">
                {selectedPublicationIds.filter(id => !linkedPublicationIds.includes(id)).length > 0 && (
                  <Badge variant="default" className="text-xs">
                    {selectedPublicationIds.filter(id => !linkedPublicationIds.includes(id)).length} to link
                  </Badge>
                )}
                {selectedPublicationIds.filter(id => linkedPublicationIds.includes(id)).length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {selectedPublicationIds.filter(id => linkedPublicationIds.includes(id)).length} to unlink
                  </Badge>
                )}
              </div>
            )}
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
              <div className="p-2 space-y-2 max-w-sm mx-auto">
                {isLoadingPublications || linksLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading publications...
                  </div>
                ) : filteredPublications.length > 0 ? (
                  filteredPublications.map((pub) => {
                    const isLinked = linkedPublicationIds.includes(pub.id);
                    const isSelected = selectedPublicationIds.includes(pub.id);

                    return (
                      <Card
                        key={pub.id}
                        className={cn(
                          "cursor-pointer transition-colors max-w-sm w-full",
                          isLinked && !isSelected && "bg-gray-50 border-gray-200",
                          !isLinked && "hover:bg-muted/50",
                          isSelected && isLinked && "ring-2 ring-red-500 bg-red-50",
                          isSelected && !isLinked && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={() => handlePublicationSelect(pub.id)}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className={cn(
                                  "font-medium text-sm block overflow-hidden text-ellipsis whitespace-nowrap w-full",
                                  isLinked && !isSelected && "text-gray-500"
                                )}>
                                  {pub.variant_content || `Publication ${pub.id}`}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isLinked && !isSelected && (
                                  <Badge variant="secondary" className="text-xs">
                                    Linked
                                  </Badge>
                                )}
                                {isSelected && isLinked && (
                                  <Badge variant="destructive" className="text-xs">
                                    Will Unlink
                                  </Badge>
                                )}
                                {isSelected && !isLinked && (
                                  <Badge variant="default" className="text-xs">
                                    Will Link
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {pub.platform}
                              </Badge>
                              {getStatusBadge(pub.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
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
                  <Switch
                    id="is_active"
                    checked={watch("is_active") ?? true}
                    onCheckedChange={(checked: boolean) => setValue("is_active", checked)}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="active_from">Active Start Date</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="active_from"
                    type="date"
                    {...register("active_from")}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setValue("active_from", today);
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="active_until">End Date</Label>
                <Input
                  id="active_until"
                  type="date"
                  {...register("active_until")}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={(createLinkMutation.isPending || unlinkMutation.isPending) || selectedPublicationIds.length === 0}
            >
              {(createLinkMutation.isPending || unlinkMutation.isPending)
                ? "Processing..."
                : "Apply Changes"
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
