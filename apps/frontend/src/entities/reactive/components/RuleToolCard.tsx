import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Activity, List } from "lucide-react";

interface RuleToolCardProps {
  onCreateRule: () => void;
  onViewActivity: () => void;
  onSelectRule: () => void;
}

export function RuleToolCard({ onCreateRule, onViewActivity, onSelectRule }: RuleToolCardProps) {
  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Manage Reactive Rules</CardTitle>
        <CardDescription>Create automation rules or view activity logs.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Button onClick={onCreateRule} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
        <Button onClick={onSelectRule} variant="outline">
          <List className="mr-2 h-4 w-4" />
          Select Rule
        </Button>
        <Button onClick={onViewActivity} variant="outline" className="col-span-2">
          <Activity className="mr-2 h-4 w-4" />
          View Activity
        </Button>
      </CardContent>
    </Card>
  );
}
