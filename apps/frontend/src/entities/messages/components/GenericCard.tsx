import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

interface GenericCardProps {
  title?: string;
  data: any;
}

export function GenericCard({ title, data }: GenericCardProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileQuestion className="w-5 h-5 text-primary" />
          {title || "Data"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 간단한 데이터인 경우 간단히 표시 */}
          {typeof data === 'string' && (
            <div className="whitespace-pre-wrap">{data}</div>
          )}

          {typeof data === 'number' && (
            <div className="text-2xl font-bold">{data}</div>
          )}

          {typeof data === 'boolean' && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                data ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {data ? 'True' : 'False'}
              </span>
            </div>
          )}

          {/* 객체인 경우 JSON으로 표시 */}
          {typeof data === 'object' && data !== null && (
            <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}

          {/* null/undefined */}
          {(data === null || data === undefined) && (
            <div className="text-muted-foreground">No data</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
