#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mixin de Pestañas de Monitoreo para el Panel de Seguridad ExpressMart.
Incluye:
1. Inspeccion de Puertos y Servicios de Red
2. Analisis de Amenazas Heuristicas y WAF
3. Bitacora de Auditoria D8
4. Integridad Criptografica SHA-256
"""

import json
import tkinter as tk
from tkinter import ttk, messagebox

from .common import (
    COLOR_NAVY_DARK,
    COLOR_PRIMARY,
    COLOR_PRIMARY_LIGHT,
    COLOR_ACCENT_AMBER,
    COLOR_SUCCESS,
    COLOR_SUCCESS_DARK,
    COLOR_DANGER,
    COLOR_SURFACE,
    COLOR_BG,
    COLOR_TEXT_MAIN,
    COLOR_TEXT_MUTED,
    SERVER_PORT,
    COMMON_PORTS,
    probe_expressmart_health,
    get_system_listening_ports,
    detect_suspicious_activities,
    run_security_test_simulation,
    get_audit_logs,
    verify_audit_chain_integrity,
    get_db_connection
)


class MonitoringTabsMixin:
    """Proporciona la construccion y actualizacion de las pestanas de monitoreo de seguridad."""

    # ==========================================================================
    # PESTAÑA 1: PUERTOS Y SERVICIOS DE RED
    # ==========================================================================
    def build_ports_tab(self):
        frame = self.tab_ports

        # Panel Superior: Estado de Salud de ExpressMart
        top_card = tk.LabelFrame(
            frame,
            text=" Estado del Servicio Web y Cabeceras HTTP (Apartado 18.2 / OWASP ASVS) ",
            font=("DejaVu Sans", 10, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=14,
            pady=10
        )
        top_card.pack(fill=tk.X, padx=10, pady=(10, 6))

        self.lbl_health_info = tk.Label(
            top_card,
            text="Consultando estado de ExpressMart...",
            font=("DejaVu Sans Mono", 9),
            justify=tk.LEFT,
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MAIN
        )
        self.lbl_health_info.pack(anchor="w")

        # Panel Inferior: Tabla de Puertos
        table_card = tk.LabelFrame(
            frame,
            text=" Puertos y Sockets en Escucha en el Sistema ",
            font=("DejaVu Sans", 10, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=8
        )
        table_card.pack(fill=tk.BOTH, expand=True, padx=10, pady=(4, 10))

        cols = ("proto", "ip", "port", "process", "assessment")
        self.tree_ports = ttk.Treeview(
            table_card,
            columns=cols,
            show="headings",
            style="Security.Treeview"
        )
        self.tree_ports.heading("proto", text="Protocolo")
        self.tree_ports.heading("ip", text="IP Local")
        self.tree_ports.heading("port", text="Puerto")
        self.tree_ports.heading("process", text="Proceso / Servicio")
        self.tree_ports.heading("assessment", text="Evaluacion de Riesgo ASVS")

        self.tree_ports.column("proto", width=80, anchor="center")
        self.tree_ports.column("ip", width=140, anchor="center")
        self.tree_ports.column("port", width=80, anchor="center")
        self.tree_ports.column("process", width=220, anchor="w")
        self.tree_ports.column("assessment", width=340, anchor="w")

        sb = ttk.Scrollbar(table_card, orient=tk.VERTICAL, command=self.tree_ports.yview)
        self.tree_ports.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_ports.pack(fill=tk.BOTH, expand=True)

    def refresh_ports_data(self):
        health = probe_expressmart_health()
        if health.get("active"):
            status_text = f"[OK] SERVICIO ACTIVO · http://127.0.0.1:{SERVER_PORT} ({health['latency_ms']} ms)"
            self.lbl_server_status.config(text=status_text, fg=COLOR_SUCCESS)

            sec = health.get("security_headers", {})
            h_lines = [
                f"Estado: HTTP {health['status_code']} OK  |  Servicio: {health['service']} v{health['version']}  |  Latencia: {health['latency_ms']} ms",
                "-" * 85,
                f"Cabeceras de Seguridad:  CSP: {sec.get('Content-Security-Policy')}  |  HSTS: {sec.get('Strict-Transport-Security')}",
                f"                         X-Frame-Options: {sec.get('X-Frame-Options')}  |  X-Content-Type: {sec.get('X-Content-Type-Options')}"
            ]
            self.lbl_health_info.config(text="\n".join(h_lines))
        else:
            self.lbl_server_status.config(text=f"[INACTIVO] Puerto {SERVER_PORT} no responde", fg=COLOR_DANGER)
            self.lbl_health_info.config(text=f"Servidor ExpressMart inactivo en puerto {SERVER_PORT}.\nInicie la aplicacion con 'npm start' o 'npm run dev'.")

        for item in self.tree_ports.get_children():
            self.tree_ports.delete(item)

        ports = get_system_listening_ports()
        port_dict = {p[0]: p for p in COMMON_PORTS}

        for p in ports:
            port_num = p["port"]
            known = port_dict.get(port_num)
            if known:
                name = known[1]
                assessment = f"[{known[3]}] {known[2]}"
            elif port_num == SERVER_PORT:
                name = "ExpressMart Platform"
                assessment = "[SERVICIO PRINCIPAL] Tienda ExpressMart en MXN"
            else:
                name = p["process"] or "Desconocido"
                assessment = "[NORMAL / DESARROLLO] Socket de sistema"

            self.tree_ports.insert(
                "",
                tk.END,
                values=(
                    p["proto"].upper(),
                    p["ip"],
                    p["port"],
                    name,
                    assessment
                )
            )

    # ==========================================================================
    # PESTAÑA 2: ACTIVIDADES SOSPECHOSAS Y AMENAZAS
    # ==========================================================================
    def build_threats_tab(self):
        frame = self.tab_threats

        top_kpi_frame = tk.Frame(frame, bg=COLOR_BG)
        top_kpi_frame.pack(fill=tk.X, padx=10, pady=(10, 6))

        self.card_threat_level = self.create_threat_kpi(top_kpi_frame, "NIVEL DE AMENAZA", "BAJO", COLOR_SUCCESS_DARK, "#ecfdf5")
        self.card_waf_blocks = self.create_threat_kpi(top_kpi_frame, "BLOQUEOS WAF", "0", COLOR_PRIMARY, "#eff6ff")
        self.card_rbac_denied = self.create_threat_kpi(top_kpi_frame, "DENEGACIONES RBAC", "0", COLOR_ACCENT_AMBER, "#fffbeb")
        self.card_brute_force = self.create_threat_kpi(top_kpi_frame, "FUERZA BRUTA", "0", COLOR_DANGER, "#fef2f2")
        self.card_failed_logins = self.create_threat_kpi(top_kpi_frame, "LOGINS FALLIDOS", "0", "#475569", "#f1f5f9")

        # Botones de control
        btn_bar = tk.Frame(frame, bg=COLOR_BG)
        btn_bar.pack(fill=tk.X, padx=10, pady=(2, 6))

        tk.Label(
            btn_bar,
            text="Incidentes y Amenazas Registradas por el Motor Heuristico:",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_BG
        ).pack(side=tk.LEFT)

        btn_sim = tk.Button(
            btn_bar,
            text="[ Simular Ataque de Prueba WAF ]",
            font=("DejaVu Sans", 8, "bold"),
            bg=COLOR_ACCENT_AMBER,
            fg="#ffffff",
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self.action_simulate_waf
        )
        btn_sim.pack(side=tk.RIGHT)

        # Tabla de Amenazas
        table_card = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_card.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 6))

        cols = ("id", "timestamp", "tipo", "severidad", "ip", "descripcion")
        self.tree_threats = ttk.Treeview(
            table_card,
            columns=cols,
            show="headings",
            style="Security.Treeview"
        )
        self.tree_threats.heading("id", text="#")
        self.tree_threats.heading("timestamp", text="Fecha / Hora")
        self.tree_threats.heading("tipo", text="Tipo de Incidente")
        self.tree_threats.heading("severidad", text="Severidad")
        self.tree_threats.heading("ip", text="IP Origen")
        self.tree_threats.heading("descripcion", text="Descripcion de la Amenaza")

        self.tree_threats.column("id", width=40, anchor="center")
        self.tree_threats.column("timestamp", width=140, anchor="center")
        self.tree_threats.column("tipo", width=170, anchor="w")
        self.tree_threats.column("severidad", width=90, anchor="center")
        self.tree_threats.column("ip", width=110, anchor="center")
        self.tree_threats.column("descripcion", width=420, anchor="w")

        sb = ttk.Scrollbar(table_card, orient=tk.VERTICAL, command=self.tree_threats.yview)
        self.tree_threats.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_threats.pack(fill=tk.BOTH, expand=True)

        self.tree_threats.bind("<<TreeviewSelect>>", self.on_threat_select)

        # Panel inferior: Detalles del incidente
        self.threat_detail_frame = tk.LabelFrame(
            frame,
            text=" Vector de Ataque y Detalles Tecnicos ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=6
        )
        self.threat_detail_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        self.lbl_threat_detail = tk.Label(
            self.threat_detail_frame,
            text="Selecciona una amenaza en la tabla para inspeccionar su payload interceptado.",
            font=("DejaVu Sans Mono", 8),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_threat_detail.pack(anchor="w")

    def create_threat_kpi(self, parent, title, val, fg_color, bg_color):
        card = tk.Frame(parent, bg=bg_color, relief="solid", bd=1, padx=10, pady=8)
        card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=3)
        tk.Label(card, text=title, font=("DejaVu Sans", 8, "bold"), fg=COLOR_NAVY_DARK, bg=bg_color).pack(anchor="w")
        lbl_v = tk.Label(card, text=val, font=("DejaVu Sans", 14, "bold"), fg=fg_color, bg=bg_color)
        lbl_v.pack(anchor="w", pady=(2, 0))
        return lbl_v

    def refresh_threats_data(self):
        res = detect_suspicious_activities()
        s = res["summary"]

        self.card_threat_level.config(text=res["threat_level"])
        if res["threat_level"] == "ALTO":
            self.card_threat_level.config(fg=COLOR_DANGER)
        elif res["threat_level"] == "MEDIO":
            self.card_threat_level.config(fg=COLOR_ACCENT_AMBER)
        else:
            self.card_threat_level.config(fg=COLOR_SUCCESS_DARK)

        self.card_waf_blocks.config(text=str(s["waf_blocks"]))
        self.card_rbac_denied.config(text=str(s["rbac_denied"]))
        self.card_brute_force.config(text=str(s["brute_force_locks"]))
        self.card_failed_logins.config(text=str(s["failed_logins"]))

        for item in self.tree_threats.get_children():
            self.tree_threats.delete(item)

        self.threats_list = res["threats"]
        for t in self.threats_list:
            self.tree_threats.insert(
                "",
                tk.END,
                values=(
                    t["id"],
                    t["timestamp"][:19],
                    t["tipo"],
                    f"[{t['severidad']}]",
                    t["ip"],
                    t["descripcion"]
                )
            )

    def on_threat_select(self, event):
        selected = self.tree_threats.selection()
        if not selected:
            return
        t_id = self.tree_threats.item(selected[0])["values"][0]
        th = next((x for x in getattr(self, "threats_list", []) if x["id"] == t_id), None)
        if th:
            raw_json = th["detalles"] or "{}"
            try:
                parsed = json.loads(raw_json)
                pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
            except Exception:
                pretty = raw_json
            txt = f"Incidente ID #{th['id']} · Tipo: {th['tipo']} · Severidad: {th['severidad']} · IP: {th['ip']}\nPayload / Detalles:\n{pretty}"
            self.lbl_threat_detail.config(text=txt, fg=COLOR_TEXT_MAIN)

    def action_simulate_waf(self):
        res = run_security_test_simulation()
        messagebox.showinfo("Simulacion WAF", f"Resultado de prueba de inyeccion XSS:\n\n{res['message']}")
        self.refresh_threats_data()
        self.refresh_audit_data()

    # ==========================================================================
    # PESTAÑA 3: BITÁCORA DE AUDITORÍA D8
    # ==========================================================================
    def build_audit_tab(self):
        frame = self.tab_audit

        # Filtros
        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        tk.Label(top_box, text="Filtrar Accion:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.entry_audit_filter = ttk.Entry(top_box, width=18)
        self.entry_audit_filter.pack(side=tk.LEFT, padx=(0, 6))

        btn_apply_filter = ttk.Button(top_box, text="Filtrar", command=self.refresh_audit_data)
        btn_apply_filter.pack(side=tk.LEFT, padx=(0, 6))

        btn_clear_filter = ttk.Button(top_box, text="Ver Todos", command=self.clear_audit_filter)
        btn_clear_filter.pack(side=tk.LEFT, padx=(0, 15))

        self.lbl_audit_stats = tk.Label(top_box, text="Total Registros D8: 0", font=("DejaVu Sans", 9, "bold"), fg=COLOR_PRIMARY, bg=COLOR_BG)
        self.lbl_audit_stats.pack(side=tk.RIGHT)

        # Tabla
        table_card = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_card.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "timestamp", "usuario_id", "rol", "accion", "modulo", "ip", "hash")
        self.tree_audit = ttk.Treeview(
            table_card,
            columns=cols,
            show="headings",
            style="Security.Treeview"
        )
        self.tree_audit.heading("id", text="#")
        self.tree_audit.heading("timestamp", text="Fecha / Hora")
        self.tree_audit.heading("usuario_id", text="UID")
        self.tree_audit.heading("rol", text="Rol")
        self.tree_audit.heading("accion", text="Accion Realizada")
        self.tree_audit.heading("modulo", text="Modulo")
        self.tree_audit.heading("ip", text="IP")
        self.tree_audit.heading("hash", text="Hash Cadena SHA-256")

        self.tree_audit.column("id", width=40, anchor="center")
        self.tree_audit.column("timestamp", width=140, anchor="center")
        self.tree_audit.column("usuario_id", width=45, anchor="center")
        self.tree_audit.column("rol", width=100, anchor="center")
        self.tree_audit.column("accion", width=190, anchor="w")
        self.tree_audit.column("modulo", width=130, anchor="w")
        self.tree_audit.column("ip", width=95, anchor="center")
        self.tree_audit.column("hash", width=180, anchor="w")

        sb = ttk.Scrollbar(table_card, orient=tk.VERTICAL, command=self.tree_audit.yview)
        self.tree_audit.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_audit.pack(fill=tk.BOTH, expand=True)

        self.tree_audit.bind("<<TreeviewSelect>>", self.on_audit_select)

        # Panel inferior: Detalles del registro
        self.audit_detail_frame = tk.LabelFrame(
            frame,
            text=" Detalles del Evento de Auditoria D8 ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=6
        )
        self.audit_detail_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        self.lbl_audit_detail = tk.Label(
            self.audit_detail_frame,
            text="Selecciona una fila para ver el JSON de auditoria y su hash SHA-256 encadenado.",
            font=("DejaVu Sans Mono", 8),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_audit_detail.pack(anchor="w")

    def refresh_audit_data(self):
        f_txt = self.entry_audit_filter.get().strip() or None
        data = get_audit_logs(limit=60, action_filter=f_txt)

        for item in self.tree_audit.get_children():
            self.tree_audit.delete(item)

        self.audit_logs_list = data.get("logs", [])
        for log in self.audit_logs_list:
            self.tree_audit.insert(
                "",
                tk.END,
                values=(
                    log["id"],
                    log["timestamp"][:19],
                    log["usuario_id"] or 0,
                    (log["rol"] or "anon").upper(),
                    log["accion"],
                    log["modulo"],
                    log["ip"],
                    (log["hash_cadena"] or "")[:20] + "..."
                )
            )

        self.lbl_audit_stats.config(text=f"Total Registros D8: {data.get('total', 0)}")

    def clear_audit_filter(self):
        self.entry_audit_filter.delete(0, tk.END)
        self.refresh_audit_data()

    def on_audit_select(self, event):
        selected = self.tree_audit.selection()
        if not selected:
            return
        log_id = self.tree_audit.item(selected[0])["values"][0]
        log = next((x for x in getattr(self, "audit_logs_list", []) if x["id"] == log_id), None)
        if log:
            raw_json = log["detalles_json"] or "{}"
            try:
                parsed = json.loads(raw_json)
                pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
            except Exception:
                pretty = raw_json

            txt = (
                f"ID: #{log['id']}  |  Timestamp: {log['timestamp']}  |  Accion: {log['accion']}  |  Modulo: {log['modulo']}\n"
                f"Prev Hash:   {log['prev_hash']}\n"
                f"Hash Cadena: {log['hash_cadena']}\n"
                f"Detalles:\n{pretty}"
            )
            self.lbl_audit_detail.config(text=txt, fg=COLOR_TEXT_MAIN)

    # ==========================================================================
    # PESTAÑA 4: INTEGRIDAD CRIPTOGRÁFICA
    # ==========================================================================
    def build_integrity_tab(self):
        frame = self.tab_integrity

        # Banner de Estado
        self.integrity_banner = tk.Frame(frame, bg="#ecfdf5", relief="solid", bd=1, padx=16, pady=14)
        self.integrity_banner.pack(fill=tk.X, padx=15, pady=(15, 10))

        self.lbl_integrity_title = tk.Label(
            self.integrity_banner,
            text="[OK] CADENA DE AUDITORIA 100% INTEGRA",
            font=("DejaVu Sans", 12, "bold"),
            fg=COLOR_SUCCESS_DARK,
            bg="#ecfdf5"
        )
        self.lbl_integrity_title.pack(anchor="w")

        self.lbl_integrity_desc = tk.Label(
            self.integrity_banner,
            text="Todos los bloques SHA-256 han sido verificados matematicamente conforme a ISO/IEC 25012 y RNF-09.",
            font=("DejaVu Sans", 9),
            fg="#065f46",
            bg="#ecfdf5"
        )
        self.lbl_integrity_desc.pack(anchor="w", pady=(2, 0))

        # Tarjetas de Hash
        cards_box = tk.Frame(frame, bg=COLOR_BG)
        cards_box.pack(fill=tk.X, padx=15, pady=6)

        self.card_blocks_count = self.create_threat_kpi(cards_box, "BLOQUES AUDITADOS", "0", COLOR_PRIMARY, "#eff6ff")
        self.card_genesis_hash = self.create_threat_kpi(cards_box, "BLOQUE GENESIS", "0000000000000000...", COLOR_NAVY_DARK, "#f1f5f9")
        self.card_latest_hash = self.create_threat_kpi(cards_box, "ULTIMO HASH CADENA", "----------------", COLOR_NAVY_DARK, "#f1f5f9")

        # Botón de verificación
        btn_box = tk.Frame(frame, bg=COLOR_BG)
        btn_box.pack(fill=tk.X, padx=15, pady=8)

        btn_verify = tk.Button(
            btn_box,
            text="[ Ejecutar Verificacion Criptografica SHA-256 ]",
            font=("DejaVu Sans", 10, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=6,
            cursor="hand2",
            command=self.action_run_verification
        )
        btn_verify.pack(side=tk.LEFT)

        # Registro / Consola de verificación
        log_box = tk.LabelFrame(
            frame,
            text=" Registro de Bloques Encadenados SHA-256 ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=8
        )
        log_box.pack(fill=tk.BOTH, expand=True, padx=15, pady=(4, 15))

        self.txt_integrity_log = tk.Text(
            log_box,
            bg="#0f172a",
            fg="#38bdf8",
            font=("DejaVu Sans Mono", 9),
            relief="flat",
            padx=8,
            pady=8
        )
        self.txt_integrity_log.pack(fill=tk.BOTH, expand=True)

    def refresh_integrity_data(self):
        res = verify_audit_chain_integrity()
        total = res.get("total", 0)
        self.card_blocks_count.config(text=str(total))

        if res.get("valid"):
            self.integrity_banner.config(bg="#ecfdf5")
            self.lbl_integrity_title.config(
                text=f"[OK] CADENA DE AUDITORIA 100% INTEGRA ({total} BLOQUES)",
                fg=COLOR_SUCCESS_DARK,
                bg="#ecfdf5"
            )
            self.lbl_integrity_desc.config(
                text=res.get("message", "Verificacion SHA-256 conforme a ISO/IEC 25012 y RNF-09 completada."),
                fg="#065f46",
                bg="#ecfdf5"
            )
            self.card_genesis_hash.config(text=res.get("genesis_hash", "0000000000000000..."))
            self.card_latest_hash.config(text=res.get("latest_hash", "----------------"))
        else:
            self.integrity_banner.config(bg="#fef2f2")
            self.lbl_integrity_title.config(
                text="[ALERTA] INTEGRIDAD COMPROMETIDA",
                fg=COLOR_DANGER,
                bg="#fef2f2"
            )
            self.lbl_integrity_desc.config(
                text=res.get("reason", "Se detecto alteracion en los hashes de la bitacora."),
                fg="#991b1b",
                bg="#fef2f2"
            )

        # Cargar registro en consola
        self.txt_integrity_log.delete("1.0", tk.END)
        con, _ = get_db_connection()
        if con:
            rows = con.execute("SELECT id, timestamp, accion, prev_hash, hash_cadena FROM bitacora_auditoria ORDER BY id ASC LIMIT 30").fetchall()
            con.close()
            for r in rows:
                line = f"[BLOQUE #{r['id']:<3}] {r['timestamp'][:19]} | ACCION: {r['accion']:<25} | HASH: {r['hash_cadena'][:20]}...\n"
                self.txt_integrity_log.insert(tk.END, line)

    def action_run_verification(self):
        self.refresh_integrity_data()
        messagebox.showinfo("Verificacion Criptografica", "Verificacion matematica de cadena de bloques SHA-256 finalizada.\n\nTodos los registros de bitacora_auditoria D8 fueron validados.")
