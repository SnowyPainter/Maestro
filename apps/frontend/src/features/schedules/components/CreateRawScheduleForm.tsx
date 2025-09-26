
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { actionScheduleCreateFromRawDagApiOrchestratorActionsSchedulesCreateRawPostBody as formSchema } from "@/lib/schemas/api.zod";
import { useActionScheduleCreateFromRawDagApiOrchestratorActionsSchedulesCreateRawPost } from "@/lib/api/generated";
import { toast } from "sonner";

export function CreateRawScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
  const [formData, setFormData] = useState({
    persona_account_id: '',
    dag_nodes: '[]',
    repeats: '1',
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const createSchedule = useActionScheduleCreateFromRawDagApiOrchestratorActionsSchedulesCreateRawPost({
    mutation: {
      onSuccess: (data) => {
        toast.success("Schedule created successfully.");
        onCreated(data.schedule_ids);
        handleReset();
      },
      onError: (error: any) => {
        toast.error("Failed to create schedule.", {
          description: error.detail?.[0]?.msg || error.message,
        });
      },
    },
  });

  const handleReset = () => {
    setFormData({
      persona_account_id: '',
      dag_nodes: '[]',
      repeats: '1',
    });
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    let parsedDagNodes;
    try {
      parsedDagNodes = JSON.parse(formData.dag_nodes);
    } catch (error) {
      setErrors({ dag_spec: ["Invalid JSON in DAG Nodes."] });
      return;
    }

    const rawData = {
      persona_account_id: parseInt(formData.persona_account_id, 10),
      repeats: parseInt(formData.repeats, 10),
      dag_spec: {
        dag: {
          nodes: parsedDagNodes,
          edges: [],
        },
      },
    };

    const validationResult = formSchema.safeParse(rawData);

    if (!validationResult.success) {
      setErrors(validationResult.error.flatten().fieldErrors);
      return;
    }

    createSchedule.mutate({ data: validationResult.data as any });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader className="p-6">
        <CardTitle>Create New Raw Schedule</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="persona_account_id">Persona Account ID</Label>
            <Input
              id="persona_account_id"
              type="number"
              name="persona_account_id"
              value={formData.persona_account_id}
              onChange={handleChange}
            />
            {errors.persona_account_id && <p className="text-sm font-medium text-destructive">{errors.persona_account_id[0]}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dag_nodes">DAG Nodes (JSON)</Label>
            <Textarea
              id="dag_nodes"
              name="dag_nodes"
              placeholder='[{"id": "node-1", "flow": "example.flow"}]'
              value={formData.dag_nodes}
              onChange={handleChange}
              className="min-h-[120px]"
            />
            {errors.dag_spec && <p className="text-sm font-medium text-destructive">{errors.dag_spec[0]}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="repeats">Repeats</Label>
            <Input
              id="repeats"
              type="number"
              name="repeats"
              value={formData.repeats}
              onChange={handleChange}
            />
            {errors.repeats && <p className="text-sm font-medium text-destructive">{errors.repeats[0]}</p>}
          </div>
        </CardContent>
        <CardFooter className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={handleReset}>
            Cancel
          </Button>
          <Button type="submit" disabled={createSchedule.isPending}>
            {createSchedule.isPending ? "Creating..." : "Create Schedule"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
