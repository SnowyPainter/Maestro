import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// A simple SVG sparkline placeholder
const Sparkline = () => (
    <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M 0 20 L 10 25 L 20 15 L 30 22 L 40 18 L 50 28 L 60 20 L 70 15 L 80 25 L 90 30 L 100 20" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
    </svg>
);

export function CampaignSummaryCard({ campaign }: { campaign: any }) {
    const statusVariant = campaign.isActive ? "secondary" : "outline";
    
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <Badge variant={statusVariant}>
                        {campaign.isActive ? "Active" : "Finished"}
                    </Badge>
                </div>
                <CardDescription>{campaign.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="h-20 w-full">
                    <Sparkline />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Impressions</p>
                        <p className="font-semibold text-lg">{campaign.kpis.impressions.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Engagement</p>
                        <p className="font-semibold text-lg">{campaign.kpis.engagement}%</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
