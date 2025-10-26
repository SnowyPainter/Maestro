import React from "react";
import { useBffPlaybookDashboardInsightsApiBffPlaybooksDashboardInsightsGet } from "@/lib/api/generated";
import { TrendingUp, Clock, Target, Users, Zap, Shield, Lightbulb } from "lucide-react";

interface InsightsPageProps {
  playbookId: number;
}

export const InsightsPage: React.FC<InsightsPageProps> = ({ playbookId }) => {
  const { data: insightsData, isLoading, isError } = useBffPlaybookDashboardInsightsApiBffPlaybooksDashboardInsightsGet({
    playbook_id: playbookId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <Lightbulb className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
          <h2 className="text-base font-bold mb-1">User Value</h2>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border bg-gray-50 p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !insightsData) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <Lightbulb className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
          <h2 className="text-base font-bold mb-1">User Value</h2>
          <p className="text-xs text-red-500">Unable to load data</p>
        </div>
      </div>
    );
  }

  const { persona_name, creator, manager, brand, overall_roi } = insightsData;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <Lightbulb className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
        <h2 className="text-base font-bold mb-1">User Value</h2>
        <p className="text-xs text-muted-foreground">Analysis by Role</p>
      </div>

      {/* Creator Card */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-blue-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-white" />
          </div>
          <h4 className="text-sm font-semibold text-blue-900">Content Creator</h4>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-lg font-bold text-blue-700">+{creator.engagement_improvement}%</div>
            <div className="text-xs text-blue-600">Engagement</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-700">{creator.optimal_time}</div>
            <div className="text-xs text-blue-600">Best Time</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-700">{creator.consistency_score}%</div>
            <div className="text-xs text-blue-600">Consistency</div>
          </div>
        </div>
      </div>

      {/* Manager Card */}
      <div className="rounded-lg border bg-gradient-to-r from-green-50 to-green-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <h4 className="text-sm font-semibold text-green-900">Community Manager</h4>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-lg font-bold text-green-700">
              {manager.response_time_reduction ? `-${manager.response_time_reduction}%` : 'N/A'}
            </div>
            <div className="text-xs text-green-600">Response Time</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-700">
              {manager.automation_rate ? `${manager.automation_rate}%` : 'N/A'}
            </div>
            <div className="text-xs text-green-600">Automation</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-700">
              {manager.monitoring_coverage ? `${manager.monitoring_coverage}%` : 'N/A'}
            </div>
            <div className="text-xs text-green-600">Monitoring</div>
          </div>
        </div>
      </div>

      {/* Brand Card */}
      <div className="rounded-lg border bg-gradient-to-r from-purple-50 to-purple-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <Shield className="w-3 h-3 text-white" />
          </div>
          <h4 className="text-sm font-semibold text-purple-900">Brand Manager</h4>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-lg font-bold text-purple-700">
              {brand.policy_compliance ? `${brand.policy_compliance}%` : 'N/A'}
            </div>
            <div className="text-xs text-purple-600">Policy Compliance</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-700">
              {brand.tone_consistency ? `${brand.tone_consistency}%` : 'N/A'}
            </div>
            <div className="text-xs text-purple-600">Tone Consistency</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-700">
              {brand.quality_assurance ? `${brand.quality_assurance}%` : 'N/A'}
            </div>
            <div className="text-xs text-purple-600">Quality Assurance</div>
          </div>
        </div>
      </div>

      {/* ROI Summary */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-900">Overall ROI</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-orange-700">{overall_roi.response_time_improvement}%</div>
            <div className="text-xs text-orange-600">Response Time Improvement</div>
          </div>
          <div>
            <div className="text-xl font-bold text-orange-700">{overall_roi.engagement_increase}%</div>
            <div className="text-xs text-orange-600">Engagement Increase</div>
          </div>
        </div>
      </div>
    </div>
  );
};
