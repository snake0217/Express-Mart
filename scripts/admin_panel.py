#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
EXPRESSMART MÉXICO - PANEL ADMINISTRATIVO, FINANCIERO Y DE CUENTAS (GUI)
Conforme a SGC MC-001 v1.0, ISO/IEC 25010, ISO/IEC 27001, LFPDPPP y PCI DSS
==============================================================================
Funcionalidades principales:
1. Finanzas y Balance: Visualización del dinero total en ExpressMart (ventas
   de catálogo, suscripciones ExpressPrime, IVA SAT 16%, fondos en PayPal Sandbox
   y pasarelas de tarjetas con gráficos de distribución).
2. Cuentas del Sistema: Explorador de usuarios registrados con filtros por rol,
   búsqueda rápida y descifrado en tiempo real de datos sensibles (LFPDPPP).
3. Crear Cuentas Especiales: Módulo seguro para dar de alta cuentas de
   Administrador, Vendedor, Auditor y Soporte con hash scrypt auténtico,
   cifrado AES-256-GCM y registro en bitácora inmutable D8.
4. Registro de Ventas y Reportes: Bitácora de transacciones y pedidos con
   desglose de artículos y generador de reportes ejecutivos en TXT y CSV.
==============================================================================
"""

import os
import sys
import json
import time
import socket
import sqlite3
import hashlib
import binascii
import csv
import subprocess
from datetime import datetime

# Verificación de entorno gráfico
HAS_GUI = False
try:
    import tkinter as tk
    from tkinter import ttk, messagebox, filedialog
    if os.environ.get("DISPLAY") or sys.platform in ("win32", "darwin"):
        HAS_GUI = True
except Exception:
    HAS_GUI = False

# Soporte criptográfico para AES-256-GCM (LFPDPPP)
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

# ==============================================================================
# CONFIGURACIÓN GENERAL Y RUTAS
# ==============================================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "data", "expressmart.sqlite")
REPORTS_DIR = os.path.join(BASE_DIR, "reportes")

ENCRYPTION_KEY_SECRET = os.environ.get(
    "ENCRYPTION_KEY", "expressmart-dev-32byte-secret-key!"
)

# Paleta de Colores ExpressMart México
COLOR_NAVY_DARK = "#0a2540"      # Azul marino corporativo profundo
COLOR_PRIMARY = "#003087"        # Azul ExpressMart
COLOR_PRIMARY_LIGHT = "#1e40af"  # Azul hover
COLOR_ACCENT_GOLD = "#ffc439"    # Amarillo PayPal / ExpressMart Gold
COLOR_ACCENT_AMBER = "#d97706"   # Ámbar
COLOR_SUCCESS = "#10b981"        # Verde éxito
COLOR_SUCCESS_DARK = "#047857"   # Verde oscuro
COLOR_DANGER = "#ef4444"         # Rojo alerta
COLOR_SURFACE = "#ffffff"        # Superficie blanca
COLOR_BG = "#f8fafc"             # Fondo general
COLOR_BORDER = "#e2e8f0"         # Borde suave
COLOR_TEXT_MAIN = "#0f172a"      # Texto principal
COLOR_TEXT_MUTED = "#64748b"     # Texto secundario


def find_database_path():
    candidates = [
        DEFAULT_DB_PATH,
        os.path.join(BASE_DIR, "expressmart.db"),
        os.environ.get("DB_PATH", "")
    ]
    for p in candidates:
        if p and os.path.exists(p) and os.path.isfile(p):
            return p
    return DEFAULT_DB_PATH


def get_db():
    db_path = find_database_path()
    if not os.path.exists(db_path):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con, db_path


# ==============================================================================
# MÓDULO CRIPTOGRÁFICO (Compatible 100% con Node.js crypto.js de ExpressMart)
# ==============================================================================
def hash_password_scrypt(password: str) -> str:
    """Genera hash scrypt con salt aleatorio exactamente compatible con Node.js"""
    salt = os.urandom(16).hex()
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64
    ).hex()
    return f"scrypt:{salt}:{derived}"


def verify_password_scrypt(password: str, stored_hash: str) -> bool:
    if not stored_hash or not stored_hash.startswith("scrypt:"):
        return False
    parts = stored_hash.split(":")
    if len(parts) != 3:
        return False
    _, salt, hash_hex = parts
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64
    ).hex()
    return derived == hash_hex


def encrypt_aes_gcm(plain_text: str) -> str:
    """Cifra datos personales sensibles con AES-256-GCM conforme a LFPDPPP"""
    if not plain_text:
        return ""
    if not HAS_CRYPTO:
        return plain_text
    key = hashlib.sha256(ENCRYPTION_KEY_SECRET.encode("utf-8")).digest()
    iv = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(iv, plain_text.encode("utf-8"), None)
    ciphertext = ct[:-16]
    tag = ct[-16:]
    return f"enc:v1:{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"


def decrypt_aes_gcm(cipher_text: str) -> str:
    """Descifra datos cifrados con AES-256-GCM"""
    if not cipher_text or not isinstance(cipher_text, str) or not cipher_text.startswith("enc:v1:"):
        return cipher_text or ""
    if not HAS_CRYPTO:
        return "[Requiere paquete cryptography]"
    parts = cipher_text.split(":")
    if len(parts) != 5:
        return cipher_text
    _, _, iv_hex, tag_hex, data_hex = parts
    try:
        key = hashlib.sha256(ENCRYPTION_KEY_SECRET.encode("utf-8")).digest()
        iv = bytes.fromhex(iv_hex)
        tag = bytes.fromhex(tag_hex)
        data = bytes.fromhex(data_hex)
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(iv, data + tag, None)
        return decrypted.decode("utf-8")
    except Exception:
        return "[Error al descifrar dato]"


def record_audit_log_entry(con, usuario_id, rol, accion, modulo, entidad_id, detalles):
    """Inserta en bitacora_auditoria D8 encadenada con SHA-256 inmutable"""
    prev_row = con.execute("SELECT hash_cadena FROM bitacora_auditoria ORDER BY id DESC LIMIT 1").fetchone()
    prev_hash = prev_row[0] if prev_row and prev_row[0] else "0" * 64
    now_iso = datetime.utcnow().isoformat() + "Z"
    detalles_json = json.dumps(detalles, ensure_ascii=False)
    payload = f"{now_iso}|{usuario_id}|{rol}|{accion}|{modulo}|{entidad_id}|127.0.0.1|{detalles_json}|{prev_hash}"
    hash_cadena = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    con.execute("""
        INSERT INTO bitacora_auditoria (timestamp, usuario_id, rol, accion, modulo, entidad_id, ip, detalles_json, prev_hash, hash_cadena)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (now_iso, usuario_id, rol, accion, modulo, str(entidad_id), "127.0.0.1", detalles_json, prev_hash, hash_cadena))
    con.commit()
    return hash_cadena


# ==============================================================================
# MÓDULO DE CÁLCULO FINANCIERO Y REPORTES
# ==============================================================================
def get_financial_summary():
    con, db_path = get_db()
    data = {
        "db_path": db_path,
        "total_dinero_expressmart": 0.0,
        "total_ventas_bruto": 0.0,
        "subtotal_ventas": 0.0,
        "iva_retenido_sat": 0.0,
        "costo_envios_cobrado": 0.0,
        "total_descuentos": 0.0,
        "total_pedidos_pagados": 0,
        "total_pedidos_general": 0,
        "ticket_promedio": 0.0,
        "total_reembolsos": 0.0,
        "pedidos_devueltos": 0,
        "total_suscripciones": 0.0,
        "suscripciones_activas": 0,
        "metodos_pago": {},
        "top_productos": []
    }

    try:
        # 1. Total pedidos y ventas
        row_pedidos = con.execute("""
            SELECT 
                COUNT(*) as total_pedidos,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN 1 ELSE 0 END) as pagados,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN total ELSE 0 END) as ventas_bruto,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN subtotal ELSE 0 END) as subtotal,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN impuestos ELSE 0 END) as iva,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN costo_envio ELSE 0 END) as envios,
                SUM(CASE WHEN estado IN ('pagado', 'entregado', 'procesando', 'enviado') THEN descuento ELSE 0 END) as descuentos,
                SUM(CASE WHEN estado = 'devuelto' THEN total ELSE 0 END) as reembolsos,
                SUM(CASE WHEN estado = 'devuelto' THEN 1 ELSE 0 END) as devueltos
            FROM pedidos
        """).fetchone()

        if row_pedidos:
            data["total_pedidos_general"] = row_pedidos["total_pedidos"] or 0
            data["total_pedidos_pagados"] = row_pedidos["pagados"] or 0
            data["total_ventas_bruto"] = float(row_pedidos["ventas_bruto"] or 0.0)
            data["subtotal_ventas"] = float(row_pedidos["subtotal"] or 0.0)
            data["iva_retenido_sat"] = float(row_pedidos["iva"] or 0.0)
            data["costo_envios_cobrado"] = float(row_pedidos["envios"] or 0.0)
            data["total_descuentos"] = float(row_pedidos["descuentos"] or 0.0)
            data["total_reembolsos"] = float(row_pedidos["reembolsos"] or 0.0)
            data["pedidos_devueltos"] = row_pedidos["devueltos"] or 0
            if data["total_pedidos_pagados"] > 0:
                data["ticket_promedio"] = data["total_ventas_bruto"] / data["total_pedidos_pagados"]

        # 2. Suscripciones Premium ExpressPrime
        try:
            row_subs = con.execute("""
                SELECT 
                    COUNT(*) as total_subs,
                    SUM(monto) as total_monto
                FROM suscripciones_premium
                WHERE estado = 'activa'
            """).fetchone()
            if row_subs:
                data["suscripciones_activas"] = row_subs["total_subs"] or 0
                data["total_suscripciones"] = float(row_subs["total_monto"] or 0.0)
        except sqlite3.OperationalError:
            pass

        # Total Dinero ExpressMart = Ventas catálogo capturadas + Suscripciones Prime
        data["total_dinero_expressmart"] = data["total_ventas_bruto"] + data["total_suscripciones"]

        # 3. Desglose por método de pago en transacciones
        try:
            rows_tx = con.execute("""
                SELECT 
                    metodo_pago,
                    COUNT(*) as num_tx,
                    SUM(monto) as total_monto
                FROM transacciones
                WHERE estado = 'capturado'
                GROUP BY metodo_pago
            """).fetchall()
            for r in rows_tx:
                data["metodos_pago"][r["metodo_pago"]] = {
                    "num_tx": r["num_tx"],
                    "total": float(r["total_monto"] or 0.0)
                }
        except sqlite3.OperationalError:
            pass

        # 4. Top productos vendidos
        try:
            rows_prods = con.execute("""
                SELECT 
                    nombre_producto,
                    SUM(cantidad) as total_piezas,
                    SUM(subtotal) as total_recaudado
                FROM pedido_items pi
                JOIN pedidos p ON pi.pedido_id = p.id
                WHERE p.estado IN ('pagado', 'entregado', 'procesando', 'enviado')
                GROUP BY producto_id, nombre_producto
                ORDER BY total_recaudado DESC
                LIMIT 5
            """).fetchall()
            for r in rows_prods:
                data["top_productos"].append({
                    "nombre": r["nombre_producto"],
                    "piezas": r["total_piezas"],
                    "recaudado": float(r["total_recaudado"] or 0.0)
                })
        except sqlite3.OperationalError:
            pass

    finally:
        con.close()

    return data


def generate_sales_report_files():
    """Genera reportes de ventas formales en formato TXT y CSV en reportes/"""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    summary = get_financial_summary()
    con, _ = get_db()

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    txt_path = os.path.join(REPORTS_DIR, f"reporte_ventas_{timestamp_str}.txt")
    csv_path = os.path.join(REPORTS_DIR, f"ventas_expressmart_{timestamp_str}.csv")

    # Obtener todas las órdenes
    orders = con.execute("""
        SELECT 
            p.id,
            p.folio,
            u.nombre as cliente_nombre,
            u.email as cliente_email,
            p.metodo_pago,
            p.estado,
            p.subtotal,
            p.impuestos,
            p.costo_envio,
            p.descuento,
            p.total,
            t.referencia_pasarela,
            p.created_at
        FROM pedidos p
        JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN transacciones t ON p.id = t.pedido_id
        ORDER BY p.id DESC
    """).fetchall()

    # 1. GENERAR ARCHIVO CSV
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Folio Pedido", "Fecha Creacion", "Cliente", "Email Cliente",
            "Metodo Pago", "Estado", "Subtotal (MXN)", "IVA 16% (MXN)",
            "Costo Envio (MXN)", "Descuento (MXN)", "Total (MXN)", "Referencia Pasarela"
        ])
        for o in orders:
            writer.writerow([
                o["folio"],
                o["created_at"],
                o["cliente_nombre"],
                o["cliente_email"],
                o["metodo_pago"].upper(),
                o["estado"].upper(),
                f"{o['subtotal']:.2f}",
                f"{o['impuestos']:.2f}",
                f"{o['costo_envio']:.2f}",
                f"{o['descuento']:.2f}",
                f"{o['total']:.2f}",
                o["referencia_pasarela"] or "N/A"
            ])
        writer.writerow([])
        writer.writerow([
            "TOTALES", "", "", "", "", f"PEDIDOS: {summary['total_pedidos_general']}",
            f"{summary['subtotal_ventas']:.2f}",
            f"{summary['iva_retenido_sat']:.2f}",
            f"{summary['costo_envios_cobrado']:.2f}",
            f"{summary['total_descuentos']:.2f}",
            f"{summary['total_ventas_bruto']:.2f}",
            f"BALANCE TOTAL: ${summary['total_dinero_expressmart']:.2f} MXN"
        ])

    # 2. GENERAR ARCHIVO TXT EJECUTIVO
    txt_content = []
    txt_content.append("=" * 80)
    txt_content.append("EXPRESSMART MÉXICO - REPORTE EJECUTIVO DE VENTAS Y BALANCE FINANCIERO")
    txt_content.append("Sistema de Gestión de la Calidad SGC MC-001 v1.0 | Auditoría ECTA-01")
    txt_content.append("=" * 80)
    txt_content.append(f"Fecha de Emisión:      {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (Hora Centro México)")
    txt_content.append(f"Base de Datos Auditada: {summary['db_path']}")
    txt_content.append(f"Moneda Oficial:        Peso Mexicano (MXN)")
    txt_content.append("-" * 80)
    txt_content.append("1. BALANCE FINANCIERO CONSOLIDADO:")
    txt_content.append("-" * 80)
    txt_content.append(f"  • DINERO TOTAL EN EXPRESSMART:     ${summary['total_dinero_expressmart']:>14,.2f} MXN")
    txt_content.append(f"    - Ventas Brutas de Catálogo:     ${summary['total_ventas_bruto']:>14,.2f} MXN  ({summary['total_pedidos_pagados']} pedidos pagados)")
    txt_content.append(f"    - Suscripciones ExpressPrime:    ${summary['total_suscripciones']:>14,.2f} MXN  ({summary['suscripciones_activas']} miembros activos)")
    txt_content.append(f"  • Subtotal Neto de Productos:      ${summary['subtotal_ventas']:>14,.2f} MXN")
    txt_content.append(f"  • Impuestos Retenidos (IVA 16%):   ${summary['iva_retenido_sat']:>14,.2f} MXN  (Fondo Fiscal SAT)")
    txt_content.append(f"  • Envíos ExpressPrime Cobrados:    ${summary['costo_envios_cobrado']:>14,.2f} MXN")
    txt_content.append(f"  • Descuentos Promocionales:        ${summary['total_descuentos']:>14,.2f} MXN")
    txt_content.append(f"  • Ticket Promedio por Compra:      ${summary['ticket_promedio']:>14,.2f} MXN")
    txt_content.append(f"  • Devoluciones y Reembolsos:       ${summary['total_reembolsos']:>14,.2f} MXN  ({summary['pedidos_devueltos']} pedidos)")
    txt_content.append("-" * 80)
    txt_content.append("2. DISTRIBUCIÓN POR PASARELA Y MÉTODO DE PAGO:")
    txt_content.append("-" * 80)
    for metodo, info in summary["metodos_pago"].items():
        pct = (info["total"] / summary["total_ventas_bruto"] * 100) if summary["total_ventas_bruto"] > 0 else 0
        extra_note = " (Sandbox: bancochido@banco.com)" if metodo == "paypal" else ""
        txt_content.append(f"  • {metodo.upper():<12}{extra_note}: ${info['total']:>12,.2f} MXN ({info['num_tx']} tx, {pct:.1f}%)")
    txt_content.append("-" * 80)
    txt_content.append("3. PRODUCTOS MÁS VENDIDOS:")
    txt_content.append("-" * 80)
    if summary["top_productos"]:
        for i, tp in enumerate(summary["top_productos"], 1):
            txt_content.append(f"  {i}. {tp['nombre'][:48]:<50} {tp['piezas']:>3} uds  |  ${tp['recaudado']:>10,.2f} MXN")
    else:
        txt_content.append("  (No hay datos suficientes de productos comprados)")
    txt_content.append("-" * 80)
    txt_content.append("4. DETALLE DE VENTAS Y PEDIDOS:")
    txt_content.append("-" * 80)
    txt_content.append(f"{'FOLIO':<28} {'FECHA':<19} {'CLIENTE':<20} {'METODO':<8} {'ESTADO':<10} {'TOTAL MXN':>12}")
    txt_content.append("-" * 80)
    for o in orders:
        txt_content.append(
            f"{o['folio']:<28} {o['created_at'][:19]:<19} {o['cliente_nombre'][:19]:<20} "
            f"{o['metodo_pago'].upper():<8} {o['estado'].upper():<10} ${o['total']:>11,.2f}"
        )
    txt_content.append("-" * 80)
    txt_content.append("FIRMA DE INTEGRIDAD CRIPTOGRÁFICA (ISO/IEC 25012 / RNF-09):")
    raw_block = "\n".join(txt_content)
    sha_sign = hashlib.sha256(raw_block.encode("utf-8")).hexdigest()
    txt_content.append(f"SHA-256 HASH: {sha_sign}")
    txt_content.append("=" * 80)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(txt_content))

    con.close()
    return {
        "txt_path": txt_path,
        "csv_path": csv_path,
        "total_dinero": summary["total_dinero_expressmart"],
        "num_pedidos": summary["total_pedidos_general"],
        "sha256": sha_sign
    }


# ==============================================================================
# INTERFAZ GRÁFICA DE USUARIO (GUI - TKINTER)
# ==============================================================================
class AdminPanelGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("ExpressMart - Panel Administrativo y Financiero (SGC MC-001)")
        self.root.geometry("1120x730")
        self.root.minsize(980, 650)
        self.root.configure(bg=COLOR_BG)

        # Configuración de estilos ttk
        self.setup_styles()

        # Marco Principal
        self.main_container = tk.Frame(self.root, bg=COLOR_BG)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Encabezado Corporativo
        self.create_header()

        # Cuaderno de Pestañas (Notebook)
        self.notebook = ttk.Notebook(self.main_container, style="Admin.TNotebook")
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=16, pady=(10, 16))

        # Crear las 4 Ventanas / Pestañas principales requeridas:
        self.tab_finance = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_accounts = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_create_account = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_sales = ttk.Frame(self.notebook, style="Admin.TFrame")

        self.notebook.add(self.tab_finance, text=" Dinero y Balance ExpressMart ")
        self.notebook.add(self.tab_accounts, text=" Cuentas del Sistema ")
        self.notebook.add(self.tab_create_account, text=" Crear Cuentas (Admin/Vendedor/Auditor) ")
        self.notebook.add(self.tab_sales, text=" Log de Ventas y Reportes ")

        # Construir cada pestaña
        self.build_finance_tab()
        self.build_accounts_tab()
        self.build_create_account_tab()
        self.build_sales_tab()

        # Cargar datos iniciales
        self.refresh_finance_data()
        self.refresh_accounts_data()
        self.refresh_sales_data()

    def setup_styles(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        # Estilo para Notebook
        style.configure("Admin.TNotebook", background=COLOR_BG, borderwidth=0)
        style.configure(
            "Admin.TNotebook.Tab",
            background="#e2e8f0",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 10, "bold"),
            padding=[16, 8]
        )
        style.map(
            "Admin.TNotebook.Tab",
            background=[("selected", COLOR_PRIMARY), ("active", "#cbd5e1")],
            foreground=[("selected", "#ffffff")]
        )

        style.configure("Admin.TFrame", background=COLOR_BG)

        # Estilo para Treeview (tablas)
        style.configure(
            "Admin.Treeview",
            background="#ffffff",
            foreground=COLOR_TEXT_MAIN,
            fieldbackground="#ffffff",
            rowheight=28,
            font=("DejaVu Sans", 9)
        )
        style.configure(
            "Admin.Treeview.Heading",
            background="#f1f5f9",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 9, "bold"),
            relief="flat",
            padding=[6, 6]
        )
        style.map(
            "Admin.Treeview",
            background=[("selected", "#e0e7ff")],
            foreground=[("selected", COLOR_PRIMARY)]
        )

    def create_header(self):
        header_frame = tk.Frame(self.main_container, bg=COLOR_NAVY_DARK, height=75)
        header_frame.pack(fill=tk.X, side=tk.TOP)
        header_frame.pack_propagate(False)

        inner = tk.Frame(header_frame, bg=COLOR_NAVY_DARK)
        inner.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Lado izquierdo: Logo / Título
        left_box = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        left_box.pack(side=tk.LEFT, fill=tk.Y)

        title_lbl = tk.Label(
            left_box,
            text="EXPRESS MART · MÉXICO",
            font=("DejaVu Sans", 16, "bold"),
            fg=COLOR_ACCENT_GOLD,
            bg=COLOR_NAVY_DARK
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            left_box,
            text="Panel Ejecutivo de Gestión Financiera, Auditoría y Control de Accesos",
            font=("DejaVu Sans", 9),
            fg="#cbd5e1",
            bg=COLOR_NAVY_DARK
        )
        subtitle_lbl.pack(anchor="w")

        # Lado derecho: Estado de Base de Datos y botón actualizar
        right_box = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        right_box.pack(side=tk.RIGHT, fill=tk.Y)

        db_path = find_database_path()
        status_lbl = tk.Label(
            right_box,
            text=f"BD Activa: {os.path.basename(db_path)}",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_SUCCESS,
            bg=COLOR_NAVY_DARK
        )
        status_lbl.pack(anchor="e", pady=(2, 4))

        btn_refresh_all = tk.Button(
            right_box,
            text="Actualizar Todo",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.refresh_all
        )
        btn_refresh_all.pack(anchor="e")

    # ==========================================================================
    # PESTAÑA 1: DINERO Y BALANCE EXPRESSMART
    # ==========================================================================
    def build_finance_tab(self):
        frame = self.tab_finance

        top_bar = tk.Frame(frame, bg=COLOR_BG)
        top_bar.pack(fill=tk.X, pady=(10, 8), padx=10)

        tk.Label(
            top_bar,
            text="Resumen Financiero y Fondos Totales de ExpressMart",
            font=("DejaVu Sans", 13, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_BG
        ).pack(side=tk.LEFT)

        # Contenedor de Tarjetas de Indicadores (KPIs)
        self.kpi_container = tk.Frame(frame, bg=COLOR_BG)
        self.kpi_container.pack(fill=tk.X, padx=10, pady=5)

        # Fila 1 de KPIs (3 tarjetas principales)
        row1 = tk.Frame(self.kpi_container, bg=COLOR_BG)
        row1.pack(fill=tk.X, pady=4)

        self.card_total_dinero = self.create_kpi_card(
            row1, "Dinero Total ExpressMart", "$0.00 MXN", "Total acumulado ventas + membresías", COLOR_SUCCESS_DARK, "#ecfdf5"
        )
        self.card_ventas_bruto = self.create_kpi_card(
            row1, "Ventas Brutas Catálogo", "$0.00 MXN", "Subtotal + IVA + Envíos cobrados", COLOR_PRIMARY, "#eff6ff"
        )
        self.card_suscripciones = self.create_kpi_card(
            row1, "Suscripciones ExpressPrime", "$0.00 MXN", "Membresías premium activas", COLOR_ACCENT_AMBER, "#fffbeb"
        )

        # Fila 2 de KPIs (3 tarjetas secundarias)
        row2 = tk.Frame(self.kpi_container, bg=COLOR_BG)
        row2.pack(fill=tk.X, pady=4)

        self.card_iva = self.create_kpi_card(
            row2, "IVA Retenido SAT (16%)", "$0.00 MXN", "Cumplimiento fiscal CFDI 4.0", "#475569", "#f1f5f9"
        )
        self.card_paypal = self.create_kpi_card(
            row2, "Pasarela PayPal Sandbox", "$0.00 MXN", "bancochido@banco.com", "#0284c7", "#f0f9ff"
        )
        self.card_ticket = self.create_kpi_card(
            row2, "Ticket Promedio por Pedido", "$0.00 MXN", "Valor medio por compra", "#7c3aed", "#f5f3ff"
        )

        # Sección inferior: Detalle de métodos de pago y Gráfico Canvas
        bottom_frame = tk.Frame(frame, bg=COLOR_BG)
        bottom_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(10, 5))

        # Panel izquierdo: desglose
        left_panel = tk.LabelFrame(
            bottom_frame,
            text=" Desglose por Método de Pago & Estado ",
            font=("DejaVu Sans", 10, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=10
        )
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        self.lbl_finance_details = tk.Label(
            left_panel,
            text="Cargando información financiera...",
            font=("DejaVu Sans Mono", 9),
            justify=tk.LEFT,
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MAIN
        )
        self.lbl_finance_details.pack(anchor="nw", fill=tk.BOTH, expand=True)

        # Panel derecho: Canvas gráfico de barras
        right_panel = tk.LabelFrame(
            bottom_frame,
            text=" Distribución Porcentual de Ingresos ",
            font=("DejaVu Sans", 10, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=10
        )
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(6, 0))

        self.canvas_chart = tk.Canvas(right_panel, bg=COLOR_SURFACE, highlightthickness=0)
        self.canvas_chart.pack(fill=tk.BOTH, expand=True)

    def create_kpi_card(self, parent, title, value, subtitle, text_color, bg_color):
        card = tk.Frame(parent, bg=bg_color, relief="solid", bd=1, padx=14, pady=10)
        card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)

        lbl_title = tk.Label(card, text=title, font=("DejaVu Sans", 9, "bold"), fg=COLOR_NAVY_DARK, bg=bg_color)
        lbl_title.pack(anchor="w")

        lbl_val = tk.Label(card, text=value, font=("DejaVu Sans", 15, "bold"), fg=text_color, bg=bg_color)
        lbl_val.pack(anchor="w", pady=(3, 1))

        lbl_sub = tk.Label(card, text=subtitle, font=("DejaVu Sans", 8), fg=COLOR_TEXT_MUTED, bg=bg_color)
        lbl_sub.pack(anchor="w")

        return {"card": card, "val": lbl_val, "sub": lbl_sub}

    def refresh_finance_data(self):
        summary = get_financial_summary()

        self.card_total_dinero["val"].config(text=f"${summary['total_dinero_expressmart']:,.2f} MXN")
        self.card_total_dinero["sub"].config(text=f"{summary['total_pedidos_pagados']} compras + {summary['suscripciones_activas']} suscripciones")

        self.card_ventas_bruto["val"].config(text=f"${summary['total_ventas_bruto']:,.2f} MXN")
        self.card_ventas_bruto["sub"].config(text=f"Subtotal: ${summary['subtotal_ventas']:,.2f} MXN")

        self.card_suscripciones["val"].config(text=f"${summary['total_suscripciones']:,.2f} MXN")
        self.card_suscripciones["sub"].config(text=f"{summary['suscripciones_activas']} miembros ExpressPrime activos")

        self.card_iva["val"].config(text=f"${summary['iva_retenido_sat']:,.2f} MXN")
        self.card_iva["sub"].config(text=f"Envíos: ${summary['costo_envios_cobrado']:,.2f} MXN")

        paypal_total = summary["metodos_pago"].get("paypal", {}).get("total", 0.0)
        paypal_tx = summary["metodos_pago"].get("paypal", {}).get("num_tx", 0)
        self.card_paypal["val"].config(text=f"${paypal_total:,.2f} MXN")
        self.card_paypal["sub"].config(text=f"{paypal_tx} transacciones (bancochido@banco.com)")

        self.card_ticket["val"].config(text=f"${summary['ticket_promedio']:,.2f} MXN")
        self.card_ticket["sub"].config(text=f"Reembolsos: ${summary['total_reembolsos']:,.2f} MXN")

        # Texto detallado
        detail_lines = []
        detail_lines.append(f"{'MÉTODO DE PAGO':<16} {'TRANSACCIONES':<14} {'TOTAL MXN':>14} {'PARTICIPACIÓN':>14}")
        detail_lines.append("-" * 62)
        total_v = summary["total_ventas_bruto"]
        for m, inf in summary["metodos_pago"].items():
            pct = (inf["total"] / total_v * 100) if total_v > 0 else 0
            detail_lines.append(f"{m.upper():<16} {inf['num_tx']:<14} ${inf['total']:>12,.2f} {pct:>13.1f}%")

        detail_lines.append("\n" + "=" * 62)
        detail_lines.append(f"Membresías ExpressPrime:  ${summary['total_suscripciones']:,.2f} MXN")
        detail_lines.append(f"Devoluciones/Cancelaciones: ${summary['total_reembolsos']:,.2f} MXN")
        detail_lines.append(f"Descuentos de Cupones:     ${summary['total_descuentos']:,.2f} MXN")
        detail_lines.append("=" * 62)

        self.lbl_finance_details.config(text="\n".join(detail_lines))

        # Dibujar gráfico de barras en Canvas
        self.draw_finance_chart(summary)

    def draw_finance_chart(self, summary):
        c = self.canvas_chart
        c.delete("all")
        w = c.winfo_width() or 400
        h = c.winfo_height() or 220

        c.create_text(20, 15, text="Participación por Método de Pago en Ventas:", anchor="w", font=("DejaVu Sans", 9, "bold"), fill=COLOR_NAVY_DARK)

        metodos = summary["metodos_pago"]
        if not metodos:
            c.create_text(w // 2, h // 2, text="Sin transacciones capturadas aún", fill=COLOR_TEXT_MUTED, font=("DejaVu Sans", 10))
            return

        total_monto = max(1.0, summary["total_ventas_bruto"])
        y = 45
        colors = {"paypal": "#0070ba", "tarjeta": "#003087", "msi": "#7c3aed", "wallet": "#10b981"}

        for metodo, data in metodos.items():
            pct = (data["total"] / total_monto) * 100
            bar_w = int((w - 180) * (pct / 100))
            bar_color = colors.get(metodo.lower(), COLOR_PRIMARY)

            label = f"{metodo.upper()} ({pct:.1f}%):"
            c.create_text(20, y + 10, text=label, anchor="w", font=("DejaVu Sans", 8, "bold"), fill=COLOR_TEXT_MAIN)

            # Barra
            c.create_rectangle(140, y, 140 + max(6, bar_w), y + 20, fill=bar_color, outline="")
            # Monto texto
            c.create_text(150 + max(6, bar_w) + 10, y + 10, text=f"${data['total']:,.2f}", anchor="w", font=("DejaVu Sans", 8), fill=COLOR_NAVY_DARK)

            y += 38

    # ==========================================================================
    # PESTAÑA 2: CUENTAS QUE HAY EN EL SISTEMA
    # ==========================================================================
    def build_accounts_tab(self):
        frame = self.tab_accounts

        # Barra superior con métricas y filtros
        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        # Filtros
        tk.Label(top_box, text="Filtrar por Rol:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_role_filter = ttk.Combobox(
            top_box,
            values=["Todos", "administrador", "vendedor", "auditor", "cliente", "soporte"],
            state="readonly",
            width=14
        )
        self.combo_role_filter.set("Todos")
        self.combo_role_filter.pack(side=tk.LEFT, padx=(0, 15))
        self.combo_role_filter.bind("<<ComboboxSelected>>", lambda _: self.filter_accounts())

        tk.Label(top_box, text="Buscar:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_user = ttk.Entry(top_box, width=22)
        self.entry_search_user.pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_user.bind("<KeyRelease>", lambda _: self.filter_accounts())

        btn_search_clear = ttk.Button(top_box, text="Limpiar", command=self.clear_user_search)
        btn_search_clear.pack(side=tk.LEFT, padx=(0, 15))

        self.lbl_accounts_stats = tk.Label(top_box, text="Total cuentas: 0", font=("DejaVu Sans", 9, "bold"), fg=COLOR_PRIMARY, bg=COLOR_BG)
        self.lbl_accounts_stats.pack(side=tk.RIGHT)

        # Contenedor de Tabla con Scrollbar
        table_container = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "nombre", "email", "rol", "membresia", "mfa", "estado", "created_at")
        self.tree_users = ttk.Treeview(
            table_container,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_users.heading("id", text="ID")
        self.tree_users.heading("nombre", text="Nombre del Usuario")
        self.tree_users.heading("email", text="Correo Electrónico")
        self.tree_users.heading("rol", text="Rol en Sistema")
        self.tree_users.heading("membresia", text="Membresía Prime")
        self.tree_users.heading("mfa", text="2FA / MFA")
        self.tree_users.heading("estado", text="Estado")
        self.tree_users.heading("created_at", text="Fecha de Alta")

        self.tree_users.column("id", width=45, anchor="center")
        self.tree_users.column("nombre", width=190, anchor="w")
        self.tree_users.column("email", width=220, anchor="w")
        self.tree_users.column("rol", width=110, anchor="center")
        self.tree_users.column("membresia", width=110, anchor="center")
        self.tree_users.column("mfa", width=80, anchor="center")
        self.tree_users.column("estado", width=70, anchor="center")
        self.tree_users.column("created_at", width=140, anchor="center")

        sb_y = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree_users.yview)
        self.tree_users.configure(yscrollcommand=sb_y.set)
        sb_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_users.pack(fill=tk.BOTH, expand=True)

        self.tree_users.bind("<<TreeviewSelect>>", self.on_user_select)

        # Panel inferior de detalles del usuario seleccionado
        self.detail_user_frame = tk.LabelFrame(
            frame,
            text=" Detalles del Usuario Seleccionado (Descifrado LFPDPPP) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        self.detail_user_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        self.lbl_user_detail_text = tk.Label(
            self.detail_user_frame,
            text="Selecciona una cuenta en la tabla para inspeccionar sus datos y teléfono/dirección descifrados.",
            font=("DejaVu Sans", 9),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_user_detail_text.pack(anchor="w")

    def refresh_accounts_data(self):
        con, _ = get_db()
        self.all_users = con.execute("""
            SELECT 
                id, email, password_hash, nombre, rol, mfa_enabled, 
                direccion_cifrada, telefono_cifrado, activo, created_at,
                membresia_premium, membresia_plan, membresia_expira
            FROM usuarios
            ORDER BY id ASC
        """).fetchall()
        con.close()

        self.filter_accounts()

    def filter_accounts(self):
        role_filter = self.combo_role_filter.get()
        search_txt = self.entry_search_user.get().strip().lower()

        for item in self.tree_users.get_children():
            self.tree_users.delete(item)

        filtered = []
        for u in getattr(self, "all_users", []):
            if role_filter != "Todos" and u["rol"].lower() != role_filter.lower():
                continue
            if search_txt:
                match_name = search_txt in u["nombre"].lower()
                match_email = search_txt in u["email"].lower()
                if not match_name and not match_email:
                    continue
            filtered.append(u)

        role_icons = {
            "administrador": "ADMIN",
            "vendedor": "VENDEDOR",
            "auditor": "AUDITOR",
            "cliente": "CLIENTE",
            "soporte": "SOPORTE"
        }

        for u in filtered:
            mfa_str = "Activo" if u["mfa_enabled"] else "No"
            estado_str = "Activa" if u["activo"] else "Bloq."
            prime_str = f"{u['membresia_plan'] or 'Prime'}" if u["membresia_premium"] else "Estándar"

            self.tree_users.insert(
                "",
                tk.END,
                values=(
                    u["id"],
                    u["nombre"],
                    u["email"],
                    role_icons.get(u["rol"], u["rol"].upper()),
                    prime_str,
                    mfa_str,
                    estado_str,
                    u["created_at"][:19]
                ),
                tags=(u["rol"],)
            )

        total_count = len(getattr(self, "all_users", []))
        self.lbl_accounts_stats.config(text=f"Total Cuentas: {total_count} (Filtradas: {len(filtered)})")

    def clear_user_search(self):
        self.entry_search_user.delete(0, tk.END)
        self.combo_role_filter.set("Todos")
        self.filter_accounts()

    def on_user_select(self, event):
        selected = self.tree_users.selection()
        if not selected:
            return
        user_id = self.tree_users.item(selected[0])["values"][0]

        user = next((u for u in self.all_users if u["id"] == user_id), None)
        if not user:
            return

        tel_dec = decrypt_aes_gcm(user["telefono_cifrado"]) or "(No registrado)"
        dir_dec = decrypt_aes_gcm(user["direccion_cifrada"]) or "(No registrada)"

        info = (
            f"Nombre: {user['nombre']}  |  Correo: {user['email']}  |  Rol: {user['rol'].upper()}\n"
            f"Teléfono (Descifrado): {tel_dec}  |  Dirección (Descifrada): {dir_dec}\n"
            f"MFA: {'Habilitado' if user['mfa_enabled'] else 'Deshabilitado'}  |  "
            f"Membresía: {'Activa (' + str(user['membresia_plan']) + ')' if user['membresia_premium'] else 'Sin membresía'}  |  "
            f"Hash Pass: {user['password_hash'][:28]}..."
        )
        self.lbl_user_detail_text.config(text=info, fg=COLOR_NAVY_DARK)

    # ==========================================================================
    # PESTAÑA 3: CREAR CUENTAS DE ADMINISTRADOR, VENDEDOR Y AUDITOR
    # ==========================================================================
    def build_create_account_tab(self):
        frame = self.tab_create_account

        card = tk.LabelFrame(
            frame,
            text=" Formulario Seguro de Alta de Cuentas Especiales (SGC MC-001) ",
            font=("DejaVu Sans", 11, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=25,
            pady=18
        )
        card.pack(fill=tk.BOTH, expand=True, padx=25, pady=15)

        tk.Label(
            card,
            text="Crea cuentas de acceso administrativo con hash scrypt y cifrado AES-256-GCM conforme a ISO/IEC 27001.",
            font=("DejaVu Sans", 9),
            fg=COLOR_TEXT_MUTED,
            bg=COLOR_SURFACE
        ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 15))

        # 1. Rol de la cuenta
        tk.Label(card, text="Rol Asignado *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=6)
        self.var_new_role = tk.StringVar(value="administrador")
        role_frame = tk.Frame(card, bg=COLOR_SURFACE)
        role_frame.grid(row=1, column=1, sticky="w", pady=6)

        roles = [
            ("Administrador", "administrador"),
            ("Vendedor", "vendedor"),
            ("Auditor", "auditor"),
            ("Soporte", "soporte")
        ]
        for text, val in roles:
            tk.Radiobutton(
                role_frame, text=text, value=val, variable=self.var_new_role,
                bg=COLOR_SURFACE, activebackground=COLOR_SURFACE, font=("DejaVu Sans", 9)
            ).pack(side=tk.LEFT, padx=(0, 12))

        # 2. Nombre Completo
        tk.Label(card, text="Nombre Completo *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=6)
        self.entry_new_name = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_name.grid(row=2, column=1, sticky="w", pady=6)
        self.entry_new_name.insert(0, "Ing. Alejandro Morales (Auditor SGC)")

        # 3. Correo Electrónico
        tk.Label(card, text="Correo Electrónico *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=6)
        self.entry_new_email = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_email.grid(row=3, column=1, sticky="w", pady=6)
        self.entry_new_email.insert(0, "auditor.seguridad@expressmart.mx")

        # 4. Contraseña
        tk.Label(card, text="Contraseña Segura *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=6)
        pwd_box = tk.Frame(card, bg=COLOR_SURFACE)
        pwd_box.grid(row=4, column=1, sticky="w", pady=6)

        self.entry_new_pwd = ttk.Entry(pwd_box, width=28, font=("DejaVu Sans", 9), show="*")
        self.entry_new_pwd.pack(side=tk.LEFT, padx=(0, 6))
        self.entry_new_pwd.insert(0, "Auditor2026!#Segura")

        btn_toggle_p = ttk.Button(pwd_box, text="Ver", width=6, command=self.toggle_pwd_visibility)
        btn_toggle_p.pack(side=tk.LEFT, padx=(0, 6))

        btn_gen_pwd = ttk.Button(pwd_box, text="Generar", width=9, command=self.generate_secure_pwd)
        btn_gen_pwd.pack(side=tk.LEFT)

        # 5. Teléfono
        tk.Label(card, text="Teléfono de Contacto:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=5, column=0, sticky="w", pady=6)
        self.entry_new_tel = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_tel.grid(row=5, column=1, sticky="w", pady=6)
        self.entry_new_tel.insert(0, "+52 55 9876 5432")

        # 6. Dirección Física
        tk.Label(card, text="Dirección Operativa:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=6, column=0, sticky="w", pady=6)
        self.entry_new_dir = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_dir.grid(row=6, column=1, sticky="w", pady=6)
        self.entry_new_dir.insert(0, "Insurgentes Sur 1602, Crédito Constructor, CDMX")

        # 7. Checkbox MFA
        self.var_new_mfa = tk.BooleanVar(value=True)
        cb_mfa = tk.Checkbutton(
            card,
            text="Habilitar Verificación de Dos Pasos (MFA / 2FA) por defecto",
            variable=self.var_new_mfa,
            bg=COLOR_SURFACE,
            activebackground=COLOR_SURFACE,
            font=("DejaVu Sans", 9)
        )
        cb_mfa.grid(row=7, column=1, sticky="w", pady=(8, 15))

        # Botón de Crear Cuenta
        btn_create = tk.Button(
            card,
            text="Crear y Registrar Cuenta en ExpressMart",
            font=("DejaVu Sans", 10, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=18,
            pady=8,
            relief="flat",
            cursor="hand2",
            command=self.submit_create_account
        )
        btn_create.grid(row=8, column=1, sticky="w", pady=5)

    def toggle_pwd_visibility(self):
        cur = self.entry_new_pwd.cget("show")
        self.entry_new_pwd.config(show="" if cur == "*" else "*")

    def generate_secure_pwd(self):
        import random, string
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        # Asegurar al menos 1 mayuscula, 1 minuscula, 1 digito y 1 simbolo
        pwd = [
            random.choice(string.ascii_uppercase),
            random.choice(string.ascii_lowercase),
            random.choice(string.digits),
            random.choice("!@#$%^&*")
        ]
        pwd += [random.choice(chars) for _ in range(10)]
        random.shuffle(pwd)
        generated = "".join(pwd)
        self.entry_new_pwd.delete(0, tk.END)
        self.entry_new_pwd.insert(0, generated)
        self.entry_new_pwd.config(show="")

    def submit_create_account(self):
        role = self.var_new_role.get().strip().lower()
        nombre = self.entry_new_name.get().strip()
        email = self.entry_new_email.get().strip().lower()
        pwd = self.entry_new_pwd.get().strip()
        tel = self.entry_new_tel.get().strip()
        direccion = self.entry_new_dir.get().strip()
        mfa_enabled = 1 if self.var_new_mfa.get() else 0

        # Validaciones
        if not nombre or len(nombre) < 3:
            messagebox.showerror("Error de Validación", "El nombre debe tener al menos 3 caracteres.")
            return
        if not email or "@" not in email or "." not in email:
            messagebox.showerror("Error de Validación", "Ingrese un correo electrónico válido.")
            return
        if not pwd or len(pwd) < 8:
            messagebox.showerror("Error de Validación", "La contraseña debe tener al menos 8 caracteres (OWASP ASVS / SEG-01).")
            return

        con, _ = get_db()
        try:
            # Verificar duplicidad de email
            existing = con.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email,)).fetchone()
            if existing:
                messagebox.showerror("Error", f"El correo '{email}' ya se encuentra registrado.")
                return

            now_iso = datetime.utcnow().isoformat() + "Z"
            pwd_hash = hash_password_scrypt(pwd)
            tel_enc = encrypt_aes_gcm(tel)
            dir_enc = encrypt_aes_gcm(direccion)
            mfa_secret = os.urandom(16).hex().upper() if mfa_enabled else None

            res = con.execute("""
                INSERT INTO usuarios (
                    email, password_hash, nombre, rol, mfa_enabled, mfa_secret,
                    direccion_cifrada, telefono_cifrado, consentimiento_privacidad,
                    aviso_privacidad_version, failed_attempts, locked_until, activo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'v1.0-2026', 0, 0, 1, ?)
            """, (email, pwd_hash, nombre, role, mfa_enabled, mfa_secret, dir_enc, tel_enc, now_iso))
            con.commit()

            new_user_id = res.lastrowid

            # Registrar en bitácora D8
            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="CREAR_CUENTA_PRIVILEGIADA",
                modulo="Gestión de Cuentas",
                entidad_id=str(new_user_id),
                detalles={
                    "usuario_creado_id": new_user_id,
                    "nombre": nombre,
                    "email": email,
                    "rol": role,
                    "mfa_habilitado": mfa_enabled
                }
            )

            messagebox.showinfo(
                "¡Cuenta Creada Exitosamente!",
                f"La cuenta ha sido dada de alta correctamente:\n\n"
                f"• ID: {new_user_id}\n"
                f"• Nombre: {nombre}\n"
                f"• Rol: {role.upper()}\n"
                f"• Correo: {email}\n"
                f"• Contraseña: {pwd}\n"
                f"• 2FA / MFA: {'Habilitado' if mfa_enabled else 'Deshabilitado'}\n\n"
                f"Se ha registrado el evento en la bitácora inmutable D8."
            )

            # Refrescar otras pestañas
            self.refresh_accounts_data()
            self.refresh_finance_data()

        except Exception as e:
            messagebox.showerror("Error al Crear Cuenta", str(e))
        finally:
            con.close()

    # ==========================================================================
    # PESTAÑA 4: LOG DE VENTAS Y REPORTES
    # ==========================================================================
    def build_sales_tab(self):
        frame = self.tab_sales

        # Barra superior de filtros y botones de reporte
        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        tk.Label(top_box, text="Método:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_sales_method = ttk.Combobox(
            top_box,
            values=["Todos", "tarjeta", "paypal", "wallet", "msi"],
            state="readonly",
            width=10
        )
        self.combo_sales_method.set("Todos")
        self.combo_sales_method.pack(side=tk.LEFT, padx=(0, 10))
        self.combo_sales_method.bind("<<ComboboxSelected>>", lambda _: self.filter_sales())

        tk.Label(top_box, text="Estado:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_sales_state = ttk.Combobox(
            top_box,
            values=["Todos", "pagado", "entregado", "procesando", "enviado", "devuelto"],
            state="readonly",
            width=11
        )
        self.combo_sales_state.set("Todos")
        self.combo_sales_state.pack(side=tk.LEFT, padx=(0, 15))
        self.combo_sales_state.bind("<<ComboboxSelected>>", lambda _: self.filter_sales())

        # Botones de Acción y Reportes
        btn_export_txt = tk.Button(
            top_box,
            text="Generar Reporte TXT",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=self.action_generate_report_txt
        )
        btn_export_txt.pack(side=tk.LEFT, padx=(0, 6))

        btn_export_csv = tk.Button(
            top_box,
            text="Exportar CSV (Excel)",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS,
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=self.action_export_csv
        )
        btn_export_csv.pack(side=tk.LEFT, padx=(0, 6))

        btn_paypal_filter = tk.Button(
            top_box,
            text="Solo PayPal",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_ACCENT_GOLD,
            fg=COLOR_NAVY_DARK,
            activebackground="#f4b628",
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self.filter_only_paypal
        )
        btn_paypal_filter.pack(side=tk.LEFT)

        self.lbl_sales_summary_stat = tk.Label(
            top_box,
            text="Total Vendido: $0.00 MXN",
            font=("DejaVu Sans", 10, "bold"),
            fg=COLOR_SUCCESS_DARK,
            bg=COLOR_BG
        )
        self.lbl_sales_summary_stat.pack(side=tk.RIGHT)

        # Tabla de Ventas
        table_container = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "folio", "created_at", "cliente", "metodo", "estado", "subtotal", "iva", "total", "ref")
        self.tree_sales = ttk.Treeview(
            table_container,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_sales.heading("id", text="#")
        self.tree_sales.heading("folio", text="Folio Pedido")
        self.tree_sales.heading("created_at", text="Fecha / Hora")
        self.tree_sales.heading("cliente", text="Cliente")
        self.tree_sales.heading("metodo", text="Método")
        self.tree_sales.heading("estado", text="Estado")
        self.tree_sales.heading("subtotal", text="Subtotal")
        self.tree_sales.heading("iva", text="IVA 16%")
        self.tree_sales.heading("total", text="Total (MXN)")
        self.tree_sales.heading("ref", text="Ref. Pasarela")

        self.tree_sales.column("id", width=35, anchor="center")
        self.tree_sales.column("folio", width=190, anchor="w")
        self.tree_sales.column("created_at", width=140, anchor="center")
        self.tree_sales.column("cliente", width=170, anchor="w")
        self.tree_sales.column("metodo", width=80, anchor="center")
        self.tree_sales.column("estado", width=80, anchor="center")
        self.tree_sales.column("subtotal", width=95, anchor="e")
        self.tree_sales.column("iva", width=85, anchor="e")
        self.tree_sales.column("total", width=110, anchor="e")
        self.tree_sales.column("ref", width=160, anchor="w")

        sb_y = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree_sales.yview)
        self.tree_sales.configure(yscrollcommand=sb_y.set)
        sb_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_sales.pack(fill=tk.BOTH, expand=True)

        self.tree_sales.bind("<<TreeviewSelect>>", self.on_sale_select)

        # Panel inferior: Artículos del pedido seleccionado
        items_frame = tk.LabelFrame(
            frame,
            text=" Artículos Comprados en el Pedido Seleccionado ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=6
        )
        items_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        cols_items = ("prod_id", "nombre", "cantidad", "unitario", "subtotal")
        self.tree_order_items = ttk.Treeview(
            items_frame,
            columns=cols_items,
            show="headings",
            height=3,
            style="Admin.Treeview"
        )
        self.tree_order_items.heading("prod_id", text="ID")
        self.tree_order_items.heading("nombre", text="Producto")
        self.tree_order_items.heading("cantidad", text="Cant.")
        self.tree_order_items.heading("unitario", text="Precio Unitario")
        self.tree_order_items.heading("subtotal", text="Subtotal")

        self.tree_order_items.column("prod_id", width=50, anchor="center")
        self.tree_order_items.column("nombre", width=480, anchor="w")
        self.tree_order_items.column("cantidad", width=60, anchor="center")
        self.tree_order_items.column("unitario", width=120, anchor="e")
        self.tree_order_items.column("subtotal", width=120, anchor="e")

        self.tree_order_items.pack(fill=tk.X)

    def refresh_sales_data(self):
        con, _ = get_db()
        self.all_sales = con.execute("""
            SELECT 
                p.id,
                p.folio,
                u.nombre as cliente_nombre,
                u.email as cliente_email,
                p.metodo_pago,
                p.estado,
                p.subtotal,
                p.impuestos,
                p.costo_envio,
                p.descuento,
                p.total,
                t.referencia_pasarela,
                p.created_at
            FROM pedidos p
            JOIN usuarios u ON p.usuario_id = u.id
            LEFT JOIN transacciones t ON p.id = t.pedido_id
            ORDER BY p.id DESC
        """).fetchall()
        con.close()

        self.filter_sales()

    def filter_sales(self):
        method_filter = self.combo_sales_method.get().lower()
        state_filter = self.combo_sales_state.get().lower()

        for item in self.tree_sales.get_children():
            self.tree_sales.delete(item)

        filtered = []
        total_sum = 0.0

        for s in getattr(self, "all_sales", []):
            if method_filter != "todos" and s["metodo_pago"].lower() != method_filter:
                continue
            if state_filter != "todos" and s["estado"].lower() != state_filter:
                continue

            filtered.append(s)
            if s["estado"] in ("pagado", "entregado", "procesando", "enviado"):
                total_sum += float(s["total"])

        for s in filtered:
            estado_tag = s["estado"]
            self.tree_sales.insert(
                "",
                tk.END,
                values=(
                    s["id"],
                    s["folio"],
                    s["created_at"][:19],
                    s["cliente_nombre"],
                    s["metodo_pago"].upper(),
                    s["estado"].upper(),
                    f"${s['subtotal']:,.2f}",
                    f"${s['impuestos']:,.2f}",
                    f"${s['total']:,.2f}",
                    s["referencia_pasarela"] or "N/A"
                ),
                tags=(estado_tag,)
            )

        self.lbl_sales_summary_stat.config(
            text=f"Total Vendido: ${total_sum:,.2f} MXN  ({len(filtered)} pedidos)"
        )

    def filter_only_paypal(self):
        self.combo_sales_method.set("paypal")
        self.combo_sales_state.set("Todos")
        self.filter_sales()

    def on_sale_select(self, event):
        selected = self.tree_sales.selection()
        if not selected:
            return
        order_id = self.tree_sales.item(selected[0])["values"][0]

        for item in self.tree_order_items.get_children():
            self.tree_order_items.delete(item)

        con, _ = get_db()
        items = con.execute("""
            SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal
            FROM pedido_items
            WHERE pedido_id = ?
        """, (order_id,)).fetchall()
        con.close()

        for it in items:
            self.tree_order_items.insert(
                "",
                tk.END,
                values=(
                    it["producto_id"],
                    it["nombre_producto"],
                    it["cantidad"],
                    f"${it['precio_unitario']:,.2f}",
                    f"${it['subtotal']:,.2f}"
                )
            )

    def action_generate_report_txt(self):
        try:
            res = generate_sales_report_files()
            msg = (
                f"Reporte Ejecutivo de Ventas generado con éxito:\n\n"
                f"Archivo TXT: {res['txt_path']}\n"
                f"Total Vendido: ${res['total_dinero']:,.2f} MXN\n"
                f"Total Pedidos: {res['num_pedidos']}\n"
                f"Firma SHA-256: {res['sha256'][:24]}...\n\n"
                f"¿Deseas abrir el archivo de reporte ahora?"
            )
            if messagebox.askyesno("Reporte Generado", msg):
                if sys.platform == "linux":
                    subprocess.Popen(["xdg-open", res["txt_path"]])
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", res["txt_path"]])
                elif sys.platform == "win32":
                    os.startfile(res["txt_path"])
        except Exception as e:
            messagebox.showerror("Error al Generar Reporte", str(e))

    def action_export_csv(self):
        try:
            res = generate_sales_report_files()
            messagebox.showinfo(
                "Exportación Completada",
                f"Se ha exportado el archivo CSV para Microsoft Excel:\n\n"
                f"Archivo: {res['csv_path']}\n\n"
                f"Contiene el listado completo de pedidos, subtotales, IVA y referencias de pago."
            )
        except Exception as e:
            messagebox.showerror("Error al Exportar CSV", str(e))

    def refresh_all(self):
        self.refresh_finance_data()
        self.refresh_accounts_data()
        self.refresh_sales_data()


# ==============================================================================
# MODO LÍNEA DE COMANDOS (CLI FALLBACK SI NO HAY ENTORNO X11 / WAYLAND)
# ==============================================================================
def run_cli_mode():
    print("=" * 80)
    print("EXPRESSMART MÉXICO - PANEL ADMINISTRATIVO Y FINANCIERO (MODO CLI)")
    print("=" * 80)
    while True:
        print("\nSeleccione una opción:")
        print("1. Ver Dinero y Balance Total de ExpressMart")
        print("2. Listar Cuentas del Sistema")
        print("3. Crear Cuenta (Admin, Vendedor, Auditor)")
        print("4. Ver Log de Ventas")
        print("5. Generar y Exportar Reporte de Ventas (TXT & CSV)")
        print("6. Salir")

        opt = input("\nOpción (1-6): ").strip()
        if opt == "1":
            s = get_financial_summary()
            print("\n" + "=" * 60)
            print(f"DINERO TOTAL EXPRESSMART:   ${s['total_dinero_expressmart']:,.2f} MXN")
            print(f"Ventas Brutas Catálogo:     ${s['total_ventas_bruto']:,.2f} MXN ({s['total_pedidos_pagados']} compras)")
            print(f"Suscripciones ExpressPrime: ${s['total_suscripciones']:,.2f} MXN ({s['suscripciones_activas']} miembros)")
            print(f"IVA Retenido SAT (16%):     ${s['iva_retenido_sat']:,.2f} MXN")
            print(f"PayPal Sandbox:             ${s['metodos_pago'].get('paypal', {}).get('total', 0.0):,.2f} MXN")
            print("=" * 60)
        elif opt == "2":
            con, _ = get_db()
            users = con.execute("SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY id").fetchall()
            print(f"\n{'ID':<4} {'ROL':<14} {'NOMBRE':<32} {'EMAIL':<30}")
            print("-" * 80)
            for u in users:
                print(f"{u['id']:<4} {u['rol'].upper():<14} {u['nombre'][:30]:<32} {u['email'][:30]:<30}")
            con.close()
        elif opt == "3":
            print("\n--- CREAR CUENTA PRIVILEGIADA ---")
            role = input("Rol (administrador/vendedor/auditor/soporte): ").strip().lower()
            nombre = input("Nombre completo: ").strip()
            email = input("Correo electrónico: ").strip().lower()
            pwd = input("Contraseña: ").strip()
            if not nombre or not email or len(pwd) < 8:
                print("Error: Todos los campos son obligatorios y contraseña >= 8 car.")
                continue
            con, _ = get_db()
            now_iso = datetime.utcnow().isoformat() + "Z"
            pwd_hash = hash_password_scrypt(pwd)
            res = con.execute("""
                INSERT INTO usuarios (email, password_hash, nombre, rol, mfa_enabled, consentimiento_privacidad, activo, created_at)
                VALUES (?, ?, ?, ?, 1, 1, 1, ?)
            """, (email, pwd_hash, nombre, role, now_iso))
            con.commit()
            record_audit_log_entry(con, 1, "administrador", "CREAR_CUENTA_PRIVILEGIADA", "Gestión Cuentas", str(res.lastrowid), {"email": email, "rol": role})
            con.close()
            print(f"[OK] Cuenta creada con éxito (ID: {res.lastrowid})")
        elif opt == "4":
            con, _ = get_db()
            orders = con.execute("SELECT p.id, p.folio, u.nombre, p.metodo_pago, p.estado, p.total FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id ORDER BY p.id DESC LIMIT 20").fetchall()
            print(f"\n{'FOLIO':<28} {'CLIENTE':<24} {'METODO':<8} {'ESTADO':<10} {'TOTAL MXN':>12}")
            print("-" * 84)
            for o in orders:
                print(f"{o['folio']:<28} {o['nombre'][:22]:<24} {o['metodo_pago'].upper():<8} {o['estado'].upper():<10} ${o['total']:>11,.2f}")
            con.close()
        elif opt == "5":
            res = generate_sales_report_files()
            print(f"\n[OK] Reporte TXT generado en: {res['txt_path']}")
            print(f"[OK] Reporte CSV generado en: {res['csv_path']}")
            print(f"Total Vendido: ${res['total_dinero']:,.2f} MXN (Firma: {res['sha256'][:24]}...)")
        elif opt == "6":
            break


# ==============================================================================
# PUNTO DE ENTRADA PRINCIPAL
# ==============================================================================
def main():
    if "--cli" in sys.argv or not HAS_GUI:
        run_cli_mode()
    else:
        root = tk.Tk()
        # Intentar cargar icono PNG si está disponible
        logo_path = os.path.join(BASE_DIR, "public", "assets", "logo.png")
        if os.path.exists(logo_path):
            try:
                icon_img = tk.PhotoImage(file=logo_path)
                root.iconphoto(True, icon_img)
            except Exception:
                pass
        app = AdminPanelGUI(root)
        root.mainloop()


if __name__ == "__main__":
    main()
