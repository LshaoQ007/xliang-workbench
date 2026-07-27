# 小凉工作台 · 后端（自动抓取 + 定时推送）

## 它能做什么
- 每天 **07:30**（可配）自动抓取 **亚马逊美国站** 相关政策 / 新闻（Google News RSS，美国版）
- 结果存入 `data/news.json`，并通过 `GET /api/news` 喂给前端工作台
- 同时通过 **Telegram / Bark / 推送加 / 任意 GET Webhook** 推送摘要到你的手机

## 快速开始
```bash
cd /workspace/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cp config.env.example config.env   # 填入推送配置（可选）
set -a && source config.env && set +a

./venv/bin/python server.py
```
打开 `http://<host>:8000/` 即工作台；`/api/news` 返回最新简报。

## 手动刷新
- 浏览器访问 `/api/refresh`（若设了 `REFRESH_TOKEN` 则加 `?token=xxx`）立即抓取一次。

## 推送到手机（任选）
| 方式 | 配置 |
|------|------|
| Telegram | `TG_TOKEN` + `TG_CHAT_ID` |
| Bark(iOS) | `PUSH_URL=https://api.day.app/<KEY>/xiaoliang/{title}/{text}` |
| 推送加(微信) | `PUSH_URL=http://www.pushplus.plus/send?token=<TOKEN>&title={title}&content={text}` |

> 没配推送也能用：新闻照常抓取并在打开 App 时显示，只是不会主动弹通知。

## 部署到公网（长期可用）
把 `/workspace` 整目录部署到任意支持 Python 的服务器（或 Railway / Render / 阿里云函数等），
用 `gunicorn -w 1 server:app` 起服务即可。前端 PWA 与后端同源，天然可"安装到主屏"。

## 进阶
- 想要**中文摘要 / 政策要点提炼**：在 `fetch_news()` 后接一个大模型（OpenAI / 通义 / 文心），
  把原文标题+链接送进去生成 1-2 句中文简报。代码已预留 `build_digest` 可扩展。
- 想要**领星 ERP 自动登录抓销量**（原需求 B）：需用 Playwright 持登录态操作浏览器，
  涉及账号安全，建议单独评估，不写入前端。
