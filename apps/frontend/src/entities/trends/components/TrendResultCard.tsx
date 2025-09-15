import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendsListResponse, TrendItem } from "@/lib/api/generated";
import { BarChart3, Newspaper, Users } from "lucide-react";

function TrendItemDisplay({ item }: { item: TrendItem }) {
    return (
        <div className="border-t py-3">
            <div className="flex gap-4">
                {item.picture && (
                    <img src={item.picture} alt={item.title} className="w-24 h-24 object-cover rounded-lg" />
                )}
                <div className="flex-1">
                    <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline text-base">
                        {item.rank}. {item.title}
                    </a>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {item.approx_traffic && (
                            <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{item.approx_traffic} searches</span>
                            </div>
                        )}
                        {item.pubDate && (
                            <div className="flex items-center gap-1">
                                <Newspaper className="w-3 h-3" />
                                <span>{item.pubDate}</span>
                            </div>
                        )}
                    </div>
                    {item.picture_source && (
                         <p className="text-xs text-muted-foreground mt-2">
                            Image source: {item.picture_source}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}


export function TrendResultCard({ query, results }: { query: string, results: TrendsListResponse }) {
  return (
    <div className="w-full max-w-2xl mx-auto">
        <Card className="shadow-md">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <CardTitle>Trend Analysis</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                    Showing {results.items.length} results for: "{query}" in {results.country}
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {results.items.map((item, index) => (
                        <TrendItemDisplay key={index} item={item} />
                    ))}
                </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
                Data source: {results.source}
            </CardFooter>
        </Card>
    </div>
  );
}
