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
import { Trash2, Plus, Hash, Settings, AlertTriangle, MessageSquare, ChevronLeft, ChevronRight, Info, Tag, Zap } from "lucide-react";
import { useReactiveCreateRuleApiOrchestratorReactiveRulesPost, useReactiveUpdateRuleApiOrchestratorReactiveRulesRuleIdPatch, useBffReactiveListTemplatesApiBffReactiveMessageTemplatesGet, useBffReactiveReadRuleApiBffReactiveRulesRuleIdGet, ReactionRuleCreateCommand, ReactionRuleUpdateCommand, ReactionRuleKeywordConfig, ReactionRuleActionConfig } from "@/lib/api/generated";
import { ReactionRuleStatus, ReactionMatchType, ReactionActionType, ReactionLLMMode } from "@/lib/api/generated";
import { BasicInfoStep } from "./steps/BasicInfoStep";
import { KeywordTagMappingStep } from "./steps/KeywordTagMappingStep";
import { ActionConfigurationStep } from "./steps/ActionConfigurationStep";
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

  // Fetch rule data for edit mode
  const { data: ruleData, isLoading: ruleDataLoading } = useBffReactiveReadRuleApiBffReactiveRulesRuleIdGet(
    ruleId || 0,
    {
      query: {
        enabled: isEdit && !!ruleId,
      },
    }
  );

  const isLoading = ruleDataLoading;

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const steps = [
    {
      id: 1,
      title: "Basic Information",
      description: "Set up your rule's basic details",
      icon: Info,
    },
    {
      id: 2,
      title: "Keyword-Tag Mapping",
      description: "Define keywords and their corresponding tags",
      icon: Tag,
    },
    {
      id: 3,
      title: "Action Configuration",
      description: "Configure what actions to take when keywords match",
      icon: Zap,
    },
  ];

  const nextStep = () => setCurrentStep(Math.min(currentStep + 1, totalSteps));
  const prevStep = () => setCurrentStep(Math.max(currentStep - 1, 1));

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
    reset,
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

  // Reset form when ruleData or initialData changes
  React.useEffect(() => {
    const dataToUse = isEdit ? (ruleData ? {
      name: ruleData.name,
      description: ruleData.description,
      status: ruleData.status,
      priority: ruleData.priority,
      keywords: ruleData.keywords || [],
      actions: ruleData.actions || [],
    } : null) : initialData;

    if (dataToUse) {
      reset({
        name: dataToUse.name || "",
        description: dataToUse.description || null,
        status: dataToUse.status || ReactionRuleStatus.active,
        priority: dataToUse.priority || 100,
        keywords: dataToUse.keywords && dataToUse.keywords.length > 0 ? dataToUse.keywords : [{
          tag_key: "",
          match_type: ReactionMatchType.contains,
          keyword: "",
          language: null,
          is_active: true,
          priority: 100,
        }],
        actions: dataToUse.actions && dataToUse.actions.length > 0 ? dataToUse.actions.map(action => ({
          ...action,
          action_type: (action as any).action_type || (action.dm_template_id ? ReactionActionType.dm :
                      action.reply_template_id ? ReactionActionType.reply :
                      action.alert_enabled ? ReactionActionType.alert :
                      ReactionActionType.reply)
        })) : [{
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
      });
    }
  }, [isEdit, ruleData, initialData, reset]);

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
      // Validate that all actions have unique tag_keys
      const tagKeys = data.actions.map(action => action.tag_key).filter(Boolean);
      const uniqueTagKeys = new Set(tagKeys);

      if (tagKeys.length !== uniqueTagKeys.size) {
        toast.error("Each action must have a unique tag key. Please ensure no duplicate tag keys exist.");
        return;
      }

      // Check for empty tag keys
      const emptyTagKeys = data.actions.filter(action => !action.tag_key?.trim());
      if (emptyTagKeys.length > 0) {
        toast.error("All actions must have a tag key. Please fill in all tag key fields.");
        return;
      }

      // Actions are sent as-is since they can contain multiple action types
      const apiData = data;

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
    // Check if we already have an action with empty tag_key
    const existingEmptyTagAction = actionFields.find(action =>
      watch(`actions.${actionFields.indexOf(action)}.tag_key`) === ""
    );

    if (existingEmptyTagAction) {
      toast.error("Please fill in the tag key for the existing action before adding a new one");
      return;
    }

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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep register={register} watch={watch} setValue={setValue} errors={errors} />;
      case 2:
        return <KeywordTagMappingStep
          fields={keywordFields}
          register={register}
          watch={watch}
          setValue={setValue}
          addKeyword={addKeyword}
          removeKeyword={removeKeyword}
        />;
      case 3:
        return <ActionConfigurationStep
          fields={actionFields}
          register={register}
          watch={watch}
          setValue={setValue}
          addAction={addAction}
          removeAction={removeAction}
          templates={templates}
          availableTags={keywordFields.map((_, index) => watch(`keywords.${index}.tag_key`)).filter(Boolean)}
        />;
      default:
        return null;
    }
  };

  const canProceedToNext = () => {
    // Don't allow proceeding if still loading data in edit mode
    if (isEdit && isLoading) return false;

    switch (currentStep) {
      case 1:
        return watch("name")?.trim() !== "";
      case 2:
        return keywordFields.length > 0;
      case 3:
        return actionFields.length > 0;
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {isEdit ? "Edit Reactive Rule" : "Create New Reactive Rule"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : isActive
                        ? "border-blue-500 text-blue-500"
                        : "border-gray-300 text-gray-400"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 ${
                      step.id < currentStep ? "bg-green-500" : "bg-gray-300"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {steps[currentStep - 1].title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {steps[currentStep - 1].description}
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Loading rule data...</p>
                </div>
              </div>
            ) : (
              renderStepContent()
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceedToNext() || isLoading}
                  className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 px-4 py-2 ${
                    !canProceedToNext() || isLoading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? "Loading..." : "Next"}
                  {!isLoading && <ChevronRight className="w-4 h-4 ml-2" />}
                </button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : (isEdit ? "Update Rule" : "Create Rule")}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
