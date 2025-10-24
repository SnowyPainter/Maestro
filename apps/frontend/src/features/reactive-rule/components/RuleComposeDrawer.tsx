import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Hash, Settings, AlertTriangle, MessageSquare } from "lucide-react";
import { useReactiveCreateRuleApiOrchestratorReactiveRulesPost, useReactiveUpdateRuleApiOrchestratorReactiveRulesRuleIdPatch, useBffReactiveListTemplatesApiBffReactiveMessageTemplatesGet, ReactionRuleCreateCommand, ReactionRuleUpdateCommand, ReactionRuleKeywordConfig, ReactionRuleActionConfig } from "@/lib/api/generated";
import { ReactionRuleStatus, ReactionMatchType, ReactionActionType, ReactionLLMMode } from "@/lib/api/generated";
import { toast } from "sonner";

// Extended interface for UI needs
interface ActionFormData extends ReactionRuleActionConfig {
  action_type?: ReactionActionType;
}

type RuleFormData = Omit<ReactionRuleCreateCommand, 'actions' | 'owner_user_id'> & {
  actions: ActionFormData[];
};

interface RuleComposeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId?: number; // Used in edit mode
  initialData?: Partial<RuleFormData>; // Initial data for editing
}

export function RuleComposeDrawer({
  open,
  onOpenChange,
  ruleId,
  initialData,
}: RuleComposeDrawerProps) {
  const isEdit = !!ruleId;
  const createMutation = useReactiveCreateRuleApiOrchestratorReactiveRulesPost();
  const updateMutation = useReactiveUpdateRuleApiOrchestratorReactiveRulesRuleIdPatch();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Fetch template list
  const { data: templatesData } = useBffReactiveListTemplatesApiBffReactiveMessageTemplatesGet({
    include_inactive: false,
  });
  const templates = templatesData?.items || [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RuleFormData>({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || null,
      status: initialData?.status || ReactionRuleStatus.active,
      priority: initialData?.priority || 100,
      keywords: initialData?.keywords || [{
        tag_key: "",
        match_type: ReactionMatchType.contains,
        keyword: "",
        language: null,
        is_active: true,
        priority: 100,
      }],
      actions: initialData?.actions || [{
        tag_key: "",
        dm_template_id: null,
        reply_template_id: null,
        action_type: ReactionActionType.reply,
        alert_enabled: false,
        alert_severity: null,
        alert_assignee_user_id: null,
        llm_mode: ReactionLLMMode.template_only,
        metadata: {},
      }],
    },
  });

  const {
    fields: keywordFields,
    append: appendKeyword,
    remove: removeKeyword,
  } = useFieldArray({
    control,
    name: "keywords",
  });

  const {
    fields: actionFields,
    append: appendAction,
    remove: removeAction,
  } = useFieldArray({
    control,
    name: "actions",
  });

  const onSubmit = async (data: RuleFormData) => {
    try {
      // Remove action_type from actions before sending to API
      const apiData = {
        ...data,
        actions: data.actions.map(({ action_type, ...action }) => action),
      };

      if (isEdit && ruleId) {
        await updateMutation.mutateAsync({ ruleId, data: { ...apiData, rule_id: ruleId } });
        toast.success("Reactive rule updated successfully");
      } else {
        await createMutation.mutateAsync({ data: apiData });
        toast.success("Reactive rule created successfully");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(isEdit ? "Failed to update rule" : "Failed to create rule");
    }
  };

  const addKeyword = () => {
    appendKeyword({
      tag_key: "",
      match_type: ReactionMatchType.contains,
      keyword: "",
      language: null,
      is_active: true,
      priority: 100,
    });
  };

  const addAction = () => {
    appendAction({
      tag_key: "",
      dm_template_id: null,
      reply_template_id: null,
      action_type: ReactionActionType.reply,
      alert_enabled: false,
      alert_severity: null,
      alert_assignee_user_id: null,
      llm_mode: ReactionLLMMode.template_only,
      metadata: {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {isEdit ? "Edit Reactive Rule" : "Create New Reactive Rule"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter rule name"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={0}
                    max={100}
                    {...register("priority", { valueAsNumber: true })}
                  />
                  {errors.priority && (
                    <p className="text-sm text-destructive mt-1">{errors.priority.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Enter rule description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value: ReactionRuleStatus) => setValue("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ReactionRuleStatus.active}>Active</SelectItem>
                    <SelectItem value={ReactionRuleStatus.inactive}>Inactive</SelectItem>
                    <SelectItem value={ReactionRuleStatus.archived}>Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Keyword Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Keyword Settings
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Keyword
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {keywordFields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Keyword {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKeyword(index)}
                      disabled={keywordFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tag Key *</Label>
                      <Input
                        {...register(`keywords.${index}.tag_key`)}
                        placeholder="Tag key"
                      />
                    </div>
                    <div>
                      <Label>Match Type</Label>
                      <Select
                        value={watch(`keywords.${index}.match_type`)}
                        onValueChange={(value: ReactionMatchType) =>
                          setValue(`keywords.${index}.match_type`, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ReactionMatchType.contains}>Contains</SelectItem>
                          <SelectItem value={ReactionMatchType.exact}>Exact Match</SelectItem>
                          <SelectItem value={ReactionMatchType.regex}>Regex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label>Keyword *</Label>
                      <Input
                        {...register(`keywords.${index}.keyword`)}
                        placeholder="Enter keyword"
                      />
                    </div>
                    <div>
                      <Label>Language</Label>
                      <Input
                        {...register(`keywords.${index}.language`)}
                        placeholder="ko, en, etc."
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={watch(`keywords.${index}.is_active`)}
                          onCheckedChange={(checked) =>
                            setValue(`keywords.${index}.is_active`, checked)
                          }
                        />
                        <Label>Active</Label>
                      </div>
                      <div className="w-20">
                        <Label>Priority</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...register(`keywords.${index}.priority`, { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Action Settings
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {actionFields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Action {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                      disabled={actionFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tag Key *</Label>
                      <Input
                        {...register(`actions.${index}.tag_key`)}
                        placeholder="Tag key"
                      />
                    </div>
                    <div>
                      <Label>Action Type</Label>
                      <Select
                        value={watch(`actions.${index}.action_type`)}
                        onValueChange={(value: ReactionActionType) =>
                          setValue(`actions.${index}.action_type`, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ReactionActionType.dm}>DM</SelectItem>
                          <SelectItem value={ReactionActionType.reply}>Reply</SelectItem>
                          <SelectItem value={ReactionActionType.alert}>Alert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(watch(`actions.${index}.action_type`) === ReactionActionType.dm ||
                    watch(`actions.${index}.action_type`) === ReactionActionType.reply) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>DM Template</Label>
                        <Select
                          value={watch(`actions.${index}.dm_template_id`)?.toString() || ""}
                          onValueChange={(value) =>
                            setValue(`actions.${index}.dm_template_id`, value ? parseInt(value) : null)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select DM template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates
                              .filter(template => template.template_type === ReactionActionType.dm)
                              .map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.title || template.tag_key || `Template ${template.id}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Reply Template</Label>
                        <Select
                          value={watch(`actions.${index}.reply_template_id`)?.toString() || ""}
                          onValueChange={(value) =>
                            setValue(`actions.${index}.reply_template_id`, value ? parseInt(value) : null)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reply template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates
                              .filter(template => template.template_type === ReactionActionType.reply)
                              .map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.title || template.tag_key || `Template ${template.id}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={watch(`actions.${index}.alert_enabled`)}
                        onCheckedChange={(checked) =>
                          setValue(`actions.${index}.alert_enabled`, checked)
                        }
                      />
                      <Label className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Alert Enabled
                      </Label>
                    </div>

                    {watch(`actions.${index}.alert_enabled`) && (
                      <div className="flex-1">
                        <Label>Alert Severity</Label>
                        <Input
                          {...register(`actions.${index}.alert_severity`)}
                          placeholder="high, medium, low, etc."
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : (isEdit ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
