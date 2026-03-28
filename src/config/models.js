function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.min(5, Math.max(1, Number(numeric.toFixed(2))));
}

export class StudentModel {
  constructor({ id, name, studentNo, className, school, stage }) {
    this.id = id;
    this.name = name;
    this.studentNo = studentNo;
    this.className = className;
    this.school = school;
    this.stage = stage;
  }
}

export class AssessmentModel {
  constructor({ id, studentId, stage, scores, assessedAt }) {
    this.id = id;
    this.studentId = studentId;
    this.stage = stage;
    this.assessedAt = assessedAt;
    this.scores = Object.entries(scores).reduce((acc, [key, value]) => {
      acc[key] = clampScore(value);
      return acc;
    }, {});
  }
}
