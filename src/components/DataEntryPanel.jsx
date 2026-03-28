import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { SCORE_LEVEL_REFERENCE } from "../config/indicators";

function StarInput({ value, onChange, label }) {
  return (
    <div className="star-row">
      <span className="star-label">{label}</span>
      <div className="stars" title={SCORE_LEVEL_REFERENCE[value] || "请选择 1-5 分"}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            key={score}
            className={score <= value ? "star active" : "star"}
            onClick={() => onChange(score)}
            title={`${score} 分：${SCORE_LEVEL_REFERENCE[score]}`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="star-score">{value} 分</span>
    </div>
  );
}

function DataEntryPanel({
  stageIndicators,
  stageStudents,
  onSubmitManual,
  selectedStudentId,
  onSelectStudent,
}) {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [scores, setScores] = useState(
    stageIndicators.reduce((acc, item) => {
      acc[item.key] = 3;
      return acc;
    }, {})
  );
  const [error, setError] = useState("");

  const selectedStudent = useMemo(
    () => stageStudents.find((student) => student.id === selectedStudentId),
    [stageStudents, selectedStudentId]
  );

  useEffect(() => {
    setScores(
      stageIndicators.reduce((acc, item) => {
        acc[item.key] = 3;
        return acc;
      }, {})
    );
  }, [stageIndicators]);

  function handleScoreChange(indicatorKey, value) {
    setScores((prev) => ({ ...prev, [indicatorKey]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!selectedStudent) {
      setError("请先选择学生。");
      return;
    }
    const parsed = dayjs(date);
    if (!parsed.isValid()) {
      setError("请选择有效的评价日期。");
      return;
    }
    onSubmitManual({
      studentId: selectedStudent.id,
      stage: selectedStudent.stage,
      scores,
      assessedAt: parsed.valueOf(),
    });
  }

  return (
    <section className="panel">
      <div className="panel-title-row">
        <h3>手动录入（1-5 星）</h3>
        <span className="security-tip">
          安全提示：请仅在校内环境使用，避免上传隐私敏感信息。
        </span>
      </div>

      <form className="manual-form" onSubmit={handleSubmit}>
        <div className="form-meta-grid">
          <label>
            学生
            <select value={selectedStudentId} onChange={(event) => onSelectStudent(event.target.value)}>
              {!stageStudents.length ? <option value="">暂无学生数据</option> : null}
              {stageStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}（{student.className} / {student.school}）
                </option>
              ))}
            </select>
          </label>
          <label>
            评价日期
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>

        <div className="stars-group">
          {stageIndicators.map((indicator) => (
            <StarInput
              key={indicator.key}
              value={scores[indicator.key] ?? 3}
              label={indicator.label}
              onChange={(value) => handleScoreChange(indicator.key, value)}
            />
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn-primary">
          保存评价记录
        </button>
      </form>
    </section>
  );
}

export default DataEntryPanel;
