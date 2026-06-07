"""기말과제 발표자료 .pptx 생성 — python-pptx 기반.
9슬라이드 16:9, 발표 7분 시간 분배 포함.
일회용 스크립트. 출력: 이용주-기말발표자료.pptx
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu, Cm
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from copy import deepcopy
from lxml import etree


OUTPUT = Path("이용주-기말발표자료.pptx")

# 16:9 슬라이드 사이즈 (Microsoft 표준)
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

# 색상
COLOR_PRIMARY = RGBColor(0x1F, 0x38, 0x64)       # 진한 블루 — 헤더
COLOR_ACCENT = RGBColor(0x44, 0x72, 0xC4)        # 강조 블루
COLOR_HEADER_BG = RGBColor(0xD9, 0xE2, 0xF3)    # 표 헤더 배경
COLOR_HEADER_TEXT = RGBColor(0x1F, 0x38, 0x64)
COLOR_BOX_FILL = RGBColor(0xEA, 0xF1, 0xFB)     # 박스 배경
COLOR_BOX_BORDER = RGBColor(0x44, 0x72, 0xC4)
COLOR_GRAY = RGBColor(0x59, 0x59, 0x59)
COLOR_LIGHT_GRAY = RGBColor(0xBF, 0xBF, 0xBF)
COLOR_GREEN = RGBColor(0x10, 0x8A, 0x0E)
COLOR_AMBER = RGBColor(0xCA, 0x60, 0x00)
COLOR_WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def add_text(slide, x, y, w, h, text, size=18, bold=False, color=None,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font="맑은 고딕"):
    tx = slide.shapes.add_textbox(x, y, w, h)
    tf = tx.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor
    if isinstance(text, list):
        for i, line in enumerate(text):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            r = p.add_run()
            r.text = line
            r.font.name = font
            r.font.size = Pt(size)
            r.font.bold = bold
            if color:
                r.font.color.rgb = color
    else:
        p = tf.paragraphs[0]
        p.alignment = align
        r = p.add_run()
        r.text = text
        r.font.name = font
        r.font.size = Pt(size)
        r.font.bold = bold
        if color:
            r.font.color.rgb = color
    return tx


def set_run_korean_font(run, name="맑은 고딕"):
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn("a:ea"))
    if ea is None:
        ea = etree.SubElement(rPr, qn("a:ea"))
    ea.set("typeface", name)


def add_header(slide, title, slide_num, total=9, time_sec=0):
    # 상단 색 바
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, Inches(0.08))
    bar.fill.solid()
    bar.fill.fore_color.rgb = COLOR_ACCENT
    bar.line.fill.background()

    # 제목
    add_text(slide, Inches(0.5), Inches(0.25), Inches(10), Inches(0.7),
             title, size=24, bold=True, color=COLOR_PRIMARY)
    # 우측 상단 슬라이드 번호 + 시간
    meta = f"{slide_num}/{total}  ·  {time_sec}초"
    add_text(slide, Inches(11), Inches(0.32), Inches(2.2), Inches(0.4),
             meta, size=11, color=COLOR_GRAY, align=PP_ALIGN.RIGHT)


def add_box(slide, x, y, w, h, title, body, title_color=None, fill_color=None):
    """제목+본문이 들어가는 박스."""
    title_color = title_color or COLOR_PRIMARY
    fill_color = fill_color or COLOR_BOX_FILL
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.color.rgb = COLOR_BOX_BORDER
    shape.line.width = Pt(1)
    shape.shadow.inherit = False
    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.18)
    tf.margin_right = Inches(0.15)
    tf.margin_top = Inches(0.12)
    tf.margin_bottom = Inches(0.12)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run()
    r.text = title
    r.font.name = "맑은 고딕"
    r.font.size = Pt(15)
    r.font.bold = True
    r.font.color.rgb = title_color
    for line in body if isinstance(body, list) else [body]:
        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.LEFT
        p2.space_before = Pt(4)
        r2 = p2.add_run()
        r2.text = line
        r2.font.name = "맑은 고딕"
        r2.font.size = Pt(12)
        r2.font.color.rgb = COLOR_GRAY


def add_table(slide, x, y, w, h, headers, rows, header_bg=None,
              col_widths_in=None, header_size=11, body_size=10):
    header_bg = header_bg or COLOR_HEADER_BG
    n_cols = len(headers)
    n_rows = 1 + len(rows)
    tbl = slide.shapes.add_table(n_rows, n_cols, x, y, w, h).table
    # 헤더
    for i, h_text in enumerate(headers):
        cell = tbl.cell(0, i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = header_bg
        tf = cell.text_frame
        tf.clear()
        tf.margin_left = Inches(0.08)
        tf.margin_right = Inches(0.08)
        tf.margin_top = Inches(0.05)
        tf.margin_bottom = Inches(0.05)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run()
        r.text = h_text
        r.font.name = "맑은 고딕"
        r.font.size = Pt(header_size)
        r.font.bold = True
        r.font.color.rgb = COLOR_HEADER_TEXT
    # 데이터
    for r_idx, row in enumerate(rows, start=1):
        for c_idx, val in enumerate(row):
            cell = tbl.cell(r_idx, c_idx)
            tf = cell.text_frame
            tf.clear()
            tf.margin_left = Inches(0.08)
            tf.margin_right = Inches(0.08)
            tf.margin_top = Inches(0.04)
            tf.margin_bottom = Inches(0.04)
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = val
            r.font.name = "맑은 고딕"
            r.font.size = Pt(body_size)
            r.font.color.rgb = COLOR_GRAY
    if col_widths_in:
        for i, cw in enumerate(col_widths_in):
            tbl.columns[i].width = Inches(cw)
    return tbl


def add_arrow_flow(slide, x, y, steps, step_w=2.1, step_h=1.0, gap=0.25):
    """가로 화살표 흐름. steps: list of (title, sub) tuples."""
    cur_x = x
    for i, (title, sub) in enumerate(steps):
        box = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE,
            Inches(cur_x), Inches(y), Inches(step_w), Inches(step_h),
        )
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_BOX_FILL
        box.line.color.rgb = COLOR_BOX_BORDER
        box.line.width = Pt(1)
        box.shadow.inherit = False
        tf = box.text_frame
        tf.margin_left = Inches(0.1)
        tf.margin_right = Inches(0.1)
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = title
        r.font.name = "맑은 고딕"
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY
        if sub:
            p2 = tf.add_paragraph()
            p2.alignment = PP_ALIGN.CENTER
            p2.space_before = Pt(2)
            r2 = p2.add_run()
            r2.text = sub
            r2.font.name = "맑은 고딕"
            r2.font.size = Pt(9)
            r2.font.color.rgb = COLOR_GRAY
        # 화살표
        if i < len(steps) - 1:
            arrow = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW,
                Inches(cur_x + step_w), Inches(y + step_h / 2 - 0.15),
                Inches(gap), Inches(0.3),
            )
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = COLOR_ACCENT
            arrow.line.fill.background()
        cur_x += step_w + gap


def make_slide(prs):
    """Add blank slide and return it."""
    return prs.slides.add_slide(prs.slide_layouts[6])  # blank


def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    # ─────────────────────────────────────────────────────────────
    # Slide 1 — 표지 (30초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    # 좌측 색 면
    band = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(4.5), SLIDE_H)
    band.fill.solid()
    band.fill.fore_color.rgb = COLOR_PRIMARY
    band.line.fill.background()
    # 프로젝트 명
    add_text(s, Inches(0.5), Inches(2.2), Inches(3.7), Inches(1.2),
             "TubeBrief", size=54, bold=True, color=COLOR_WHITE)
    add_text(s, Inches(0.5), Inches(3.4), Inches(3.7), Inches(0.5),
             "유튜브 구독 채널 자동 요약", size=18, color=COLOR_WHITE)
    add_text(s, Inches(0.5), Inches(4.0), Inches(3.7), Inches(0.4),
             "바이브코딩 기말과제 · 이용주", size=13, color=COLOR_WHITE)
    # 우측 내용
    add_text(s, Inches(5.0), Inches(1.2), Inches(7.8), Inches(0.6),
             "한 줄 소개", size=14, bold=True, color=COLOR_PRIMARY)
    add_text(s, Inches(5.0), Inches(1.7), Inches(7.8), Inches(1.6),
             "구독한 유튜브 채널의 신규 영상을 매일 자동 감지해 "
             "AI 로 구조화된 한 장짜리 요약 보고서로 변환·아카이빙하는 "
             "개인용 콘텐츠 다이제스트.",
             size=16, color=COLOR_GRAY)
    add_text(s, Inches(5.0), Inches(3.8), Inches(7.8), Inches(0.5),
             "GitHub", size=12, bold=True, color=COLOR_PRIMARY)
    add_text(s, Inches(5.0), Inches(4.2), Inches(7.8), Inches(0.5),
             "https://github.com/leeyongjoo9-rgb/tubebrief_mvp",
             size=14, color=COLOR_GRAY)
    add_text(s, Inches(5.0), Inches(4.9), Inches(7.8), Inches(0.5),
             "Service URL", size=12, bold=True, color=COLOR_PRIMARY)
    add_text(s, Inches(5.0), Inches(5.3), Inches(7.8), Inches(0.5),
             "https://tubebrief-mvp.vercel.app/", size=14, color=COLOR_GRAY)
    add_text(s, Inches(5.0), Inches(6.0), Inches(7.8), Inches(0.4),
             "학번: _(제출 전 본인 학번 기입)_", size=11, color=COLOR_GRAY)

    # ─────────────────────────────────────────────────────────────
    # Slide 2 — 문제정의와 대상 사용자 (45초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "2. 문제정의와 대상 사용자", 2, time_sec=45)
    # 핵심 메시지
    add_text(s, Inches(0.5), Inches(1.2), Inches(12), Inches(0.7),
             "구독 채널이 많아질수록 무엇부터 볼지 모른다.",
             size=22, bold=True, color=COLOR_PRIMARY)
    # 4박스
    add_box(s, Inches(0.5), Inches(2.3), Inches(5.9), Inches(2.0),
            "대상 사용자",
            ["구독 채널 8개 이상",
             "콘텐츠 중심으로 보고 싶지만 시간이 부족한 개인",
             "정보 비용을 최소화해 의사결정에 쓰고 싶은 사용자"])
    add_box(s, Inches(6.9), Inches(2.3), Inches(5.9), Inches(2.0),
            "사용 상황",
            ["매일 채널마다 1~5편 신규 영상 누적",
             "어떤 영상에 시간을 투자할지 판단 어려움",
             "그러는 사이 오래된 영상은 RSS 에서 사라짐"])
    add_box(s, Inches(0.5), Inches(4.5), Inches(5.9), Inches(2.0),
            "기존 한계",
            ["유튜브 자막은 길고 비구조화 텍스트",
             "한 줄 캡션은 정보 밀도 부족",
             "알고리즘 추천은 본인 관심사와 어긋남"])
    add_box(s, Inches(6.9), Inches(4.5), Inches(5.9), Inches(2.0),
            "우리의 가설",
            ["채널을 등록만 해두면 → 매일 자동으로 요약 보고서가 쌓이고",
             "1분 안에 영상 핵심을 파악 → 골라서 시청",
             "단순 캡션 아닌 헤드라인·본문·출연자·기업·시각 점프"],
            title_color=COLOR_ACCENT)

    # ─────────────────────────────────────────────────────────────
    # Slide 3 — 서비스 개요와 핵심 기능 (45초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "3. 서비스 개요와 핵심 기능", 3, time_sec=45)
    add_text(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.7),
             "매일 자동 감지 → 자막+LLM → 구조화 한 장 보고서 → 대시보드 아카이빙",
             size=18, bold=True, color=COLOR_PRIMARY)
    # 핵심 기능 3개
    add_box(s, Inches(0.5), Inches(2.3), Inches(4.05), Inches(4.4),
            "① 자동 감지 cron",
            ["• Vercel Cron 일 1회",
             "• RSS 폴링 → 자막 추출 → LLM 요약 직렬 실행",
             "• 자막 실패 시 메타데이터 폴백",
             "• 인증된 Bearer 호출만 허용",
             "",
             "→ 사용자 개입 0 회"])
    add_box(s, Inches(4.65), Inches(2.3), Inches(4.05), Inches(4.4),
            "② 코너 단위 구독",
            ["• 한 채널 안 여러 코너 중 원하는 것만",
             "• include / exclude 키워드 AND 필터",
             "• 제목 + RSS 설명문 함께 검색",
             "• 호스트 해시태그 (예: #곽재식) 도 매치",
             "",
             "→ MBC 라디오 시사처럼 7프로그램 채널 안 권순표만 받기 가능"])
    add_box(s, Inches(8.85), Inches(2.3), Inches(4.05), Inches(4.4),
            "③ 출연자 ↔ 거론 인물 분리",
            ["• people: 직접 출연한 외부 인물만",
             "• mentioned_people: 대화 중 거론된 인물 (역사적 인물 등)",
             "• 채널 호스트 자동 제외",
             "• 환각 방지: 자막에 근거 없으면 비움",
             "",
             "→ 곽재식 = people, 이호왕·김수암 = mentioned_people"],
            title_color=COLOR_ACCENT)
    # 비고
    add_text(s, Inches(0.5), Inches(6.95), Inches(12), Inches(0.4),
             "비고: 검색·필터·텍스트 내보내기는 v2 후보 (미구현)",
             size=10, color=COLOR_GRAY)

    # ─────────────────────────────────────────────────────────────
    # Slide 4 — 사용자 이용 흐름 (60초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "4. 사용자 이용 흐름 (입력 → 처리 → 결과)", 4, time_sec=60)
    # 입력
    add_text(s, Inches(0.5), Inches(1.3), Inches(2), Inches(0.4),
             "[입력]", size=14, bold=True, color=COLOR_ACCENT)
    add_text(s, Inches(0.5), Inches(1.75), Inches(12.3), Inches(0.5),
             "사용자는 /channels 페이지에서 채널 URL + (선택) include/exclude 키워드를 한 번 등록한다.",
             size=14, color=COLOR_GRAY)
    # 처리 흐름
    add_text(s, Inches(0.5), Inches(2.5), Inches(2), Inches(0.4),
             "[자동 처리]", size=14, bold=True, color=COLOR_ACCENT)
    add_arrow_flow(
        s, x=0.5, y=3.0,
        steps=[
            ("매일 0시 UTC", "Vercel Cron"),
            ("RSS 폴링", "8개 구독\n키워드 매치"),
            ("자막 추출", "youtube-transcript\n→ 폴백"),
            ("LLM 요약", "gpt-5-mini\nJSON Schema"),
            ("Supabase", "videos.summary\njsonb 저장"),
        ],
        step_w=2.42, step_h=1.3, gap=0.18,
    )
    # 결과
    add_text(s, Inches(0.5), Inches(4.9), Inches(2), Inches(0.4),
             "[결과]", size=14, bold=True, color=COLOR_ACCENT)
    add_box(s, Inches(0.5), Inches(5.4), Inches(6.1), Inches(1.6),
            "홈 대시보드",
            ["• ChannelStrip — 채널 칩 + 영상 수 + NEW 배지",
             "• 카드 그리드 — 제목·헤드라인·키워드·source 배지",
             "• 마지막 자동 확인 시각 노출"])
    add_box(s, Inches(6.7), Inches(5.4), Inches(6.1), Inches(1.6),
            "영상 상세 페이지",
            ["• 헤드라인 + 키워드(주제+기업 통합)",
             "• 출연자 / 언급된 인물 별도 섹션",
             "• 본문 brief 안 (mm:ss) → 유튜브 그 시점 점프"])

    # ─────────────────────────────────────────────────────────────
    # Slide 5 — 데모 화면 (90초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "5. 데모 화면 (라이브 데모)", 5, time_sec=90)
    add_text(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.5),
             "라이브 URL: https://tubebrief-mvp.vercel.app/",
             size=14, bold=True, color=COLOR_ACCENT)
    # 3장 캡처 placeholder
    placeholders = [
        ("① 홈 대시보드", "ChannelStrip + 55개 카드", 0.5, 2.0, 4.1, 3.4),
        ("② 영상 상세 (옛 규칙)", "8Khu3IoZric — brief 366자 / 1문단", 4.7, 2.0, 4.1, 3.4),
        ("③ 영상 상세 (새 규칙)", "muA-MB0k7SE — brief 2,122자 / 10문단", 8.9, 2.0, 4.1, 3.4),
    ]
    for title, sub, x, y, w, h in placeholders:
        shape = s.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                    Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor(0xF5, 0xF5, 0xF5)
        shape.line.color.rgb = COLOR_LIGHT_GRAY
        shape.line.dash_style = 7  # 점선
        shape.line.width = Pt(1)
        shape.shadow.inherit = False
        tf = shape.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = "[ 데모 스크린샷 이곳에 ]"
        r.font.name = "맑은 고딕"
        r.font.size = Pt(13)
        r.font.color.rgb = COLOR_GRAY
        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        p2.space_before = Pt(8)
        r2 = p2.add_run()
        r2.text = title
        r2.font.name = "맑은 고딕"
        r2.font.size = Pt(12)
        r2.font.bold = True
        r2.font.color.rgb = COLOR_PRIMARY
        p3 = tf.add_paragraph()
        p3.alignment = PP_ALIGN.CENTER
        p3.space_before = Pt(2)
        r3 = p3.add_run()
        r3.text = sub
        r3.font.name = "맑은 고딕"
        r3.font.size = Pt(10)
        r3.font.color.rgb = COLOR_GRAY
    # 시연 시나리오
    add_text(s, Inches(0.5), Inches(5.65), Inches(12.3), Inches(0.4),
             "시연 흐름 (90초)", size=13, bold=True, color=COLOR_ACCENT)
    add_text(s, Inches(0.5), Inches(6.05), Inches(12.3), Inches(1.3),
             ["① 홈 → ChannelStrip 의 'Normaltic Place' 클릭 → 카드 필터링",
              "② 8Khu3IoZric (옛 규칙) 클릭 → 짧은 본문 / 시각 마커 없음 / 키워드 5개",
              "③ 뒤로 가서 muA-MB0k7SE (새 규칙) 클릭 → 10문단 본문 / (mm:ss) 점프 링크 5개 / 키워드 13개",
              "④ 'On Air' 보여주기: 채널 관리 페이지로 들어가 구독 1개 추가/삭제 — 실시간으로 ChannelStrip 반영"],
             size=11, color=COLOR_GRAY)

    # ─────────────────────────────────────────────────────────────
    # Slide 6 — 기술스택 및 구현 구조 (30초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "6. 기술스택 및 구현 구조", 6, time_sec=30)
    add_text(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.5),
             "단일 Next.js 프로젝트 + Supabase + Vercel — 풀스택 통합",
             size=15, bold=True, color=COLOR_PRIMARY)
    # 표
    add_table(
        s,
        Inches(0.5), Inches(1.9), Inches(12.3), Inches(5.0),
        ["영역", "선택", "선택 이유"],
        [
            ["Framework / 언어", "Next.js 16 (App Router) + TypeScript",
             "API Routes 로 백엔드 통합, Vercel native. LLM 응답 스키마와 코드 타입 일치"],
            ["UI", "Tailwind v4 + shadcn/ui",
             "AI 코딩 친화, 디자인 시스템 즉시 사용"],
            ["DB", "Supabase (PostgreSQL)",
             "jsonb 컬럼으로 LLM JSON 출력 그대로 저장. RLS 보안. 무료 tier 충분"],
            ["LLM", "OpenAI gpt-5-mini",
             "structured outputs JSON Schema strict — 환각 방지. 한국어 분량 준수"],
            ["자막 / 신규 감지", "youtube-transcript + RSS Feed",
             "API 키·쿼터 불필요. 클라우드 IP 봇 차단 회피용 폴백 설계"],
            ["배포 / 자동화", "Vercel Hobby + Vercel Cron + GitHub Auto-Deploy",
             "push → 자동 빌드. cron 무료 (일 1회). 60초 함수 제한 안에서 보수적 처리"],
        ],
        col_widths_in=[2.6, 4.3, 5.4],
    )

    # ─────────────────────────────────────────────────────────────
    # Slide 7 — MCP/API 활용 방식 (45초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "7. MCP / API 활용 방식", 7, time_sec=45)
    add_text(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.5),
             "직접 호출 4 + 인프라 활용 1 — 서비스 가치와 직결",
             size=15, bold=True, color=COLOR_PRIMARY)
    add_table(
        s,
        Inches(0.5), Inches(1.9), Inches(12.3), Inches(4.8),
        ["API / Platform", "활용 목적", "연동 흐름"],
        [
            ["OpenAI Chat (gpt-5-mini)", "자막 → 구조화 JSON 요약",
             "자막 + 시스템 프롬프트 + JSON Schema → API → response_format strict → Supabase 저장"],
            ["Supabase REST + JS SDK", "채널/구독/영상/요약 저장 조회",
             "서버는 service role, 클라이언트는 publishable key (RLS 보호)"],
            ["YouTube RSS", "신규 영상 감지",
             "feeds/videos.xml?channel_id 폴링 → XML 파싱 → 키워드 매치 → DB INSERT"],
            ["YouTube 페이지 스크래핑", "URL → channel_id 추출 (다양한 형식)",
             "6 패턴 fallback (canonical / og:url / Schema.org / JSON channelId 등)"],
            ["Vercel Platform (인프라)", "Cron + Functions + Env + GitHub Auto-Deploy",
             "vercel.json crons → 매일 0시 /api/cron 자동. push 시 자동 재배포"],
        ],
        col_widths_in=[2.6, 3.4, 6.3],
    )
    # 한계
    add_text(s, Inches(0.5), Inches(6.85), Inches(12.3), Inches(0.4),
             "한계: LLM 비용 영상당 ~$0.025 / Vercel Hobby 60초 timeout → 보수적 limit + temperature 0.2 로 retry 최소화",
             size=10, color=COLOR_GRAY)

    # ─────────────────────────────────────────────────────────────
    # Slide 8 — 컨텍스트 엔지니어링 활용 (45초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "8. 컨텍스트 엔지니어링 활용 방식", 8, time_sec=45)
    add_text(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.5),
             "Claude Code + .md 파일 4개로 역할·목표·제약·검증 기준 설계",
             size=15, bold=True, color=COLOR_PRIMARY)
    add_table(
        s,
        Inches(0.5), Inches(1.9), Inches(12.3), Inches(4.0),
        ["Context 파일", "주요 역할", "실제 활용 방식"],
        [
            ["CLAUDE.md",
             "세션마다 자동 로드되는 프로젝트 규칙",
             "절대 규칙 6개 + 작업 순서 8단계 + 코딩 스타일. 규칙 1번(키 보안)·6번(form 금지)이 모든 코드에 반영"],
            ["TubeBrief_PRD.md",
             "제품 요구사항 — 문제·기능·사용자 흐름",
             "자막 폴백 3단계 (transcript_ok / metadata_fallback / failed) 가 그대로 코드 status 값"],
            ["SUMMARY_SCHEMA.json",
             "LLM 출력 JSON 스키마 진실 공급원",
             "OpenAI response_format.json_schema 에 그대로 전달. strict mode 강제"],
            ["PRESENTATION.md",
             "발표 콘텐츠 + 옛/새 규칙 비교 라이브 자료",
             "발표 9슬라이드 70% 사전 정리. 비교용 두 URL 박혀 있어 GitHub 리뷰 시 노출"],
        ],
        col_widths_in=[2.6, 3.6, 6.1],
    )
    # 입력 정보
    add_text(s, Inches(0.5), Inches(6.05), Inches(12.3), Inches(0.4),
             "Context 작성을 위한 입력", size=12, bold=True, color=COLOR_ACCENT)
    add_text(s, Inches(0.5), Inches(6.45), Inches(12.3), Inches(0.9),
             ["• CLAUDE.md: 강의 교안의 'AI 협업 규칙' + Anthropic Claude Code 공식 베스트 프랙티스",
              "• PRD: 본인 문제 정의 + 기존 유튜브 요약 서비스 한계 분석",
              "• SUMMARY_SCHEMA: OpenAI structured outputs 공식 가이드 + JSON Schema draft-07"],
             size=10, color=COLOR_GRAY)

    # ─────────────────────────────────────────────────────────────
    # Slide 9 — 어려움·해결·한계·개선 (60초)
    # ─────────────────────────────────────────────────────────────
    s = make_slide(prs)
    add_header(s, "9. 어려움·해결·한계·개선", 9, time_sec=60)
    # 가장 어려웠던 점 — 좌측
    add_box(s, Inches(0.5), Inches(1.2), Inches(6.2), Inches(2.9),
            "[어려움] LLM 한국어 요약이 규칙을 안 지킴",
            ["• 초기 gpt-4o-mini: brief 290자 / 1문단 / (mm:ss) 0개",
             "• 프롬프트의 '가이드' 표현 → LLM 이 권고로 받아들임",
             "",
             "[해결 — 3겹 가드레일]",
             "① 프롬프트 명령조 강화 (반드시 N자 이상)",
             "② validateSummary 후처리 + 위반 시 자동 재시도 (MAX 2)",
             "③ gpt-5-mini 로 모델 교체"])
    # 결과 비교 — 우측 상단
    add_text(s, Inches(7.0), Inches(1.2), Inches(6.0), Inches(0.4),
             "[결과] 같은 영상, 8배 정보 밀도",
             size=13, bold=True, color=COLOR_ACCENT)
    add_table(
        s,
        Inches(7.0), Inches(1.65), Inches(6.0), Inches(2.4),
        ["", "옛 규칙", "새 규칙"],
        [
            ["brief 분량", "264자 / 1문단", "2,122자 / 10문단"],
            ["(mm:ss) 마커", "0", "5"],
            ["companies", "0", "7"],
            ["출연자/거론 분리", "혼재", "people / mentioned_people"],
        ],
        col_widths_in=[1.6, 2.0, 2.4],
    )
    # 한계 — 하단
    add_text(s, Inches(0.5), Inches(4.3), Inches(12.3), Inches(0.4),
             "[한계 · 개선] 정직한 회고", size=13, bold=True, color=COLOR_ACCENT)
    add_table(
        s,
        Inches(0.5), Inches(4.75), Inches(12.3), Inches(2.4),
        ["한계", "현재 대응 / 향후 개선"],
        [
            ["신규 등록 채널의 RSS 15편 이전 영상 백필 불가 (일일 cron 운영에선 누락 거의 없음)",
             "YouTube Data API 도입 시 등록 직후 백필 가능 (쿼터·인증 부담)"],
            ["Vercel Hobby 60초 / 일 1회 cron — backlog 누적",
             "Pro 업그레이드 또는 외부 워커 분리"],
            ["자막 음성 인식 오류 (곽재식 → 곽제식)",
             "description 의 #곽재식 해시태그를 정답 표기로 LLM 시스템 프롬프트에 주입"],
            ["인증 부재 — 배포 URL 공개",
             "Vercel Password Protection 또는 Supabase Auth"],
        ],
        col_widths_in=[6.4, 5.9],
    )
    # 배운 점 — 하단
    add_text(s, Inches(0.5), Inches(7.05), Inches(12.3), Inches(0.4),
             "배운 점: 프롬프트 단독으로는 부족 — 검증·재시도·모델 선택의 3겹 가드레일이 신뢰 가능한 LLM 시스템의 필수 구성.",
             size=11, bold=True, color=COLOR_PRIMARY)

    prs.save(str(OUTPUT))
    print(f"saved: {OUTPUT.resolve()}")
    print(f"size: {OUTPUT.stat().st_size} bytes")
    print(f"slides: {len(prs.slides)}")


if __name__ == "__main__":
    main()
