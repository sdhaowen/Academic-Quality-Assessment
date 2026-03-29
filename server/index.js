import express from "express";
import cors from "cors";
import { db, dbPath, initDatabase } from "./db.js";
import { seedIfEmpty } from "./seed.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

initDatabase();
seedIfEmpty(db);

function parseScores(raw) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    database: dbPath,
  });
});

app.get("/api/students", (req, res) => {
  const stage = req.query.stage?.toString();
  const rows = stage
    ? db
        .prepare(
          "SELECT id, name, student_no AS studentNo, class_name AS className, school, stage FROM students WHERE stage = ? ORDER BY student_no ASC",
        )
        .all(stage)
    : db
        .prepare(
          "SELECT id, name, student_no AS studentNo, class_name AS className, school, stage FROM students ORDER BY stage ASC, student_no ASC",
        )
        .all();
  res.json(rows);
});

app.get("/api/assessments", (req, res) => {
  const stage = req.query.stage?.toString();
  const rows = stage
    ? db
        .prepare(
          "SELECT id, student_id AS studentId, stage, scores_json AS scoresJson, assessed_at AS assessedAt FROM assessments WHERE stage = ? ORDER BY assessed_at ASC",
        )
        .all(stage)
    : db
        .prepare(
          "SELECT id, student_id AS studentId, stage, scores_json AS scoresJson, assessed_at AS assessedAt FROM assessments ORDER BY assessed_at ASC",
        )
        .all();
  res.json(
    rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      stage: row.stage,
      assessedAt: Number(row.assessedAt),
      scores: parseScores(row.scoresJson),
    })),
  );
});

app.post("/api/assessments", (req, res) => {
  const { id, studentId, stage, scores, assessedAt } = req.body || {};
  if (!id || !studentId || !stage || !scores || !assessedAt) {
    res.status(400).json({ message: "参数不完整。" });
    return;
  }

  db.prepare(
    `
    INSERT OR REPLACE INTO assessments (id, student_id, stage, scores_json, assessed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(id, studentId, stage, JSON.stringify(scores), Number(assessedAt), Date.now());

  res.status(201).json({
    id,
    studentId,
    stage,
    scores,
    assessedAt: Number(assessedAt),
  });
});

app.post("/api/assessments/bulk", (req, res) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) {
    res.status(400).json({ message: "records 不能为空。" });
    return;
  }

  const insertStmt = db.prepare(
    `
    INSERT OR REPLACE INTO assessments (id, student_id, stage, scores_json, assessed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  const transaction = db.transaction((items) => {
    items.forEach((item) => {
      insertStmt.run(
        item.id,
        item.studentId,
        item.stage,
        JSON.stringify(item.scores),
        Number(item.assessedAt),
        Date.now(),
      );
    });
  });

  transaction(records);
  res.status(201).json({
    imported: records.length,
    records: records.map((item) => ({
      id: item.id,
      studentId: item.studentId,
      stage: item.stage,
      scores: item.scores,
      assessedAt: Number(item.assessedAt),
    })),
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server ready at http://localhost:${PORT}`);
});
