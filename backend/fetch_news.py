#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
纯抓取脚本（供 GitHub Actions 定时运行，无 Flask / APScheduler 依赖）
把抓到的亚马逊新闻写到 backend/data/news.json
"""
import os
import json
import html
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
NEWS_FILE = os.path.join(DATA_DIR, 'news.json')
os.makedirs(DATA_DIR, exist_ok=True)

QUERIES = os.environ.get(
    'NEWS_QUERIES',
    'Amazon seller policy,Amazon FBA update,Amazon sellers news,'
    'Amazon Seller Central,amazon.com marketplace'
).split(',')

RSS_TMPL = 'https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en'


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


def main():
    print(f'[{datetime.now():%H:%M:%S}] 开始抓取…')
    items = fetch_news()
    payload = {
        'updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'count': len(items), 'items': items
    }
    with open(NEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f'[{datetime.now():%H:%M:%S}] 完成，写入 {len(items)} 条 → {NEWS_FILE}')


if __name__ == '__main__':
    main()
