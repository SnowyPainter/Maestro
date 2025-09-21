import { InsightHeatmap } from "./InsightHeatmap";
import { UnassignedDraftsList } from "./UnassignedDraftsList";
import { mockHeatmapData, mockUnassignedDrafts } from "./mock-data";

export function MonitoringPanel() {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
                <InsightHeatmap data={mockHeatmapData} />
            </div>
            <div>
                <UnassignedDraftsList drafts={mockUnassignedDrafts} />
            </div>
        </div>
    )
}