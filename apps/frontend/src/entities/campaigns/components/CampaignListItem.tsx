import {
  CampaignOut,
  campaignsAggregateKpisApiOrchestratorCampaignsCampaignIdAggregateKpisPost,
  useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet,
  CampaignKPIResultOut
} from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonaContextStore } from "@/store/persona-context";
import { ChevronRight, Calendar, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const formatDate = (dateString: string | null) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

function KpiProgress({ campaignId }: { campaignId: number }) {
  const { data: kpiDefs, isLoading: isLoadingDefs } = useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet(campaignId);
  
  const { data: aggregatedResult, isLoading: isLoadingAggregation } = useQuery<CampaignKPIResultOut>({
    queryKey: ['campaignAggregation', campaignId],
    queryFn: () => campaignsAggregateKpisApiOrchestratorCampaignsCampaignIdAggregateKpisPost(campaignId, {}),
    enabled: !!kpiDefs && kpiDefs.length > 0,
  });

  if (isLoadingDefs) {
    return <Skeleton className="h-5 w-full mt-2" />;
  }

  if (!kpiDefs || kpiDefs.length === 0) {
    return null; // No KPIs defined, so don't show anything.
  }

  if (isLoadingAggregation) {
    return <Skeleton className="h-5 w-full mt-2" />;
  }

  const totalWeight = kpiDefs.reduce((acc, def) => acc + (def.weight ?? 1), 0);

  if (totalWeight === 0) return null;

  const totalWeightedProgress = kpiDefs.reduce((acc, def) => {
    const weight = def.weight ?? 1;
    const currentValue = aggregatedResult?.values[def.key] ?? 0;
    const targetValue = def.target_value ?? 0;
    const progress = targetValue > 0 ? (currentValue / targetValue) : 0;
    return acc + (progress * weight);
  }, 0);

  const overallProgress = (totalWeightedProgress / totalWeight) * 100;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Overall Progress</span>
        <span>{Math.round(overallProgress)}%</span>
      </div>
      <Progress value={overallProgress} className="h-2" />
    </div>
  );
}


export function CampaignListItem({ campaign, onSelectCampaign }: { campaign: CampaignOut, onSelectCampaign: (campaignId: number) => void }) {
  const setCampaignContext = usePersonaContextStore((state) => state.setCampaignContext);

  return (
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
        <KpiProgress campaignId={campaign.id} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setCampaignContext(campaign.id);
        }}
      >
        <Zap className="h-3 w-3" />
      </Button>
    </button>
  );
}