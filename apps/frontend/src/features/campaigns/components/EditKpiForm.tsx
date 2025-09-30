import { useState, useEffect } from "react";
import { 
    useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet,
    useCampaignsUpsertKpiDefsApiOrchestratorCampaignsCampaignIdKpiDefsPut,
    getBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGetQueryKey,
    CampaignKPIDefUpsert,
    KPIKey,
    Aggregation,
} from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";


export function EditKpiForm({ campaignId, onSuccess }: { campaignId: number, onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const { data: existingDefs, isLoading } = useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet(campaignId);
  const [kpiDefs, setKpiDefs] = useState<Partial<CampaignKPIDefUpsert>[]>([]);

  useEffect(() => {
    if (existingDefs) {
      setKpiDefs(existingDefs);
    }
  }, [existingDefs]);

  const { mutate: upsertKpis, isPending } = useCampaignsUpsertKpiDefsApiOrchestratorCampaignsCampaignIdKpiDefsPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGetQueryKey(campaignId) });
        onSuccess();
      },
    }
  });

  const handleDefChange = (index: number, field: keyof CampaignKPIDefUpsert, value: string | number) => {
    const newDefs = [...kpiDefs];
    const def = { ...newDefs[index] };
    (def as any)[field] = value;
    newDefs[index] = def;
    setKpiDefs(newDefs);
  };

  const addKpiDef = () => {
    setKpiDefs([...kpiDefs, { key: KPIKey.link_clicks, aggregation: Aggregation.sum, target_value: 1000, weight: 1 }]);
  };

  const removeKpiDef = (index: number) => {
    setKpiDefs(kpiDefs.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertKpis({ campaignId, data: { defs: kpiDefs as CampaignKPIDefUpsert[] } });
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-1">
      <div className="space-y-3 max-h-96 overflow-y-auto p-1">
        {kpiDefs.map((def, index) => (
          <div key={index} className="flex items-end gap-2 p-2 border rounded-lg">
            <div className="grid gap-1.5 flex-1">
                <label className="text-xs">KPI</label>
                <Select value={def.key} onValueChange={(value) => handleDefChange(index, 'key', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select KPI" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 overflow-y-auto">
                        {Object.values(KPIKey).map(key => (
                            <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1.5 w-28">
                <label className="text-xs">Aggregation</label>
                <Select value={def.aggregation} onValueChange={(value) => handleDefChange(index, 'aggregation', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Agg" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(Aggregation).map(key => (
                            <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1.5 w-24">
                <label className="text-xs">Target</label>
                <Input
                    type="number"
                    placeholder="Target"
                    value={def.target_value ?? ''}
                    onChange={(e) => handleDefChange(index, 'target_value', parseInt(e.target.value, 10) || 0)}
                />
            </div>
            <div className="grid gap-1.5 w-20">
                <label className="text-xs">Weight</label>
                <Input
                    type="number"
                    placeholder="Weight"
                    value={def.weight ?? ''}
                    onChange={(e) => handleDefChange(index, 'weight', parseFloat(e.target.value) || 0)}
                />
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => removeKpiDef(index)} className="h-9 w-9 self-end">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" type="button" onClick={addKpiDef} className="mt-2">
        + Add KPI
      </Button>
      
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save KPIs"}
        </Button>
      </div>
    </form>
  );
}
