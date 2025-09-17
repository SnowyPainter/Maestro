import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CampaignToolCardProps {
  onNew: () => void;
  onSelect: () => void;
}

export function CampaignToolCard({ onNew, onSelect }: CampaignToolCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button onClick={onNew}>New Campaign</Button>
        <Button onClick={onSelect} variant="outline">Select Campaign</Button>
      </CardContent>
    </Card>
  );
}
