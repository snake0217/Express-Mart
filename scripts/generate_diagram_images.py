#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador Automatizado de Imágenes Técnicas de Arquitectura, ER y Casos de Uso
Express Mart México S.A. de C.V. - Auditoría 2026
"""

import os
import subprocess

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIAGRAMS_DIR = os.path.join(BASE_DIR, 'docs', 'diagramas')
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

def render_dot(dot_source, filename, dpi=200):
    dot_path = os.path.join(DIAGRAMS_DIR, f"{filename}.dot")
    png_path = os.path.join(DIAGRAMS_DIR, f"{filename}.png")
    with open(dot_path, 'w', encoding='utf-8') as f:
        f.write(dot_source)
    cmd = ['dot', f'-Gdpi={dpi}', '-Tpng', dot_path, '-o', png_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error generando {filename}: {res.stderr}")
        raise RuntimeError(res.stderr)
    print(f"[OK] Diagrama generado: {png_path} ({os.path.getsize(png_path)} bytes)")
    return png_path

def build_architecture_dot():
    return """digraph ArquitecturaGeneral {
    graph [rankdir=TB, splines=ortho, nodesep=0.5, ranksep=0.7, fontname="DejaVu Sans", fontsize=12, bgcolor="#FFFFFF"];
    node [fontname="DejaVu Sans", fontsize=10, shape=rect, style="rounded,filled", fillcolor="#FFFFFF", color="#CBD5E0", penwidth=1.5];
    edge [fontname="DejaVu Sans", fontsize=9, color="#4A5568", penwidth=1.2, arrowsize=0.8];

    // Título Principal
    labelloc="t";
    label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">
        <TR><TD><B><FONT POINT-SIZE="16" COLOR="#1A365D">EXPRESS MART MÉXICO — DIAGRAMA DE ARQUITECTURA GENERAL DEL SISTEMA</FONT></B></TD></TR>
        <TR><TD><FONT POINT-SIZE="11" COLOR="#718096">Arquitectura Integral por Capas, Microservicios, Seguridad Perimetral, Persistencia WAL y Pasarelas Externas</FONT></TD></TR>
    </TABLE>>;

    // Capa de Clientes / Presentación
    subgraph cluster_clientes {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="12">1. Capa de Clientes e Interfaces de Usuario</FONT></B>>;
        style="filled,rounded";
        fillcolor="#F7FAFC";
        color="#2B6CB0";
        penwidth=2.0;

        CliWeb [label=<<B>Cliente Comprador</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Navegador Web / App Móvil<br/>(SPA Vanilla JS / CSS3 / TLS 1.3)</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        PortalVend [label=<<B>Portal de Vendedor</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Gestión de Catálogo e Inventario<br/>(HTTPS / RBAC)</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        PanelAdmin [label=<<B>Panel Admin GUI</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Python Tkinter Standalone<br/>(Finanzas, Usuarios, Roles)</FONT>>, fillcolor="#FEFCBF", color="#D69E2E"];
        PanelSec [label=<<B>Panel de Seguridad GUI</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Python Tkinter Standalone<br/>(Auditoría, Bitácora D8, Hashes)</FONT>>, fillcolor="#C6F6D5", color="#38A169"];
    }

    // Capa de Perímetro Seguro / API Gateway
    subgraph cluster_perimetro {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="12">2. Perímetro Seguro y API Gateway</FONT></B>>;
        style="filled,rounded";
        fillcolor="#EDF2F7";
        color="#2B6CB0";
        penwidth=2.0;

        APIGateway [label=<<B>API Gateway &amp; Reverse Proxy</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Express.js Core / Node.js Engine<br/>• Terminación TLS 1.3 &amp; HSTS<br/>• Rate Limiting (100 req/min por IP)<br/>• Validación y Sanitización XSS/SQLi<br/>• CORS &amp; Cabeceras Helmet</FONT>>, fillcolor="#2B6CB0", fontcolor="#FFFFFF", color="#1A365D", shape=box3d];
    }

    // Capa de Servicios de Negocio (Backend)
    subgraph cluster_servicios {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="12">3. Capa de Servicios de Negocio y Lógica de Dominio</FONT></B>>;
        style="filled,rounded";
        fillcolor="#F7FAFC";
        color="#2B6CB0";
        penwidth=2.0;

        SvcAuth [label=<<B>Servicio Cuentas &amp; Auth</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Control RBAC (5 roles)<br/>• MFA OTP por Correo<br/>• Scrypt / PBKDF2<br/>• Gestión Derechos ARCO</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcCat [label=<<B>Servicio Catálogo &amp; Búsqueda</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Motor de Búsqueda &lt; 2s<br/>• Filtros y Paginación<br/>• Reglas ISO/IEC 25012</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcCart [label=<<B>Servicio Carrito &amp; Checkout</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Carrito Persistente<br/>• Reglas ExpressPrime<br/>• Motor Cupones y Descuento</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcOrder [label=<<B>Servicio Pedidos &amp; Stock</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Reserva Atómica Stock<br/>• Hash Integridad SHA-256<br/>• Ciclo de Vida del Pedido</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcPay [label=<<B>Servicio de Pagos (PCI DSS)</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Tokenización SAQ-A<br/>• Claves de Idempotencia<br/>• Enmascaramiento **** 1234</FONT>>, fillcolor="#FED7D7", color="#E53E3E"];
        SvcShip [label=<<B>Servicio Logística &amp; Envíos</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Emisión Guías DHL/FedEx<br/>• Historial Rastreo JSON<br/>• Devoluciones y Garantías</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcNotif [label=<<B>Servicio Notificaciones</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Nodemailer Engine<br/>• Acuses Message-ID<br/>• Plantillas Transaccionales</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        SvcAudit [label=<<B>Servicio Bitácora &amp; Auditoría</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">• Encadenamiento SHA-256<br/>• Registro No Repudiable D8<br/>• Métricas de Caja y Ventas</FONT>>, fillcolor="#C6F6D5", color="#38A169"];
    }

    // Capa de Persistencia y Almacenes de Datos DFD Nivel 1
    subgraph cluster_datos {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="12">4. Capa de Persistencia y Almacenes DFD Nivel 1 (SQLite WAL)</FONT></B>>;
        style="filled,rounded";
        fillcolor="#EDF2F7";
        color="#2B6CB0";
        penwidth=2.0;

        BDRelacional [label=<<B>Base de Datos Transaccional (node:sqlite)</B><BR/><FONT POINT-SIZE="8" COLOR="#2D3748">Modo WAL + PRAGMA foreign_keys = ON<br/>Cifrado de Campos Sensibles en Reposo con AES-256-GCM<br/><b>Almacenes DFD Nivel 1:</b><br/>• D1: Usuarios, Sesiones, 2FA, ARCO, Prime<br/>• D2: Catálogo de Productos | D3: Inventario &amp; Carrito<br/>• D4: Pedidos, Partidas, Cupones, Notificaciones<br/>• D5: Transacciones PCI | D6: Envíos &amp; Guías<br/>• D7: Reseñas Verificadas | D8: Bitácora Inmutable</FONT>>, shape=cylinder, fillcolor="#FFFFFF", color="#1A365D", penwidth=2.0];
        
        BackupVault [label=<<B>Bóveda de Respaldo Externo</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Backups Diarios Cifrados<br/>AES-256 + Hash SHA-256 (WORM)</FONT>>, shape=cylinder, fillcolor="#FEFCBF", color="#D69E2E"];
    }

    // Capa de Integraciones Externas Certificadas
    subgraph cluster_externos {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="12">5. Integraciones Externas Certificadas</FONT></B>>;
        style="filled,rounded";
        fillcolor="#F7FAFC";
        color="#718096";
        penwidth=1.5;

        ExtPasarela [label=<<B>Pasarela de Pagos PCI DSS</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Stripe / Openpay (Nivel 1)<br/>Tokenización &amp; Adquirente</FONT>>, fillcolor="#FED7D7", color="#E53E3E"];
        ExtSMTP [label=<<B>Servidor SMTP Gmail</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">Google Mail TLS Seguro<br/>Despacho Códigos 2FA</FONT>>, fillcolor="#EBF8FF", color="#3182CE"];
        ExtCourier [label=<<B>Red de Paquetería</B><BR/><FONT POINT-SIZE="8" COLOR="#4A5568">DHL Express / FedEx / Estafeta<br/>Rastreo Telemático</FONT>>, fillcolor="#FEFCBF", color="#D69E2E"];
    }

    // Conexiones de Entrada
    CliWeb -> APIGateway [label="HTTPS / TLS 1.3"];
    PortalVend -> APIGateway [label="HTTPS / TLS 1.3"];
    PanelAdmin -> APIGateway [label="REST API Local"];
    PanelSec -> APIGateway [label="REST API Audit"];

    // Enrutamiento Gateway a Servicios
    APIGateway -> SvcAuth [label="Auth / MFA / ARCO"];
    APIGateway -> SvcCat [label="Catálogo / Búsqueda"];
    APIGateway -> SvcCart [label="Checkout / Carrito"];
    APIGateway -> SvcOrder [label="Gestión Pedidos"];
    APIGateway -> SvcPay [label="Liquidación Pago"];
    APIGateway -> SvcShip [label="Logística"];
    APIGateway -> SvcAudit [label="Pistas Forenses"];

    // Orquestación entre Servicios
    SvcCart -> SvcOrder [label="Crear Pedido"];
    SvcOrder -> SvcPay [label="Cobro Tokenizado"];
    SvcOrder -> SvcShip [label="Generar Envío"];
    SvcOrder -> SvcNotif [label="Notificar"];
    SvcAuth -> SvcNotif [label="Código 2FA"];
    SvcPay -> SvcAudit [label="Auditar Cobro"];

    // Conexiones a Persistencia
    SvcAuth -> BDRelacional [label="D1"];
    SvcCat -> BDRelacional [label="D2"];
    SvcCart -> BDRelacional [label="D3"];
    SvcOrder -> BDRelacional [label="D3 / D4"];
    SvcPay -> BDRelacional [label="D5"];
    SvcShip -> BDRelacional [label="D6"];
    SvcNotif -> BDRelacional [label="D4"];
    SvcAudit -> BDRelacional [label="D8"];
    BDRelacional -> BackupVault [label="Snapshot Diario Cifrado", style="dashed"];

    // Conexiones Externas
    SvcPay -> ExtPasarela [label="Token Seguro HTTPS / PCI DSS", color="#E53E3E", penwidth=1.5];
    SvcNotif -> ExtSMTP [label="SMTP TLS / 2FA", color="#3182CE", penwidth=1.5];
    SvcShip -> ExtCourier [label="API REST Guías", color="#D69E2E", penwidth=1.5];
}"""

def build_erd_dot():
    return """digraph ModeloEntidadRelacion {
    graph [rankdir=LR, splines=spline, nodesep=0.7, ranksep=1.2, fontname="DejaVu Sans", fontsize=11, bgcolor="#FFFFFF"];
    node [fontname="DejaVu Sans", fontsize=9, shape=none];
    edge [fontname="DejaVu Sans", fontsize=8, color="#2B6CB0", penwidth=1.2, arrowsize=0.8];

    labelloc="t";
    label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">
        <TR><TD><B><FONT POINT-SIZE="16" COLOR="#1A365D">EXPRESS MART MÉXICO — DIAGRAMA ENTIDAD-RELACIÓN COMPLETO (ERD)</FONT></B></TD></TR>
        <TR><TD><FONT POINT-SIZE="11" COLOR="#718096">Modelo Relacional de 16 Tablas, Llaves Primarias, Foráneas, Integridad Referencial y Cifrado AES-256</FONT></TD></TR>
    </TABLE>>;

    // TABLA USUARIOS (D1)
    tab_usuarios [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>usuarios (D1)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>email</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">password_hash</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [scrypt]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">nombre</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">rol</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [RBAC]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">mfa_enabled</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">direccion_cifrada</TD><TD ALIGN="RIGHT"><FONT COLOR="#E53E3E">TEXT [AES-256]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">telefono_cifrado</TD><TD ALIGN="RIGHT"><FONT COLOR="#E53E3E">TEXT [AES-256]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">membresia_premium</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">membresia_plan</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">activo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA SUSCRIPCIONES_PREMIUM
    tab_suscripciones [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>suscripciones_premium</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">plan</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [1m/3m/1a]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">monto</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">fecha_inicio</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">fecha_expiracion</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">estado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA SESIONES
    tab_sesiones [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>sesiones (D1-AUTH)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>token_id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [UUID]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">rol</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">mfa_verificado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">expira_en</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER [5m]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">revocada</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA CATALOGO (D2)
    tab_catalogo [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>catalogo (D2)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>sku</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">nombre</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">categoria</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">marca</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">precio</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">imagen_url</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">vendedor_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">activo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA INVENTARIO (D3)
    tab_inventario [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>inventario (D3)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>producto_id</B> (PK,FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">stock_disponible</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">stock_reservado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">ubicacion_almacen</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">ultima_conciliacion</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA CARRITO_ITEMS
    tab_carrito [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>carrito_items (D3-CART)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">producto_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">cantidad</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA CUPONES
    tab_cupones [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>cupones (D4-CUP)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>codigo</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">descripcion</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">tipo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">valor</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">monto_minimo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">activo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA PEDIDOS (D4)
    tab_pedidos [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>pedidos (D4)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>folio</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [EXP-2026]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">subtotal</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">impuestos</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL [IVA 16%]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">costo_envio</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL [$0 Prime]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">total</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">estado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">direccion_envio_cifrada</TD><TD ALIGN="RIGHT"><FONT COLOR="#E53E3E">TEXT [AES-256]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>hash_integridad</B></TD><TD ALIGN="RIGHT"><FONT COLOR="#276749">TEXT [SHA-256]</FONT></TD></TR>
    </TABLE>>];

    // TABLA PEDIDO_ITEMS
    tab_pedido_items [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>pedido_items (D4-ITEM)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">pedido_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">producto_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">nombre_producto</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [snapshot]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">cantidad</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">precio_unitario</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL [congelado]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">subtotal</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
    </TABLE>>];

    // TABLA TRANSACCIONES (D5)
    tab_transacciones [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>transacciones (D5)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">pedido_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>referencia_pasarela</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">proveedor_pasarela</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">monto</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">REAL</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">tarjeta_enmascarada</TD><TD ALIGN="RIGHT"><FONT COLOR="#276749">TEXT [**** 1234]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">token_pci</TD><TD ALIGN="RIGHT"><FONT COLOR="#276749">TEXT [SAQ-A]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>idempotency_key</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">estado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA ENVIOS (D6)
    tab_envios [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>envios (D6)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>pedido_id</B> (UQ,FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">proveedor_paqueteria</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [DHL/FedEx]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>numero_guia</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">estado_envio</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">fecha_estimada</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">historial_rastreo_json</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA RESENAS (D7)
    tab_resenas [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#1A365D"><FONT COLOR="#FFFFFF"><B>resenas (D7)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">producto_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">pedido_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">calificacion</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER [1-5]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">comentario</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">verificada</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA NOTIFICACIONES
    tab_notificaciones [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>notificaciones (D4-NOTIF)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">pedido_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">canal</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [correo]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">evento</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">asunto</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">acuse_recibo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA DERECHOS_ARCO
    tab_arco [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>derechos_arco (D1-ARCO)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>folio</B> (UQ)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id (FK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">tipo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [ARCO]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">estado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">respuesta</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
    </TABLE>>];

    // TABLA MFA_EMAIL_CODES
    tab_mfa [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#2B6CB0" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#2B6CB0"><FONT COLOR="#FFFFFF"><B>mfa_email_codes (D1-SEC)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">email</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">codigo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [6 dígitos]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">proposito</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [reg/login]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">expira_en</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER [5m]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usado</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
    </TABLE>>];

    // TABLA BITACORA_AUDITORIA (D8)
    tab_bitacora [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#22543D" BGCOLOR="#FFFFFF">
        <TR><TD COLSPAN="2" BGCOLOR="#22543D"><FONT COLOR="#FFFFFF"><B>bitacora_auditoria (D8)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B> (PK)</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">timestamp</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT [ms]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">usuario_id</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">INTEGER</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">rol</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">accion</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">modulo</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">ip</TD><TD ALIGN="RIGHT"><FONT COLOR="#718096">TEXT</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>prev_hash</B></TD><TD ALIGN="RIGHT"><FONT COLOR="#276749">TEXT [SHA-256]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>hash_cadena</B></TD><TD ALIGN="RIGHT"><FONT COLOR="#276749">TEXT [Inmutable]</FONT></TD></TR>
    </TABLE>>];

    // RELACIONES (Cardinadades y Llaves Foráneas)
    tab_usuarios -> tab_suscripciones [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_sesiones [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_catalogo [label="1 : N (vendedor)", color="#2B6CB0"];
    tab_usuarios -> tab_carrito [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_pedidos [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_resenas [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_notificaciones [label="1 : N", color="#2B6CB0"];
    tab_usuarios -> tab_arco [label="1 : N", color="#2B6CB0"];

    tab_catalogo -> tab_inventario [label="1 : 1 (producto_id)", color="#1A365D", penwidth=1.5];
    tab_catalogo -> tab_carrito [label="1 : N", color="#2B6CB0"];
    tab_catalogo -> tab_pedido_items [label="1 : N", color="#2B6CB0"];
    tab_catalogo -> tab_resenas [label="1 : N", color="#2B6CB0"];

    tab_pedidos -> tab_pedido_items [label="1 : N (partidas)", color="#1A365D", penwidth=1.5];
    tab_pedidos -> tab_transacciones [label="1 : N (cobros)", color="#1A365D", penwidth=1.5];
    tab_pedidos -> tab_envios [label="1 : 1 (guía)", color="#1A365D", penwidth=1.5];
    tab_pedidos -> tab_notificaciones [label="1 : N", color="#2B6CB0"];
    tab_pedidos -> tab_resenas [label="1 : N (opcional)", color="#2B6CB0", style="dashed"];

    tab_cupones -> tab_pedidos [label="1 : N (aplica)", color="#718096", style="dashed"];
    tab_usuarios -> tab_bitacora [label="1 : N (audita)", color="#22543D", style="dotted"];
}"""

def build_use_cases_dot():
    return """digraph CasosDeUso {
    graph [rankdir=LR, splines=spline, nodesep=0.4, ranksep=1.0, fontname="DejaVu Sans", fontsize=11, bgcolor="#FFFFFF"];
    node [fontname="DejaVu Sans", fontsize=9];
    edge [fontname="DejaVu Sans", fontsize=8, color="#4A5568", penwidth=1.2, arrowsize=0.7];

    labelloc="t";
    label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">
        <TR><TD><B><FONT POINT-SIZE="16" COLOR="#1A365D">EXPRESS MART MÉXICO — DIAGRAMA DE CASOS DE USO (UML)</FONT></B></TD></TR>
        <TR><TD><FONT POINT-SIZE="11" COLOR="#718096">Casos de Uso de Comercio Electrónico, RBAC, Tokenización PCI DSS, Auditoría SHA-256 y Notificaciones</FONT></TD></TR>
    </TABLE>>;

    // ACTORES (Estilo UML)
    node [shape=rect, style="rounded,filled", fillcolor="#EBF8FF", color="#2B6CB0", penwidth=1.5];
    ActorCliente [label=<<B>«Actor»</B><BR/><FONT POINT-SIZE="11"><B>Cliente / Comprador</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Navegador Web / Mobile</FONT>>];
    ActorVendedor [label=<<B>«Actor»</B><BR/><FONT POINT-SIZE="11"><B>Vendedor</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Portal Comercial</FONT>>];
    ActorAdmin [label=<<B>«Actor»</B><BR/><FONT POINT-SIZE="11"><B>Administrador</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Panel GUI &amp; Finanzas</FONT>>, fillcolor="#FEFCBF", color="#D69E2E"];
    ActorAuditor [label=<<B>«Actor»</B><BR/><FONT POINT-SIZE="11"><B>Auditor de Sistemas</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Seguridad &amp; Forense</FONT>>, fillcolor="#C6F6D5", color="#276749"];

    // ACTORES EXTERNOS
    node [fillcolor="#FED7D7", color="#E53E3E"];
    ActorPasarela [label=<<B>«Sistema Externo»</B><BR/><FONT POINT-SIZE="10"><B>Pasarela PCI DSS</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Stripe / Openpay</FONT>>];
    ActorSMTP [label=<<B>«Sistema Externo»</B><BR/><FONT POINT-SIZE="10"><B>Servidor SMTP</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">Nodemailer Gmail</FONT>>, fillcolor="#E2E8F0", color="#4A5568"];
    ActorCourier [label=<<B>«Sistema Externo»</B><BR/><FONT POINT-SIZE="10"><B>Paquetería</B></FONT><BR/><FONT POINT-SIZE="8" COLOR="#718096">DHL / FedEx</FONT>>, fillcolor="#FEFCBF", color="#D69E2E"];

    // LÍMITE DEL SISTEMA (System Boundary)
    subgraph cluster_expressmart {
        label=<<B><FONT COLOR="#1A365D" POINT-SIZE="13">Límite del Sistema: Plataforma Express Mart v2.0</FONT></B>>;
        style="filled,rounded";
        fillcolor="#F7FAFC";
        color="#1A365D";
        penwidth=2.0;

        node [shape=ellipse, style="filled", fillcolor="#FFFFFF", color="#2B6CB0", penwidth=1.3, fontname="DejaVu Sans", fontsize=9];

        // Casos de Uso Autenticación & Cuenta
        UC01 [label="CU-01: Registrarse con Verificación"];
        UC02 [label="CU-02: Iniciar Sesión con 2FA OTP"];
        UC03 [label="CU-03: Contratar Membresía ExpressPrime"];
        UC04 [label="CU-04: Ejercer Derechos ARCO (LFPDPPP)"];
        UC_OTP [label="«include»<BR/>Despachar Código OTP", style="filled,dashed", fillcolor="#EDF2F7", color="#718096"];

        // Casos de Uso Compra y Catálogo
        UC05 [label="CU-05: Buscar y Filtrar en Catálogo (&lt; 2s)"];
        UC06 [label="CU-06: Gestionar Carrito Persistente"];
        UC07 [label="CU-07: Aplicar Cupones y Beneficios Prime"];
        UC08 [label="CU-08: Checkout y Pago Seguro (PCI DSS)"];
        UC_TOKEN [label="«include»<BR/>Tokenizar Tarjeta en Iframe", style="filled,dashed", fillcolor="#FED7D7", color="#E53E3E"];
        UC_STOCK [label="«include»<BR/>Reserva Atómica de Stock", style="filled,dashed", fillcolor="#EDF2F7", color="#718096"];

        // Casos de Uso Post-Compra
        UC09 [label="CU-09: Rastrear Envío y Paquetería"];
        UC10 [label="CU-10: Emitir Reseña Verificada"];

        // Casos de Uso Vendedor
        UC11 [label="CU-11: Publicar y Editar en Catálogo"];
        UC12 [label="CU-12: Monitorear Existencias de Inventario"];

        // Casos de Uso Administrador
        UC13 [label="CU-13: Gestionar Usuarios y Roles RBAC"];
        UC14 [label="CU-14: Operar Panel GUI y Finanzas"];
        UC15 [label="CU-15: Crear Cuentas de Admin/Auditor"];

        // Casos de Uso Auditor
        UC16 [label="CU-16: Consultar Bitácora Criptográfica D8"];
        UC17 [label="CU-17: Verificar Cadena de Hashes SHA-256"];
        UC18 [label="CU-18: Generar Reportes y Log de Ventas"];
    }

    // CONEXIONES CLIENTE
    ActorCliente -> UC01;
    ActorCliente -> UC02;
    ActorCliente -> UC03;
    ActorCliente -> UC04;
    ActorCliente -> UC05;
    ActorCliente -> UC06;
    ActorCliente -> UC07;
    ActorCliente -> UC08;
    ActorCliente -> UC09;
    ActorCliente -> UC10;

    // CONEXIONES VENDEDOR
    ActorVendedor -> UC02;
    ActorVendedor -> UC11;
    ActorVendedor -> UC12;

    // CONEXIONES ADMINISTRADOR
    ActorAdmin -> UC02;
    ActorAdmin -> UC13;
    ActorAdmin -> UC14;
    ActorAdmin -> UC15;
    ActorAdmin -> UC18;

    // CONEXIONES AUDITOR
    ActorAuditor -> UC02;
    ActorAuditor -> UC16;
    ActorAuditor -> UC17;
    ActorAuditor -> UC18;

    // INCLUDES & EXTENDS INTERNOS
    UC01 -> UC_OTP [style="dashed", label="«include»"];
    UC02 -> UC_OTP [style="dashed", label="«include»"];
    UC08 -> UC_TOKEN [style="dashed", label="«include»"];
    UC08 -> UC_STOCK [style="dashed", label="«include»"];
    UC07 -> UC06 [style="dashed", label="«extend»"];

    // CONEXIONES EXTERNAS
    UC_OTP -> ActorSMTP [color="#3182CE", label="Envía Correo"];
    UC_TOKEN -> ActorPasarela [color="#E53E3E", label="Tokeniza PAN"];
    UC08 -> ActorPasarela [color="#E53E3E", label="Autoriza Cargo"];
    UC09 -> ActorCourier [color="#D69E2E", label="Consulta API"];
}"""

if __name__ == '__main__':
    print("Iniciando renderizado de diagramas técnicos...")
    render_dot(build_architecture_dot(), 'diagrama_arquitectura_general')
    render_dot(build_erd_dot(), 'diagrama_entidad_relacion')
    render_dot(build_use_cases_dot(), 'diagrama_casos_de_uso')
    print("Todos los diagramas técnicos han sido generados exitosamente en docs/diagramas/")
