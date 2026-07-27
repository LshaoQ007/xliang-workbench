#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Daily Amazon news fetcher (runs in GitHub Actions, no Flask needed).
Fetches Amazon seller news via Google News RSS and writes backend/data/news.json.
Optional: set LLM_API_KEY to auto-generate Chinese summaries (summary field).
"""
import os
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

try:
    import requests
except ImportError:
    requests = None

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
NEWS_FILE = os.path.join(DATA_DIR, 'news.json')
os.makedirs(DATA_DIR, exist_ok=True)
NEWS_AI_FILE = os.path.join(DATA_DIR, 'news_ai.json')

AI_QUERIES = os.environ.get(
    'AI_NEWS_QUERIES',
    'OpenAI,Anthropic Claude,Google DeepMind,Gemini AI,'
    'LLM release,AI model update,Midjourney,AI agent platform,'
    'DeepSeek,Qwen Alibaba,AI video generation'
).split(',')

def write_payload(path, items):
    payload = {'updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
               'count': len(items), 'items': items}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

QUERIES = os.environ.get(
    'NEWS_QUERIES',
    'Amazon seller policy,Amazon FBA update,Amazon sellers news,'
    'Amazon Seller Central,amazon.com marketplace'
).split(',')

RSS_TMPL = 'https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en'


def fetch_news(queries=None):
    if queries is None:
        queries = QUERIES
    items, seen = [], set()
    for q in [x.strip() for x in queries if x.strip()]:
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
            print('[fetch] failed query "%s": %s' % (q, e))
    items.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
    return items[:50]


def fetch_ai_news():
    """Fetch AI-platform news via Google News RSS (no LLM needed)."""
    return fetch_news(AI_QUERIES)


def load_old_summaries():
    """Load previous news.json and keep existing Chinese summaries keyed by link or title."""
    try:
        d = json.load(open(NEWS_FILE, encoding='utf-8'))
        m = {}
        for it in d.get('items', []):
            if it.get('summary'):
                if it.get('link'):
                    m[it['link']] = it['summary']
                if it.get('title'):
                    m[it['title']] = it['summary']
        return m
    except Exception:
        return {}


def summarize_with_llm(items):
    """Call an OpenAI-compatible API to batch-generate Chinese summaries. Returns {link: summary}."""
    api_key = os.environ.get('LLM_API_KEY')
    if not api_key:
        return None
    base = os.environ.get('LLM_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    model = os.environ.get('LLM_MODEL', 'gpt-4o-mini')
    uniq = {}
    for it in items:
        uniq.setdefault(it['title'], it['link'])
    prompt = (
        "You are an Amazon seller operations assistant. For each English news title below, "
        "translate it to concise Chinese and write ONE sentence (20-40 chars) summarizing the "
        "key point and its impact on sellers. Return ONLY a JSON array where each element is "
        "{\"title\": original_title, \"summary\": chinese_summary}. No other text.\n"
        + json.dumps([t for t in uniq.keys()], ensure_ascii=False)
    )
    try:
        if requests is None:
            return None
        r = requests.post(
            base + '/chat/completions',
            headers={'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json'},
            json={'model': model, 'messages': [{'role': 'user', 'content': prompt}],
                  'response_format': {'type': 'json_object'}, 'temperature': 0.3},
            timeout=60
        )
        content = r.json()['choices'][0]['message']['content']
        data = json.loads(content)
        arr = data if isinstance(data, list) else data.get('summaries') or data.get('results') or []
        out = {}
        for e in arr:
            t = e.get('title')
            s = e.get('summary')
            if t and s and t in uniq:
                out[uniq[t]] = s
        print('[llm] generated %d summaries (model %s)' % (len(out), model))
        return out
    except Exception as e:
        print('[llm] summary failed, keep old summaries:', e)
        return None


def main():
    print('[%s] start fetching' % datetime.now().strftime('%H:%M:%S'))
    # 若未配置 LLM key，且已有带中文摘要的数据，则保留，不覆盖（避免每日被冲掉）
    # AI 快讯：独立文件，无需 LLM，每日刷新（放在 Amazon 守卫之前，确保始终更新）
    try:
        ai_items = fetch_ai_news()
        write_payload(NEWS_AI_FILE, ai_items)
        print('[ai] wrote %d AI items -> %s' % (len(ai_items), NEWS_AI_FILE))
    except Exception as e:
        print('[ai] fetch failed:', e)
    # Amazon 新闻：未配置 LLM 且有旧摘要则保留，不覆盖
    old = load_old_summaries()
    if not os.environ.get('LLM_API_KEY') and old:
        print('[skip] no LLM_API_KEY and summaries exist, keep existing news.json')
        return
    items = fetch_news()
    summaries = summarize_with_llm(items)
    for it in items:
        if summaries and it['link'] in summaries:
            it['summary'] = summaries[it['link']]
        elif it['link'] in old and old[it['link']]:
            it['summary'] = old[it['link']]
        elif it['title'] in old and old[it['title']]:
            it['summary'] = old[it['title']]
    write_payload(NEWS_FILE, items)
    print('[%s] done, wrote %d items -> %s' % (datetime.now().strftime('%H:%M:%S'), len(items), NEWS_FILE))


if __name__ == '__main__':
    main()
