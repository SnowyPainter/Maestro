import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PersonaToolCardProps {
  onNew: () => void;
  onSelect: () => void;
}

export function PersonaToolCard({ onNew, onSelect }: PersonaToolCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personas</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button onClick={onNew}>New Persona</Button>
        <Button onClick={onSelect} variant="outline">Select Persona</Button>
      </CardContent>
    </Card>
  );
}
