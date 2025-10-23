import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBffAbtestsReadApiBffAbtestsAbtestIdGet, useAbtestsUpdateAbtestApiOrchestratorAbtestsAbtestIdPatch, ABTestOut, ABTestUpdateCommand } from "@/lib/api/generated";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  variable: z.string().min(1, "Variable is required.").max(50),
  hypothesis: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

interface ABTestEditFormProps {
  abTestId: number;
  onSuccess: () => void;
}

const ABTestEditForm = ({ abTestId, onSuccess }: ABTestEditFormProps) => {
  const queryClient = useQueryClient();
  const { data: abTest, isLoading, error: queryError } = useBffAbtestsReadApiBffAbtestsAbtestIdGet(abTestId);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (abTest) {
      form.reset({
        variable: abTest.variable,
        hypothesis: abTest.hypothesis,
        notes: abTest.notes,
      });
    }
  }, [abTest, form]);

  const updateMutation = useAbtestsUpdateAbtestApiOrchestratorAbtestsAbtestIdPatch();

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const updateData: ABTestUpdateCommand = {
        abtest_id: abTestId,
        variable: values.variable,
        hypothesis: values.hypothesis || null,
        notes: values.notes || null,
      };

      await updateMutation.mutateAsync({ abtestId: abTestId, data: updateData });

      toast.success("A/B Test updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['abtests'] });
      queryClient.invalidateQueries({ queryKey: ['abtest', abTestId] });
      onSuccess();
    } catch (error: any) {
      toast.error(`Failed to update A/B Test: ${error?.message || 'Unknown error'}`);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (queryError) {
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50">
        <p className="text-red-800">Failed to load A/B Test data for editing.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="variable"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variable</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 'Ad Copy Tone'" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hypothesis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hypothesis</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., 'A more aggressive tone will lead to higher CTR.'" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes about the test." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
};

export default ABTestEditForm;
