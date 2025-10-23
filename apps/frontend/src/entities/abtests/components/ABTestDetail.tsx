import { useBffAbtestsReadApiBffAbtestsAbtestIdGet, useBffDraftsReadDraftApiBffDraftsDraftIdGet } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeleteABTestButton from "@/features/abtests/components/DeleteABTestButton";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ABTestCompleteForm from "@/features/abtests/components/ABTestCompleteForm";
import ABTestEditForm from "@/features/abtests/components/ABTestEditForm";
import { Skeleton } from "@/components/ui/skeleton";

interface ABTestDetailProps {
  abTestId: number;
  onDelete: () => void;
}

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  running: "secondary",
  evaluate_ready: "default",
  completed: "outline",
};

const ABTestDetail = ({ abTestId, onDelete }: ABTestDetailProps) => {
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);

  const { data: abTest, isLoading, error } = useBffAbtestsReadApiBffAbtestsAbtestIdGet(abTestId);

  // Get variant details
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
  
  const statusBadge = useMemo(() => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      abTest.finished_at ? "bg-gray-100 text-gray-800" : "bg-blue-100 text-blue-800"
    }`}>
      {abTest.finished_at ? "Completed" : "Running"}
    </span>
  ), [abTest.finished_at]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <CardDescription>A/B Test ID: {abTest.id} {statusBadge}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {abTest.hypothesis && <p className="mb-2"><strong>Hypothesis:</strong> {abTest.hypothesis}</p>}
        {abTest.notes && <p className="mb-4"><strong>Notes:</strong> {abTest.notes}</p>}

        {/* Variants Details - Horizontal Layout */}
        <div className="flex gap-4 mb-4">
          {/* Variant A Details */}
          <div className="flex-1 p-4 border rounded-lg bg-blue-50 relative">
            {abTest.finished_at && abTest.winner_variant === 'A' && (
              <div className="absolute top-2 right-2 text-yellow-600 font-bold text-lg">👑</div>
            )}
            <h4 className="font-semibold text-blue-900 mb-2">Variant A</h4>
            {variantA ? (
              <div>
                <p className="text-sm text-blue-800 mb-1">
                  <strong>Title:</strong> {variantA.title || "Untitled"}
                </p>
                {variantA.goal && (
                  <p className="text-sm text-blue-800">
                    <strong>Goal:</strong> {variantA.goal}
                  </p>
                )}
                {abTest.finished_at && abTest.winner_variant === 'A' && abTest.uplift_percentage != null && (
                  <p className="text-sm text-blue-800 mt-2 font-semibold">
                    <strong>Uplift:</strong> {abTest.uplift_percentage}%
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-blue-600">Loading variant details...</p>
            )}
          </div>
          {/* Variant B Details */}
          <div className="flex-1 p-4 border rounded-lg bg-green-50 relative">
            {abTest.finished_at && abTest.winner_variant === 'B' && (
              <div className="absolute top-2 right-2 text-yellow-600 font-bold text-lg">👑</div>
            )}
            <h4 className="font-semibold text-green-900 mb-2">Variant B</h4>
            {variantB ? (
              <div>
                <p className="text-sm text-green-800 mb-1">
                  <strong>Title:</strong> {variantB.title || "Untitled"}
                </p>
                {variantB.goal && (
                  <p className="text-sm text-green-800">
                    <strong>Goal:</strong> {variantB.goal}
                  </p>
                )}
                {abTest.finished_at && abTest.winner_variant === 'B' && abTest.uplift_percentage != null && (
                  <p className="text-sm text-green-800 mt-2 font-semibold">
                    <strong>Uplift:</strong> {abTest.uplift_percentage}%
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-green-600">Loading variant details...</p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {abTest.finished_at === null && (
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
