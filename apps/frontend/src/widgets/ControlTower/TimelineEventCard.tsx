import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Send, Bot, Pencil } from 'lucide-react';
import { TimelineEvent } from './mock-data';
import { platformPresentation } from '@/entities/drafts/draftVariant';
import { cn } from '@/lib/utils';

const getEventMeta = (event: TimelineEvent) => {
    switch (event.type) {
        case 'DRAFT_CREATED':
            return { icon: FileText, title: 'Draft Created', color: 'bg-sky-500' };
        case 'DRAFT_UPDATED':
            return { icon: Pencil, title: 'Draft Updated', color: 'bg-gray-400' };
        case 'VARIANT_COMPILED':
            return { icon: Bot, title: 'Variant Compiled', color: 'bg-purple-500' };
        case 'SCHEDULED':
            return { icon: Calendar, title: 'Post Scheduled', color: 'bg-amber-500' };
        case 'PUBLISHED':
            return { icon: Send, title: 'Post Published', color: 'bg-green-500' };
        default:
            return { icon: FileText, title: 'Event', color: 'bg-gray-500' };
    }
};

export function TimelineEventCard({ event }: { event: TimelineEvent }) {
    const meta = getEventMeta(event);
    const Icon = meta.icon;
    const platformMeta = event.platform ? platformPresentation[event.platform] : null;

    return (
        <div className="relative">
            {/* The dot on the timeline */}
            <div className={cn("absolute -left-[34px] top-1 h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-background", meta.color)}>
                <Icon className="h-4 w-4 text-white" />
            </div>

            <div className="pl-4">
                <div className="text-sm text-muted-foreground mb-2">{new Date(event.date).toLocaleString()}</div>
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base mb-1">{event.title}</CardTitle>
                                <CardDescription>{meta.title}</CardDescription>
                            </div>
                            {platformMeta && (
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", platformMeta.badgeClass)}>
                                    {platformMeta.label}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                {event.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                            </div>
                            {event.author && <span className="text-xs text-muted-foreground">by {event.author}</span>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
