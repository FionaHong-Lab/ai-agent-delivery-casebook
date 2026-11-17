import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInitialState, reduce } from '../demos/order-risk/calc.js';
import { SCENE } from '../demos/order-risk/scene.js';
import { ORDERS } from '../demos/order-risk/data.js';

const state = createInitialState();
const order = ORDERS.find(item => item.id === SCENE.orderId);
const late = Math.round((Date.parse(state.evaluation.own.finishAfter + 'T00:00:00Z') - Date.parse(SCENE.requestedDate + 'T00:00:00Z')) / 86400000);
const outcomes = ['full', 'partial', 'reschedule'].map(strategy => reduce(state, { type: 'set-strategy', strategy }).evaluation);
const rows = outcomes.map(e => `- ${e.choiceTitle}：${e.choiceDetail}`);
const content = `### A-0412

**订单变化：客户 A 加单（虚构示例）**

${SCENE.disclaimer}

固定场景 ${SCENE.id}，版本 ${SCENE.version}，示例日 ${SCENE.baselineDate}。假设订单 ${SCENE.orderId} 新增 ${SCENE.additionalPieces.toLocaleString('en-US')} 件，原交期 ${order.due}；面料已到、已裁 ${order.cutRatio * 100}%，新厂吊挂 3 线缝制中。客户希望日期 ${SCENE.requestedDate} 是另一个待检验日期，不是承诺。

原剩余 ${order.remaining.toLocaleString('en-US')} 件、近三日日均 ${order.rate.toLocaleString('en-US')} 件；完工按示例日加向上取整的自然日算。原单预计 ${state.evaluation.own.finishSample} 完工；加单后仅在本线预计 ${state.evaluation.own.finishAfter} 完工，比客户希望日 ${SCENE.requestedDate} ${late > 0 ? `晚 ${late} 天` : `提前或持平 ${-late} 天`}。线别借用是演示假设，不能当作真实排产能力。

${rows.join('\n')}

其他订单原有的停机、缺码、对数差及未知应保留，不能为了方案结局抹除。已投入不等于损失；以上只是固定规则试算，接受与否由人决定。

公开背景：迅销截至 ${SCENE.evidenceDate} 的[生产伙伴名单第 3 页第 231 项](${SCENE.evidenceUrl})列有 Shenzhou Knitting (Anhui) Co., Ltd.；名单含直接及间接合作工厂，不能证明本示例订单或特定品牌关系。

[返回在线体验](https://fionahong-lab.github.io/ai-agent-delivery-casebook/?scene=${SCENE.id}) · [下载订单场景说明 PDF](./assets/case-07/order-change-scene-v2.pdf)

公开资料推演，非真实项目。`;
const markerStart = '<!-- ORDER-SCENE:START -->';
const markerEnd = '<!-- ORDER-SCENE:END -->';
const file = 'case-07-shenzhou-capacity-shift-pilot.md';
let source = readFileSync(file, 'utf8');
const block = `${markerStart}\n## 九、订单变化场景\n\n${content}\n${markerEnd}`;
const summary = content.replace(/ · \[下载订单场景说明 PDF\]\([^)]+\)/, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1：$2').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/^### /gm, '').replace(/^[-] /gm, '方案：');
const sourceHeading = '## 来源（详见 research.md）';
const blockPattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
if (!source.includes(sourceHeading)) throw new Error('找不到来源章节，未修改文档');
if (source.includes(markerStart) && source.indexOf(markerStart) < source.indexOf(sourceHeading)) {
  source = source.replace(blockPattern, block);
} else {
  source = source.replace(new RegExp(`\\n\\n---\\n\\n${markerStart}[\\s\\S]*?${markerEnd}\\s*$`), '\n');
  if (source.includes(markerStart)) throw new Error('场景区块位置异常，未修改文档');
  source = source.replace(sourceHeading, `${block}\n\n---\n\n${sourceHeading}`);
}
if (process.argv.includes('--check')) {
  if (source !== readFileSync(file, 'utf8')) { console.error('场景说明不同步'); process.exit(1); }
  if (summary !== readFileSync('scripts/scene-summary.txt', 'utf8')) { console.error('PDF 源内容不同步'); process.exit(1); }
  const hash = data => createHash('sha256').update(data).digest('hex');
  const manifest = JSON.parse(readFileSync('scripts/pdf-manifest.json', 'utf8'));
  const contentHash = hash(Buffer.concat([Buffer.from(summary), readFileSync('scripts/generate-pdf.py')]));
  if (manifest.contentHash !== contentHash || manifest.pdfHash !== hash(readFileSync('assets/case-07/order-change-scene-v2.pdf'))) {
    console.error('PDF 内容或模板已变化，请重新生成并检查 PDF'); process.exit(1);
  }
} else {
  writeFileSync(file, source);
  writeFileSync('scripts/scene-summary.txt', summary);
}
