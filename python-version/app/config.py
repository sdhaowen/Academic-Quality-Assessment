from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = BASE_DIR / "backups"
DB_FILE = DATA_DIR / "assessment.db"

STAGE_PRIMARY = "primary"
STAGE_JUNIOR = "junior"

STAGE_LABELS = {
    STAGE_PRIMARY: "小学",
    STAGE_JUNIOR: "初中",
}

TIME_SPANS = {
    "halfYear": {"label": "半年", "months": 6},
    "oneYear": {"label": "一年", "months": 12},
    "fiveYears": {"label": "五年", "months": 60},
}

MODULES = [
    {"key": "student_dashboard", "label": "学生个人看板"},
    {"key": "class_analysis", "label": "班级分析"},
    {"key": "multi_class_compare", "label": "多班级对比"},
    {"key": "school_compare", "label": "校际对比"},
    {"key": "data_management", "label": "数据管理"},
]

SPAN_MONTHS = {k: v["months"] for k, v in TIME_SPANS.items()}

