import { useState, useEffect } from "react";
import { useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost } from "@/lib/api/generated";
import { EnrichedPostPublicationOut, PlatformKind, PostStatus, DraftPostPublicationsEnrichedPayload } from "@/lib/api/generated";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonaContextStore } from "@/store/persona-context";
import { useContextRegistryStore } from "@/store/chat-context-registry";
import { toast } from "sonner";
import { ExternalLink, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";

interface PostPublicationListProps {
  onSelectPublication?: (publicationId: number) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case PostStatus.published:
      return "bg-green-500";
    case PostStatus.scheduled:
      return "bg-blue-500";
    case PostStatus.pending:
      return "bg-yellow-500";
    case PostStatus.failed:
      return "bg-red-500";
    case PostStatus.deleted:
      return "bg-gray-500";
    default:
      return "bg-gray-400";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case PostStatus.published:
      return <CheckCircle className="w-4 h-4" />;
    case PostStatus.scheduled:
      return <Calendar className="w-4 h-4" />;
    case PostStatus.failed:
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const PostPublicationList = ({ onSelectPublication }: PostPublicationListProps) => {
  const { personaAccountId } = usePersonaContextStore();
  const [selectedPublication, setSelectedPublication] = useState<number | null>(null);
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  const canQuery = !!personaAccountId;

  const { mutate, data, isPending: isLoading, error } = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

  useEffect(() => {
    if (canQuery) {
      mutate({
        data: {
          account_persona_id: personaAccountId,
        } as DraftPostPublicationsEnrichedPayload
      });
    }
  }, [canQuery, personaAccountId, mutate]);

  const publications = data || [];

  // Register publications in context registry
  useEffect(() => {
    if (publications) {
      publications.forEach((pub) => {
        // Register publication_id
        registerEmission('post_publication_id', {
          value: pub.id.toString(),
          label: pub.title || pub.variant_content?.substring(0, 10) + "..." || `Publication #${pub.id}`,
        });

        // Register variant_id
        registerEmission('variant_id', {
          value: pub.variant_id.toString(),
          label: pub.title || pub.variant_content || `Variant #${pub.variant_id}`,
        });

        // Register account_persona_id
        registerEmission('account_persona_id', {
          value: pub.account_persona_id.toString(),
          label: `${pub.platform} Account`,
        });
      });
    }
  }, [publications, registerEmission]);

  const handleSelectPublication = (publication: EnrichedPostPublicationOut) => {
    setSelectedPublication(publication.id);
    onSelectPublication?.(publication.id);
  };

  const handleRefresh = () => {
    if (canQuery) {
      mutate({
        data: {
          account_persona_id: personaAccountId,
        } as DraftPostPublicationsEnrichedPayload
      });
    }
  };

  if (!canQuery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post Publications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Please select a persona to view post publications.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post Publications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post Publications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-destructive text-center mb-4">
              Failed to load post publications.
            </p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl">Post Publications</CardTitle>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="max-w-6xl">
        {publications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No publications found</h3>
            <p className="text-muted-foreground text-center">
              You haven't created any post publications yet.
            </p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="w-16 h-12">ID</TableHead>
                  <TableHead className="h-12">Title</TableHead>
                  <TableHead className="w-24 h-12">Status</TableHead>
                  <TableHead className="w-20 h-12">Platform</TableHead>
                  <TableHead className="w-32 h-12">Timing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publications.map((pub) => (
                  <TableRow
                    key={pub.id}
                    className={`h-14 transition-colors ${
                      selectedPublication === pub.id
                        ? "bg-muted"
                        : "hover:bg-muted/30"
                    }`}
                  >
                  <TableCell className="font-medium text-sm">#{pub.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-xs">
                      <button
                        onClick={() => handleSelectPublication(pub)}
                        className="text-left hover:text-primary transition-colors truncate font-medium flex-1"
                        title={pub.title || "Untitled"}
                      >
                        {pub.title || "Untitled"}
                      </button>
                      {pub.permalink && (
                        <a
                          href={pub.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title="View on platform"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(pub.status)}`}
                    >
                      {getStatusIcon(pub.status)}
                      {pub.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {pub.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {pub.published_at ? (
                      <div>
                        <div className="text-green-600 font-medium">Published</div>
                        <div className="text-muted-foreground">
                          {new Date(pub.published_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : pub.scheduled_at ? (
                      <div>
                        <div className="text-blue-600 font-medium">Scheduled</div>
                        <div className="text-muted-foreground">
                          {new Date(pub.scheduled_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostPublicationList;