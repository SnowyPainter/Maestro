import { CampaignSummaryCard } from "@/entities/campaigns/components/CampaignSummaryCard";
import { mockCampaignSummaries } from "./mock-data";

export function CampaignPanel() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockCampaignSummaries.map(campaign => (
                <CampaignSummaryCard key={campaign.id} campaign={campaign} />
            ))}
        </div>
    )
}