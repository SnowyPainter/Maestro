
import { ABTestOut } from "@/lib/api/generated";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DeleteABTestButton from "@/features/abtests/components/DeleteABTestButton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ABTestCompleteForm from "@/features/abtests/components/ABTestCompleteForm";
import ABTestEditForm from "@/features/abtests/components/ABTestEditForm";

interface ABTestCardProps {
  abTest: ABTestOut;
}

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  running: "secondary",
  evaluate_ready: "default",
  completed: "outline",
};

const ABTestCard = ({ abTest }: ABTestCardProps) => {
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);

  const displayName = `Test on: ${abTest.variable}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <Badge variant={statusVariant[abTest.finished_at ? "completed" : "running"] || "default"}>{abTest.finished_at ? "Completed" : "Running"}</Badge>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {abTest.hypothesis && <p className="mb-2"><strong>Hypothesis:</strong> {abTest.hypothesis}</p>}
        {abTest.notes && <p><strong>Notes:</strong> {abTest.notes}</p>}
        {abTest.finished_at && (
          <div className="mt-4 pt-4 border-t">
            <p className="font-semibold text-foreground">Result:</p>
            <p><strong>Winner:</strong> Variant {abTest.winner_variant}</p>
            {abTest.uplift_percentage != null && <p><strong>Uplift:</strong> {abTest.uplift_percentage}%</p>}
          </div>
        )}
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

export default ABTestCard;
