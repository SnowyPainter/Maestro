import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Edit } from "lucide-react";

interface EditorCardProps {
  title?: string;
  data: any;
}

export function EditorCard({ title, data }: EditorCardProps) {
  // Draft 데이터인 경우
  if (typeof data === 'object' && data !== null) {
    const { title: draftTitle, content, status, created_at } = data;
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {title || draftTitle || "Draft"}
          </CardTitle>
          {status && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                status === 'published' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status}
              </span>
              {created_at && (
                <span className="text-sm text-muted-foreground">
                  {new Date(created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {content ? (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Edit className="w-8 h-8 mr-2" />
              <span>Empty draft</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 일반 텍스트 데이터
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {title || "Editor"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap">{String(data)}</div>
      </CardContent>
    </Card>
  );
}
