import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles } from "lucide-react"
import { GraphRagActionAck } from "@/lib/api/generated"

interface ActionAckProps {
  data: GraphRagActionAck
  title?: string | null
}

const ActionAck: React.FC<ActionAckProps> = ({ data, title }) => {
  console.log('ActionAck received data:', data)
  console.log('ActionAck received title:', title)

  if (!data) {
    console.log('ActionAck: no data, returning null')
    return null
  }

  // 데이터 구조가 GraphRagActionAck 형태인지 확인
  const isGraphRagActionAck = data && typeof data === 'object' && 'status' in data && 'message' in data

  let status: string
  let message: string
  let meta: any

  if (isGraphRagActionAck) {
    status = (data as GraphRagActionAck).status
    message = (data as GraphRagActionAck).message
    meta = (data as GraphRagActionAck).meta
  } else {
    // GraphRagActionAck 형태가 아니면 다른 구조로 처리
    status = 'info'
    message = typeof data === 'string' ? data : JSON.stringify(data)
    meta = undefined
  }

  // Status에 따른 스타일 결정
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
      case 'completed':
        return {
          icon: CheckCircle2,
          gradient: "from-emerald-500 to-teal-600",
          bgGradient: "from-emerald-50 to-teal-50",
          borderColor: "border-emerald-200",
          textColor: "text-emerald-800",
          badgeVariant: "default" as const,
          glowColor: "shadow-emerald-500/20",
        }
      case 'error':
      case 'failed':
        return {
          icon: XCircle,
          gradient: "from-red-500 to-rose-600",
          bgGradient: "from-red-50 to-rose-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
          badgeVariant: "destructive" as const,
          glowColor: "shadow-red-500/20",
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          gradient: "from-amber-500 to-orange-600",
          bgGradient: "from-amber-50 to-orange-50",
          borderColor: "border-amber-200",
          textColor: "text-amber-800",
          badgeVariant: "secondary" as const,
          glowColor: "shadow-amber-500/20",
        }
      default:
        return {
          icon: Info,
          gradient: "from-blue-500 to-indigo-600",
          bgGradient: "from-blue-50 to-indigo-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-800",
          badgeVariant: "secondary" as const,
          glowColor: "shadow-blue-500/20",
        }
    }
  }

  const statusConfig = getStatusConfig(status)
  const IconComponent = statusConfig.icon

  return (
    <Card className={`border ${statusConfig.borderColor} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`flex-shrink-0 p-1.5 rounded-full bg-gray-100`}>
            <IconComponent className={`h-4 w-4 ${statusConfig.textColor}`} />
          </div>

          <div className="flex-1 space-y-2">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant={statusConfig.badgeVariant}
                className="px-2 py-0.5 text-xs font-medium"
              >
                {status}
              </Badge>
            </div>

            {/* Message */}
            <div className="text-sm text-gray-900 leading-relaxed">
              {message}
            </div>

            {/* Meta Data */}
            {meta && Object.keys(meta).length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="space-y-2">
                  {Object.entries(meta).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-600 font-medium min-w-0 flex-shrink-0">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-gray-900 font-mono break-all">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ActionAck
