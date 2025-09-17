import { useState } from "react";
import { useBffCampaignsListCampaignsApiBffCampaignsGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";

export function CampaignList({ onSelectCampaign }: { onSelectCampaign: (campaignId: number) => void }) {
  const { data: campaigns, isLoading, isError } = useBffCampaignsListCampaignsApiBffCampaignsGet();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return <p className="p-2 text-sm text-destructive">Failed to load campaigns.</p>;
  }

  const visibleCampaigns = isExpanded ? campaigns : campaigns?.slice(0, 3);

  return (
    <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Select a Campaign</h3>
        <div className="flex flex-col gap-2">
            {visibleCampaigns?.map(campaign => (
                <button
                    key={campaign.id}
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 text-left group transition-colors"
                >
                    <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{campaign.name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                                #{campaign.id}
                            </Badge>
                        </div>
                        {campaign.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2 relative">
                                {campaign.description}
                                {campaign.description.length > 80 && (
                                    <span className="absolute right-0 bottom-0 w-8 h-4 bg-gradient-to-l from-background to-transparent"></span>
                                )}
                            </p>
                        )}
                        {(campaign.start_at || campaign.end_at) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>
                                    {formatDate(campaign.start_at || null)}
                                    {campaign.start_at && campaign.end_at && " ~ "}
                                    {formatDate(campaign.end_at || null)}
                                </span>
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
        {campaigns && campaigns.length > 3 && (
            <Button variant="link" onClick={() => setIsExpanded(!isExpanded)} className="mt-2">
                {isExpanded ? "Show Less" : `Show ${campaigns.length - 3} More`}
                {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
        )}
        {campaigns?.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">No campaigns found.</p>
        )}
    </div>
  );
}
