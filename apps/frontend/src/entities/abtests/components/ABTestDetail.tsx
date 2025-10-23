import { DraftIRBlocksItem, DraftOut, useBffAbtestsReadApiBffAbtestsAbtestIdGet, useBffDraftsReadDraftApiBffDraftsDraftIdGet } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeleteABTestButton from "@/features/abtests/components/DeleteABTestButton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ABTestCompleteForm from "@/features/abtests/components/ABTestCompleteForm";
import ABTestEditForm from "@/features/abtests/components/ABTestEditForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { CreateABTestScheduleForm } from "@/features/schedules/components/CreateABTestScheduleForm";

interface ABTestDetailProps {
  abTestId: number;
  onDelete: () => void;
}


interface VariantCardProps {
  variant: any;
  variantName: string;
  isWinner: boolean;
  upliftPercentage: number | null | undefined;
  isEstimated?: boolean;
  bgColor: string;
  textColor: string;
}
const VariantCard = ({ variant, variantName, isWinner, upliftPercentage, isEstimated = false, bgColor, textColor }: VariantCardProps) => {
  return (
    <div className={`flex-1 p-4 border rounded-lg ${bgColor} relative`}>
      {isWinner && (
        <div className="absolute top-2 right-2 text-yellow-600 font-bold text-lg">
          👑{isEstimated && <span className="text-xs ml-1">(Est.)</span>}
        </div>
      )}
      <h4 className={`font-semibold ${textColor} mb-2`}>{variantName}</h4>
      {variant ? (
        <div>
          <p className={`text-sm ${textColor} mb-1`}>
            <strong>Title:</strong> {variant.title || "Untitled"}
          </p>
          {variant.ir?.blocks?.map((block: any, index: number) => (
            <p className={`text-sm ${textColor}`} key={`${block.type}-${index}`}>
              {block.type === "text"
                ? ((block.props?.markdown as string)?.length > 60
                  ? (block.props.markdown as string).substring(0, 60) + "..."
                  : (block.props.markdown as string))
                : block.type === "image"
                  ? (block.props?.url as string)
                  : (block.props?.video_url as string)}
            </p>
          ))}
          {variant.tags && variant.tags.length > 0 && (
            <p className={`text-sm ${textColor}`}>
              <strong>Tags:</strong> {variant.tags.join(", ")}
            </p>
          )}
          {variant.goal && (
            <p className={`text-sm ${textColor}`}>
              <strong>Goal:</strong> {variant.goal}
            </p>
          )}
          {isWinner && upliftPercentage != null && (
            <p className={`text-sm ${textColor} mt-2 font-semibold`}>
              <strong>Uplift:</strong> {upliftPercentage}%
            </p>
          )}
        </div>
      ) : (
        <p className={`text-sm ${textColor}`}>Loading variant details...</p>
      )}
    </div>
  );
};

const ABTestDetail = ({ abTestId, onDelete }: ABTestDetailProps) => {
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const { data: abTest, isLoading, error } = useBffAbtestsReadApiBffAbtestsAbtestIdGet(abTestId);

  // Always call hooks in the same order - use enabled to control execution
  const { data: variantA } = useBffDraftsReadDraftApiBffDraftsDraftIdGet(abTest?.variant_a_id || 0, {
    query: { enabled: !!abTest?.variant_a_id }
  });
  const { data: variantB } = useBffDraftsReadDraftApiBffDraftsDraftIdGet(abTest?.variant_b_id || 0, {
    query: { enabled: !!abTest?.variant_b_id }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (error || !abTest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Failed to load A/B Test details.</p>
        </CardContent>
      </Card>
    );
  }

  const displayName = `Test on: ${abTest.variable}`;

  const statusBadge = (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${abTest.finished_at ? "bg-gray-100 text-gray-800" : "bg-blue-100 text-blue-800"
      }`}>
      {abTest.finished_at ? "Completed" : "Running"}
    </span>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <CardDescription>A/B Test ID: {abTest.id} {statusBadge}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {abTest.hypothesis && <p className="mb-2"><strong>Hypothesis:</strong> {abTest.hypothesis}</p>}
        {abTest.notes && <p className="mb-4"><strong>Notes:</strong> {abTest.notes}</p>}

        {/* Insights Display */}
        {abTest.insights && (
          <div className="mb-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold mb-3 text-foreground">
              Test Results{!abTest.finished_at && abTest.insights.winner_variant ? ' (Estimated)' : ''}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Variant A Metrics */}
              <div className="space-y-2">
                <h5 className="font-medium text-blue-900">Variant A</h5>
                {abTest.insights.variant_a.metrics && Object.entries(abTest.insights.variant_a.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}:</span>
                    <span className="font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Publications:</span>
                  <span className="font-mono">{abTest.insights.variant_a.post_publication_ids?.length || 0}</span>
                </div>
              </div>

              {/* Variant B Metrics */}
              <div className="space-y-2">
                <h5 className="font-medium text-green-900">Variant B</h5>
                {abTest.insights.variant_b.metrics && Object.entries(abTest.insights.variant_b.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}:</span>
                    <span className="font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Publications:</span>
                  <span className="font-mono">{abTest.insights.variant_b.post_publication_ids?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Decision Summary */}
            {abTest.insights.decision_metric && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Decision Metric:</span>
                  <span className="font-medium capitalize">{abTest.insights.decision_metric.replace('_', ' ')}</span>
                </div>
                {abTest.insights.winner_variant && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Winner:</span>
                    <span className={`font-medium px-2 py-1 rounded text-xs ${
                      abTest.insights.winner_variant === 'A'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      Variant {abTest.insights.winner_variant}
                      {!abTest.finished_at && <span className="text-xs ml-1 opacity-75">(Estimated)</span>}
                    </span>
                  </div>
                )}
                {abTest.insights.uplift_percentage !== null && abTest.insights.uplift_percentage !== undefined && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Uplift:</span>
                    <span className={`font-medium ${abTest.insights.uplift_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {abTest.insights.uplift_percentage > 0 ? '+' : ''}{abTest.insights.uplift_percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Variants Details - Horizontal Layout */}
        <div className="flex gap-4 mb-4">
          <VariantCard
            variant={variantA}
            variantName="Variant A"
            isWinner={Boolean(abTest.finished_at ? abTest.winner_variant === 'A' : abTest.insights?.winner_variant === 'A')}
            upliftPercentage={abTest.finished_at ? abTest.uplift_percentage : abTest.insights?.uplift_percentage}
            isEstimated={!abTest.finished_at && Boolean(abTest.insights?.winner_variant)}
            bgColor="bg-blue-50"
            textColor="text-blue-900"
          />
          <VariantCard
            variant={variantB}
            variantName="Variant B"
            isWinner={Boolean(abTest.finished_at ? abTest.winner_variant === 'B' : abTest.insights?.winner_variant === 'B')}
            upliftPercentage={abTest.finished_at ? abTest.uplift_percentage : abTest.insights?.uplift_percentage}
            isEstimated={!abTest.finished_at && Boolean(abTest.insights?.winner_variant)}
            bgColor="bg-green-50"
            textColor="text-green-900"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {abTest.finished_at === null && abTest.persona_id && (
          <>
            <Dialog open={isScheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Schedule A/B Test</DialogTitle>
                </DialogHeader>
                <CreateABTestScheduleForm
                  abTestId={abTestId}
                  personaAccountId={abTest.persona_id}
                  onSuccess={() => setScheduleDialogOpen(false)}
                  onCancel={() => setScheduleDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit A/B Test</DialogTitle>
                </DialogHeader>
                <ABTestEditForm abTestId={abTest.id} onSuccess={() => setEditDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        )}
        {abTest.finished_at === null && (
          <Dialog open={isCompleteDialogOpen} onOpenChange={setCompleteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Complete Test</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete A/B Test</DialogTitle>
              </DialogHeader>
              <ABTestCompleteForm abTest={abTest} onSuccess={() => setCompleteDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
        <DeleteABTestButton abTestId={abTest.id} />
      </CardFooter>
    </Card>
  );
};

export default ABTestDetail;
