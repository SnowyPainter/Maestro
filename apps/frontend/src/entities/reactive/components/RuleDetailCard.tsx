import React from "react";
import { useBffReactiveReadRuleApiBffReactiveRulesRuleIdGet, useBffReactiveListRuleLinksApiBffReactiveRulesRuleIdPublicationsGet, useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Hash,
  MessageSquare,
  AlertTriangle,
  Link,
  Calendar,
  XCircle,
  CheckCircle,
  Eye,
  Edit
} from "lucide-react";
import { ReactionRuleStatus, ReactionActionType } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";

interface RuleDetailCardProps {
  ruleId: number;
  onRequestLinker?: (ruleId: number) => void;
  onEditRule?: (ruleId: number) => void;
}

export function RuleDetailCard({
  ruleId,
  onRequestLinker,
  onEditRule,
}: RuleDetailCardProps) {
  const { personaAccountId } = usePersonaContextStore();

  const { data: rule, isLoading: ruleLoading, error: ruleError } = useBffReactiveReadRuleApiBffReactiveRulesRuleIdGet(ruleId);
  const { data: links, isLoading: linksLoading } = useBffReactiveListRuleLinksApiBffReactiveRulesRuleIdPublicationsGet(ruleId);

  // Fetch all publications to get details for linked ones
  const publicationsQuery = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

  React.useEffect(() => {
    if (personaAccountId && links && links.length > 0) {
      publicationsQuery.mutate({
        data: {
          account_persona_id: personaAccountId,
        },
      });
    }
  }, [personaAccountId, links]);

  const publications = publicationsQuery.data || [];

  if (ruleLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (ruleError || !rule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Rule not found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The requested reactive rule cannot be found.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: ReactionRuleStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionType = (action: any) => {
    if (action.dm_template_id) return "dm";
    if (action.reply_template_id) return "reply";
    return "alert";
  };

  const getActionTypeIcon = (action: any) => {
    const actionType = getActionType(action);
    switch (actionType) {
      case "dm":
        return <MessageSquare className="h-4 w-4" />;
      case "reply":
        return <MessageSquare className="h-4 w-4" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getActionTypeLabel = (action: any) => {
    const actionType = getActionType(action);
    switch (actionType) {
      case "dm":
        return "DM";
      case "reply":
        return "Reply";
      case "alert":
        return "Alert";
      default:
        return actionType;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {rule.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge(rule.status)}
              <Badge variant="outline">Priority {rule.priority}</Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditRule?.(ruleId)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
        {rule.description && (
          <p className="text-sm text-muted-foreground mt-2">{rule.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 키워드 섹션 */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Keywords ({rule.keywords?.length || 0})
          </h3>
          {rule.keywords && rule.keywords.length > 0 ? (
            <div className="space-y-2">
              {rule.keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{keyword.keyword}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <span>Tag: {keyword.tag_key}</span>
                      <span>•</span>
                      <span>{keyword.match_type}</span>
                      {keyword.language && (
                        <>
                          <span>•</span>
                          <span>{keyword.language}</span>
                        </>
                      )}
                      {keyword.is_active ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Priority {keyword.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No keywords configured.</p>
          )}
        </div>

        <Separator />

        {/* 액션 섹션 */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Actions ({rule.actions?.length || 0})
          </h3>
          {rule.actions && rule.actions.length > 0 ? (
            <div className="space-y-2">
              {rule.actions.map((action) => (
                <div
                  key={action.id}
                  className="p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getActionTypeIcon(action)}
                    <span className="font-medium text-sm">{getActionTypeLabel(action)}</span>
                    <Badge variant="outline" className="text-xs">
                      {action.tag_key}
                    </Badge>
                    {action.alert_enabled && (
                      <Badge variant="destructive" className="text-xs">
                        Alert Enabled
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {action.dm_template_id && (
                      <div>DM Template ID: {action.dm_template_id}</div>
                    )}
                    {action.reply_template_id && (
                      <div>Reply Template ID: {action.reply_template_id}</div>
                    )}
                    {action.alert_severity && (
                      <div>Alert Severity: {action.alert_severity}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No actions configured.</p>
          )}
        </div>

        <Separator />

        {/* 게시물 연결 섹션 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Link className="h-4 w-4" />
              Linked Publications ({links?.length || 0})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestLinker?.(ruleId)}
            >
              <Link className="h-4 w-4 mr-2" />
              Link Publication
            </Button>
          </div>
          {linksLoading || publicationsQuery.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : links && links.length > 0 ? (
            <div className="space-y-2">
              {links.map((link) => {
                const publication = publications.find(pub => pub.id === link.post_publication_id);
                return (
                  <div
                    key={link.id}
                    className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {publication ? publication.variant_content?.substring(0, 70) + "..." || `Publication ${publication.id}` : `Publication ID: ${link.post_publication_id}`}
                      </div>
                      {publication && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {publication.platform}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {publication.status}
                          </Badge>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span>Priority: {link.priority}</span>
                        {link.active_from && (
                          <>
                            <span>•</span>
                            <Calendar className="h-3 w-3" />
                            <span>From {new Date(link.active_from).toLocaleDateString()}</span>
                          </>
                        )}
                        {link.active_until && (
                          <>
                            <span>•</span>
                            <span>To {new Date(link.active_until).toLocaleDateString()}</span>
                          </>
                        )}
                        {link.is_active ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No linked publications.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onRequestLinker?.(ruleId)}
              >
                Link Publication
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* 메타 정보 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Created: {new Date(rule.created_at).toLocaleString()}</div>
          <div>Updated: {new Date(rule.updated_at).toLocaleString()}</div>
          <div>Rule ID: {rule.id}</div>
        </div>
      </CardContent>
    </Card>
  );
}
