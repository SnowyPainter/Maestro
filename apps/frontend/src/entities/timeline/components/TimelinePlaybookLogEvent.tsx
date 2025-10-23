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
  const { playbook_log, summary, meta, identifiers } = payload;

  const resolvedSummary = summary || playbook_log.summary;
  const title =
    resolvedSummary?.title ||
    `Playbook: ${playbook_log.event}`;

  const message =
    resolvedSummary?.message ||
    playbook_log.message ||
    `Event finished with status: ${status}`;

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
        {resolvedSummary?.highlights && resolvedSummary.highlights.length > 0 && (
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {resolvedSummary.highlights.map((item: { label: string; value: string }) => (
              <div key={`${item.label}-${item.value}`} className="flex justify-between gap-2">
                <span className="font-medium">{item.label}</span>
                <span className="text-right truncate">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        {identifiers && Object.keys(identifiers).length > 0 && (
          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <p className="uppercase tracking-wide font-semibold">Identifiers</p>
            {Object.entries(identifiers).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-right truncate">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
        {meta?.permalink && typeof meta.permalink === 'string' && (
          <a
            href={meta.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline mt-2 inline-block"
          >
            View Post
          </a>
        )}
      </div>
    </div>
  );
}
