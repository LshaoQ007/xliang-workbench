# 每日内容自动生成目录

本目录由 GitHub Actions 工作流 `.github/workflows/daily-content.yml` 在每天北京时间 06:00 自动生成并推回仓库。

## 工作原理
- `backend/generate_daily.py` 调用大模型（OpenAI 兼容接口），为每个板块生成当天的新鲜内容，写入本目录下的 `<模块>.json`，并生成 `manifest.json`。
- 前端 `app.js` 的 `loadDaily()` 加载 `manifest.json`，用每日内容替换各板块的"示例内容"，并显示「📅 今日更新 YYYY-MM-DD」徽标。

## 启用真实生成（需提供可用 LLM Key）
在本仓库 **Settings → Secrets and variables → Actions** 中新增以下三个仓库级 Secret：
- `LLM_API_KEY`：你的 API Key
- `LLM_BASE_URL`：接口地址，例如 `https://api.openai.com/v1` 或兼容服务地址（末尾不带 `/v1`）
- `LLM_MODEL`：模型名，例如 `gpt-4o-mini`

> 未配置 Key 时，脚本会跳过生成（本目录为空），前端自动回退到内置 `seed.js` 的示例内容，并显示「示例内容 · 配置 Key 后每日更新」提示，功能不受影响。

## 手动触发
仓库 Actions 页面 → 选择「每日生成各板块内容」→ Run workflow，可立即验证 Key 是否可用。
