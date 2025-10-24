import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Zap, Tag, AlertTriangle, ArrowRight } from "lucide-react";
import { ReactionActionType } from "@/lib/api/generated";

interface ActionConfigurationStepProps {
  fields: any[];
  register: any;
  watch: any;
  setValue: any;
  addAction: () => void;
  removeAction: (index: number) => void;
  templates: any[];
  availableTags: string[];
}

export function ActionConfigurationStep({
  fields,
  register,
  watch,
  setValue,
  addAction,
  removeAction,
  templates,
  availableTags
}: ActionConfigurationStepProps) {
  // Check for duplicate tag keys
  const getDuplicateTagKeys = () => {
    const tagKeys = fields.map((_, index) => watch(`actions.${index}.tag_key`));
    const duplicates: string[] = [];

    tagKeys.forEach((tagKey, index) => {
      if (tagKey && tagKeys.indexOf(tagKey) !== index) {
        if (!duplicates.includes(tagKey)) {
          duplicates.push(tagKey);
        }
      }
    });

    return duplicates;
  };

  const duplicateTagKeys = getDuplicateTagKeys();

  // Auto-set action_type for compatibility (though it's not used in the UI anymore)
  React.useEffect(() => {
    fields.forEach((_, index) => {
      const dmTemplateId = watch(`actions.${index}.dm_template_id`);
      const replyTemplateId = watch(`actions.${index}.reply_template_id`);
      const alertEnabled = watch(`actions.${index}.alert_enabled`);

      // Set action_type based on templates for API compatibility
      let actionType: ReactionActionType = ReactionActionType.reply;
      if (dmTemplateId && replyTemplateId) {
        actionType = ReactionActionType.dm; // Default to DM when both are present
      } else if (dmTemplateId) {
        actionType = ReactionActionType.dm;
      } else if (replyTemplateId) {
        actionType = ReactionActionType.reply;
      } else if (alertEnabled) {
        actionType = ReactionActionType.alert;
      }

      setValue(`actions.${index}.action_type`, actionType);
    });
  }, [fields, watch, setValue]);

  // 태그별로 액션들을 그룹화하여 시각화
  const getTagActionMappings = () => {
    const mappings: { [tagKey: string]: { actions: any[], keywords: any[] } } = {};

    fields.forEach((field, index) => {
      const tagKey = watch(`actions.${index}.tag_key`);
      const actionType = watch(`actions.${index}.action_type`);

      if (tagKey) {
        if (!mappings[tagKey]) {
          mappings[tagKey] = { actions: [], keywords: [] };
        }
        if (actionType) {
          mappings[tagKey].actions.push({ field, index, actionType });
        }
      }
    });

    return mappings;
  };

  const tagActionMappings = getTagActionMappings();

  return (
    <div className="space-y-6">
      {duplicateTagKeys.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <strong>Warning:</strong> Duplicate tag keys detected: {duplicateTagKeys.join(', ')}.
            Each action must have a unique tag key.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Action Configuration
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure what actions to take when keywords match
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-green-900 mb-1">Tag-Action Relationship</h4>
                <p className="text-sm text-green-700">
                  Actions are linked to tags. When a keyword with a specific tag matches,
                  the corresponding actions will be triggered automatically.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available Tags Overview */}
          {availableTags.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Available Tags</h4>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const actionCount = fields.filter((_, i) =>
                    watch(`actions.${i}.tag_key`) === tag
                  ).length;
                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={`px-3 py-1 ${actionCount > 0
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                      {tag}
                      {actionCount > 0 && (
                        <span className="ml-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {actionCount}
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Green badges indicate tags with connected actions
              </p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Actions ({fields.length})</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAction}
              disabled={availableTags.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </div>

          {fields.map((field, index) => {
            const currentTag = watch(`actions.${index}.tag_key`);
            const isTagConnected = currentTag && availableTags.includes(currentTag);

            return (
              <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">Action {index + 1}</h4>
                    {currentTag && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${isTagConnected
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {currentTag}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                    disabled={fields.length === 1}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {!isTagConnected && currentTag && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Tag "{currentTag}" is not defined in keywords. Please add this tag in the previous step.
                    </p>
                  </div>
                )}

                <div>
                  <Label>Tag Key *</Label>
                  <Select
                    value={watch(`actions.${index}.tag_key`) || ""}
                    onValueChange={(value) => setValue(`actions.${index}.tag_key`, value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a tag from keywords" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map((tag) => {
                        const actionCount = fields.filter((_, i) =>
                          watch(`actions.${i}.tag_key`) === tag
                        ).length;
                        return (
                          <SelectItem key={tag} value={tag}>
                            {tag} {actionCount > 0 && `(${actionCount} actions)`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {availableTags.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      No tags available. Please add keywords with tags first.
                    </p>
                  )}
                  {duplicateTagKeys.includes(watch(`actions.${index}.tag_key`)) && watch(`actions.${index}.tag_key`) && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ This tag key is already used by another action. Each tag key must be unique.
                    </p>
                  )}
                </div>

                {/* DM and Reply Templates - can select both */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>DM Template</Label>
                    <Select
                      value={watch(`actions.${index}.dm_template_id`)?.toString() || "none"}
                      onValueChange={(value) =>
                        setValue(`actions.${index}.dm_template_id`, value === "none" ? null : parseInt(value))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select DM template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
                      value={watch(`actions.${index}.reply_template_id`)?.toString() || "none"}
                      onValueChange={(value) =>
                        setValue(`actions.${index}.reply_template_id`, value === "none" ? null : parseInt(value))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select reply template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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

                <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={watch(`actions.${index}.alert_enabled`)}
                      onCheckedChange={(checked) =>
                        setValue(`actions.${index}.alert_enabled`, checked)
                      }
                    />
                    <Label className="flex items-center gap-1 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Enable Alert
                    </Label>
                  </div>

                  {watch(`actions.${index}.alert_enabled`) && (
                    <div className="flex-1">
                      <Label className="text-sm">Alert Severity</Label>
                      <Input
                        {...register(`actions.${index}.alert_severity`)}
                        placeholder="high, medium, low, etc."
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
