import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calendar, Hash } from "lucide-react";
import { useListTrendsApiBffTrendsGet } from "@/lib/api/generated";
import { format, subDays } from "date-fns";

const parseDateKeyword = (keyword: string): Date | null => {
    const now = new Date();
    try {
        switch(keyword.toLowerCase()) {
            case 'today':
                return now;
            case 'yesterday':
                return subDays(now, 1);
            default:
                const d = new Date(keyword);
                if (!isNaN(d.getTime())) {
                    return d;
                }
                return null;
        }
    } catch {
        return null;
    }
}

const parseQuery = (query: string) => {
    const params: { q: string, limit?: number, since?: string, until?: string, on_date?: string } = { q: query };
    let tempQuery = query;

    const limitMatch = tempQuery.match(/limit:(\d+)/);
    if (limitMatch) {
        params.limit = parseInt(limitMatch[1], 10);
        tempQuery = tempQuery.replace(limitMatch[0], "").trim();
    }

    const sinceMatch = tempQuery.match(/since:(\S+)/);
    if (sinceMatch) {
        const date = parseDateKeyword(sinceMatch[1]);
        if (date) {
            params.since = format(date, 'yyyy-MM-dd');
            tempQuery = tempQuery.replace(sinceMatch[0], "").trim();
        }
    }

    const untilMatch = tempQuery.match(/until:(\S+)/);
    if (untilMatch) {
        const date = parseDateKeyword(untilMatch[1]);
        if (date) {
            params.until = format(date, 'yyyy-MM-dd');
            tempQuery = tempQuery.replace(untilMatch[0], "").trim();
        }
    }
    
    const onDateMatch = tempQuery.match(/on:(\S+)/);
    if (onDateMatch) {
        const date = parseDateKeyword(onDateMatch[1]);
        if (date) {
            params.on_date = format(date, 'yyyy-MM-dd');
            tempQuery = tempQuery.replace(onDateMatch[0], "").trim();
        }
    }

    params.q = tempQuery;
    return params;
};

export function TrendQueryCard({ onSubmit }: { onSubmit: (query: string, results: any) => void }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<"US" | "HK">("US");
  const [isQueryEnabled, setIsQueryEnabled] = useState(false);

  const parsedParams = parseQuery(query);

  const { data: trendData, isLoading } = useListTrendsApiBffTrendsGet(
    { ...parsedParams, country },
    { query: { enabled: isQueryEnabled, staleTime: Infinity, retry: false } }
  );

  useEffect(() => {
    if (isQueryEnabled && trendData) {
      onSubmit(parsedParams.q, trendData);
      setIsQueryEnabled(false);
    }
  }, [isQueryEnabled, trendData, onSubmit, parsedParams.q]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!query.trim() || isLoading) return;
        setIsQueryEnabled(true);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
        <Card className="shadow-md relative">
            {isLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-2xl"><p>Querying...</p></div>}
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    <CardTitle>Query Trends</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea
                    name="query"
                    placeholder="e.g., 'AI in healthcare' with keywords like 'limit:10', 'since:yesterday', or 'on:today'"
                    className="min-h-[100px]"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                            <Button type="button" variant={country === "US" ? "secondary" : "ghost"} size="sm" onClick={() => setCountry("US")} className="flex-1 px-3" disabled={isLoading}>US</Button>
                            <Button type="button" variant={country === "HK" ? "secondary" : "ghost"} size="sm" onClick={() => setCountry("HK")} className="flex-1 px-3" disabled={isLoading}>HK</Button>
                        </div>
                        {parsedParams.limit && (
                            <div className="flex items-center gap-1">
                                <Hash className="w-4 h-4" />
                                <span>{parsedParams.limit}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{parsedParams.on_date || (parsedParams.since || "any")}{parsedParams.until ? ` - ${parsedParams.until}` : ""}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}