import React from "react";
import { useBffReactiveReadActionLogApiBffReactiveActionLogsActionLogIdGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Activity,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Tag,
  Calendar
} from "lucide-react";
import { ReactionActionStatus, ReactionActionType } from "@/lib/api/generated";

interface ActionLogDetailCardProps {
  actionLogId: number;
  onBack?: () => void;
}

export function ActionLogDetailCard({ actionLogId, onBack }: ActionLogDetailCardProps) {
  const { data: actionLog, isLoading, error, refetch } = useBffReactiveReadActionLogApiBffReactiveActionLogsActionLogIdGet(actionLogId);

  const getStatusBadge = (status: ReactionActionStatus) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "skipped":
        return <Badge variant="outline">Skipped</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionTypeIcon = (actionType: ReactionActionType) => {
    switch (actionType) {
      case "dm":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "reply":
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getActionTypeLabel = (actionType: ReactionActionType) => {
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
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

  if (error || !actionLog) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Action Log Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The requested action log cannot be found or an error occurred.
            </p>
            <div className="flex gap-2">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              {getActionTypeIcon(actionLog.action_type)}
              Action Log #{actionLog.id}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge(actionLog.status)}
              <Badge variant="outline" className="flex items-center gap-1">
                {getActionTypeIcon(actionLog.action_type)}
                {getActionTypeLabel(actionLog.action_type)}
              </Badge>
            </div>
          </div>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium text-gray-700">Tag Key:</span>
            <div className="flex items-center gap-2 mt-1">
              <Tag className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{actionLog.tag_key}</span>
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Insight Comment ID:</span>
            <span className="text-sm text-gray-600 ml-2">{actionLog.insight_comment_id}</span>
          </div>
          {actionLog.reaction_rule_id && (
            <div>
              <span className="font-medium text-gray-700">Rule ID:</span>
              <span className="text-sm text-gray-600 ml-2">{actionLog.reaction_rule_id}</span>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Executed At:</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm">
                {actionLog.executed_at ? formatDateTime(actionLog.executed_at) : 'Not executed'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payload Data */}
        {actionLog.payload && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Action Payload</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(actionLog.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error Information */}
        {actionLog.error && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Error Details
              </h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <pre className="text-sm text-red-800 whitespace-pre-wrap">
                  {actionLog.error}
                </pre>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>Created: {formatDateTime(actionLog.created_at)}</span>
          </div>
          {actionLog.executed_at && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3" />
              <span>Executed: {formatDateTime(actionLog.executed_at)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
