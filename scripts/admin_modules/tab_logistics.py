# -*- coding: utf-8 -*-
"""
Pestaña de Gestión de Logística, Almacenes y Envíos OpenStreetMap (GUI Tkinter)
"""

import json
import webbrowser

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_SUCCESS, COLOR_SUCCESS_DARK, COLOR_SURFACE, COLOR_TEXT_MAIN,
    COLOR_TEXT_MUTED, get_db, record_audit_log_sql, decrypt_aes_gcm
)


class LogisticsTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Logística."""

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
            try:
                con.execute("SELECT almacen_origen, tipo_vehiculo, progreso_simulacion, simulacion_activa FROM envios LIMIT 1")
            except Exception:
                con.execute("ALTER TABLE envios ADD COLUMN almacen_origen TEXT")
                con.execute("ALTER TABLE envios ADD COLUMN tipo_vehiculo TEXT DEFAULT 'camion'")
                con.execute("ALTER TABLE envios ADD COLUMN progreso_simulacion INTEGER DEFAULT 0")
                con.execute("ALTER TABLE envios ADD COLUMN simulacion_activa INTEGER DEFAULT 0")
                con.commit()

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

            self.all_shipments = []
            for r in rows:
                dest = decrypt_aes_gcm(r["direccion_envio_cifrada"]) if r["direccion_envio_cifrada"] else "México"
                self.all_shipments.append({
                    "pedido_id": r["pedido_id"],
                    "folio": r["folio"],
                    "numero_guia": r["numero_guia"],
                    "almacen": r["almacen"],
                    "direccion_envio": dest,
                    "estado_envio": r["estado_envio"],
                    "tipo_vehiculo": r["tipo_vehiculo"],
                    "progreso_simulacion": r["progreso_simulacion"],
                    "simulacion_activa": r["simulacion_activa"]
                })
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
                "detalles": {"pedidoId": pid, "estado": "preparando"}
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
                "detalles": {"pedidoId": pid, "tipoVehiculo": vehicle_type, "simulacion": True}
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
                "detalles": {"pedidoId": pid, "simulacion": False}
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
                "detalles": {"pedidoId": pid, "estado": "entregado"}
            })
            con.commit()
            messagebox.showinfo("Envío Entregado", f"El pedido #{pid} ha sido entregado exitosamente.")
            self.refresh_logistics_data()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def refresh_all(self):
        if hasattr(self, "refresh_finance_data"):
            self.refresh_finance_data()
        if hasattr(self, "refresh_accounts_data"):
            self.refresh_accounts_data()
        if hasattr(self, "refresh_cards_data"):
            self.refresh_cards_data()
        if hasattr(self, "refresh_refunds_data"):
            self.refresh_refunds_data()
        if hasattr(self, "refresh_sales_data"):
            self.refresh_sales_data()
        self.refresh_logistics_data()
