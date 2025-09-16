import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface InfoCardProps {
  title?: string;
  data: any;
}

export function InfoCard({ title, data }: InfoCardProps) {
  // 메시지 타입 판별
  const getMessageType = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      const { type, level, status } = data;
      if (level === 'error' || status === 'error' || type === 'error') return 'error';
      if (level === 'warning' || status === 'warning' || type === 'warning') return 'warning';
      if (level === 'success' || status === 'success' || type === 'success') return 'success';
    }
    return 'info';
  };

  const messageType = getMessageType(data);
  const message = typeof data === 'object' && data !== null
    ? (data.message || data.content || data.text || JSON.stringify(data))
    : String(data);

  const getIcon = () => {
    switch (messageType) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (messageType) {
      case 'success':
        return 'border-green-200';
      case 'warning':
        return 'border-yellow-200';
      case 'error':
        return 'border-red-200';
      default:
        return 'border-blue-200';
    }
  };

  return (
    <Card className={`w-full max-w-2xl ${getBorderColor()}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {getIcon()}
          {title || "Information"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap">{message}</div>
      </CardContent>
    </Card>
  );
}
