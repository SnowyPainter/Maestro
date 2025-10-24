import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Tag, Info } from "lucide-react";
import { ReactionMatchType } from "@/lib/api/generated";

interface KeywordTagMappingStepProps {
  fields: any[];
  register: any;
  watch: any;
  setValue: any;
  addKeyword: () => void;
  removeKeyword: (index: number) => void;
}

export function KeywordTagMappingStep({
  fields,
  register,
  watch,
  setValue,
  addKeyword,
  removeKeyword
}: KeywordTagMappingStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="h-5 w-5 text-green-500" />
          Keyword-Tag Mapping
        </CardTitle>
        <p className="text-sm text-gray-600">
          Define keywords that will trigger your rule and assign them to tags for categorization
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Why use tags?</h4>
              <p className="text-sm text-blue-700">
                Tags help categorize your keywords and determine which actions to take.
                For example, keywords tagged as "support" might trigger customer service actions,
                while "sales" tags might trigger lead generation workflows.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-700">Keywords ({fields.length})</h3>
          <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
            <Plus className="h-4 w-4 mr-2" />
            Add Keyword
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Keyword {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeKeyword(index)}
                disabled={fields.length === 1}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tag Key *</Label>
                <Input
                  {...register(`keywords.${index}.tag_key`)}
                  placeholder="e.g., support, sales, urgent"
                  className="mt-1"
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
                  <SelectTrigger className="mt-1">
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
                  placeholder="Enter keyword or pattern"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Language</Label>
                <Input
                  {...register(`keywords.${index}.language`)}
                  placeholder="ko, en, etc."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={watch(`keywords.${index}.is_active`)}
                    onCheckedChange={(checked) =>
                      setValue(`keywords.${index}.is_active`, checked)
                    }
                  />
                  <Label className="text-sm">Active</Label>
                </div>
                <div className="w-20">
                  <Label className="text-sm">Priority</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    {...register(`keywords.${index}.priority`, { valueAsNumber: true })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
