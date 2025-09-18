import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, List } from "lucide-react";

interface PersonaToolCardProps {
  onNew: () => void;
  onSelect: () => void;
}

export function PersonaToolCard({ onNew, onSelect }: PersonaToolCardProps) {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Manage Personas</CardTitle>
        <CardDescription>Create a new persona or select an existing one.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Button onClick={onNew} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New
        </Button>
        <Button onClick={onSelect} variant="outline">
          <List className="mr-2 h-4 w-4" />
          Select Existing
        </Button>
      </CardContent>
    </Card>
  );
}
