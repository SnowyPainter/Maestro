import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { List } from "lucide-react";

interface PlaybookToolCardProps {
  onSelect: () => void;
}

export function PlaybookToolCard({ onSelect }: PlaybookToolCardProps) {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>View Playbooks</CardTitle>
        <CardDescription>Browse and view your playbooks and their performance insights.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onSelect} variant="outline" className="w-full">
          <List className="mr-2 h-4 w-4" />
          Browse Playbooks
        </Button>
      </CardContent>
    </Card>
  );
}
