from pathlib import Path
from xml.sax.saxutils import escape
import re, textwrap
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/Actividad_2_6_Dashboard_Analitico.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Body',fontName='Helvetica',fontSize=10,leading=15,spaceAfter=8))
styles.add(ParagraphStyle(name='CodeSmall',fontName='Courier',fontSize=7.5,leading=10,spaceAfter=10))
styles['Heading1'].textColor=colors.HexColor('#183341')
styles['Heading2'].textColor=colors.HexColor('#267f7c')

def inline(line):
    line=escape(line.replace('—','-'))
    line=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>',line)
    return re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',line)

story=[]
lines=(ROOT/'docs/analytics.md').read_text(encoding='utf-8').splitlines()
i=0
while i<len(lines):
    line=lines[i]
    if line.startswith('```'):
        code=[];i+=1
        while i<len(lines) and not lines[i].startswith('```'):
            code.extend(textwrap.wrap(lines[i],width=92,replace_whitespace=False,drop_whitespace=False) or [''])
            i+=1
        story.append(Preformatted('\n'.join(code),styles['CodeSmall']))
    elif line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            if not re.match(r'^\|\s*-',lines[i]):rows.append([Paragraph(inline(cell.strip()),styles['Body']) for cell in lines[i].strip('|').split('|')])
            i+=1
        table=Table(rows,colWidths=[100,225,150],repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8f2f2')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#cbd9df')),('LEFTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7)]))
        story.append(table);story.append(Spacer(1,12));continue
    elif line.startswith('# '):
        story.append(Paragraph(inline(line[2:]),styles['Heading1']))
        story.append(Paragraph('Documentación técnica del entregable | 10 de octubre de 2026',styles['Body']))
    elif line.startswith('## '):story.append(Paragraph(inline(line[3:]),styles['Heading2']))
    elif line.startswith('- '):story.append(Paragraph(inline(line[2:]),styles['Body'],bulletText='•'))
    elif line.strip():story.append(Paragraph(inline(line),styles['Body']))
    i+=1
story.append(Paragraph('Validación realizada',styles['Heading2']))
story.append(Paragraph('47 pruebas de backend, incluidas agregaciones en PostgreSQL y permisos HTTP; 8 pruebas de frontend aprobadas. Lint y compilación de producción correctos. Los índices se aplicaron a la base de datos local.',styles['Body']))
story.append(Paragraph('Código y documentación en GitHub',styles['Heading2']))
story.append(Paragraph('Repositorio: <link href="https://github.com/TitanLopezz/Markettaller">github.com/TitanLopezz/Markettaller</link>. El código completo está en backend/src y frontend/src; las pruebas en backend/test. Este documento acompaña la implementación de la Actividad 2.6.',styles['Body']))

def footer(canvas,doc):
    canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#596e79'))
    canvas.drawString(60,35,'Actividad 2.6 | Dashboard y reportes analíticos')
    canvas.drawRightString(535,35,str(doc.page))

SimpleDocTemplate(str(OUTPUT),pagesize=(595,842),rightMargin=60,leftMargin=60,topMargin=48,bottomMargin=55,title='Actividad 2.6 - Dashboard de Métricas y Reportes Analíticos').build(story,onFirstPage=footer,onLaterPages=footer)
print(OUTPUT)
