
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { List, PlusCircle, FlaskConical } from 'lucide-react';

interface ABTestToolCardProps {
  onNew: () => void;
  onSelect: () => void;
}

const ABTestToolCard = ({ onNew, onSelect }: ABTestToolCardProps) => {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader className="flex flex-row items-center gap-2">
        <FlaskConical className="w-6 h-6 text-primary" />
        <CardTitle>A/B Testing</CardTitle>
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
};

export default ABTestToolCard;