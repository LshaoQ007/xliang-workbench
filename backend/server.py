#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小凉工作台 · 后端服务
────────────────────────────────────────────────────────
1) 定时（默认 07:30）抓取亚马逊美国站相关政策 / 新闻（Google News RSS）
2) 存入 data/news.json，并通过 API 喂给前端工作台
3) 支持推送到手机：Telegram / Bark / 推送加(pushplus) / 任意 GET Webhook

运行：
    ./venv/bin/python server.py
环境变量（可选，写入 config.env 后 source 或 systemd 注入）：
    PORT          监听端口（默认 8000）
    PUSH_HOUR     推送小时（默认 7）
    PUSH_MINUTE   推送分钟（默认 30）
    NEWS_QUERIES  逗号分隔的搜索词（默认见下）
    TG_TOKEN / TG_CHAT_ID        Telegram 推送
    PUSH_URL      通用 GET Webhook，支持 {title} {text} 占位符（Bark/推送加等）
    REFRESH_TOKEN 调用 /api/refresh 的令牌（不设则无需鉴权）
"""
import os
import json
import html
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

import requests
from flask import Flask, send_from_directory, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /workspace
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
NEWS_FILE = os.path.join(DATA_DIR, 'news.json')
os.makedirs(DATA_DIR, exist_ok=True)

app = Flask(__name__, static_folder=None)

# ───────── 配置 ─────────
TG_TOKEN = os.environ.get('TG_TOKEN', '')
TG_CHAT_ID = os.environ.get('TG_CHAT_ID', '')
PUSH_URL = os.environ.get('PUSH_URL', '')
REFRESH_TOKEN = os.environ.get('REFRESH_TOKEN', '')
PORT = int(os.environ.get('PORT', 8000))
PUSH_HOUR = int(os.environ.get('PUSH_HOUR', 7))
PUSH_MINUTE = int(os.environ.get('PUSH_MINUTE', 30))
QUERIES = os.environ.get(
    'NEWS_QUERIES',
    'Amazon seller policy,Amazon FBA update,Amazon sellers news,'
    'Amazon Seller Central,amazon.com marketplace'
).split(',')

RSS_TMPL = 'https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en'


# ───────── 抓取 ─────────
def fetch_news():
    items, seen = [], set()
    for q in [x.strip() for x in QUERIES if x.strip()]:
        try:
            url = RSS_TMPL.format(q=urllib.parse.quote(q))
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            data = urllib.request.urlopen(req, timeout=20).read()
            root = ET.fromstring(data)
            for it in root.findall('.//item'):
                title = (it.findtext('title') or '').strip()
                link = (it.findtext('link') or '').strip()
                pub = (it.findtext('pubDate') or '').strip()
                src = (it.findtext('source') or '').strip()
                if not link or link in seen:
                    continue
                seen.add(link)
                items.append({
                    'title': title, 'link': link,
                    'source': src, 'pubDate': pub, 'query': q
                })
        except Exception as e:
            print(f'[fetch] 查询失败 "{q}": {e}')
    items.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
    return items[:50]


def save_news(items):
    payload = {
        'updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'count': len(items), 'items': items
    }
    with open(NEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return payload


def load_news():
    try:
        with open(NEWS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'updated': None, 'count': 0, 'items': []}


# ───────── 推送 ─────────
def push_telegram(text):
    if not (TG_TOKEN and TG_CHAT_ID):
        return False
    try:
        requests.post(
            f'https://api.telegram.org/bot{TG_TOKEN}/sendMessage',
            data={'chat_id': TG_CHAT_ID, 'text': text,
                  'parse_mode': 'HTML', 'disable_web_page_preview': False},
            timeout=10
        )
        return True
    except Exception as e:
        print('[tg] 推送失败:', e)
        return False


def push_webhook(title, text):
    if not PUSH_URL:
        return False
    url = PUSH_URL.replace('{title}', urllib.parse.quote(title)) \
                  .replace('{text}', urllib.parse.quote(text))
    try:
        requests.get(url, timeout=10)
        return True
    except Exception as e:
        print('[webhook] 推送失败:', e)
        return False


def build_digest(items, n=10):
    today = datetime.now().strftime('%Y-%m-%d')
    lines = [f'📦 <b>亚马逊美国站 每日简报</b> ({today})', '']
    for i, it in enumerate(items[:n], 1):
        lines.append(f'{i}. <a href="{html.escape(it["link"])}">{html.escape(it["title"])}</a>')
        lines.append(f'   <i>来源：{html.escape(it.get("source", "") or "—")} · {html.escape(it.get("pubDate", ""))}</i>')
    plain = '\n'.join(lines)
    # Telegram 用 HTML；Webhook 用纯文本
    return plain, plain


def push_all(items):
    if not items:
        return
    html_digest, plain = build_digest(items)
    push_telegram(html_digest)
    title = '亚马逊每日简报 ' + datetime.now().strftime('%Y-%m-%d')
    push_webhook(title, plain)


# ───────── 定时任务 ─────────
def job():
    print(f'[{datetime.now():%H:%M:%S}] 开始抓取亚马逊新闻…')
    items = fetch_news()
    if items:
        save_news(items)
        push_all(items)
        print(f'[{datetime.now():%H:%M:%S}] 完成，获取 {len(items)} 条，已推送')
    else:
        print(f'[{datetime.now():%H:%M:%S}] 未获取到内容')


# ───────── 路由 ─────────
SW_HEADERS = {'Service-Worker-Allowed': '/'}

@app.route('/')
@app.route('/<path:p>')
def serve(p=''):
    if not p:
        p = 'index.html'
    full = os.path.normpath(os.path.join(BASE_DIR, p))
    if not full.startswith(BASE_DIR):
        return 'forbidden', 403
    if os.path.isfile(full):
        resp = send_from_directory(BASE_DIR, p)
        # Service Worker 文件必须带 Service-Worker-Allowed 头才能注册
        if p == 'sw.js':
            resp.headers.update(SW_HEADERS)
        # manifest 也需要正确 Content-Type
        if p.endswith('.webmanifest'):
            resp.headers['Content-Type'] = 'application/manifest+json'
        return resp
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/api/news')
def api_news():
    return jsonify(load_news())


@app.route('/api/refresh')
def api_refresh():
    if REFRESH_TOKEN and request.args.get('token') != REFRESH_TOKEN:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 403
    items = fetch_news()
    payload = save_news(items) if items else load_news()
    return jsonify({'ok': True, 'count': payload.get('count', 0),
                    'updated': payload.get('updated')})


# ───────── 启动 ─────────
sched = BackgroundScheduler()
sched.add_job(job, 'cron', hour=PUSH_HOUR, minute=PUSH_MINUTE, id='daily_news')
sched.start()
print(f'[init] 定时任务已注册：每天 {PUSH_HOUR:02d}:{PUSH_MINUTE:02d} 抓取并推送')

if not os.path.exists(NEWS_FILE):
    try:
        job()
    except Exception as e:
        print('[init] 首次抓取失败（可稍后访问 /api/refresh）：', e)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)
