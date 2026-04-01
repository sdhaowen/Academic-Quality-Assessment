from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List

from .config import TIME_SPANS
from .models import Assessment, Student


def indicators_to_series(indicators: List[Dict[str, str]], score_map: Dict[str, float]) -> List[float]:
    return [float(score_map.get(item["key"], 0)) for item in indicators]


def _latest_by_student(assessments: Iterable[Assessment]) -> Dict[str, Assessment]:
    latest: Dict[str, Assessment] = {}
    for item in assessments:
        current = latest.get(item.student_id)
        if current is None or item.assessed_at > current.assessed_at:
            latest[item.student_id] = item
    return latest


def average_scores(records: List[Assessment], indicators: List[Dict[str, str]]) -> Dict[str, float]:
    if not records:
        return {item["key"]: 0.0 for item in indicators}

    sums = defaultdict(float)
    for rec in records:
        for indicator in indicators:
            key = indicator["key"]
            sums[key] += float(rec.scores.get(key, 0))
    return {item["key"]: round(sums[item["key"]] / len(records), 2) for item in indicators}


def class_average(
    students: List[Student],
    assessments: List[Assessment],
    class_name: str,
    stage: str,
    indicators: List[Dict[str, str]],
) -> Dict[str, float]:
    stage_students = [s for s in students if s.stage == stage and s.class_name == class_name]
    latest = _latest_by_student([a for a in assessments if a.stage == stage])
    selected_records = [latest[s.id] for s in stage_students if s.id in latest]
    return average_scores(selected_records, indicators)


def multi_class_series(
    students: List[Student],
    assessments: List[Assessment],
    class_names: List[str],
    stage: str,
    indicators: List[Dict[str, str]],
) -> Dict[str, List[float]]:
    output: Dict[str, List[float]] = {}
    for class_name in class_names:
        avg = class_average(students, assessments, class_name, stage, indicators)
        output[class_name] = indicators_to_series(indicators, avg)
    return output


def school_series(
    students: List[Student],
    assessments: List[Assessment],
    school_names: List[str],
    stage: str,
    indicators: List[Dict[str, str]],
) -> Dict[str, List[float]]:
    stage_students = [s for s in students if s.stage == stage]
    latest = _latest_by_student([a for a in assessments if a.stage == stage])
    output: Dict[str, List[float]] = {}
    for school in school_names:
        selected_students = [s for s in stage_students if s.school == school]
        records = [latest[s.id] for s in selected_students if s.id in latest]
        avg = average_scores(records, indicators)
        output[school] = indicators_to_series(indicators, avg)
    return output


def student_growth_records(
    assessments: List[Assessment],
    student_id: str,
    stage: str,
) -> List[Assessment]:
    return sorted(
        [a for a in assessments if a.student_id == student_id and a.stage == stage],
        key=lambda x: x.assessed_at,
    )


def improvement_analysis(
    assessments: List[Assessment],
    student_id: str,
    stage: str,
    indicators: List[Dict[str, str]],
    span_key: str,
) -> Dict | None:
    records = student_growth_records(assessments, student_id, stage)
    if len(records) < 2:
        return None
    latest = records[-1]
    months = TIME_SPANS[span_key]["months"]
    threshold_ms = latest.assessed_at - months * 30 * 24 * 3600 * 1000
    baseline = next((r for r in records if r.assessed_at >= threshold_ms), records[0])

    deltas = []
    for item in indicators:
        key = item["key"]
        delta = round(float(latest.scores.get(key, 0)) - float(baseline.scores.get(key, 0)), 2)
        deltas.append({"key": key, "label": item["label"], "delta": delta})

    sorted_deltas = sorted(deltas, key=lambda x: x["delta"], reverse=True)
    base_total = sum(float(baseline.scores.get(i["key"], 0)) for i in indicators) or 1.0
    latest_total = sum(float(latest.scores.get(i["key"], 0)) for i in indicators)
    rate = round((latest_total - base_total) / base_total * 100, 2)

    return {
        "baseline": baseline,
        "latest": latest,
        "baseline_series": indicators_to_series(indicators, baseline.scores),
        "latest_series": indicators_to_series(indicators, latest.scores),
        "improvement_rate": rate,
        "fastest": sorted_deltas[0],
        "needs_attention": sorted_deltas[-1],
        "deltas": deltas,
    }


def compare_groups(
    students: List[Student],
    assessments: List[Assessment],
    indicators: List[Dict[str, str]],
    group_names: List[str],
    group_field: str,
) -> List[Dict[str, List[float] | str]]:
    """Build radar series for class/school comparisons."""
    latest = _latest_by_student(assessments)
    series: List[Dict[str, List[float] | str]] = []
    for group_name in group_names:
        selected_students = [s for s in students if getattr(s, group_field) == group_name]
        records = [latest[s.id] for s in selected_students if s.id in latest]
        avg = average_scores(records, indicators)
        series.append({"name": group_name, "values": indicators_to_series(indicators, avg)})
    return series


def growth_series(
    assessments: List[Assessment],
    student_id: str,
    stage: str,
    indicators: List[Dict[str, str]],
) -> List[Dict[str, List[float] | str]]:
    records = student_growth_records(assessments, student_id, stage=stage)
    return [
        {
            "name": f"{idx + 1}次-{rec.assessed_at}",
            "values": indicators_to_series(indicators, rec.scores),
        }
        for idx, rec in enumerate(records)
    ]


def score_series_to_list(score_map: Dict[str, float], indicators: List[Dict[str, str]]) -> List[float]:
    return indicators_to_series(indicators, score_map)
