import { useState } from "react";
import { useBffCampaignsListCampaignsApiBffCampaignsGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CampaignList({ onSelectCampaign }: { onSelectCampaign: (campaignId: number) => void }) {
  const { data: campaigns, isLoading, isError } = useBffCampaignsListCampaignsApiBffCampaignsGet();
  const [isExpanded, setIsExpanded] = useState(false);

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
        <div className="flex flex-col gap-1">
            {visibleCampaigns?.map(campaign => (
                <button 
                    key={campaign.id} 
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-sm text-left"
                >
                    <ChevronRight className="w-4 h-4" />
                    <span>{campaign.name}</span>
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
