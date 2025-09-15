from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, List
from pydantic import BaseModel, Field, ConfigDict
from apps.backend.src.modules.common.enums import KPIKey, Aggregation

# v2 스타일
class CampaignBase(BaseModel):
    name: str = Field(..., max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

class CampaignOut(CampaignBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_user_id: int
    created_at: datetime

# --- KPI Defs ---

class CampaignKPIDefUpsert(BaseModel):
    key: KPIKey
    aggregation: Aggregation = Aggregation.SUM
    target_value: Optional[float] = None
    weight: float = 1.0

class CampaignKPIDefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    campaign_id: int
    key: KPIKey
    aggregation: Aggregation
    target_value: Optional[float] = None
    weight: float = 1.0

# --- KPI Results (timeseries) ---

class CampaignKPIResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    campaign_id: int
    as_of: datetime
    values: Dict[str, float]

# 리스트 응답 포맷(편의)
class PaginatedCampaigns(BaseModel):
    items: List[CampaignOut]
    total: int

class KPIResultsSeries(BaseModel):
    campaign_id: int
    points: List[CampaignKPIResultOut]
