# 申洲针织专项｜面料用量异常处理

> 基于公开资料与行业流程的模拟案例，订单、数据和岗位反馈均为构造示例。公开演示是预设的流程回放，不调用模型或企业系统。

[在线回放](https://fionahong-lab.github.io/ai-agent-delivery-casebook/shenzhou/material/) · [返回申洲专项](https://fionahong-lab.github.io/ai-agent-delivery-casebook/shenzhou/)

## 问题与触发

裁剪完成后，一笔单据按标准单耗计算应使用 1,050 米；领料 1,200 米，已退仓 70 米，账面净领用 1,130 米，比标准参考多 80 米。现场余料、补裁记录和实际幅宽散落在不同岗位的资料里。差额不是直接确认的损耗，不能据此推算实际成本。

## 处理过程

1. 按裁剪单和面料批次汇集仓库领退料、裁剪生产与工艺排料记录，用固定公式计算账面差异。
2. 整理资料中的待核对事项：余料是否已退仓、补裁用料范围、实际幅宽与标准的关系。
3. 创建仓库和裁剪组核对任务，在回放中接收模拟反馈。仓库反馈现场有 30 米尚未退仓；裁剪组反馈约 20 米补裁用料，但是否全部包含在原领料中仍待核实。
4. 将反馈作为新记录纳入调查，保留账面口径，整理尚缺资料并交给负责人。负责人记录决定，未完成事项继续跟进。

## 执行与决策边界

| 环节 | 负责方式 | 边界 |
| --- | --- | --- |
| 差异计算与记录关联 | 固定规则 | 现场未退仓余料不自动视作已退仓 |
| 资料理解与线索整理 | Agent 设计点 | 需要引用证据和保留不确定性；公开回放为预设内容 |
| 核对任务与岗位反馈 | 预设模拟 | 不发送通知，不连接真实岗位或系统 |
| 原因认定、单据调整与处理决定 | 人工 | 不由演示自动修改库存、标准或财务数据 |

## 验证与局限

公开回放覆盖任务创建、两项模拟反馈、更新调查与人工移交；页面刷新后记录清空。模型接入曾在本地测试，出现服务 503 及误将缺失信息判作冲突的问题，尚未稳定验证，因此没有作为公开体验能力。尚无真实企业试点、业务节省或损耗改善数据。

## 来源

- [Good Practices in the Global Apparel Industry](https://nitiforstates.gov.in/public-assets/Best_Practices/compendiums_all/Good%20Practices%20in%20the%20Global%20Apparel%20Industry.pdf)：排料、幅宽与余料管理。
- [Organizing the Cutting Room](https://asiagarmenthub.net/resources/2021/cr10-organizing-the-cutting-room-cutting-room-operations-pdfen.pdf)：补裁和面料利用率的不同衡量口径。
- [Fabric Reconciliation Procedure for Garment Factories](https://onlineclothingstudy.com/fabric-reconciliation-procedure-for/)：领料、余料、退仓与补裁的核对。
