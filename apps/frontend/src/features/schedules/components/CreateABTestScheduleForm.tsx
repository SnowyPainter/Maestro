import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAbtestsScheduleAbtestApiOrchestratorActionsAbtestsAbtestIdSchedulePost } from "@/lib/api/generated";
import { toast } from "sonner";

const scheduleSchema = z.object({
  runAt: z.string().min(1, "Publication time is required"),
  completeAt: z.string().optional(),
}).refine((data) => {
  if (data.completeAt) {
    const runAt = new Date(data.runAt);
    const completeAt = new Date(data.completeAt);
    return completeAt > runAt;
  }
  return true;
}, {
  message: "Completion time must be after publication time",
  path: ["completeAt"],
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface CreateABTestScheduleFormProps {
  abTestId: number;
  personaAccountId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateABTestScheduleForm({ abTestId, personaAccountId, onSuccess, onCancel }: CreateABTestScheduleFormProps) {
  const form = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      runAt: "",
      completeAt: "",
    },
  });

  const scheduleMutation = useAbtestsScheduleAbtestApiOrchestratorActionsAbtestsAbtestIdSchedulePost();

  const onSubmit = async (data: any) => {
    try {
      await scheduleMutation.mutateAsync({
        abtestId: abTestId,
        data: {
          persona_account_id: personaAccountId,
          run_at: new Date(data.runAt).toISOString(),
          complete_at: data.completeAt ? new Date(data.completeAt).toISOString() : null,
        },
      });
      toast.success("A/B Test scheduled successfully!");
      onSuccess?.();
      form.reset();
    } catch (error: any) {
      toast.error(error?.message || "Failed to schedule A/B Test");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-medium">Persona Account ID</p>
          <p className="text-sm text-muted-foreground">{personaAccountId}</p>
        </div>
        <FormField
          control={form.control}
          name="runAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Publication Time</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  placeholder="Select publication time"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="completeAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Completion Time (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  placeholder="Select completion time"
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">
                Leave empty to manually complete the test later
              </p>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={scheduleMutation.isPending}>
            {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
