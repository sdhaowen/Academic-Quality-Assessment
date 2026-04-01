from __future__ import annotations

import json
import random
import sqlite3
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List

from .config import DB_FILE, STAGE_JUNIOR, STAGE_PRIMARY
from .indicators import INDICATOR_SETS
from .models import Assessment, Student


def get_connection() -> sqlite3.Connection:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            student_no TEXT NOT NULL UNIQUE,
            class_name TEXT NOT NULL,
            school TEXT NOT NULL,
            stage TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessments (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            scores_json TEXT NOT NULL,
            assessed_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id)
        );

        CREATE INDEX IF NOT EXISTS idx_students_stage ON students(stage);
        CREATE INDEX IF NOT EXISTS idx_assessments_stage ON assessments(stage);
        CREATE INDEX IF NOT EXISTS idx_assessments_student_time
            ON assessments(student_id, assessed_at);
        """
    )
    conn.commit()
    conn.close()


def _random_name(index: int) -> str:
    surnames = ["李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙"]
    givens = ["子涵", "雨桐", "浩然", "思远", "梓萱", "嘉宁", "一诺", "博文", "可欣", "俊杰", "若曦", "晨曦"]
    return f"{surnames[index % len(surnames)]}{givens[(index * 3) % len(givens)]}"


def _generate_students_for_stage(stage: str, count: int, offset: int) -> List[Student]:
    if stage == STAGE_PRIMARY:
        classes = ["小学-1班", "小学-2班", "小学-3班"]
        prefix = "P"
    else:
        classes = ["初中-1班", "初中-2班", "初中-3班"]
        prefix = "J"
    schools = ["启明实验学校", "远航学校", "星河中小学"]
    students: List[Student] = []
    for i in range(count):
        idx = i + offset
        students.append(
            Student(
                id=f"{prefix}{idx + 1:03d}",
                name=_random_name(idx),
                student_no=f"{prefix}-{10001 + idx}",
                class_name=classes[i % len(classes)],
                school=schools[i % len(schools)],
                stage=stage,
            )
        )
    return students


def _clamp_score(value: float) -> float:
    return max(1.0, min(5.0, round(value, 2)))


def _generate_scores(stage: str, baseline: float) -> Dict[str, float]:
    scores: Dict[str, float] = {}
    for indicator in INDICATOR_SETS[stage]:
        scores[indicator["key"]] = _clamp_score(baseline + random.uniform(-0.4, 0.6))
    return scores


def _generate_assessments(student: Student) -> List[Assessment]:
    checkpoints = [60, 12, 6]
    base = random.uniform(2.1, 3.5)
    rows: List[Assessment] = []
    for idx, months_ago in enumerate(checkpoints):
        growth = idx * random.uniform(0.35, 0.65)
        dt = datetime.now() - timedelta(days=months_ago * 30)
        rows.append(
            Assessment(
                id=f"{student.id}-A{idx + 1}",
                student_id=student.id,
                stage=student.stage,
                scores=_generate_scores(student.stage, base + growth),
                assessed_at=int(dt.timestamp() * 1000),
            )
        )
    return rows


def seed_if_empty() -> None:
    conn = get_connection()
    cur = conn.cursor()
    count = cur.execute("SELECT COUNT(1) AS c FROM students").fetchone()["c"]
    if count > 0:
        conn.close()
        return

    students = _generate_students_for_stage(STAGE_PRIMARY, 46, 0) + _generate_students_for_stage(
        STAGE_JUNIOR, 46, 100
    )
    now_ms = int(datetime.now().timestamp() * 1000)
    cur.executemany(
        """
        INSERT INTO students (id, name, student_no, class_name, school, stage)
        VALUES (:id, :name, :student_no, :class_name, :school, :stage)
        """,
        [asdict(s) for s in students],
    )

    assessments: List[Assessment] = []
    for s in students:
        assessments.extend(_generate_assessments(s))
    cur.executemany(
        """
        INSERT INTO assessments (id, student_id, stage, scores_json, assessed_at, created_at)
        VALUES (:id, :student_id, :stage, :scores_json, :assessed_at, :created_at)
        """,
        [
            {
                "id": a.id,
                "student_id": a.student_id,
                "stage": a.stage,
                "scores_json": json.dumps(a.scores, ensure_ascii=False),
                "assessed_at": a.assessed_at,
                "created_at": now_ms,
            }
            for a in assessments
        ],
    )
    conn.commit()
    conn.close()


def fetch_students(stage: str | None = None) -> List[Student]:
    conn = get_connection()
    cur = conn.cursor()
    if stage:
        rows = cur.execute(
            """
            SELECT id, name, student_no, class_name, school, stage
            FROM students
            WHERE stage = ?
            ORDER BY student_no ASC
            """,
            (stage,),
        ).fetchall()
    else:
        rows = cur.execute(
            """
            SELECT id, name, student_no, class_name, school, stage
            FROM students
            ORDER BY stage ASC, student_no ASC
            """
        ).fetchall()
    conn.close()
    return [
        Student(
            id=r["id"],
            name=r["name"],
            student_no=r["student_no"],
            class_name=r["class_name"],
            school=r["school"],
            stage=r["stage"],
        )
        for r in rows
    ]


def fetch_assessments(stage: str | None = None) -> List[Assessment]:
    conn = get_connection()
    cur = conn.cursor()
    if stage:
        rows = cur.execute(
            """
            SELECT id, student_id, stage, scores_json, assessed_at
            FROM assessments
            WHERE stage = ?
            ORDER BY assessed_at ASC
            """,
            (stage,),
        ).fetchall()
    else:
        rows = cur.execute(
            """
            SELECT id, student_id, stage, scores_json, assessed_at
            FROM assessments
            ORDER BY assessed_at ASC
            """
        ).fetchall()
    conn.close()
    return [
        Assessment(
            id=r["id"],
            student_id=r["student_id"],
            stage=r["stage"],
            scores=json.loads(r["scores_json"]),
            assessed_at=r["assessed_at"],
        )
        for r in rows
    ]


def insert_assessment(record: Assessment) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO assessments (id, student_id, stage, scores_json, assessed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            record.id,
            record.student_id,
            record.stage,
            json.dumps(record.scores, ensure_ascii=False),
            record.assessed_at,
            int(datetime.now().timestamp() * 1000),
        ),
    )
    conn.commit()
    conn.close()


def insert_assessments(records: Iterable[Assessment]) -> None:
    conn = get_connection()
    cur = conn.cursor()
    now_ms = int(datetime.now().timestamp() * 1000)
    cur.executemany(
        """
        INSERT OR REPLACE INTO assessments (id, student_id, stage, scores_json, assessed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                rec.id,
                rec.student_id,
                rec.stage,
                json.dumps(rec.scores, ensure_ascii=False),
                rec.assessed_at,
                now_ms,
            )
            for rec in records
        ],
    )
    conn.commit()
    conn.close()
