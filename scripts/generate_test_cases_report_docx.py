#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador del Informe Formal en Word (.docx) de Casos de Prueba por Requisito Funcional (RF-01..RF-10)
y Revisión de Reportes por Requisito No Funcional (RNF-01..RNF-11).
Produce: docs/REPORTE_CASOS_DE_PRUEBA_RF_Y_AUDITORIA_RNF.docx
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from test_report_data import (
    METADATA,
    EXECUTION_KPIS,
    SUITES_SUMMARY,
    COVERAGE_BY_MODULE,
    RF_GROUPS,
    RNF_REPORTS_AUDIT,
)

BASE_DIR = os.path.dirname(SCRIPT_DIR)
DOCX_OUT = os.path.join(BASE_DIR, "docs", "REPORTE_CASOS_DE_PRUEBA_RF_Y_AUDITORIA_RNF.docx")

NAVY = RGBColor(26, 54, 93)
BLUE = RGBColor(43, 108, 176)
GREEN = RGBColor(39, 103, 73)
AMBER = RGBColor(183, 121, 31)
RED = RGBColor(197, 48, 48)
MUTED = RGBColor(100, 116, 139)
WHITE = RGBColor(255, 255, 255)


def set_cell_margins(cell, top=70, bottom=70, left=100, right=100):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f"</w:tcMar>"
    )
    tc_pr.append(tc_mar)


def set_cell_shading(cell, color_hex):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)


def set_cell_borders(cell, color="CBD5E0"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f"</w:tcBorders>"
    )
    tc_pr.append(borders)


def prevent_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))


def set_repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))


def add_styled_table(doc, headers, rows_data, widths, font_size=8.0, status_col=None):
    table = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_pr.append(parse_xml(f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>'))
    for col_idx, w in enumerate(widths):
        table.columns[col_idx].width = w

    hdr_row = table.rows[0]
    set_repeat_header(hdr_row)
    prevent_row_split(hdr_row)
    for col_idx, title in enumerate(headers):
        cell = hdr_row.cells[col_idx]
        cell.text = title
        cell.width = widths[col_idx]
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(1)
        r = p.runs[0]
        r.font.bold = True
        r.font.size = Pt(font_size + 0.5)
        r.font.color.rgb = WHITE
        set_cell_shading(cell, "1A365D")
        set_cell_margins(cell, 80, 80, 90, 90)
        set_cell_borders(cell, "1A365D")

    for r_idx, row_vals in enumerate(rows_data, 1):
        row = table.rows[r_idx]
        prevent_row_split(row)
        bg = "F7FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for col_idx, val in enumerate(row_vals):
            cell = row.cells[col_idx]
            cell.text = str(val)
            cell.width = widths[col_idx]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            r = p.runs[0]
            r.font.size = Pt(font_size)

            if col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY
            elif status_col is not None and col_idx == status_col:
                upper_v = str(val).upper()
                r.font.bold = True
                if "NO IMPLEMENTADO" in upper_v:
                    r.font.color.rgb = RED
                elif "PARCIAL" in upper_v or "HALLAZGO" in upper_v or "SIN BITÁCORA" in upper_v or "INCOMPLETO" in upper_v:
                    r.font.color.rgb = AMBER
                elif "PASÓ" in upper_v or "PASSED" in upper_v or "IMPLEMENTADO" in upper_v or "CONFORME" in upper_v or "APROBADO" in upper_v or "SUPERADO" in upper_v or "OPTIMO" in upper_v:
                    r.font.color.rgb = GREEN

            set_cell_shading(cell, bg)
            set_cell_margins(cell, 65, 65, 85, 85)
            set_cell_borders(cell)

    return table


def add_heading_styled(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    if h.runs:
        h.runs[0].font.color.rgb = NAVY if level == 1 else BLUE
    return h


def build_cover_and_metadata(doc):
    logo_path = os.path.join(BASE_DIR, "public", "assets", "logo.png")
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.add_run().add_picture(logo_path, width=Inches(1.1))

    p_org = doc.add_paragraph()
    p_org.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_org = p_org.add_run("EXPRESSMART MÉXICO · TIENDAEXPRESS ONLINE, S.A. DE C.V.")
    r_org.font.bold = True
    r_org.font.size = Pt(11)
    r_org.font.color.rgb = BLUE

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(8)
    r_title = p_title.add_run(
        "REPORTE INTEGRAL DE CASOS DE PRUEBA POR REQUISITO FUNCIONAL (RF-01 A RF-10)\n"
        "Y AUDITORÍA DE REPORTES POR REQUISITO NO FUNCIONAL (RNF-01 A RNF-11)"
    )
    r_title.font.bold = True
    r_title.font.size = Pt(16)
    r_title.font.color.rgb = NAVY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("Evidencia de Pruebas Automatizadas, Cobertura Jest y Verificación Normativa SGC MC-001 / ECTA-01")
    r_sub.font.italic = True
    r_sub.font.size = Pt(10.5)
    r_sub.font.color.rgb = MUTED

    doc.add_paragraph()

    meta_rows = [
        ("Código Documental", f"{METADATA['codigo']} (v{METADATA['version']})"),
        ("Organización", METADATA["empresa"]),
        ("Fecha de Ejecución y Emisión", METADATA["fecha"]),
        ("Marco Normativo", METADATA["normas"]),
        ("Suite Ejecutada", METADATA["comando_pruebas"]),
        ("Controles Complementarios", f"{METADATA['comando_sast']} · {METADATA['comando_audit']}"),
    ]
    add_styled_table(
        doc,
        ["Campo de Control", "Especificación Verificada"],
        meta_rows,
        [Inches(2.1), Inches(5.0)],
        font_size=9.0,
    )
    doc.add_page_break()


def build_execution_summary(doc):
    add_heading_styled(doc, "1. Resumen Ejecutivo de Ejecución Automatizada", level=1)
    p = doc.add_paragraph(
        "Se ejecutó la batería completa de pruebas automatizadas sobre ExpressMart integrando la nueva suite dedicada "
        "por Requisito Funcional (tests/rf-casos-prueba.test.js) junto con las suites de integración, seguridad y unidad. "
        "Todas las pruebas se ejecutaron en modo aislado (SQLite :memory:) posterior al último cambio en código."
    )
    p.paragraph_format.space_after = Pt(6)

    add_styled_table(
        doc,
        ["Indicador", "Resultado Medido", "Detalle de Verificación", "Dictamen"],
        EXECUTION_KPIS,
        [Inches(1.8), Inches(1.7), Inches(2.6), Inches(1.0)],
        font_size=8.5,
        status_col=3,
    )

    doc.add_paragraph()
    add_heading_styled(doc, "1.1 Desglose por Archivo de Suite de Pruebas", level=2)
    add_styled_table(
        doc,
        ["Archivo de Suite", "Propósito", "Tests", "Resultado", "Alcance Principal"],
        SUITES_SUMMARY,
        [Inches(1.7), Inches(1.8), Inches(0.6), Inches(1.1), Inches(1.9)],
        font_size=8.0,
        status_col=3,
    )

    doc.add_paragraph()
    add_heading_styled(doc, "1.2 Reporte de Cobertura de Código (Jest Coverage)", level=2)
    add_styled_table(
        doc,
        ["Archivo / Módulo", "% Stmts", "% Branch", "% Funcs", "% Lines", "Líneas no cubiertas / Nota"],
        COVERAGE_BY_MODULE,
        [Inches(2.1), Inches(0.75), Inches(0.8), Inches(0.75), Inches(0.75), Inches(1.95)],
        font_size=7.5,
    )
    doc.add_page_break()


def build_rf_section(doc):
    add_heading_styled(doc, "2. Reporte Detallado de Casos de Prueba por Requisito Funcional (RF-01 a RF-10)", level=1)
    doc.add_paragraph(
        "Cada Requisito Funcional del Manual de Calidad MC-001 cuenta ahora con casos de prueba positivos, negativos, "
        "de frontera y de autorización implementados de forma trazable en tests/rf-casos-prueba.test.js, vinculados "
        "además con la cobertura End-to-End (tests/integration.test.js), seguridad (tests/security.test.js) y unitaria (tests/unit.test.js)."
    )

    col_widths = [Inches(1.05), Inches(1.05), Inches(1.05), Inches(1.75), Inches(1.4), Inches(0.8)]
    headers = ["ID Caso", "Tipo / Escenario", "Precondiciones", "Pasos / Endpoint", "Resultado Esperado", "Estado"]

    for grp in RF_GROUPS:
        add_heading_styled(doc, f"{grp['id']}: {grp['nombre']} ({grp['prioridad']})", level=2)
        p_meta = doc.add_paragraph()
        p_meta.paragraph_format.space_after = Pt(4)
        r1 = p_meta.add_run(f"Almacén / Proceso DFD: ")
        r1.bold = True
        r1.font.size = Pt(8.5)
        r2 = p_meta.add_run(f"{grp['proceso_dfd']}  |  ")
        r2.font.size = Pt(8.5)
        r3 = p_meta.add_run("Módulos: ")
        r3.bold = True
        r3.font.size = Pt(8.5)
        r4 = p_meta.add_run(f"{grp['archivos']}\n")
        r4.font.size = Pt(8.5)
        r5 = p_meta.add_run(grp["descripcion"])
        r5.font.size = Pt(8.5)
        r5.font.color.rgb = MUTED

        add_styled_table(doc, headers, grp["casos"], col_widths, font_size=7.5, status_col=5)
        doc.add_paragraph()

    doc.add_page_break()


def build_rnf_audit_section(doc):
    add_heading_styled(doc, "3. Revisión de Reportes Implementados por Requisito No Funcional (RNF-01 a RNF-11)", level=1)
    doc.add_paragraph(
        "Se auditó el código fuente, los scripts de automatización (scripts/), las evidencias en disco (data/, reportes/, coverage/) "
        "y los respaldos documentales (../documentos_respaldo/) para determinar qué Requisitos No Funcionales cuentan ya con "
        "reportes automatizados o archivos generados dentro del repositorio activo (pauditoria/)."
    )

    summary_rows = [
        ("Implementados y operativos", "3 RNFs (RNF-04, RNF-05, RNF-09)", "Generan archivos verificables en coverage/, data/EV-34, data/EV-05 y reportes/*.txt."),
        ("Implementado con hallazgo activo", "1 RNF (RNF-02)", "data/EV-24 existe, pero corrida del 11/11/2026 tuvo 0 transacciones exitosas por login sin NODE_ENV=test."),
        ("Parciales / Solo API en vivo o consola", "4 RNFs (RNF-01, RNF-03, RNF-08, RNF-10)", "Hay endpoints o workflows, pero faltan reportes persistidos en data/ o archivos Docker en raíz activa."),
        ("No implementados como reporte en repo activo", "3 RNFs (RNF-06, RNF-07, RNF-11)", "Solo existen como matrices redactadas en ../documentos_respaldo/docs/04_Plan_y_Actas_de_Pruebas_Integrales.md."),
    ]
    add_styled_table(
        doc,
        ["Categoría de Cumplimiento", "Cantidad", "Observación Consolidada"],
        summary_rows,
        [Inches(2.0), Inches(1.9), Inches(3.2)],
        font_size=8.0,
    )

    doc.add_paragraph()
    add_heading_styled(doc, "3.1 Matriz Detallada de Reportes por RNF (RNF-01 a RNF-11)", level=2)
    rnf_widths = [Inches(0.65), Inches(1.15), Inches(1.15), Inches(1.05), Inches(1.55), Inches(1.55)]
    add_styled_table(
        doc,
        ["ID", "Requisito No Funcional", "Evidencia Exigida (MC-001)", "Estado Reporte", "Implementación Verificada", "Brecha / Hallazgo Detectado"],
        RNF_REPORTS_AUDIT,
        rnf_widths,
        font_size=7.3,
        status_col=3,
    )


def build_recommendations_and_signoff(doc):
    doc.add_paragraph()
    add_heading_styled(doc, "4. Hallazgos Clave y Acciones Recomendadas", level=1)

    recs = [
        "1. RNF-02 (scripts/performance-test.js): Ejecutar o ajustar el script de carga fijando NODE_ENV=test (o completando el paso 2FA en login) para regenerar data/EV-24_Informe_Pruebas_Rendimiento.json con 100/100 transacciones exitosas y cumpleSinSobreventa=true.",
        "2. RNF-03 (EV-18 y SAST): Ejecutar node scripts/verify-auth-sessions.js para materializar EV-18 en pauditoria/data/ y actualizar scripts/static-analysis.js para persistir un informe JSON/TXT en data/ o reportes/ además de la salida en consola.",
        "3. RNF-01, RNF-06, RNF-07, RNF-08, RNF-10 y RNF-11: Incorporar scripts generadores de reportes periódicos (disponibilidad mensual desde /api/metrics, checklist automatizado WCAG/compatibilidad, bitácora exportada de CI/CD y métricas de pasos de checkout), y sincronizar Dockerfile / docker-compose.yml hacia la raíz de pauditoria/.",
        "4. Trazabilidad RF-11+: En tests/integration.test.js existían etiquetas duplicadas (CP-RF-12 y CP-RF-13 repetidos) y ausencia de CP-RF-11; la nueva suite tests/rf-casos-prueba.test.js normaliza la nomenclatura RF-01-CP01..RF-10-CP02 cubriendo el 100% del catálogo funcional vigente.",
    ]
    for item in recs:
        p = doc.add_paragraph(item, style="List Bullet")
        p.paragraph_format.space_after = Pt(4)
        for r in p.runs:
            r.font.size = Pt(9.0)

    doc.add_paragraph()
    add_heading_styled(doc, "5. Dictamen Técnico de Calidad", level=1)
    p_dic = doc.add_paragraph()
    r_dic = p_dic.add_run(
        "DICTAMEN DE PRUEBAS FUNCIONALES (RF-01 a RF-10): APROBADO (61/61 pruebas automatizadas pasando, 90.35% cobertura de sentencias, 0 hallazgos SAST).\n"
        "DICTAMEN DE REPORTES NO FUNCIONALES (RNF-01 a RNF-11): CUMPLIMIENTO PARCIAL VERIFICADO — 3 RNFs cuentan con reporte automatizado activo (RNF-04, RNF-05, RNF-09), "
        "1 RNF con reporte pero hallazgo en última corrida (RNF-02), 4 RNFs parciales sin exportación a archivo y 3 RNFs documentados únicamente en respaldo externo."
    )
    r_dic.font.bold = True
    r_dic.font.size = Pt(9.5)
    r_dic.font.color.rgb = NAVY


def generate_docx():
    doc = docx.Document()
    normal_style = doc.styles["Normal"]
    normal_style.font.name = "Calibri"
    normal_style.font.size = Pt(9.5)

    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)
        section.header.is_linked_to_previous = False
        section.footer.is_linked_to_previous = False

        hp = section.header.paragraphs[0]
        hp.text = "ExpressMart México | Reporte de Casos de Prueba RF y Auditoría de Reportes RNF"
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hp.runs[0].font.size = Pt(8.0)
        hp.runs[0].font.color.rgb = MUTED

        fp = section.footer.paragraphs[0]
        fp.text = "SGC MC-001 v1.0 · Plan ECTA-01 · Documento Confidencial de QA y Auditoría"
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.runs[0].font.size = Pt(8.0)
        fp.runs[0].font.color.rgb = MUTED

    build_cover_and_metadata(doc)
    build_execution_summary(doc)
    build_rf_section(doc)
    build_rnf_audit_section(doc)
    build_recommendations_and_signoff(doc)

    os.makedirs(os.path.dirname(DOCX_OUT), exist_ok=True)
    doc.save(DOCX_OUT)
    print(f"Documento Word generado exitosamente en: {DOCX_OUT}")


if __name__ == "__main__":
    generate_docx()
