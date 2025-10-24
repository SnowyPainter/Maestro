import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { useReactiveDeleteMessageTemplateApiOrchestratorReactiveMessageTemplatesTemplateIdDelete } from "@/lib/api/generated";
import { ReactionMessageTemplateOut } from "@/lib/api/generated";
import { toast } from "sonner";

interface TemplateDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReactionMessageTemplateOut | null;
  onSuccess: () => void;
}

export function TemplateDeleteModal({ open, onOpenChange, template, onSuccess }: TemplateDeleteModalProps) {
  const deleteMutation = useReactiveDeleteMessageTemplateApiOrchestratorReactiveMessageTemplatesTemplateIdDelete();

  const handleDelete = async () => {
    if (!template) return;

    try {
      await deleteMutation.mutateAsync({
        templateId: template.id,
      });
      toast.success("Template deleted successfully");
      onSuccess();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete Template
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-gray-700 mb-2">
            Are you sure you want to delete this template?
          </p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">
              {template.title || `Template ${template.id}`}
            </p>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {template.body}
            </p>
          </div>
          <p className="text-sm text-red-600 mt-3">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
