STAGES = {
    "primary": "小学",
    "junior": "初中",
}

TIME_SPANS = {
    "halfYear": {"label": "半年", "months": 6},
    "oneYear": {"label": "一年", "months": 12},
    "fiveYears": {"label": "五年", "months": 60},
}

MODULES = {
    "student_dashboard": "学生个人看板",
    "class_analysis": "班级分析",
    "multi_class_compare": "多班级对比",
    "school_compare": "校际对比",
    "data_management": "数据管理",
}

SCORE_LEVEL_REFERENCE = {
    1: "尚未达成：对 AI 学习任务缺乏独立完成能力，需要持续引导。",
    2: "基础发展：在提示下能完成简单任务，但迁移应用能力较弱。",
    3: "水平一（合格）：能独立解决简单问题，具备基本的信息科技素养。",
    4: "水平二（良好）：能综合运用数据与算法思维解决情境问题。",
    5: "水平三（优秀）：表现出原创性与系统建模能力，具备创新表现。",
}

QUALITY_LEVEL_TAG = {
    3: "水平一：合格",
    5: "水平三：优秀",
}

INDICATOR_SETS = {
    "primary": [
        {"key": "scenarioAwareness", "label": "AI场景感知力"},
        {"key": "dataValueAwareness", "label": "数据价值意识"},
        {"key": "problemDecomposition", "label": "问题分解能力"},
        {"key": "basicAlgorithmLogic", "label": "简单算法逻辑"},
        {"key": "smartCreationExperience", "label": "智能创作体验"},
        {"key": "onlineCollaboration", "label": "在线协作素养"},
        {"key": "contentDiscernment", "label": "内容辨识意识"},
        {"key": "aiBehaviorNorms", "label": "AI行为规范"},
    ],
    "junior": [
        {"key": "systemPatternAnalysis", "label": "系统模式解析"},
        {"key": "aiInnovationEvaluation", "label": "AI创新评估"},
        {"key": "abstractModeling", "label": "抽象建模能力"},
        {"key": "algorithmVerification", "label": "算法验证实操"},
        {"key": "llmInquiryLearning", "label": "大模型探究学习"},
        {"key": "prototypeDesignCollaboration", "label": "原型设计与协作"},
        {"key": "ethicsIdentityManagement", "label": "伦理与身份管理"},
        {"key": "selfControlledResponsibility", "label": "自主可控责任"},
    ],
}
