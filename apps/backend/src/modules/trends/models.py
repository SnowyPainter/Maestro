from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class NewsItem(BaseModel):
    """개별 뉴스 아이템 스키마"""
    news_item_title: Optional[str] = None
    news_item_url: Optional[str] = None
    news_item_picture: Optional[str] = None
    news_item_source: Optional[str] = None

class TrendItem(BaseModel):
    """Google Trends 개별 트렌드 아이템 스키마"""
    rank: int = Field(..., description="트렌드 순위")
    retrieved: str = Field(..., description="데이터 수집 시각 (ISO format)")
    title: str = Field(..., description="트렌드 키워드")
    approx_traffic: Optional[str] = Field(None, description="대략적인 트래픽 (예: '200+', '1000+')")
    link: Optional[str] = Field(None, description="Google Trends 링크")
    pubDate: Optional[str] = Field(None, description="발행 날짜")
    picture: Optional[str] = Field(None, description="대표 이미지 URL")
    picture_source: Optional[str] = Field(None, description="이미지 출처")
    news_item: Optional[str] = Field(None, description="뉴스 아이템 (보통 빈 문자열)")
    news_items: Optional[List[NewsItem]] = Field(None, description="관련 뉴스 아이템 목록")
    
    # 추가 속성들을 위한 필드 (XML 속성이나 기타 필드)
    class Config:
        extra = "allow"  # 추가 필드 허용

class GoogleTrendsResponse(BaseModel):
    """Google Trends API 응답 전체 스키마"""
    country: str = Field(..., description="국가 코드 (예: KR, US)")
    max_items: int = Field(..., description="요청한 최대 아이템 수")
    retrieved_at: str = Field(..., description="전체 데이터 수집 시각")
    trends: List[TrendItem] = Field(..., description="트렌드 아이템 목록")
    total_count: int = Field(..., description="실제 반환된 트렌드 수")
    
    def pretty_print(self) -> str:
        """예쁘게 포맷된 문자열로 트렌드 데이터를 출력하는 헬퍼 메서드"""
        lines = []
        lines.append(f"Google Trends for {self.country}")
        lines.append(f"Retrieved at: {self.retrieved_at}")
        lines.append(f"Total trends: {self.total_count}/{self.max_items}")
        lines.append("=" * 50)
        
        for trend in self.trends:
            lines.append(f"#{trend.rank:2d} {trend.title}")
            if trend.approx_traffic:
                lines.append(f"     Traffic: {trend.approx_traffic}")
            if trend.pubDate:
                lines.append(f"     Published: {trend.pubDate}")
            if trend.news_items:
                lines.append(f"     Related news: {len(trend.news_items)} items")
            lines.append("")
        
        return "\n".join(lines)