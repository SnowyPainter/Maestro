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
        <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Copilot
            </p>

            {/* ROI Section */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ROI Impact
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                        <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Memory Reuse</p>
                        <p className="text-lg font-bold text-emerald-700">{card.roi.memoryReuse}×</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-[10px] text-blue-600 uppercase tracking-wide">Time Saved</p>
                        <p className="text-lg font-bold text-blue-700">{card.roi.savedMinutes} min</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                        <p className="text-[10px] text-purple-600 uppercase tracking-wide">Automation</p>
                        <p className="text-lg font-bold text-purple-700">{(card.roi.automationRate * 100).toFixed(0)}%</p>
                    </div>
                </div>
            </div>

            {/* Current Task + Execute */}
            <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Current Task
                </p>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-sm font-medium text-foreground mb-1">{card.currentTask.title}</p>
                    <p className="text-xs text-muted-foreground mb-3">{card.currentTask.description}</p>
                    <Button
                        size="sm"
                        onClick={onExecute}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                    </Button>
                </div>
            </div>
        </div>
    );
}
