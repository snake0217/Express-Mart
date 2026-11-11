# -*- coding: utf-8 -*-
"""
Pestaña de Registro de Ventas y Reportes Ejecutivos (TXT & CSV) (GUI Tkinter)
"""

import os
import sys
import subprocess

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_ACCENT_GOLD, COLOR_SUCCESS, COLOR_SUCCESS_DARK, COLOR_SURFACE,
    get_db, generate_sales_report_files
)


class SalesTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Ventas y Reportes."""

    def build_sales_tab(self):
        frame = self.tab_sales

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
