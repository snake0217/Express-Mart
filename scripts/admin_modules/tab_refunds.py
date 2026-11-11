# -*- coding: utf-8 -*-
"""
Pestaña de Gestión de Peticiones de Reembolso (LFPC / MC-001) (GUI Tkinter)
"""

import json
from datetime import datetime

try:
    import tkinter as tk
    from tkinter import ttk, messagebox, simpledialog
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_SUCCESS, COLOR_SUCCESS_DARK, COLOR_DANGER, COLOR_SURFACE,
    COLOR_TEXT_MAIN, COLOR_TEXT_MUTED, get_db, record_audit_log_sql
)


class RefundsTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Reembolsos."""

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
                "detalles": {"requestId": req_id, "monto": order["total"], "folio": order["folio"]}
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
            if hasattr(self, "refresh_cards_data"):
                self.refresh_cards_data()
            if hasattr(self, "refresh_finance_data"):
                self.refresh_finance_data()
            if hasattr(self, "refresh_sales_data"):
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
                "detalles": {"requestId": req_id, "motivoRechazo": motivo.strip()}
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
