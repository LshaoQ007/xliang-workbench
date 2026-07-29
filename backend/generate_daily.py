#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每日内容生成引擎（在 GitHub Actions 中每日运行）。

仅当配置了 LLM_API_KEY 时才真正调用大模型生成；否则直接跳过（前端回退到 seed 示例内容）。
为「小凉工作台」的每个板块生成当日新鲜、可操作的精选内容，写入 backend/data/daily/<module>.json。

用法（GitHub Actions 中）：
    LLM_API_KEY=xxx LLM_BASE_URL=https://... LLM_MODEL=xxx python backend/generate_daily.py
"""
import os
import json
import datetime

try:
    import requests
except ImportError:
    requests = None

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
DAILY_DIR = os.path.join(DATA_DIR, 'daily')
os.makedirs(DAILY_DIR, exist_ok=True)

TODAY = datetime.date.today().strftime('%Y-%m-%d')

# 通用系统提示
SYS = (
    "你是为「小凉工作台」这个中文个人成长 / 运营 / 生活类 PWA 产出每日精选内容的中文助手。"
    "内容要实用、可操作、正向、适合中国大陆用户。每项都要原创、具体、不空洞。"
    "只输出要求的 JSON，不要任何解释文字。"
)

# 每个板块的生成配置
# key: 输出文件名(也是前端 dailyItems 的模块名)
# prompt: 用户提示（含 JSON schema 说明）
# count: 生成条数
MODULES = [
    dict(key='amazon_interview', count=6, prompt=(
        "生成 6 条「亚马逊运营面试」常见考题与回答思路，面向美国站运营岗。"
        "JSON 数组，元素: {\"tag\":\"类别\",\"title\":\"Q：具体面试题\",\"body\":\"A：要点式回答，含数据/案例\"}。")),
    dict(key='amazon_tips', count=6, prompt=(
        "生成 6 条「亚马逊美国站运营实战技巧」（选品/广告/转化/物流/合规/品牌）。"
        "JSON 数组，元素: {\"tag\":\"类别\",\"title\":\"技巧名\",\"body\":\"具体做法与注意点\"}。")),
    dict(key='amazon_tools', count=6, prompt=(
        "生成 6 条「亚马逊常用工具使用技巧」，覆盖领星ERP、卖家精灵、SIF。"
        "JSON 数组，元素: {\"tag\":\"工具·场景\",\"title\":\"技巧名\",\"body\":\"操作步骤与判断标准\"}。")),
    dict(key='photo', count=8, prompt=(
        "生成 8 条「摄影修图」当日精选：覆盖不同场景的拍照姿势、修图参数、视频剪辑思路，"
        "以及醒图 / 美图秀秀 的修图模板推荐。"
        "JSON 数组，元素: {\"tag\":\"主题·场景\",\"title\":\"标题\",\"body\":\"可操作的具体参数/步骤\"}。")),
    dict(key='skincare', count=8, prompt=(
        "生成 8 条「护肤化妆」当日精选：混干皮护肤、圆脸化妆、妆容分享视频、发型编发、"
        "小个子穿搭思路、抖音美妆博主推荐、小红书小个子博主推荐、小红书微胖穿搭博主推荐。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题\",\"body\":\"具体建议，博主用「B站/抖音搜索：关键词」给出\"}。")),
    dict(key='music', count=3, prompt=(
        "推荐 3 首适合放松/治愈/提升的歌曲（含华语与英文）。"
        "JSON 数组，元素: {\"song\":\"歌名\",\"artist\":\"歌手\",\"lyric\":\"一句戳心歌词\","
        "\"comments\":[\"10 条仿网易云风格的热评，每条一句\"]}。")),
    dict(key='finance', count=8, prompt=(
        "生成 8 条「理财认知」当日精选，覆盖基金理财、经济规律、做生意思路三类。"
        "JSON 数组，元素: {\"tag\":\"基金/经济规律/生意\",\"title\":\"标题\",\"body\":\"通俗有洞见的解释\"}。")),
    dict(key='law', count=6, prompt=(
        "生成 6 条「民法典常识」当日精选（合同、婚姻、继承、侵权、租房、消费者权益等），结合案例。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"常识点\",\"body\":\"要点+案例提醒\"}。")),
    dict(key='books', count=5, prompt=(
        "推荐 5 本值得读的书（成长/商业/思维/文学均可）。"
        "JSON 数组，元素: {\"title\":\"书名\",\"author\":\"作者\",\"note\":\"一句话为什么值得读\"}。")),
    dict(key='quotes', count=6, prompt=(
        "生成 6 条「值得记录的句子」（治愈/励志/通透/人间清醒）。"
        "JSON 数组，元素: {\"text\":\"一句话\"}。")),
    dict(key='career', count=8, prompt=(
        "生成 8 条「职场成长」当日精选：修炼情商、识人避坑、提高眼界认知、口才训练、闲谈知识储备。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题\",\"body\":\"可练习的具体方法\"}。")),
    dict(key='film', count=5, prompt=(
        "推荐 5 部值得看的电影/综艺/纪录片（附一句话看点）。"
        "JSON 数组，元素: {\"title\":\"片名\",\"note\":\"一句话看点\"}。")),
    dict(key='english', count=6, prompt=(
        "生成 6 条「英语学习」当日精选：专八词汇、口语跟读、影视句段。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题/词\",\"body\":\"释义与用法\"}。")),
    dict(key='korean', count=6, prompt=(
        "生成 6 条「韩语学习（零基础→进阶）」当日精选：发音、单词、实用句型、韩剧地道表达。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题\",\"body\":\"讲解与例句\"}。")),
    dict(key='japanese', count=6, prompt=(
        "生成 6 条「日语学习（零基础→进阶）」当日精选：假名、单词、语法、敬语。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题\",\"body\":\"讲解与例句\"}。")),
    dict(key='cognition', count=8, prompt=(
        "生成 8 条「认知提升」当日精选：时事政策、经济行情、前沿新技术、民法典常识、上下级相处、"
        "修炼情商、识人避坑、提升眼界认知。"
        "JSON 数组，元素: {\"tag\":\"分类\",\"title\":\"标题\",\"body\":\"洞见+可行动建议\"}。")),
    dict(key='speech', count=6, prompt=(
        "推荐 6 个高分演讲 / 语言类节目 / 脱口秀（TED、名人演讲、辩论、访谈、脱口秀等），适合练语感与表达。"
        "JSON 数组，元素: {\"tag\":\"类型\",\"title\":\"节目/演讲名\",\"body\":\"推荐理由+看点，并给「B站搜索：关键词」\"}。")),
    dict(key='douyin', count=6, prompt=(
        "整理 6 条今日抖音热点/选题方向（蹭热点、找选题、攒素材）。"
        "JSON 数组，元素: {\"text\":\"热点/选题\",\"body\":\"为什么火、怎么用\"}。")),
    dict(key='xhs', count=6, prompt=(
        "整理 6 条今日小红书趋势（穿搭/护肤/旅行/摄影/美食灵感）。"
        "JSON 数组，元素: {\"text\":\"趋势主题\",\"body\":\"内容方向\"}。")),
    dict(key='positive', count=5, prompt=(
        "推荐 5 个正能量视频 / UP 主 / 账号（治愈、成长、励志）。"
        "JSON 数组，元素: {\"text\":\"推荐\",\"body\":\"一句话理由\"}。")),
    dict(key='national', count=6, prompt=(
        "整理 6 条今日国家大事 / 民生政策要点。"
        "JSON 数组，元素: {\"text\":\"政策/事件\",\"body\":\"要点与影响\"}。")),
    dict(key='aitips', count=6, prompt=(
        "生成 6 条「AI 使用技巧」：把大模型用得更顺手的提示词 / 工作流 / 工具。"
        "JSON 数组，元素: {\"text\":\"技巧名\",\"body\":\"具体做法\"}。")),
    dict(key='werewolf', count=6, prompt=(
        "生成 6 条「狼人杀玩法技巧」：发言框架、身份打法、归票逻辑。"
        "JSON 数组，元素: {\"text\":\"技巧点\",\"body\":\"具体思路\"}。")),
    dict(key='home', count=5, prompt=(
        "生成 5 条「家居收纳技巧」：小空间变好用的具体方法。"
        "JSON 数组，元素: {\"text\":\"技巧名\",\"body\":\"做法\"}。")),
    dict(key='sing', count=5, prompt=(
        "生成 5 条「零基础学唱歌」技巧：呼吸、音准、发声、情感。"
        "JSON 数组，元素: {\"text\":\"技巧点\",\"body\":\"练习方法\"}。")),
    dict(key='dance', count=5, prompt=(
        "生成 5 条「零基础学跳舞」技巧：基本功、跟舞、录舞。"
        "JSON 数组，元素: {\"text\":\"技巧点\",\"body\":\"练习方法\"}。")),
]


def extract_json(text):
    """从模型回复里稳健地取出 JSON（兼容纯 JSON / ```json 代码块 / 夹杂文字）。"""
    if not text:
        return None
    t = text.strip()
    # 去掉 ```json ... ``` 代码块包裹
    if t.startswith('```'):
        t = t.split('\n', 1)[-1] if '\n' in t else t
        if t.endswith('```'):
            t = t[:-3]
        t = t.strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    # 截取第一个 { 到最后一个 }
    s, e = t.find('{'), t.rfind('}')
    if s != -1 and e != -1 and e > s:
        try:
            return json.loads(t[s:e + 1])
        except Exception:
            pass
    # 或截取第一个 [ 到最后一个 ]
    s, e = t.find('['), t.rfind(']')
    if s != -1 and e != -1 and e > s:
        try:
            return json.loads(t[s:e + 1])
        except Exception:
            pass
    return None


def call_llm(system, user, model):
    """调用 OpenAI 兼容接口，返回解析后的 JSON（通常是 {'items': [...]} 或 [...]）。

    注意：Kimi(Moonshot) K2/K3 等模型不支持 response_format=json_object，会返回 400，
    因此这里不发送该参数，改为靠提示词 + 稳健解析来拿到 JSON。
    """
    if requests is None:
        return None
    api_key = os.environ.get('LLM_API_KEY')
    base = os.environ.get('LLM_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    prompt = (
        system + "\n\n" + user +
        "\n\n请只返回一个 JSON 对象，结构为 {\"items\": [ ... ]}，其中 items 是要求的数组。"
        "不要输出 ``` 代码块，不要任何说明文字，直接输出纯 JSON。"
    )
    try:
        r = requests.post(
            base + '/chat/completions',
            headers={'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json'},
            json={'model': model, 'messages': [{'role': 'user', 'content': prompt}], 'temperature': 1},
            timeout=300,
        )
        r.raise_for_status()
        content = r.json()['choices'][0]['message']['content']
    except Exception as e:
        print('[llm] 请求失败:', e)
        return None
    data = extract_json(content)
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get('items')
    else:
        items = None
    if not isinstance(items, list):
        items = []
    print('[llm] %s -> %d items' % (model, len(items)))
    return items


def main():
    api_key = os.environ.get('LLM_API_KEY')
    if not api_key:
        print('[skip] 未配置 LLM_API_KEY，跳过每日生成（前端将使用 seed 示例内容）。')
        return
    model = os.environ.get('LLM_MODEL', 'gpt-4o-mini')
    print('[%s] 开始每日生成（model=%s）' % (datetime.datetime.now().strftime('%H:%M:%S'), model))
    manifest = {'generated_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
                'date': TODAY, 'modules': []}
    for m in MODULES:
        items = call_llm(SYS, m['prompt'], model)
        if not items:
            continue
        items = items[: m['count']]
        out = {'date': TODAY, 'items': items}
        path = os.path.join(DAILY_DIR, m['key'] + '.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        manifest['modules'].append({'key': m['key'], 'date': TODAY, 'count': len(items)})
        print('[ok] %s -> %d items' % (m['key'], len(items)))
    with open(os.path.join(DAILY_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('[%s] 完成，共生成 %d 个板块' % (datetime.datetime.now().strftime('%H:%M:%S'), len(manifest['modules'])))


if __name__ == '__main__':
    main()
