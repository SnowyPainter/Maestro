import { useState, useEffect } from "react";
import { InsightCommentOut, InsightCommentList } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useContextRegistryStore } from "@/store/chat-context-registry";
import { usePersonaContextStore } from "@/store/persona-context";
import { ExternalLink, MessageSquare, User, Clock, Calendar, Hash, Link as LinkIcon } from "lucide-react";

interface CommentListProps {
  data: InsightCommentList;
  onSelectComment?: (commentId: number) => void;
}

const CommentList = ({ data, onSelectComment }: CommentListProps) => {
  const [selectedComment, setSelectedComment] = useState<number | null>(null);
  const [selectedCommentDetail, setSelectedCommentDetail] = useState<InsightCommentOut | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);
  const { personaAccountId } = usePersonaContextStore();

  // ingested_at 기준으로 내림차순 정렬 (최신순)
  const sortedComments = [...data.comments].sort((a, b) =>
    new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime()
  );

  // Register comments in context registry
  useEffect(() => {
    if (sortedComments) {
      sortedComments.forEach((comment) => {
        // Register comment_id
        registerEmission('comment_id', {
          value: comment.id.toString(),
          label: comment.text?.substring(0, 20) + "..." || `Comment #${comment.id}`,
        });

        // Register post_publication_id if exists
        if (comment.post_publication_id) {
          registerEmission('post_publication_id', {
            value: comment.post_publication_id.toString(),
            label: `Publication #${comment.post_publication_id}`,
          });
        }

        // Register account_persona_id if exists
        if (comment.account_persona_id) {
          registerEmission('account_persona_id', {
            value: comment.account_persona_id.toString(),
            label: `${comment.platform} Account`,
          });
        }
      });
    }
  }, [sortedComments, registerEmission]);

  const handleSelectComment = (comment: InsightCommentOut) => {
    setSelectedComment(comment.id);
    setSelectedCommentDetail(comment);
    setIsDialogOpen(true);
    onSelectComment?.(comment.id);
  };

  const formatIngestedTime = (ingestedAt: string) => {
    const now = new Date();
    const ingested = new Date(ingestedAt);
    const diffInMinutes = Math.floor((now.getTime() - ingested.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return ingested.toLocaleDateString();
  };

  const formatLocalTime = (utcTime: string | null | undefined) => {
    if (!utcTime) return "Unknown";
    const date = new Date(utcTime);
    return date.toLocaleString();
  };

  return (
    <>
      <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments
        </CardTitle>
        <Badge variant="outline" className="text-sm">
          {data.total} comments
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No comments found</h3>
            <p className="text-muted-foreground text-center">
              There are no comments to display.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedComments.map((comment) => {
              const isOwnedByMe = comment.is_owned_by_me;

              return (
                <div
                  key={comment.id}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedComment === comment.id
                      ? "bg-primary/5 border-primary/20"
                      : "bg-card hover:bg-muted/30 border-border"
                  }`}
                  onClick={() => handleSelectComment(comment)}
                >
                  <div className="flex items-start gap-3">
                    {/* Author Avatar */}
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className={`text-xs ${
                        isOwnedByMe ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        {isOwnedByMe ? "Me" : <User className="w-3 h-3" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      {/* Comment Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          {isOwnedByMe ? "Me" : (comment.author_username || "Anonymous")}
                        </span>
                        {isOwnedByMe && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            My comment
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {comment.platform}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="w-3 h-3" />
                          {formatIngestedTime(comment.ingested_at)}
                        </div>
                      </div>

                      {/* Comment Content */}
                      <div className="text-sm text-foreground leading-relaxed">
                        {comment.text || "No content"}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {comment.permalink && (
                            <a
                              href={comment.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors text-xs flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View on platform
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Comment Detail Dialog */}
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {selectedCommentDetail && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comment Details
              </DialogTitle>
              <DialogDescription>
                Detailed information about the selected comment
              </DialogDescription>
            </DialogHeader>

            <div className={`space-y-6 ${selectedCommentDetail.is_owned_by_me ? 'opacity-75' : ''}`}>
              {/* Header Section */}
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarFallback className={`text-sm ${
                    selectedCommentDetail.is_owned_by_me
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {selectedCommentDetail.is_owned_by_me ? "Me" : <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-base">
                      {selectedCommentDetail.is_owned_by_me
                        ? "Me"
                        : (selectedCommentDetail.author_username || "Anonymous")}
                    </span>
                    {selectedCommentDetail.is_owned_by_me && (
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                        My comment
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize ml-auto">
                      {selectedCommentDetail.platform}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      <span>ID: {selectedCommentDetail.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Created: {formatLocalTime(selectedCommentDetail.comment_created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Ingested: {formatLocalTime(selectedCommentDetail.ingested_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment Content */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Content
                </h4>
                <div className={`p-4 rounded-lg border ${
                  selectedCommentDetail.is_owned_by_me
                    ? 'bg-muted/30 border-muted-foreground/20'
                    : 'bg-card'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedCommentDetail.text || "No content"}
                  </p>
                </div>
              </div>

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCommentDetail.post_publication_id && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Post Publication
                    </h4>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <Hash className="w-4 h-4" />
                      <span className="text-sm">ID: {selectedCommentDetail.post_publication_id}</span>
                    </div>
                  </div>
                )}

                {selectedCommentDetail.account_persona_id && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Account Persona
                    </h4>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <User className="w-4 h-4" />
                      <span className="text-sm">ID: {selectedCommentDetail.account_persona_id}</span>
                    </div>
                  </div>
                )}

                {selectedCommentDetail.comment_external_id && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      External ID
                    </h4>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <LinkIcon className="w-4 h-4" />
                      <span className="text-sm truncate">{selectedCommentDetail.comment_external_id}</span>
                    </div>
                  </div>
                )}

                {selectedCommentDetail.permalink && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Permalink
                    </h4>
                    <a
                      href={selectedCommentDetail.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded hover:bg-muted transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="truncate">View on platform</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Metrics */}
              {selectedCommentDetail.metrics && Object.keys(selectedCommentDetail.metrics).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Metrics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(selectedCommentDetail.metrics).map(([key, value]) => (
                      <div key={key} className="p-3 bg-muted/50 rounded text-center">
                        <div className="text-lg font-semibold">{value}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {key.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default CommentList;
