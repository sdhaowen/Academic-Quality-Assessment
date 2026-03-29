import { assessments as mockAssessments, students as mockStudents } from "../src/data/mockData.js";

function normalizeDate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : Date.now();
}

export function seedIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(1) AS count FROM students").get().count;
  if (count > 0) {
    return;
  }

  const insertStudent = db.prepare(`
    INSERT INTO students (id, name, student_no, class_name, school, stage)
    VALUES (@id, @name, @studentNo, @className, @school, @stage)
  `);

  const insertAssessment = db.prepare(`
    INSERT INTO assessments (id, student_id, stage, assessed_at, scores_json, created_at)
    VALUES (@id, @studentId, @stage, @assessedAt, @scoresJson, @createdAt)
  `);

  const studentTxn = db.transaction((rows) => {
    rows.forEach((row) => insertStudent.run(row));
  });
  const assessmentTxn = db.transaction((rows) => {
    rows.forEach((row) => insertAssessment.run(row));
  });

  studentTxn(mockStudents);
  assessmentTxn(
    mockAssessments.map((item) => ({
      id: item.id,
      studentId: item.studentId,
      stage: item.stage,
      assessedAt: normalizeDate(item.assessedAt),
      scoresJson: JSON.stringify(item.scores ?? {}),
      createdAt: Date.now(),
    })),
  );
}

