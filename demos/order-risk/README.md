# 订单变更与交期风险

静态页面，只在浏览器里算。示例日固定为 2026-11-20。

本地查看：在仓库根目录执行 `python3 -m http.server`，打开 `/demos/order-risk/`。不要用 `file://`，模块脚本需要 HTTP。

测试：在仓库根目录执行 `node --test demos/order-risk/tests/*.test.js`；场景及 PDF 同步检查：`node scripts/generate-scene.mjs --check`；本地单文件预览同步检查：`node scripts/build-preview.mjs --check`。

在线体验：`https://fionahong-lab.github.io/ai-agent-delivery-casebook/`。GitHub Actions 在测试通过后将本目录中的静态页面发布到 GitHub Pages；体验页只在浏览器本地计算，不连接企业系统。订单和数量均为虚构示例。PDF 生成脚本当前依赖 macOS 中文字体和 reportlab，重新生成后须重新检查。
