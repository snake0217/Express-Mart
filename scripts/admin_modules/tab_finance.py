# -*- coding: utf-8 -*-
"""
Pestaña de Resumen Financiero y Fondos Totales de ExpressMart (GUI Tkinter)
"""

try:
    import tkinter as tk
    from tkinter import ttk
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_ACCENT_AMBER,
    COLOR_SUCCESS_DARK, COLOR_SURFACE, COLOR_TEXT_MAIN, COLOR_TEXT_MUTED,
    get_financial_summary
)


class FinanceTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Finanzas."""

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
