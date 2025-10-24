import React, { useState } from "react";
import { useBffReactiveListActionLogsApiBffReactiveActionLogsGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  Filter,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye
} from "lucide-react";
import { ReactionActionStatus, ReactionActionType } from "@/lib/api/generated";

interface ActionLogCardProps {
  onSelectLog?: (logId: number, sourceMessageId?: number) => void;
  sourceMessageId?: number;
}

export function ActionLogCard({ onSelectLog, sourceMessageId }: ActionLogCardProps) {
  console.log('ActionLogCard rendered with sourceMessageId:', sourceMessageId);
  const [statusFilter, setStatusFilter] = useState<ReactionActionStatus | "all">("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<ReactionActionType | "all">("all");
  const [tagKeyFilter, setTagKeyFilter] = useState<string>("");

  const params = {
    status: statusFilter === "all" ? undefined : statusFilter,
    action_type: actionTypeFilter === "all" ? undefined : actionTypeFilter,
    tag_key: tagKeyFilter || undefined,
    limit: 50,
  };

  const { data: response, isLoading, error, refetch } = useBffReactiveListActionLogsApiBffReactiveActionLogsGet(params);

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
        return <MessageSquare className="h-4 w-4" />;
      case "reply":
        return <MessageSquare className="h-4 w-4" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An error occurred while loading reactive action logs.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const logs = response?.items || [];
  const total = response?.total || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Reactive Action Logs
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Total {total} logs available.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 필터 */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionTypeFilter} onValueChange={(value: any) => setActionTypeFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="dm">DM</SelectItem>
              <SelectItem value="reply">Reply</SelectItem>
              <SelectItem value="alert">Alert</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="text"
            placeholder="Search tag key..."
            value={tagKeyFilter}
            onChange={(e) => setTagKeyFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm w-40"
          />

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* 로그 테이블 */}
        {logs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executed At</TableHead>
                  <TableHead>Rule ID</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      console.log('ActionLogCard: Row clicked', log.id, 'current sourceMessageId:', sourceMessageId);
                      if (sourceMessageId) {
                        console.log('ActionLogCard: Calling onSelectLog with valid sourceMessageId');
                        onSelectLog?.(log.id, sourceMessageId);
                      } else {
                        console.log('ActionLogCard: sourceMessageId is undefined, not calling onSelectLog');
                      }
                    }}
                  >
                    <TableCell>
                      {getActionTypeIcon(log.action_type)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.tag_key}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.executed_at ? formatDateTime(log.executed_at) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.reaction_rule_id || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          console.log('ActionLogCard: Button clicked', log.id, 'current sourceMessageId:', sourceMessageId);
                          if (sourceMessageId) {
                            console.log('ActionLogCard: Calling onSelectLog with valid sourceMessageId');
                            onSelectLog?.(log.id, sourceMessageId);
                          } else {
                            console.log('ActionLogCard: sourceMessageId is undefined, not calling onSelectLog');
                          }
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No logs match the current filters.</p>
          </div>
        )}

        {/* 페이지네이션 정보 */}
        {logs.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {logs.length} logs (total {total})
          </div>
        )}
      </CardContent>
    </Card>
  );
}
