import React from "react";
import { useBffPlaybookDashboardPerformanceApiBffPlaybooksDashboardPerformanceGet } from "@/lib/api/generated";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from 'recharts';
import { Zap, TrendingUp, AlertTriangle } from "lucide-react";

// Chart configuration
const chartConfig = {
  total: {
    label: "Total Events",
    color: "hsl(var(--chart-1))",
  },
  sync_metrics: {
    label: "Sync Metrics",
    color: "hsl(var(--chart-2))",
  },
  schedule: {
    label: "Schedule",
    color: "hsl(var(--chart-3))",
  },
}

// Compact metric card component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
}> = ({ title, value, subtitle, icon, color = "blue" }) => (
  <div className={`p-3 rounded-lg bg-${color}-50 border border-${color}-200`}>
    <div className="flex items-center gap-2 mb-1">
      {icon && <div className={`text-${color}-600`}>{icon}</div>}
      <span className={`text-xs font-medium text-${color}-900 uppercase tracking-wider`}>{title}</span>
    </div>
    <div className={`text-lg font-bold text-${color}-900`}>{value}</div>
    {subtitle && <div className={`text-xs text-${color}-700`}>{subtitle}</div>}
  </div>
);

interface PerformancePageProps {
  playbookId: number;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ playbookId }) => {
  const { data: performanceData, isLoading, isError } = useBffPlaybookDashboardPerformanceApiBffPlaybooksDashboardPerformanceGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-center">
          <Zap className="w-5 h-5 mx-auto mb-1 text-orange-500" />
          <h2 className="text-sm font-bold mb-1">Performance</h2>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-gray-50 border animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !performanceData) {
    return (
      <div className="space-y-2">
        <div className="text-center">
          <Zap className="w-5 h-5 mx-auto mb-1 text-orange-500" />
          <h2 className="text-sm font-bold mb-1">Performance</h2>
          <p className="text-xs text-red-500">Unable to load data</p>
        </div>
      </div>
    );
  }

  const { success_rate, failure_rate, action_stats } = performanceData;
  const successData = [
    { name: 'Success', value: success_rate, fill: 'hsl(var(--chart-1))' },
    { name: 'Failed', value: failure_rate, fill: 'hsl(var(--chart-2))' },
  ];

  return (
    <div className="space-y-2">
      <div className="text-center">
        <Zap className="w-5 h-5 mx-auto mb-1 text-orange-500" />
        <h2 className="text-sm font-bold mb-1">Performance</h2>
        <p className="text-xs text-muted-foreground">System Metrics</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="Stability" value={`${success_rate}%`} subtitle="Collection Success" color="green" />
        <MetricCard title="Quality" value="100%" subtitle="Data Completeness" color="blue" />
      </div>

      {/* Success Rate Chart */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Success Rate Distribution</h4>
        <div className="h-24 flex items-center justify-center">
          <ChartContainer config={chartConfig} className="w-24 h-24">
            <PieChart width={96} height={96}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={successData}
                dataKey="value"
                nameKey="name"
                innerRadius={20}
                outerRadius={40}
                strokeWidth={2}
                cx="50%"
                cy="50%"
              >
                <Cell key="success" fill="hsl(var(--chart-1))" />
                <Cell key="failed" fill="hsl(var(--chart-2))" />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs">
          {successData.map((item, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `hsl(var(--chart-${index + 1}))` }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Reaction Actions</h4>
        <div className="grid grid-cols-3 gap-1">
          {Object.entries(action_stats).map(([action, stats]: [string, any]) => (
            <div key={action} className={`p-1 rounded text-center ${
              stats.rate === 100 ? 'bg-green-50' :
              stats.rate === 0 ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <div className={`text-xs font-medium ${
                stats.rate === 100 ? 'text-green-900' :
                stats.rate === 0 ? 'text-red-900' : 'text-yellow-900'
              }`}>
                {action}
              </div>
              <div className={`text-sm font-bold ${
                stats.rate === 100 ? 'text-green-800' :
                stats.rate === 0 ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {stats.rate}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {Object.values(action_stats).some((stats: any) => stats.rate === 0) && (
        <div className="p-1 bg-yellow-50 rounded border">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-900">Needs Attention</span>
          </div>
          <p className="text-xs text-yellow-800">Check API permissions for failed actions</p>
        </div>
      )}
    </div>
  );
};
