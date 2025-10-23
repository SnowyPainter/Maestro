import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ABTestCreateCommand, useAbtestsCreateAbtestApiOrchestratorAbtestsPost, useBffCampaignsListCampaignsApiBffCampaignsGet, useBffDraftsListDraftsApiBffDraftsGet } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

const formSchema = z.object({
  campaign_id: z.number(),
  variant_a_id: z.number({ error: "Variant A is required." }),
  variant_b_id: z.number({ error: "Variant B is required." }),
  variable: z.string().min(1, "Variable is required.").max(50),
  hypothesis: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine(data => data.variant_a_id !== data.variant_b_id, {
  message: "Variant A and Variant B cannot be the same.",
  path: ["variant_b_id"], 
});

interface ABTestCreateFormProps {
  onSuccess: (abTestId: number) => void;
}

const ABTestCreateForm = ({ onSuccess }: ABTestCreateFormProps) => {
  const queryClient = useQueryClient();
  const { personaId } = usePersonaContextStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variable: "",
      hypothesis: "",
      notes: "",
    },
  });

  const variantAId = form.watch('variant_a_id');
  const variantBId = form.watch('variant_b_id');

  const { data: campaignsData, isLoading: isLoadingCampaigns } = useBffCampaignsListCampaignsApiBffCampaignsGet({});
  const { data: draftsData, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet({});

  const campaignDrafts = useMemo(() => {
    if (!draftsData || !selectedCampaignId) return [];
    return draftsData.filter(d => d.campaign_id === selectedCampaignId);
  }, [draftsData, selectedCampaignId]);

  const createMutation = useAbtestsCreateAbtestApiOrchestratorAbtestsPost({
    mutation: {
      onSuccess: (data) => {
      toast.success("A/B Test created successfully!");
      queryClient.invalidateQueries({ queryKey: ['abtests'] });
      onSuccess(data.id);
    },
    onError: (error: any) => {
      console.error(error);
      const errorMessage = error.data.detail as string || "An unknown error occurred.";
      toast.error(`Failed to create A/B Test: ${errorMessage}`);
    },
  }});

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!personaId) {
      toast.error("Persona context is not set. Please select a persona.");
      return;
    }
    createMutation.mutate({ data: { ...values, persona_id: personaId, campaign_id: selectedCampaignId ?? 0 } as ABTestCreateCommand });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="campaign_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign</FormLabel>
              <Select onValueChange={(value) => { 
                  const id = Number(value);
                  field.onChange(id);
                  setSelectedCampaignId(id);
                  form.reset({ ...form.getValues(), campaign_id: id, variant_a_id: undefined, variant_b_id: undefined });
                }} defaultValue={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger disabled={isLoadingCampaigns}>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {campaignsData?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="variant_a_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variant A</FormLabel>
              <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger disabled={!selectedCampaignId || isLoadingDrafts}>
                    <SelectValue placeholder="Select Variant A" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {campaignDrafts.filter(d => d.id !== variantBId).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.title || `Draft ${d.id}`}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="variant_b_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variant B</FormLabel>
              <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger disabled={!selectedCampaignId || isLoadingDrafts}>
                    <SelectValue placeholder="Select Variant B" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {campaignDrafts.filter(d => d.id !== variantAId).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.title || `Draft ${d.id}`}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create A/B Test"}
        </Button>
      </form>
    </Form>
  );
};

export default ABTestCreateForm;