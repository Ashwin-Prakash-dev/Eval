from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class CriterionInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    weight: float = Field(gt=0, le=100)
    order_index: int = 0


class CriterionOut(CriterionInput):
    id: int

    model_config = {"from_attributes": True}


class RubricCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    disagreement_threshold: float = Field(default=1.5, gt=0, le=10)
    criteria: list[CriterionInput] = Field(min_length=1)

    @field_validator("criteria")
    @classmethod
    def weights_sum_to_100(cls, criteria: list[CriterionInput]) -> list[CriterionInput]:
        total = round(sum(c.weight for c in criteria), 2)
        if total != 100:
            raise ValueError(f"Criterion weights must total 100%, got {total}%")
        return criteria


class RubricUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    disagreement_threshold: float | None = Field(default=None, gt=0, le=10)
    is_active: bool | None = None
    criteria: list[CriterionInput] | None = None

    @model_validator(mode="after")
    def weights_sum_to_100(self) -> "RubricUpdate":
        if self.criteria is not None:
            total = round(sum(c.weight for c in self.criteria), 2)
            if total != 100:
                raise ValueError(f"Criterion weights must total 100%, got {total}%")
        return self


class RubricOut(BaseModel):
    id: int
    name: str
    is_active: bool
    disagreement_threshold: float
    created_at: datetime
    criteria: list[CriterionOut]

    model_config = {"from_attributes": True}
