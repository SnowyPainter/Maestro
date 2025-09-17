import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TableCardProps {
  title?: string;
  data: any;
}

export function TableCard({ title, data }: TableCardProps) {
  // 실제 테이블 데이터는 data.items에 있음
  const tableData = data?.items || data;
  
  // 데이터가 배열인지 확인
  if (!Array.isArray(tableData) || tableData.length === 0) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">{title || "Data Table"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // 첫 번째 아이템의 키들을 헤더로 사용
  const headers = Object.keys(tableData[0]);

  return (
    <Card className="w-full max-w-2xl">
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {headers.map((header) => (
                  <th key={header} className="text-left p-2 font-semibold border-r border-border last:border-r-0 text-xs">
                    {header.charAt(0).toUpperCase() + header.slice(1).replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  {headers.map((header) => (
                    <td key={header} className="p-2 max-w-xs truncate border-r border-border last:border-r-0 text-xs">
                      {typeof row[header] === 'object'
                        ? JSON.stringify(row[header])
                        : String(row[header] || '-')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {tableData.length} {tableData.length === 1 ? 'row' : 'rows'}
        </div>
      </CardContent>
    </Card>
  );
}