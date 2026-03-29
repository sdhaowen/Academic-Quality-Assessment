import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { SCORE_LEVEL_REFERENCE } from "../config/indicators";

const REQUIRED_HEADERS = ["姓名", "学号", "评价日期"];

function validateScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return null;
  }
  return score;
}

export default function ExcelImportPanel({
  stage,
  students,
  onImported,
  indicatorList,
}) {
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState("");

  const indicatorNameMap = useMemo(() => {
    const map = {};
    indicatorList.forEach((item, idx) => {
      map[`指标${idx + 1}`] = item.key;
      map[item.label] = item.key;
    });
    return map;
  }, [indicatorList]);

  function parseRows(rows) {
    const imported = [];
    const localErrors = [];
    const studentByNo = new Map(
      students.filter((s) => s.stage === stage).map((s) => [s.studentNo, s]),
    );

    rows.forEach((row, index) => {
      const line = index + 2;
      const name = row["姓名"]?.toString().trim();
      const studentNo = row["学号"]?.toString().trim();
      const dateRaw = row["评价日期"];

      if (!name || !studentNo || !dateRaw) {
        localErrors.push(`第 ${line} 行：姓名/学号/评价日期 不能为空。`);
        return;
      }

      const student = studentByNo.get(studentNo);
      if (!student) {
        localErrors.push(`第 ${line} 行：学号 ${studentNo} 不在当前学段名单中。`);
        return;
      }

      const scores = {};
      let valid = true;

      Object.entries(indicatorNameMap).forEach(([colName, key]) => {
        if (scores[key] !== undefined) {
          return;
        }
        if (row[colName] === undefined) {
          return;
        }
        const score = validateScore(row[colName]);
        if (score === null) {
          localErrors.push(`第 ${line} 行：${colName} 分数必须在 1-5 之间。`);
          valid = false;
          return;
        }
        scores[key] = score;
      });

      indicatorList.forEach((item, idx) => {
        const col = `指标${idx + 1}`;
        if (scores[item.key] !== undefined) {
          return;
        }
        const value = row[col];
        const score = validateScore(value);
        if (score === null) {
          localErrors.push(`第 ${line} 行：${col} 分数必须在 1-5 之间。`);
          valid = false;
        } else {
          scores[item.key] = score;
        }
      });

      const parsedDate =
        typeof dateRaw === "number"
          ? XLSX.SSF.parse_date_code(dateRaw)
          : new Date(dateRaw);
      const timestamp =
        typeof dateRaw === "number" && parsedDate
          ? new Date(
              parsedDate.y,
              parsedDate.m - 1,
              parsedDate.d,
              parsedDate.H || 0,
              parsedDate.M || 0,
            ).getTime()
          : new Date(dateRaw).getTime();

      if (!Number.isFinite(timestamp)) {
        localErrors.push(`第 ${line} 行：评价日期格式无效。`);
        return;
      }

      if (!valid) {
        return;
      }

      imported.push({
        id: `IMP-${student.id}-${Date.now()}-${index}`,
        studentId: student.id,
        stage,
        scores,
        assessedAt: timestamp,
      });
    });

    return { imported, localErrors };
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    setErrors([]);
    setSummary("");
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = reader.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
        const headers = Object.keys(rows[0] || {});

        const missingHeaders = REQUIRED_HEADERS.filter(
          (header) => !headers.includes(header),
        );
        if (missingHeaders.length > 0) {
          setErrors([`缺少必需列：${missingHeaders.join("、")}`]);
          return;
        }

        const { imported, localErrors } = parseRows(rows);
        setErrors(localErrors);
        if (imported.length > 0) {
          await onImported(imported);
          setSummary(`导入成功 ${imported.length} 条记录，图表已自动刷新。`);
        } else {
          setSummary("未导入有效记录，请检查数据格式。");
        }
      } catch (error) {
        setErrors([`解析失败：${error.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <section className="card">
      <h3>Excel 导入</h3>
      <p className="safety-hint">
        安全提醒：请在校内环境使用，导入前避免包含身份证号、联系方式等敏感隐私信息。
      </p>
      <div className="excel-format-help">
        <strong>支持列名：</strong>
        <span>姓名、学号、指标1...指标8、评价日期（或对应中文指标名）</span>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls"
        className="file-input"
        onChange={handleFileChange}
      />
      {summary && <p className="success-text">{summary}</p>}
      {errors.length > 0 && (
        <ul className="error-list">
          {errors.slice(0, 8).map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <details>
        <summary>1-5 分评分参考</summary>
        <ul className="score-reference-list">
          {Object.entries(SCORE_LEVEL_REFERENCE).map(([score, description]) => (
            <li key={score}>
              <strong>{score} 分：</strong>
              {description}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
