
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { ABTestOut, ABTestWinnerEnum, ABTestCompleteCommand, useAbtestsCompleteAbtestApiOrchestratorAbtestsAbtestIdCompletePost } from "@/lib/api/generated";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const formSchema = z.object({
  winner_variant: z.nativeEnum(ABTestWinnerEnum),
  uplift_percentage: z.coerce.number().optional().nullable(),
  insight_note: z.string().max(500).optional().nullable(),
});

interface ABTestCompleteFormProps {
  abTest: ABTestOut;
  onSuccess: () => void;
}

const ABTestCompleteForm = ({ abTest, onSuccess }: ABTestCompleteFormProps) => {
  const queryClient = useQueryClient();

  const form = useForm<ABTestCompleteCommand>({
    resolver: zodResolver(formSchema) as unknown as Resolver<ABTestCompleteCommand>,
  });

  const completeMutation = useAbtestsCompleteAbtestApiOrchestratorAbtestsAbtestIdCompletePost({
    mutation: {
    onSuccess: () => {
      toast.success("A/B Test completed successfully!");
      queryClient.invalidateQueries({ queryKey: ['abtests'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(`Failed to complete A/B Test: ${error.detail[0].msg}`);
    },
  }});

  function onSubmit(values: ABTestCompleteCommand) {
    completeMutation.mutate({ abtestId: abTest.id, data: { winner_variant: values.winner_variant, uplift_percentage: values.uplift_percentage, insight_note: values.insight_note, abtest_id: abTest.id } as ABTestCompleteCommand });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="winner_variant"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Select Winner *</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-2"
                >
                  <FormItem>
                    <FormControl>
                      <ToggleGroupItem value={ABTestWinnerEnum.A} aria-label="Select A">Variant A</ToggleGroupItem>
                    </FormControl>
                  </FormItem>
                  <FormItem>
                    <FormControl>
                      <ToggleGroupItem value={ABTestWinnerEnum.B} aria-label="Select B">Variant B</ToggleGroupItem>
                    </FormControl>
                  </FormItem>
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="uplift_percentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Uplift Percentage</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 15.5" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="insight_note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Insight Note</FormLabel>
              <FormControl>
                <Textarea placeholder="Key insights from this test..." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={completeMutation.isPending}>
          {completeMutation.isPending ? "Completing..." : "Complete Test"}
        </Button>
      </form>
    </Form>
  );
};

export default ABTestCompleteForm;
