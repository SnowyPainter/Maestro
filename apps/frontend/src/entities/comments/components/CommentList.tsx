import { useState, useEffect } from "react";
import { InsightCommentOut, InsightCommentList } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useContextRegistryStore } from "@/store/chat-context-registry";
import { usePersonaContextStore } from "@/store/persona-context";
import { ExternalLink, MessageSquare, User, Clock } from "lucide-react";

interface CommentListProps {
  data: InsightCommentList;
  onSelectComment?: (commentId: number) => void;
}

const CommentList = ({ data, onSelectComment }: CommentListProps) => {
  const [selectedComment, setSelectedComment] = useState<number | null>(null);
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

  return (
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
  );
};

export default CommentList;
