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


  return (
    <Card className="hover:shadow-md transition-shadow h-full group relative p-3">
      {/* Hover시에 나타나는 버튼들 - 아이콘 위에 겹쳐서 배치 */}
      <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(template)}
          className="h-5 w-5 p-0 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white border"
        >
          <Edit className="h-2.5 w-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(template)}
          className="h-5 w-5 p-0 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white border text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>

      <div className="space-y-2">
        {/* 아이콘 + 타이틀 */}
        <div className="flex items-start gap-2">
          {getActionTypeIcon(template.template_type)}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2rem]">
              {template.title || `Template ${template.id}`}
            </h3>
            {template.tag_key && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mt-1 inline-block">
                {template.tag_key}
              </Badge>
            )}
          </div>
        </div>

        {/* 본문 */}
        <p className="text-[11px] text-gray-600 line-clamp-3 leading-snug">
          {template.body}
        </p>

        {/* 푸터 */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-gray-500">
            {template.language && `${template.language}`}
          </span>
          <Badge
            variant={template.is_active ? "default" : "secondary"}
            className={`text-[10px] px-1 py-0 h-3.5 ${
              template.is_active
                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {template.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
