# 订单变更与交期风险

静态页面，只在浏览器里算。示例日固定为 2026-11-20。

本地查看：在仓库根目录执行 `python3 -m http.server`，打开 `/demos/order-risk/`。不要用 `file://`，模块脚本需要 HTTP。

测试：`node --test demos/order-risk/tests/smoke.test.js`

GitHub Pages 目前没有开通。工作流只上传本目录的页面文件。合并后需要在仓库 Settings → Pages 把 Source 选成 GitHub Actions，再重跑 “Publish order-risk demo”。预期地址是 `https://fionahong-lab.github.io/ai-agent-delivery-casebook/`。在那之前它不是线上页面。
