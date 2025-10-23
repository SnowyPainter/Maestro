import React from 'react';
import { LucideIcon, FileText, TrendingUp, GanttChartSquare, ClipboardList, FlaskConical, AlertCircle } from 'lucide-react';

interface TimelineIconProps {
  source: string;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  post_publication: FileText,
  trends: TrendingUp,
  campaign_kpi: GanttChartSquare,
  playbook: ClipboardList,
  abtest: FlaskConical,
  default: AlertCircle,
};

export const TimelineIcon: React.FC<TimelineIconProps> = ({ source, className }) => {
  const Icon = iconMap[source] || iconMap.default;
  return <Icon className={className} />;
};
