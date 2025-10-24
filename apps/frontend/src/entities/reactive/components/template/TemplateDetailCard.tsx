import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, AlertTriangle, Settings } from "lucide-react";
import { ReactionMessageTemplateOut } from "@/lib/api/generated";

interface TemplateDetailCardProps {
  template: ReactionMessageTemplateOut;
}

export function TemplateDetailCard({
  template,
}: TemplateDetailCardProps) {
  const getTemplateTypeIcon = (templateType: string) => {
    switch (templateType) {
      case "dm":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "reply":
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getTemplateTypeColor = (templateType: string) => {
    switch (templateType) {
      case "dm":
        return "bg-blue-50 border-blue-200";
      case "reply":
        return "bg-green-50 border-green-200";
      case "alert":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {getTemplateTypeIcon(template.template_type)}
          <div>
            <CardTitle className="text-lg">{template.title || `Template ${template.id}`}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={`${getTemplateTypeColor(template.template_type)} border`}
              >
                {template.template_type.toUpperCase()}
              </Badge>
              {template.tag_key && (
                <Badge variant="secondary">
                  {template.tag_key}
                </Badge>
              )}
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Template Body */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Message Content</h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
              {template.body}
            </pre>
          </div>
        </div>

        <Separator />

        {/* Template Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Language:</span>
            <span className="ml-2 text-gray-600">{template.language || 'Not specified'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Owner:</span>
            <span className="ml-2 text-gray-600">User {template.owner_user_id}</span>
          </div>
          {template.persona_account_id && (
            <div>
              <span className="font-medium text-gray-700">Persona Account:</span>
              <span className="ml-2 text-gray-600">{template.persona_account_id}</span>
            </div>
          )}
        </div>

        {/* Metadata */}
        {template.metadata && Object.keys(template.metadata).length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Additional Settings</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(template.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Created: {new Date(template.created_at).toLocaleString()}</div>
          <div>Updated: {new Date(template.updated_at).toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}
