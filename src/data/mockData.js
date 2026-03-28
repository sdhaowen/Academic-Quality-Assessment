import dayjs from "dayjs";
import { INDICATOR_SETS, STAGES } from "../config/indicators";

const PRIMARY_CLASS_NAMES = ["小学-1班", "小学-2班", "小学-3班"];
const JUNIOR_CLASS_NAMES = ["初中-1班", "初中-2班", "初中-3班"];
const SCHOOLS = ["启明实验学校", "远航学校", "星河中小学"];

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clampScore(value) {
  return Math.max(1, Math.min(5, Number(value.toFixed(2))));
}

function generateStudentId(index, stagePrefix) {
  return `${stagePrefix}${String(index + 1).padStart(3, "0")}`;
}

function generateName(index) {
  const surnames = ["李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙"];
  const given = ["子涵", "雨桐", "浩然", "思远", "梓萱", "嘉宁", "一诺", "博文", "可欣", "俊杰", "若曦", "晨曦"];
  const surname = surnames[index % surnames.length];
  const givenName = given[(index * 3) % given.length];
  return `${surname}${givenName}`;
}

function generateScores(stage, baseline) {
  const indicators = INDICATOR_SETS[stage];
  return indicators.reduce((acc, indicator) => {
    const noise = randomInRange(-0.4, 0.6);
    acc[indicator.key] = clampScore(baseline + noise);
    return acc;
  }, {});
}

function generateAssessmentSeries(student, points = 3) {
  const checkpoints = [60, 12, 6].slice(0, points);
  const base = randomInRange(2.1, 3.5);

  return checkpoints.map((monthsAgo, index) => {
    const growth = index * randomInRange(0.35, 0.65);
    return {
      id: `${student.id}-A${index + 1}`,
      studentId: student.id,
      stage: student.stage,
      scores: generateScores(student.stage, base + growth),
      assessedAt: dayjs().subtract(monthsAgo, "month").valueOf(),
    };
  });
}

function createStudentsForStage(stage, count, offset = 0) {
  const classNames = stage === STAGES.PRIMARY ? PRIMARY_CLASS_NAMES : JUNIOR_CLASS_NAMES;
  const stagePrefix = stage === STAGES.PRIMARY ? "P" : "J";

  return Array.from({ length: count }, (_, idx) => {
    const index = idx + offset;
    return {
      id: generateStudentId(index, stagePrefix),
      name: generateName(index),
      studentNo: `${stagePrefix}-${String(10001 + index)}`,
      className: classNames[idx % classNames.length],
      school: SCHOOLS[idx % SCHOOLS.length],
      stage,
    };
  });
}

const primaryStudents = createStudentsForStage(STAGES.PRIMARY, 46, 0);
const juniorStudents = createStudentsForStage(STAGES.JUNIOR, 46, 100);

export const students = [...primaryStudents, ...juniorStudents];

export const assessments = students.flatMap((student) => generateAssessmentSeries(student, 3));

export function addOrReplaceAssessment(existingAssessments, incoming) {
  const next = [...existingAssessments];
  const idx = next.findIndex((item) => item.id === incoming.id);
  if (idx >= 0) {
    next[idx] = incoming;
  } else {
    next.push(incoming);
  }
  return next;
}
