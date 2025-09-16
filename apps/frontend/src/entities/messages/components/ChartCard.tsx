import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface ChartCardProps {
  title?: string;
  data: any;
}

export function ChartCard({ title, data }: ChartCardProps) {
  // KPI 데이터인 경우 간단한 표시
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const { value, label, change, trend } = data;
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {title || label || "Chart"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-3xl font-bold">{value}</div>
            {change && (
              <div className="flex items-center gap-2 text-sm">
                {trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : trend === 'down' ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : null}
                <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : ''}>
                  {change}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 일반 차트 데이터
  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {title || "Chart"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
