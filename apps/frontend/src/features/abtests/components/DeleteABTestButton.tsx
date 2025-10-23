import { useAbtestsDeleteAbtestApiOrchestratorAbtestsAbtestIdDelete } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DeleteABTestButtonProps {
  abTestId: number;
}

const DeleteABTestButton = ({ abTestId }: DeleteABTestButtonProps) => {
  const queryClient = useQueryClient();
  const deleteMutation = useAbtestsDeleteAbtestApiOrchestratorAbtestsAbtestIdDelete({
    mutation: {
    onSuccess: () => {
      toast.success("A/B Test deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ['abtests'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete A/B Test: ${error.detail[0].msg}`);
    },
  }});

  const handleDelete = () => {
    deleteMutation.mutate({ abtestId: abTestId });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the A/B test.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteABTestButton;