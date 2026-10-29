# AI Agent Delivery Casebook

这是一个 AI Agent 交付案例库。

我从业务场景出发，拆解 **Workflow、Agent 与 Human** 各自负责什么，以及 AI 应用从流程设计到交付验证需要考虑的问题。

> 案例基于模拟业务场景，用于展示业务分析、方案设计和交付思考；文中的目标流程、规则和验证标准不等于已在真实业务中上线。

---

## Featured Practice｜AI 客服 Agent 交付实践

以电商退换货客服为场景，梳理业务流程，分析 Agent 与人工的边界，再围绕客服场景设计上线前的风险验证。

**[在线体验退换货客服 Agent ↗](https://returns-review-web.coze.site/returns-review-agent)**

在线版本是可体验原型。它与文档中的目标流程、Prompt 草稿和测试案例之间的具体对应关系，需要结合实际配置与测试结果确认。

---

## Method

每个案例关注四个核心问题：

1. 业务问题是什么？
2. 哪些环节适合 Workflow 自动执行？
3. 哪些情况需要 Agent 理解和综合信息？
4. 哪些决定必须保留 Human 介入？

目标不是追求最大化自动化，而是让流程的依据、责任和异常去向都能被看见，并为后续验证提供基础。

---

## Cases

这四份文档从不同角度展开同一类客服交付问题。Case 01a 关注完整业务流程，Case 01b 则深入分析其中关键节点的人机边界。

| Case | 内容 | 关注重点 |
| --- | --- | --- |
| [01a｜退换货业务流程](./case-01a-return-refund-workflow.md) | 从客户请求到处理结果 | Workflow 节点、输入输出与异常去向 |
| [01b｜退换货 Agent 边界](./case-01b-return-refund-agent-boundary.md) | 深入分析退货理由与风险判断 | Workflow / Agent / Human 分工、Prompt 草稿与验证 |
| [02｜从人工客服流程到 AI Agent](./case-02-customer-process-mapping.md) | 对照主管描述与模拟的一线流程 | 业务流程映射与潜在执行差异 |
| [03｜从 Demo 到可交付 Agent](./case-03-agent-evaluation-before-launch.md) | 分析客服场景中的上线前风险 | 承诺、争议、升级与验证标准 |

阅读时可以先看 **01a 的整体流程**，再看 **01b 的边界判断**；Case 02 和 Case 03 分别补充流程映射与风险验证的视角。
