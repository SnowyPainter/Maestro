import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OverviewPage } from "./dashboard/OverviewPage";
import { EventChainPage } from "./dashboard/EventChainPage";
import { PerformancePage } from "./dashboard/PerformancePage";
import { InsightsPage } from "./dashboard/InsightsPage";
import { RecommendationsPage } from "./dashboard/RecommendationsPage";

const pages = [
  { component: OverviewPage, title: "Overview" },
  { component: EventChainPage, title: "Event Chain" },
  { component: PerformancePage, title: "Performance" },
  { component: InsightsPage, title: "Insights" },
  { component: RecommendationsPage, title: "Recommendations" },
];

export function PlaybookAnalysisDashboard({ playbookId }: { playbookId: number }) {
  const [currentPage, setCurrentPage] = useState(0);
  const CurrentPageComponent = pages[currentPage].component;

  const goToPrev = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : pages.length - 1));
  };

  const goToNext = () => {
    setCurrentPage((prev) => (prev < pages.length - 1 ? prev + 1 : 0));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto relative h-128">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Playbook {playbookId} Analysis</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {pages.length}
            </span>
            <div className="flex gap-1">
              {pages.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full ${
                    index === currentPage ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-16 h-full overflow-y-auto">
        <CurrentPageComponent playbookId={playbookId} />

        {/* Floating navigation buttons - positioned at left/right middle height */}
        <Button
          size="sm"
          variant="secondary"
          onClick={goToPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 p-0 shadow-lg bg-background/90 backdrop-blur-sm hover:bg-background z-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={goToNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 p-0 shadow-lg bg-background/90 backdrop-blur-sm hover:bg-background z-10"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
