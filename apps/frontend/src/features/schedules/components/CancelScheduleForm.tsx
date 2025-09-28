import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useActionScheduleCancelSchedulesApiOrchestratorActionsSchedulesCancelPost, useBffScheduleListSchedulesApiBffSchedulesGet, ScheduleStatus } from "@/lib/api/generated";
import { toast } from "sonner";
import { ScheduleList } from "@/entities/schedules/components/ScheduleList";

export function CancelScheduleForm({ onCancelled }: { onCancelled: () => void }) {
  const [filters, setFilters] = useState({ query: '', personaId: '', metaKey: '', metaValue: '', status: 'pending' as ScheduleStatus });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: scheduleData, isLoading } = useBffScheduleListSchedulesApiBffSchedulesGet({
    status: filters.status,
    limit: 500,
  }, {
    query: { placeholderData: (previousData) => previousData, }
  });

  const cancelSchedules = useActionScheduleCancelSchedulesApiOrchestratorActionsSchedulesCancelPost({
    mutation: {
      onSuccess: () => {
        toast.success(`${selectedIds.length} schedule(s) cancelled successfully.`);
        onCancelled();
        setSelectedIds([]);
      },
      onError: (error: any) => {
        toast.error("Failed to cancel schedules.", { description: error.detail?.[0]?.msg || error.message });
      },
    },
  });

  const filteredSchedules = useMemo(() => {
    if (!scheduleData?.items) return [];
    return scheduleData.items.filter(item => {
      const personaMatch = filters.personaId ? item.persona_account_id === Number(filters.personaId) : true;
      const queryMatch = filters.query ? (item.meta?.label?.toLowerCase().includes(filters.query.toLowerCase()) || String(item.id).includes(filters.query)) : true;
      const metaMatch = filters.metaKey && filters.metaValue ? String((item.meta as any)?.[filters.metaKey])?.toLowerCase().includes(filters.metaValue.toLowerCase()) : true;
      return personaMatch && queryMatch && metaMatch;
    });
  }, [scheduleData, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }
  
  const handleStatusChange = (status: ScheduleStatus) => {
    if (status) {
        setFilters(prev => ({ ...prev, status }));
        setSelectedIds([]);
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSchedules.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSchedules.map(item => item.id));
    }
  }

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    cancelSchedules.mutate({ data: { schedule_ids: selectedIds } });
  }

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-3xl">
      <CardHeader className="p-6">
        <CardTitle>Cancel Schedules</CardTitle>
        <CardDescription>Select schedules to cancel. Use the filters to narrow down your search.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 grid gap-4">
        <div className="flex items-center gap-4">
            <Label>Status</Label>
            <ToggleGroup type="single" value={filters.status} onValueChange={handleStatusChange} defaultValue="pending">
                <ToggleGroupItem value="pending">Pending</ToggleGroupItem>
                <ToggleGroupItem value="enqueued">Enqueued</ToggleGroupItem>
                <ToggleGroupItem value="running">Running</ToggleGroupItem>
            </ToggleGroup>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Input name="query" placeholder="Search by label or ID..." value={filters.query} onChange={handleFilterChange} />
            <Input name="personaId" placeholder="Filter by Persona Account ID..." value={filters.personaId} onChange={handleFilterChange} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Input name="metaKey" placeholder="Filter by meta key..." value={filters.metaKey} onChange={handleFilterChange} />
            <Input name="metaValue" placeholder="...with meta value..." value={filters.metaValue} onChange={handleFilterChange} />
        </div>
        <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
                <Checkbox id="select-all" onCheckedChange={toggleSelectAll} checked={filteredSchedules.length > 0 && selectedIds.length === filteredSchedules.length} />
                <Label htmlFor="select-all">Select All ({filteredSchedules.length})</Label>
            </div>
            <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
        </div>
        <ScheduleList 
            items={filteredSchedules}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            isLoading={isLoading}
        />
      </CardContent>
      <CardFooter className="px-6 py-4 border-t flex justify-end gap-3">
        <Button type="button" variant="destructive" disabled={selectedIds.length === 0 || cancelSchedules.isPending} onClick={handleSubmit}>
          {cancelSchedules.isPending ? "Cancelling..." : `Cancel ${selectedIds.length} Schedule(s)`}
        </Button>
      </CardFooter>
    </Card>
  );
}