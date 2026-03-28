export const STAGES = {
  PRIMARY: "primary",
  JUNIOR: "junior",
};

export const STAGE_LABELS = {
  [STAGES.PRIMARY]: "小学",
  [STAGES.JUNIOR]: "初中",
};

export const TIME_SPANS = {
  HALF_YEAR: "halfYear",
  ONE_YEAR: "oneYear",
  FIVE_YEARS: "fiveYears",
};

export const TIME_SPAN_OPTIONS = [
  { value: TIME_SPANS.HALF_YEAR, label: "半年", months: 6 },
  { value: TIME_SPANS.ONE_YEAR, label: "一年", months: 12 },
  { value: TIME_SPANS.FIVE_YEARS, label: "五年", months: 60 },
];

export const MODULES = [
  { key: "studentDashboard", label: "学生个人看板" },
  { key: "classAnalysis", label: "班级分析" },
  { key: "multiClassCompare", label: "多班级对比" },
  { key: "schoolCompare", label: "校际对比" },
  { key: "dataManagement", label: "数据管理" },
];

export const SCORE_LEVEL_REFERENCE = {
  1: "尚未达成：对 AI 学习任务缺乏独立完成能力，需要持续引导。",
  2: "基础发展：在提示下能完成简单任务，但迁移应用能力较弱。",
  3: "水平一（合格）：能独立解决简单问题，具备基本的信息科技素养。",
  4: "水平二（良好）：能综合运用数据与算法思维解决情境问题。",
  5: "水平三（优秀）：表现出原创性与系统建模能力，具备创新表现。",
};

export const QUALITY_LEVEL_TAG = {
  3: "水平一：合格",
  5: "水平三：优秀",
};

export const INDICATOR_SETS = {
  [STAGES.PRIMARY]: [
    { key: "scenarioAwareness", label: "AI场景感知力" },
    { key: "dataValueAwareness", label: "数据价值意识" },
    { key: "problemDecomposition", label: "问题分解能力" },
    { key: "basicAlgorithmLogic", label: "简单算法逻辑" },
    { key: "smartCreationExperience", label: "智能创作体验" },
    { key: "onlineCollaboration", label: "在线协作素养" },
    { key: "contentDiscernment", label: "内容辨识意识" },
    { key: "aiBehaviorNorms", label: "AI行为规范" },
  ],
  [STAGES.JUNIOR]: [
    { key: "systemPatternAnalysis", label: "系统模式解析" },
    { key: "aiInnovationEvaluation", label: "AI创新评估" },
    { key: "abstractModeling", label: "抽象建模能力" },
    { key: "algorithmVerification", label: "算法验证实操" },
    { key: "llmInquiryLearning", label: "大模型探究学习" },
    { key: "prototypeDesignCollaboration", label: "原型设计与协作" },
    { key: "ethicsIdentityManagement", label: "伦理与身份管理" },
    { key: "selfControlledResponsibility", label: "自主可控责任" },
  ],
};

