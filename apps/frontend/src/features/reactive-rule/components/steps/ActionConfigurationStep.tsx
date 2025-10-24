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
                    className={`px-3 py-1 ${
                      actionCount > 0
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
                      className={`text-xs ${
                        isTagConnected
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

            <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div>
                <Label>Action Type</Label>
                <Select
                  value={watch(`actions.${index}.action_type`)}
                  onValueChange={(value: ReactionActionType) =>
                    setValue(`actions.${index}.action_type`, value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ReactionActionType.dm}>Send DM</SelectItem>
                    <SelectItem value={ReactionActionType.reply}>Reply to Post</SelectItem>
                    <SelectItem value={ReactionActionType.alert}>Create Alert</SelectItem>
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
                    <SelectTrigger className="mt-1">
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
                    <SelectTrigger className="mt-1">
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

        {/* Tag-Action Mapping Visualization */}
        {Object.keys(tagActionMappings).length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tag-Action Relationship Overview
            </h4>

            <div className="space-y-4">
              {Object.entries(tagActionMappings).map(([tagKey, { actions }]) => (
                <div key={tagKey} className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 font-medium">
                      {tagKey}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">Triggers</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {actions.map(({ actionType }, actionIndex) => (
                      <div key={actionIndex} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                          {actionType === ReactionActionType.dm ? 'Send DM' :
                           actionType === ReactionActionType.reply ? 'Reply to Post' : 'Create Alert'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* 연결 선 시각화 */}
                  <div className="mt-4 flex items-center justify-center">
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <span>Keywords with tag "{tagKey}"</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>Actions execute automatically</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-xs text-blue-800">
                💡 <strong>How it works:</strong> When keywords tagged as the above categories are detected,
                the corresponding actions will be triggered automatically in sequence.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
