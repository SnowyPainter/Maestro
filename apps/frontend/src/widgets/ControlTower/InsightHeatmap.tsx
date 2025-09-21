import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const HeatmapCell = ({ date, score }: { date: string, score: number }) => {
    const opacity = Math.max(0.1, score); // Ensure even low scores are visible
    const scorePercentage = (score * 100).toFixed(0);

    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="aspect-square rounded-sm bg-primary cursor-pointer" style={{ opacity }} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{date}: Engagement Score {scorePercentage}%</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export function InsightHeatmap({ data }: { data: { date: string, score: number }[] }) {
    return (
        <div>
            <h3 className="text-base font-semibold mb-2">Engagement Heatmap (Last 90 Days)</h3>
            <div className="grid grid-cols-15 md:grid-cols-20 lg:grid-cols-30 grid-flow-col grid-rows-7 gap-1 p-2 rounded-md bg-muted/50">
                {data.map(day => (
                    <HeatmapCell key={day.date} date={day.date} score={day.score} />
                ))}
            </div>
        </div>
    );
}
