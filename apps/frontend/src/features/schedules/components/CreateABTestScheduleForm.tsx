import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAbtestsScheduleAbtestApiOrchestratorActionsAbtestsAbtestIdSchedulePost, useBffAbtestsPublicationsApiBffAbtestsPublicationsPost } from "@/lib/api/generated";
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
  // AB Test의 기존 publications 확인
  const publicationsMutation = useBffAbtestsPublicationsApiBffAbtestsPublicationsPost();

  // 컴포넌트 마운트 시 publications 가져오기
  React.useEffect(() => {
    if (abTestId && personaAccountId) {
      publicationsMutation.mutate({
        data: {
          abtest_id: abTestId,
          persona_account_id: personaAccountId,
        },
      });
    }
  }, [abTestId, personaAccountId]);

  const existingPublications = publicationsMutation.data?.publications || [];
  console.log("existingPublications", existingPublications);
  const hasExistingPublications = existingPublications.length > 0;

  // 가장 늦은 scheduled_at 찾기 (UTC 시간을 그대로 사용)
  const latestScheduledAt = React.useMemo(() => {
    const validScheduledAts = existingPublications
      .map((pub) => pub.scheduled_at)
      .filter((scheduledAt): scheduledAt is string =>
        scheduledAt !== null &&
        scheduledAt !== undefined &&
        scheduledAt !== "" &&
        !isNaN(new Date(scheduledAt).getTime())
      );

    return validScheduledAts.length > 0
      ? new Date(validScheduledAts.reduce((latest, current) =>
          new Date(current).getTime() > new Date(latest).getTime() ? current : latest
        ))
      : null;
  }, [existingPublications]);

  const form = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      runAt: "",
      completeAt: "",
    },
  });

  React.useEffect(() => {
    if (latestScheduledAt && hasExistingPublications) {
      const year = latestScheduledAt.getFullYear();
      const month = String(latestScheduledAt.getMonth() + 1).padStart(2, '0');
      const day = String(latestScheduledAt.getDate()).padStart(2, '0');
      const hours = String(latestScheduledAt.getHours()).padStart(2, '0');
      const minutes = String(latestScheduledAt.getMinutes()).padStart(2, '0');
      const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      form.setValue("runAt", localDateTime);
    }
  }, [latestScheduledAt, hasExistingPublications]);

  const runAtValue = form.watch("runAt");
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
      toast.error(error?.data.detail || "Failed to schedule A/B Test");
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
              <div className="flex gap-2">
                <FormControl className="flex-1">
                  <Input
                    type="datetime-local"
                    {...field}
                    placeholder="Select publication time"
                    disabled={hasExistingPublications}
                  />
                </FormControl>
                {!hasExistingPublications && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const oneMinuteLater = new Date(now.getTime() + 60 * 1000); // Add 1 minute
                      const localDateTime = new Date(oneMinuteLater.getTime() - oneMinuteLater.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16);
                      form.setValue("runAt", localDateTime);
                    }}
                  >
                    Right now
                  </Button>
                )}
              </div>
              {hasExistingPublications && (
                <p className="text-sm text-muted-foreground">
                  Publication time is already set from existing schedule
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="completeAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Completion Time{!hasExistingPublications ? " (Optional)" : ""}</FormLabel>
              <div className="flex gap-2">
                <FormControl className="flex-1">
                  <Input
                    type="datetime-local"
                    {...field}
                    placeholder="Select completion time"
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!runAtValue}
                  onClick={() => {
                    if (!runAtValue) return;
                    const runAt = new Date(runAtValue);
                    const completeAt = new Date(runAt.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
                    const localDateTime = new Date(completeAt.getTime() - completeAt.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16);
                    form.setValue("completeAt", localDateTime);
                  }}
                >
                  +1d
                </Button>
              </div>
              <FormMessage />
              {!hasExistingPublications && (
                <p className="text-sm text-muted-foreground">
                  Leave empty to manually complete the test later
                </p>
              )}
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
