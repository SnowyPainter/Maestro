import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendsListResponse, TrendItem } from "@/lib/api/generated";
import { BarChart3, Newspaper, Users, Infinity } from "lucide-react";

// 시간 차이를 상대적인 형식으로 변환하는 함수
function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return `${diffInSeconds}s ago`;
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days}d ago`;
        }
    } catch {
        return dateString; // 파싱 실패시 원본 반환
    }
}

function TrendItemDisplay({ item }: { item: TrendItem }) {
    return (
        <div className="border-t py-3">
            <div className="flex gap-4">
                {/* 왼쪽: 텍스트 정보 */}
                <div className="flex-1">
                    <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline text-base">
                        {item.rank}. {item.title}
                    </a>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {/* approx_traffic 표시 (없으면 무한대 아이콘) */}
                        <div className="flex items-center gap-1">
                            {item.approx_traffic ? (
                                <>
                                    <Users className="w-3 h-3" />
                                    <span>{item.approx_traffic} searches</span>
                                </>
                            ) : (
                                <>
                                    <Infinity className="w-3 h-3" />
                                    <span>unlimited</span>
                                </>
                            )}
                        </div>

                        {/* pubDate 표시 (상대적 시간 형식) */}
                        {item.pub_date && (
                            <div className="flex items-center gap-1">
                                <Newspaper className="w-3 h-3" />
                                <span>{formatRelativeTime(item.pub_date || "")}</span>
                            </div>
                        )}
                    </div>
                    {item.picture_source && (
                         <p className="text-xs text-muted-foreground mt-2">
                            Image source: {item.picture_source}
                        </p>
                    )}
                </div>

                {/* 오른쪽: 이미지 (항상 자리 확보) */}
                <div className="flex-shrink-0">
                    {item.picture ? (
                        <img src={item.picture} alt={item.title} className="w-24 h-24 object-cover rounded-lg" />
                    ) : (
                        <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-8 h-8 text-muted-foreground" />
                        </div>
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
