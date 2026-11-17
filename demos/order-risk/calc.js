/**
 * 订单变更与交期风险的确定性计算。
 *
 * 示例日固定为 2026-11-20。完工 = 示例日 + 向上取整(剩余 ÷ 近3日日均) 个日历日。
 * 不读电脑当天日期，不跳过周日——示例底账就是按日历日对上的。
 * 计划日产只作对照，不代入。日均缺失或为 0 时，完工写未知。
 * 套用始终从底账重算，不会把同一次变更叠两次。
 */

import {
  ANCHOR,
  BUFFER_DAYS,
  DEFERRAL_DAYS,
  GAP_RATIO,
  LINES,
  MAX_DAYS,
  MAX_DELAY_DAYS,
  MAX_PIECES,
  MAX_RATE,
  ORDERS,
  REVIEW_HORIZON_DAYS,
  STAGE_LABEL,
  STRATEGY_LABEL,
  TYPE_LABEL,
} from "./data.js";

export function addCalendarDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function calendarDaysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function isValidISODate(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatInt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const body = Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + body;
}

export function formatMD(iso) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${d}`;
}

export function getLine(id) {
  return LINES.find((line) => line.id === id) || null;
}

export function getOrder(id) {
  return ORDERS.find((order) => order.id === id) || null;
}

export function customers() {
  return [...new Set(ORDERS.map((order) => order.customer))];
}

export function ordersForCustomer(customer) {
  return ORDERS.filter((order) => order.customer === customer);
}

function parseDigits(raw, { allowEmpty, label, max, zeroOk = true }) {
  if (raw == null || String(raw).trim() === "") {
    if (allowEmpty) return { ok: true, value: null };
    return { ok: false, message: `请填写${label}` };
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false, message: `${label}要填 0 或正整数，不能是负数、小数或文字` };
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, message: `${label}太大，算不了` };
  }
  if (!zeroOk && value === 0) {
    return { ok: false, message: `${label}不能为 0` };
  }
  if (value > max) {
    return { ok: false, message: `${label}超过示例能演示的上限（${formatInt(max)}）` };
  }
  return { ok: true, value };
}

export function finishDate(remaining, rate) {
  if (remaining == null || rate == null) {
    return { date: null, days: null, reason: "缺剩余或日均" };
  }
  if (rate <= 0) {
    return { date: null, days: null, reason: "日均为 0，不能做除法" };
  }
  if (remaining <= 0) {
    return { date: ANCHOR, days: 0, reason: "剩余为 0" };
  }
  const days = Math.ceil(remaining / rate);
  if (days > MAX_DAYS) {
    return { date: null, days, reason: "换算超过 10 年，不生成日期" };
  }
  return { date: addCalendarDays(ANCHOR, days), days, reason: "" };
}

function applyTeardown(line, finish) {
  if (!finish?.date || !line?.teardownDate) return finish;
  if (finish.date > line.teardownDate) {
    return {
      date: null,
      days: finish.days,
      reason: `按日均会晚于计划拆线日 ${formatMD(line.teardownDate)}，拆线之后还有没有产量是未知`,
    };
  }
  return finish;
}

function deliveryLight({ order, line, remaining, rate, finish, due }) {
  const hasNumbers = remaining != null && rate > 0 && finish != null;
  if (order.kitShort > 0) return "red";
  if (hasNumbers && due && finish > due) return "red";
  if (line.status === "down") return "yellow";
  if (line.status === "teardown" && !hasNumbers) return "yellow";
  if (order.countGap != null && order.countBase > 0 && order.countGap / order.countBase > GAP_RATIO) {
    return "yellow";
  }
  if (!hasNumbers) return "grey";
  if (due && finish && calendarDaysBetween(finish, due) < BUFFER_DAYS) return "yellow";
  return "green";
}

const LIGHT_NAME = { red: "红", yellow: "黄", grey: "灰", green: "绿" };

function metaLine(order) {
  const plan = order.yesterdayPlan == null ? "—" : formatInt(order.yesterdayPlan);
  const actual = order.yesterdayActual == null ? "—" : formatInt(order.yesterdayActual);
  return `昨日计划/实际 ${plan}/${actual}，不参与计算。来源：${order.source}`;
}

function baseNote(order, line, finish) {
  if ((order.verbal || line.status === "verbal") && (order.remaining == null || order.rate == null)) {
    return "只有口头数，剩余或日均缺失，不参与完工计算。";
  }
  if (order.rate == null && line.status === "down") {
    return "停机，近3日日均缺失，完工未知。不改用计划日产来推算。";
  }
  if (order.rate == null && line.status === "teardown") {
    return `计划拆线日 ${formatMD(line.teardownDate)}（假设），没有日均，完工未知。`;
  }
  const bits = [];
  if (!finish?.date) {
    bits.push(finish?.reason ? `${finish.reason}。` : "完工未知。");
  } else if (finish.date > order.due) {
    const late = calendarDaysBetween(order.due, finish.date);
    bits.push(`按近3日日均，完工 ${formatMD(finish.date)}，晚 ${late} 天。`);
  } else {
    bits.push(`完工 ${formatMD(finish.date)}，不晚于交期。`);
  }
  if (order.kitShort > 0) {
    bits.push(`${order.kitNote}，齐套日未知，不能按缝纫完工日出货。`);
  }
  if (order.countGap != null && order.countBase > 0) {
    const pct = Math.round((order.countGap / order.countBase) * 1000) / 10;
    bits.push(`系统与手记差 ${formatInt(order.countGap)} 件，约占 ${formatInt(order.countBase)} 的 ${pct.toFixed(1)}%，超过 3% 的假设线。`);
  }
  return bits.join("");
}

function makeRow({ order, line, remaining, rate, dueIso, dueText, finish, note, changed }) {
  const light = deliveryLight({
    order,
    line,
    remaining,
    rate,
    finish: finish?.date || null,
    due: dueIso,
  });
  return {
    id: order.id,
    customer: order.customer,
    dueText,
    dueIso,
    lineName: line.name,
    remainingText: remaining == null ? "—" : formatInt(remaining),
    rateText: rate == null ? "—" : rate === 0 ? "0" : formatInt(rate),
    finishText: finish?.date ? formatMD(finish.date) : "—",
    finishIso: finish?.date || null,
    light,
    lightLabel: LIGHT_NAME[light],
    note,
    meta: metaLine(order),
    changed,
  };
}

export function baselineRows() {
  return ORDERS.map((order) => {
    const line = getLine(order.lineId);
    const finish = applyTeardown(line, finishDate(order.remaining, order.rate));
    return makeRow({
      order,
      line,
      remaining: order.remaining,
      rate: order.rate,
      dueIso: order.due,
      dueText: formatMD(order.due),
      finish,
      note: baseNote(order, line, finish),
      changed: false,
    });
  });
}

function effectiveQty(type, strategy, qty) {
  if (strategy !== "partial") return qty;
  return Math.floor(qty / 2);
}

function validate(form, lineRates) {
  const order = getOrder(form.orderId);
  if (!order) return { ok: false, error: { field: "orderId", message: "请选择一张示例订单" } };
  if (!["add", "cut", "ratio", "delay"].includes(form.type)) {
    return { ok: false, error: { field: "type", message: "请选择改单类型" } };
  }
  const line = getLine(form.lineId);
  if (!line) return { ok: false, error: { field: "lineId", message: "请选择线别" } };
  if (![...Object.keys(STAGE_LABEL)].includes(form.stage)) {
    return { ok: false, error: { field: "stage", message: "请选择工序" } };
  }

  const qtyLabel = form.type === "delay" ? "推迟天数" : "变更数量";
  const qtyMax = form.type === "delay" ? MAX_DELAY_DAYS : MAX_PIECES;
  const qtyParsed = parseDigits(form.qty, { allowEmpty: false, label: qtyLabel, max: qtyMax });
  if (!qtyParsed.ok) return { ok: false, error: { field: "qty", message: qtyParsed.message } };

  const remainingParsed = parseDigits(form.remaining, {
    allowEmpty: true,
    label: "本单剩余",
    max: MAX_PIECES,
  });
  if (!remainingParsed.ok) {
    return { ok: false, error: { field: "remaining", message: remainingParsed.message } };
  }

  const due = form.keepDue ? order.due : form.due;
  if (!isValidISODate(due)) {
    return { ok: false, error: { field: "due", message: "交期不是有效日期" } };
  }

  const rates = {};
  for (const item of LINES) {
    const parsed = parseDigits(lineRates[item.id], {
      allowEmpty: true,
      label: `${item.name}的日均`,
      max: MAX_RATE,
    });
    if (!parsed.ok) return { ok: false, error: { field: `rate:${item.id}`, message: parsed.message } };
    rates[item.id] = parsed.value;
  }

  const qty = qtyParsed.value;
  const remainingBefore = remainingParsed.value;
  const cutQty = form.type === "cut" ? effectiveQty("cut", form.strategy || "full", qty) : 0;

  if (form.type === "add" && qty > 0 && remainingBefore == null) {
    return { ok: false, error: { field: "remaining", message: "剩余未知，没法加上变更数量。请先填写剩余，或把数量改成 0。" } };
  }
  if (form.type === "cut" && remainingBefore == null) {
    return { ok: false, error: { field: "remaining", message: "剩余未知，不能判断砍完还剩多少。" } };
  }
  if (form.type === "cut" && cutQty > remainingBefore) {
    return {
      ok: false,
      error: {
        field: "qty",
        message: `砍单量 ${formatInt(cutQty)} 件超过剩余 ${formatInt(remainingBefore)} 件。没有改成 0，也没有照减。`,
      },
    };
  }
  if (form.type === "ratio" && remainingBefore != null && qty > remainingBefore) {
    return {
      ok: false,
      error: { field: "qty", message: `改配 ${formatInt(qty)} 件，大于剩余 ${formatInt(remainingBefore)} 件。` },
    };
  }
  if (form.type === "add" && remainingBefore != null && remainingBefore + qty > MAX_PIECES) {
    return { ok: false, error: { field: "qty", message: `加上之后超过 ${formatInt(MAX_PIECES)} 件，这页不演示这么大的数。` } };
  }

  return {
    ok: true,
    order,
    line,
    type: form.type,
    stage: form.stage,
    qty,
    remainingBefore,
    due,
    keepDue: !!form.keepDue,
    rates,
  };
}

function horizonDays(due) {
  return Math.max(0, calendarDaysBetween(ANCHOR, due));
}

function slackForNewPieces(remainingBefore, rate, due) {
  if (remainingBefore == null || !(rate > 0) || !due) return null;
  return Math.max(0, horizonDays(due) * rate - remainingBefore);
}

function borrowNeed(parsed, strategy) {
  const { type, qty, remainingBefore, due, rates, line } = parsed;
  const rate = rates[line.id];
  if (type !== "add") return { known: true, pieces: 0, secondDue: null };
  if (strategy === "reschedule") return { known: true, pieces: 0, secondDue: null };
  if (!(rate > 0) || remainingBefore == null) {
    return { known: false, pieces: null, secondDue: strategy === "partial" ? addCalendarDays(due, DEFERRAL_DAYS) : null };
  }
  const slack = (day) => slackForNewPieces(remainingBefore, rate, day);
  if (strategy === "partial") {
    const first = Math.floor(qty / 2);
    const secondDue = addCalendarDays(due, DEFERRAL_DAYS);
    const needFirst = Math.max(0, first - slack(due));
    const needLater = Math.max(0, qty - slack(secondDue));
    return { known: true, pieces: Math.max(needFirst, needLater), secondDue };
  }
  return { known: true, pieces: Math.max(0, qty - slack(due)), secondDue: null };
}

function donorCandidates(parsed, targetId) {
  const donors = [];
  const skipped = [];
  for (const order of ORDERS) {
    if (order.id === targetId) continue;
    const line = getLine(order.lineId);
    const rate = parsed.rates[order.lineId];
    const eligibleKind = line.kind === "new" || line.kind === "old";
    if (!eligibleKind || line.status !== "running" || !(rate > 0) || order.remaining == null || order.kitShort > 0) {
      skipped.push({
        orderId: order.id,
        reason: skipReason(order, line, rate),
      });
      continue;
    }
    const solo = applyTeardown(line, finishDate(order.remaining, rate));
    if (!solo.date) {
      skipped.push({ orderId: order.id, reason: solo.reason || "完工未知，不拿来出借" });
      continue;
    }
    const slackDays = Math.max(0, calendarDaysBetween(solo.date, order.due));
    donors.push({
      order,
      line,
      rate,
      finishBefore: solo.date,
      slackDays,
      kind: line.kind,
    });
  }
  return { donors, skipped };
}

function skipReason(order, line, rate) {
  if (line.kind === "split") return "拆单合计日均不拿来出借";
  if (order.kitShort > 0) return "配套不齐，不拿它的产量去填别的缺口";
  if (line.status === "down") return "停机，日均未知，不编晚几天";
  if (line.status === "verbal" || order.verbal) return "只有口头数，不参与计算";
  if (line.status === "teardown") return "这条线没有可借用的日均";
  if (!(rate > 0) || order.remaining == null) return "日均或剩余缺失，不编天数";
  return "不参与借用";
}

function allocateBorrow(pieces, donors) {
  const taken = new Map();
  let left = pieces;
  const phases = [donors.filter((d) => d.kind === "new"), donors.filter((d) => d.kind === "old")];
  for (const group of phases) {
    const sorted = [...group].sort((a, b) => {
      if (b.slackDays !== a.slackDays) return b.slackDays - a.slackDays;
      if (a.order.due !== b.order.due) return a.order.due < b.order.due ? 1 : -1;
      return a.order.id < b.order.id ? -1 : 1;
    });
    for (const donor of sorted) {
      if (left <= 0) break;
      const free = donor.slackDays * donor.rate;
      if (free <= 0) continue;
      const take = Math.min(left, free);
      taken.set(donor.order.id, take);
      left -= take;
    }
  }
  return { taken, unmet: left };
}

function sequenceLine(parsed, strategy, remainingAfter, askedDue) {
  const { order: target, line, rates } = parsed;
  const rate = rates[line.id];
  const members = ORDERS.filter((item) => (item.id === target.id ? line.id : item.lineId) === line.id).map((item) => ({
    order: item,
    remaining: item.id === target.id ? remainingAfter : item.remaining,
    sortDue: item.id === target.id
      ? (strategy === "reschedule" ? item.due : askedDue)
      : item.due,
  }));
  members.sort((a, b) => {
    if (a.sortDue !== b.sortDue) return a.sortDue < b.sortDue ? -1 : 1;
    return a.order.id < b.order.id ? -1 : 1;
  });

  const finishes = new Map();
  let cursor = 0;
  let blocked = false;
  for (const member of members) {
    if (blocked || !(rate > 0) || member.remaining == null) {
      blocked = true;
      finishes.set(member.order.id, {
        date: null,
        days: null,
        reason: member.remaining == null ? "剩余未知，后面的单也不接着推" : "日均无法计算，后面的单也不接着推",
      });
      continue;
    }
    if (member.remaining <= 0) {
      finishes.set(member.order.id, { date: addCalendarDays(ANCHOR, cursor), days: 0, reason: "剩余为 0" });
      continue;
    }
    const days = Math.ceil(member.remaining / rate);
    if (cursor + days > MAX_DAYS) {
      blocked = true;
      finishes.set(member.order.id, { date: null, days, reason: "换算超过 10 年，不生成日期" });
      continue;
    }
    const solo = { date: addCalendarDays(ANCHOR, cursor + days), days: cursor + days, reason: "" };
    finishes.set(member.order.id, applyTeardown(line, solo));
    if (!finishes.get(member.order.id).date) blocked = true;
    else cursor += days;
  }
  return { shared: members.length > 1, members, finishes, rate };
}

function costModel(parsed, strategy, dayDelta) {
  const { order, type, stage, qty } = parsed;
  const sameStage = stage !== "" && stage === order.stage;
  const rows = [];

  if (stage === "uncut") {
    rows.push(cost("面料", "按所选工序，还没开裁", "尚未发生", "不沿用底账里其他工序的到料记录。"));
  } else if (sameStage && order.fabric === "arrived") {
    rows.push(cost("面料", "已到货（示例底账）", "已发生", "能否转用要人确认。已发生不是损失，也不是客户应付。"));
  } else if (sameStage && order.fabric === "none") {
    rows.push(cost("面料", "未到货（示例底账）", "尚未发生", "还没到的料，这次可以不发生。"));
  } else {
    rows.push(cost("面料", "未知", "未知", "没有和当前工序对得上的到料记录，不推测。"));
  }

  if (stage === "uncut") {
    rows.push(cost("裁剪", "未开始", "尚未发生", "所选工序是未开裁，不沿用已裁比例。"));
  } else if ((stage === "cut" || stage === "sewing") && sameStage && order.cutRatio != null) {
    const pct = Math.round(order.cutRatio * 100);
    rows.push(cost("裁剪", `约 ${pct}% 已裁（示例）`, "已发生", "不一定还能改用。不把这个比例乘成损失。"));
  } else {
    rows.push(cost("裁剪", "未知", "未知", "没有与当前工序一致的裁剪完成度，不把别的数字借过来。"));
  }

  if (stage === "uncut" || stage === "cut") {
    rows.push(cost("缝制", "未开始", "尚未发生", "这个工序之前，缝制的工还没发生。"));
  } else if (stage === "sewing" && sameStage && order.sewnRatio == null) {
    rows.push(cost("缝制", "进行中，已缝件数未知", "部分已发生", "不知道已经缝了多少，不估算件数。"));
  } else if (stage === "sewing" && sameStage && order.sewnRatio != null) {
    rows.push(cost("缝制", `约 ${Math.round(order.sewnRatio * 100)}% 已缝（示例）`, "部分已发生", "已缝的已经发生，没缝的还可以不做。"));
  } else {
    rows.push(cost("缝制", "未知", "未知", "没有已缝件数，不写成已经做完。"));
  }

  const acted = strategy === "partial" ? Math.floor(qty / 2) : qty;
  if (type === "add") {
    rows.push(cost(
      `加量 ${formatInt(qty)} 件的料和工`,
      qty === 0 ? "没有加量" : "还没投入",
      "尚未发生",
      qty === 0 ? "数量是 0，没有新增的料和工。" : "不全接就可以不发生。",
    ));
  } else if (type === "cut") {
    const pending = rows.some((row) => row.bucket === "已发生" || row.bucket === "部分已发生");
    rows.push(cost(
      `砍掉 ${formatInt(acted)} 件`,
      pending ? "已做的部分是否落在这些件里，未知" : "还没做的部分可以不做",
      pending ? "待确认" : "尚未发生",
      "不按已裁比例乘出报废件数，也不写成一笔损失。",
    ));
  } else if (type === "ratio") {
    if (stage === "uncut") {
      rows.push(cost(`改配 ${formatInt(acted)} 件`, "还没开裁", "尚未发生", "总数不变。还没裁，不产生已裁报废。"));
    } else if (order.cutRatio != null && sameStage && stage !== "uncut") {
      rows.push(cost(`改配 ${formatInt(acted)} 件`, "已裁的老配比还在", "待确认", "能否改用要人确认。总数不变，不记成损失。"));
    } else {
      rows.push(cost(`改配 ${formatInt(acted)} 件`, "已裁了多少未知", "未知", "总数不变。没有完成度，不判断报废。"));
    }
  } else if (stage === "ship") {
    rows.push(cost(`提货推迟 ${formatInt(acted)} 天`, "成品待出", "待确认", "占仓和回款会后移。不折算金额。"));
  } else {
    rows.push(cost(`提货推迟 ${formatInt(acted)} 天`, "货还没到待出货", "未知", "生产负荷不变。占仓天数未知，不把推迟天数写成已经占仓。"));
  }

  const incurredNames = rows.filter((row) => row.bucket === "已发生" || row.bucket === "部分已发生").map((row) => row.node);
  const incurredSummary = incurredNames.length
    ? `已发生：${incurredNames.join("、")}。这不是损失，也不是客户要付的钱。`
    : "已发生：这次没有能确认的已投入。";

  let recoverableSummary = "可挽回：没有新增、也没有砍掉可以单独收回的数量。";
  if (type === "add" && qty > 0) recoverableSummary = `可挽回：加量 ${formatInt(qty)} 件的料和工还没发生，不接就可以不做。已经在做的部分能否转用，仍待确认。`;
  if (type === "cut" && acted > 0) recoverableSummary = `可挽回：砍掉之后不再做的部分可以不做。已经投入的能否转用要人确认，不能写成已经挽回。`;
  if (type === "ratio") recoverableSummary = "可挽回：总件数不变。已裁老配比能不能改用，要人确认。";
  if (type === "delay") recoverableSummary = "可挽回：没有新增制作，生产上的料和工不因推迟提货而多出来。";

  let incrementalSummary = "新增占用：没有。";
  if (type === "add") {
    incrementalSummary = dayDelta == null
      ? `新增占用：${formatInt(qty)} 件。本线会多几天，要等日均和剩余都有了才能算。`
      : `新增占用：${formatInt(qty)} 件。只在本线做的话，完工比变更前多 ${dayDelta} 个日历日（向上取整之后的差，不是简单除法）。`;
  } else if (type === "cut") {
    incrementalSummary = `新增占用：没有。少做 ${formatInt(acted)} 件。腾出的天数不自动改派给别的单。`;
  } else if (type === "ratio") {
    incrementalSummary = "新增占用：0 件。总数不变，完工公式不变。";
  } else {
    incrementalSummary = `新增占用：生产件数不变。提货推迟 ${formatInt(acted)} 天。`;
  }

  return { rows, incurredSummary, recoverableSummary, incrementalSummary };
}

function cost(node, state, bucket, detail) {
  return { node, state, bucket, detail };
}

function capacityView(rate, due, loadPieces, loadLabel) {
  if (!(rate > 0) || !due || loadPieces == null) {
    return { known: false, level: "unknown", levelText: "无法计算", days: null, canMake: null, loadPieces, loadLabel, width: 0 };
  }
  const days = horizonDays(due);
  const canMake = days * rate;
  let level = "ok";
  if (loadPieces > canMake) level = "over";
  else if (canMake - loadPieces < rate) level = "near";
  const levelText = {
    over: "已超过这段时间能做的件数",
    near: "接近这段时间能做完的件数",
    ok: "这段时间做得下",
  }[level];
  const width = canMake <= 0 ? (loadPieces > 0 ? 100 : 0) : Math.min(100, Math.round((loadPieces / canMake) * 100));
  return { known: true, level, levelText, days, canMake, loadPieces, loadLabel, width };
}

function reviewersFor(parsed, strategy, flags) {
  const { stage, due } = parsed;
  const list = [];
  const far = horizonDays(due) > REVIEW_HORIZON_DAYS;
  if (stage === "") {
    list.push({ role: "跟单主管", reason: "工序未知，按可能已经开裁来找人，避免漏审。" });
    list.push({ role: "计划主管", reason: "工序未知，仍要一起看会不会挤到别的单。" });
  } else if (stage === "uncut" && far && !flags.needsPlantOwner) {
    list.push({ role: "跟单员", reason: `未开裁，且承诺日在示例日 ${REVIEW_HORIZON_DAYS} 天以外（假设）。快评之后由人决定。` });
  } else if (stage === "uncut" && far) {
    list.push({ role: "跟单员", reason: `未开裁，且承诺日在 ${REVIEW_HORIZON_DAYS} 天以外（假设）。` });
  } else {
    list.push({
      role: "跟单主管",
      reason: stage === "uncut" ? "未开裁，但承诺日已在 7 天以内（假设）。" : "已开裁或已进入后道，要和计划一起看（假设）。",
    });
    list.push({ role: "计划主管", reason: "确认本线缺口，以及被借走缓冲的是哪几张单。" });
  }
  if (flags.needsPlantOwner) {
    list.push({ role: "生产负责人", reason: `${flags.plantReason}按「新线接住，老线才停」扩大审阅（假设）。` });
  }
  return list;
}

function plantFlags(parsed, strategy, borrow, allocations, shared) {
  const { line, type, qty } = parsed;
  const reasons = [];
  if (allocations.some((item) => item.kind === "new" && item.pieces > 0)) reasons.push("借用了新线的缓冲。");
  if (shared.shared && line.kind === "new") reasons.push("这张单排进了已有订单的新线。");
  if (line.status === "teardown") reasons.push("所选的线已有拆线计划。");
  if (borrow.known && borrow.unmet > 0) reasons.push("还有件数没有可计算的去处。");
  if (borrow.known === false && type === "add" && qty > 0 && strategy !== "reschedule") {
    reasons.push("借多少件算不清，看不准会不会碰到新线或拆线。");
  }
  const delaysTeardown = line.status === "teardown" || (borrow.known && borrow.unmet > 0);
  return {
    occupiesNewLine: reasons.some((item) => item.includes("新线")),
    delaysTeardown: delaysTeardown ? true : (borrow.known === false ? "unknown" : false),
    needsPlantOwner: reasons.length > 0,
    plantReason: reasons.join(""),
  };
}

function promiseFor(parsed, strategy, ownFinish) {
  const { type, qty, due } = parsed;
  const acted = effectiveQty(type, strategy, qty);
  if (strategy === "reschedule") {
    if (!ownFinish?.date) {
      return { promiseDue: null, secondDue: null, firstQty: null, secondQty: null, acted, delayDays: type === "delay" ? qty : 0 };
    }
    const promiseDue = ownFinish.date > due ? ownFinish.date : due;
    const delayDays = type === "delay" ? qty : 0;
    return { promiseDue, secondDue: null, firstQty: null, secondQty: null, acted, delayDays };
  }
  if (strategy === "partial" && type === "add") {
    return {
      promiseDue: due,
      secondDue: addCalendarDays(due, DEFERRAL_DAYS),
      firstQty: Math.floor(qty / 2),
      secondQty: qty - Math.floor(qty / 2),
      acted: qty,
      delayDays: 0,
    };
  }
  return {
    promiseDue: due,
    secondDue: null,
    firstQty: null,
    secondQty: null,
    acted,
    delayDays: type === "delay" ? acted : 0,
  };
}

function choiceCopy(parsed, strategy, ownFinish, borrow, promise) {
  const { type, qty } = parsed;
  const finishText = ownFinish?.date ? formatMD(ownFinish.date) : "未知";
  if (strategy === "reschedule") {
    return {
      title: promise.promiseDue ? `换交期到 ${formatMD(promise.promiseDue)}` : "换交期，但完工未知",
      detail: promise.promiseDue
        ? `承诺改到本线做完的那天（不早于客户提出的日期）。不向其他线借产量。本线完工 ${finishText}。`
        : "本线完工未知，给不出新的承诺日，也不假借别的线。",
    };
  }
  if (type === "add" && strategy === "partial") {
    return {
      title: `部分接：${formatInt(promise.firstQty)} 件仍按 ${formatMD(promise.promiseDue)}，其余 ${formatInt(promise.secondQty)} 件到 ${formatMD(promise.secondDue)}`,
      detail: borrow.known
        ? `一半向下取整，另一半顺延 ${DEFERRAL_DAYS} 天（假设）。为守住前一个日期，要借 ${formatInt(borrow.pieces)} 件。`
        : "日均或剩余不够，借多少件是未知。",
    };
  }
  if (type === "cut" && strategy === "partial") {
    return {
      title: `部分砍 ${formatInt(promise.acted)} 件`,
      detail: "只砍填写数量的一半，另一半仍留在这张单上。不自动把腾出的天数派给别的单。",
    };
  }
  if (type === "ratio" && strategy === "partial") {
    return {
      title: `部分改配 ${formatInt(promise.acted)} 件`,
      detail: "只把一半件数视为改了配比。总件数不变，完工公式不变。",
    };
  }
  if (type === "delay" && strategy === "partial") {
    return {
      title: `部分推迟 ${formatInt(promise.acted)} 天`,
      detail: "只登记一半的推迟天数。生产剩余和本线完工不变。",
    };
  }
  if (type === "delay") {
    return {
      title: `全接推迟 ${formatInt(qty)} 天`,
      detail: "生产剩余不变。提货日往后推，不向其他线借产量。",
    };
  }
  if (type === "cut") {
    return {
      title: `全砍 ${formatInt(qty)} 件`,
      detail: `砍完之后本线完工 ${finishText}。不把腾出的产能自动加给别的单。`,
    };
  }
  if (type === "ratio") {
    return {
      title: `全改配 ${formatInt(qty)} 件`,
      detail: "总件数不变，本线完工不变。已裁的老配比是否还能用，要人确认。",
    };
  }
  const borrowText = !borrow.known
    ? "要守住这个日期需要借多少，未知。"
    : borrow.pieces === 0
      ? "不用借其他线的缓冲。"
      : `要守住这个日期，需借 ${formatInt(borrow.pieces)} 件缓冲。`;
  return {
    title: `全接，承诺 ${formatMD(parsed.due)}`,
    detail: `只在本线做完是 ${finishText}。${borrowText}`,
  };
}

function buildHeadline(parsed, strategy, ownFinish, borrow, promise, allocations) {
  const finishText = ownFinish?.date ? formatMD(ownFinish.date) : "未知";
  if (parsed.type === "delay") {
    return `延期提货 ${formatInt(promise.delayDays)} 天。本线完工仍是 ${finishText}，生产件数不变。`;
  }
  if (parsed.type === "ratio") {
    return `改配 ${formatInt(promise.acted)} 件，总件数不变。本线完工 ${finishText}。`;
  }
  if (parsed.type === "cut") {
    return `砍 ${formatInt(promise.acted)} 件后剩余 ${formatInt(parsed.remainingBefore - promise.acted)} 件，本线完工 ${finishText}。`;
  }
  let text = `加 ${formatInt(parsed.qty)} 件后，只在本线做完是 ${finishText}。`;
  if (strategy === "reschedule") {
    text += promise.promiseDue ? `承诺改到 ${formatMD(promise.promiseDue)}，不借其他线。` : "完工未知，给不出新承诺日。";
    return text;
  }
  if (!borrow.known) {
    text += "要守住承诺需要借多少件，现在未知。";
    return text;
  }
  if (borrow.pieces === 0) {
    text += "交期前的空闲够用，不用借其他线。";
    return text;
  }
  const who = allocations.map((item) => `${item.orderId} ${formatInt(item.pieces)} 件`).join("、");
  text += who ? `要守住承诺，需借 ${formatInt(borrow.pieces)} 件（${who}）。` : `要守住承诺，需借 ${formatInt(borrow.pieces)} 件。`;
  if (borrow.unmet > 0) text += `还有 ${formatInt(borrow.unmet)} 件没有可计算的去处。`;
  return text;
}

function buildTrace(parsed, strategy, ownFinish, sampleFinish, borrow, allocations, promise, shared) {
  const rate = parsed.rates[parsed.line.id];
  const trace = [];
  trace.push(`示例日是 ${ANCHOR}。客户提出的日期是 ${parsed.due}，相距 ${calendarDaysBetween(ANCHOR, parsed.due)} 个日历日。不跳过周日，也不用你打开页面的当天。`);
  if (shared.shared) {
    trace.push(`${parsed.line.name}上还有别的单。按底账交期从早到晚排队，日均 ${rate == null ? "未知" : `${formatInt(rate)} 件/日`}。同一条线不重复再向外面借一次。`);
    for (const member of shared.members) {
      const finish = shared.finishes.get(member.order.id);
      trace.push(`${member.order.id} 排在这一条上，完工 ${finish?.date ? formatMD(finish.date) : "未知"}。`);
    }
    return trace;
  }
  const rateText = rate == null ? "未知" : rate === 0 ? "0，不能做除法" : `${formatInt(rate)} 件/日`;
  const planned = parsed.line.plannedRate == null ? "没有计划日产" : `计划日产 ${formatInt(parsed.line.plannedRate)} 件/日不参与计算`;
  trace.push(`${parsed.line.name}近3日日均 ${rateText}。${planned}。`);
  if (parsed.due && rate > 0) {
    const days = horizonDays(parsed.due);
    trace.push(`从示例日到承诺日有 ${days} 个日历日，可做 ${formatInt(days * rate)} 件。`);
  }
  trace.push(`变更前剩余 ${parsed.remainingBefore == null ? "未知" : `${formatInt(parsed.remainingBefore)} 件`}，底账完工 ${sampleFinish?.date ? formatMD(sampleFinish.date) : "未知"}。`);
  if (parsed.type === "add") {
    trace.push(`加 ${formatInt(parsed.qty)} 件后剩余 ${parsed.remainingBefore == null ? "未知" : `${formatInt(parsed.remainingBefore + parsed.qty)} 件`}。本线完工 ${ownFinish?.date ? `${formatMD(ownFinish.date)}（向上取整 ${ownFinish.days} 天）` : "未知"}。`);
  } else if (parsed.type === "cut") {
    trace.push(`这次实际砍 ${formatInt(promise.acted)} 件。本线完工 ${ownFinish?.date ? formatMD(ownFinish.date) : "未知"}。`);
  } else if (parsed.type === "ratio") {
    trace.push("改配比不改变剩余件数，完工公式也不变。");
  } else {
    trace.push("延期提货不改变剩余件数，本线完工不变。");
  }
  if (strategy === "reschedule") {
    trace.push(promise.promiseDue
      ? `换交期把承诺改到 ${promise.promiseDue}，不向其他线借产量。`
      : "完工未知，换交期给不出新日期。");
    return trace;
  }
  if (parsed.type !== "add") {
    trace.push("这次不增加件数，所以不向其他线借缓冲。");
    return trace;
  }
  if (!borrow.known) {
    trace.push("日均或剩余缺失，借多少件是未知，不摊到某一张单上，也不写晚几天。");
    return trace;
  }
  if (borrow.pieces === 0) {
    trace.push("新增件数能放进承诺日前的空闲里，其他订单的完工保持底账。");
    return trace;
  }
  trace.push(`承诺日前没有足够空闲，要另借 ${formatInt(borrow.pieces)} 件，才守得住这个日期。先借新厂里缓冲更宽的线，新厂不够才用老厂。`);
  for (const item of allocations) {
    trace.push(`${item.orderId} 借出 ${formatInt(item.pieces)} 件，完工从 ${formatMD(item.finishBefore)} 移到 ${formatMD(item.finishAfter)}，不晚于它自己的交期。`);
  }
  if (borrow.unmet > 0) {
    trace.push(`还有 ${formatInt(borrow.unmet)} 件借不到。停机线、口头数和没有日均的拆线，都不编天数。`);
  } else {
    trace.push("停机线、口头数和老厂2线的拆线日，这次都没有拿来凑数。");
  }
  return trace;
}

function whereText(parsed) {
  const { order, line, stage } = parsed;
  const stageName = stage === "" ? "工序未知" : STAGE_LABEL[stage];
  if (stage === "sewing" && stage === order.stage) {
    const cut = order.cutRatio == null ? "裁剪完成度未知" : `已裁约 ${Math.round(order.cutRatio * 100)}%`;
    const fabric = order.fabric === "arrived" ? "面料已到" : "面料到料未知";
    return `${stageName}，${line.name}。${fabric}，${cut}，已缝件数未知。`;
  }
  if (stage !== "" && order.stage && stage !== order.stage) {
    return `底账工序是${STAGE_LABEL[order.stage] || "未知"}，这次按「${stageName}」重算投入。线别：${line.name}。`;
  }
  if (stage === "") return `底账没有工序。线别：${line.name}。投入不推测。`;
  return `${stageName}，${line.name}。`;
}

function computeParsed(parsed, strategy) {
  const { order, line, type, qty, remainingBefore, due, rates, stage } = parsed;
  const rate = rates[line.id];
  let remainingAfter = remainingBefore;
  const actedPreview = effectiveQty(type, strategy, qty);
  if (type === "add" && remainingBefore != null) remainingAfter = remainingBefore + qty;
  if (type === "cut") remainingAfter = remainingBefore - actedPreview;

  const sampleFinish = applyTeardown(getLine(order.lineId), finishDate(order.remaining, order.rate));
  const shared = sequenceLine(parsed, strategy, remainingAfter, due);
  let ownFinish = shared.shared
    ? shared.finishes.get(order.id)
    : applyTeardown(line, finishDate(remainingAfter, rate));

  const beforeAtRate = applyTeardown(line, finishDate(remainingBefore, rate));
  const dayDelta = !shared.shared && ownFinish?.date && beforeAtRate?.date && beforeAtRate.days != null && ownFinish.days != null
    ? ownFinish.days - beforeAtRate.days
    : null;

  let borrow = { known: true, pieces: 0, unmet: 0, secondDue: null };
  let allocations = [];
  let skipped = [];
  if (!shared.shared) {
    const need = borrowNeed({ ...parsed, strategy }, strategy);
    borrow = { known: need.known, pieces: need.pieces, unmet: 0, secondDue: need.secondDue };
    if (need.known && need.pieces > 0) {
      const pool = donorCandidates(parsed, order.id);
      skipped = pool.skipped;
      const allocated = allocateBorrow(need.pieces, pool.donors);
      borrow.unmet = allocated.unmet;
      allocations = pool.donors.filter((donor) => allocated.taken.has(donor.order.id)).map((donor) => {
        const pieces = allocated.taken.get(donor.order.id);
        const slip = Math.ceil(pieces / donor.rate);
        return {
          orderId: donor.order.id,
          pieces,
          finishBefore: donor.finishBefore,
          finishAfter: addCalendarDays(donor.finishBefore, slip),
          slip,
          kind: donor.kind,
          slackDays: donor.slackDays,
        };
      });
    } else if (!need.known) {
      skipped = donorCandidates(parsed, order.id).skipped;
      borrow.unmet = null;
    }
  }

  const promise = promiseFor(parsed, strategy, ownFinish);
  if (type === "delay") {
    promise.pickupDate = promise.promiseDue ? addCalendarDays(promise.promiseDue, promise.delayDays) : null;
    promise.warehouseDays = stage === "ship" ? promise.delayDays : null;
  } else {
    promise.pickupDate = null;
    promise.warehouseDays = null;
  }

  const flags = plantFlags(parsed, strategy, borrow, allocations, shared);
  const cost = costModel(parsed, strategy, dayDelta);
  const choice = choiceCopy(parsed, strategy, ownFinish, borrow, promise);
  const loadPieces = type === "add" && strategy === "partial"
    ? (remainingBefore == null ? null : remainingBefore + (promise.firstQty || 0))
    : remainingAfter;
  const loadLabel = type === "add" && strategy === "partial" ? "原承诺日前要完成的件数" : "变更后剩余";
  const capacityDue = strategy === "reschedule" ? promise.promiseDue : due;
  const capacity = capacityView(rate, capacityDue, loadPieces, loadLabel);

  const allocationById = new Map(allocations.map((item) => [item.orderId, item]));
  const rowsAfter = ORDERS.map((item) => {
    const onLine = item.id === order.id ? line : getLine(item.lineId);
    const itemRate = rates[onLine.id];
    let itemRemaining = item.remaining;
    let dueIso = item.due;
    let dueText = formatMD(item.due);
    let finish = applyTeardown(onLine, finishDate(item.remaining, itemRate));
    let extra = "";
    let changed = false;

    if (shared.shared && shared.finishes.has(item.id)) {
      finish = shared.finishes.get(item.id);
      if (item.id === order.id) {
        itemRemaining = remainingAfter;
        dueIso = promise.promiseDue || item.due;
        dueText = dueLabel(promise, item.due);
      }
      if (item.id !== order.id) {
        extra = `与 ${order.id} 同线，按交期排队。`;
      }
    } else if (item.id === order.id) {
      itemRemaining = remainingAfter;
      finish = ownFinish;
      dueIso = promise.promiseDue || item.due;
      dueText = dueLabel(promise, item.due);
      extra = targetExtra(parsed, strategy, promise, ownFinish);
    } else if (allocationById.has(item.id)) {
      const allocation = allocationById.get(item.id);
      finish = { date: allocation.finishAfter, days: null, reason: "" };
      extra = `若要守住本次承诺，借出 ${formatInt(allocation.pieces)} 件缓冲，完工从 ${formatMD(allocation.finishBefore)} 移到 ${formatMD(allocation.finishAfter)}。`;
    }

    const sample = baselineRows().find((row) => row.id === item.id);
    if (item.id === order.id || allocationById.has(item.id) || finish?.date !== sample.finishIso || dueText !== sample.dueText || onLine.name !== sample.lineName) {
      changed = item.id === order.id || allocationById.has(item.id) || finish?.date !== sample.finishIso || dueText !== sample.dueText || onLine.name !== sample.lineName;
    }
    if (item.id === order.id && (type === "delay" || type === "ratio") && qty > 0) changed = true;

    const noteCore = item.id === order.id
      ? targetNote(parsed, finish, promise, strategy)
      : baseNote(item, onLine, finish?.date ? { date: finish.date } : finish);
    return makeRow({
      order: item,
      line: onLine,
      remaining: item.id === order.id ? itemRemaining : item.remaining,
      rate: item.id === order.id ? rate : itemRate,
      dueIso,
      dueText,
      finish,
      note: [noteCore, extra].filter(Boolean).join(""),
      changed,
    });
  });

  const warnings = [];
  if (due < ANCHOR) warnings.push("承诺日早于示例日，按已经逾期计算。示例日不改。");
  if (rate === 0) warnings.push("日均是 0，不能做除法，完工写未知。");
  if (ownFinish?.reason) warnings.push(ownFinish.reason);
  if (stage !== "" && order.stage && stage !== order.stage) warnings.push("工序和底账不一致。投入按你选的工序重算，不把底账比例套过来。");
  if (order.verbal && remainingBefore != null && rate > 0) warnings.push("底账原来是口头数。这次完工用的是你填进来的剩余和日均。");
  if (type === "ratio" && remainingBefore == null) warnings.push("剩余未知，无法判断改配件数有没有超过本单。");

  const otherImpact = otherImpactText(parsed, borrow, allocations, shared, skipped);
  const bottleneck = capacity.known
    ? `${line.name}。${capacity.days} 个日历日可做 ${formatInt(capacity.canMake)} 件，${capacity.loadLabel} ${formatInt(capacity.loadPieces)} 件。`
    : `${line.name}。日均或剩余不够，瓶颈件数未知。`;

  const incurredPending = cost.rows.some((row) => row.node !== `加量 ${formatInt(qty)} 件的料和工` && (row.bucket === "已发生" || row.bucket === "部分已发生" || row.bucket === "待确认"));
  const light = reviewLight({
    parsed,
    strategy,
    ownFinish,
    borrow,
    allocations,
    promise,
    incurredPending,
    shared,
  });

  return {
    ok: true,
    id: evaluationId(parsed, strategy),
    anchor: ANCHOR,
    strategy,
    orderId: order.id,
    customer: order.customer,
    type,
    typeLabel: TYPE_LABEL[type],
    strategyLabel: STRATEGY_LABEL[strategy],
    qty,
    stage,
    lineId: line.id,
    lineName: line.name,
    remainingBefore,
    remainingAfter,
    rate,
    askedDue: due,
    promiseDue: promise.promiseDue,
    secondDue: promise.secondDue,
    firstQty: promise.firstQty,
    secondQty: promise.secondQty,
    delayDays: promise.delayDays,
    pickupDate: promise.pickupDate,
    warehouseDays: promise.warehouseDays,
    own: {
      finishSample: sampleFinish?.date || null,
      finishAfter: ownFinish?.date || null,
      daysAfter: ownFinish?.days ?? null,
      dayDelta,
    },
    borrow: {
      known: borrow.known,
      pieces: borrow.pieces,
      unmet: borrow.unmet,
      allocations,
      skipped,
    },
    shared: shared.shared,
    flags,
    cost,
    reviewers: reviewersFor(parsed, strategy, flags),
    capacity,
    whereText: whereText(parsed),
    bottleneck,
    otherImpact,
    headline: buildHeadline(parsed, strategy, ownFinish, borrow, promise, allocations),
    trace: buildTrace(parsed, strategy, ownFinish, sampleFinish, borrow, allocations, promise, shared),
    warnings,
    light: light.light,
    lightReason: light.reason,
    choiceTitle: choice.title,
    choiceDetail: choice.detail,
    rowsBefore: baselineRows(),
    rowsAfter,
  };
}

function dueLabel(promise, originalDue) {
  if (promise.secondDue) return `${formatMD(promise.promiseDue)}／${formatMD(promise.secondDue)}`;
  if (promise.promiseDue && promise.promiseDue !== originalDue) return formatMD(promise.promiseDue);
  return formatMD(originalDue);
}

function targetExtra(parsed, strategy, promise, ownFinish) {
  if (parsed.type === "delay" && promise.pickupDate) {
    const hold = promise.warehouseDays == null ? "占仓天数未知" : `待出货，占仓 ${promise.warehouseDays} 天（不折算金额）`;
    return `提货日 ${formatMD(promise.pickupDate)}。${hold}。`;
  }
  if (strategy === "reschedule" && promise.promiseDue) {
    return `承诺日改为 ${formatMD(promise.promiseDue)}。`;
  }
  if (ownFinish?.reason && !ownFinish.date) return "";
  return "";
}

function targetNote(parsed, finish, promise, strategy) {
  if (!finish?.date) return finish?.reason ? `${finish.reason}。` : "完工未知。";
  const due = promise.promiseDue;
  if (!due) return `本线完工 ${formatMD(finish.date)}。承诺日未知。`;
  if (finish.date > due) {
    return `只在本线做，完工 ${formatMD(finish.date)}，晚于承诺 ${formatMD(due)} ${calendarDaysBetween(due, finish.date)} 天。`;
  }
  const buffer = calendarDaysBetween(finish.date, due);
  if (buffer < BUFFER_DAYS) return `本线完工 ${formatMD(finish.date)}，与承诺同一天或只剩不到 ${BUFFER_DAYS} 天缓冲。`;
  return `本线完工 ${formatMD(finish.date)}，不晚于承诺 ${formatMD(due)}。`;
}

function otherImpactText(parsed, borrow, allocations, shared, skipped) {
  if (shared.shared) {
    const others = shared.members.filter((member) => member.order.id !== parsed.order.id)
      .map((member) => member.order.id);
    return others.length
      ? `和 ${others.join("、")} 同线，按交期先后做。不再向线外借一次，避免算两遍。`
      : "同一条线上没有别的单。";
  }
  if (parsed.type !== "add" || (borrow.known && borrow.pieces === 0)) {
    return "其他订单的完工保持底账。腾出的产能不自动改派。";
  }
  if (!borrow.known) return "缺日均或剩余，影响不到具体订单，也不写晚几天。";
  const bits = allocations.map((item) => `${item.orderId} 完工从 ${formatMD(item.finishBefore)} 到 ${formatMD(item.finishAfter)}`);
  const unknown = skipped.slice(0, 3).map((item) => `${item.orderId}（${item.reason}）`);
  let text = bits.length ? `会动到：${bits.join("；")}。` : "没有订单能借出可计算的缓冲。";
  if (borrow.unmet > 0) text += `还有 ${formatInt(borrow.unmet)} 件没有去处。`;
  if (unknown.length) text += `不编天数的有：${unknown.join("、")}。`;
  return text;
}

function reviewLight({ parsed, strategy, ownFinish, borrow, allocations, promise, incurredPending, shared }) {
  const reasons = [];
  let light = "green";
  const raise = (level, text) => {
    const rank = { green: 0, yellow: 1, grey: 2, red: 3 };
    if (rank[level] >= rank[light]) light = level;
    reasons.push(text);
  };
  const deliveryUnknown = parsed.type !== "ratio" && parsed.type !== "delay" && !ownFinish?.date;
  const othersLate = allocations.some((item) => item.finishAfter > getOrder(item.orderId).due);
  if (othersLate) raise("red", "按这条规则，会把别的单推过它自己的交期。");
  if (borrow.known && borrow.unmet > 0) raise("red", "要守住承诺的话，还有件数没有可计算的去处，不编造晚几天。");
  if (incurredPending && parsed.qty > 0 && parsed.type !== "delay") {
    raise("red", "已经有料、裁剪或配比要人确认。已投入不是损失，也不是客户应付。");
  }
  if (shared.shared && parsed.qty >= 0) raise("yellow", "同一条线的先后顺序变了，要看被排到后面的那张单。");
  if (borrow.known && borrow.pieces > 0 && !othersLate) raise("yellow", "要守住承诺，会占用别的单的缓冲，但那些单还没被推过交期。");
  if (parsed.type === "delay" && parsed.qty > 0) raise("yellow", "提货推迟要登记。这不是生产加单。");
  if (promise.promiseDue && ownFinish?.date && strategy !== "reschedule" && ownFinish.date > promise.promiseDue && parsed.type === "add" && parsed.qty > 0) {
    raise("yellow", "只在本线做，会晚于承诺。");
  }
  if (strategy === "reschedule" && promise.promiseDue && ownFinish?.date && calendarDaysBetween(ownFinish.date, promise.promiseDue) < BUFFER_DAYS) {
    raise("yellow", `换到的日期几乎没有缓冲（少于 ${BUFFER_DAYS} 天，假设）。`);
  }
  if (deliveryUnknown) raise("grey", "缺日均或剩余，完工未知，不能判断会不会晚。");
  if (parsed.qty === 0 && light === "green") reasons.push("这次数量是 0，不新增占用。");
  if (light === "green" && reasons.length === 0) reasons.push("按当前数字，交期内做完，也不用借其他线的缓冲。");
  const unique = [...new Set(reasons)];
  return { light, reason: unique.join("") };
}

function evaluationId(parsed, strategy) {
  const rates = {};
  for (const key of Object.keys(parsed.rates).sort()) rates[key] = parsed.rates[key];
  return JSON.stringify({
    orderId: parsed.order.id,
    type: parsed.type,
    qty: parsed.qty,
    remaining: parsed.remainingBefore,
    due: parsed.due,
    stage: parsed.stage,
    lineId: parsed.line.id,
    strategy,
    rates,
  });
}

export function evaluate(form, strategy, lineRates) {
  const parsed = validate({ ...form, strategy }, lineRates);
  if (!parsed.ok) {
    return { ok: false, id: null, error: parsed.error, rowsBefore: baselineRows(), rowsAfter: null };
  }
  const active = computeParsed(parsed, strategy);
  const choices = {};
  for (const item of ["full", "partial", "reschedule"]) {
    const result = item === strategy ? active : computeParsed(parsed, item);
    choices[item] = { title: result.choiceTitle, detail: result.choiceDetail };
  }
  active.choices = choices;
  return active;
}

export function defaultForm() {
  const order = getOrder("A-0412");
  return {
    orderId: order.id,
    type: "add",
    qty: "6000",
    keepDue: true,
    due: order.due,
    stage: order.stage,
    lineId: order.lineId,
    remaining: String(order.remaining),
  };
}

export function initialLineRates() {
  return Object.fromEntries(LINES.map((line) => [line.id, line.actualRate == null ? "" : String(line.actualRate)]));
}

function recompute(state) {
  return {
    ...state,
    evaluation: evaluate(state.form, state.strategy, state.lineRates),
  };
}

export function createInitialState() {
  const state = recompute({
    form: defaultForm(),
    strategy: "full",
    lineRates: initialLineRates(),
    applied: null,
    notice: "",
  });
  state.notice = "";
  return state;
}

export function reduce(state, action) {
  switch (action.type) {
    case "set-form": {
      let form = { ...state.form, ...action.patch };
      if (action.patch.orderId && action.patch.orderId !== state.form.orderId) {
        const order = getOrder(action.patch.orderId);
        if (!order) return { ...state, notice: "没有这张示例订单" };
        form = {
          orderId: order.id,
          type: state.form.type,
          qty: "",
          keepDue: true,
          due: order.due,
          stage: order.stage || "",
          lineId: order.lineId,
          remaining: order.remaining == null ? "" : String(order.remaining),
        };
      }
      if (action.patch.keepDue) {
        const order = getOrder(form.orderId);
        form = { ...form, due: order.due };
      }
      return { ...recompute({ ...state, form }), notice: "" };
    }
    case "set-line-rate": {
      if (!getLine(action.lineId)) return state;
      const lineRates = { ...state.lineRates, [action.lineId]: action.value };
      return { ...recompute({ ...state, lineRates }), notice: "" };
    }
    case "set-strategy": {
      if (!["full", "partial", "reschedule"].includes(action.strategy)) {
        return { ...state, notice: "没有这个回复选项" };
      }
      return { ...recompute({ ...state, strategy: action.strategy }), notice: "" };
    }
    case "evaluate": {
      const next = recompute(state);
      const notice = next.evaluation.ok ? next.evaluation.headline : next.evaluation.error.message;
      return { ...next, notice };
    }
    case "apply": {
      if (!state.evaluation?.ok) return { ...state, notice: "上面的输入还没法算，没有套用。" };
      if (state.applied?.id === state.evaluation.id) {
        return { ...state, notice: "这次预览已经套用，不会重复加上去。" };
      }
      const replacing = state.applied != null;
      return {
        ...state,
        applied: {
          id: state.evaluation.id,
          orderId: state.evaluation.orderId,
          strategy: state.evaluation.strategy,
          qty: state.evaluation.qty,
          type: state.evaluation.type,
          remainingAfter: state.evaluation.remainingAfter,
          headline: state.evaluation.headline,
        },
        notice: replacing
          ? "已用这次预览替换上一次套用。从底账重算，没有叠加。"
          : "已套用到本页示例。可以撤销。没有审批，也没有发给客户。",
      };
    }
    case "undo": {
      if (!state.applied) return { ...state, notice: "当前没有需要撤销的套用。" };
      return { ...state, applied: null, notice: "已撤销本地套用；当前输入和试算预览仍保留，可继续修改或重置。" };
    }
    case "reset":
      return { ...createInitialState(), notice: "已恢复默认示例：客户A / A-0412 / 加 6,000 件。" };
    default:
      return state;
  }
}
