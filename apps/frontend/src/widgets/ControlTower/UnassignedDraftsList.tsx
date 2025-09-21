import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MockDraft } from "./mock-data";

export function UnassignedDraftsList({ drafts }: { drafts: MockDraft[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Unassigned Drafts</CardTitle>
                <CardDescription>These drafts are not linked to any campaign.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {drafts.map(draft => (
                        <div key={draft.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                            <div>
                                <p className="font-medium text-sm">{draft.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    Updated {new Date(draft.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    {draft.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
                                </div>
                                <Button variant="ghost" size="sm">Attach</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
