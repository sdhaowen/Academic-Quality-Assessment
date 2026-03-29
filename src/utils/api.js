const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败: ${response.status}`);
  }

  return response.json();
}

function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    studentNo: row.studentNo,
    className: row.className,
    school: row.school,
    stage: row.stage,
  };
}

function mapAssessment(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    stage: row.stage,
    scores: row.scores ?? {},
    assessedAt: Number(row.assessedAt),
  };
}

export async function fetchStudents(stage) {
  const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  const rows = await request(`/api/students${query}`);
  return rows.map(mapStudent);
}

export async function fetchAssessments(stage) {
  const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  const rows = await request(`/api/assessments${query}`);
  return rows.map(mapAssessment);
}

export async function createAssessment(record) {
  const row = await request("/api/assessments", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return mapAssessment(row);
}

export async function createAssessmentsBulk(records) {
  const result = await request("/api/assessments/bulk", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
  return Array.isArray(result.records) ? result.records.map(mapAssessment) : [];
}

