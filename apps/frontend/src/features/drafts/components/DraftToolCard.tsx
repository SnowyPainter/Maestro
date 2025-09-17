import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DraftToolCardProps {
  onNew: () => void;
  onSelect: () => void;
}

export function DraftToolCard({ onNew, onSelect }: DraftToolCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drafts</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button onClick={onNew}>New Draft</Button>
        <Button onClick={onSelect} variant="outline">Select Draft</Button>
      </CardContent>
    </Card>
  );
}
