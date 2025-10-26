import React from "react";
import { useBffPlaybookDashboardEventChainApiBffPlaybooksDashboardEventChainGet } from "@/lib/api/generated";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from 'recharts';
import { Activity, Clock, TrendingUp } from "lucide-react";

// Chart configuration for event types
const chartConfig = {
  sync_metrics: {
    label: "Sync Metrics",
    color: "hsl(var(--chart-1))",
  },
  schedule: {
    label: "Schedule",
    color: "hsl(var(--chart-2))",
  },
  others: {
    label: "Others",
    color: "hsl(var(--chart-3))",
  },
  coworker_generated_text: {
    label: "Content Generation",
    color: "hsl(var(--chart-4))",
  },
  post_published: {
    label: "Post Published",
    color: "hsl(var(--chart-5))",
  },
}

interface EventChainPageProps {
  playbookId: number;
}

export const EventChainPage: React.FC<EventChainPageProps> = ({ playbookId }) => {
  const { data: eventChainData, isLoading, isError } = useBffPlaybookDashboardEventChainApiBffPlaybooksDashboardEventChainGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <Activity className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <h2 className="text-sm font-bold mb-1">Event Chain</h2>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
        <div className="space-y-2">
          <div className="p-2 bg-blue-50 rounded border animate-pulse">
            <div className="h-3 bg-blue-200 rounded mb-1"></div>
            <div className="h-2 bg-blue-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !eventChainData) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <Activity className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <h2 className="text-sm font-bold mb-1">Event Chain</h2>
          <p className="text-xs text-red-500">Unable to load data</p>
        </div>
      </div>
    );
  }

  const { event_types, avg_sync_interval_seconds, latest_kpi } = eventChainData;

  return (
    <div className="space-y-2">
      <div className="text-center">
        <Activity className="w-5 h-5 mx-auto mb-1 text-blue-500" />
        <h2 className="text-sm font-bold mb-1">Event Chain</h2>
        <p className="text-xs text-muted-foreground">Lifecycle Tracking</p>
      </div>

      <div className="space-y-2">
        <div className="p-2 bg-blue-50 rounded border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-medium">Metrics Collection</span>
          </div>
          <p className="text-xs text-blue-700">{Math.round(avg_sync_interval_seconds / 60)}-min intervals • 100% stability</p>
        </div>

        <div className="p-2 bg-green-50 rounded border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium">Peak Hours</span>
          </div>
          <p className="text-xs text-green-700">8-11 PM • 93% coverage</p>
        </div>

        {/* Event Type Distribution Chart */}
        <div className="space-y-2">
          <h5 className="text-xs font-semibold">Event Type Distribution</h5>
          <div className="h-32 flex items-center justify-center">
            <ChartContainer config={chartConfig} className="w-32 h-32">
              <PieChart width={128} height={128}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={event_types.map(item => ({ name: item.name, value: item.value }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={48}
                  innerRadius={24}
                  strokeWidth={2}
                  cx="50%"
                  cy="50%"
                >
                  {event_types.map((item, index) => {
                    const eventType = item.name.toLowerCase().replace(/\./g, '_').replace(/\s+/g, '_');
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {event_types.map((item, index) => (
              <div key={index} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center">
          {latest_kpi && Object.entries(latest_kpi).slice(0, 3).map(([key, value]) => (
            <div key={key} className="p-1 bg-purple-50 rounded">
              <div className="text-sm font-bold text-purple-900">
                {typeof value === 'number' ? value.toFixed(1) : value}
              </div>
              <div className="text-xs text-purple-700">{key}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
