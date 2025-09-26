import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { 
  useActionCoworkerUpdateMyCoworkerApiOrchestratorActionsSchedulesCoworkerLeasePost,
  CoworkerLeaseState,
  CoworkerLeaseUpdatePayload as formSchemaType,
  useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet,
  RichPersonaAccountOut
} from "@/lib/api/generated";
import { toast } from "sonner";

interface EditCoworkerFormProps {
  lease: CoworkerLeaseState;
  onSuccess: (data: any) => void;
}

function PersonaAccountSelectItem({ account, onSelect }: { account: RichPersonaAccountOut, onSelect: () => void }) {
  return (
    <div 
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
      onClick={onSelect}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={account.persona_avatar_url || undefined} alt={account.persona_name} />
        <AvatarFallback>{account.persona_name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-grow">
        <p className="font-semibold text-sm">{account.persona_name}</p>
        <p className="text-xs text-muted-foreground">{account.account_handle} on {account.account_platform}</p>
      </div>
    </div>
  )
}

export function EditCoworkerForm({ lease, onSuccess }: EditCoworkerFormProps) {
  const [active, setActive] = useState(lease.active);
  const [interval, setInterval] = useState(lease.interval_seconds || 60);
  const [selectedIds, setSelectedIds] = useState<number[]>(lease.persona_account_ids);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allAccounts, isLoading: isLoadingAccounts } = useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet();

  const updateLease = useActionCoworkerUpdateMyCoworkerApiOrchestratorActionsSchedulesCoworkerLeasePost();

  const selectedAccounts = useMemo(() => {
    return allAccounts?.filter(acc => selectedIds.includes(acc.id)) || [];
  }, [allAccounts, selectedIds]);

  const availableAccounts = useMemo(() => {
    if (!allAccounts) return [];
    const lowerCaseQuery = searchQuery.toLowerCase();
    return allAccounts.filter(acc => 
      !selectedIds.includes(acc.id) &&
      (acc.persona_name.toLowerCase().includes(lowerCaseQuery) || 
       acc.account_handle.toLowerCase().includes(lowerCaseQuery))
    );
  }, [allAccounts, selectedIds, searchQuery]);

  const addAccountId = (id: number) => {
    if (!selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const removeAccountId = (id: number) => {
    setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
  };

  const addAllAccounts = () => {
    if (!allAccounts) return;
    setSelectedIds(allAccounts.map(acc => acc.id));
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const payload: formSchemaType = {
        active,
        interval_seconds: Number(interval),
        persona_account_ids: selectedIds,
    };

    try {
      const result = await updateLease.mutateAsync({ data: payload });
      toast.success("CoWorker lease updated successfully.");
      onSuccess(result);
    } catch (error: any) {
      toast.error("Failed to update lease.", {
        description: error.detail?.[0]?.msg || error.message,
      });
    }
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Edit CoWorker Settings</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 grid gap-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="active-switch" className="text-base">CoWorker Active</Label>
            <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="interval">Polling Interval (seconds)</Label>
            <Input id="interval" type="number" value={interval} onChange={e => setInterval(Number(e.target.value))} min={5} />
          </div>
          
          <div className="grid gap-4">
            <Label>Monitored Persona Accounts</Label>
            <div className="p-2 border rounded-xl min-h-[40px] flex flex-wrap gap-2">
              {selectedAccounts.map(acc => (
                <Badge key={acc.id} variant="secondary" className="flex items-center gap-1.5">
                  {acc.persona_name} ({acc.account_handle})
                  <button type="button" onClick={() => removeAccountId(acc.id)} className="rounded-full hover:bg-background/50">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedAccounts.length === 0 && <span className="text-sm text-muted-foreground px-2">No accounts selected.</span>}
            </div>
            
            <div className="flex gap-2">
                <Input 
                    placeholder="Search accounts..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addAllAccounts} disabled={isLoadingAccounts}>
                    Add All
                </Button>
            </div>

            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2">
                {isLoadingAccounts && <p className="text-muted-foreground text-sm p-2">Loading accounts...</p>}
                {availableAccounts.map(acc => (
                  <PersonaAccountSelectItem key={acc.id} account={acc} onSelect={() => addAccountId(acc.id)} />
                ))}
                {!isLoadingAccounts && availableAccounts.length === 0 && <p className="text-muted-foreground text-sm p-2">No available accounts found.</p>}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="px-6 py-4 border-t flex justify-end gap-3">
          <Button type="submit" disabled={updateLease.isPending}>
            {updateLease.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}