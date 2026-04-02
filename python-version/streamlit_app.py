from __future__ import annotations

import json
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

from app.analytics import (
    average_scores,
    compare_groups,
    growth_series,
    improvement_analysis,
    score_series_to_list,
    student_growth_records,
)
from app.config import (
    DB_FILE,
    MODULES,
    STAGE_JUNIOR,
    STAGE_LABELS,
    STAGE_PRIMARY,
    TIME_SPANS,
)
from app.db import (
    fetch_assessments,
    fetch_students,
    init_db,
    insert_assessment,
    insert_assessments,
    seed_if_empty,
)
from app.indicators import INDICATOR_SETS, SCORE_LEVEL_REFERENCE
from app.models import Assessment


st.set_page_config(
    page_title="AI 核心素养学业质量评价（Python版）",
    page_icon="📊",
    layout="wide",
)


@st.cache_data
def get_stage_indicators(stage: str):
    return INDICATOR_SETS[stage]


def normalize_score(value: float) -> float:
    return max(1.0, min(5.0, round(float(value), 2)))


def fetch_runtime_data():
    students = fetch_students()
    assessments = fetch_assessments()
    return students, assessments


def get_module_mapping() -> dict[str, str]:
    if isinstance(MODULES, dict):
        return {str(k): str(v) for k, v in MODULES.items()}
    if isinstance(MODULES, list):
        mapping: dict[str, str] = {}
        for item in MODULES:
            if isinstance(item, dict) and "key" in item and "label" in item:
                mapping[str(item["key"])] = str(item["label"])
        return mapping
    return {}


def radar_chart_figure(indicators, series, title):
    labels = [item["label"] for item in indicators]
    num_vars = len(labels)
    angles = [n / float(num_vars) * 2 * 3.1415926 for n in range(num_vars)]
    angles += angles[:1]

    fig = plt.figure(figsize=(6, 6))
    ax = plt.subplot(111, polar=True)
    ax.set_theta_offset(3.1415926 / 2)
    ax.set_theta_direction(-1)
    ax.set_rlabel_position(0)
    plt.yticks([1, 2, 3, 4, 5], ["1", "2", "3", "4", "5"], color="gray", size=8)
    plt.ylim(0, 5)
    plt.xticks(angles[:-1], labels, size=9)

    for item in series:
        values = item["values"][:]
        values += values[:1]
        ax.plot(angles, values, linewidth=2, label=item["name"])
        ax.fill(angles, values, alpha=0.1)

    plt.title(title, y=1.08, fontsize=12)
    plt.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1))
    return fig


def format_assessed_label(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d")


def create_pdf_report(title: str, lines: list[str]) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    c.setFont("STSong-Light", 14)
    c.drawString(20 * mm, 280 * mm, title)
    c.setFont("STSong-Light", 10)
    y = 268 * mm
    for line in lines:
        c.drawString(20 * mm, y, line)
        y -= 7 * mm
        if y < 20 * mm:
            c.showPage()
            c.setFont("STSong-Light", 10)
            y = 270 * mm
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


def run_startup_self_check() -> tuple[bool, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    module_mapping = get_module_mapping()

    required_modules = {
        "student_dashboard",
        "class_analysis",
        "multi_class_compare",
        "school_compare",
        "data_management",
    }
    missing_modules = sorted(required_modules - set(module_mapping.keys()))
    if missing_modules:
        errors.append(f"配置项 MODULES 缺失：{', '.join(missing_modules)}")

    required_spans = {"halfYear", "oneYear", "fiveYears"}
    missing_spans = sorted(required_spans - set(TIME_SPANS.keys()))
    if missing_spans:
        errors.append(f"配置项 TIME_SPANS 缺失：{', '.join(missing_spans)}")

    stage_keys = {STAGE_PRIMARY, STAGE_JUNIOR}
    indicator_keys = set(INDICATOR_SETS.keys())
    if not stage_keys.issubset(indicator_keys):
        errors.append("INDICATOR_SETS 未完整覆盖小学/初中学段。")

    if not Path(DB_FILE).parent.exists():
        warnings.append(f"数据库目录不存在，将在首次启动时自动创建：{Path(DB_FILE).parent}")

    try:
        init_db()
        seed_if_empty()
    except Exception as exc:  # pragma: no cover - startup guard
        errors.append(f"数据库初始化失败：{exc}")

    return (len(errors) == 0, errors, warnings)


def render_self_check_banner() -> bool:
    ok, errors, warnings = run_startup_self_check()
    if ok:
        details = [f"数据库位置：{DB_FILE}"]
        if warnings:
            details.extend([f"提示：{item}" for item in warnings])
        st.success("启动自检通过：" + "；".join(details))
        return True

    st.error("启动自检失败，请先修复以下问题：")
    for item in errors:
        st.error(f"- {item}")
    for item in warnings:
        st.warning(f"- {item}")
    st.info("修复后请刷新页面重试。")
    return False


def upload_excel(stage: str, indicators, stage_students):
    uploaded = st.file_uploader("上传 Excel（姓名、学号、指标1...指标8、评价日期）", type=["xlsx", "xls"])
    if uploaded is None:
        return

    df = pd.read_excel(uploaded)
    required = ["姓名", "学号", "评价日期"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        st.error(f"缺少必需列：{', '.join(missing)}")
        return

    student_map = {s.student_no: s for s in stage_students}
    records = []
    errors = []
    for i, row in df.iterrows():
        line = i + 2
        student_no = str(row.get("学号", "")).strip()
        if student_no not in student_map:
            errors.append(f"第{line}行：学号 {student_no} 不存在")
            continue
        scores = {}
        valid = True
        for idx, indicator in enumerate(indicators, start=1):
            key = f"指标{idx}"
            score = row.get(key)
            if pd.isna(score):
                errors.append(f"第{line}行：{key} 不能为空")
                valid = False
                continue
            score = normalize_score(score)
            if score < 1 or score > 5:
                errors.append(f"第{line}行：{key} 必须在 1-5")
                valid = False
            scores[indicator["key"]] = score
        if not valid:
            continue

        assessed_at = int(pd.to_datetime(row["评价日期"]).timestamp() * 1000)
        student = student_map[student_no]
        records.append(
            Assessment(
                id=f"IMP-{student.id}-{uuid4().hex[:8]}",
                student_id=student.id,
                stage=stage,
                scores=scores,
                assessed_at=assessed_at,
            )
        )

    if errors:
        st.warning("导入存在问题：\n" + "\n".join(errors[:8]))
    if records:
        insert_assessments(records)
        st.success(f"成功导入 {len(records)} 条记录。")
        st.cache_data.clear()


def main():
    st.title("信息科技（人工智能）核心素养学业质量评价可视化工具（Python版）")
    st.caption("本机正式版：Streamlit + SQLite")

    module_mapping = get_module_mapping()
    if not module_mapping:
        st.error("配置项 MODULES 格式无效，请检查 app/config.py。")
        return

    if not render_self_check_banner():
        return

    col1, col2, col3 = st.columns([2, 2, 3])
    with col1:
        stage = st.selectbox("学段", [STAGE_PRIMARY, STAGE_JUNIOR], format_func=lambda x: STAGE_LABELS[x])
    with col2:
        time_span = st.selectbox(
            "时间跨度",
            list(TIME_SPANS.keys()),
            format_func=lambda key: TIME_SPANS[key]["label"],
        )
    with col3:
        module = st.selectbox("模块", list(module_mapping.keys()), format_func=lambda x: module_mapping[x])

    students, assessments = fetch_runtime_data()
    indicators = get_stage_indicators(stage)
    stage_students = [s for s in students if s.stage == stage]
    stage_assessments = [a for a in assessments if a.stage == stage]

    st.info(
        f"当前学段：{STAGE_LABELS[stage]} | 学生人数：{len(stage_students)} | "
        f"评价记录数：{len(stage_assessments)}"
    )

    class_names = sorted({s.class_name for s in stage_students})
    school_names = sorted({s.school for s in stage_students})

    if module == "student_dashboard":
        student = st.selectbox("选择学生", stage_students, format_func=lambda s: f"{s.name}（{s.class_name}）")
        growth = growth_series(stage_assessments, student.id, stage, indicators)
        if growth:
            frame_count = len(growth)
            frame = st.slider("成长轨迹播放帧", 1, frame_count, frame_count, key="growth_frame")
            col_play_1, col_play_2 = st.columns([1, 3])
            with col_play_1:
                if st.button("▶ 自动播放"):
                    for i in range(1, frame_count + 1):
                        st.session_state["growth_frame"] = i
                        time.sleep(0.4)
                        st.rerun()
            with col_play_2:
                st.caption("自动播放会逐帧展示不同时间点成长轨迹。")
            chart_data = growth[:frame]
            fig = radar_chart_figure(indicators, chart_data, f"学生成长轨迹 - {student.name}")
            st.pyplot(fig, clear_figure=True)
        else:
            st.warning("该学生暂无可展示成长记录。")

        analysis = improvement_analysis(stage_assessments, student.id, indicators, time_span)
        if analysis:
            st.metric("素养提升率", f"{analysis['improvement_rate']}%")
            st.write(
                f"进步最快：**{analysis['fastest']['label']}** (+{analysis['fastest']['delta']})  \n"
                f"需提升：**{analysis['needs_attention']['label']}** ({analysis['needs_attention']['delta']:+.2f})"
            )

            lines = [
                f"学生：{student.name}（{student.class_name}）",
                f"学段：{STAGE_LABELS[stage]}",
                f"时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
                f"提升率：{analysis['improvement_rate']}%",
                f"进步最快：{analysis['fastest']['label']} (+{analysis['fastest']['delta']})",
                f"需提升：{analysis['needs_attention']['label']} ({analysis['needs_attention']['delta']:+.2f})",
            ]
            pdf_bytes = create_pdf_report("学生报告", lines)
            st.download_button(
                "导出学生报告 PDF",
                data=pdf_bytes,
                file_name=f"学生报告_{student.name}.pdf",
                mime="application/pdf",
            )

        st.subheader("成长轨迹记录")
        growth_records = student_growth_records(stage_assessments, student.id, stage)
        if growth_records:
            st.dataframe(
                pd.DataFrame(
                    [
                        {
                            "时间": format_assessed_label(item.assessed_at),
                            **{
                                indicator["label"]: item.scores.get(indicator["key"], 0)
                                for indicator in indicators
                            },
                        }
                        for item in growth_records
                    ]
                ),
                use_container_width=True,
            )

    elif module == "class_analysis":
        class_name = st.selectbox("选择班级", class_names)
        class_students = [s for s in stage_students if s.class_name == class_name]
        latest_by_student = {}
        for a in sorted(stage_assessments, key=lambda x: x.assessed_at):
            latest_by_student[a.student_id] = a
        rows = [latest_by_student[s.id] for s in class_students if s.id in latest_by_student]
        avg = average_scores(rows, indicators)
        fig = radar_chart_figure(indicators, [{"name": class_name, "values": score_series_to_list(avg, indicators)}], f"班级分析 - {class_name}")
        st.pyplot(fig, clear_figure=True)
        st.dataframe(
            pd.DataFrame(
                [{"指标": i["label"], "均值": avg[i["key"]]} for i in indicators]
            ),
            use_container_width=True,
        )
        pdf_bytes = create_pdf_report(
            "班级报告",
            [f"班级：{class_name}", f"学段：{STAGE_LABELS[stage]}"]
            + [f"{i['label']}: {avg[i['key']]}" for i in indicators],
        )
        st.download_button("导出班级报告 PDF", data=pdf_bytes, file_name=f"班级报告_{class_name}.pdf", mime="application/pdf")

    elif module == "multi_class_compare":
        picked = st.multiselect("选择班级（2-3个）", class_names, default=class_names[: min(3, len(class_names))])
        result = compare_groups(
            students=stage_students,
            assessments=stage_assessments,
            indicators=indicators,
            group_names=picked,
            group_field="class_name",
        )
        if result:
            fig = radar_chart_figure(indicators, result, "多班级对比")
            st.pyplot(fig, clear_figure=True)

    elif module == "school_compare":
        picked = st.multiselect("选择学校（2-3个）", school_names, default=school_names[: min(3, len(school_names))])
        result = compare_groups(
            students=stage_students,
            assessments=stage_assessments,
            indicators=indicators,
            group_names=picked,
            group_field="school",
        )
        if result:
            fig = radar_chart_figure(indicators, result, "校际对比")
            st.pyplot(fig, clear_figure=True)

    else:
        st.subheader("手动录入")
        student = st.selectbox("学生", stage_students, format_func=lambda s: f"{s.name}（{s.class_name}）")
        date_value = st.date_input("评价日期")
        scores = {}
        for indicator in indicators:
            scores[indicator["key"]] = st.slider(
                f"{indicator['label']}（{SCORE_LEVEL_REFERENCE[3]}）",
                min_value=1,
                max_value=5,
                value=3,
                step=1,
            )
        if st.button("保存评价记录"):
            record = Assessment(
                id=f"MAN-{student.id}-{uuid4().hex[:8]}",
                student_id=student.id,
                stage=stage,
                scores=scores,
                assessed_at=int(datetime.combine(date_value, datetime.min.time()).timestamp() * 1000),
            )
            insert_assessment(record)
            st.success("保存成功")
            st.cache_data.clear()

        st.subheader("Excel 导入")
        upload_excel(stage, indicators, stage_students)

    st.warning("安全提示：建议仅在校内或本地使用；请勿导入敏感隐私信息。")
    with st.expander("调试信息"):
        st.code(json.dumps({"stage": stage, "module": module, "timeSpan": time_span}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

