#!/usr/bin/env python3
"""
Conversor automatizado de documentos Markdown (.md) a formato Microsoft Word (.docx)
con formato ejecutivo conforme al Manual de Calidad ExpressMart (MC-001) y Plan de Auditoría (ECTA-01).
"""

import os
import re
from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def set_cell_shading(cell, fill_hex: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tc_pr.append(shd)


def clean_inline_markdown(text: str) -> str:
    # Convert markdown links [label](url) -> label
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Convert LaTeX math symbols to readable text
    text = (
        text.replace(r'\rightarrow', '->')
        .replace(r'\le', '<=')
        .replace(r'\ge', '>=')
        .replace(r'\parallel', ' || ')
        .replace(r'\text{', '')
        .replace('$$', '')
        .replace('$', '')
    )
    return text.strip()


def add_formatted_runs(paragraph, text: str):
    text = clean_inline_markdown(text)
    tokens = re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text)
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith('**') and tok.endswith('**'):
            run = paragraph.add_run(tok[2:-2])
            run.bold = True
        elif tok.startswith('`') and tok.endswith('`'):
            run = paragraph.add_run(tok[1:-1])
            run.font.name = 'Courier New'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0xA3, 0x39, 0x00)
        else:
            paragraph.add_run(tok)


def render_table(doc: Document, table_rows: list[list[str]]):
    if not table_rows:
        return
    num_cols = max(len(r) for r in table_rows)
    table = doc.add_table(rows=len(table_rows), cols=num_cols)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for r_idx, row_data in enumerate(table_rows):
        row = table.rows[r_idx]
        for c_idx in range(num_cols):
            val = row_data[c_idx] if c_idx < len(row_data) else ''
            cell = row.cells[c_idx]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_runs(p, val)

            for run in p.runs:
                run.font.size = Pt(9.5)
                if r_idx == 0:
                    run.bold = True
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            if r_idx == 0:
                set_cell_shading(cell, '0F172A')
            elif r_idx % 2 == 1:
                set_cell_shading(cell, 'F8F9FF')

    doc.add_paragraph()


def convert_md_to_docx(md_path: Path, docx_path: Path):
    doc = Document()

    # Configure page margins
    for section in doc.sections:
        section.top_margin = Inches(0.85)
        section.bottom_margin = Inches(0.85)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(0x0B, 0x1C, 0x30)

    lines = md_path.read_text(encoding='utf-8').splitlines()
    in_code_block = False
    code_lines: list[str] = []
    table_buffer: list[list[str]] = []

    def flush_table():
        nonlocal table_buffer
        if table_buffer:
            render_table(doc, table_buffer)
            table_buffer = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            tbl = doc.add_table(rows=1, cols=1)
            tbl.style = 'Table Grid'
            cell = tbl.rows[0].cells[0]
            set_cell_shading(cell, 'EFF4FF')
            p = cell.paragraphs[0]
            run = p.add_run('\n'.join(code_lines))
            run.font.name = 'Courier New'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
            doc.add_paragraph()
            code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip()

        if line.strip().startswith('```'):
            flush_table()
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                flush_code()
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        # Table detection
        if line.strip().startswith('|') and line.strip().endswith('|'):
            cells = [c.strip() for c in line.strip()[1:-1].split('|')]
            # Skip separator row like |---|---|
            if all(re.match(r'^:?-{2,}:?$', c) for c in cells if c):
                continue
            table_buffer.append(cells)
            continue
        else:
            flush_table()

        if not line.strip() or line.strip() == '---':
            continue

        # Headings
        if line.startswith('# '):
            h = doc.add_heading(clean_inline_markdown(line[2:]), level=1)
            for r in h.runs:
                r.font.color.rgb = RGBColor(0xA3, 0x39, 0x00)
        elif line.startswith('## '):
            h = doc.add_heading(clean_inline_markdown(line[3:]), level=2)
            for r in h.runs:
                r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        elif line.startswith('### '):
            h = doc.add_heading(clean_inline_markdown(line[4:]), level=3)
            for r in h.runs:
                r.font.color.rgb = RGBColor(0x00, 0x69, 0x48)
        elif re.match(r'^\s*[-*]\s+', line):
            bullet_text = re.sub(r'^\s*[-*]\s+', '', line)
            p = doc.add_paragraph(style='List Bullet')
            add_formatted_runs(p, bullet_text)
        elif re.match(r'^\s*\d+\.\s+', line):
            num_text = re.sub(r'^\s*\d+\.\s+', '', line)
            p = doc.add_paragraph(style='List Number')
            add_formatted_runs(p, num_text)
        else:
            p = doc.add_paragraph()
            add_formatted_runs(p, line)

    flush_table()
    flush_code()

    docx_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(docx_path))
    print(f"[OK] Generado: {docx_path}")


def main():
    root = Path(__file__).resolve().parent.parent
    docs_dir = root / 'docs'

    md_files = sorted(docs_dir.glob('*.md'))
    for md_file in md_files:
        out_docx = docs_dir / f"{md_file.stem}.docx"
        convert_md_to_docx(md_file, out_docx)

    # Convert root README.md as well and place a copy of the Installation & App Usage Manual in root
    readme_md = root / 'README.md'
    if readme_md.exists():
        convert_md_to_docx(readme_md, docs_dir / '00_README_General_ExpressMart.docx')

    manual_inst_md = docs_dir / '07_Manual_Instalacion_BaseDatos_y_Uso_App.md'
    if manual_inst_md.exists():
        convert_md_to_docx(manual_inst_md, root / 'Manual_Instalacion_BaseDatos_y_Uso_ExpressMart.docx')

    politica_bd_md = docs_dir / '06_Politica_Integral_de_Base_de_Datos.md'
    if politica_bd_md.exists():
        convert_md_to_docx(politica_bd_md, root / 'Politica_Integral_de_Base_de_Datos_ExpressMart.docx')


if __name__ == '__main__':
    main()
