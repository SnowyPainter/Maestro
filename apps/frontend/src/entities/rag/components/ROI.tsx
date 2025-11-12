import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Clock,
  Brain,
  Target,
  User,
  DollarSign
} from "lucide-react"
import { RagValueInsight } from "@/lib/api/generated"

interface ROIProps {
  data: RagValueInsight
}

const ROI: React.FC<ROIProps> = ({ data }) => {
  if (!data) {
    return null
  }

  const metrics = [
    {
      label: "Memory Reuse",
      value: data.memory_reuse_count,
      icon: Brain,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      suffix: "times"
    },
    {
      label: "Automated Decisions",
      value: data.automated_decisions,
      icon: Target,
      color: "text-green-500",
      bgColor: "bg-green-50",
      suffix: ""
    },
    {
      label: "Time Saved",
      value: data.saved_minutes,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      suffix: "min"
    },
    {
      label: "AI Intervention",
      value: data.ai_intervention_rate,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      suffix: "%",
      isPercentage: true
    }
  ].filter(metric => metric.value !== undefined && metric.value !== null)

  if (metrics.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-green-600" />
        <h3 className="text-sm font-medium text-foreground">ROI Metrics</h3>
        {data.persona?.persona_name && (
          <Badge variant="outline" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            {data.persona.persona_name}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          const displayValue = metric.isPercentage
            ? `${(metric.value * 100).toFixed(1)}`
            : metric.value.toLocaleString()

          return (
            <div key={index} className={`p-3 rounded-lg border ${metric.bgColor} border-current/20`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${metric.bgColor} border`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {displayValue}
                    </span>
                    {metric.suffix && (
                      <span className="text-xs text-muted-foreground">
                        {metric.suffix}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ROI
