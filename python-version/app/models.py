from dataclasses import dataclass
from typing import Dict


@dataclass
class Student:
    id: str
    name: str
    student_no: str
    class_name: str
    school: str
    stage: str


@dataclass
class Assessment:
    id: str
    student_id: str
    stage: str
    scores: Dict[str, float]
    assessed_at: int
