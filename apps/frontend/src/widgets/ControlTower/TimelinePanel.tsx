import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventTimeline } from "./EventTimeline";
import { mockTimelineEvents } from "./mock-data";

export function TimelinePanel() {
    return (
        <div className="w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Timeline View</CardTitle>
                    <CardDescription>A chronological view of all events, drafts, and publications.</CardDescription>
                </CardHeader>
                <CardContent>
                    <EventTimeline events={mockTimelineEvents} />
                </CardContent>
            </Card>
        </div>
    )
}