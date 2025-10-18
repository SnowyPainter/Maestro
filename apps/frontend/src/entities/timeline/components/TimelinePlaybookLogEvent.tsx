import type { TimelineEvent } from '@/entities/timeline/model/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TimelinePlaybookLogEventProps {
  event: TimelineEvent;
}

/**
 * Renders a timeline event related to a playbook log.
 */
export function TimelinePlaybookLogEvent({ event }: TimelinePlaybookLogEventProps) {
  if (event.source !== 'playbook') {
    return null;
  }

  const { timestamp, status, payload } = event;
  const { playbook_log } = payload;

  const title = `Playbook: ${playbook_log.event}`;
  let message = playbook_log.message || `Event finished with status: ${status}`;

  // Create more descriptive messages based on the event type
  if (playbook_log.event === 'schedule.created' && playbook_log.meta?.template) {
    message = `Created schedule for template: ${playbook_log.meta.template}`;
  } else if (playbook_log.event === 'post.published' && playbook_log.meta?.permalink) {
    message = `Post published successfully.`;
  } else if (playbook_log.event === 'sync.metrics' && playbook_log.meta?.comment_errors) {
    message = `Metrics sync failed: ${playbook_log.meta.comment_errors[0]}`;
  } else if (playbook_log.event === 'sync.metrics') {
    message = 'Metrics synced successfully.';
  }

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-8 w-8 border">
        <AvatarFallback className="bg-transparent">
          {/* FileText Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{formattedTime}</p>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {playbook_log.event === 'post.published' && playbook_log.meta?.permalink && (
          <a href={playbook_log.meta.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
            View Post
          </a>
        )}
      </div>
    </div>
  );
}
