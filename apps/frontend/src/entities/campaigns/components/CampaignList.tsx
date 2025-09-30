import { useState, useEffect } from "react";
import { useBffCampaignsListCampaignsApiBffCampaignsGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useContextRegistryStore } from "@/store/chat-context-registry";
import { CampaignListItem } from "./CampaignListItem";

export function CampaignList({ onSelectCampaign }: { onSelectCampaign: (campaignId: number) => void }) {
  const { data: campaigns, isLoading, isError } = useBffCampaignsListCampaignsApiBffCampaignsGet();
  const [isExpanded, setIsExpanded] = useState(false);
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  // Register campaigns in context registry
  useEffect(() => {
    if (campaigns) {
      campaigns.forEach((campaign) => {
        registerEmission('campaign_id', {
          value: campaign.id.toString(),
          label: campaign.name,
        });
      });
    }
  }, [campaigns, registerEmission]);

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
                <CampaignListItem 
                    key={campaign.id}
                    campaign={campaign}
                    onSelectCampaign={onSelectCampaign}
                />
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
