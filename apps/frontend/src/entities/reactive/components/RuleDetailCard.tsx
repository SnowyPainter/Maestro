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
  Edit,
  Tag,
  Zap
} from "lucide-react";
import { ReactionRuleStatus, ReactionActionType } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { useContextRegistryStore } from "@/store/chat-context-registry";

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
  const { registerEmission } = useContextRegistryStore();

  const { data: rule, isLoading: ruleLoading, error: ruleError } = useBffReactiveReadRuleApiBffReactiveRulesRuleIdGet(ruleId);
  const { data: links, isLoading: linksLoading } = useBffReactiveListRuleLinksApiBffReactiveRulesRuleIdPublicationsGet(ruleId);

  // Fetch all publications to get details for linked ones
  const publicationsQuery = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

  // Register template IDs in context registry
  React.useEffect(() => {
    if (rule?.actions) {
      rule.actions.forEach(action => {
        if (action.dm_template_id) {
          registerEmission('template_id', {
            value: action.dm_template_id.toString(),
            label: `DM ${action.dm_template_id}`,
            icon: 'BookTemplate',
            meta: { template_id: action.dm_template_id, template_type: 'dm', tag_key: action.tag_key }
          });
        }
        if (action.reply_template_id) {
          registerEmission('template_id', {
            value: action.reply_template_id.toString(),
            label: `Reply ${action.reply_template_id}`,
            icon: 'BookTemplate',
            meta: { template_id: action.reply_template_id, template_type: 'reply', tag_key: action.tag_key }
          });
        }
      });
    }
  }, [rule, registerEmission]);

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

  const getActionTypes = (action: any) => {
    const types = [];
    if (action.dm_template_id) types.push("dm");
    if (action.reply_template_id) types.push("reply");
    if (action.alert_enabled) types.push("alert");
    return types;
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case "dm":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "reply":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getActionTypeLabel = (actionType: string) => {
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
        {/* Neural Network Visualization */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Rule Logic Flow
          </h3>
          {rule.keywords && rule.keywords.length > 0 ? (
            <div className="relative">
              {/* Keywords -> Tags -> Actions Flow */}
              <div className="grid grid-cols-3 gap-6">
                {/* Keywords Column */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Keywords ({rule.keywords.length})
                  </h4>
                  <div className="space-y-2">
                    {rule.keywords.map((keyword, index) => (
                      <div
                        key={keyword.id}
                        className="relative p-2 bg-blue-50 border border-blue-200 rounded-md text-xs"
                      >
                        <div className="font-medium text-blue-900">{keyword.keyword}</div>
                        <div className="text-blue-700 mt-1">
                          {keyword.match_type} • {keyword.language || 'any'}
                        </div>
                        {/* Connection arrow to tags */}
                        <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-0.5 bg-blue-300"></div>
                        <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-300 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags Column */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Tag className="h-3 w-3" />
                    Tags
                  </h4>
                  <div className="space-y-2">
                    {Array.from(new Set((rule.keywords || []).map(k => k.tag_key).filter(Boolean))).map((tagKey) => {
                      const keywordCount = (rule.keywords || []).filter(k => k.tag_key === tagKey).length;
                      const actionCount = (rule.actions || []).filter(a => a.tag_key === tagKey).length;

                      return (
                        <div
                          key={tagKey}
                          className="relative p-3 bg-green-50 border border-green-200 rounded-md text-center"
                        >
                          <div className="font-medium text-green-900">{tagKey}</div>
                          <div className="text-xs text-green-700 mt-1">
                            {keywordCount} keywords → {actionCount} actions
                          </div>
                          {/* Connection arrow to actions */}
                          <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-0.5 bg-green-300"></div>
                          <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-green-300 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions Column */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    Actions ({rule.actions?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {rule.actions && rule.actions.map((action) => {
                      const actionTypes = getActionTypes(action);
                      return (
                        <div
                          key={action.id}
                          className="p-2 bg-orange-50 border border-orange-200 rounded-md text-xs"
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {actionTypes.map((type, idx) => (
                              <React.Fragment key={type}>
                                {idx > 0 && <span className="text-orange-400 mx-1">+</span>}
                                {getActionTypeIcon(type)}
                                <span className="font-medium text-orange-900">{getActionTypeLabel(type)}</span>
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="text-orange-700">Tag: {action.tag_key}</div>
                          {action.dm_template_id && (
                            <div className="text-orange-600">DM Template: {action.dm_template_id}</div>
                          )}
                          {action.reply_template_id && (
                            <div className="text-orange-600">Reply Template: {action.reply_template_id}</div>
                          )}
                          {action.alert_enabled && (
                            <div className="text-orange-600">Alert: {action.alert_severity}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-600">
                  <strong>Flow:</strong> Keywords trigger tags, which execute corresponding actions automatically
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No keywords configured.</p>
            </div>
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
