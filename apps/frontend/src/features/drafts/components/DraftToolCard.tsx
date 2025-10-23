import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, List, BookOpen } from "lucide-react";

interface DraftToolCardProps {
  onNew: () => void;
  onSelect: () => void;
  onSelectListPublications: () => void;
}

export function DraftToolCard({ onNew, onSelect, onSelectListPublications }: DraftToolCardProps) {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Manage Drafts & Publications</CardTitle>
        <CardDescription>Create drafts, select existing ones, or view post publications.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <Button onClick={onNew} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New
        </Button>
        <Button onClick={onSelect} variant="outline">
          <List className="mr-2 h-4 w-4" />
          Select Draft
        </Button>
        <Button onClick={onSelectListPublications} variant="outline">
          <BookOpen className="mr-2 h-4 w-4" />
          List Publications
        </Button>
      </CardContent>
    </Card>
  );
}
