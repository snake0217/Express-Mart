#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador del Guion Oficial en PDF para Demostración, Base de Datos y Herramientas ExpressMart.
Conforme a SGC MC-001 v1.0, ISO/IEC 25010, ISO/IEC 27001, LFPDPPP y PCI DSS.
Autor: Diego Alarcón (Desarrollador Principal y Administrador de Plataforma).
"""

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_OUTPUT = os.path.join(BASE_DIR, "GUION_DEMOSTRACION_Y_SISTEMA_EXPRESSMART_DIEGO.pdf")

# Paleta Corporativa ExpressMart "Aura Commerce"
C_NAVY_DARK = colors.HexColor("#0b1c30")
C_BLUE_PRIMARY = colors.HexColor("#1d4e9a")
C_BLUE_LIGHT = colors.HexColor("#e0e7ff")
C_GOLD = colors.HexColor("#f59e0b")
C_GOLD_LIGHT = colors.HexColor("#fef3c7")
C_TEXT_DARK = colors.HexColor("#0f172a")
C_TEXT_MUTED = colors.HexColor("#475569")
C_BORDER = colors.HexColor("#cbd5e1")
C_BG_LIGHT = colors.HexColor("#f8fafc")
C_BG_CODE = colors.HexColor("#0f172a")
C_TEXT_CODE = colors.HexColor("#38bdf8")
C_SUCCESS = colors.HexColor("#047857")
C_SUCCESS_BG = colors.HexColor("#ecfdf5")
C_WHITE = colors.HexColor("#ffffff")


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para numeración dinámica 'Página X de Y' y encabezado/pie institucional."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        w, h = letter
        
        # Omitir encabezado en portada (página 1)
        if self._pageNumber > 1:
            # Encabezado
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(C_BLUE_PRIMARY)
            self.drawString(45, h - 34, "EXPRESSMART MÉXICO")
            self.setFont("Helvetica", 8)
            self.setFillColor(C_TEXT_MUTED)
            self.drawString(145, h - 34, "· Guion Maestro de Demostración, Consultas de Base de Datos y Suite de Herramientas")
            self.setStrokeColor(C_BORDER)
            self.setLineWidth(0.6)
            self.line(45, h - 40, w - 45, h - 40)
            
            # Pie de página
            self.line(45, 42, w - 45, 42)
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(C_TEXT_DARK)
            self.drawString(45, 30, "Diego Alarcón")
            self.setFont("Helvetica", 8)
            self.setFillColor(C_TEXT_MUTED)
            self.drawString(110, 30, "· Desarrollador Principal y Administrador · SGC MC-001 v1.0")
            
            page_str = f"Página {self._pageNumber} de {page_count}"
            self.drawRightString(w - 45, 30, page_str)
        else:
            # Pie en portada
            self.setFont("Helvetica", 8)
            self.setFillColor(C_TEXT_MUTED)
            self.drawCentredString(w / 2.0, 30, "Confidencial y Exclusivo · ExpressMart E-Commerce S.A. de C.V. México · 2026")
            
        self.restoreState()


def build_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='CoverPreTitle',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=C_GOLD,
        alignment=TA_CENTER,
        textTransform='uppercase',
        spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=C_NAVY_DARK,
        alignment=TA_CENTER,
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        name='CoverSubTitle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=C_BLUE_PRIMARY,
        alignment=TA_CENTER,
        spaceAfter=20
    ))
    styles.add(ParagraphStyle(
        name='CoverMeta',
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=C_TEXT_DARK,
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='SectionHeading',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=C_NAVY_DARK,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='SubSectionHeading',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=C_BLUE_PRIMARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='BodyJustify',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT_DARK,
        alignment=TA_JUSTIFY,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name='BodyBold',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=C_TEXT_DARK
    ))
    styles.add(ParagraphStyle(
        name='BulletItem',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT_DARK,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        name='CodeSnippet',
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=C_TEXT_CODE
    ))
    styles.add(ParagraphStyle(
        name='CodeSnippetLight',
        fontName='Courier-Bold',
        fontSize=8.5,
        leading=11,
        textColor=C_NAVY_DARK
    ))
    styles.add(ParagraphStyle(
        name='CalloutText',
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=C_NAVY_DARK
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=C_WHITE,
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=C_TEXT_DARK
    ))
    styles.add(ParagraphStyle(
        name='TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=C_TEXT_DARK
    ))
    styles.add(ParagraphStyle(
        name='TableCellCenter',
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=C_TEXT_DARK,
        alignment=TA_CENTER
    ))
    
    return styles


def create_callout(text, styles, bg_color=C_BG_LIGHT, border_color=C_BLUE_PRIMARY, title=None):
    story_parts = []
    if title:
        story_parts.append(Paragraph(f"<b>{title}</b>", styles['BodyBold']))
        story_parts.append(Spacer(1, 3))
    story_parts.append(Paragraph(text, styles['CalloutText']))
    
    box = Table([[story_parts]], colWidths=[522])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('BOX', (0, 0), (-1, -1), 1, border_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return box


def create_code_box(code_text, styles, title=None, dark=True):
    lines = code_text.strip().split('\n')
    formatted = "<br/>".join([line.replace(" ", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;") for line in lines])
    
    p_style = styles['CodeSnippet'] if dark else styles['CodeSnippetLight']
    p = Paragraph(formatted, p_style)
    
    content = []
    if title:
        title_p = Paragraph(f"<b>{title}</b>", styles['BodyBold'] if not dark else styles['CoverPreTitle'])
        content.append(title_p)
        content.append(Spacer(1, 4))
    content.append(p)
    
    t = Table([[content]], colWidths=[522])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_BG_CODE if dark else C_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, C_NAVY_DARK if dark else C_BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def generate_pdf():
    doc = SimpleDocTemplate(
        PDF_OUTPUT,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=48,
        bottomMargin=48
    )
    
    styles = build_styles()
    story = []
    
    # =========================================================================
    # PORTADA INSTITUCIONAL
    # =========================================================================
    story.append(Spacer(1, 25))
    story.append(Paragraph("SISTEMA DE GESTIÓN DE CALIDAD Y AUDITORÍA · SGC MC-001 v1.0", styles['CoverPreTitle']))
    story.append(Paragraph("GUION MAESTRO DE DEMOSTRACIÓN, AUDITORÍA Y ARQUITECTURA TÉCNICA", styles['CoverTitle']))
    story.append(Paragraph("Guía Integral de Defensa Técnica, Consultas de Base de Datos y Suite de Herramientas", styles['CoverSubTitle']))
    
    story.append(HRFlowable(width="100%", thickness=2, color=C_BLUE_PRIMARY, spaceBefore=4, spaceAfter=18))
    
    # Tarjeta de Datos Clave
    meta_table_data = [
        [
            Paragraph("<b>Plataforma:</b>", styles['TableCellBold']),
            Paragraph("ExpressMart Marketplace México (Arquitectura Fullstack Modular)", styles['TableCell']),
            Paragraph("<b>Autor y Expositor:</b>", styles['TableCellBold']),
            Paragraph("<b>Diego Alarcón</b> (Dev Lead & Admin)", styles['TableCell'])
        ],
        [
            Paragraph("<b>Rama Oficial:</b>", styles['TableCellBold']),
            Paragraph("<code>release/v1.0.0</code> y <code>main</code> (Sincronizadas)", styles['TableCell']),
            Paragraph("<b>Rol en Demostración:</b>", styles['TableCellBold']),
            Paragraph("Administrador y Desarrollador Principal", styles['TableCell'])
        ],
        [
            Paragraph("<b>Cobertura Pruebas:</b>", styles['TableCellBold']),
            Paragraph("<b>100% de Pruebas Aprobadas</b> (63/63 casos)", styles['TableCell']),
            Paragraph("<b>Auditoría ECTA-01:</b>", styles['TableCellBold']),
            Paragraph("<b>100% de Cumplimiento</b> (43/43 puntos)", styles['TableCell'])
        ],
        [
            Paragraph("<b>Estándares:</b>", styles['TableCellBold']),
            Paragraph("ISO/IEC 25010, ISO 27001, LFPDPPP, PCI DSS", styles['TableCell']),
            Paragraph("<b>Motor de BD:</b>", styles['TableCellBold']),
            Paragraph("SQLite Nativo Criptoseguro (<code>node:sqlite</code>)", styles['TableCell'])
        ]
    ]
    t_meta = Table(meta_table_data, colWidths=[90, 171, 95, 166])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))
    
    # Resumen Ejecutivo de la Guía
    intro_callout = (
        "<b>PROPÓSITO DE ESTE DOCUMENTO:</b> Proveer al desarrollador <b>Diego Alarcón</b> un guion "
        "exhaustivo, estructurado y de alto impacto para la entrevista técnica y auditoría del proyecto "
        "ExpressMart. Incluye el discurso de presentación, el catálogo de 12 consultas SQL listas para "
        "ejecutar en terminal, el uso de la suite de 7 herramientas desarrolladas (consolas interactivas, "
        "paneles GUI en Python/Tkinter, linters SAST, verificadores de auditoría y proxy local de logística), "
        "y la justificación técnica de las soluciones implementadas."
    )
    story.append(create_callout(intro_callout, styles, bg_color=C_GOLD_LIGHT, border_color=C_GOLD))
    story.append(Spacer(1, 15))
    
    # Tabla de Credenciales Rápidas para Demostración en Vivo
    story.append(Paragraph("Credenciales Maestras de Demostración y Acceso a Roles", styles['SubSectionHeading']))
    creds_data = [
        [Paragraph("Rol", styles['TableHeader']), Paragraph("Usuario / Correo", styles['TableHeader']), Paragraph("Contraseña", styles['TableHeader']), Paragraph("Autenticación 2FA / Permisos", styles['TableHeader'])],
        [
            Paragraph("<b>Administrador (Diego)</b>", styles['TableCell']),
            Paragraph("<code>admin@expressmart.mx</code>", styles['TableCell']),
            Paragraph("<code>AdminPassword123!</code>", styles['TableCell']),
            Paragraph("2FA activado (Nodemailer TOTP dinámico en modal). Control total de plataforma.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Auditor Líder</b>", styles['TableCell']),
            Paragraph("<code>auditor@expressmart.mx</code>", styles['TableCell']),
            Paragraph("<code>AuditorPassword123!</code>", styles['TableCell']),
            Paragraph("Acceso directo. Pestaña de Auditoría ECTA-01, logs inmutables y matriz SGC.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Vendedor</b>", styles['TableCell']),
            Paragraph("<code>vendedor@expressmart.mx</code>", styles['TableCell']),
            Paragraph("<code>VendedorPassword123!</code>", styles['TableCell']),
            Paragraph("Panel exclusivo de vendedor, productos propios, cobro y tarjeta receptora.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Cliente Comprador</b>", styles['TableCell']),
            Paragraph("<code>cliente@expressmart.mx</code>", styles['TableCell']),
            Paragraph("<code>ClientePassword123!</code>", styles['TableCell']),
            Paragraph("Catálogo Aura Commerce, compras con tarjetas simuladas, PayPal Sandbox, OSM.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Soporte Técnico</b>", styles['TableCell']),
            Paragraph("<code>soporte@expressmart.mx</code>", styles['TableCell']),
            Paragraph("<code>SoportePassword123!</code>", styles['TableCell']),
            Paragraph("Atención a incidencias, revisión de devoluciones y seguimiento de envíos.", styles['TableCell'])
        ]
    ]
    t_creds = Table(creds_data, colWidths=[105, 125, 115, 177])
    t_creds.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_BG_LIGHT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_creds)
    story.append(PageBreak())
    
    # =========================================================================
    # SECCIÓN 1: PITCH DE ENTRADA Y ROL DE DIEGO EN LA ENTREVISTA
    # =========================================================================
    story.append(Paragraph("1. ESTRATEGIA DE PRESENTACIÓN Y RESPUESTAS DEL DESARROLLADOR", styles['SectionHeading']))
    story.append(Paragraph(
        "En la entrevista o sesión de auditoría, Diego debe proyectar dominio completo de la arquitectura, "
        "seguridad defensiva, gestión de datos y rigor de pruebas. A continuación se define el guion verbal "
        "de apertura y la postura recomendada:", styles['BodyJustify']
    ))
    
    pitch_text = (
        "<b>Pitch Verbal de 90 Segundos para Diego:</b><br/>"
        "<i>«Buenos días / tardes a todos. Mi nombre es <b>Diego Alarcón</b> y me desempeñé como Desarrollador Principal "
        "y Administrador de la plataforma de comercio electrónico <b>ExpressMart México</b>.<br/>"
        "Nuestro objetivo fue concebir una arquitectura de software robusta, desacoplada y 100% auditable, conforme "
        "a las normativas ISO/IEC 25010 (Calidad de Software), ISO/IEC 27001 (Seguridad de la Información), LFPDPPP "
        "para la protección de datos personales en México y estándares PCI DSS para transacciones simuladas.<br/>"
        "En este proyecto diseñé e implementé desde el backend modular en Node.js y SQLite nativo criptoseguro, "
        "hasta la suite completa de herramientas administrativas y de monitoreo en Python y Bash, pasando por una "
        "experiencia web moderna estilo Aura Commerce con geolocalización OpenStreetMap, doble factor de autenticación "
        "2FA, bitácora de auditoría inmutable con encadenamiento SHA-256 y una suite de pruebas automatizadas con 63/63 "
        "casos aprobados y 0 vulnerabilidades en análisis estático SAST. A continuación les mostraré cómo opera el sistema "
        "tanto a nivel de código como directamente en la base de datos y paneles de gestión.»</i>"
    )
    story.append(create_callout(pitch_text, styles, bg_color=C_BLUE_LIGHT, border_color=C_BLUE_PRIMARY))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("¿Qué debe enfatizar Diego ante cada perfil de auditor / evaluador?", styles['SubSectionHeading']))
    story.append(Paragraph("• <b>Ante el Auditor de Seguridad (ISO 27001 / OWASP):</b> Demostrar el cifrado PBKDF2/SHA-256 con salt dinámico, protección contra fuerza bruta (bloqueo automático tras 5 intentos fallidos por 15 minutos), 2FA mediante Nodemailer con código de rescate para contingencias, cabeceras HTTP reforzadas con Content-Security-Policy estricta y encadenamiento criptográfico en la tabla <code>bitacora_auditoria</code>.", styles['BulletItem']))
    story.append(Paragraph("• <b>Ante el Auditor de Datos y Calidad (ISO 25012 / LFPDPPP):</b> Explicar la normalización de la base de datos (3FN), integridad referencial activa (<code>PRAGMA foreign_keys = ON</code>), aislamiento estricto de carritos y favoritos por identificador de usuario, ejercicio de Derechos ARCO y enmascaramiento de plásticos de pago (<code>•••• 1234</code>).", styles['BulletItem']))
    story.append(Paragraph("• <b>Ante el Evaluador Funcional / Negocio:</b> Exhibir el flujo de compra fluido en 3 pasos, el motor de cálculo de impuestos (IVA 16%), mensualidades a 12 MSI, cupones de descuento, selector geográfico OpenStreetMap con asignación automática de CEDIS, zoom 2.3x interactivo y el dashboard exclusivo de vendedor para gestión de cobro.", styles['BulletItem']))
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECCIÓN 2: ACCESO A LA BASE DE DATOS Y CONSULTAS SQL ÚTILES
    # =========================================================================
    story.append(Paragraph("2. ACCESO A LA BASE DE DATOS Y CATÁLOGO DE CONSULTAS SQL ÚTILES", styles['SectionHeading']))
    story.append(Paragraph(
        "ExpressMart implementa una base de datos relacional basada en SQLite nativo de alto desempeño "
        "(<code>node:sqlite</code> / <code>DatabaseSync</code>), ubicada en el archivo persistente "
        "<code>data/expressmart.sqlite</code>. Para interactuar con la base de datos sin depender de interfaces "
        "gráficas pesadas, Diego cuenta con dos vías inmediatas en terminal:", styles['BodyJustify']
    ))
    
    # Modos de acceso
    access_cmd = (
        "# Opción A: Consola Interactiva SQL oficial desarrollada para ExpressMart (Recomendada):\n"
        "node scripts/db-console.js\n\n"
        "# Ejecutar un comando especial directo:\n"
        "node scripts/db-console.js .tablas     # Lista las 19 tablas y número de registros\n"
        "node scripts/db-console.js .kpis       # Resumen ejecutivo de ventas y stock en MXN\n"
        "node scripts/db-console.js .schema catalogo  # Muestra el DDL de la tabla\n\n"
        "# Opción B: Cliente SQLite3 estándar de Linux:\n"
        "sqlite3 data/expressmart.sqlite"
    )
    story.append(create_code_box(access_cmd, styles, title="COMANDOS DE CONEXIÓN A LA BASE DE DATOS", dark=True))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Catálogo Maestro de 12 Consultas SQL de Alto Impacto", styles['SubSectionHeading']))
    story.append(Paragraph(
        "Estas consultas demuestran conocimiento técnico profundo, integridad transaccional y control "
        "operativo de la plataforma:", styles['BodyJustify']
    ))
    
    queries = [
        (
            "1. Usuarios, roles de acceso y estado del 2FA (Seguridad RBAC)",
            "SELECT id, nombre, email, rol, mfa_enabled, activo, datetime(created_at, 'localtime') AS fecha_registro\nFROM usuarios ORDER BY id ASC;",
            "Demuestra el control de acceso basado en roles (administrador, auditor, vendedor, cliente, soporte) y qué cuentas tienen forzada la verificación en dos pasos."
        ),
        (
            "2. Resumen ejecutivo de inventario agrupado por Almacén / CEDIS",
            "SELECT a.codigo, a.nombre AS cedis, a.ciudad,\n       COUNT(p.id) AS total_productos,\n       COALESCE(SUM(i.stock_disponible), 0) AS stock_total_unidades,\n       '$' || printf('%,d', COALESCE(SUM(p.precio * i.stock_disponible), 0)) || ' MXN' AS valor_inventario\nFROM almacenes a\nLEFT JOIN productos p ON a.id = p.almacen_id\nLEFT JOIN inventario i ON p.id = i.producto_id\nGROUP BY a.id;",
            "Evidencia la descentralización logística en 5 CEDIS (CDMX Norte, CDMX Oriente, Guadalajara, Monterrey, Puebla) y el valor del stock en MXN."
        ),
        (
            "3. Top productos más cotizados con cálculo de mensualidades (12 MSI)",
            "SELECT c.sku, c.nombre, c.categoria, c.marca,\n       '$' || printf('%,d', c.precio) || ' MXN' AS precio_contado,\n       '$' || printf('%.2f', c.precio / 12.0) || ' MXN' AS mensualidad_12_msi,\n       i.stock_disponible\nFROM catalogo c\nJOIN inventario i ON c.id = i.producto_id\nWHERE c.activo = 1\nORDER BY c.precio DESC LIMIT 6;",
            "Comprueba que el catálogo opera en pesos mexicanos con reglas comerciales reales y existencias sincronizadas con el inventario."
        ),
        (
            "4. Bitácora de auditoría inmutable con hash encadenado SHA-256 (RFC-0017)",
            "SELECT id, evento, usuario_email, rol, ip,\n       substr(hash_cadena, 1, 16) || '...' || substr(hash_cadena, -8) AS hash_sha256,\n       datetime(timestamp, 'localtime') AS fecha\nFROM bitacora_auditoria ORDER BY id DESC LIMIT 6;",
            "Punto clave para la defensa ante auditores ISO 27001: cada registro genera un hash SHA-256 incorporando el hash del registro anterior, impidiendo cualquier alteración de registros históricos."
        ),
        (
            "5. Auditoría de pedidos, clientes, método de pago y guías de envío",
            "SELECT p.folio, u.nombre AS cliente,\n       '$' || printf('%,d', p.total) || ' MXN' AS total_pagado,\n       p.metodo_pago, p.estado,\n       e.proveedor_paqueteria, e.numero_guia\nFROM pedidos p\nJOIN usuarios u ON p.usuario_id = u.id\nLEFT JOIN envios e ON p.id = e.pedido_id\nORDER BY p.id DESC LIMIT 5;",
            "Muestra la trazabilidad integral de compras, desde la orden en checkout hasta la generación de guía de rastreo para el repartidor."
        ),
        (
            "6. Tarjetas simuladas, saldos y plásticos asignados a usuarios",
            "SELECT t.id, u.nombre AS titular, t.marca,\n       '•••• ' || substr(replace(t.numero_tarjeta, ' ', ''), -4) AS tarjeta_enmascarada,\n       t.color_plastico, '$' || printf('%,d', t.saldo) || ' MXN' AS saldo_disponible\nFROM tarjetas_simuladas t\nJOIN usuarios u ON t.usuario_id = u.id\nORDER BY t.saldo DESC;",
            "Cumple con PCI DSS al enmascarar los dígitos del plástico y refleja el balance financiero de pruebas para compras y cobros de vendedor."
        )
    ]
    
    for title, sql, impact in queries:
        story.append(Paragraph(f"<b>{title}</b>", styles['BodyBold']))
        story.append(Paragraph(f"<i>Propósito en la auditoría:</i> {impact}", styles['BodyJustify']))
        story.append(create_code_box(sql, styles, dark=True))
        story.append(Spacer(1, 6))
        
    story.append(PageBreak())
    
    # Continuación de consultas 7 a 12
    queries_part2 = [
        (
            "7. Solicitudes de reembolso con ventana de motivo y estado de devolución",
            "SELECT r.id, r.pedido_id, r.usuario_id,\n       substr(r.motivo, 1, 45) || '...' AS motivo_resumido,\n       r.estado, '$' || printf('%,d', r.monto) || ' MXN' AS monto,\n       datetime(r.created_at, 'localtime') AS fecha_solicitud\nFROM solicitudes_reembolso r\nORDER BY r.id DESC LIMIT 5;",
            "Verifica la funcionalidad solicitada: cuando un cliente pide reembolso, el motivo queda registrado con detalle y pasa a aprobación/rechazo en panel admin."
        ),
        (
            "8. Cupones de descuento activos, compras mínimas y límite de usos",
            "SELECT codigo, tipo, valor, '$' || printf('%,d', compra_minima) || ' MXN' AS min_compra,\n       usos_actuales || ' / ' || limite_usos AS consumo_usos, activo\nFROM cupones;",
            "Evidencia las promociones comerciales activas en checkout (BIENVENIDO10, EXPRESS20, PRIME50, BUENFIN)."
        ),
        (
            "9. Transacciones financieras registradas y desglose de IVA 16%",
            "SELECT id, pedido_id, metodo_pago,\n       '$' || printf('%.2f', monto_bruto) || ' MXN' AS subtotal,\n       '$' || printf('%.2f', monto_iva) || ' MXN' AS iva_16,\n       '$' || printf('%.2f', monto_total) || ' MXN' AS total_neto,\n       estado, datetime(fecha, 'localtime') AS fecha_hora\nFROM transacciones ORDER BY id DESC LIMIT 5;",
            "Demuestra el cumplimiento fiscal del desglose del Impuesto al Valor Agregado del 16% en cada transacción realizada."
        ),
        (
            "10. Sesiones activas y control de inactividad de 15 minutos (RNF-08)",
            "SELECT s.id, u.nombre, u.email,\n       s.ip_address, s.user_agent,\n       datetime(s.ultimo_acceso, 'localtime') AS ultimo_ping,\n       datetime(s.expira_en, 'localtime') AS expira\nFROM sesiones s\nJOIN usuarios u ON s.usuario_id = u.id\nWHERE s.activa = 1 ORDER BY s.ultimo_acceso DESC LIMIT 5;",
            "Acredita la expiración automática de sesiones tras 15 minutos de inactividad conforme a la directiva de seguridad bancaria."
        ),
        (
            "11. Verificación de integridad física de la base de datos (Pragmas SQLite)",
            "PRAGMA integrity_check;\nPRAGMA foreign_key_check;\nPRAGMA quick_check;",
            "Permite a Diego demostrar en vivo que la base de datos se encuentra al 100% íntegra, sin páginas corruptas ni claves foráneas huérfanas."
        ),
        (
            "12. Inspección de índices para optimización de consultas en Catálogo",
            "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('catalogo', 'inventario', 'pedidos');",
            "Prueba que las búsquedas por SKU, categoría y precio están indexadas para garantizar tiempos de respuesta menores a 100 ms (RNF-01)."
        )
    ]
    
    for title, sql, impact in queries_part2:
        story.append(Paragraph(f"<b>{title}</b>", styles['BodyBold']))
        story.append(Paragraph(f"<i>Propósito en la auditoría:</i> {impact}", styles['BodyJustify']))
        story.append(create_code_box(sql, styles, dark=True))
        story.append(Spacer(1, 6))
        
    story.append(PageBreak())
    
    # =========================================================================
    # SECCIÓN 3: SUITE DE HERRAMIENTAS DESARROLLADAS EN EL PROYECTO
    # =========================================================================
    story.append(Paragraph("3. SUITE COMPLETA DE HERRAMIENTAS Y SCRIPTS OPERATIVOS", styles['SectionHeading']))
    story.append(Paragraph(
        "Uno de los logros más destacados de la implementación realizada por Diego es la suite integral de herramientas "
        "desarrolladas exprofeso para el proyecto. Cada herramienta resuelve una necesidad específica de auditoría, "
        "monitoreo, mantenimiento o demostración:", styles['BodyJustify']
    ))
    
    tools = [
        {
            "name": "Herramienta 1: Panel de Seguridad y Monitoreo (ISO 27001 / OWASP)",
            "exec": "bash scripts/security_panel.sh       # Interfaz gráfica Tkinter\npython3 scripts/security_panel.py --cli  # Modo interactivo en terminal",
            "desc": "Panel integral con 5 pestañas: (1) Puertos y servicios de red activos, (2) Detección de actividades sospechosas e intentos de fuerza bruta, (3) Inspección de bitácora D8, (4) Verificación criptográfica SHA-256 de integridad de datos, y (5) Consola de ejecución de pruebas Jest en tiempo real.",
            "value": "Demuestra cumplimiento proactivo de ciberseguridad sin requerir herramientas externas de terceros."
        },
        {
            "name": "Herramienta 2: Panel Administrativo, Financiero y de Cuentas (GUI/CLI)",
            "exec": "bash scripts/run_admin_panel.sh       # GUI oficial\npython3 scripts/admin_panel.py --cli   # Modo CLI",
            "desc": "Orquestador de 7 módulos: Balance financiero global de ExpressMart, administración de cuentas del sistema, creación de usuarios privilegiados, recarga y asignación de tarjetas simuladas, resolución de solicitudes de reembolso con registro de motivo, log de ventas y panel de logística con almacenes.",
            "value": "Centraliza la operación comercial y de gobierno corporativo bajo el Manual SGC MC-001 v1.0."
        },
        {
            "name": "Herramienta 3: Consola Interactiva de Base de Datos SQL",
            "exec": "node scripts/db-console.js\nnode scripts/db-console.js .tablas\nnode scripts/db-console.js .kpis",
            "desc": "REPL nativo en Node.js que permite ejecutar cualquier sentencia SQL sobre SQLite, ver estructuras DDL con <code>.schema</code>, tablas con <code>.tablas</code> y métricas de negocio con <code>.kpis</code> con formato enriquecido en tablas ASCII.",
            "value": "Indispensable para auditorías en vivo sin necesidad de software externo como DBeaver o SQLiteBrowser."
        },
        {
            "name": "Herramienta 4: Analizador Estático de Código SAST / Linter",
            "exec": "npm run lint\nnode scripts/static-analysis.js",
            "desc": "Analizador estático que inspecciona los 42 archivos de código fuente verificando: ausencia de <code>eval()</code>, ausencia de ejecuciones no controladas de <code>child_process</code>, ausencia de secretos en duro y cumplimiento estricto del límite de menos de 1000 líneas por archivo.",
            "value": "Garantiza mantenibilidad arquitectónica y código limpio según Apartados 14, 18.3, 29 y 31 del manual MC-001."
        },
        {
            "name": "Herramienta 5: Verificador Automatizado del Plan de Auditoría ECTA-01",
            "exec": "npm run audit:verify\nnode scripts/audit-verifier.js",
            "desc": "Script que valida los 30 artefactos requeridos del repositorio y dictamina los 43 puntos normativos del Manual de Calidad, emitiendo reporte con 100% de cumplimiento en gestión documental, desarrollo, seguridad, calidad y despliegue.",
            "value": "Acredita el cumplimiento objetivo del plan de auditoría ante el auditor líder Sebastián Muñoz."
        },
        {
            "name": "Herramienta 6: Suite de Pruebas Automatizadas con Jest y Cobertura",
            "exec": "npm test",
            "desc": "Ejecuta 63 pruebas automáticas (RF funcionales, unitarias, de seguridad contra inyecciones SQL/XSS, e integración) con medición de cobertura superior al 89% en sentencias y 91% en líneas de código.",
            "value": "Asegura cero regresiones y funcionamiento impecable en cada cambio subido a Git."
        },
        {
            "name": "Herramienta 7: Proxy Caching Local de Mosaicos de Mapas y Geocodificador",
            "exec": "curl http://localhost:3000/api/logistics/tiles/12/1050/1715\ncurl http://localhost:3000/api/logistics/reverse-geocode?lat=19.4326&lng=-99.1332",
            "desc": "Servicio local implementado en <code>src/services/tileProxyService.js</code> que descarga y almacena en caché SQLite las teselas de OpenStreetMap para evitar errores 403 Forbidden por exceso de peticiones, junto con geocodificación inversa determinista de direcciones de México.",
            "value": "Eliminó el error de pantalla gris en la simulación de reparto del mapa en /envios."
        }
    ]
    
    for t_item in tools:
        t_box_data = [
            [Paragraph(f"<b>{t_item['name']}</b>", styles['BodyBold'])],
            [Paragraph(f"<b>Comando de Ejecución:</b>", styles['TableCellBold'])],
            [Paragraph(t_item['exec'].replace('\n', '<br/>'), styles['CodeSnippetLight'])],
            [Paragraph(f"<b>Descripción:</b> {t_item['desc']}", styles['TableCell'])],
            [Paragraph(f"<b>Valor en Auditoría:</b> <i>{t_item['value']}</i>", styles['TableCell'])]
        ]
        t_elem = Table(t_box_data, colWidths=[522])
        t_elem.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(t_elem)
        story.append(Spacer(1, 6))
        
    story.append(PageBreak())
    
    # =========================================================================
    # SECCIÓN 4: RECORRIDO COMPLETO DE FUNCIONALIDADES DESARROLLADAS (PASO A PASO)
    # =========================================================================
    story.append(Paragraph("4. GUÍA DEMOSTRATIVA PASO A PASO EN LA INTERFAZ WEB", styles['SectionHeading']))
    story.append(Paragraph(
        "Para realizar una demostración fluida, profesional y sin titubeos, Diego debe seguir este orden "
        "cronológico que resalta las características clave solicitadas:", styles['BodyJustify']
    ))
    
    steps = [
        (
            "Paso 1: Portal de Autenticación, Registro y Verificación 2FA",
            "1. Clic en 'Hola, Identifícate' en la barra superior.<br/>"
            "2. Mostrar la pestaña de Registro: destacar el <b>botón 'Registrarse en ExpressMart'</b> recientemente corregido, validaciones de campo en tiempo real (:user-invalid) y términos de privacidad.<br/>"
            "3. Demostrar el botón de ver/ocultar contraseña con el icono de ojo.<br/>"
            "4. Demostrar el botón de acceso rápido de Administrador (Diego) con su modal de 2FA donde se simula la entrega de código de seguridad de 6 dígitos vía Nodemailer.",
            "Acredita la resolución del bug de registro y el cumplimiento de RF-01, RF-02 y SEG-12."
        ),
        (
            "Paso 2: Exploración de Catálogo Aura Commerce, Búsqueda y Zoom Lens",
            "1. En el buscador superior, escribir 'Sony', 'Laptop' o 'Cafetera': mostrar el dropdown de sugerencias en vivo con precios y miniaturas.<br/>"
            "2. Aplicar filtros combinados (Categoría, Marca y Rango de Precio en MXN).<br/>"
            "3. Abrir la Ficha de Producto: pasar el cursor sobre la imagen principal para exhibir el <b>Zoom Interactivo 2.3x</b> sin parpadeos.<br/>"
            "4. Cambiar entre las miniaturas de galería fotográfica multi-ángulo.",
            "Demuestra experiencia de usuario moderna nivel Amazon/MercadoLibre en MXN."
        ),
        (
            "Paso 3: Buy Box Dedicado y Corrección del Bug de Comprar Ahora",
            "1. En el Buy Box a la derecha, seleccionar cantidad (ej. 1 unidad).<br/>"
            "2. Hacer clic en 'Comprar Ahora': se abre el modal de checkout con exactamente 1 unidad.<br/>"
            "3. Cerrar el modal con el botón de cruz o escape.<br/>"
            "4. Volver a hacer clic en 'Comprar Ahora' con 1 unidad: <b>verificar que permanece en 1 unidad y NO se duplica a 2</b>.<br/>"
            "5. Explicar el código en <code>catalog.js</code> donde se reemplazó la acumulación <code>existing.cantidad += qty</code> por asignación idempotente acotada al stock disponible.",
            "Prueba contundente de la resolución del segundo error reportado por el usuario."
        ),
        (
            "Paso 4: Checkout en 3 Pasos y Geolocalización con OpenStreetMap",
            "1. <b>Paso 1 (Cesta):</b> Aplicar cupón de descuento <code>BIENVENIDO10</code> o <code>PRIME50</code> y mostrar el desglose de IVA 16% y envío gratis.<br/>"
            "2. <b>Paso 2 (Ubicación):</b> Abrir el selector interactivo OpenStreetMap, hacer clic sobre cualquier calle de la CDMX, Guadalajara o Monterrey. Demostrar cómo se geocodifica la dirección automáticamente y se asigna el CEDIS más cercano.<br/>"
            "3. <b>Paso 3 (Pago):</b> Seleccionar Tarjetas Simuladas con plásticos coloreados reales o PayPal Sandbox.",
            "Demuestra cumplimiento de checkout en 3 pasos (RNF-11) y logística georreferenciada."
        ),
        (
            "Paso 5: Mi Billetera Digital ('Mi Billetera') y Tarjetas Físicas en 3D",
            "1. Ir a la pestaña 'Mi Billetera': mostrar el mazo apilado de tarjetas simuladas.<br/>"
            "2. Hacer clic en '+ Agregar Tarjeta': exhibir la <b>animación 3D de emergencia plástica</b> desde el bolsillo de la cartera.<br/>"
            "3. Elegir entre los 7 colores de plástico (Azul Rey, Oro Prime, Platino Ejecutivo, etc.) y verificar el límite de seguridad de máximo 3 tarjetas por usuario.",
            "Resuelve los requerimientos de simulación de plásticos bancarios y experiencia visual de alto nivel."
        ),
        (
            "Paso 6: Dashboard Exclusivo de Vendedor y Administrador",
            "1. Iniciar sesión como <code>vendedor@expressmart.mx</code>.<br/>"
            "2. Acceder al panel de vendedor en la tienda web: mostrar que <b>únicamente aparecen los productos dados de alta por este vendedor</b>.<br/>"
            "3. Mostrar el indicador de ventas acumuladas y la <b>tarjeta receptora exclusiva</b> para cobro de dinero simulado.<br/>"
            "4. Mostrar los modales rediseñados de confirmación (sin alertas nativas del navegador).",
            "Cumple exactamente la solicitud de dashboard exclusivo sin contaminar el panel general."
        ),
        (
            "Paso 7: Simulación de Reparto y Pestaña de Almacenes CEDIS (/envios)",
            "1. Navegar a <code>/envios</code>: mostrar el mapa Leaflet con la ruta y los marcadores animados de los vehículos de reparto (camión y automóvil).<br/>"
            "2. Seleccionar la <b>pestaña de Almacenes</b>: exhibir los 5 CEDIS (Norte, Oriente, Occidente, Noreste, Centro-Sur), sus coordenadas y su inventario de productos en tiempo real.<br/>"
            "3. En la creación de nuevos productos, mostrar el selector para asociar el producto a su almacén físico de origen.<br/>"
            "4. Destacar que el mapa carga al 100% de velocidad gracias al proxy local de teselas que resolvió el error 403.",
            "Demuestra la integración logística completa solicitada para el módulo de repartidor."
        )
    ]
    
    for title, desc, audit_note in steps:
        step_table_data = [
            [Paragraph(f"<b>{title}</b>", styles['BodyBold'])],
            [Paragraph(desc, styles['TableCell'])],
            [Paragraph(f"<b>Evidencia de Auditoría:</b> <i>{audit_note}</i>", styles['TableCellCenter'])]
        ]
        t_step = Table(step_table_data, colWidths=[522])
        t_step.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_step)
        story.append(Spacer(1, 6))
        
    story.append(PageBreak())
    
    # =========================================================================
    # SECCIÓN 5: GUION DE PREGUNTAS Y RESPUESTAS CLAVE EN LA ENTREVISTA
    # =========================================================================
    story.append(Paragraph("5. BANCO DE PREGUNTAS Y RESPUESTAS TÉCNICAS PARA DIEGO", styles['SectionHeading']))
    story.append(Paragraph(
        "Anticiparse a las dudas de los evaluadores demuestra maestría y aplomo. A continuación se presentan "
        "las preguntas más probables y la respuesta técnica exacta que Diego debe ofrecer:", styles['BodyJustify']
    ))
    
    qa_list = [
        (
            "Pregunta 1: ¿Cómo se garantiza la inmutabilidad de la bitácora de auditoría si SQLite es un archivo local?",
            "<b>Respuesta de Diego:</b> «Implementamos una cadena de bloques lógica criptográfica mediante hashes SHA-256 en la tabla <code>bitacora_auditoria</code>. Cada evento almacena el <code>hash_previo</code> del registro anterior, el payload serializado y su propio <code>hash_cadena</code>. Si alguien manipula manualmente una fila en la base de datos, el script de integridad (<code>scripts/security_panel.py</code> o <code>tabs_monitoring.py</code>) detecta inmediatamente la ruptura de la cadena criptográfica. Adicionalmente, el directorio <code>data/</code> posee permisos restrictivos en el sistema operativo Linux.»"
        ),
        (
            "Pregunta 2: ¿Qué medidas tomaron para la protección de datos personales bajo la ley mexicana (LFPDPPP)?",
            "<b>Respuesta de Diego:</b> «La plataforma cumple cabalmente con la LFPDPPP: (1) Registro con consentimiento explícito de Aviso de Privacidad Integral, (2) Mecanismo automatizado para ejercer Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) desde el perfil, (3) Borrado seguro y anonimización de cuentas de cliente mediante confirmación modal guiada, y (4) Almacenamiento de contraseñas mediante PBKDF2/SHA-256 con 100,000 iteraciones y sal aleatoria por usuario, sin guardar jamás texto en claro.»"
        ),
        (
            "Pregunta 3: ¿Cómo opera el 2FA y qué contingencia existe si el servidor SMTP falla?",
            "<b>Respuesta de Diego:</b> «El 2FA utiliza <code>nodemailer</code> con credenciales seguras de entorno para emitir un código OTP numérico de 6 dígitos con vigencia estricta de 10 minutos almacenado en <code>mfa_email_codes</code>. Como política de resiliencia y continuidad operativa (MC-001 §26), si el transporte SMTP externo sufre un timeout o indisponibilidad, el servicio activa un <i>Rescue OTP Fallback</i> que registra el código en la bitácora segura del servidor y permite al usuario completar la autenticación sin quedar bloqueado.»"
        ),
        (
            "Pregunta 4: ¿Cómo se resolvió el bug de duplicación en 'Comprar Ahora' y qué estándar de código se aplicó?",
            "<b>Respuesta de Diego:</b> «El bug se debía a un operador acumulativo (<code>existing.cantidad += qty</code>) dentro del manejador del botón Comprar Ahora en <code>public/js/catalog.js</code>. Cuando el usuario abría el modal de compra y lo cerraba sin concretar el pedido, el artículo ya existía en el carrito del cliente en memoria; al volver a pulsar Comprar Ahora con 1 unidad, sumaba 1 + 1 = 2. Lo solucioné aplicando una asignación idempotente directa (<code>existing.cantidad = qty</code>) acotada estrictamente por <code>Math.min(rawQty, maxStock)</code> para respetar el inventario del almacén. El cambio fue cubierto y validado por la suite de pruebas unitarias.»"
        ),
        (
            "Pregunta 5: ¿Por qué la arquitectura mantiene todos los archivos bajo 1000 líneas de código?",
            "<b>Respuesta de Diego:</b> «Es una regla arquitectónica obligatoria establecida en nuestro Manual de Calidad SGC MC-001 (Apartados 14 y 29) para garantizar alta cohesión y bajo acoplamiento. En lugar de tener archivos monolíticos, desacoplamos la aplicación en submódulos especializados: <code>admin_modules/</code> para el panel administrativo, <code>security_modules/</code> para ciberseguridad, y micro-servicios dedicados como <code>tileProxyService.js</code> y <code>emailService.js</code>. Nuestro analizador estático (<code>npm run lint</code>) verifica de forma continua que ningún archivo exceda este límite.»"
        )
    ]
    
    for q, a in qa_list:
        qa_data = [
            [Paragraph(f"<b>{q}</b>", styles['BodyBold'])],
            [Paragraph(a, styles['BodyJustify'])]
        ]
        t_qa = Table(qa_data, colWidths=[522])
        t_qa.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_qa)
        story.append(Spacer(1, 6))
        
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECCIÓN 6: TABLA DE REFERENCIA RÁPIDA / CHEAT SHEET
    # =========================================================================
    story.append(Paragraph("6. TABLA DE REFERENCIA RÁPIDA DE COMANDOS (CHEAT SHEET)", styles['SectionHeading']))
    story.append(Paragraph(
        "Comandos esenciales para copiar y pegar directamente durante la sesión técnica:", styles['BodyJustify']
    ))
    
    cheat_data = [
        [Paragraph("Objetivo", styles['TableHeader']), Paragraph("Comando de Terminal", styles['TableHeader']), Paragraph("Resultado Esperado", styles['TableHeader'])],
        [
            Paragraph("<b>Pruebas Unitarias</b>", styles['TableCellBold']),
            Paragraph("<code>npm test</code>", styles['TableCell']),
            Paragraph("4 suites, 63 pruebas PASSED al 100% (unit, security, integration, rf)", styles['TableCell'])
        ],
        [
            Paragraph("<b>Análisis Estático SAST</b>", styles['TableCellBold']),
            Paragraph("<code>npm run lint</code>", styles['TableCell']),
            Paragraph("42 archivos analizados, 0 hallazgos (PASSED)", styles['TableCell'])
        ],
        [
            Paragraph("<b>Verificador Auditoría</b>", styles['TableCellBold']),
            Paragraph("<code>npm run audit:verify</code>", styles['TableCell']),
            Paragraph("30/30 archivos presentes, 43/43 puntos cumplidos (100% de cumplimiento ECTA-01)", styles['TableCell'])
        ],
        [
            Paragraph("<b>Consola BD ExpressMart</b>", styles['TableCellBold']),
            Paragraph("<code>node scripts/db-console.js</code>", styles['TableCell']),
            Paragraph("REPL interactivo con comandos .tablas, .kpis, .schema y soporte SQL completo", styles['TableCell'])
        ],
        [
            Paragraph("<b>Panel Administrativo</b>", styles['TableCellBold']),
            Paragraph("<code>bash scripts/run_admin_panel.sh</code>", styles['TableCell']),
            Paragraph("Abre GUI con 7 pestañas: Finanzas, Cuentas, Tarjetas, Reembolsos, Ventas, Almacenes", styles['TableCell'])
        ],
        [
            Paragraph("<b>Panel de Ciberseguridad</b>", styles['TableCellBold']),
            Paragraph("<code>bash scripts/security_panel.sh</code>", styles['TableCell']),
            Paragraph("Abre GUI con 5 pestañas: Puertos, Amenazas, Bitácora D8, Hash SHA-256, Tests QA", styles['TableCell'])
        ],
        [
            Paragraph("<b>Iniciar Servidor Web</b>", styles['TableCellBold']),
            Paragraph("<code>npm start</code>", styles['TableCell']),
            Paragraph("Inicia Express en http://localhost:3000 con soporte total en vivo", styles['TableCell'])
        ],
        [
            Paragraph("<b>Verificar Git y Ramas</b>", styles['TableCellBold']),
            Paragraph("<code>git status && git log -n 2</code>", styles['TableCell']),
            Paragraph("Árbol limpio en main y release/v1.0.0 sincronizadas con origin", styles['TableCell'])
        ]
    ]
    t_cheat = Table(cheat_data, colWidths=[120, 195, 207])
    t_cheat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_NAVY_DARK),
        ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_BG_LIGHT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cheat)
    story.append(Spacer(1, 15))
    
    closing_p = (
        "<b>CONCLUSIÓN DE LA DEFENSA:</b> Con esta estructura técnica, el dominio de las consultas "
        "en base de datos y la demostración de la suite operativa de scripts y paneles, Diego cuenta con "
        "todas las evidencias formales para responder con solvencia a cualquier requerimiento de auditoría "
        "y asegurar una calificación sobresaliente."
    )
    story.append(create_callout(closing_p, styles, bg_color=C_SUCCESS_BG, border_color=C_SUCCESS, title="DICTAMEN FINAL DE EVALUACIÓN"))
    
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado exitosamente en: {PDF_OUTPUT}")


if __name__ == "__main__":
    generate_pdf()
