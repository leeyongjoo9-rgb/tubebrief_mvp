"""기말과제 발표자료 .pptx 생성 — 중간발표 디자인 시스템 적용본.

디자인 핵심:
- 색상: 틸/민트 팔레트 (#103338, #028090, #02C39A, #DDEBE9)
- 헤더: 영문 카테고리 라벨 (12.5pt) + 한국어 큰 부제 (32~38pt)
- 카드: 흰 배경 + 외곽선 없음 + 좌상단 작은 틸 정사각형 아이콘
- 좌우/상하 분할 미니멀 레이아웃
- 슬라이드 번호: 우하단 (12.4, 7.0)
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree


OUTPUT = Path("이용주-기말발표자료.pptx")

# 16:9
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

# ── 중간발표 추출 팔레트 ──────────────────────────────
DARK_TEAL = RGBColor(0x10, 0x33, 0x38)      # 진한 배경
TEAL = RGBColor(0x02, 0x80, 0x90)            # 강조 액센트
MINT = RGBColor(0x02, 0xC3, 0x9A)            # 보조 액센트
TERRACOTTA = RGBColor(0xC9, 0x60, 0x3F)      # 포인트
TEXT_DARK = RGBColor(0x14, 0x25, 0x2A)       # 본문
TEXT_GRAY = RGBColor(0x5A, 0x73, 0x78)       # 보조 텍스트
TEXT_LIGHT_GRAY = RGBColor(0xB8, 0xCF, 0xCC)
BG_LIGHT = RGBColor(0xF3, 0xF8, 0xF7)        # 옅은 배경
BG_MINT = RGBColor(0xDD, 0xEB, 0xE9)         # 헤더 옅은 민트
WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def set_run_font(run, size=14, bold=False, color=None, name="맑은 고딕"):
    run.font.name = name
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn("a:ea"))
    if ea is None:
        ea = etree.SubElement(rPr, qn("a:ea"))
    ea.set("typeface", name)
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = color


def add_text(slide, x, y, w, h, text, size=14, bold=False, color=None,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, line_spacing=None):
    tx = slide.shapes.add_textbox(x, y, w, h)
    tf = tx.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor
    items = text if isinstance(text, list) else [text]
    for i, line in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if line_spacing:
            p.line_spacing = line_spacing
        r = p.add_run()
        r.text = line
        set_run_font(r, size=size, bold=bold, color=color)
    return tx


def add_rect(slide, x, y, w, h, fill=None, line=None, line_width=0):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.shadow.inherit = False
    if fill is not None:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(line_width or 0.5)
    return shape


def add_slide_header(slide, eng, kor, slide_num, kor_size=32):
    """공통 헤더 — 좌상단 영문 카테고리 + 큰 한국어 부제 + 우하단 번호."""
    add_text(slide, Inches(0.7), Inches(0.55), Inches(8), Inches(0.35),
             eng, size=12.5, bold=True, color=TEAL)
    add_text(slide, Inches(0.7), Inches(0.92), Inches(11.9), Inches(0.8),
             kor, size=kor_size, bold=True, color=TEXT_DARK)
    # 슬라이드 번호 (우하단)
    add_text(slide, Inches(12.4), Inches(7.0), Inches(0.5), Inches(0.3),
             str(slide_num), size=10, color=TEXT_GRAY, align=PP_ALIGN.RIGHT)


def add_icon_card(slide, x, y, w, h, title, body, icon_color=None):
    """흰 배경 카드 + 좌상단 작은 틸 정사각형 아이콘 + 제목 + 본문."""
    icon_color = icon_color or TEAL
    # 카드 흰 배경 (외곽선 없음)
    add_rect(slide, Inches(x), Inches(y), Inches(w), Inches(h), fill=WHITE)
    # 작은 아이콘 정사각형
    add_rect(slide, Inches(x + 0.3), Inches(y + 0.3), Inches(0.62), Inches(0.62),
             fill=icon_color)
    # 카드 제목 (아이콘 옆)
    add_text(slide, Inches(x + 1.08), Inches(y + 0.32), Inches(w - 1.3),
             Inches(0.55), title, size=15, bold=True, color=TEXT_DARK,
             anchor=MSO_ANCHOR.MIDDLE)
    # 본문
    body_items = body if isinstance(body, list) else [body]
    add_text(slide, Inches(x + 0.3), Inches(y + 1.0), Inches(w - 0.6),
             Inches(h - 1.1), body_items, size=12, color=TEXT_GRAY,
             line_spacing=1.35)


def add_flow_step(slide, x, y, w, h, title, sub=""):
    """틸 배경 단계 박스 (사용자 흐름용)."""
    add_rect(slide, Inches(x), Inches(y), Inches(w), Inches(h), fill=TEAL)
    add_text(slide, Inches(x), Inches(y + 0.2), Inches(w), Inches(0.45),
             title, size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
             anchor=MSO_ANCHOR.MIDDLE)
    if sub:
        add_text(slide, Inches(x), Inches(y + 0.65), Inches(w), Inches(h - 0.7),
                 sub, size=10, color=BG_MINT, align=PP_ALIGN.CENTER,
                 anchor=MSO_ANCHOR.TOP, line_spacing=1.25)


def add_arrow(slide, x, y):
    """단계 사이 화살표 (작은 ▶)."""
    arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW,
                                  Inches(x), Inches(y), Inches(0.35), Inches(0.42))
    arr.fill.solid()
    arr.fill.fore_color.rgb = TEAL
    arr.line.fill.background()
    arr.shadow.inherit = False


def add_row_card(slide, x, y, w, h, label, content, icon_color=None):
    """기술 스택 / 표 행 카드 — 흰 배경 + 좌측 작은 아이콘 + 카테고리 + 내용."""
    icon_color = icon_color or BG_LIGHT
    add_rect(slide, Inches(x), Inches(y), Inches(w), Inches(h), fill=WHITE)
    add_rect(slide, Inches(x + 0.25), Inches(y + 0.16), Inches(0.46), Inches(0.46),
             fill=icon_color)
    # 작은 점 (악센트)
    add_rect(slide, Inches(x + 0.36), Inches(y + 0.27), Inches(0.24), Inches(0.24),
             fill=TEAL)
    # 라벨
    add_text(slide, Inches(x + 0.95), Inches(y), Inches(3.2), Inches(h),
             label, size=13, bold=True, color=TEXT_DARK,
             anchor=MSO_ANCHOR.MIDDLE)
    # 내용
    add_text(slide, Inches(x + 4.2), Inches(y), Inches(w - 4.4), Inches(h),
             content, size=12, color=TEXT_GRAY,
             anchor=MSO_ANCHOR.MIDDLE, line_spacing=1.25)


def add_hyperlink_text(slide, x, y, w, h, text, url, size=14,
                        color=None, bold=False, align=PP_ALIGN.LEFT):
    color = color or TEAL
    tx = slide.shapes.add_textbox(x, y, w, h)
    tf = tx.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    set_run_font(r, size=size, bold=bold, color=color)
    r.font.underline = True
    r.hyperlink.address = url
    return tx


def make_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    # 기본 폰트
    style = prs.slide_master.element
    # 기본 ko 폰트 보강은 셋 안 함 (개별 run 에서 처리)

    # ────────────────────────────────────────────
    # Slide 1 — 표지
    # ────────────────────────────────────────────
    s = make_slide(prs)
    # 우측 거대 다크 틸 도형 (오프스크린 일부)
    add_rect(s, Inches(9.4), Inches(-1.6), Inches(6.2), Inches(6.2), fill=DARK_TEAL)
    # 우측 작은 틸 도형 (앞)
    add_rect(s, Inches(10.7), Inches(3.2), Inches(4.4), Inches(4.4), fill=TEAL)
    # 좌상단 테라코타 액센트 + 흰 점
    add_rect(s, Inches(0.75), Inches(1.5), Inches(0.95), Inches(0.95), fill=TERRACOTTA)
    add_rect(s, Inches(0.95), Inches(1.7), Inches(0.55), Inches(0.55), fill=WHITE)

    # 큰 제목
    add_text(s, Inches(0.7), Inches(2.55), Inches(11), Inches(1.1),
             "TubeBrief", size=60, bold=True, color=TEXT_DARK)
    # 부제
    add_text(s, Inches(0.72), Inches(3.65), Inches(11), Inches(0.6),
             "유튜브 구독 채널 자동 요약 서비스", size=22, bold=True, color=TEAL)
    # 한 줄 소개
    add_text(s, Inches(0.72), Inches(4.35), Inches(9.5), Inches(0.9),
             "구독한 유튜브 채널의 신규 영상을 매일 자동으로 감지해 AI로 구조화된 한 장짜리 "
             "요약 보고서를 작성·아카이빙하는 개인용 콘텐츠 다이제스트.",
             size=14, color=TEXT_GRAY, line_spacing=1.4)
    # 작은 라인
    add_rect(s, Inches(0.75), Inches(5.55), Inches(2.2), Inches(0.03), fill=TEAL)
    # 정보
    add_text(s, Inches(0.72), Inches(5.7), Inches(8), Inches(0.4),
             "기말과제 발표  ·  이용주  ·  학번: _(제출 전 본인 학번 기입)_",
             size=12, color=TEXT_GRAY)
    # 링크
    add_text(s, Inches(0.72), Inches(6.15), Inches(2), Inches(0.35),
             "GitHub", size=11, bold=True, color=TEXT_DARK)
    add_hyperlink_text(s, Inches(0.72), Inches(6.45), Inches(8), Inches(0.35),
                       "https://github.com/leeyongjoo9-rgb/tubebrief_mvp",
                       "https://github.com/leeyongjoo9-rgb/tubebrief_mvp",
                       size=11)
    add_text(s, Inches(0.72), Inches(6.85), Inches(2), Inches(0.35),
             "Service URL", size=11, bold=True, color=TEXT_DARK)
    add_hyperlink_text(s, Inches(2.2), Inches(6.85), Inches(8), Inches(0.35),
                       "https://tubebrief-mvp.vercel.app/",
                       "https://tubebrief-mvp.vercel.app/",
                       size=11)

    # ────────────────────────────────────────────
    # Slide 2 — WHY · 문제정의와 대상 사용자
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "WHY  ·  문제정의와 대상 사용자",
                     "정보는 쏟아지고 시간은 부족하다.", 2, kor_size=32)
    # 좌측 PROBLEM
    add_text(s, Inches(0.7), Inches(2.3), Inches(4), Inches(0.35),
             "PROBLEM", size=12, bold=True, color=TERRACOTTA)
    add_text(s, Inches(0.7), Inches(2.65), Inches(4), Inches(0.5),
             "문제 · 사용 상황", size=20, bold=True, color=TEXT_DARK)
    add_text(s, Inches(0.7), Inches(3.45), Inches(5.5), Inches(3),
             ["•  매일 채널마다 1~5편 신규 영상 누적, 다 볼 시간 없음",
              "•  어떤 영상에 시간을 투자할지 우선순위 판단 어려움",
              "•  유튜브 자막은 길고 비구조화 텍스트라 훑어 읽기 어려움",
              "•  한 줄 캡션은 정보 밀도 부족, 알고리즘 추천은 관심사와 어긋남",
              "•  오래된 영상은 RSS 에서 사라져 회수할 방법 없음"],
             size=14, color=TEXT_GRAY, line_spacing=1.6)
    # 우측 GOAL
    add_text(s, Inches(7.0), Inches(2.3), Inches(4), Inches(0.35),
             "GOAL  ·  대상 사용자", size=12, bold=True, color=TEAL)
    add_text(s, Inches(7.0), Inches(2.65), Inches(5.5), Inches(0.5),
             "해결 가설 · 누구를 위해", size=20, bold=True, color=TEXT_DARK)
    add_text(s, Inches(7.0), Inches(3.45), Inches(5.7), Inches(3),
             ["•  채널을 등록만 해두면 매일 자동으로 요약 보고서 누적",
              "•  영상 한 편을 1분 안에 파악 → 골라서 시청",
              "•  단순 캡션 X → 헤드라인·본문·출연자·기업·시각 점프까지 구조화",
              "",
              "▸  구독 채널 3개 이상, 콘텐츠 중심 시청 / 시간 부족한 개인",
              "▸  정보 비용 최소화로 의사결정에 쓰고 싶은 사용자"],
             size=14, color=TEXT_GRAY, line_spacing=1.6)

    # ────────────────────────────────────────────
    # Slide 3 — WHAT · 주요 기능
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "WHAT  ·  주요 기능",
                     "수집부터 요약·구독·자동화까지", 3, kor_size=32)
    # 6 cards (3x2 grid)
    cards = [
        ("자동 수집", "채널 RSS 주기 폴링으로 신규 영상 자동 감지 (UNIQUE 로 중복 방지)"),
        ("자막 추출", "한국어 자막 추출, 실패 시 RSS 설명문 메타데이터로 폴백"),
        ("AI 구조화 요약",
         "gpt-5-mini 의 structured outputs 으로 헤드라인·본문·주제·인물·기업·타임스탬프 분리"),
        ("유연한 채널 등록",
         "채널 전체 또는 제목·설명문 키워드 AND 필터로 코너 단위 수신 (핵심 차별)"),
        ("출연자 ↔ 거론 인물 분리",
         "people / mentioned_people 별도 필드. 채널 호스트 자동 제외, 환각 방지"),
        ("자동화 + 보고서 정리",
         "Vercel Cron 일 1회 자동 실행. 한 번 본 보고서는 소프트 삭제로 정리"),
    ]
    for i, (title, body) in enumerate(cards):
        row = i // 3
        col = i % 3
        x = 0.7 + col * 4.05
        y = 2.05 + row * 2.12
        add_icon_card(s, x=x, y=y, w=3.85, h=1.9, title=title, body=body)

    # ────────────────────────────────────────────
    # Slide 4 — USE · 사용자 흐름
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "USE  ·  사용자 이용 흐름",
                     "채널 등록 → 자동 처리 → 결과 조회", 4, kor_size=32)

    # [입력] 영역
    add_text(s, Inches(0.7), Inches(2.2), Inches(4), Inches(0.35),
             "INPUT  ·  입력 (1회 등록)", size=12, bold=True, color=TERRACOTTA)
    add_text(s, Inches(0.7), Inches(2.55), Inches(11.9), Inches(0.55),
             "사용자는 메인화면 [채널 관리] 에서 채널 URL + 키워드 필터를 1회 등록한다.",
             size=14, color=TEXT_DARK, line_spacing=1.4)

    # [자동 처리] 흐름
    add_text(s, Inches(0.7), Inches(3.5), Inches(4), Inches(0.35),
             "AUTO  ·  자동 처리 (매일 0시 UTC)", size=12, bold=True, color=TEAL)
    # 5단계 흐름
    steps = [
        ("매일 0시 UTC", "Vercel Cron"),
        ("RSS 폴링", "구독·키워드 매치"),
        ("자막 추출", "youtube-transcript\n→ 폴백"),
        ("LLM 요약", "gpt-5-mini\nJSON Schema"),
        ("Supabase 저장", "videos.summary\njsonb"),
    ]
    cur_x = 0.7
    step_w = 2.32
    gap = 0.15
    for i, (t, sub) in enumerate(steps):
        add_flow_step(s, x=cur_x, y=3.95, w=step_w, h=1.15, title=t, sub=sub)
        if i < len(steps) - 1:
            add_arrow(s, cur_x + step_w + 0.04, 4.32)
        cur_x += step_w + gap

    # [결과] 영역
    add_text(s, Inches(0.7), Inches(5.45), Inches(4), Inches(0.35),
             "OUTPUT  ·  결과", size=12, bold=True, color=TEAL)
    add_text(s, Inches(0.7), Inches(5.8), Inches(5.85), Inches(1.4),
             ["▸  홈 대시보드 — ChannelStrip, 카드 그리드, 마지막 자동 확인 시각",
              "▸  채널별 필터링, 최신 영상이 좌측 첫 카드부터 배치"],
             size=13, color=TEXT_GRAY, line_spacing=1.5)
    add_text(s, Inches(6.85), Inches(5.8), Inches(5.85), Inches(1.4),
             ["▸  영상 상세 — 헤드라인 + 키워드 + 출연자 / 거론 인물",
              "▸  본문 안 (mm:ss) → 유튜브 그 시점 점프. 한 번 본 보고서는 삭제 가능"],
             size=13, color=TEXT_GRAY, line_spacing=1.5)

    # ────────────────────────────────────────────
    # Slide 5 — DEMO · 데모 화면
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "DEMO  ·  데모 화면 (라이브)",
                     "옛 규칙 vs 새 규칙 — 같은 채널, 8배 정보 밀도", 5, kor_size=28)
    # 라이브 URL
    add_text(s, Inches(0.7), Inches(2.05), Inches(2), Inches(0.35),
             "LIVE", size=12, bold=True, color=TERRACOTTA)
    add_hyperlink_text(s, Inches(1.4), Inches(2.05), Inches(8), Inches(0.35),
                       "https://tubebrief-mvp.vercel.app/",
                       "https://tubebrief-mvp.vercel.app/",
                       size=13, bold=True)
    # 3개 스크린샷 placeholder
    placeholders = [
        ("① 홈 대시보드", "ChannelStrip + 55개 카드 + 채널 관리 버튼"),
        ("② 옛 규칙 영상",
         "8Khu3IoZric — brief 366자 / 1문단"),
        ("③ 새 규칙 영상",
         "muA-MB0k7SE — brief 2,122자 / 10문단"),
    ]
    for i, (title, sub) in enumerate(placeholders):
        x = 0.7 + i * 4.05
        # 흰 카드
        add_rect(s, Inches(x), Inches(2.55), Inches(3.85), Inches(3.3), fill=WHITE)
        # 점선 placeholder (회색 박스)
        add_rect(s, Inches(x + 0.2), Inches(2.75), Inches(3.45), Inches(2.5),
                 fill=BG_LIGHT)
        add_text(s, Inches(x + 0.2), Inches(3.5), Inches(3.45), Inches(0.4),
                 "[ 데모 스크린샷 ]", size=12, color=TEXT_LIGHT_GRAY,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 라벨
        add_text(s, Inches(x + 0.2), Inches(5.35), Inches(3.5), Inches(0.35),
                 title, size=12, bold=True, color=TEAL)
        add_text(s, Inches(x + 0.2), Inches(5.65), Inches(3.5), Inches(0.35),
                 sub, size=10, color=TEXT_GRAY)

    # 시연 시나리오
    add_text(s, Inches(0.7), Inches(6.05), Inches(4), Inches(0.35),
             "SCENARIO  ·  90초 시연 흐름", size=12, bold=True, color=TEAL)
    add_text(s, Inches(0.7), Inches(6.4), Inches(11.9), Inches(0.95),
             ["① ChannelStrip → Normaltic Place → 카드 필터링      "
              "② 옛 영상 → 짧은 본문      "
              "③ 새 영상 → 10문단 + (mm:ss) 점프      "
              "④ 보고서 삭제 → 자동 홈 복귀      "
              "⑤ 채널 관리 페이지 — 추가/삭제 시연"],
             size=11, color=TEXT_GRAY, line_spacing=1.4)

    # ────────────────────────────────────────────
    # Slide 6 — STACK · 기술 스택
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "STACK  ·  기술 스택 및 구현 구조",
                     "Next.js 풀스택 + Supabase + OpenAI", 6, kor_size=32)
    # 상단: 4단계 파이프라인
    add_text(s, Inches(0.7), Inches(2.05), Inches(4), Inches(0.35),
             "PIPELINE  ·  4단계 직렬 처리", size=12, bold=True, color=TEAL)
    pipeline = [("RSS 감지", ""), ("자막/폴백", ""), ("AI 요약", ""), ("DB 저장", "")]
    cur_x = 0.7
    step_w = 2.78
    for i, (t, sub) in enumerate(pipeline):
        add_flow_step(s, x=cur_x, y=2.5, w=step_w, h=1.05, title=t, sub=sub)
        if i < len(pipeline) - 1:
            add_arrow(s, cur_x + step_w + 0.04, 2.83)
        cur_x += step_w + 0.15
    # 하단: 기술 스택 표
    rows = [
        ("프레임워크 / 언어",
         "Next.js 16 (App Router) · TypeScript · Tailwind CSS + shadcn/ui"),
        ("데이터 / 모델",
         "Supabase (PostgreSQL) · OpenAI gpt-5-mini (JSON 스키마 출력)"),
        ("외부 데이터 소스",
         "YouTube RSS · 영상 페이지 스크래핑 · youtube-transcript 라이브러리"),
        ("배포 / 운영",
         "Vercel (Hobby) + Cron 일 1회 · GitHub 자동 빌드 연동"),
    ]
    for i, (label, content) in enumerate(rows):
        y = 4.0 + i * 0.82
        add_row_card(s, x=0.7, y=y, w=11.9, h=0.74,
                     label=label, content=content)

    # ────────────────────────────────────────────
    # Slide 7 — API · 외부 활용
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "API  ·  외부 API · MCP 활용 방식",
                     "직접 호출 4 + 인프라 활용 1", 7, kor_size=32)
    rows = [
        ("OpenAI Chat (gpt-5-mini)",
         "자막 + 시스템 프롬프트 + JSON Schema → strict mode → Supabase jsonb 저장"),
        ("Supabase REST + JS SDK",
         "서버는 service role, 클라이언트는 publishable key (RLS 보호)"),
        ("YouTube RSS",
         "feeds/videos.xml?channel_id 폴링 → XML 파싱 → 키워드 매치 → DB INSERT"),
        ("YouTube 페이지 스크래핑",
         "URL → channel_id 추출 — 6 패턴 fallback (canonical / og:url / Schema.org / JSON)"),
        ("Vercel Platform (인프라)",
         "vercel.json crons → 매일 0시 /api/cron 자동. push 시 GitHub webhook 으로 자동 재배포"),
    ]
    for i, (label, content) in enumerate(rows):
        y = 2.15 + i * 0.93
        add_row_card(s, x=0.7, y=y, w=11.9, h=0.83,
                     label=label, content=content)
    # 한계
    add_text(s, Inches(0.7), Inches(6.95), Inches(11.9), Inches(0.35),
             "한계  ·  영상당 LLM 비용 ~$0.025 / Vercel Hobby 60초 timeout → 보수적 limit + temperature 0.2 로 retry 최소화",
             size=10, color=TEXT_LIGHT_GRAY)

    # ────────────────────────────────────────────
    # Slide 8 — CONTEXT · 컨텍스트 엔지니어링
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "CONTEXT  ·  컨텍스트 엔지니어링 활용",
                     ".md 파일 4개로 역할 · 목표 · 제약 · 검증 기준 설계", 8, kor_size=28)
    rows = [
        ("CLAUDE.md",
         "세션마다 자동 로드되는 규칙. 절대 규칙 6개 + 작업 순서 8단계 + 코딩 스타일"),
        ("TubeBrief_PRD.md",
         "문제·기능·사용자 흐름·파이프라인. 자막 폴백 3단계가 그대로 코드 status 값"),
        ("SUMMARY_SCHEMA.json",
         "LLM 출력 JSON 스키마 진실 공급원. OpenAI response_format.json_schema 그대로 전달"),
        ("PRESENTATION.md",
         "발표 콘텐츠 + 옛/새 규칙 비교 라이브 자료. GitHub 리뷰 시 노출"),
    ]
    for i, (label, content) in enumerate(rows):
        y = 2.15 + i * 0.93
        add_row_card(s, x=0.7, y=y, w=11.9, h=0.83,
                     label=label, content=content)
    # 입력 자료
    add_text(s, Inches(0.7), Inches(6.0), Inches(4), Inches(0.35),
             "INPUT  ·  Context 작성을 위한 자료", size=12, bold=True, color=TEAL)
    add_text(s, Inches(0.7), Inches(6.4), Inches(11.9), Inches(0.95),
             ["•  강의 교안의 'AI 협업 규칙' + Anthropic Claude Code 공식 베스트 프랙티스 → CLAUDE.md",
              "•  본인 문제 정의 + 기존 유튜브 요약 서비스 한계 분석 → PRD",
              "•  OpenAI structured outputs 공식 가이드 + JSON Schema draft-07 → SUMMARY_SCHEMA"],
             size=10, color=TEXT_GRAY, line_spacing=1.4)

    # ────────────────────────────────────────────
    # Slide 9 — NEXT · 어려움·해결·한계·개선
    # ────────────────────────────────────────────
    s = make_slide(prs)
    add_slide_header(s, "NEXT  ·  어려움 · 해결 · 한계 · 개선",
                     "3겹 가드레일이 LLM 시스템의 핵심이었다.", 9, kor_size=28)

    # 좌측: 어려움 + 해결
    add_text(s, Inches(0.7), Inches(2.1), Inches(4), Inches(0.35),
             "CHALLENGE  ·  어려움", size=12, bold=True, color=TERRACOTTA)
    add_text(s, Inches(0.7), Inches(2.45), Inches(6), Inches(0.5),
             "LLM 한국어 요약이 규칙을 안 지킴", size=18, bold=True, color=TEXT_DARK)
    add_text(s, Inches(0.7), Inches(3.05), Inches(6), Inches(0.9),
             ["•  초기 gpt-4o-mini: brief 290자 / 1문단 / (mm:ss) 0개",
              "•  프롬프트 '가이드' → LLM 이 권고로 받아들임"],
             size=12, color=TEXT_GRAY, line_spacing=1.4)
    add_text(s, Inches(0.7), Inches(4.15), Inches(4), Inches(0.35),
             "SOLUTION  ·  3겹 가드레일", size=12, bold=True, color=TEAL)
    add_text(s, Inches(0.7), Inches(4.5), Inches(6), Inches(1.5),
             ["①  프롬프트 명령조 강화 (반드시 N자 이상)",
              "②  validateSummary 후처리 + 위반 시 자동 재시도 (MAX 2)",
              "③  gpt-5-mini 로 모델 교체"],
             size=12, color=TEXT_GRAY, line_spacing=1.5)

    # 우측: 결과 비교 표
    add_text(s, Inches(7.0), Inches(2.1), Inches(4), Inches(0.35),
             "RESULT  ·  같은 영상, 8배 정보 밀도", size=12, bold=True, color=TEAL)
    # 표 (4행)
    table_rows = [
        ("brief 분량",       "264자 / 1문단",   "2,122자 / 10문단"),
        ("(mm:ss) 마커",     "0",              "5"),
        ("companies",        "0",              "7"),
        ("출연자 / 거론 분리", "혼재",            "people / mentioned"),
    ]
    # 헤더
    th_y = 2.55
    add_rect(s, Inches(7.0), Inches(th_y), Inches(5.7), Inches(0.4), fill=BG_MINT)
    add_text(s, Inches(7.15), Inches(th_y), Inches(2.05), Inches(0.4),
             "항목", size=11, bold=True, color=TEXT_DARK,
             anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(9.2), Inches(th_y), Inches(1.65), Inches(0.4),
             "옛 규칙", size=11, bold=True, color=TEXT_DARK,
             anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(10.85), Inches(th_y), Inches(1.85), Inches(0.4),
             "새 규칙", size=11, bold=True, color=TEAL,
             anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)
    for i, (a, b, c) in enumerate(table_rows):
        ry = th_y + 0.45 + i * 0.5
        add_rect(s, Inches(7.0), Inches(ry), Inches(5.7), Inches(0.45), fill=WHITE)
        add_text(s, Inches(7.15), Inches(ry), Inches(2.05), Inches(0.45),
                 a, size=11, color=TEXT_DARK, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(9.2), Inches(ry), Inches(1.65), Inches(0.45),
                 b, size=11, color=TEXT_GRAY, anchor=MSO_ANCHOR.MIDDLE,
                 align=PP_ALIGN.CENTER)
        add_text(s, Inches(10.85), Inches(ry), Inches(1.85), Inches(0.45),
                 c, size=11, bold=True, color=TEAL, anchor=MSO_ANCHOR.MIDDLE,
                 align=PP_ALIGN.CENTER)

    # 하단: 한계 & 개선 한 줄
    add_text(s, Inches(0.7), Inches(6.3), Inches(4), Inches(0.35),
             "LIMITATION  ·  정직한 회고", size=12, bold=True, color=TERRACOTTA)
    add_text(s, Inches(0.7), Inches(6.65), Inches(11.9), Inches(0.7),
             ["•  Vercel Hobby 60초 / 일 1회 cron — backlog 누적 → Pro 또는 외부 워커 분리",
              "•  자막 음역 (곽재식→곽제식) → description 해시태그를 LLM 정답 표기로 주입",
              "•  배포 URL 공개 → Vercel Password Protection 또는 Supabase Auth"],
             size=10, color=TEXT_GRAY, line_spacing=1.4)

    prs.save(str(OUTPUT))
    print(f"saved: {OUTPUT.resolve()}")
    print(f"size: {OUTPUT.stat().st_size} bytes")
    print(f"slides: {len(prs.slides)}")


if __name__ == "__main__":
    main()
