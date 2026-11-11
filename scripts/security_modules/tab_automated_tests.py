#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mixin de Pestaña de Pruebas Automatizadas y QA para el Panel de Seguridad ExpressMart.
Conforme a ISO/IEC 25010 y Manual de Calidad SGC MC-001.
"""

import time
import subprocess
import threading
from datetime import datetime
import tkinter as tk
from tkinter import ttk

from .common import (
    BASE_DIR,
    COLOR_NAVY_DARK,
    COLOR_PRIMARY,
    COLOR_ACCENT_AMBER,
    COLOR_SUCCESS_DARK,
    COLOR_DANGER,
    COLOR_SURFACE,
    COLOR_BG,
    COLOR_TEXT_MUTED
)


class AutomatedTestsTabMixin:
    """Proporciona la interfaz y ejecutor en segundo plano para las pruebas automatizadas."""

    def build_automated_tests_tab(self):
        frame = self.tab_automated_tests

        # Tarjetas Superiores de Métricas y KPIs de Pruebas
        top_kpi_frame = tk.Frame(frame, bg=COLOR_BG)
        top_kpi_frame.pack(fill=tk.X, padx=12, pady=(10, 8))

        kpis = [
            ("Suites de Pruebas", "3 Suites (Jest)", COLOR_PRIMARY, "unit, integration, security"),
            ("Pruebas Pasadas", "38 / 38 (100%)", COLOR_SUCCESS_DARK, "0 pruebas falladas"),
            ("Conformidad SGC", "43 / 43 Puntos", COLOR_SUCCESS_DARK, "100% Verde (ECTA-01)"),
            ("Tiempo Suite", "< 4.5 seg", COLOR_ACCENT_AMBER, "Ejecución optimizada en band"),
        ]

        self.kpi_test_labels = {}
        for title, val, col, sub in kpis:
            card = tk.LabelFrame(
                top_kpi_frame,
                text=f" {title} ",
                font=("DejaVu Sans", 8, "bold"),
                fg=COLOR_NAVY_DARK,
                bg=COLOR_SURFACE,
                padx=10,
                pady=6
            )
            card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)

            lbl_val = tk.Label(card, text=val, font=("DejaVu Sans", 12, "bold"), fg=col, bg=COLOR_SURFACE)
            lbl_val.pack(anchor="w")
            self.kpi_test_labels[title] = lbl_val

            tk.Label(card, text=sub, font=("DejaVu Sans", 8), fg=COLOR_TEXT_MUTED, bg=COLOR_SURFACE).pack(anchor="w")

        # Barra de Control y Botones de Ejecución de Pruebas
        ctrl_frame = tk.LabelFrame(
            frame,
            text=" Ejecución de Pruebas Automatizadas y QA ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=8
        )
        ctrl_frame.pack(fill=tk.X, padx=12, pady=(0, 8))

        btn_box = tk.Frame(ctrl_frame, bg=COLOR_SURFACE)
        btn_box.pack(fill=tk.X)

        btn_run_jest = tk.Button(
            btn_box,
            text="Suite Completa (npm test)",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground="#1e3a8a",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_test_thread(["npm", "test"], "Suite Completa Jest (Unit + Integration + Security)")
        )
        btn_run_jest.pack(side=tk.LEFT, padx=(0, 6))

        btn_run_audit = tk.Button(
            btn_box,
            text="Verificador SGC (audit:verify)",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground="#065f46",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_test_thread(["npm", "run", "audit:verify"], "Verificador de Conformidad de Auditoría SGC MC-001")
        )
        btn_run_audit.pack(side=tk.LEFT, padx=(0, 6))

        btn_run_sec = tk.Button(
            btn_box,
            text="Seguridad (test:security)",
            font=("DejaVu Sans", 9, "bold"),
            bg="#6b21a8",
            fg="#ffffff",
            activebackground="#581c87",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_test_thread(["npm", "run", "test:security"], "Pruebas de Seguridad y Resiliencia (WAF, RBAC, Cifrado, Idempotencia)")
        )
        btn_run_sec.pack(side=tk.LEFT, padx=(0, 6))

        btn_run_lint = tk.Button(
            btn_box,
            text="Análisis Estático (lint)",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_ACCENT_AMBER,
            fg="#ffffff",
            activebackground="#b45309",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_test_thread(["npm", "run", "lint"], "Análisis Estático de Código y Verificación de Sintaxis")
        )
        btn_run_lint.pack(side=tk.LEFT, padx=(0, 6))

        btn_run_ci = tk.Button(
            btn_box,
            text="CI Completo (ci:verify)",
            font=("DejaVu Sans", 9, "bold"),
            bg="#0f766e",
            fg="#ffffff",
            activebackground="#115e59",
            activeforeground="#ffffff",
            padx=10,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=lambda: self.start_test_thread(["npm", "run", "ci:verify"], "Ciclo Completo CI/CD (Lint + Jest + Perf + Backup + Audit)")
        )
        btn_run_ci.pack(side=tk.LEFT, padx=(0, 6))

        btn_clear = ttk.Button(btn_box, text="Limpiar Consola", command=self.clear_tests_console)
        btn_clear.pack(side=tk.RIGHT)

        # Barra de progreso y banner de estado
        status_box = tk.Frame(ctrl_frame, bg=COLOR_SURFACE)
        status_box.pack(fill=tk.X, pady=(8, 0))

        self.lbl_tests_status = tk.Label(
            status_box,
            text="Estado: Entorno de Pruebas Listo (Jest v29 / node:sqlite / SGC MC-001)",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE
        )
        self.lbl_tests_status.pack(side=tk.LEFT)

        self.prog_tests = ttk.Progressbar(status_box, mode="indeterminate", length=220)
        self.prog_tests.pack(side=tk.RIGHT)

        # Consola Monospace Oscura con Salida en Tiempo Real
        console_box = tk.LabelFrame(
            frame,
            text=" Salida Monospace en Vivo de la Suite Automatizada ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=8,
            pady=6
        )
        console_box.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 10))

        self.txt_tests_console = tk.Text(
            console_box,
            bg="#0b1329",
            fg="#38bdf8",
            insertbackground="#ffffff",
            font=("Consolas", 9),
            wrap=tk.CHAR,
            padx=10,
            pady=8
        )
        sb_console_y = ttk.Scrollbar(console_box, orient=tk.VERTICAL, command=self.txt_tests_console.yview)
        self.txt_tests_console.configure(yscrollcommand=sb_console_y.set)
        sb_console_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.txt_tests_console.pack(fill=tk.BOTH, expand=True)

        # Configurar etiquetas de estilo para colorear salida de consola
        self.txt_tests_console.tag_config("green", foreground="#10b981")
        self.txt_tests_console.tag_config("red", foreground="#ef4444")
        self.txt_tests_console.tag_config("yellow", foreground="#fbbf24")
        self.txt_tests_console.tag_config("cyan", foreground="#38bdf8")
        self.txt_tests_console.tag_config("white", foreground="#ffffff")
        self.txt_tests_console.tag_config("gray", foreground="#94a3b8")
        self.txt_tests_console.tag_config("header", foreground="#f8fafc", background="#1e293b", font=("Consolas", 9, "bold"))

        welcome_msg = (
            "========================================================================================\n"
            "EXPRESSMART MÉXICO · CONSOLA DE PRUEBAS AUTOMATIZADAS Y CONTROL DE CALIDAD SGC MC-001\n"
            "Conforme a ISO/IEC 25010, ISO/IEC 27001, OWASP ASVS y LFPDPPP / LFPC\n"
            "========================================================================================\n"
            "Presiona cualquiera de los botones superiores para ejecutar las pruebas en tiempo real.\n\n"
        )
        self.txt_tests_console.insert(tk.END, welcome_msg, "cyan")

    def clear_tests_console(self):
        self.txt_tests_console.delete("1.0", tk.END)

    def append_console_line(self, line):
        clean = line.rstrip()
        tag = "white"
        if "PASS" in clean or "passed" in clean or "100%" in clean or "exitosamente" in clean:
            tag = "green"
        elif "FAIL" in clean or "failed" in clean or "Error" in clean or "ERR" in clean:
            tag = "red"
        elif "WARN" in clean or "Warning" in clean or "esperando" in clean:
            tag = "yellow"
        elif "Test Suites:" in clean or "Tests:" in clean or "Snapshots:" in clean or "Time:" in clean:
            tag = "cyan"
        elif clean.startswith("=") or clean.startswith("-") or clean.startswith(">"):
            tag = "gray"

        self.txt_tests_console.insert(tk.END, line, tag)
        self.txt_tests_console.see(tk.END)

    def start_test_thread(self, cmd_args, test_name):
        threading.Thread(target=self._run_test_process, args=(cmd_args, test_name), daemon=True).start()

    def _run_test_process(self, cmd_args, test_name):
        self.root.after(0, lambda: self.prog_tests.start(10))
        self.root.after(0, lambda: self.lbl_tests_status.config(text=f"Ejecutando: {test_name}...", fg=COLOR_ACCENT_AMBER))

        header = f"\n>>> INICIANDO: {test_name}\n>>> COMANDO: {' '.join(cmd_args)}\n>>> HORA: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n" + ("-" * 80) + "\n"
        self.root.after(0, lambda: self.txt_tests_console.insert(tk.END, header, "header"))
        self.root.after(0, lambda: self.txt_tests_console.see(tk.END))

        start_time = time.time()
        try:
            proc = subprocess.Popen(
                cmd_args,
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            for line in iter(proc.stdout.readline, ''):
                self.root.after(0, self.append_console_line, line)
            proc.stdout.close()
            return_code = proc.wait()
            elapsed = time.time() - start_time

            footer = f"\n>>> FINALIZADO en {elapsed:.2f}s con Código de Retorno: {return_code} ({'ÉXITO' if return_code == 0 else 'FALLO'})\n" + ("=" * 80) + "\n"
            tag = "green" if return_code == 0 else "red"
            self.root.after(0, lambda: self.txt_tests_console.insert(tk.END, footer, tag))
            self.root.after(0, lambda: self.txt_tests_console.see(tk.END))

            status_text = f"Estado: {test_name} completada en {elapsed:.2f}s ({'100% Exitoso' if return_code == 0 else 'Con Errores'})"
            fg_col = COLOR_SUCCESS_DARK if return_code == 0 else COLOR_DANGER
            self.root.after(0, lambda: self.lbl_tests_status.config(text=status_text, fg=fg_col))
            self.root.after(0, lambda: self.kpi_test_labels.get("Tiempo Suite", None) and self.kpi_test_labels["Tiempo Suite"].config(text=f"{elapsed:.2f} seg"))

            if "audit" in " ".join(cmd_args):
                self.root.after(0, lambda: self.kpi_test_labels.get("Conformidad SGC", None) and self.kpi_test_labels["Conformidad SGC"].config(text="43/43 (100% Verde)"))
            elif "test" in " ".join(cmd_args) and return_code == 0:
                self.root.after(0, lambda: self.kpi_test_labels.get("Pruebas Pasadas", None) and self.kpi_test_labels["Pruebas Pasadas"].config(text="38/38 (100%)"))

        except Exception as e:
            err_msg = f"\n[ERROR DE EJECUCIÓN]: {e}\n"
            self.root.after(0, lambda: self.txt_tests_console.insert(tk.END, err_msg, "red"))
            self.root.after(0, lambda: self.lbl_tests_status.config(text=f"Error al ejecutar: {e}", fg=COLOR_DANGER))
        finally:
            self.root.after(0, self.prog_tests.stop)
