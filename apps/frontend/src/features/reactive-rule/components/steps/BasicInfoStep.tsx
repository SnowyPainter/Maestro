import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import { ReactionRuleStatus } from "@/lib/api/generated";

interface BasicInfoStepProps {
  register: any;
  watch: any;
  setValue: any;
  errors: any;
}

export function BasicInfoStep({ register, watch, setValue, errors }: BasicInfoStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          Basic Information
        </CardTitle>
        <p className="text-sm text-gray-600">
          Set up the fundamental details for your reactive rule
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter rule name"
              className="mt-1"
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
              className="mt-1"
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
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={watch("status")}
            onValueChange={(value: ReactionRuleStatus) => setValue("status", value)}
          >
            <SelectTrigger className="mt-1">
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
  );
}
