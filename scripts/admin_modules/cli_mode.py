# -*- coding: utf-8 -*-
"""
Modo Línea de Comandos (CLI) para administración de ExpressMart cuando no hay entorno gráfico
"""

import os
import json
import webbrowser
from datetime import datetime

from .common import (
    get_db, get_financial_summary, generate_sales_report_files,
    hash_password_scrypt, delete_user_cascade, record_audit_log_entry,
    record_audit_log_sql, decrypt_aes_gcm
)


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
            rows = con.execute("""
                SELECT 
                    e.pedido_id, p.folio, e.numero_guia,
                    COALESCE(e.almacen_origen, e.almacen_codigo, 'CEDIS Vallejo') as almacen,
                    p.direccion_envio_cifrada, e.estado_envio,
                    COALESCE(e.tipo_vehiculo, 'camion') as tipo_vehiculo,
                    COALESCE(e.progreso_simulacion, 0) as progreso_simulacion,
                    COALESCE(e.simulacion_activa, 0) as simulacion_activa
                FROM envios e
                JOIN pedidos p ON p.id = e.pedido_id
                ORDER BY e.pedido_id DESC
            """).fetchall()

            shipments = []
            for r in rows:
                dest = decrypt_aes_gcm(r["direccion_envio_cifrada"]) if r["direccion_envio_cifrada"] else "México"
                shipments.append({**r, "direccion_envio": dest})

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
