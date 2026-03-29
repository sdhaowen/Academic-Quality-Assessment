import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  INDICATOR_SETS,
  MODULES,
  QUALITY_LEVEL_TAG,
  SCORE_LEVEL_REFERENCE,
  STAGES,
  STAGE_LABELS,
  TIME_SPANS,
  TIME_SPAN_OPTIONS,
} from "./config/indicators";
import { AssessmentModel } from "./config/models";
import { assessments as initialAssessments, students as initialStudents } from "./data/mockData";
import RadarChartCard from "./components/RadarChartCard";
import DataEntryPanel from "./components/DataEntryPanel";
import ExcelImportPanel from "./components/ExcelImportPanel";
import {
  computeClassAverageScores,
  computeImprovementAnalysis,
  computeMultiClassComparison,
  computeSchoolComparison,
  computeStudentGrowthSeries,
  scoreSeriesToArray,
} from "./utils/analytics";
import { exportClassReportPDF, exportStudentReportPDF } from "./utils/reportExport";

function getStageClassOptions(students, stage) {
  const stageStudents = students.filter((student) => student.stage === stage);
  const classes = [...new Set(stageStudents.map((student) => student.className))];
  return classes.sort();
}

function getStageSchoolOptions(students, stage) {
  const stageStudents = students.filter((student) => student.stage === stage);
  const schools = [...new Set(stageStudents.map((student) => student.school))];
  return schools.sort();
}

function buildOverviewCards(stage, students, assessments) {
  const stageStudents = students.filter((student) => student.stage === stage);
  const stageAssessments = assessments.filter((item) => item.stage === stage);
  const latestAt = stageAssessments.length
    ? Math.max(...stageAssessments.map((item) => item.assessedAt))
    : null;
  return [
    { title: "学段", value: STAGE_LABELS[stage] },
    { title: "学生人数", value: stageStudents.length },
    { title: "评价记录数", value: stageAssessments.length },
    { title: "最近评价时间", value: latestAt ? dayjs(latestAt).format("YYYY-MM-DD") : "-" },
  ];
}

function scoreTags(averageSeries, indicators) {
  const tags = averageSeries
    .map((score, idx) => {
      const normalized = Math.round(score);
      if (!QUALITY_LEVEL_TAG[normalized]) {
        return null;
      }
      return {
        axis: idx + 1,
        score: normalized,
        indicatorLabel: indicators[idx]?.label ?? `指标${idx + 1}`,
        tag: QUALITY_LEVEL_TAG[normalized],
      };
    })
    .filter(Boolean);
  return tags;
}

function scoreSeriesToTableData(indicators, series) {
  return indicators.map((indicator, idx) => ({
    indicator: indicator.label,
    score: Number(series[idx] ?? 0).toFixed(2),
  }));
}

function getActiveModuleTitle(activeModule) {
  return MODULES.find((module) => module.key === activeModule)?.label ?? "模块";
}

function App() {
  const [stage, setStage] = useState(STAGES.PRIMARY);
  const [timeSpan, setTimeSpan] = useState(TIME_SPANS.HALF_YEAR);
  const [activeModule, setActiveModule] = useState(MODULES[0].key);
  const [students, setStudents] = useState(initialStudents);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [selectedStudentId, setSelectedStudentId] = useState(
    initialStudents.find((student) => student.stage === STAGES.PRIMARY)?.id ?? "",
  );
  const [selectedClassName, setSelectedClassName] = useState(
    getStageClassOptions(initialStudents, STAGES.PRIMARY)[0] ?? "",
  );
  const [isPlayingGrowth, setIsPlayingGrowth] = useState(false);
  const [growthFrameIndex, setGrowthFrameIndex] = useState(0);
  const [isExportingStudent, setIsExportingStudent] = useState(false);
  const [isExportingClass, setIsExportingClass] = useState(false);
  const animationTimerRef = useRef(null);

  const studentReportRef = useRef(null);
  const classReportRef = useRef(null);

  const stageStudents = useMemo(
    () => students.filter((student) => student.stage === stage),
    [students, stage],
  );

  const classOptions = useMemo(() => getStageClassOptions(students, stage), [students, stage]);
  const schoolOptions = useMemo(() => getStageSchoolOptions(students, stage), [students, stage]);

  useEffect(() => {
    if (!stageStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(stageStudents[0]?.id ?? "");
    }
  }, [stageStudents, selectedStudentId]);

  useEffect(() => {
    if (!classOptions.includes(selectedClassName)) {
      setSelectedClassName(classOptions[0] ?? "");
    }
  }, [classOptions, selectedClassName]);

  const selectedStudent =
    stageStudents.find((student) => student.id === selectedStudentId) ?? stageStudents[0];
  const selectedClasses = classOptions.slice(0, Math.min(3, classOptions.length));
  const selectedSchools = schoolOptions.slice(0, 3);

  const indicators = INDICATOR_SETS[stage];

  const growthData = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }
    return computeStudentGrowthSeries(assessments, selectedStudent.id, stage, indicators);
  }, [assessments, selectedStudent, stage, indicators]);

  const animatedGrowthData = useMemo(() => {
    if (!growthData.length) {
      return [];
    }
    const end = Math.min(growthFrameIndex + 1, growthData.length);
    return growthData.slice(0, end);
  }, [growthData, growthFrameIndex]);

  const classAverageSeries = useMemo(() => {
    if (!selectedClassName) {
      return [];
    }
    const result = computeClassAverageScores(
      students,
      assessments,
      selectedClassName,
      stage,
      indicators,
    );
    return scoreSeriesToArray(result.averageScores, indicators);
  }, [students, assessments, selectedClassName, stage, indicators]);

  const multiClassSeries = useMemo(
    () => computeMultiClassComparison(students, assessments, selectedClasses, stage, indicators),
    [students, assessments, selectedClasses, stage, indicators],
  );

  const schoolSeries = useMemo(
    () => computeSchoolComparison(students, assessments, selectedSchools, stage, indicators),
    [students, assessments, selectedSchools, stage, indicators],
  );

  const growthAnalysis = useMemo(() => {
    if (!selectedStudent) {
      return null;
    }
    return computeImprovementAnalysis(assessments, selectedStudent.id, stage, indicators, timeSpan);
  }, [assessments, selectedStudent, stage, indicators, timeSpan]);

  const overviewCards = useMemo(
    () => buildOverviewCards(stage, students, assessments),
    [stage, students, assessments],
  );

  const classAverageTableData = useMemo(
    () => scoreSeriesToTableData(indicators, classAverageSeries),
    [indicators, classAverageSeries],
  );

  const handleManualSubmit = (formData) => {
    const assessment = new AssessmentModel({
      id: `MAN-${formData.studentId}-${Date.now()}`,
      studentId: formData.studentId,
      stage,
      scores: formData.scores,
      assessedAt: formData.assessedAt,
    });
    setAssessments((prev) => [...prev, assessment]);
  };

  const handleImportRows = (importedRecords) => {
    const normalized = importedRecords.map(
      (item) =>
        new AssessmentModel({
          id: item.id,
          studentId: item.studentId,
          stage: item.stage,
          scores: item.scores,
          assessedAt: item.assessedAt,
        }),
    );
    setAssessments((prev) => [...prev, ...normalized]);
  };

  useEffect(() => {
    setGrowthFrameIndex(0);
    setIsPlayingGrowth(false);
  }, [selectedStudent?.id, stage]);

  useEffect(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    if (!isPlayingGrowth || growthData.length <= 1) {
      return undefined;
    }

    animationTimerRef.current = setInterval(() => {
      setGrowthFrameIndex((prev) => {
        if (prev >= growthData.length - 1) {
          setIsPlayingGrowth(false);
          return growthData.length - 1;
        }
        return prev + 1;
      });
    }, 1200);

    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [isPlayingGrowth, growthData.length]);

  const handleToggleGrowthPlay = () => {
    if (!growthData.length) {
      return;
    }
    if (growthFrameIndex >= growthData.length - 1) {
      setGrowthFrameIndex(0);
    }
    setIsPlayingGrowth((prev) => !prev);
  };

  const handleResetGrowth = () => {
    setIsPlayingGrowth(false);
    setGrowthFrameIndex(0);
  };

  const handleExportStudentReport = async () => {
    if (!selectedStudent || !studentReportRef.current || !growthAnalysis) {
      return;
    }
    setIsExportingStudent(true);
    try {
      await exportStudentReportPDF({
        element: studentReportRef.current,
        studentName: selectedStudent.name,
        className: selectedStudent.className,
        stageLabel: STAGE_LABELS[stage],
      });
    } finally {
      setIsExportingStudent(false);
    }
  };

  const handleExportClassReport = async () => {
    if (!selectedClassName || !classReportRef.current) {
      return;
    }
    setIsExportingClass(true);
    try {
      await exportClassReportPDF({
        element: classReportRef.current,
        className: selectedClassName,
        stageLabel: STAGE_LABELS[stage],
      });
    } finally {
      setIsExportingClass(false);
    }
  };

  const renderStudentDashboardModule = () => (
    <>
      <section className="panel">
        <h3>分析对象选择</h3>
        <div className="form-grid">
          <label>
            学生个人看板对象
            <select
              className="text-input"
              value={selectedStudent?.id ?? ""}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              {stageStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}（{student.className}）
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar-row">
          <h3>多时间点成长轨迹动画</h3>
          <div className="button-group">
            <button type="button" className="btn-secondary" onClick={handleToggleGrowthPlay}>
              {isPlayingGrowth ? "暂停播放" : "开始播放"}
            </button>
            <button type="button" className="btn-ghost" onClick={handleResetGrowth}>
              重置到起点
            </button>
          </div>
        </div>
        <p className="muted">
          当前帧：{growthData.length ? growthFrameIndex + 1 : 0} / {growthData.length}
        </p>
      </section>

      <div ref={studentReportRef} className="report-snapshot">
        <section className="chart-grid single-column">
          <RadarChartCard
            title="学生增值性图表（成长轨迹）"
            subtitle={
              selectedStudent
                ? `${selectedStudent.name} (${selectedStudent.className})`
                : "当前无可展示学生"
            }
            indicators={indicators}
            series={animatedGrowthData}
          />
        </section>

        <section className="insight-row">
          <article className="panel">
            <h3>长期增值分析（{TIME_SPAN_OPTIONS.find((item) => item.value === timeSpan)?.label}）</h3>
            {growthAnalysis ? (
              <>
                <p>
                  素养提升率：<strong>{growthAnalysis.improvementRate}%</strong>
                </p>
                <p>
                  进步最快：<strong>{growthAnalysis.fastestImprovement.label}</strong>（+
                  {growthAnalysis.fastestImprovement.delta.toFixed(2)}）
                </p>
                <p>
                  需进一步提升：<strong>{growthAnalysis.needsAttention.label}</strong>（
                  {growthAnalysis.needsAttention.delta > 0 ? "+" : ""}
                  {growthAnalysis.needsAttention.delta.toFixed(2)}）
                </p>
                <p className="quality-tags">
                  学业质量等级标注：
                  {growthAnalysis.latestSeries.map((score, index) =>
                    QUALITY_LEVEL_TAG[Math.round(score)] ? (
                      <span key={indicators[index].key} className="badge">
                        {indicators[index].label} {QUALITY_LEVEL_TAG[Math.round(score)]}
                      </span>
                    ) : null,
                  )}
                </p>
              </>
            ) : (
              <p>暂无足够数据计算提升率。</p>
            )}
          </article>

          <article className="panel">
            <h3>评分参考（1-5 分）</h3>
            <ul className="score-reference-list">
              {Object.entries(SCORE_LEVEL_REFERENCE).map(([score, desc]) => (
                <li key={score}>
                  <strong>{score} 分：</strong>
                  {desc}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>

      <section className="panel">
        <div className="toolbar-row">
          <h3>导出学生报告（PDF）</h3>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportStudentReport}
            disabled={isExportingStudent || !growthAnalysis}
          >
            {isExportingStudent ? "导出中..." : "导出学生报告 PDF"}
          </button>
        </div>
      </section>
    </>
  );

  const renderClassAnalysisModule = () => (
    <>
      <section className="panel">
        <h3>班级对象选择</h3>
        <div className="form-grid">
          <label>
            班级雷达图对象
            <select
              className="text-input"
              value={selectedClassName}
              onChange={(event) => setSelectedClassName(event.target.value)}
            >
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div ref={classReportRef} className="report-snapshot">
        <section className="chart-grid single-column">
          <RadarChartCard
            title="班级雷达图（平均分）"
            subtitle={`${selectedClassName || "-"}（可切换班级）`}
            indicators={indicators}
            series={
              classAverageSeries.length
                ? [
                    {
                      name: "班级均值",
                      values: classAverageSeries,
                      itemStyle: { color: "#3b82f6" },
                      areaStyle: { opacity: 0.2 },
                      lineStyle: { width: 2 },
                    },
                  ]
                : []
            }
            footerNote={
              scoreTags(classAverageSeries, indicators).length
                ? `等级标注：${scoreTags(classAverageSeries, indicators)
                    .map((item) => `${item.indicatorLabel}-${item.tag}`)
                    .join("；")}`
                : "等级标注：暂无轴线达到 3 分或 5 分整值。"
            }
          />
        </section>

        <section className="panel">
          <h3>班级指标均值明细</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>指标</th>
                  <th>平均分</th>
                </tr>
              </thead>
              <tbody>
                {classAverageTableData.map((row) => (
                  <tr key={row.indicator}>
                    <td>{row.indicator}</td>
                    <td>{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="toolbar-row">
          <h3>导出班级报告（PDF）</h3>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportClassReport}
            disabled={isExportingClass || !classAverageSeries.length}
          >
            {isExportingClass ? "导出中..." : "导出班级报告 PDF"}
          </button>
        </div>
      </section>
    </>
  );

  const renderMultiClassModule = () => (
    <section className="chart-grid single-column">
      <RadarChartCard
        title="多班级对比图"
        subtitle={selectedClasses.join(" / ") || "-"}
        indicators={indicators}
        series={multiClassSeries}
      />
    </section>
  );

  const renderSchoolModule = () => (
    <section className="chart-grid single-column">
      <RadarChartCard
        title="校际对比图"
        subtitle={selectedSchools.join(" / ") || "-"}
        indicators={indicators}
        series={schoolSeries}
      />
    </section>
  );

  const renderDataManagementModule = () => (
    <section className="data-entry-grid">
      <DataEntryPanel
        stageIndicators={indicators}
        stageStudents={stageStudents}
        onSubmitManual={handleManualSubmit}
        selectedStudentId={selectedStudent?.id ?? ""}
        onSelectStudent={setSelectedStudentId}
      />
      <ExcelImportPanel
        stage={stage}
        students={students}
        onImported={handleImportRows}
        indicatorList={indicators}
      />
    </section>
  );

  const renderModuleContent = () => {
    if (activeModule === "studentDashboard") {
      return renderStudentDashboardModule();
    }
    if (activeModule === "classAnalysis") {
      return renderClassAnalysisModule();
    }
    if (activeModule === "multiClassCompare") {
      return renderMultiClassModule();
    }
    if (activeModule === "schoolCompare") {
      return renderSchoolModule();
    }
    return renderDataManagementModule();
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <h1>信息科技（人工智能）核心素养学业质量评价可视化工具</h1>
        <div className="top-controls">
          <label>
            学段
            <select
              className="select-control"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value={STAGES.PRIMARY}>小学</option>
              <option value={STAGES.JUNIOR}>初中</option>
            </select>
          </label>
          <label>
            时间跨度
            <select
              className="select-control"
              value={timeSpan}
              onChange={(event) => setTimeSpan(event.target.value)}
            >
              {TIME_SPAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">功能模块</h2>
          <ul className="module-list">
            {MODULES.map((module) => (
              <li key={module.key}>
                <button
                  type="button"
                  className={`module-button ${activeModule === module.key ? "active" : ""}`}
                  onClick={() => setActiveModule(module.key)}
                >
                  {module.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="security-hint">
            安全提示：该系统仅建议用于校内或本地环境。导入数据时请勿上传隐私敏感信息。
          </p>
        </aside>

        <main className="main-content">
          <section className="notice-banner">
            当前模块：{getActiveModuleTitle(activeModule)}
          </section>

          <section className="card-grid">
            {overviewCards.map((card) => (
              <article key={card.title} className="info-card">
                <h3>{card.title}</h3>
                <p className="metric">{card.value}</p>
              </article>
            ))}
          </section>
          {renderModuleContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
