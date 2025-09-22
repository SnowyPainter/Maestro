import React from 'react';
import { TimelineEvent } from '../model/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useBffDraftsReadVariantByIdApiBffDraftsVariantsVariantIdGet } from '@/lib/api/generated';
import { useChatMessagesContext } from '@/entities/messages/context/ChatMessagesContext';
import { DraftVariantDetail } from '@/entities/drafts/components/DraftVariantDetail';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

interface TimelinePostEventProps {
  event: TimelineEvent;
}

const PostEventDetails: React.FC<{ variantId: number }> = ({ variantId }) => {
  const { data, isLoading, isError } = useBffDraftsReadVariantByIdApiBffDraftsVariantsVariantIdGet(variantId, {
    query: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  });
  const { appendMessage } = useChatMessagesContext();

  const handleViewDetails = () => {
    appendMessage({
      id: Date.now(),
      type: 'card',
      content: <DraftVariantDetail variantData={data} />,
    });
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground p-2"><Loader2 className="h-3 w-3 animate-spin" /><span>Loading details...</span></div>;
  }

  if (isError || !data) {
    return <div className="flex items-center gap-2 text-xs text-destructive p-2"><AlertTriangle className="h-3 w-3" /><span>Could not load details.</span></div>;
  }

  return (
    <div className="mt-2 pt-2 border-t">
      {data.rendered_caption && (
        <p className="text-xs text-muted-foreground italic truncate mb-2">
          &quot;{data.rendered_caption}&quot;
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => handleViewDetails()}
      >
        View Full Details
        <ArrowRight className="h-3 w-3 ml-2" />
      </Button>
    </div>
  );
};

export const TimelinePostEvent: React.FC<TimelinePostEventProps> = ({ event }) => {
  if (event.source !== 'post_publication') return null;

  const { post_publication, phase } = event.payload;
  const variantId = post_publication?.variant_id;

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Post</span>
          <Badge variant={post_publication.status === 'scheduled' ? 'secondary' : 'default'}>
            {phase}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="space-y-1 text-xs">
            <p><strong>Platform:</strong> {post_publication.platform}</p>
            <p><strong>Status:</strong> {post_publication.status}</p>
            {post_publication.scheduled_at && (
            <p>
                <strong>Scheduled:</strong>
                {' '}
                {format(new Date(post_publication.scheduled_at), 'MMM d, p')}
            </p>
            )}
        </div>
        {post_publication.permalink && (
          <Button asChild variant="link" size="sm" className="p-0 h-auto mt-2">
            <a href={post_publication.permalink} target="_blank" rel="noopener noreferrer">
                View Published Post
            </a>
          </Button>
        )}
        {variantId && <PostEventDetails variantId={variantId} />}
      </CardContent>
    </Card>
  );
};