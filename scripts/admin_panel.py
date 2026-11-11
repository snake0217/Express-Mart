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
import webbrowser
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


def ensure_simulated_cards_table(con):
    try:
        con.execute("""
            CREATE TABLE IF NOT EXISTS tarjetas_simuladas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_tarjeta TEXT UNIQUE NOT NULL,
                titular TEXT NOT NULL,
                expiracion TEXT NOT NULL,
                cvv TEXT NOT NULL,
                saldo REAL NOT NULL CHECK (saldo >= 0),
                saldo_inicial REAL NOT NULL DEFAULT 0,
                marca TEXT NOT NULL DEFAULT 'Visa',
                tipo TEXT NOT NULL DEFAULT 'credito',
                activa INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        count = con.execute("SELECT COUNT(*) FROM tarjetas_simuladas").fetchone()[0]
        if count == 0:
            now_iso = datetime.utcnow().isoformat() + "Z"
            seeds = [
                ('4111 1111 1111 4242', 'CLIENTE EXPRESSMART', '12/29', '123', 50000.0, 50000.0, 'Visa', 'credito', 1, now_iso, now_iso),
                ('5500 0000 0000 1234', 'DIEGO ALARCON PRUEBAS', '08/28', '456', 25000.0, 25000.0, 'Mastercard', 'debito', 1, now_iso, now_iso),
                ('3782 8224 6310 005', 'EMPRESA EXPRESSMART S.A.', '10/27', '789', 100000.0, 100000.0, 'American Express', 'corporativa', 1, now_iso, now_iso),
                ('4000 1234 5678 9010', 'TARJETA SALDO INSUFICIENTE', '05/26', '999', 50.0, 50.0, 'Visa', 'debito', 1, now_iso, now_iso)
            ]
            con.executemany("""
                INSERT INTO tarjetas_simuladas (
                    numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, seeds)
            con.commit()
    except Exception:
        pass


def ensure_refund_requests_table(con):
    try:
        con.execute("""
            CREATE TABLE IF NOT EXISTS solicitudes_reembolso (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                monto REAL NOT NULL,
                motivo TEXT NOT NULL,
                estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'denegada')),
                respuesta_admin TEXT,
                fecha_solicitud TEXT NOT NULL,
                fecha_resolucion TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        """)
        count = con.execute("SELECT COUNT(*) FROM solicitudes_reembolso").fetchone()[0]
        if count == 0:
            orders = con.execute("SELECT id, usuario_id, total, folio FROM pedidos WHERE estado IN ('pagado', 'enviado', 'entregado') ORDER BY id ASC LIMIT 2").fetchall()
            now_iso = datetime.utcnow().isoformat() + "Z"
            if len(orders) > 0:
                o1 = orders[0]
                con.execute("""
                    INSERT INTO solicitudes_reembolso (pedido_id, usuario_id, monto, motivo, estado, fecha_solicitud, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)
                """, (o1['id'], o1['usuario_id'], o1['total'], 'El producto llegó con detalle estético en el empaque y solicito devolución bajo garantía LFPC.', now_iso, now_iso, now_iso))
            if len(orders) > 1:
                o2 = orders[1]
                con.execute("""
                    INSERT INTO solicitudes_reembolso (pedido_id, usuario_id, monto, motivo, estado, fecha_solicitud, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)
                """, (o2['id'], o2['usuario_id'], o2['total'], 'Compré dos unidades por equivocación en el checkout, solicito devolución de la orden.', now_iso, now_iso, now_iso))
            con.commit()
    except Exception:
        pass


def delete_user_cascade(con, user_id: int):
    """Eliminación limpia y en cascada de un usuario sin violar llaves foráneas."""
    user = con.execute("SELECT id, email, nombre, rol FROM usuarios WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise ValueError(f"Usuario {user_id} no existe.")
    if user_id == 1:
        raise ValueError("No es posible eliminar al Superadministrador principal (ID 1).")

    # Limpiar tablas dependientes
    con.execute("DELETE FROM sesiones WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM carrito_items WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM mfa_email_codes WHERE email = ?", (user["email"],))
    con.execute("DELETE FROM suscripciones_premium WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM notificaciones WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM solicitudes_reembolso WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM derechos_arco WHERE usuario_id = ?", (user_id,))
    con.execute("DELETE FROM resenas WHERE usuario_id = ?", (user_id,))

    # Pedidos asociados
    pedidos = con.execute("SELECT id FROM pedidos WHERE usuario_id = ?", (user_id,)).fetchall()
    for p in pedidos:
        pid = p["id"]
        con.execute("DELETE FROM pedido_items WHERE pedido_id = ?", (pid,))
        con.execute("DELETE FROM transacciones WHERE pedido_id = ?", (pid,))
        con.execute("DELETE FROM envios WHERE pedido_id = ?", (pid,))
        con.execute("DELETE FROM solicitudes_reembolso WHERE pedido_id = ?", (pid,))
        con.execute("DELETE FROM pedidos WHERE id = ?", (pid,))

    con.execute("UPDATE catalogo SET vendedor_id = 1 WHERE vendedor_id = ?", (user_id,))
    con.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))

    record_audit_log_sql(con, {
        "usuario_id": 1,
        "rol": "administrador",
        "accion": "ELIMINACION_USUARIO_ADMIN",
        "modulo": "Cuentas y Accesos (SGC / ISO 27001)",
        "entidad_id": f"USER-{user_id}",
        "detalles": json.dumps({"usuario_eliminado": user["email"], "nombre": user["nombre"], "rol": user["rol"]})
    })
    con.commit()
    return user


def get_db():
    db_path = find_database_path()
    if not os.path.exists(db_path):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    ensure_simulated_cards_table(con)
    ensure_refund_requests_table(con)
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

        # Crear las 7 Ventanas / Pestañas principales requeridas:
        self.tab_finance = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_accounts = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_create_account = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_cards = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_refunds = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_sales = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_logistics = ttk.Frame(self.notebook, style="Admin.TFrame")

        self.notebook.add(self.tab_finance, text=" Dinero y Balance ExpressMart ")
        self.notebook.add(self.tab_accounts, text=" Cuentas del Sistema ")
        self.notebook.add(self.tab_create_account, text=" Crear Cuentas (Admin/Vendedor/Auditor) ")
        self.notebook.add(self.tab_cards, text=" Tarjetas y Saldo (Compras) ")
        self.notebook.add(self.tab_refunds, text=" Peticiones de Reembolso ")
        self.notebook.add(self.tab_sales, text=" Log de Ventas y Reportes ")
        self.notebook.add(self.tab_logistics, text=" Envíos y Almacenes (OpenStreetMap) ")

        # Construir cada pestaña
        self.build_finance_tab()
        self.build_accounts_tab()
        self.build_create_account_tab()
        self.build_cards_tab()
        self.build_refunds_tab()
        self.build_sales_tab()
        self.build_logistics_tab()

        # Cargar datos iniciales
        self.refresh_finance_data()
        self.refresh_accounts_data()
        self.refresh_cards_data()
        self.refresh_refunds_data()
        self.refresh_sales_data()
        self.refresh_logistics_data()

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
        btn_search_clear.pack(side=tk.LEFT, padx=(0, 10))

        btn_edit_user_top = tk.Button(
            top_box,
            text="Modificar Cuenta Seleccionada",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.open_edit_user_dialog
        )
        btn_edit_user_top.pack(side=tk.LEFT, padx=(0, 10))

        btn_delete_user_top = tk.Button(
            top_box,
            text="Eliminar Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.delete_selected_user
        )
        btn_delete_user_top.pack(side=tk.LEFT, padx=(0, 15))

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
        self.tree_users.bind("<Double-1>", lambda _: self.open_edit_user_dialog())

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

        detail_content_box = tk.Frame(self.detail_user_frame, bg=COLOR_SURFACE)
        detail_content_box.pack(fill=tk.X)

        self.lbl_user_detail_text = tk.Label(
            detail_content_box,
            text="Selecciona una cuenta en la tabla para inspeccionar sus datos y teléfono/dirección descifrados.",
            font=("DejaVu Sans", 9),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_user_detail_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_edit_detail = tk.Button(
            detail_content_box,
            text="Editar Datos de Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_ACCENT_AMBER,
            fg="#ffffff",
            activebackground="#b45309",
            activeforeground="#ffffff",
            padx=12,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.open_edit_user_dialog
        )
        btn_edit_detail.pack(side=tk.RIGHT, padx=5)

        btn_delete_detail = tk.Button(
            detail_content_box,
            text="Eliminar Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            padx=12,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.delete_selected_user
        )
        btn_delete_detail.pack(side=tk.RIGHT, padx=5)

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

    def open_edit_user_dialog(self, target_user_id=None):
        """Abre modal interactivo para modificar todos los datos de una cuenta"""
        if target_user_id is None:
            selected = self.tree_users.selection()
            if not selected:
                messagebox.showwarning("Selección Requerida", "Por favor seleccione una cuenta en la tabla para modificar sus datos.")
                return
            target_user_id = self.tree_users.item(selected[0])["values"][0]

        con, _ = get_db()
        user = con.execute("SELECT * FROM usuarios WHERE id = ?", (target_user_id,)).fetchone()
        con.close()

        if not user:
            messagebox.showerror("Error", f"No se encontró el usuario con ID #{target_user_id}.")
            return

        tel_dec = decrypt_aes_gcm(user["telefono_cifrado"]) if user["telefono_cifrado"] else ""
        dir_dec = decrypt_aes_gcm(user["direccion_cifrada"]) if user["direccion_cifrada"] else ""

        dlg = tk.Toplevel(self.root)
        dlg.title(f"Modificar Cuenta #{user['id']} - ExpressMart")
        dlg.geometry("560x650")
        dlg.minsize(520, 600)
        dlg.configure(bg=COLOR_BG)
        dlg.transient(self.root)
        dlg.grab_set()

        # Encabezado
        header = tk.Frame(dlg, bg=COLOR_NAVY_DARK, padx=16, pady=12)
        header.pack(fill=tk.X)
        tk.Label(
            header,
            text=f"MODIFICAR CUENTA: {user['nombre']}",
            font=("DejaVu Sans", 11, "bold"),
            fg=COLOR_ACCENT_GOLD,
            bg=COLOR_NAVY_DARK
        ).pack(anchor="w")
        tk.Label(
            header,
            text=f"ID #{user['id']}  ·  Correo Actual: {user['email']}",
            font=("DejaVu Sans", 9),
            fg="#cbd5e1",
            bg=COLOR_NAVY_DARK
        ).pack(anchor="w")

        body = tk.Frame(dlg, bg=COLOR_SURFACE, padx=20, pady=15, relief="solid", bd=1)
        body.pack(fill=tk.BOTH, expand=True, padx=16, pady=12)

        # 1. Nombre
        tk.Label(body, text="Nombre Completo *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=0, column=0, sticky="w", pady=5)
        e_nombre = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_nombre.grid(row=0, column=1, sticky="w", pady=5)
        e_nombre.insert(0, user["nombre"] or "")

        # 2. Email
        tk.Label(body, text="Correo Electrónico *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=5)
        e_email = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_email.grid(row=1, column=1, sticky="w", pady=5)
        e_email.insert(0, user["email"] or "")

        # 3. Rol
        tk.Label(body, text="Rol en Sistema *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=5)
        combo_rol = ttk.Combobox(body, values=["cliente", "vendedor", "administrador", "soporte", "auditor"], state="readonly", width=22)
        combo_rol.set(user["rol"])
        combo_rol.grid(row=2, column=1, sticky="w", pady=5)

        # 4. Estado de Cuenta
        tk.Label(body, text="Estado de Cuenta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=5)
        combo_activo = ttk.Combobox(body, values=["1 - Activa", "0 - Inactiva / Bloqueada"], state="readonly", width=22)
        combo_activo.set("1 - Activa" if user["activo"] else "0 - Inactiva / Bloqueada")
        combo_activo.grid(row=3, column=1, sticky="w", pady=5)

        # 5. Teléfono
        tk.Label(body, text="Teléfono de Contacto:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=5)
        e_tel = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_tel.grid(row=4, column=1, sticky="w", pady=5)
        e_tel.insert(0, tel_dec)

        # 6. Dirección
        tk.Label(body, text="Dirección Operativa:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=5, column=0, sticky="w", pady=5)
        e_dir = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_dir.grid(row=5, column=1, sticky="w", pady=5)
        e_dir.insert(0, dir_dec)

        # 7. Membresía Prime
        tk.Label(body, text="Membresía ExpressPrime:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=6, column=0, sticky="w", pady=5)
        combo_prime = ttk.Combobox(body, values=["Sin Membresía", "1_mes", "3_meses", "1_ano"], state="readonly", width=22)
        if user["membresia_premium"] and user["membresia_plan"]:
            combo_prime.set(user["membresia_plan"])
        else:
            combo_prime.set("Sin Membresía")
        combo_prime.grid(row=6, column=1, sticky="w", pady=5)

        # 8. 2FA / MFA
        var_mfa = tk.BooleanVar(value=bool(user["mfa_enabled"]))
        cb_mfa = tk.Checkbutton(
            body,
            text="Verificación de Dos Pasos (2FA) Habilitada",
            variable=var_mfa,
            bg=COLOR_SURFACE,
            activebackground=COLOR_SURFACE,
            font=("DejaVu Sans", 9)
        )
        cb_mfa.grid(row=7, column=1, sticky="w", pady=6)

        # 9. Cambiar / Restablecer Contraseña
        tk.Label(body, text="Nueva Contraseña (Opcional):", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=8, column=0, sticky="w", pady=5)
        p_frame = tk.Frame(body, bg=COLOR_SURFACE)
        p_frame.grid(row=8, column=1, sticky="w", pady=5)
        e_pwd = ttk.Entry(p_frame, width=22, font=("DejaVu Sans", 9), show="*")
        e_pwd.pack(side=tk.LEFT, padx=(0, 5))
        btn_show_p = ttk.Button(p_frame, text="Ver", width=5, command=lambda: e_pwd.config(show="" if e_pwd.cget("show") == "*" else "*"))
        btn_show_p.pack(side=tk.LEFT)

        tk.Label(body, text="Deja en blanco para conservar la contraseña actual (mínimo 8 caracteres si se cambia).", font=("DejaVu Sans", 8), fg=COLOR_TEXT_MUTED, bg=COLOR_SURFACE).grid(row=9, column=1, sticky="w", pady=(0, 10))

        # Botones de Acción
        btn_box = tk.Frame(dlg, bg=COLOR_BG, padx=16, pady=10)
        btn_box.pack(fill=tk.X)

        def save_changes():
            new_nombre = e_nombre.get().strip()
            new_email = e_email.get().strip().lower()
            new_rol = combo_rol.get().strip().lower()
            new_activo = 1 if "1" in combo_activo.get() else 0
            new_tel = e_tel.get().strip()
            new_dir = e_dir.get().strip()
            prime_val = combo_prime.get().strip()
            new_mfa = 1 if var_mfa.get() else 0
            new_pwd = e_pwd.get().strip()

            if not new_nombre or len(new_nombre) < 3:
                messagebox.showerror("Validación", "El nombre debe tener al menos 3 caracteres.", parent=dlg)
                return
            if not new_email or "@" not in new_email or "." not in new_email:
                messagebox.showerror("Validación", "Ingrese un correo electrónico válido.", parent=dlg)
                return
            if new_pwd and len(new_pwd) < 8:
                messagebox.showerror("Validación", "La nueva contraseña debe tener mínimo 8 caracteres (OWASP ASVS).", parent=dlg)
                return

            con, _ = get_db()
            try:
                # Comprobar si email ya existe en otra cuenta
                dup = con.execute("SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?", (new_email, user["id"])).fetchone()
                if dup:
                    messagebox.showerror("Error", f"El correo '{new_email}' ya pertenece a la cuenta #{dup[0]}.", parent=dlg)
                    return

                new_tel_enc = encrypt_aes_gcm(new_tel) if new_tel else None
                new_dir_enc = encrypt_aes_gcm(new_dir) if new_dir else None
                is_premium = 1 if prime_val != "Sin Membresía" else 0
                prime_plan = prime_val if is_premium else None

                con.execute("""
                    UPDATE usuarios
                    SET nombre = ?, email = ?, rol = ?, activo = ?, mfa_enabled = ?,
                        telefono_cifrado = ?, direccion_cifrada = ?,
                        membresia_premium = ?, membresia_plan = ?
                    WHERE id = ?
                """, (new_nombre, new_email, new_rol, new_activo, new_mfa, new_tel_enc, new_dir_enc, is_premium, prime_plan, user["id"]))

                if new_pwd:
                    pwd_hash = hash_password_scrypt(new_pwd)
                    con.execute("UPDATE usuarios SET password_hash = ? WHERE id = ?", (pwd_hash, user["id"]))

                con.commit()

                record_audit_log_entry(
                    con,
                    usuario_id=1,
                    rol="administrador",
                    accion="MODIFICACION_USUARIO_ADMIN",
                    modulo="Gestión de Cuentas (RF-01)",
                    entidad_id=str(user["id"]),
                    detalles={
                        "usuario_modificado_id": user["id"],
                        "nombre": new_nombre,
                        "email": new_email,
                        "rol": new_rol,
                        "activo": new_activo,
                        "mfa": new_mfa,
                        "membresia": prime_plan,
                        "password_modificada": bool(new_pwd)
                    }
                )

                messagebox.showinfo("Éxito", f"Cuenta #{user['id']} ({new_email}) actualizada correctamente.", parent=dlg)
                dlg.destroy()
                self.refresh_accounts_data()
                self.refresh_finance_data()
            except Exception as e:
                messagebox.showerror("Error al Actualizar", str(e), parent=dlg)
            finally:
                con.close()

        btn_save = tk.Button(
            btn_box,
            text="Guardar Cambios",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS,
            activeforeground="#ffffff",
            padx=16,
            pady=6,
            relief="flat",
            cursor="hand2",
            command=save_changes
        )
        btn_save.pack(side=tk.RIGHT, padx=5)

        btn_cancel = ttk.Button(btn_box, text="Cancelar", command=dlg.destroy)
        btn_cancel.pack(side=tk.RIGHT, padx=5)

    def delete_selected_user(self):
        selected = self.tree_users.selection()
        if not selected:
            messagebox.showwarning("Atención", "Por favor seleccione una cuenta en la tabla para eliminar.")
            return

        item = self.tree_users.item(selected[0])
        vals = item["values"]
        user_id = int(vals[0])
        nombre = vals[1]
        email = vals[2]

        if user_id == 1:
            messagebox.showerror(
                "Operación Denegada",
                "No es posible eliminar la cuenta principal de Superadministrador (ID 1)."
            )
            return

        confirm = messagebox.askyesno(
            "Confirmar Eliminación Permanente",
            f"ADVERTENCIA DE SEGURIDAD:\n\n"
            f"¿Está completamente seguro de que desea eliminar permanentemente la cuenta:\n"
            f"• Usuario: {nombre}\n"
            f"• Correo: {email} (ID #{user_id})?\n\n"
            f"Esta acción revocará todas sus sesiones activas, cancelará beneficios "
            f"y purgará sus registros asociados de forma irreversible.",
            icon="warning"
        )
        if not confirm:
            return

        try:
            con, _ = get_db()
            deleted_user = delete_user_cascade(con, user_id)
            con.close()

            messagebox.showinfo(
                "Cuenta Eliminada",
                f"La cuenta de '{deleted_user['nombre']}' ({deleted_user['email']}) ha sido eliminada exitosamente del sistema."
            )
            self.refresh_accounts_data()
            self.refresh_finance_data()
        except Exception as e:
            messagebox.showerror("Error al Eliminar Cuenta", f"No se pudo eliminar la cuenta:\n{str(e)}")

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
    # PESTAÑA 4: TARJETAS Y SALDO PARA SIMULACIÓN DE COMPRAS (PCI DSS)
    # ==========================================================================
    def build_cards_tab(self):
        frame = self.tab_cards

        # Marco superior: 2 Tarjetas (Registro y Recarga)
        top_split = tk.Frame(frame, bg=COLOR_BG)
        top_split.pack(fill=tk.X, padx=10, pady=8)

        # Card 1: Formulario de Registro de Tarjeta
        reg_card = tk.LabelFrame(
            top_split,
            text=" Registrar Nueva Tarjeta de Pago con Saldo (Simulación) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        reg_card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        # Número de tarjeta
        tk.Label(reg_card, text="Número de Tarjeta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=0, column=0, sticky="w", pady=3)
        num_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        num_box.grid(row=0, column=1, sticky="w", pady=3)
        self.entry_card_number = ttk.Entry(num_box, width=22, font=("DejaVu Sans", 9))
        self.entry_card_number.pack(side=tk.LEFT, padx=(0, 5))
        self.entry_card_number.insert(0, "4532 0123 4567 8910")
        btn_gen_card = ttk.Button(num_box, text="Generar", width=8, command=self.generate_test_card_number)
        btn_gen_card.pack(side=tk.LEFT)

        # Titular
        tk.Label(reg_card, text="Titular de la Tarjeta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=3)
        self.entry_card_holder = ttk.Entry(reg_card, width=32, font=("DejaVu Sans", 9))
        self.entry_card_holder.grid(row=1, column=1, sticky="w", pady=3)
        self.entry_card_holder.insert(0, "DIEGO ALARCÓN SIMULACIÓN")

        # Expiración y CVV
        tk.Label(reg_card, text="Vigencia (MM/AA) y CVV:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=3)
        exp_cvv_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        exp_cvv_box.grid(row=2, column=1, sticky="w", pady=3)
        self.entry_card_exp = ttk.Entry(exp_cvv_box, width=8, font=("DejaVu Sans", 9))
        self.entry_card_exp.pack(side=tk.LEFT, padx=(0, 8))
        self.entry_card_exp.insert(0, "12/29")
        tk.Label(exp_cvv_box, text="CVV:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 4))
        self.entry_card_cvv = ttk.Entry(exp_cvv_box, width=6, font=("DejaVu Sans", 9))
        self.entry_card_cvv.pack(side=tk.LEFT)
        self.entry_card_cvv.insert(0, "123")

        # Saldo Inicial
        tk.Label(reg_card, text="Saldo Inicial (MXN) *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=3)
        self.entry_card_balance = ttk.Entry(reg_card, width=20, font=("DejaVu Sans", 9))
        self.entry_card_balance.grid(row=3, column=1, sticky="w", pady=3)
        self.entry_card_balance.insert(0, "15000.00")

        # Marca y Tipo
        tk.Label(reg_card, text="Marca y Tipo:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=3)
        brand_type_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        brand_type_box.grid(row=4, column=1, sticky="w", pady=3)
        self.combo_card_brand = ttk.Combobox(brand_type_box, values=["Visa", "Mastercard", "American Express", "Carnet"], state="readonly", width=14)
        self.combo_card_brand.set("Visa")
        self.combo_card_brand.pack(side=tk.LEFT, padx=(0, 8))
        self.combo_card_type = ttk.Combobox(brand_type_box, values=["credito", "debito", "corporativa"], state="readonly", width=12)
        self.combo_card_type.set("credito")
        self.combo_card_type.pack(side=tk.LEFT)

        # Botón Registrar Tarjeta
        btn_reg_card = tk.Button(
            reg_card,
            text="Registrar Tarjeta y Asignar Saldo",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=14,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.submit_create_card
        )
        btn_reg_card.grid(row=5, column=1, sticky="w", pady=(8, 2))

        # Card 2: Recarga Rápida de Saldo y Gestión
        recharge_card = tk.LabelFrame(
            top_split,
            text=" Recargar Saldo y Gestión de Tarjeta Seleccionada ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        recharge_card.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(6, 0))

        self.lbl_selected_card_info = tk.Label(
            recharge_card,
            text="Tarjeta Seleccionada: Ninguna (selecciona una de la tabla abajo)",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_PRIMARY,
            bg=COLOR_SURFACE,
            anchor="w"
        )
        self.lbl_selected_card_info.pack(fill=tk.X, pady=(0, 4))

        self.lbl_selected_card_balance = tk.Label(
            recharge_card,
            text="Saldo Disponible: $0.00 MXN",
            font=("DejaVu Sans", 14, "bold"),
            fg=COLOR_SUCCESS_DARK,
            bg=COLOR_SURFACE,
            anchor="w"
        )
        self.lbl_selected_card_balance.pack(fill=tk.X, pady=(0, 8))

        # Botones de recarga rápida
        quick_frame = tk.Frame(recharge_card, bg=COLOR_SURFACE)
        quick_frame.pack(fill=tk.X, pady=4)
        tk.Label(quick_frame, text="Recarga Rápida:", font=("DejaVu Sans", 8, "bold"), bg=COLOR_SURFACE, fg=COLOR_TEXT_MUTED).pack(side=tk.LEFT, padx=(0, 6))

        for amount in [500, 1000, 5000, 10000]:
            btn_q = tk.Button(
                quick_frame,
                text=f"+${amount:,}",
                font=("DejaVu Sans", 8, "bold"),
                bg="#e0e7ff",
                fg=COLOR_PRIMARY,
                activebackground=COLOR_PRIMARY,
                activeforeground="#ffffff",
                padx=6,
                pady=2,
                relief="flat",
                cursor="hand2",
                command=lambda a=amount: self.quick_recharge_card(a)
            )
            btn_q.pack(side=tk.LEFT, padx=3)

        # Monto manual y recarga
        manual_frame = tk.Frame(recharge_card, bg=COLOR_SURFACE)
        manual_frame.pack(fill=tk.X, pady=6)
        tk.Label(manual_frame, text="Monto MXN:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 6))
        self.entry_manual_recharge = ttk.Entry(manual_frame, width=14, font=("DejaVu Sans", 9))
        self.entry_manual_recharge.pack(side=tk.LEFT, padx=(0, 8))
        self.entry_manual_recharge.insert(0, "2000.00")

        btn_recharge = tk.Button(
            manual_frame,
            text="Recargar Saldo",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS,
            activeforeground="#ffffff",
            padx=10,
            pady=3,
            relief="flat",
            cursor="hand2",
            command=self.submit_manual_recharge
        )
        btn_recharge.pack(side=tk.LEFT, padx=(0, 8))

        btn_toggle_status = tk.Button(
            manual_frame,
            text="Activar / Bloquear",
            font=("DejaVu Sans", 9),
            bg="#f1f5f9",
            fg=COLOR_NAVY_DARK,
            padx=8,
            pady=3,
            relief="solid",
            bd=1,
            cursor="hand2",
            command=self.toggle_card_status
        )
        btn_toggle_status.pack(side=tk.LEFT)

        # Contenedor inferior: Tabla de Tarjetas
        table_box = tk.LabelFrame(
            frame,
            text=" Tarjetas Registradas en el Sistema y Monitoreo de Saldo (Descuento en Compras) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=6
        )
        table_box.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        cols = ("id", "numero", "titular", "marca", "tipo", "exp", "saldo", "saldo_inicial", "estado", "updated_at")
        self.tree_cards = ttk.Treeview(
            table_box,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_cards.heading("id", text="ID")
        self.tree_cards.heading("numero", text="Número de Tarjeta")
        self.tree_cards.heading("titular", text="Titular")
        self.tree_cards.heading("marca", text="Marca")
        self.tree_cards.heading("tipo", text="Tipo")
        self.tree_cards.heading("exp", text="Expira")
        self.tree_cards.heading("saldo", text="Saldo Disponible (MXN)")
        self.tree_cards.heading("saldo_inicial", text="Saldo Inicial")
        self.tree_cards.heading("estado", text="Estado")
        self.tree_cards.heading("updated_at", text="Última Modificación")

        self.tree_cards.column("id", width=40, anchor="center")
        self.tree_cards.column("numero", width=160, anchor="center")
        self.tree_cards.column("titular", width=180, anchor="w")
        self.tree_cards.column("marca", width=90, anchor="center")
        self.tree_cards.column("tipo", width=80, anchor="center")
        self.tree_cards.column("exp", width=65, anchor="center")
        self.tree_cards.column("saldo", width=130, anchor="e")
        self.tree_cards.column("saldo_inicial", width=110, anchor="e")
        self.tree_cards.column("estado", width=75, anchor="center")
        self.tree_cards.column("updated_at", width=135, anchor="center")

        sb_card_y = ttk.Scrollbar(table_box, orient=tk.VERTICAL, command=self.tree_cards.yview)
        self.tree_cards.configure(yscrollcommand=sb_card_y.set)
        sb_card_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_cards.pack(fill=tk.BOTH, expand=True)

        self.tree_cards.bind("<<TreeviewSelect>>", self.on_card_select)

    def generate_test_card_number(self):
        import random
        # Generar número de tarjeta de 16 dígitos válido con prefijo 4
        prefix = "4" + "".join([str(random.randint(0, 9)) for _ in range(14)])
        digits = [int(d) for d in prefix]
        odd_digits = digits[-1::-2]
        even_digits = digits[-2::-2]
        checksum = sum(odd_digits)
        for d in even_digits:
            checksum += sum(divmod(d * 2, 10))
        check_digit = (10 - (checksum % 10)) % 10
        full_number = prefix + str(check_digit)
        formatted = f"{full_number[:4]} {full_number[4:8]} {full_number[8:12]} {full_number[12:]}"
        self.entry_card_number.delete(0, tk.END)
        self.entry_card_number.insert(0, formatted)

    def refresh_cards_data(self):
        con, _ = get_db()
        self.all_cards = con.execute("""
            SELECT id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
            FROM tarjetas_simuladas
            ORDER BY id ASC
        """).fetchall()
        con.close()

        for item in self.tree_cards.get_children():
            self.tree_cards.delete(item)

        for c in getattr(self, "all_cards", []):
            estado_str = "Activa" if c["activa"] else "Bloqueada"
            saldo_str = f"${c['saldo']:,.2f} MXN"
            saldo_ini_str = f"${c['saldo_inicial']:,.2f} MXN"
            self.tree_cards.insert(
                "",
                tk.END,
                values=(
                    c["id"],
                    c["numero_tarjeta"],
                    c["titular"],
                    c["marca"],
                    c["tipo"].upper(),
                    c["expiracion"],
                    saldo_str,
                    saldo_ini_str,
                    estado_str,
                    c["updated_at"][:19]
                )
            )

    def on_card_select(self, event):
        selected = self.tree_cards.selection()
        if not selected:
            return
        card_id = self.tree_cards.item(selected[0])["values"][0]
        card = next((c for c in getattr(self, "all_cards", []) if c["id"] == card_id), None)
        if not card:
            return
        self.selected_card_id = card["id"]
        self.lbl_selected_card_info.config(
            text=f"Tarjeta Seleccionada: ID #{card['id']} · {card['marca']} ({card['numero_tarjeta']}) - {card['titular']}",
            fg=COLOR_NAVY_DARK
        )
        self.lbl_selected_card_balance.config(
            text=f"Saldo Disponible: ${card['saldo']:,.2f} MXN",
            fg=COLOR_SUCCESS_DARK if card["saldo"] > 500 else COLOR_DANGER
        )

    def submit_create_card(self):
        numero = self.entry_card_number.get().strip()
        titular = self.entry_card_holder.get().strip().upper()
        exp = self.entry_card_exp.get().strip()
        cvv = self.entry_card_cvv.get().strip()
        marca = self.combo_card_brand.get().strip()
        tipo = self.combo_card_type.get().strip()

        try:
            saldo = float(self.entry_card_balance.get().strip())
            if saldo < 0:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Validación", "Ingrese un saldo inicial válido mayor o igual a 0.")
            return

        if not numero or len(numero.replace(" ", "")) < 12:
            messagebox.showerror("Validación", "Ingrese un número de tarjeta válido.")
            return
        if not titular or len(titular) < 3:
            messagebox.showerror("Validación", "Ingrese el nombre del titular.")
            return

        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            con.execute("""
                INSERT INTO tarjetas_simuladas (
                    numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (numero, titular, exp, cvv, saldo, saldo, marca, tipo, now_iso, now_iso))
            con.commit()
            last_id = con.execute("SELECT last_insert_rowid()").fetchone()[0]

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="REGISTRO_TARJETA_SIMULADA",
                modulo="Simulador de Pagos (RF-05)",
                entidad_id=str(last_id),
                detalles={
                    "tarjeta_id": last_id,
                    "titular": titular,
                    "saldo": saldo,
                    "marca": marca
                }
            )

            messagebox.showinfo("Éxito", f"Tarjeta #{last_id} registrada exitosamente con saldo de ${saldo:,.2f} MXN para simular compras.")
            self.refresh_cards_data()
            self.generate_test_card_number()
        except sqlite3.IntegrityError:
            messagebox.showerror("Error", "Este número de tarjeta ya se encuentra registrado.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def quick_recharge_card(self, amount):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla para recargar saldo.")
            return
        self.do_recharge(card_id, amount)

    def submit_manual_recharge(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla para recargar saldo.")
            return
        try:
            amount = float(self.entry_manual_recharge.get().strip())
            if amount <= 0:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Validación", "Ingrese un monto de recarga válido mayor a 0.")
            return
        self.do_recharge(card_id, amount)

    def do_recharge(self, card_id, amount):
        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            row = con.execute("SELECT saldo, titular, numero_tarjeta FROM tarjetas_simuladas WHERE id = ?", (card_id,)).fetchone()
            if not row:
                messagebox.showerror("Error", "Tarjeta no encontrada.")
                return
            saldo_anterior = row["saldo"]
            nuevo_saldo = round(saldo_anterior + amount, 2)
            con.execute("UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?", (nuevo_saldo, now_iso, card_id))
            con.commit()

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="RECARGA_SALDO_TARJETA",
                modulo="Simulador de Pagos (RF-05)",
                entidad_id=str(card_id),
                detalles={
                    "tarjeta_id": card_id,
                    "monto": amount,
                    "saldo_anterior": saldo_anterior,
                    "nuevo_saldo": nuevo_saldo
                }
            )

            messagebox.showinfo("Recarga Exitosa", f"Se han recargado ${amount:,.2f} MXN a la tarjeta #{card_id}.\nNuevo saldo: ${nuevo_saldo:,.2f} MXN")
            self.refresh_cards_data()
            self.lbl_selected_card_balance.config(text=f"Saldo Disponible: ${nuevo_saldo:,.2f} MXN")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def toggle_card_status(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla.")
            return
        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            row = con.execute("SELECT activa FROM tarjetas_simuladas WHERE id = ?", (card_id,)).fetchone()
            if not row:
                return
            nuevo_estado = 0 if row["activa"] else 1
            con.execute("UPDATE tarjetas_simuladas SET activa = ?, updated_at = ? WHERE id = ?", (nuevo_estado, now_iso, card_id))
            con.commit()
            self.refresh_cards_data()
            messagebox.showinfo("Estado Actualizado", f"La tarjeta #{card_id} ahora está {'Activa' if nuevo_estado else 'Bloqueada'}.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    # ==========================================================================
    # PESTAÑA 5: GESTIÓN DE PETICIONES DE REEMBOLSO (LFPC / MC-001)
    # ==========================================================================
    def build_refunds_tab(self):
        frame = self.tab_refunds

        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        tk.Label(top_box, text="Estado:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_refund_filter = ttk.Combobox(
            top_box,
            values=["Todos", "pendiente", "aprobada", "denegada"],
            state="readonly",
            width=12
        )
        self.combo_refund_filter.set("Todos")
        self.combo_refund_filter.pack(side=tk.LEFT, padx=(0, 15))
        self.combo_refund_filter.bind("<<ComboboxSelected>>", lambda _: self.filter_refunds())

        tk.Label(top_box, text="Buscar:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_refund = ttk.Entry(top_box, width=20)
        self.entry_search_refund.pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_refund.bind("<KeyRelease>", lambda _: self.filter_refunds())

        btn_clear_refund = ttk.Button(top_box, text="Limpiar", command=self.clear_refund_search)
        btn_clear_refund.pack(side=tk.LEFT, padx=(0, 10))

        btn_refresh_refund = tk.Button(
            top_box,
            text="Actualizar Peticiones",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.refresh_refunds_data
        )
        btn_refresh_refund.pack(side=tk.LEFT, padx=(0, 15))

        self.lbl_refunds_stats = tk.Label(top_box, text="Pendientes: 0 | Aprobadas: 0 | Denegadas: 0", font=("DejaVu Sans", 9, "bold"), fg=COLOR_PRIMARY, bg=COLOR_BG)
        self.lbl_refunds_stats.pack(side=tk.RIGHT)

        table_container = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "folio", "cliente", "monto", "motivo", "estado", "fecha", "resolucion")
        self.tree_refunds = ttk.Treeview(
            table_container,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_refunds.heading("id", text="ID")
        self.tree_refunds.heading("folio", text="Folio Pedido")
        self.tree_refunds.heading("cliente", text="Cliente / Comprador")
        self.tree_refunds.heading("monto", text="Monto (MXN)")
        self.tree_refunds.heading("motivo", text="Motivo de Devolución")
        self.tree_refunds.heading("estado", text="Estado")
        self.tree_refunds.heading("fecha", text="Fecha Solicitud")
        self.tree_refunds.heading("resolucion", text="Respuesta Admin")

        self.tree_refunds.column("id", width=45, anchor="center")
        self.tree_refunds.column("folio", width=190, anchor="w")
        self.tree_refunds.column("cliente", width=190, anchor="w")
        self.tree_refunds.column("monto", width=105, anchor="e")
        self.tree_refunds.column("motivo", width=250, anchor="w")
        self.tree_refunds.column("estado", width=100, anchor="center")
        self.tree_refunds.column("fecha", width=140, anchor="center")
        self.tree_refunds.column("resolucion", width=200, anchor="w")

        # Configuración de tags de color para estados
        self.tree_refunds.tag_configure("tag_pendiente", background="#fef3c7", foreground="#92400e")
        self.tree_refunds.tag_configure("tag_aprobada", background="#d1fae5", foreground="#065f46")
        self.tree_refunds.tag_configure("tag_denegada", background="#fee2e2", foreground="#991b1b")

        sb_y = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree_refunds.yview)
        self.tree_refunds.configure(yscrollcommand=sb_y.set)
        sb_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_refunds.pack(fill=tk.BOTH, expand=True)

        self.tree_refunds.bind("<<TreeviewSelect>>", self.on_refund_select)

        # Panel inferior de detalle y acciones
        detail_frame = tk.LabelFrame(
            frame,
            text=" Detalle de Petición de Reembolso y Resolución Administrativa ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        detail_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        detail_box = tk.Frame(detail_frame, bg=COLOR_SURFACE)
        detail_box.pack(fill=tk.X)

        self.lbl_refund_detail = tk.Label(
            detail_box,
            text="Selecciona una petición en la tabla para revisar los motivos y resolver el reembolso.",
            font=("DejaVu Sans", 9),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_refund_detail.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_approve = tk.Button(
            detail_box,
            text="Aceptar Reembolso",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS_DARK,
            activeforeground="#ffffff",
            padx=14,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.approve_selected_refund
        )
        btn_approve.pack(side=tk.RIGHT, padx=5)

        btn_reject = tk.Button(
            detail_box,
            text="Denegar Reembolso",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            padx=14,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.reject_selected_refund
        )
        btn_reject.pack(side=tk.RIGHT, padx=5)

    def clear_refund_search(self):
        self.combo_refund_filter.set("Todos")
        self.entry_search_refund.delete(0, tk.END)
        self.filter_refunds()

    def on_refund_select(self, event):
        selected = self.tree_refunds.selection()
        if not selected:
            return
        vals = self.tree_refunds.item(selected[0])["values"]
        req_id = vals[0]
        folio = vals[1]
        cliente = vals[2]
        monto = vals[3]
        motivo = vals[4]
        estado = vals[5]
        fecha = vals[6]
        res = vals[7] if len(vals) > 7 else ""

        self.lbl_refund_detail.config(
            text=f"Petición #{req_id} | Pedido: {folio} | Cliente: {cliente} | Monto: {monto}\n"
                 f"Motivo: {motivo}\n"
                 f"Estado Actual: {estado.upper()} | Solicitado: {fecha} | Resolución: {res or '(Sin resolución aún)'}",
            fg=COLOR_TEXT_MAIN
        )

    def refresh_refunds_data(self):
        con, _ = get_db()
        try:
            self.all_refunds = con.execute("""
                SELECT 
                    sr.id, sr.pedido_id, sr.usuario_id, sr.monto, sr.motivo, sr.estado,
                    sr.respuesta_admin, sr.fecha_solicitud, sr.fecha_resolucion, sr.created_at,
                    p.folio as pedido_folio, p.total as pedido_total, p.metodo_pago,
                    u.nombre as cliente_nombre, u.email as cliente_email
                FROM solicitudes_reembolso sr
                JOIN pedidos p ON p.id = sr.pedido_id
                JOIN usuarios u ON u.id = sr.usuario_id
                ORDER BY sr.id DESC
            """).fetchall()
        except Exception:
            self.all_refunds = []
        finally:
            con.close()

        self.filter_refunds()

    def filter_refunds(self):
        state_filter = self.combo_refund_filter.get()
        search_txt = self.entry_search_refund.get().strip().lower()

        for item in self.tree_refunds.get_children():
            self.tree_refunds.delete(item)

        pend_count = 0
        aprob_count = 0
        deneg_count = 0

        for r in getattr(self, "all_refunds", []):
            est = r["estado"].lower()
            if est == "pendiente":
                pend_count += 1
            elif est == "aprobada":
                aprob_count += 1
            elif est == "denegada":
                deneg_count += 1

            if state_filter != "Todos" and est != state_filter.lower():
                continue
            if search_txt:
                match_folio = search_txt in str(r["pedido_folio"]).lower()
                match_cliente = search_txt in str(r["cliente_nombre"]).lower() or search_txt in str(r["cliente_email"]).lower()
                match_motivo = search_txt in str(r["motivo"]).lower()
                if not (match_folio or match_cliente or match_motivo):
                    continue

            tag = f"tag_{est}" if est in ("pendiente", "aprobada", "denegada") else ""
            self.tree_refunds.insert(
                "",
                tk.END,
                values=(
                    r["id"],
                    r["pedido_folio"],
                    f"{r['cliente_nombre']} ({r['cliente_email']})",
                    f"${r['monto']:,.2f}",
                    r["motivo"],
                    est.upper(),
                    r["fecha_solicitud"][:19] if r["fecha_solicitud"] else "",
                    r["respuesta_admin"] or "-"
                ),
                tags=(tag,)
            )

        self.lbl_refunds_stats.config(
            text=f"Pendientes: {pend_count} | Aprobadas: {aprob_count} | Denegadas: {deneg_count}"
        )

    def approve_selected_refund(self):
        selected = self.tree_refunds.selection()
        if not selected:
            messagebox.showwarning("Atención", "Por favor seleccione una petición de reembolso de la tabla.")
            return

        item = self.tree_refunds.item(selected[0])
        vals = item["values"]
        req_id = int(vals[0])
        folio = vals[1]
        cliente = vals[2]
        monto_str = vals[3]
        estado = str(vals[5]).lower()

        if estado != "pendiente":
            messagebox.showinfo("Información", f"La petición #{req_id} ya fue resuelta previamente ({estado.upper()}).")
            return

        confirm = messagebox.askyesno(
            "Aceptar Reembolso",
            f"¿Desea ACEPTAR y procesar el reembolso de la petición #{req_id}?\n\n"
            f"• Pedido: {folio}\n"
            f"• Cliente: {cliente}\n"
            f"• Importe: {monto_str} MXN\n\n"
            f"Acciones automáticas del sistema:\n"
            f"1. El pedido se marcará como 'devuelto'.\n"
            f"2. El inventario de productos se reintegrará automáticamente.\n"
            f"3. Si fue pagado con tarjeta simulada, el saldo será devuelto a la tarjeta.",
            icon="question"
        )
        if not confirm:
            return

        con, _ = get_db()
        try:
            now_iso = datetime.utcnow().isoformat() + "Z"
            req_row = con.execute("SELECT * FROM solicitudes_reembolso WHERE id = ?", (req_id,)).fetchone()
            if not req_row:
                messagebox.showerror("Error", f"Petición #{req_id} no encontrada.")
                return

            order = con.execute("SELECT * FROM pedidos WHERE id = ?", (req_row["pedido_id"],)).fetchone()
            if not order:
                messagebox.showerror("Error", "Pedido asociado no encontrado.")
                return

            respuesta_txt = "Reembolso autorizado y procesado conforme a la garantía de satisfacción de 30 días."

            con.execute("""
                UPDATE solicitudes_reembolso
                SET estado = 'aprobada', respuesta_admin = ?, fecha_resolucion = ?, updated_at = ?
                WHERE id = ?
            """, (respuesta_txt, now_iso, now_iso, req_id))

            con.execute("UPDATE pedidos SET estado = 'devuelto', motivo_devolucion = ?, updated_at = ? WHERE id = ?",
                        (req_row["motivo"], now_iso, order["id"]))

            items = con.execute("SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?", (order["id"],)).fetchall()
            for it in items:
                con.execute("UPDATE inventario SET stock_disponible = stock_disponible + ?, updated_at = ? WHERE producto_id = ?",
                            (it["cantidad"], now_iso, it["producto_id"]))

            con.execute("UPDATE transacciones SET estado = 'reembolsado' WHERE pedido_id = ?", (order["id"],))
            con.execute("UPDATE envios SET estado_envio = 'devuelto', updated_at = ? WHERE pedido_id = ?", (now_iso, order["id"]))

            card_msg = ""
            tx = con.execute("SELECT tarjeta_enmascarada FROM transacciones WHERE pedido_id = ?", (order["id"],)).fetchone()
            if tx and tx["tarjeta_enmascarada"]:
                last4 = tx["tarjeta_enmascarada"][-4:]
                card = con.execute("SELECT id, saldo, marca FROM tarjetas_simuladas WHERE numero_tarjeta LIKE '%' || ?", (last4,)).fetchone()
                if card:
                    nuevo_saldo = card["saldo"] + order["total"]
                    con.execute("UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?", (nuevo_saldo, now_iso, card["id"]))
                    card_msg = f"\n\nSaldo reembolsado a tarjeta {card['marca']} (•••• {last4}):\nSaldo nuevo: ${nuevo_saldo:,.2f} MXN"

            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "APROBACION_REEMBOLSO_ADMIN",
                "modulo": "Devoluciones y Reembolsos (RF-07 / NOR-09)",
                "entidad_id": order["folio"],
                "detalles": json.dumps({"requestId": req_id, "monto": order["total"], "folio": order["folio"]})
            })

            con.execute("""
                INSERT INTO notificaciones (usuario_id, pedido_id, evento, canal, asunto, mensaje, entregada, created_at)
                VALUES (?, ?, 'REEMBOLSO_APROBADO', 'sistema', ?, ?, 1, ?)
            """, (
                order["usuario_id"],
                order["id"],
                f"Reembolso aprobado para el pedido {order['folio']}",
                f"Tu solicitud de reembolso del pedido {order['folio']} por ${order['total']:,.2f} MXN fue aprobada exitosamente.",
                now_iso
            ))

            con.commit()

            messagebox.showinfo(
                "Reembolso Aprobado",
                f"La solicitud #{req_id} para el pedido {order['folio']} fue aprobada exitosamente.\n"
                f"• Inventario reintegrado al almacén.{card_msg}"
            )
            self.refresh_refunds_data()
            self.refresh_cards_data()
            self.refresh_finance_data()
            self.refresh_sales_data()
        except Exception as e:
            messagebox.showerror("Error al Aprobar Reembolso", str(e))
        finally:
            con.close()

    def reject_selected_refund(self):
        selected = self.tree_refunds.selection()
        if not selected:
            messagebox.showwarning("Atención", "Por favor seleccione una petición de reembolso de la tabla.")
            return

        item = self.tree_refunds.item(selected[0])
        vals = item["values"]
        req_id = int(vals[0])
        folio = vals[1]
        cliente = vals[2]
        estado = str(vals[5]).lower()

        if estado != "pendiente":
            messagebox.showinfo("Información", f"La petición #{req_id} ya fue resuelta previamente ({estado.upper()}).")
            return

        motivo = ""
        try:
            from tkinter import simpledialog
            motivo = simpledialog.askstring(
                "Denegar Reembolso",
                f"Petición #{req_id} (Pedido: {folio})\nCliente: {cliente}\n\n"
                f"Ingrese el motivo formal de la denegación:",
                initialvalue="Solicitud excede el plazo de garantía o no cumple con las políticas de devolución."
            )
        except Exception:
            motivo = "Solicitud excede el plazo de garantía o no cumple con las políticas de devolución."

        if not motivo or not motivo.strip():
            return

        con, _ = get_db()
        try:
            now_iso = datetime.utcnow().isoformat() + "Z"
            req_row = con.execute("SELECT * FROM solicitudes_reembolso WHERE id = ?", (req_id,)).fetchone()
            if not req_row:
                messagebox.showerror("Error", f"Petición #{req_id} no encontrada.")
                return

            order = con.execute("SELECT * FROM pedidos WHERE id = ?", (req_row["pedido_id"],)).fetchone()

            con.execute("""
                UPDATE solicitudes_reembolso
                SET estado = 'denegada', respuesta_admin = ?, fecha_resolucion = ?, updated_at = ?
                WHERE id = ?
            """, (motivo.strip(), now_iso, now_iso, req_id))

            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "DENEGACION_REEMBOLSO_ADMIN",
                "modulo": "Devoluciones y Reembolsos (RF-07 / NOR-09)",
                "entidad_id": order["folio"] if order else f"REQ-{req_id}",
                "detalles": json.dumps({"requestId": req_id, "motivoRechazo": motivo.strip()})
            })

            if order:
                con.execute("""
                    INSERT INTO notificaciones (usuario_id, pedido_id, evento, canal, asunto, mensaje, entregada, created_at)
                    VALUES (?, ?, 'REEMBOLSO_DENEGADO', 'sistema', ?, ?, 1, ?)
                """, (
                    order["usuario_id"],
                    order["id"],
                    f"Actualización de solicitud de reembolso - Pedido {order['folio']}",
                    f"Tu solicitud de reembolso del pedido {order['folio']} fue denegada. Motivo: {motivo.strip()}",
                    now_iso
                ))

            con.commit()

            messagebox.showinfo(
                "Reembolso Denegado",
                f"La solicitud #{req_id} fue denegada y registrada formalmente en bitácora."
            )
            self.refresh_refunds_data()
        except Exception as e:
            messagebox.showerror("Error al Denegar Reembolso", str(e))
        finally:
            con.close()

    # ==========================================================================
    # PESTAÑA 6: LOG DE VENTAS Y REPORTES
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

    # ==========================================================================
    # PESTAÑA 7: GESTIÓN DE ENVÍOS Y ALMACENES (OPENSTREETMAP)
    # ==========================================================================
    def build_logistics_tab(self):
        frame = self.tab_logistics

        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        tk.Label(top_box, text="Almacén:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_logistics_warehouse = ttk.Combobox(
            top_box,
            values=["Todos", "CEDIS-VALLEJO", "CEDIS-COYOACAN", "CEDIS-GDL", "CEDIS-MTY", "CEDIS-PUEBLA"],
            state="readonly",
            width=15
        )
        self.combo_logistics_warehouse.set("Todos")
        self.combo_logistics_warehouse.pack(side=tk.LEFT, padx=(0, 10))
        self.combo_logistics_warehouse.bind("<<ComboboxSelected>>", lambda _: self.filter_logistics())

        tk.Label(top_box, text="Estado:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_logistics_status = ttk.Combobox(
            top_box,
            values=["Todos", "preparando", "en_transito", "entregado"],
            state="readonly",
            width=12
        )
        self.combo_logistics_status.set("Todos")
        self.combo_logistics_status.pack(side=tk.LEFT, padx=(0, 10))
        self.combo_logistics_status.bind("<<ComboboxSelected>>", lambda _: self.filter_logistics())

        btn_refresh_logistics = tk.Button(
            top_box,
            text="🔄 Actualizar",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.refresh_logistics_data
        )
        btn_refresh_logistics.pack(side=tk.LEFT, padx=(0, 10))

        btn_open_web_osm = tk.Button(
            top_box,
            text="🌐 Abrir Panel OpenStreetMap en Navegador",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_NAVY_DARK,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY,
            activeforeground="#ffffff",
            padx=12,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.open_osm_web_panel
        )
        btn_open_web_osm.pack(side=tk.LEFT, padx=(0, 10))

        self.lbl_logistics_stats = tk.Label(top_box, text="Envíos: 0 | En Tránsito: 0 | Entregados: 0", font=("DejaVu Sans", 9, "bold"), fg=COLOR_PRIMARY, bg=COLOR_BG)
        self.lbl_logistics_stats.pack(side=tk.RIGHT)

        table_container = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "folio", "guia", "almacen", "destino", "estado", "vehiculo", "progreso", "simulacion")
        self.tree_logistics = ttk.Treeview(
            table_container,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_logistics.heading("id", text="ID Pedido")
        self.tree_logistics.heading("folio", text="Folio")
        self.tree_logistics.heading("guia", text="Guía de Rastreo")
        self.tree_logistics.heading("almacen", text="Almacén CEDIS")
        self.tree_logistics.heading("destino", text="Dirección de Destino")
        self.tree_logistics.heading("estado", text="Estado Envío")
        self.tree_logistics.heading("vehiculo", text="Vehículo")
        self.tree_logistics.heading("progreso", text="Progreso %")
        self.tree_logistics.heading("simulacion", text="Simulación")

        self.tree_logistics.column("id", width=65, anchor="center")
        self.tree_logistics.column("folio", width=140, anchor="w")
        self.tree_logistics.column("guia", width=120, anchor="center")
        self.tree_logistics.column("almacen", width=160, anchor="w")
        self.tree_logistics.column("destino", width=220, anchor="w")
        self.tree_logistics.column("estado", width=95, anchor="center")
        self.tree_logistics.column("vehiculo", width=80, anchor="center")
        self.tree_logistics.column("progreso", width=80, anchor="center")
        self.tree_logistics.column("simulacion", width=90, anchor="center")

        scroll_y = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree_logistics.yview)
        scroll_x = ttk.Scrollbar(table_container, orient=tk.HORIZONTAL, command=self.tree_logistics.xview)
        self.tree_logistics.configure(yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)

        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.tree_logistics.pack(fill=tk.BOTH, expand=True)

        self.tree_logistics.bind("<<TreeviewSelect>>", self.on_logistics_select)

        # Panel inferior de detalle y acciones
        detail_frame = tk.LabelFrame(
            frame,
            text=" Control de Despacho y Simulación OpenStreetMap (Camión 🚚 / Auto 🚗) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        detail_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        detail_box = tk.Frame(detail_frame, bg=COLOR_SURFACE)
        detail_box.pack(fill=tk.X)

        self.lbl_logistics_detail = tk.Label(
            detail_box,
            text="Selecciona un pedido en la tabla para preparar el envío, iniciar simulación con camión/auto o marcar entrega.",
            font=("DejaVu Sans", 9),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_logistics_detail.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_prepare = tk.Button(
            detail_box,
            text="📦 Preparar",
            font=("DejaVu Sans", 9, "bold"),
            bg="#f59e0b",
            fg="#ffffff",
            activebackground="#d97706",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.prepare_selected_shipment
        )
        btn_prepare.pack(side=tk.LEFT, padx=3)

        btn_sim_truck = tk.Button(
            detail_box,
            text="🚚 Simular Camión",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_shipment_simulation("camion")
        )
        btn_sim_truck.pack(side=tk.LEFT, padx=3)

        btn_sim_car = tk.Button(
            detail_box,
            text="🚗 Simular Auto",
            font=("DejaVu Sans", 9, "bold"),
            bg="#0284c7",
            fg="#ffffff",
            activebackground="#0369a1",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_shipment_simulation("auto")
        )
        btn_sim_car.pack(side=tk.LEFT, padx=3)

        btn_sim_stop = tk.Button(
            detail_box,
            text="⏸ Parar Simulación",
            font=("DejaVu Sans", 9, "bold"),
            bg="#64748b",
            fg="#ffffff",
            activebackground="#475569",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.stop_shipment_simulation
        )
        btn_sim_stop.pack(side=tk.LEFT, padx=3)

        btn_deliver = tk.Button(
            detail_box,
            text="✅ Entregar",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS_DARK,
            activeforeground="#ffffff",
            padx=12,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.deliver_selected_shipment
        )
        btn_deliver.pack(side=tk.LEFT, padx=3)

    def open_osm_web_panel(self):
        try:
            webbrowser.open("http://localhost:3000/envios.html")
        except Exception as e:
            messagebox.showwarning("Aviso", f"No se pudo abrir el navegador automáticamente:\n{e}\n\nPuede acceder a: http://localhost:3000/envios.html")

    def on_logistics_select(self, event):
        selected = self.tree_logistics.selection()
        if not selected:
            return
        vals = self.tree_logistics.item(selected[0])["values"]
        pid = vals[0]
        folio = vals[1]
        guia = vals[2]
        almacen = vals[3]
        destino = vals[4]
        estado = vals[5]
        vehiculo = vals[6]
        progreso = vals[7]
        sim = vals[8]
        self.lbl_logistics_detail.config(
            text=f"Pedido #{pid} ({folio}) | Guía: {guia} | Almacén: {almacen}\n"
                 f"Destino: {destino}\n"
                 f"Estado: {estado.upper()} | Vehículo: {vehiculo.upper()} | Progreso: {progreso} | Simulación: {sim}",
            fg=COLOR_TEXT_MAIN
        )

    def refresh_logistics_data(self):
        con, _ = get_db()
        try:
            # Asegurar columnas si faltan
            try:
                con.execute("SELECT almacen_origen, tipo_vehiculo, progreso_simulacion, simulacion_activa FROM envios LIMIT 1")
            except Exception:
                con.execute("ALTER TABLE envios ADD COLUMN almacen_origen TEXT")
                con.execute("ALTER TABLE envios ADD COLUMN tipo_vehiculo TEXT DEFAULT 'camion'")
                con.execute("ALTER TABLE envios ADD COLUMN progreso_simulacion INTEGER DEFAULT 0")
                con.execute("ALTER TABLE envios ADD COLUMN simulacion_activa INTEGER DEFAULT 0")
                con.commit()

            self.all_shipments = con.execute("""
                SELECT 
                    e.pedido_id, p.folio, e.numero_guia,
                    COALESCE(e.almacen_origen, e.almacen_codigo, 'CEDIS Vallejo') as almacen,
                    p.direccion_envio, e.estado_envio,
                    COALESCE(e.tipo_vehiculo, 'camion') as tipo_vehiculo,
                    COALESCE(e.progreso_simulacion, 0) as progreso_simulacion,
                    COALESCE(e.simulacion_activa, 0) as simulacion_activa
                FROM envios e
                JOIN pedidos p ON p.id = e.pedido_id
                ORDER BY e.pedido_id DESC
            """).fetchall()
        except Exception:
            self.all_shipments = []
        finally:
            con.close()

        self.filter_logistics()

    def filter_logistics(self):
        for item in self.tree_logistics.get_children():
            self.tree_logistics.delete(item)

        wh_filter = getattr(self, "combo_logistics_warehouse", None)
        selected_wh = wh_filter.get() if wh_filter else "Todos"
        st_filter = getattr(self, "combo_logistics_status", None)
        selected_st = st_filter.get() if st_filter else "Todos"

        total_cnt = len(self.all_shipments)
        in_transit_cnt = 0
        delivered_cnt = 0

        for s in self.all_shipments:
            est = s["estado_envio"]
            if est == "en_transito":
                in_transit_cnt += 1
            elif est == "entregado":
                delivered_cnt += 1

            if selected_wh != "Todos" and selected_wh.lower() not in s["almacen"].lower():
                continue
            if selected_st != "Todos" and selected_st != est:
                continue

            v_icon = "🚚 Camión" if s["tipo_vehiculo"] != "auto" else "🚗 Auto"
            sim_str = "▶ ACTIVA" if s["simulacion_activa"] else "⏹ PAUSA"

            self.tree_logistics.insert(
                "",
                tk.END,
                values=(
                    s["pedido_id"],
                    s["folio"],
                    s["numero_guia"] or "N/D",
                    s["almacen"],
                    s["direccion_envio"] or "México",
                    est,
                    v_icon,
                    f"{s['progreso_simulacion']}%",
                    sim_str
                )
            )

        if hasattr(self, "lbl_logistics_stats"):
            self.lbl_logistics_stats.config(
                text=f"Total: {total_cnt} | En Tránsito: {in_transit_cnt} | Entregados: {delivered_cnt}"
            )

    def prepare_selected_shipment(self):
        selected = self.tree_logistics.selection()
        if not selected:
            messagebox.showwarning("Selección requerida", "Selecciona un envío para prepararlo.")
            return
        pid = self.tree_logistics.item(selected[0])["values"][0]
        con, _ = get_db()
        try:
            con.execute("UPDATE envios SET estado_envio = 'preparando', simulacion_activa = 0, progreso_simulacion = 0, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "LOGISTICA_PREPARAR_ENVIO",
                "modulo": "Logística OSM",
                "entidad_id": f"PED-{pid}",
                "detalles": json.dumps({"pedidoId": pid, "estado": "preparando"})
            })
            con.commit()
            messagebox.showinfo("Envío Preparado", f"El pedido #{pid} ha sido colocado en estado PREPARANDO.")
            self.refresh_logistics_data()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def start_shipment_simulation(self, vehicle_type="camion"):
        selected = self.tree_logistics.selection()
        if not selected:
            messagebox.showwarning("Selección requerida", "Selecciona un envío para iniciar su simulación.")
            return
        pid = self.tree_logistics.item(selected[0])["values"][0]
        con, _ = get_db()
        try:
            con.execute("""
                UPDATE envios 
                SET estado_envio = 'en_transito', simulacion_activa = 1, tipo_vehiculo = ?, updated_at = datetime('now') 
                WHERE pedido_id = ?
            """, (vehicle_type, pid))
            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "LOGISTICA_INICIAR_SIMULACION",
                "modulo": "Logística OSM",
                "entidad_id": f"PED-{pid}",
                "detalles": json.dumps({"pedidoId": pid, "tipoVehiculo": vehicle_type, "simulacion": True})
            })
            con.commit()
            v_name = "Camión 🚚" if vehicle_type == "camion" else "Auto 🚗"
            messagebox.showinfo("Simulación Iniciada", f"Simulación con {v_name} iniciada para el pedido #{pid}.\nPuede observarla en tiempo real en OpenStreetMap.")
            self.refresh_logistics_data()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def stop_shipment_simulation(self):
        selected = self.tree_logistics.selection()
        if not selected:
            messagebox.showwarning("Selección requerida", "Selecciona un envío para pausar su simulación.")
            return
        pid = self.tree_logistics.item(selected[0])["values"][0]
        con, _ = get_db()
        try:
            con.execute("UPDATE envios SET simulacion_activa = 0, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "LOGISTICA_DETENER_SIMULACION",
                "modulo": "Logística OSM",
                "entidad_id": f"PED-{pid}",
                "detalles": json.dumps({"pedidoId": pid, "simulacion": False})
            })
            con.commit()
            messagebox.showinfo("Simulación Pausada", f"Simulación del pedido #{pid} en pausa.")
            self.refresh_logistics_data()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def deliver_selected_shipment(self):
        selected = self.tree_logistics.selection()
        if not selected:
            messagebox.showwarning("Selección requerida", "Selecciona un envío para marcarlo como entregado.")
            return
        pid = self.tree_logistics.item(selected[0])["values"][0]
        con, _ = get_db()
        try:
            con.execute("UPDATE envios SET estado_envio = 'entregado', simulacion_activa = 0, progreso_simulacion = 100, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
            con.execute("UPDATE pedidos SET estado = 'entregado', updated_at = datetime('now') WHERE id = ?", (pid,))
            record_audit_log_sql(con, {
                "usuario_id": 1,
                "rol": "administrador",
                "accion": "LOGISTICA_ENTREGAR_PEDIDO",
                "modulo": "Logística OSM",
                "entidad_id": f"PED-{pid}",
                "detalles": json.dumps({"pedidoId": pid, "estado": "entregado"})
            })
            con.commit()
            messagebox.showinfo("Envío Entregado", f"El pedido #{pid} ha sido entregado exitosamente.")
            self.refresh_logistics_data()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def refresh_all(self):
        self.refresh_finance_data()
        self.refresh_accounts_data()
        self.refresh_cards_data()
        self.refresh_refunds_data()
        self.refresh_sales_data()
        self.refresh_logistics_data()


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
        print("3. Modificar Datos de una Cuenta del Sistema")
        print("4. Eliminar una Cuenta de Usuario")
        print("5. Crear Cuenta (Admin, Vendedor, Auditor)")
        print("6. Gestionar Tarjetas Simuladas y Recargar Saldo")
        print("7. Gestionar Peticiones de Reembolso (Aceptar / Denegar)")
        print("8. Ver Log de Ventas")
        print("9. Generar y Exportar Reporte de Ventas (TXT & CSV)")
        print("10. Gestionar Logística, Almacenes y Envíos (OpenStreetMap)")
        print("11. Salir")

        opt = input("\nOpción (1-11): ").strip()
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
            users = con.execute("SELECT id, nombre, email, rol, activo, membresia_premium, membresia_plan FROM usuarios ORDER BY id").fetchall()
            print(f"\n{'ID':<4} {'ROL':<14} {'NOMBRE':<30} {'EMAIL':<28} {'ESTADO':<8} {'PRIME'}")
            print("-" * 92)
            for u in users:
                est = "ACTIVA" if u["activo"] else "BLOQ"
                prm = u["membresia_plan"] or "PRIME" if u["membresia_premium"] else "-"
                print(f"{u['id']:<4} {u['rol'].upper():<14} {u['nombre'][:28]:<30} {u['email'][:26]:<28} {est:<8} {prm}")
            con.close()
        elif opt == "3":
            print("\n--- MODIFICAR CUENTA DEL SISTEMA ---")
            uid_str = input("ID de la cuenta a modificar: ").strip()
            if not uid_str.isdigit():
                print("Error: Ingrese un ID numérico válido.")
                continue
            uid = int(uid_str)
            con, _ = get_db()
            current = con.execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
            if not current:
                print(f"Error: Usuario #{uid} no encontrado.")
                con.close()
                continue

            print(f"Modificando usuario #{uid}: {current['nombre']} ({current['email']})")
            print("(Presione ENTER para conservar el valor actual)")
            n_nombre = input(f"Nombre [{current['nombre']}]: ").strip() or current['nombre']
            n_email = input(f"Email [{current['email']}]: ").strip() or current['email']
            n_rol = input(f"Rol (cliente/vendedor/administrador/soporte/auditor) [{current['rol']}]: ").strip().lower() or current['rol']
            n_act = input(f"Activo (1=Sí, 0=No) [{current['activo']}]: ").strip()
            activo_val = int(n_act) if n_act in ('0', '1') else current['activo']
            n_pwd = input("Nueva Contraseña (dejar en blanco para no cambiar): ").strip()

            if n_pwd:
                if len(n_pwd) < 8:
                    print("Error: La contraseña debe tener al menos 8 caracteres.")
                    con.close()
                    continue
                pwd_h = hash_password_scrypt(n_pwd)
                con.execute("UPDATE usuarios SET password_hash = ? WHERE id = ?", (pwd_h, uid))

            con.execute("""
                UPDATE usuarios
                SET nombre = ?, email = ?, rol = ?, activo = ?
                WHERE id = ?
            """, (n_nombre, n_email, n_rol, activo_val, uid))
            con.commit()

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="MODIFICACION_USUARIO_ADMIN",
                modulo="Gestión de Cuentas (CLI)",
                entidad_id=str(uid),
                detalles={"usuario_id": uid, "nombre": n_nombre, "email": n_email, "rol": n_rol}
            )
            con.close()
            print(f"[OK] Cuenta #{uid} modificada con éxito.")
        elif opt == "4":
            print("\n--- ELIMINAR CUENTA DE USUARIO ---")
            uid_str = input("ID de la cuenta a eliminar: ").strip()
            if not uid_str.isdigit():
                print("Error: Ingrese un ID numérico válido.")
                continue
            uid = int(uid_str)
            if uid == 1:
                print("Error: No es posible eliminar al Superadministrador principal (ID 1).")
                continue
            con, _ = get_db()
            user_row = con.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = ?", (uid,)).fetchone()
            if not user_row:
                print(f"Error: Usuario #{uid} no encontrado.")
                con.close()
                continue
            print(f"Cuenta seleccionada: {user_row['nombre']} ({user_row['email']}) - Rol: {user_row['rol']}")
            confirm = input(f"¿CONFIRMAR eliminación permanente de '{user_row['email']}'? (s/N): ").strip().lower()
            if confirm == "s":
                try:
                    deleted = delete_user_cascade(con, uid)
                    print(f"[OK] Cuenta de '{deleted['nombre']}' ({deleted['email']}) eliminada exitosamente.")
                except Exception as e:
                    print(f"Error al eliminar cuenta: {e}")
            else:
                print("Operación cancelada.")
            con.close()
        elif opt == "5":
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
        elif opt == "6":
            print("\n--- GESTIÓN DE TARJETAS SIMULADAS Y SALDOS ---")
            con, _ = get_db()
            cards = con.execute("SELECT id, numero_tarjeta, titular, marca, saldo, activa FROM tarjetas_simuladas ORDER BY id").fetchall()
            print(f"{'ID':<4} {'NUMERO':<20} {'TITULAR':<24} {'MARCA':<10} {'ESTADO':<8} {'SALDO DISPONIBLE'}")
            print("-" * 84)
            for c in cards:
                est = "ACTIVA" if c["activa"] else "BLOQ"
                print(f"{c['id']:<4} {c['numero_tarjeta']:<20} {c['titular'][:22]:<24} {c['marca']:<10} {est:<8} ${c['saldo']:>11,.2f} MXN")

            print("\nSubopciones:")
            print("a. Recargar saldo a una tarjeta")
            print("b. Registrar nueva tarjeta con saldo")
            print("c. Volver")
            sub = input("Opción: ").strip().lower()
            if sub == "a":
                cid_str = input("ID de la tarjeta a recargar: ").strip()
                if cid_str.isdigit():
                    monto_str = input("Monto a recargar en MXN: ").strip()
                    try:
                        monto = float(monto_str)
                        if monto > 0:
                            card_row = con.execute("SELECT saldo FROM tarjetas_simuladas WHERE id = ?", (int(cid_str),)).fetchone()
                            if card_row:
                                n_saldo = round(card_row["saldo"] + monto, 2)
                                now_iso = datetime.utcnow().isoformat() + "Z"
                                con.execute("UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?", (n_saldo, now_iso, int(cid_str)))
                                con.commit()
                                record_audit_log_entry(con, 1, "administrador", "RECARGA_SALDO_TARJETA", "Simulador Pagos (CLI)", cid_str, {"monto": monto, "nuevo_saldo": n_saldo})
                                print(f"[OK] Recarga exitosa. Nuevo saldo: ${n_saldo:,.2f} MXN")
                            else:
                                print("Error: Tarjeta no encontrada.")
                    except ValueError:
                        print("Monto inválido.")
            elif sub == "b":
                num = input("Número de tarjeta (16 dígitos): ").strip()
                tit = input("Nombre del titular: ").strip().upper()
                sal_str = input("Saldo inicial en MXN [10000]: ").strip() or "10000"
                try:
                    sal = float(sal_str)
                    now_iso = datetime.utcnow().isoformat() + "Z"
                    con.execute("""
                        INSERT INTO tarjetas_simuladas (numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at)
                        VALUES (?, ?, '12/29', '123', ?, ?, 'Visa', 'credito', 1, ?, ?)
                    """, (num, tit, sal, sal, now_iso, now_iso))
                    con.commit()
                    print(f"[OK] Tarjeta registrada exitosamente con saldo de ${sal:,.2f} MXN")
                except Exception as e:
                    print(f"Error al registrar tarjeta: {e}")
            con.close()
        elif opt == "7":
            print("\n--- GESTIÓN DE PETICIONES DE REEMBOLSO (LFPC) ---")
            con, _ = get_db()
            refunds = con.execute("""
                SELECT sr.id, sr.pedido_id, sr.monto, sr.motivo, sr.estado, sr.respuesta_admin,
                       p.folio, u.nombre as cliente_nombre, u.email as cliente_email
                FROM solicitudes_reembolso sr
                JOIN pedidos p ON p.id = sr.pedido_id
                JOIN usuarios u ON u.id = sr.usuario_id
                ORDER BY sr.id DESC
            """).fetchall()

            if not refunds:
                print("No hay solicitudes de reembolso registradas.")
                con.close()
                continue

            print(f"{'ID':<4} {'FOLIO':<26} {'CLIENTE':<26} {'MONTO':<12} {'ESTADO':<10} {'MOTIVO'}")
            print("-" * 105)
            for r in refunds:
                print(f"{r['id']:<4} {r['folio']:<26} {r['cliente_nombre'][:24]:<26} ${r['monto']:>9,.2f}  {r['estado'].upper():<10} {r['motivo'][:28]}")

            print("\nAcciones:")
            print("a. Aceptar Reembolso")
            print("b. Denegar Reembolso")
            print("c. Volver")
            act = input("Opción: ").strip().lower()

            if act == "a":
                rid_str = input("ID de la petición a ACEPTAR: ").strip()
                if rid_str.isdigit():
                    rid = int(rid_str)
                    r_row = con.execute("SELECT * FROM solicitudes_reembolso WHERE id = ?", (rid,)).fetchone()
                    if not r_row:
                        print(f"Error: Petición #{rid} no encontrada.")
                    elif r_row["estado"] != "pendiente":
                        print(f"La petición #{rid} ya está {r_row['estado'].upper()}.")
                    else:
                        order = con.execute("SELECT * FROM pedidos WHERE id = ?", (r_row["pedido_id"],)).fetchone()
                        now_iso = datetime.utcnow().isoformat() + "Z"
                        con.execute("""
                            UPDATE solicitudes_reembolso
                            SET estado = 'aprobada', respuesta_admin = 'Reembolso autorizado y procesado.', fecha_resolucion = ?, updated_at = ?
                            WHERE id = ?
                        """, (now_iso, now_iso, rid))
                        con.execute("UPDATE pedidos SET estado = 'devuelto', motivo_devolucion = ?, updated_at = ? WHERE id = ?",
                                    (r_row["motivo"], now_iso, order["id"]))
                        items = con.execute("SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?", (order["id"],)).fetchall()
                        for it in items:
                            con.execute("UPDATE inventario SET stock_disponible = stock_disponible + ?, updated_at = ? WHERE producto_id = ?",
                                        (it["cantidad"], now_iso, it["producto_id"]))
                        con.execute("UPDATE transacciones SET estado = 'reembolsado' WHERE pedido_id = ?", (order["id"],))
                        con.execute("UPDATE envios SET estado_envio = 'devuelto', updated_at = ? WHERE pedido_id = ?", (now_iso, order["id"]))

                        tx = con.execute("SELECT tarjeta_enmascarada FROM transacciones WHERE pedido_id = ?", (order["id"],)).fetchone()
                        if tx and tx["tarjeta_enmascarada"]:
                            last4 = tx["tarjeta_enmascarada"][-4:]
                            card = con.execute("SELECT id, saldo, marca FROM tarjetas_simuladas WHERE numero_tarjeta LIKE '%' || ?", (last4,)).fetchone()
                            if card:
                                n_sal = card["saldo"] + order["total"]
                                con.execute("UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?", (n_sal, now_iso, card["id"]))
                                print(f"[OK] Reembolso acreditado a tarjeta {card['marca']} (•••• {last4}). Nuevo saldo: ${n_sal:,.2f} MXN")

                        record_audit_log_sql(con, {
                            "usuario_id": 1,
                            "rol": "administrador",
                            "accion": "APROBACION_REEMBOLSO_ADMIN",
                            "modulo": "Devoluciones (CLI)",
                            "entidad_id": order["folio"],
                            "detalles": json.dumps({"requestId": rid, "monto": order["total"]})
                        })
                        con.commit()
                        print(f"[OK] Petición #{rid} APROBADA exitosamente. Pedido devuelto e inventario restaurado.")
            elif act == "b":
                rid_str = input("ID de la petición a DENEGAR: ").strip()
                if rid_str.isdigit():
                    rid = int(rid_str)
                    r_row = con.execute("SELECT * FROM solicitudes_reembolso WHERE id = ?", (rid,)).fetchone()
                    if not r_row:
                        print(f"Error: Petición #{rid} no encontrada.")
                    elif r_row["estado"] != "pendiente":
                        print(f"La petición #{rid} ya está {r_row['estado'].upper()}.")
                    else:
                        mot = input("Motivo formal de la denegación: ").strip() or "Solicitud excede el plazo de garantía."
                        now_iso = datetime.utcnow().isoformat() + "Z"
                        con.execute("""
                            UPDATE solicitudes_reembolso
                            SET estado = 'denegada', respuesta_admin = ?, fecha_resolucion = ?, updated_at = ?
                            WHERE id = ?
                        """, (mot, now_iso, now_iso, rid))
                        record_audit_log_sql(con, {
                            "usuario_id": 1,
                            "rol": "administrador",
                            "accion": "DENEGACION_REEMBOLSO_ADMIN",
                            "modulo": "Devoluciones (CLI)",
                            "entidad_id": f"REQ-{rid}",
                            "detalles": json.dumps({"requestId": rid, "motivo": mot})
                        })
                        con.commit()
                        print(f"[OK] Petición #{rid} DENEGADA.")
            con.close()
        elif opt == "8":
            con, _ = get_db()
            orders = con.execute("SELECT p.id, p.folio, u.nombre, p.metodo_pago, p.estado, p.total FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id ORDER BY p.id DESC LIMIT 20").fetchall()
            print(f"\n{'FOLIO':<28} {'CLIENTE':<24} {'METODO':<8} {'ESTADO':<10} {'TOTAL MXN':>12}")
            print("-" * 84)
            for o in orders:
                print(f"{o['folio']:<28} {o['nombre'][:22]:<24} {o['metodo_pago'].upper():<8} {o['estado'].upper():<10} ${o['total']:>11,.2f}")
            con.close()
        elif opt == "9":
            res = generate_sales_report_files()
            print(f"\n[OK] Reporte TXT generado en: {res['txt_path']}")
            print(f"[OK] Reporte CSV generado en: {res['csv_path']}")
            print(f"Total Vendido: ${res['total_dinero']:,.2f} MXN (Firma: {res['sha256'][:24]}...)")
        elif opt == "10":
            con, _ = get_db()
            shipments = con.execute("""
                SELECT 
                    e.pedido_id, p.folio, e.numero_guia,
                    COALESCE(e.almacen_origen, e.almacen_codigo, 'CEDIS Vallejo') as almacen,
                    p.direccion_envio, e.estado_envio,
                    COALESCE(e.tipo_vehiculo, 'camion') as tipo_vehiculo,
                    COALESCE(e.progreso_simulacion, 0) as progreso_simulacion,
                    COALESCE(e.simulacion_activa, 0) as simulacion_activa
                FROM envios e
                JOIN pedidos p ON p.id = e.pedido_id
                ORDER BY e.pedido_id DESC
            """).fetchall()
            print(f"\n{'ID':<5} {'FOLIO':<24} {'GUIA':<14} {'ALMACEN':<16} {'ESTADO':<12} {'VEHICULO':<8} {'PROGRESO':<8} {'SIMULACION'}")
            print("-" * 105)
            for s in shipments:
                sim_str = "ACTIVA" if s["simulacion_activa"] else "PAUSA"
                print(f"{s['pedido_id']:<5} {s['folio']:<24} {s['numero_guia'] or 'N/D':<14} {s['almacen'][:15]:<16} {s['estado_envio'].upper():<12} {s['tipo_vehiculo'].upper():<8} {s['progreso_simulacion']}%{'':<4} {sim_str}")
            print("\nAcciones de Logística:")
            print("a. Abrir Panel Web OpenStreetMap con Simulación en Vivo (Navegador)")
            print("b. Preparar Envío")
            print("c. Iniciar Simulación (Camión 🚚)")
            print("d. Iniciar Simulación (Auto 🚗)")
            print("e. Detener Simulación")
            print("f. Marcar Pedido como Entregado")
            print("g. Volver al menú principal")

            sub_opt = input("\nSeleccione acción (a-g): ").strip().lower()
            if sub_opt == "a":
                try:
                    webbrowser.open("http://localhost:3000/envios.html")
                    print("[OK] Panel OpenStreetMap abierto en http://localhost:3000/envios.html")
                except Exception as e:
                    print(f"Error al abrir navegador: {e}")
            elif sub_opt in ("b", "c", "d", "e", "f"):
                pid_str = input("ID de Pedido: ").strip()
                if pid_str.isdigit():
                    pid = int(pid_str)
                    if sub_opt == "b":
                        con.execute("UPDATE envios SET estado_envio = 'preparando', simulacion_activa = 0, progreso_simulacion = 0, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
                        con.commit()
                        print(f"[OK] Pedido #{pid} colocado en estado PREPARANDO.")
                    elif sub_opt == "c":
                        con.execute("UPDATE envios SET estado_envio = 'en_transito', simulacion_activa = 1, tipo_vehiculo = 'camion', updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
                        con.commit()
                        print(f"[OK] Simulación de CAMIÓN iniciada para el pedido #{pid}.")
                    elif sub_opt == "d":
                        con.execute("UPDATE envios SET estado_envio = 'en_transito', simulacion_activa = 1, tipo_vehiculo = 'auto', updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
                        con.commit()
                        print(f"[OK] Simulación de AUTO iniciada para el pedido #{pid}.")
                    elif sub_opt == "e":
                        con.execute("UPDATE envios SET simulacion_activa = 0, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
                        con.commit()
                        print(f"[OK] Simulación detenida para el pedido #{pid}.")
                    elif sub_opt == "f":
                        con.execute("UPDATE envios SET estado_envio = 'entregado', simulacion_activa = 0, progreso_simulacion = 100, updated_at = datetime('now') WHERE pedido_id = ?", (pid,))
                        con.execute("UPDATE pedidos SET estado = 'entregado', updated_at = datetime('now') WHERE id = ?", (pid,))
                        con.commit()
                        print(f"[OK] Pedido #{pid} marcado como ENTREGADO.")
            con.close()
        elif opt == "11":
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
