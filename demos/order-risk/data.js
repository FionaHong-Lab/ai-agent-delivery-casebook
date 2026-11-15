/** 示例底账。数字只服务这页演示，不是企业实绩。 */

export const ANCHOR = "2026-11-20";
export const ANCHOR_LABEL = "2026-11-20（周五）";

/** 部分接时，另一半承诺日 = 原承诺日 + 7 个日历日（假设）。 */
export const DEFERRAL_DAYS = 7;
/** 缓冲少于此天数则交期灯为黄（假设）。 */
export const BUFFER_DAYS = 2;
/** 系统数与手记差超过此比例则黄（假设）。 */
export const GAP_RATIO = 0.03;
/** 未开裁且承诺日远于此天数，审阅停在跟单员（假设）。 */
export const REVIEW_HORIZON_DAYS = 7;

export const MAX_PIECES = 10_000_000;
export const MAX_RATE = 1_000_000;
export const MAX_DAYS = 3660;
export const MAX_DELAY_DAYS = 3650;

export const LINES = [
  {
    id: "new-3",
    name: "新厂吊挂3线",
    plant: "新厂",
    kind: "new",
    plannedRate: 2400,
    actualRate: 1420,
    status: "running",
    teardownDate: null,
    note: "在产。完工只用近3日日均。",
  },
  {
    id: "new-1",
    name: "新厂吊挂1线",
    plant: "新厂",
    kind: "new",
    plannedRate: 2000,
    actualRate: 1600,
    status: "running",
    teardownDate: null,
    note: "在产。系统数和手记不一致。",
  },
  {
    id: "new-2",
    name: "新厂吊挂2线",
    plant: "新厂",
    kind: "new",
    plannedRate: 2200,
    actualRate: null,
    status: "down",
    teardownDate: null,
    note: "设备停机，近3日日均缺失。",
  },
  {
    id: "split-b",
    name: "老厂5线+新厂1线",
    plant: "拆单",
    kind: "split",
    plannedRate: null,
    actualRate: 1700,
    status: "running",
    teardownDate: null,
    note: "两线合计日均，不拆开再借。",
  },
  {
    id: "old-3",
    name: "老厂3线",
    plant: "老厂",
    kind: "old",
    plannedRate: 1500,
    actualRate: null,
    status: "verbal",
    teardownDate: null,
    note: "只有口头数。",
  },
  {
    id: "old-1",
    name: "老厂1线",
    plant: "老厂",
    kind: "old",
    plannedRate: 1600,
    actualRate: 1620,
    status: "running",
    teardownDate: null,
    note: "在产。",
  },
  {
    id: "old-2",
    name: "老厂2线",
    plant: "老厂",
    kind: "old",
    plannedRate: null,
    actualRate: null,
    status: "teardown",
    teardownDate: "2026-11-27",
    note: "计划拆线日是假设，没有日均。",
  },
];

export const ORDERS = [
  {
    id: "A-0412",
    customer: "客户A",
    due: "2026-11-28",
    lineId: "new-3",
    remaining: 14800,
    rate: 1420,
    yesterdayPlan: 2400,
    yesterdayActual: 1350,
    source: "吊挂系统",
    stage: "sewing",
    fabric: "arrived",
    cutRatio: 0.7,
    sewnRatio: null,
    kitShort: 0,
    kitNote: "",
    countGap: null,
    countBase: null,
    verbal: false,
  },
  {
    id: "B-0377",
    customer: "客户B",
    due: "2026-11-25",
    lineId: "split-b",
    remaining: 3100,
    rate: 1700,
    yesterdayPlan: 1800,
    yesterdayActual: 1760,
    source: "系统+手记",
    stage: null,
    fabric: null,
    cutRatio: null,
    sewnRatio: null,
    kitShort: 900,
    kitNote: "M码缺900件",
    countGap: null,
    countBase: null,
    verbal: false,
  },
  {
    id: "C-0521",
    customer: "客户C",
    due: "2026-12-05",
    lineId: "new-1",
    remaining: 9600,
    rate: 1600,
    yesterdayPlan: 2000,
    yesterdayActual: 1850,
    source: "系统与手记",
    stage: null,
    fabric: null,
    cutRatio: null,
    sewnRatio: null,
    kitShort: 0,
    kitNote: "",
    countGap: 180,
    countBase: 1850,
    verbal: false,
  },
  {
    id: "A-0430",
    customer: "客户A",
    due: "2026-12-10",
    lineId: "new-2",
    remaining: 22000,
    rate: null,
    yesterdayPlan: 2200,
    yesterdayActual: 0,
    source: "设备停机",
    stage: null,
    fabric: null,
    cutRatio: null,
    sewnRatio: null,
    kitShort: 0,
    kitNote: "",
    countGap: null,
    countBase: null,
    verbal: false,
  },
  {
    id: "D-0118",
    customer: "客户D",
    due: "2026-12-12",
    lineId: "old-3",
    remaining: null,
    rate: null,
    yesterdayPlan: 1500,
    yesterdayActual: null,
    source: "口头",
    stage: null,
    fabric: null,
    cutRatio: null,
    sewnRatio: null,
    kitShort: 0,
    kitNote: "",
    countGap: null,
    countBase: null,
    verbal: true,
  },
  {
    id: "B-0390",
    customer: "客户B",
    due: "2026-12-15",
    lineId: "old-1",
    remaining: 8000,
    rate: 1620,
    yesterdayPlan: 1600,
    yesterdayActual: 1640,
    source: "系统+手记",
    stage: null,
    fabric: null,
    cutRatio: null,
    sewnRatio: null,
    kitShort: 0,
    kitNote: "",
    countGap: null,
    countBase: null,
    verbal: false,
  },
];

export const STAGES = [
  { id: "", label: "未知（底账没有）" },
  { id: "uncut", label: "未开裁" },
  { id: "cut", label: "已裁" },
  { id: "sewing", label: "缝制中" },
  { id: "ship", label: "待出货" },
];

export const CHANGE_TYPES = [
  { id: "add", label: "加单" },
  { id: "cut", label: "砍单" },
  { id: "ratio", label: "改配比" },
  { id: "delay", label: "延期提货" },
];

export const STRATEGIES = [
  { id: "full", label: "全接" },
  { id: "partial", label: "部分接" },
  { id: "reschedule", label: "换交期" },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));
export const TYPE_LABEL = Object.fromEntries(CHANGE_TYPES.map((s) => [s.id, s.label]));
export const STRATEGY_LABEL = Object.fromEntries(STRATEGIES.map((s) => [s.id, s.label]));

export const LINE_STATUS_LABEL = {
  running: "在产",
  down: "停机",
  verbal: "口头",
  teardown: "计划拆线",
};

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

deepFreeze(LINES);
deepFreeze(ORDERS);
deepFreeze(STAGES);
deepFreeze(CHANGE_TYPES);
deepFreeze(STRATEGIES);
