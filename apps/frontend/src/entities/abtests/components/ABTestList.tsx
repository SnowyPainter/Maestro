import { ABTestOut, CampaignOut, useBffAbtestsListApiBffAbtestsGet, useBffCampaignsListCampaignsApiBffCampaignsGet } from "@/lib/api/generated";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ABTestDetail from "./ABTestDetail";
import { AlertCircle, TestTube, Calendar } from "lucide-react";

interface ABTestListProps {
  onSelectABTest?: (abTestId: number) => void;
}

const ABTestList = ({ onSelectABTest }: ABTestListProps) => {
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useBffCampaignsListCampaignsApiBffCampaignsGet({});
  const { data: abTestsData, isLoading: isLoadingABTests, error: abTestsError } = useBffAbtestsListApiBffAbtestsGet({});

  const campaignsById = useMemo(() => {
    if (!campaignsData) return new Map<number, CampaignOut>();
    return new Map(campaignsData.map((c) => [c.id, c]));
  }, [campaignsData]);

  const abTests = abTestsData?.items || [];

  if (isLoadingABTests || isLoadingCampaigns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            All A/B Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (abTestsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            All A/B Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-destructive text-center">Error loading A/B tests.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (abTests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            All A/B Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <TestTube className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No A/B tests found</h3>
            <p className="text-muted-foreground text-center">
              You haven't created any A/B tests yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          All A/B Tests
        </CardTitle>
      </CardHeader>
      <CardContent className="max-w-6xl">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/50">
                <TableHead className="w-16 h-12">ID</TableHead>
                <TableHead className="h-12">Variable</TableHead>
                <TableHead className="w-24 h-12">Status</TableHead>
                <TableHead className="w-32 h-12">Campaign</TableHead>
                <TableHead className="w-32 h-12">Started</TableHead>
                <TableHead className="w-16 h-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abTests.map((test) => {
                const campaign = campaignsById.get(test.campaign_id);
                return (
                  <TableRow
                    key={test.id}
                    className="h-14 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => onSelectABTest?.(test.id)}
                  >
                    <TableCell className="font-medium text-sm">#{test.id}</TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-xs truncate">
                        {test.variable}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={test.finished_at ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {test.finished_at ? "Completed" : "Running"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign?.name || `ID: ${test.campaign_id}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(test.started_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectABTest?.(test.id);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ABTestList;
