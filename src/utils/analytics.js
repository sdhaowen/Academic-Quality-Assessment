import dayjs from "dayjs";
import { TIME_SPAN_OPTIONS } from "../config/indicators";

function sortAssessments(assessments) {
  return [...assessments].sort((a, b) => a.assessedAt - b.assessedAt);
}

export function scoreSeriesToArray(scoreObject, indicators) {
  return indicators.map((indicator) => Number(scoreObject[indicator.key] ?? 0));
}

function calculateAverage(assessmentList, indicators) {
  if (!assessmentList.length) {
    return indicators.reduce((acc, indicator) => {
      acc[indicator.key] = 0;
      return acc;
    }, {});
  }

  const sum = indicators.reduce((acc, indicator) => {
    acc[indicator.key] = 0;
    return acc;
  }, {});

  assessmentList.forEach((assessment) => {
    indicators.forEach((indicator) => {
      sum[indicator.key] += Number(assessment.scores[indicator.key] ?? 0);
    });
  });

  return indicators.reduce((acc, indicator) => {
    acc[indicator.key] = Number((sum[indicator.key] / assessmentList.length).toFixed(2));
    return acc;
  }, {});
}

function getLatestAssessmentByStudentMap(students, assessments, stage) {
  const stageAssessments = assessments.filter((item) => item.stage === stage);
  const latestMap = new Map();

  students.forEach((student) => {
    const list = stageAssessments
      .filter((item) => item.studentId === student.id)
      .sort((a, b) => b.assessedAt - a.assessedAt);
    if (list.length) {
      latestMap.set(student.id, list[0]);
    }
  });
  return latestMap;
}

export function computeStudentGrowthSeries(assessments, studentId, stage, indicators) {
  const list = sortAssessments(
    assessments.filter((item) => item.studentId === studentId && item.stage === stage),
  );
  return list.map((item, index) => ({
    name: `${dayjs(item.assessedAt).format("YYYY-MM-DD")}（第${index + 1}次）`,
    values: scoreSeriesToArray(item.scores, indicators),
    lineStyle: { width: 2 },
    areaStyle: { opacity: 0.12 },
  }));
}

export function computeClassAverageScores(students, assessments, className, stage, indicators) {
  const classStudents = students.filter(
    (student) => student.stage === stage && student.className === className,
  );
  const latestMap = getLatestAssessmentByStudentMap(classStudents, assessments, stage);
  const records = classStudents.map((student) => latestMap.get(student.id)).filter(Boolean);

  return {
    count: classStudents.length,
    averageScores: calculateAverage(records, indicators),
  };
}

export function computeMultiClassComparison(students, assessments, classNames, stage, indicators) {
  return classNames.map((className) => {
    const { averageScores } = computeClassAverageScores(
      students,
      assessments,
      className,
      stage,
      indicators,
    );
    return {
      name: className,
      values: scoreSeriesToArray(averageScores, indicators),
      lineStyle: { width: 2 },
    };
  });
}

export function computeSchoolComparison(students, assessments, schoolNames, stage, indicators) {
  const stageStudents = students.filter((student) => student.stage === stage);
  const latestMap = getLatestAssessmentByStudentMap(stageStudents, assessments, stage);
  return schoolNames.map((schoolName) => {
    const schoolStudents = stageStudents.filter((student) => student.school === schoolName);
    const records = schoolStudents.map((student) => latestMap.get(student.id)).filter(Boolean);
    const avg = calculateAverage(records, indicators);
    return {
      name: schoolName,
      values: scoreSeriesToArray(avg, indicators),
      lineStyle: { width: 2 },
    };
  });
}

export function computeImprovementAnalysis(
  assessments,
  studentId,
  stage,
  indicators,
  selectedTimeSpan,
) {
  const months =
    TIME_SPAN_OPTIONS.find((item) => item.value === selectedTimeSpan)?.months ?? 6;
  const records = sortAssessments(
    assessments.filter((item) => item.studentId === studentId && item.stage === stage),
  );
  if (records.length < 2) {
    return null;
  }

  const latest = records.at(-1);
  const cutoff = dayjs(latest.assessedAt).subtract(months, "month").valueOf();
  const firstInRange = records.find((item) => item.assessedAt >= cutoff);
  const baseline = firstInRange ?? records[0];

  const deltas = indicators.map((indicator) => {
    const delta = Number(
      (Number(latest.scores[indicator.key] ?? 0) - Number(baseline.scores[indicator.key] ?? 0)).toFixed(2),
    );
    return {
      key: indicator.key,
      label: indicator.label,
      delta,
    };
  });

  const sortedByDelta = [...deltas].sort((a, b) => b.delta - a.delta);
  const fastestImprovement = sortedByDelta[0];
  const needsAttention = sortedByDelta.at(-1);
  const baselineTotal =
    indicators.reduce((sum, indicator) => sum + Number(baseline.scores[indicator.key] ?? 0), 0) || 1;
  const latestTotal = indicators.reduce(
    (sum, indicator) => sum + Number(latest.scores[indicator.key] ?? 0),
    0,
  );
  const improvementRate = Number((((latestTotal - baselineTotal) / baselineTotal) * 100).toFixed(2));

  return {
    baseline,
    latest,
    baselineSeries: scoreSeriesToArray(baseline.scores, indicators),
    latestSeries: scoreSeriesToArray(latest.scores, indicators),
    improvementRate,
    fastestImprovement,
    needsAttention,
    deltas,
  };
}
