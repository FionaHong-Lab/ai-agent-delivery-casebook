from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import mm

pdfmetrics.registerFont(TTFont('EmbeddedChinese', '/System/Library/Fonts/STHeiti Light.ttc', subfontIndex=0))
out = Path('assets/case-07/order-change-scene-v2.pdf')
style = ParagraphStyle('body', fontName='EmbeddedChinese', fontSize=10.5, leading=17, alignment=TA_LEFT, wordWrap='CJK', spaceAfter=9)
title = ParagraphStyle('title', parent=style, fontSize=16, leading=23, textColor=colors.HexColor('#26374c'), spaceAfter=14)
doc = SimpleDocTemplate(str(out), pagesize=(210*mm,297*mm), leftMargin=21*mm, rightMargin=21*mm, topMargin=20*mm, bottomMargin=20*mm, title='订单变化场景说明 - 虚构示例')
parts = Path('scripts/scene-summary.txt').read_text(encoding='utf8').strip().split('\n\n')
story = []
for i, part in enumerate(parts):
    for line in part.splitlines():
        story.append(Paragraph(escape(line), title if i == 0 else style))
    story.append(Spacer(1, 3*mm))
doc.build(story)
content_hash = hashlib.sha256(Path('scripts/scene-summary.txt').read_bytes() + Path(__file__).read_bytes()).hexdigest()
pdf_hash = hashlib.sha256(out.read_bytes()).hexdigest()
Path('scripts/pdf-manifest.json').write_text(json.dumps({'contentHash': content_hash, 'pdfHash': pdf_hash}, indent=2) + '\n', encoding='utf8')
