import React from "react";
import { useBffPlaybookDashboardRecommendationsApiBffPlaybooksDashboardRecommendationsGet } from "@/lib/api/generated";
import { CheckCircle, Clock, Rocket, TrendingUp, Target, Zap, Shield, Brain, MapPin } from "lucide-react";

interface RecommendationsPageProps {
  playbookId: number;
}

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({ playbookId }) => {
  const { data: recommendationsData, isLoading, isError } = useBffPlaybookDashboardRecommendationsApiBffPlaybooksDashboardRecommendationsGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <MapPin className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <h2 className="text-sm font-bold mb-1">Development Roadmap</h2>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="relative">
              <div className="ml-6 p-3 bg-gray-50 rounded-lg border animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !recommendationsData) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <MapPin className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <h2 className="text-sm font-bold mb-1">Development Roadmap</h2>
          <p className="text-xs text-red-500">Unable to load data</p>
        </div>
      </div>
    );
  }

  const { phases, overall_roi, dynamic_recommendations } = recommendationsData;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <MapPin className="w-5 h-5 mx-auto mb-1 text-purple-500" />
        <h2 className="text-sm font-bold mb-1">Development Roadmap</h2>
        <p className="text-xs text-muted-foreground">Implementation Plan by Phase</p>
      </div>

    {/* Dynamic Phases from Data */}
    {phases.map((phase, index) => {
      const getStatusColor = (status: string) => {
        switch (status) {
          case 'completed': return 'green';
          case 'in_progress': return 'yellow';
          case 'planned': return 'blue';
          default: return 'gray';
        }
      };

      const getStatusIcon = (status: string) => {
        switch (status) {
          case 'completed': return CheckCircle;
          case 'in_progress': return Clock;
          case 'planned': return Rocket;
          default: return Target;
        }
      };

      const color = getStatusColor(phase.status);
      const StatusIcon = getStatusIcon(phase.status);

      return (
        <div key={phase.id} className="relative">
          <div className={`absolute -left-3 top-4 w-6 h-6 bg-${color}-500 rounded-full flex items-center justify-center z-10`}>
            <StatusIcon className="w-4 h-4 text-white" />
          </div>
          <div className={`ml-6 p-3 bg-gradient-to-r from-${color}-50 to-${color}-100 rounded-lg border-2 border-${color}-200`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold text-${color}-900`}>{phase.title}</span>
                <span className={`px-2 py-0.5 bg-${color}-100 text-${color}-800 text-xs rounded-full font-medium`}>
                  {phase.status === 'completed' ? 'Completed' :
                   phase.status === 'in_progress' ? 'In Progress' :
                   phase.status === 'planned' ? 'Planned' : phase.status}
                </span>
              </div>
              <div className={`text-xs text-${color}-700 font-medium`}>
                {phase.status === 'planned' ? 'Ready' : `${phase.progress}%`}
              </div>
            </div>
            <div className="space-y-1">
              {phase.features.map((feature, featureIndex) => (
                <div key={featureIndex} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 bg-${color}-500 rounded-full`}></div>
                  <span className={`text-xs text-${color}-800`}>{feature}</span>
                </div>
              ))}
            </div>
            {phase.status === 'in_progress' && (
              <div className="mt-2 w-full bg-yellow-200 rounded-full h-1.5">
                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${phase.progress}%` }}></div>
              </div>
            )}
          </div>
        </div>
      );
    })}

    {/* Dynamic Recommendations */}
    {dynamic_recommendations.length > 0 && (
      <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-blue-900">AI Recommendations</span>
        </div>
        <div className="space-y-1">
          {dynamic_recommendations.slice(0, 5).map((recommendation, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <span className="text-xs text-blue-800">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ROI Summary */}
    <div className="bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded-lg border-2 border-orange-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold text-orange-900">Business Impact</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-xl font-bold text-orange-700">{overall_roi.response_time_improvement}%</div>
          <div className="text-xs text-orange-600">Response Time Improvement</div>
          <div className="text-xs text-orange-500">24h → 9h average</div>
        </div>
        <div>
          <div className="text-xl font-bold text-orange-700">{overall_roi.engagement_increase}%</div>
          <div className="text-xs text-orange-600">Engagement Increase</div>
          <div className="text-xs text-orange-500">Content Effectiveness</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-orange-700">
        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        <span>Immediate benefits from Phase 1 completion</span>
      </div>
    </div>
    </div>
  );
}