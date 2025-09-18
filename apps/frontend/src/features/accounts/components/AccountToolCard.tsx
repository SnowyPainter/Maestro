
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, List, Link2 } from "lucide-react";

interface AccountToolCardProps {
  onNew: () => void;
  onSelect: () => void;
  onSelectLinks: () => void;
}

export function AccountToolCard({ onNew, onSelect, onSelectLinks }: AccountToolCardProps) {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Manage Accounts</CardTitle>
        <CardDescription>Create, edit, and manage your platform accounts and their persona links.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <Button onClick={onNew} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create
        </Button>
        <Button onClick={onSelect} variant="outline">
          <List className="mr-2 h-4 w-4" />
          Select
        </Button>
        <Button onClick={onSelectLinks} variant="outline">
          <Link2 className="mr-2 h-4 w-4" />
          View Links
        </Button>
      </CardContent>
    </Card>
  );
}
