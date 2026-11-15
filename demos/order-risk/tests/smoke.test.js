import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createInitialState, finishDate, reduce } from "../calc.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("baseline finishes match the sample board", () => {
  const rows = Object.fromEntries(createInitialState().evaluation.rowsBefore.map((row) => [row.id, row]));
  assert.equal(finishDate(14800, 1420).date, "2026-12-01");
  assert.equal(finishDate(8000, 1620).date, "2026-11-25");
  assert.equal(finishDate(9600, 1600).date, "2026-11-26");
  assert.equal(finishDate(3100, 1700).date, "2026-11-22");
  assert.equal(rows["A-0412"].finishIso, "2026-12-01");
  assert.equal(rows["A-0412"].light, "red");
  assert.equal(rows["B-0377"].finishIso, "2026-11-22");
  assert.equal(rows["B-0377"].light, "red");
  assert.equal(rows["C-0521"].finishIso, "2026-11-26");
  assert.equal(rows["C-0521"].light, "yellow");
  assert.equal(rows["A-0430"].finishIso, null);
  assert.equal(rows["A-0430"].light, "yellow");
  assert.equal(rows["D-0118"].finishIso, null);
  assert.equal(rows["D-0118"].light, "grey");
  assert.equal(rows["B-0390"].finishIso, "2026-11-25");
  assert.equal(rows["B-0390"].light, "green");
});

test("default add, partial and reschedule stay consistent", () => {
  let state = createInitialState();
  assert.equal(state.evaluation.remainingAfter, 20800);
  assert.equal(state.evaluation.own.finishAfter, "2026-12-05");
  assert.equal(state.evaluation.borrow.pieces, 6000);
  assert.equal(state.evaluation.borrow.allocations[0].orderId, "C-0521");
  assert.equal(state.evaluation.borrow.allocations[0].finishAfter, "2026-11-30");
  assert.equal(state.evaluation.borrow.unmet, 0);
  assert.equal(state.evaluation.rowsAfter.find((row) => row.id === "A-0430").finishIso, null);

  state = reduce(state, { type: "set-strategy", strategy: "partial" });
  assert.equal(state.evaluation.borrow.pieces, 3000);
  assert.equal(state.evaluation.firstQty, 3000);
  assert.equal(state.evaluation.secondDue, "2026-12-05");
  assert.equal(state.evaluation.remainingAfter, 20800);

  state = reduce(state, { type: "set-strategy", strategy: "reschedule" });
  assert.equal(state.evaluation.promiseDue, "2026-12-05");
  assert.equal(state.evaluation.borrow.pieces, 0);
  assert.equal(state.evaluation.rowsAfter.find((row) => row.id === "C-0521").finishIso, "2026-11-26");
});

test("each change type and bad numbers", () => {
  const base = createInitialState();
  const cut = reduce(base, { type: "set-form", patch: { type: "cut", qty: "6000" } });
  assert.equal(cut.evaluation.remainingAfter, 8800);
  assert.equal(cut.evaluation.own.finishAfter, "2026-11-27");

  const ratio = reduce(base, { type: "set-form", patch: { type: "ratio", qty: "1200" } });
  assert.equal(ratio.evaluation.remainingAfter, 14800);
  assert.equal(ratio.evaluation.own.finishAfter, "2026-12-01");

  const delay = reduce(base, { type: "set-form", patch: { type: "delay", qty: "14" } });
  assert.equal(delay.evaluation.pickupDate, "2026-12-12");
  assert.equal(delay.evaluation.own.finishAfter, "2026-12-01");
  assert.equal(delay.evaluation.warehouseDays, null);

  const zero = reduce(base, { type: "set-form", patch: { qty: "0" } });
  assert.equal(zero.evaluation.ok, true);
  assert.equal(zero.evaluation.borrow.pieces, 0);
  assert.equal(zero.evaluation.remainingAfter, 14800);

  for (const qty of ["", "-1", "1.5", "abc", "10000001"]) {
    const bad = reduce(base, { type: "set-form", patch: { qty } });
    assert.equal(bad.evaluation.ok, false, qty);
    assert.equal(bad.evaluation.rowsAfter, null);
  }
  const over = reduce(base, { type: "set-form", patch: { type: "cut", qty: "14801" } });
  assert.equal(over.evaluation.ok, false);
  assert.match(over.evaluation.error.message, /超过剩余/);
});

test("rate edits change the preview only, and zero rate stays unknown", () => {
  const state = reduce(createInitialState(), { type: "set-line-rate", lineId: "new-3", value: "3000" });
  assert.equal(state.evaluation.rowsBefore.find((row) => row.id === "A-0412").finishIso, "2026-12-01");
  assert.equal(state.evaluation.own.finishAfter, "2026-11-27");
  assert.equal(state.evaluation.borrow.pieces, 0);

  const stopped = reduce(createInitialState(), { type: "set-line-rate", lineId: "new-3", value: "0" });
  assert.equal(stopped.evaluation.ok, true);
  assert.equal(stopped.evaluation.own.finishAfter, null);
  assert.equal(stopped.evaluation.borrow.known, false);

  const verbal = reduce(createInitialState(), { type: "set-form", patch: { orderId: "D-0118" } });
  assert.equal(verbal.form.qty, "");
  assert.equal(verbal.evaluation.ok, false);
  const stillUnknown = reduce(verbal, { type: "set-form", patch: { qty: "0" } });
  assert.equal(stillUnknown.evaluation.own.finishAfter, null);
  assert.equal(stillUnknown.evaluation.light, "grey");
});

test("apply is idempotent, replace does not stack, undo and reset restore baseline", () => {
  let state = reduce(createInitialState(), { type: "apply" });
  assert.equal(state.applied.remainingAfter, 20800);
  const again = reduce(state, { type: "apply" });
  assert.equal(again.applied.remainingAfter, 20800);
  assert.match(again.notice, /不会重复/);

  state = reduce(again, { type: "set-form", patch: { qty: "1000" } });
  state = reduce(state, { type: "apply" });
  assert.equal(state.applied.remainingAfter, 15800);

  state = reduce(state, { type: "undo" });
  assert.equal(state.applied, null);
  assert.equal(state.evaluation.rowsBefore.find((row) => row.id === "A-0412").finishIso, "2026-12-01");

  state = reduce(state, { type: "reset" });
  assert.equal(state.form.orderId, "A-0412");
  assert.equal(state.form.qty, "6000");
  assert.equal(state.strategy, "full");
  assert.equal(state.applied, null);
  assert.equal(state.evaluation.remainingAfter, 20800);
  assert.equal(state.lineRates["new-3"], "1420");
});

test("page copy stays on the sample and does not name real brands", () => {
  const files = ["index.html", "app.js", "calc.js", "data.js", "styles.css"].map((name) =>
    readFileSync(join(root, name), "utf8")
  );
  const src = files.join("\n");
  assert.match(src, /示例数据・非企业内部系统/);
  assert.match(src, /公开资料推演，非真实项目/);
  assert.match(src, /2026-11-20/);
  for (const word of ["优衣库", "耐克", "阿迪", "申洲", "驻场", "FDE", "Uniqlo", "Nike", "Adidas"]) {
    assert.equal(src.includes(word), false, word);
  }
  assert.equal(src.includes("Date.now"), false);
});
