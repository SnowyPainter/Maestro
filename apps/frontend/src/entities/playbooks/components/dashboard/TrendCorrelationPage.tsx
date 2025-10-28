import React from "react";
import { useBffPlaybookDashboardTrendCorrelationApiBffPlaybooksDashboardTrendCorrelationGet } from "@/lib/api/generated";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3, MapPin, Activity } from "lucide-react";

// Chart configuration
const chartConfig = {
  correlation: {
    label: "Correlation",
    color: "hsl(var(--chart-1))",
  },
  avg_rank: {
    label: "Avg Rank",
    color: "hsl(var(--chart-2))",
  },
  impressions: {
    label: "Impressions",
    color: "hsl(var(--chart-3))",
  },
  likes: {
    label: "Likes",
    color: "hsl(var(--chart-4))",
  },
  comments: {
    label: "Comments",
    color: "hsl(var(--chart-5))",
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

// Correlation strength indicator
const CorrelationIndicator: React.FC<{
  correlation: number | null;
  direction?: string;
  strength?: string;
  sampleSize?: number;
}> = ({ correlation, direction = "neutral", strength = "insufficient", sampleSize }) => {
  if (correlation === null || correlation === undefined) {
    if (sampleSize && sampleSize < 3) {
      return <span className="text-orange-600 text-xs">Need more data ({sampleSize} samples)</span>;
    }
    return <span className="text-muted-foreground text-xs">Insufficient data</span>;
  }

  const color = correlation > 0 ? "text-green-600" : correlation < 0 ? "text-red-600" : "text-gray-600";
  const bgColor = correlation > 0 ? "bg-green-100" : correlation < 0 ? "bg-red-100" : "bg-gray-100";

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${color}`}>
      <span>{correlation.toFixed(3)}</span>
      <span className="text-xs opacity-75">({direction})</span>
    </div>
  );
};

interface TrendCorrelationPageProps {
  playbookId: number;
}

export const TrendCorrelationPage: React.FC<TrendCorrelationPageProps> = ({ playbookId }) => {
  const { data: correlationData, isLoading, isError } = useBffPlaybookDashboardTrendCorrelationApiBffPlaybooksDashboardTrendCorrelationGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">Loading trend correlation data...</div>
      </div>
    );
  }

  if (isError || !correlationData) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-red-500">Failed to load trend correlation data</div>
      </div>
    );
  }

  // Prepare data for correlation heatmap
  const correlationMatrix = (correlationData.metric_correlations || []).map(item => ({
    metric: item.metric,
    correlation: item.correlation || 0,
    direction: item.direction,
    strength: item.strength,
  }));

  // Prepare data for trend rank vs metrics scatter plot
  const trendMetricsData = (correlationData.top_trends || []).flatMap(trend =>
    (trend.metrics || []).map(metric => ({
      trend_title: trend.trend_title,
      avg_rank: trend.avg_rank || 0,
      metric: metric.metric,
      average_value: metric.average_value,
      correlation: metric.correlation || 0,
    }))
  );

  // Prepare data for country insights bar chart
  const countryData = (correlationData.country_insights || []).map(country => ({
    country: country.country,
    sample_size: country.sample_size,
    ...country.avg_metrics,
  }));

  return (
    <div className="space-y-4">
      {/* Header with key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Total Samples"
          value={correlationData.total_samples || 0}
          subtitle="Data points analyzed"
          icon={<Activity className="w-4 h-4" />}
          color="blue"
        />
        <MetricCard
          title="Active Trends"
          value={(correlationData.top_trends || []).length}
          subtitle="Trends with correlation data"
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
        />
      </div>

      {/* Metric Correlations Heatmap */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Metric Correlations
        </h3>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="mb-2 text-xs text-muted-foreground">
            Correlation between trend popularity and performance metrics
          </div>
          <div className="grid grid-cols-1 gap-2">
            {correlationMatrix.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.metric}</span>
                  {item.metric === 'impressions' && (
                    <span className="text-xs text-orange-600">(all zeros)</span>
                  )}
                </div>
                <CorrelationIndicator
                  correlation={item.correlation}
                  direction={item.direction}
                  strength={item.strength}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend Rank vs Metrics Scatter Plot */}
      {trendMetricsData.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trend Rank vs Performance Correlation
          </h3>
          <div className="bg-muted/50 rounded-lg p-3">
            <ChartContainer config={chartConfig} className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={trendMetricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="avg_rank"
                    name="Trend Rank"
                    domain={[0, 'dataMax + 1']}
                    reversed
                  />
                  <YAxis
                    type="number"
                    dataKey="average_value"
                    name="Average Value"
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toFixed(2) : value,
                      name === 'average_value' ? 'Avg Value' : name
                    ]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.trend_title} - ${data.metric}` : label;
                    }}
                  />
                  <Scatter dataKey="average_value" fill="hsl(var(--chart-1))" />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Country Insights */}
      {countryData.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Country Performance Insights
          </h3>
          <div className="bg-muted/50 rounded-lg p-3">
            <ChartContainer config={chartConfig} className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="country" />
                  <YAxis />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toFixed(2) : value,
                      name
                    ]}
                  />
                  <Bar dataKey="likes" fill="hsl(var(--chart-4))" />
                  <Bar dataKey="comments" fill="hsl(var(--chart-5))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Top Trends List */}
      {(correlationData.top_trends || []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            Top Trends Analysis
            <span className="text-xs text-muted-foreground">
              (Note: Small sample sizes may limit correlation accuracy)
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(correlationData.top_trends || []).slice(0, 6).map((trend, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-3 border border-muted/50 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate mb-1">{trend.trend_title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Rank {trend.avg_rank?.toFixed(1) || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {trend.sample_size} samples
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="space-y-2">
                  {(trend.metrics || []).slice(0, 3).map((metric, metricIndex) => (
                    <div key={metricIndex} className="flex items-center justify-between py-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {metric.metric}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {metric.average_value.toFixed(1)}
                        </span>
                        <CorrelationIndicator
                          correlation={metric.correlation ?? null}
                          direction={metric.direction}
                          strength={metric.strength}
                          sampleSize={trend.sample_size}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Correlation Strength Indicator */}
                <div className="mt-3 pt-2 border-t border-muted/30">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overall Insight:</span>
                    <span className={`font-medium ${
                      (trend.metrics || []).some(m => m.correlation && Math.abs(m.correlation) > 0.3)
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }`}>
                      {(trend.metrics || []).some(m => m.correlation && Math.abs(m.correlation) > 0.3)
                        ? 'Strong signals'
                        : 'Limited data'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
