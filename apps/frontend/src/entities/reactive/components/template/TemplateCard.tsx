import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, Trash2, MessageSquare, AlertTriangle } from "lucide-react";
import { ReactionMessageTemplateOut } from "@/lib/api/generated";

interface TemplateCardProps {
  template: ReactionMessageTemplateOut;
  onEdit: (template: ReactionMessageTemplateOut) => void;
  onDelete: (template: ReactionMessageTemplateOut) => void;
}

export function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'dm':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'reply':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'dm':
        return 'bg-blue-100 text-blue-800';
      case 'reply':
        return 'bg-green-100 text-green-800';
      case 'alert':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow h-full group relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getActionTypeIcon(template.template_type)}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium truncate">
                {template.title || `Template ${template.id}`}
              </CardTitle>
              <div className="flex items-center gap-1 mt-1">
                {template.tag_key && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {template.tag_key}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={`text-xs px-1.5 py-0.5 ${getActionTypeColor(template.template_type)}`}
                >
                  {template.template_type}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Hover시에 나타나는 버튼들 - 중앙 상단에 absolute 배치 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(template)}
          className="h-6 w-6 p-0 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white border"
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(template)}
          className="h-6 w-6 p-0 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white border text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {template.body}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {template.language && `${template.language}`}
            </span>
            <Badge
              variant={template.is_active ? "default" : "secondary"}
              className={`text-xs px-1.5 py-0.5 ${
                template.is_active
                  ? 'bg-green-100 text-green-700 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
