# AI Agent Delivery Casebook

AI 交付经理的主作品：同一条退换货主线，从流程拆到人机边界、上线风险、灰度回滚和价值。

> 客服案例基于模拟业务场景。文中的目标流程、规则、验收门槛和金额均为假设或练习，不等于已在真实业务中上线或通过测试。模型成本估算工具记录的是可运行原型的需求与迭代。销售线索案例记录可体验原型上已核对的交互、七段输出和人机边界，同样不是真实上线记录。

---

## 主作品｜端到端交付证据

**[Case 06｜退换货客服 Agent 端到端交付](./case-06-return-refund-e2e-delivery.md)**

要证明的不是 Demo 能跑，而是标准单可分流、例外必人审、上线可验收、出问题可回滚，并且账算得清。

支撑章节（同一主线）：[01a 流程](./case-01a-return-refund-workflow.md) → [01b 边界](./case-01b-return-refund-agent-boundary.md) → [02 一线映射](./case-02-customer-process-mapping.md) → [03 上线风险](./case-03-agent-evaluation-before-launch.md)

**面试/招聘请先读 Case 06，再按需下钻 01b / 03。**

原型演示能力；完整验收与灰度见 Case 06：[在线体验退换货客服 Agent ↗](https://returns-review-web.coze.site/returns-review-agent)

---

## Cases

### 退换货主线

| Case | 内容 | 关注重点 |
| --- | --- | --- |
| [06｜端到端交付](./case-06-return-refund-e2e-delivery.md) · **主作品** | 把验收、灰度、回滚和价值收成一份证据 | 做与不做、L1–L4、DoD、G0–G3、假设价值 |
| [01a｜退换货业务流程](./case-01a-return-refund-workflow.md) | 从客户请求到处理结果 | Workflow 节点、输入输出与异常去向 |
| [01b｜退换货 Agent 边界](./case-01b-return-refund-agent-boundary.md) | 退货缘由判断的人机边界；商品核验为进行中 | Workflow / Agent / Human、Prompt 与验证 |
| [02｜从人工客服流程到 AI Agent](./case-02-customer-process-mapping.md) | 对照主管描述与模拟的一线流程 | 业务流程映射与潜在执行差异 |
| [03｜从 Demo 到可交付 Agent](./case-03-agent-evaluation-before-launch.md) | 上线前会不会捅娄子 | 承诺、争议、升级与风险验收 |

### 工具实践

| Case | 内容 | 关注重点 |
| --- | --- | --- |
| [04｜AI 模型选型与成本估算工具](./case-04-ai-model-cost-estimator.md) · [在线体验](https://ai-model-cost.coze.site/) | 用明确假设比较文本 API 推理成本 | 确定性计算、价格维护、估算边界与测试案例 |

### 业务场景实践｜销售线索

第二份业务场景练习，不是面试入口。主作品与招聘阅读顺序仍是 Case 06。

| Case | 内容 | 关注重点 |
| --- | --- | --- |
| [05｜销售线索 Agent 交付](./case-05-sales-lead-analysis.md) · [在线体验](https://sales-lead-web.coze.site) | 把咨询或沟通记录整理成可复核的线索 | 七段输出、冲突只标记、话术草稿、人工决定是否跟进 |

---

## 方法

每篇案例都回到四个问题：

1. 业务问题是什么？
2. 哪些环节适合 Workflow 自动执行？
3. 哪些情况需要 Agent 理解和综合信息？
4. 哪些决定必须保留 Human 介入？

目标不是把自动化做满，而是让依据、责任和异常去向都看得见，并能被验收。
