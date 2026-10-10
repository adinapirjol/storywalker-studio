from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class Request(Contract):
    direction: str = Field(min_length=3, max_length=500)
    scene: Literal["fictional-coast"] = "fictional-coast"

class Fragment(Contract):
    id: str
    title: str
    tags: list[str]
    frequency: float = Field(ge=80, le=1200)
    provenance: str
    license: Literal["synthetic"] = "synthetic"

class Cue(Contract):
    id: str = Field(pattern=r"^[a-z0-9-]+$", max_length=60)
    title: str = Field(min_length=1, max_length=120)
    source: Literal["demo"] = "demo"
    provenance: str = Field(min_length=1, max_length=500)
    note: str = Field(max_length=1000)
    x: float = Field(ge=-20, le=20)
    z: float = Field(ge=-20, le=20)
    radius: float = Field(ge=1, le=20)
    frequency: float = Field(ge=80, le=1200)
    minutes: int = Field(ge=1, le=120)
    treatment: Literal["synthetic-tone"] = "synthetic-tone"

class Scene(Contract):
    version: Literal[1] = 1
    title: str = Field(max_length=120)
    cues: list[Cue] = Field(min_length=1, max_length=12)

class Beat(Contract):
    cue_id: str
    start_seconds: int = Field(ge=0, le=120)
    duration_seconds: int = Field(ge=1, le=120)
    @model_validator(mode="after")
    def bounded(self):
        if self.start_seconds + self.duration_seconds > 120:
            raise ValueError("Rehearsal must fit within two minutes")
        return self

class Score(Contract):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str
    rationale: str = Field(max_length=1000)
    uncertainty: Literal["Composition proposal; no lived facts or emotional inference."] = "Composition proposal; no lived facts or emotional inference."
    source_ids: list[str]
    scene: Scene
    timing: list[Beat]
    @model_validator(mode="after")
    def consistent(self):
        ids = [c.id for c in self.scene.cues]
        if len(set(ids)) != len(ids) or sorted(b.cue_id for b in self.timing) != sorted(ids):
            raise ValueError("Each unique cue needs exactly one timing instruction")
        return self

class Result(Contract):
    fictional: Literal[True] = True
    canonical: Literal[False] = False
    model: str
    scores: list[Score] = Field(min_length=3, max_length=3)
