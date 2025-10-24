import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useReactiveUpdateMessageTemplateApiOrchestratorReactiveMessageTemplatesTemplateIdPatch } from "@/lib/api/generated";
import { ReactionMessageTemplateOut, ReactionActionType, ReactionMessageTemplateUpdateCommand } from "@/lib/api/generated";
import { toast } from "sonner";

interface TemplateEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReactionMessageTemplateOut | null;
  onSuccess: () => void;
}

export function TemplateEditModal({ open, onOpenChange, template, onSuccess }: TemplateEditModalProps) {
  const updateMutation = useReactiveUpdateMessageTemplateApiOrchestratorReactiveMessageTemplatesTemplateIdPatch();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReactionMessageTemplateUpdateCommand>({
    defaultValues: {
      title: template?.title || null,
      body: template?.body || null,
      template_type: template?.template_type || null,
      tag_key: template?.tag_key || null,
      language: template?.language || null,
      is_active: template?.is_active ?? null,
      template_id: template?.id || 0,
    },
  });

  // Update form when template changes
  React.useEffect(() => {
    if (template) {
      reset({
        title: template.title || null,
        body: template.body || null,
        template_type: template.template_type,
        tag_key: template.tag_key || null,
        language: template.language || null,
        is_active: template.is_active ?? null,
        template_id: template.id,
      });
    }
  }, [template, reset]);

  const templateType = watch("template_type");

  const onSubmit = async (data: ReactionMessageTemplateUpdateCommand) => {
    if (!template) return;

    try {
      await updateMutation.mutateAsync({
        templateId: template.id,
        data: {
          ...data,
          template_id: template.id,
        },
      });
      toast.success("Template updated successfully");
      onSuccess();
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="Template title (optional)"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="template_type">Template Type *</Label>
              <Select
                value={templateType || ""}
                onValueChange={(value: ReactionActionType) => setValue("template_type", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ReactionActionType.dm}>DM Template</SelectItem>
                  <SelectItem value={ReactionActionType.reply}>Reply Template</SelectItem>
                  <SelectItem value={ReactionActionType.alert}>Alert Template</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="body">Message Body *</Label>
            <Textarea
              id="body"
              {...register("body", { required: "Message body is required" })}
              placeholder="Enter your message template..."
              rows={6}
              className="mt-1"
            />
            {errors.body && (
              <p className="text-sm text-destructive mt-1">{errors.body.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tag_key">Tag Key</Label>
              <Input
                id="tag_key"
                {...register("tag_key")}
                placeholder="Optional tag for categorization"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                {...register("language")}
                placeholder="e.g., ko, en, etc."
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={watch("is_active") ?? true}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
            <Label>Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
