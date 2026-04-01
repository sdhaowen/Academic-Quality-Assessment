# Python 版本（本机正式版最小实现）

本目录是该项目的 Python 实现，技术栈：

- Streamlit（Web 界面）
- SQLite（本地数据库）
- Pandas + OpenPyXL（Excel 导入）
- Matplotlib（雷达图）
- ReportLab（PDF 导出）

## 功能覆盖

- 小学/初中两套指标体系
- 5 个模块切换：
  - 学生个人看板
  - 班级分析
  - 多班级对比
  - 校际对比
  - 数据管理
- 手动录入评分（1-5）
- Excel 导入（姓名、学号、指标1...指标8、评价日期）
- 增值分析（半年/一年/五年）
- 学生/班级 PDF 报告导出
- 本地数据库持久化（SQLite）

## 数据文件位置

默认数据库文件：

- `python-version/data/assessment.db`

运行时可能生成：

- `python-version/data/assessment.db-wal`
- `python-version/data/assessment.db-shm`

## 快速启动

在项目根目录执行：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python-version/requirements.txt
streamlit run python-version/streamlit_app.py
```

默认访问地址通常为：

- http://localhost:8501

## 说明

- 首次启动会自动初始化数据库并写入模拟数据（小学 46 + 初中 46）。
- 数据管理模块中的手动录入和 Excel 导入会直接写入 SQLite。
- 建议仅在校内或本地环境使用，避免导入敏感隐私数据。
