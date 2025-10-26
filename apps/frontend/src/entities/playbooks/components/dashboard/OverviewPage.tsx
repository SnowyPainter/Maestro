import React from "react";
import { useBffPlaybookDashboardOverviewApiBffPlaybooksDashboardOverviewGet } from "@/lib/api/generated";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BarChart3 } from "lucide-react";

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

interface OverviewPageProps {
  playbookId: number;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ playbookId }) => {
  const { data: overviewData, isLoading, isError } = useBffPlaybookDashboardOverviewApiBffPlaybooksDashboardOverviewGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-center">
          <BarChart3 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <h2 className="text-sm font-bold mb-1">Analysis Overview</h2>
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

  if (isError || !overviewData) {
    return (
      <div className="space-y-2">
        <div className="text-center">
          <BarChart3 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <h2 className="text-sm font-bold mb-1">Analysis Overview</h2>
          <p className="text-xs text-red-500">Unable to load data</p>
        </div>
      </div>
    );
  }

  const { total_logs, success_rate, hourly_activity } = overviewData;

  return (
    <div className="space-y-2">
      <div className="text-center">
        <BarChart3 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
        <h2 className="text-sm font-bold mb-1">Analysis Overview</h2>
        <p className="text-xs text-muted-foreground">Real-time data based</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="Total Logs" value={total_logs} subtitle="Real-time" color="blue" />
        <MetricCard title="Success Rate" value={`${success_rate}%`} subtitle="Metrics" color="green" />
      </div>

      {/* Hourly Activity Chart */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Hourly Activity</h4>
        <div className="h-20 flex items-center justify-center">
          <ChartContainer config={chartConfig} className="w-full">
            <LineChart data={hourly_activity} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-total)' }}
                activeDot={{ r: 4, fill: 'var(--color-total)' }}
              />
            </LineChart>
          </ChartContainer>
        </div>
        <p className="text-xs text-muted-foreground text-center">8-11 PM peak hours</p>
      </div>
    </div>
  );
};
