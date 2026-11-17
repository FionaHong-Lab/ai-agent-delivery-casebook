import {
  ANCHOR,
  CHANGE_TYPES,
  LINE_STATUS_LABEL,
  LINES,
  ORDERS,
  STAGES,
  STRATEGIES,
} from "./data.js";
import { createInitialState, evaluate, formatInt, reduce } from "./calc.js";
import { SCENE } from "./scene.js";

const app = document.getElementById("app");
const live = document.getElementById("live");
let state = createInitialState();
const sceneParam = new URLSearchParams(window.location.search).get("scene");
let sceneOpen = sceneParam === SCENE.id;
let needsReview = false;
app.addEventListener("toggle", (event) => {
  if (event.target.id === "scene-details") sceneOpen = event.target.open;
}, true);

document.getElementById("reset-top").addEventListener("click", () => dispatch({ type: "reset" }));
app.addEventListener("input", onEdit);
app.addEventListener("change", onEdit);
app.addEventListener("click", onClick);

function dispatch(action) {
  if (action.type === "apply" && needsReview) return;
  if (action.type === "set-form" || action.type === "set-line-rate") needsReview = true;
  if (action.type === "evaluate" || action.type === "reset") needsReview = false;
  state = reduce(state, action);
  if (live) live.textContent = state.notice || "";
  render();
}

function onEdit(event) {
  const target = event.target;
  if (target.id === "customer") {
    const current = ORDERS.find((order) => order.id === state.form.orderId);
    if (current?.customer === target.value) return;
    const next = ORDERS.find((order) => order.customer === target.value);
    if (next) dispatch({ type: "set-form", patch: { orderId: next.id } });
    return;
  }
  if (target.dataset.field) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    dispatch({ type: "set-form", patch: { [target.dataset.field]: value } });
    return;
  }
  if (target.dataset.rate) {
    dispatch({ type: "set-line-rate", lineId: target.dataset.rate, value: target.value });
    return;
  }
  if (target.name === "strategy") {
    dispatch({ type: "set-strategy", strategy: target.value });
  }
}

function onClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  dispatch({ type: action });
  if (action === "evaluate") document.getElementById("review")?.focus();
}

function render() {
  const y = window.scrollY;
  const active = document.activeElement;
  const focusId = active?.id || "";
  const caret = active && "selectionStart" in active ? active.selectionStart : null;
  app.innerHTML = view(state);
  window.scrollTo(0, y);
  if (!focusId) return;
  const next = document.getElementById(focusId);
  if (!next) return;
  next.focus();
  if (caret != null && next.setSelectionRange) {
    try { next.setSelectionRange(caret, caret); } catch { /* date inputs */ }
  }
}

function view(current) {
  const evaluation = current.evaluation;
  return `
    ${steps(current)}
    ${sceneCard(current)}
    <div class="layout">
      ${formCard(current)}
      ${reviewCard(current)}
    </div>
    <section class="card stack" aria-labelledby="board-title">
      <div class="section-head">
        <h2 id="board-title">交期风险表</h2>
        <span class="light ${statusTone(current)}">${esc(statusText(current))}</span>
      </div>
      <p class="quiet">变更前是示例日 ${ANCHOR} 的底账。变更后按当前输入预览。套用不会叠加；撤销套用后，当前预览仍保留。</p>
      <h3>选择一个回复方案，看风险怎么变化</h3>
      <p class="hint">同一份输入分别试算；切换方案不会累加数量。结果是示例规则，不是对客户的承诺。</p>
      <div class="choices" role="radiogroup" aria-label="回复选项">${strategyChoices(current)}</div>
      ${board("变更前", evaluation.rowsBefore, "before")}
      ${needsReview ? `<p class="hint">输入已改变，请点击“评估影响”确认当前预览后再套用。</p>` : ""}
      ${evaluation.ok ? board("变更后", evaluation.rowsAfter, "after") : `<p class="error">变更后先空着。${esc(evaluation.error.message)}</p>`}
      <p class="footnote">灯：红 = 晚于交期或配套不齐；黄 = 缓冲少于 2 天、数对不上或停机；灰 = 口头数或缺数；绿 = 算得清且不晚。灯只是提示，回复由人决定。</p>
    </section>
    <section class="card stack">
      <h2>本地套用</h2>
      <p>套用只改这一页的示例。不是审批，不写入别的系统，也不向客户发消息。</p>
      ${current.applied ? `<p class="callout"><strong>本页记录</strong>${esc(current.applied.headline)}</p>` : ""}
      <div class="actions">
        <button type="button" class="btn" data-action="apply" ${applyDisabled(current) ? "disabled" : ""}>${esc(applyLabel(current))}</button>
        <button type="button" class="btn ghost" data-action="undo" ${current.applied ? "" : "disabled"}>撤销套用</button>
        <button type="button" class="btn ghost" data-action="reset">重置为默认示例</button>
      </div>
      ${current.notice ? `<p class="hint">${esc(current.notice)}</p>` : ""}
    </section>
    <details class="card stack">
      <summary>计算口径（都是假设，标在示例上）</summary>
      <ul>
        <li>预计完工 = 示例日 ${ANCHOR} + 向上取整（剩余件数 ÷ 近3日日均）个日历日。不跳过周日，也不用今天的日期。</li>
        <li>计划日产只对照，不代入。日均空着或是 0，完工写未知。</li>
        <li>全接、部分接只借「这次多出来、承诺日前放不下」的件数。先借新厂缓冲，不够才用老厂。停机、口头数、没有日均的拆线，不编晚几天。</li>
        <li>部分接：原日期先接一半（向下取整），另一半顺延 7 天。换交期把承诺改到本线做完的那天，不借线。</li>
        <li>已发生的料和工不是损失，也不是客户要付的钱。</li>
      </ul>
    </details>
    <p class="footnote">示例数据・非企业内部系统。公开资料推演，非真实项目。客户只有 A / B / C / D。</p>
  `;
}

function sceneCard(current) {
  const e = current.evaluation;
  const matches = e.ok && e.orderId === SCENE.orderId && e.type === "add" && e.qty === SCENE.additionalPieces;
  const finish = matches ? e.own.finishAfter : null;
  const days = finish ? Math.round((Date.parse(finish + "T00:00:00Z") - Date.parse(SCENE.requestedDate + "T00:00:00Z")) / 86400000) : null;
  const check = !matches ? "当前输入与固定示例不同，请先恢复默认示例，再比较客户希望日期。" : !finish ? "缺少有效日均或剩余量，无法判断希望日期。" : days > 0 ? `按当前输入，本线预计 ${finish} 完工，比客户希望的 ${SCENE.requestedDate} 晚 ${days} 天；该日期不能直接当成可承诺日期。` : `按当前输入，本线预计 ${finish} 完工，可在客户希望的 ${SCENE.requestedDate} 前完成；仍需人核实其他限制。`;
  return `<section class="card scene" id="scene-${esc(SCENE.id)}" aria-labelledby="scene-title">
    <div class="section-head"><h2 id="scene-title">客户 A · 订单变化场景</h2><span class="light tone-yellow">虚构情节</span></div>
    <p>${esc(SCENE.disclaimer)}</p>
    ${sceneParam && sceneParam !== SCENE.id ? `<p class="error">找不到场景 ${esc(sceneParam)}，已显示默认示例。</p>` : ""}
    <details id="scene-details" ${sceneOpen ? "open" : ""}>
      <summary>查看场景详情与公开背景</summary>
      <p>示例日 ${esc(SCENE.baselineDate)}：客户 A 希望 A-0412 加 6,000 件，原交期 11/28 不变；另一项待检验的希望日期为 12/02。新厂吊挂 3 线缝制中，示例设定面料已到、已裁 70%。</p>
      <p><strong>公开背景：</strong>迅销截至 ${esc(SCENE.evidenceDate)} 的生产伙伴名单第 3 页第 231 项列有 Shenzhou Knitting (Anhui) Co., Ltd.。名单包含直接和间接合作工厂，不能据此确定本示例对应品牌或订单。 <a href="${esc(SCENE.evidenceUrl)}">查看官方名单</a></p>
      <p><strong>12/02 可行性：</strong>${esc(check)}</p>
      <p>固定规则试算，不是实时 AI；已投入不等于损失。方案由人审阅和决定。</p>
      <p>场景版本 ${esc(SCENE.version)} · <a href="${esc(SCENE.docUrl)}">阅读同一场景说明</a></p>
      <button type="button" class="btn ghost" data-action="reset">载入固定示例</button>
    </details>
  </section>`;
}

function steps(current) {
  const ok = current.evaluation.ok;
  const applied = ok && current.applied?.id === current.evaluation.id;
  const items = [
    ["填写改单", ok],
    ["规则快评", ok],
    ["预览风险变化", ok],
    ["本地套用（非审批）", applied],
  ];
  return `<ol class="steps">${items.map(([label, done], index) =>
    `<li class="step ${done ? "is-done" : ""} ${!done && (index === 0 || items[index - 1][1]) ? "is-on" : ""}"><i>${index + 1}</i>${label}</li>`
  ).join("")}</ol>`;
}

function formCard(current) {
  const form = current.form;
  const order = ORDERS.find((item) => item.id === form.orderId);
  const error = current.evaluation.ok ? null : current.evaluation.error;
  const customers = [...new Set(ORDERS.map((item) => item.customer))];
  const invalid = (field) => error?.field === field;
  return `<section class="card" aria-labelledby="form-title">
    <h2 id="form-title">填写改单</h2>
    <div class="grid-2">
      <div class="field">
        <label for="customer">客户</label>
        <select id="customer">${customers.map((name) => `<option ${name === order.customer ? "selected" : ""}>${esc(name)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label for="orderId">订单号</label>
        <select id="orderId" data-field="orderId">${ORDERS.filter((item) => item.customer === order.customer).map((item) =>
          `<option value="${item.id}" ${item.id === form.orderId ? "selected" : ""}>${esc(item.id)}</option>`
        ).join("")}</select>
      </div>
    </div>
    <fieldset class="field">
      <legend>改单类型</legend>
      <div class="types">${CHANGE_TYPES.map((item) => `<label class="type"><input type="radio" name="change-type" data-field="type" value="${item.id}" ${form.type === item.id ? "checked" : ""}>${esc(item.label)}</label>`).join("")}</div>
    </fieldset>
    <div class="grid-2">
      <div class="field">
        <label for="qty">${form.type === "delay" ? "推迟天数" : "变更数量（件）"}</label>
        <input id="qty" data-field="qty" inputmode="numeric" autocomplete="off" value="${esc(form.qty)}" aria-invalid="${invalid("qty")}" aria-describedby="qty-hint">
        <span class="hint" id="qty-hint">0 表示这次没有数量变化。负数和小数不能算。</span>
      </div>
      <div class="field">
        <label for="due">交期</label>
        <input id="due" type="date" data-field="due" value="${esc(form.due)}" ${form.keepDue ? "disabled" : ""} aria-invalid="${invalid("due")}">
        <label class="check"><input id="keepDue" type="checkbox" data-field="keepDue" ${form.keepDue ? "checked" : ""}>交期不变（用底账日期）</label>
      </div>
    </div>
    <div class="grid-2">
      <div class="field">
        <label for="stage">当前工序</label>
        <select id="stage" data-field="stage">${STAGES.map((item) => `<option value="${item.id}" ${form.stage === item.id ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label for="lineId">厂区 / 线别</label>
        <select id="lineId" data-field="lineId">${LINES.map((line) => `<option value="${line.id}" ${form.lineId === line.id ? "selected" : ""}>${esc(line.name)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="field">
      <label for="remaining">本单剩余（件，可改）</label>
      <input id="remaining" data-field="remaining" inputmode="numeric" autocomplete="off" value="${esc(form.remaining)}" aria-invalid="${invalid("remaining")}" aria-describedby="remain-hint">
      <span class="hint" id="remain-hint">留空表示未知，完工不会被猜一个日期。昨日 ${yesterday(order)}，不参与计算。</span>
    </div>
    ${error ? `<p class="error">${esc(error.message)}</p>` : ""}
    ${current.evaluation.ok ? capacityBlock(current.evaluation.capacity) : ""}
    <h3>各线近3日日均（件/日，可改）</h3>
    <p class="hint">完工只用这一列。计划日产不代入。空着就是未知。</p>
    <table class="rates">
      <thead><tr><th>线别</th><th>状态</th><th>计划日产</th><th>近3日日均</th></tr></thead>
      <tbody>${LINES.map((line) => `<tr>
        <td>${esc(line.name)}</td>
        <td>${esc(LINE_STATUS_LABEL[line.status] || line.status)}</td>
        <td>${line.plannedRate == null ? "—" : formatInt(line.plannedRate)}</td>
        <td><input id="rate-${line.id}" data-rate="${line.id}" inputmode="numeric" aria-label="${esc(line.name)}近3日日均" value="${esc(current.lineRates[line.id] ?? "")}" aria-invalid="${invalid(`rate:${line.id}`)}"></td>
      </tr>`).join("")}</tbody>
    </table>
    <div class="actions" style="margin-top:12px">
      <button type="button" class="btn wide" data-action="evaluate">评估影响</button>
      <button type="button" class="btn ghost wide" data-action="reset">重置为默认示例</button>
    </div>
  </section>`;
}

function capacityBlock(capacity) {
  if (!capacity?.known) return `<p class="hint">负荷无法计算：缺日均、缺剩余，或这段时间没有可排的天数。</p>`;
  return `<div class="callout">
    <strong>${esc(capacity.levelText)}</strong>
    <span class="hint">${esc(capacity.loadLabel)} ${formatInt(capacity.loadPieces)} 件；${capacity.days} 个日历日可做 ${formatInt(capacity.canMake)} 件。不显示百分比。</span>
    <div class="bar ${capacity.level}"><i style="width:${capacity.width}%"></i></div>
  </div>`;
}

function reviewCard(current) {
  const evaluation = current.evaluation;
  if (!evaluation.ok) {
    return `<section class="card" id="review" tabindex="-1" aria-labelledby="review-title">
      <h2 id="review-title">规则快评</h2>
      <p class="error">${esc(evaluation.error.message)}</p>
      <p class="hint">没有用猜测把表填满。改完输入会按规则重算。</p>
    </section>`;
  }
  return `<section class="card" id="review" tabindex="-1" aria-labelledby="review-title">
    <div class="section-head">
      <h2 id="review-title">规则快评</h2>
      <span class="light tone-${evaluation.light}">${lightName(evaluation.light)} · 快评</span>
    </div>
    <p>${esc(evaluation.headline)}</p>
    <p class="hint">${esc(evaluation.lightReason)}快评完成前，不答应也不拒绝。</p>
    <div class="chips">
      <div class="chip"><strong>走到哪</strong><br>${esc(evaluation.whereText)}</div>
      <div class="chip"><strong>瓶颈</strong><br>${esc(evaluation.bottleneck)}</div>
    </div>
    <h3>已发生 / 尚未发生 / 待确认</h3>
    <p class="hint">${esc(evaluation.cost.incurredSummary)}</p>
    <p class="hint">${esc(evaluation.cost.recoverableSummary)}</p>
    <p class="hint">${esc(evaluation.cost.incrementalSummary)}</p>
    <table>
      <thead><tr><th>节点</th><th>状态</th><th>归类</th></tr></thead>
      <tbody>${evaluation.cost.rows.map((row) => `<tr><td>${esc(row.node)}</td><td>${esc(row.state)}<br><span class="quiet">${esc(row.detail)}</span></td><td>${esc(row.bucket)}</td></tr>`).join("")}</tbody>
    </table>
    <h3>对他单</h3>
    <p>${esc(evaluation.otherImpact)}</p>
    <h3>建议谁来看</h3>
    <div class="people">${evaluation.reviewers.map((person) => `<div class="person"><b>${esc(person.role)}</b><span class="quiet">${esc(person.reason)}</span></div>`).join("")}</div>
    ${evaluation.warnings.length ? `<ul class="trace">${evaluation.warnings.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
    <h3>计算过程</h3>
    <ol class="trace">${evaluation.trace.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
  </section>`;
}

function strategyChoices(current) {
  return STRATEGIES.map((item) => {
    const choice = current.evaluation.ok ? current.evaluation.choices[item.id] : null;
    const result = current.evaluation.ok ? evaluate(current.form, item.id, current.lineRates) : null;
    const finish = result?.own?.finishAfter || "未知";
    const borrow = result?.borrow?.known ? `${formatInt(result.borrow.pieces)} 件` : "未知";
    const on = current.strategy === item.id;
    return `<label class="choice ${on ? "is-on" : ""}">
      <input id="strategy-${item.id}" type="radio" name="strategy" value="${item.id}" ${on ? "checked" : ""}>
      <span><strong>${esc(choice?.title || item.label)}</strong>
        ${result ? `<span class="choice-metrics"><span>本线预计完工 <b>${esc(finish)}</b></span><span>需借产量 <b>${esc(borrow)}</b></span><span>快评 <b>${esc(lightName(result.light))}</b></span></span>` : ""}
        <small>${esc(choice?.detail || "")}</small></span>
    </label>`;
  }).join("");
}

function board(title, rows, key) {
  const body = rows.map((row) => `<div class="board-row row-${row.light} ${row.changed ? "is-changed" : ""}" role="row">
    ${cell("状态", `<span class="light tone-${row.light}">${esc(row.lightLabel)}</span>`)}
    ${cell("订单", esc(row.id))}
    ${cell("客户", esc(row.customer))}
    ${cell("交期", esc(row.dueText))}
    ${cell("线别", esc(row.lineName))}
    ${cell("剩余", esc(row.remainingText))}
    ${cell("日均", esc(row.rateText))}
    ${cell("预计完工", esc(row.finishText))}
    ${cell("说明", `${esc(row.note)}<small>${esc(row.meta)}</small>`, "note")}
  </div>`).join("");
  return `<div class="board" role="table" aria-label="${esc(title)}">
    <div class="section-head"><h3>${esc(title)}</h3></div>
    <div class="board-row board-head" role="row">
      ${["状态", "订单", "客户", "交期", "线别", "剩余", "日均", "预计完工", "说明"].map((name) => `<div role="columnheader">${name}</div>`).join("")}
    </div>
    ${body}
  </div>`;
}

function cell(label, html, extra = "") {
  return `<div class="cell ${extra}" role="cell" data-label="${label}">${html}</div>`;
}

function statusText(current) {
  if (!current.evaluation.ok) return "还不能评估";
  if (current.applied?.id === current.evaluation.id) return "已套用到本页";
  if (current.applied) return "预览已变 · 再套用会替换，不会叠加";
  return "预览中 · 尚未套用";
}

function statusTone(current) {
  if (!current.evaluation.ok) return "tone-grey";
  if (current.applied?.id === current.evaluation.id) return "tone-green";
  return "tone-yellow";
}

function applyDisabled(current) {
  return needsReview || !current.evaluation.ok || current.applied?.id === current.evaluation.id;
}

function applyLabel(current) {
  if (needsReview) return "请先重新评估";
  if (!current.evaluation.ok) return "先改到可以计算";
  if (current.applied?.id === current.evaluation.id) return "这次已经套用";
  if (current.applied) return "用这次预览替换";
  return "本地套用此预览";
}

function lightName(light) {
  return { red: "红", yellow: "黄", grey: "灰", green: "绿" }[light] || light;
}

function yesterday(order) {
  const plan = order.yesterdayPlan == null ? "—" : formatInt(order.yesterdayPlan);
  const actual = order.yesterdayActual == null ? "—" : formatInt(order.yesterdayActual);
  return `${plan}/${actual}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

render();
