import { Button } from "@/components/ui/button";
import { Brain, Play, TrendingUp } from "lucide-react";

interface CopilotCardData {
    roi: {
        memoryReuse: number;
        savedMinutes: number;
        automationRate: number;
    };
    currentTask: {
        title: string;
        description: string;
    };
}

interface CopilotCardProps {
    data?: CopilotCardData;
    onExecute?: () => void;
}

const mockCopilotData: CopilotCardData = {
    roi: {
        memoryReuse: 42,
        savedMinutes: 36,
        automationRate: 0.64
    },
    currentTask: {
        title: "Spin new draft from Trend #Aurora",
        description: "Reuse CTA framework from last successful drop and localize for EMEA window."
    }
};

export function CopilotCard({ data, onExecute }: CopilotCardProps) {
    const card = data ?? mockCopilotData;

    return (
        <div className="space-y-4">
            <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                    Copilot
                </p>
            </div>

            {/* ROI Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        ROI Impact
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200/50">
                        <div className="p-1.5 bg-emerald-500 rounded-md mb-1">
                            <Brain className="h-3 w-3 text-white" />
                        </div>
                        <p className="text-[9px] text-emerald-700 uppercase tracking-wide font-medium text-center leading-tight">
                            Reuse
                        </p>
                        <p className="text-sm font-bold text-emerald-800">{card.roi.memoryReuse}×</p>
                    </div>

                    <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
                        <div className="p-1.5 bg-blue-500 rounded-md mb-1">
                            <TrendingUp className="h-3 w-3 text-white" />
                        </div>
                        <p className="text-[9px] text-blue-700 uppercase tracking-wide font-medium text-center leading-tight">
                            Saved
                        </p>
                        <p className="text-sm font-bold text-blue-800">{card.roi.savedMinutes}m</p>
                    </div>

                    <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200/50">
                        <div className="p-1.5 bg-purple-500 rounded-md mb-1">
                            <Play className="h-3 w-3 text-white" />
                        </div>
                        <p className="text-[9px] text-purple-700 uppercase tracking-wide font-medium text-center leading-tight">
                            Auto
                        </p>
                        <p className="text-sm font-bold text-purple-800">{(card.roi.automationRate * 100).toFixed(0)}%</p>
                    </div>
                </div>
            </div>

            {/* Current Task + Execute */}
            <div className="space-y-3">
                <div className="text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Current Task
                    </span>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                    <div className="text-center space-y-3">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-800 leading-tight">
                                {card.currentTask.title}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed max-w-[200px] mx-auto">
                                {card.currentTask.description}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={onExecute}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Execute Action
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
