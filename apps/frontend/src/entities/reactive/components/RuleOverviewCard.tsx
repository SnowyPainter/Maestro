import React from "react";
import { useBffReactiveListRulesApiBffReactiveRulesGet } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Activity, Settings, AlertCircle, CheckCircle, XCircle, FileText } from "lucide-react";
import { ReactionRuleStatus } from "@/lib/api/generated";

interface RuleOverviewCardProps {
  onCreateRule?: () => void;
  onViewActivity?: () => void;
  onSelectRule?: (ruleId: number) => void;
  onManageTemplates?: () => void;
}

export function RuleOverviewCard({
  onCreateRule,
  onViewActivity,
  onSelectRule,
  onManageTemplates,
}: RuleOverviewCardProps) {
  const { data: response, isLoading, error } = useBffReactiveListRulesApiBffReactiveRulesGet();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Error Occurred
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
              An error occurred while loading reactive rules.
            </p>
        </CardContent>
      </Card>
    );
  }

  const rules = response?.rules || [];

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Reactive Rule Management
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Manage comment automation rules
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 통계 정보 */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{rules.length}</div>
            <div className="text-sm text-muted-foreground">Total Rules</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {rules.filter(rule => rule.status === "active").length}
            </div>
            <div className="text-sm text-muted-foreground">Active Rules</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {rules.filter(rule => rule.actions?.some(action => action.alert_enabled)).length}
            </div>
            <div className="text-sm text-muted-foreground">Alert Rules</div>
          </div>
        </div>

        {/* 룰 목록 */}
        {rules.length > 0 ? (
          <div className="space-y-2">
            {rules.slice(0, 5).map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onSelectRule?.(rule.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{rule.name}</h4>
                    {getStatusBadge(rule.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {rule.keywords?.length || 0} keywords • {rule.actions?.length || 0} actions
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Priority {rule.priority}
                </div>
              </div>
            ))}
            {rules.length > 5 && (
              <div className="text-center text-sm text-muted-foreground">
                +{rules.length - 5} more to view
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No reactive rules have been created yet.</p>
          </div>
        )}

        {/* 액션 버튼들 */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
          <Button
            variant="default"
            size="sm"
            onClick={onCreateRule}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onManageTemplates}
          >
            <FileText className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewActivity}
          >
            <Activity className="h-4 w-4 mr-1" />
            Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
