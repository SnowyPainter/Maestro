import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useReactiveCreateMessageTemplateApiOrchestratorReactiveMessageTemplatesPost } from "@/lib/api/generated";
import { ReactionActionType } from "@/lib/api/generated";
import { toast } from "sonner";

interface TemplateCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TemplateCreateModal({ open, onOpenChange, onSuccess }: TemplateCreateModalProps) {
  const createMutation = useReactiveCreateMessageTemplateApiOrchestratorReactiveMessageTemplatesPost();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: "",
      body: "",
      template_type: ReactionActionType.dm,
      tag_key: "",
      language: "",
      is_active: true,
    },
  });

  const templateType = watch("template_type");

  const onSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync({
        data: {
          ...data,
          language: data.language || null,
        },
      });
      toast.success("Template created successfully");
      onSuccess();
      reset();
    } catch (error) {
      toast.error("Failed to create template");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
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
                value={templateType}
                onValueChange={(value) => setValue("template_type", value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ReactionActionType.dm}>DM Template</SelectItem>
                  <SelectItem value={ReactionActionType.reply}>Reply Template</SelectItem>
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
              checked={watch("is_active")}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
            <Label>Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
