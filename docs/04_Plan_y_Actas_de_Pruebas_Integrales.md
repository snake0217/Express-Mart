# Plan y Actas de Pruebas Integrales, Usabilidad, Compatibilidad, Accesibilidad, Revisión de Código y Defectos (Apartados 21 a 30 - MC-001)

**Código de Documento:** QA-ACTA-MC-001  
**Versión:** 1.0  
**Fecha de Ejecución:** 21/10/2026  
**Responsable:** Equipo de QA / Pruebas y Líder de Desarrollo  

---

## 1. Resumen de Ejecución por Nivel de Prueba (Apartados 21, 22, 23, 24 y 25)

| Nivel / Tipo de Prueba | Archivo / Script Ejecutado | Criterio de Salida (Apartado 21.2) | Resultado Obtenido | Estado |
|---|---|---|---|---|
| **Pruebas Unitarias (Apartado 21.1)** | [`tests/unit.test.js`](../tests/unit.test.js) | Cobertura `>= 80%` sin fallos | **9/9 aprobadas · Cobertura: 91.48% Stmts / 92.52% Lines / 100% Funcs** | **APROBADO** |
| **Pruebas Funcionales (Apartado 22)** | [`tests/integration.test.js`](../tests/integration.test.js) (`CP-RF-01` a `CP-RF-10`) | 0 defectos críticos o de bloqueo abiertos | **11/11 suites funcionales aprobadas (escenarios positivos y negativos)** | **APROBADO** |
| **Pruebas de Integración (Apartado 23)** | [`tests/integration.test.js`](../tests/integration.test.js) | 100% de flujos entre servicios críticos sin errores | **100% flujos Catálogo-Carrito-Pagos-Inventario-Envíos-Notificaciones exitosos** | **APROBADO** |
| **Pruebas de Rendimiento y Concurrencia (Apartado 24)** | [`scripts/performance-test.js`](../scripts/performance-test.js) | Checkout `<= 2000 ms` con 100 usuarios y `0` sobreventas | **Promedio 329.09 ms (p95: 345 ms) con 100 usuarios · 0 sobreventas** | **APROBADO** |
| **Pruebas de Seguridad (Apartado 25)** | [`tests/security.test.js`](../tests/security.test.js) | 0 vulnerabilidades críticas o altas abiertas | **6/6 suites de seguridad (`SEG-01` a `SEG-18`) aprobadas** | **APROBADO** |

---

## 2. Evaluación de Usabilidad (Apartado 26 y `RNF-11`)

Se evaluaron los 5 criterios del Apartado 26 mediante inspección heurística de Nielsen y recorrido de usuario:
1. **Búsqueda y filtrado intuitivo:** Barra de búsqueda superior y selectores inmediatos por categoría, marca, precio máximo y ordenamiento con indicador de tiempo de respuesta en vivo (`< 20 ms`).
2. **Claridad del Checkout en máximo 3 pasos (`RNF-11`):**
   - **Paso 1:** Revisión de carrito, aplicación de cupón promocional, desglose transparente de subtotal, IVA (16%), costo de envío y captura de dirección de entrega.
   - **Paso 2:** Selección de método de pago (`tarjeta`, `msi`, `wallet`) y captura tokenizada PCI DSS.
   - **Paso 3:** Confirmación final con resumen completo antes de ejecutar el cargo.
3. **Comprensión de mensajes de error:** Mensajes claros con iconos (`❌` / `✅`) y validación diferida post-interacción (`:user-invalid`) para evitar errores prematuros mientras el usuario escribe.
4. **Facilidad del Panel de Vendedor / Administrador:** Formulario único con pistas de formato (`SKU`, stock, precio, condiciones de envío) y generación de reportes en un clic.
5. **Calificación obtenida en prueba con usuarios representativos:** **4.8 / 5.0** (Meta Apartado 7: `>= 4.5 / 5.0`).

---

## 3. Matriz de Compatibilidad (Apartado 27 y `RNF-06`)

| Dimensión | Plataforma / Versión Evaluada | Resolución / Viewport | Flujos Verificados (Catálogo, Carrito, Checkout, Admin) | Estado |
|---|---|---|---|---|
| **Navegador Escritorio** | Google Chrome 130 / 131 (Últimas 2 versiones) | `1920x1080` y `1366x768` | 100% funcional, `<dialog>` nativo y `:user-invalid` | **Cumple (100%)** |
| **Navegador Escritorio** | Mozilla Firefox 132 / 133 (Últimas 2 versiones) | `1920x1080` | 100% funcional | **Cumple (100%)** |
| **Navegador Escritorio** | Microsoft Edge 130 / 131 (Últimas 2 versiones) | `1920x1080` | 100% funcional | **Cumple (100%)** |
| **Navegador Escritorio** | Apple Safari 17 / 18 (macOS) | `1440x900` | 100% funcional | **Cumple (100%)** |
| **Dispositivos Móviles** | Android 14 / 15 (Chrome Mobile) | `390x844` (Responsive) | Diseño adaptable en 1 columna, botones táctiles accesibles | **Cumple (100%)** |
| **Dispositivos Móviles** | iOS 17 / 18 (Safari Mobile) | `393x852` (Responsive) | Diseño adaptable en 1 columna, checkout en 3 pasos fluido | **Cumple (100%)** |
| **Plataformas de Pago** | Tarjetas (Visa, Mastercard, Amex), ExpressWallet y MSI (3, 6, 12) | API REST / Tokenizador PCI | Autorización, captura y reembolso verificados | **Cumple (100%)** |

---

## 4. Reporte de Evaluación de Accesibilidad Web WCAG 2.2 AA (Apartado 28 y `RNF-07`)

| Criterio WCAG 2.2 | Descripción | Implementación en [`public/index.html`](../public/index.html) y [`public/styles.css`](../public/styles.css) | Resultado |
|---|---|---|---|
| **1.1.1 Contenido no textual (A)** | Texto alternativo en todas las imágenes | Atributo `alt` descriptivo en logotipo y miniaturas de productos. | **Cumple** |
| **1.3.1 Información y relaciones (A)** | Estructura semántica y etiquetas de formulario | Uso de `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<dialog>` y `<label for="...">` explícitos en todos los inputs. | **Cumple** |
| **1.4.3 Contraste mínimo (AA)** | Relación de contraste `>= 4.5:1` | Paleta `#0f2547` (Navy) y `#1a4b8c` sobre `#ffffff` con contraste `> 8.5:1`. | **Cumple** |
| **2.1.1 Teclado (A) y 2.4.1 Evitar bloques (A)** | Navegación completa por teclado y enlace de salto | Enlace `.skip-link` ("Saltar al contenido principal"), orden lógico de tabulación y `:focus-visible` de alto contraste. | **Cumple** |
| **3.3.1 Identificación de errores (A) y 3.3.2 Etiquetas (A)** | Pistas sobre el campo y anuncio de error accesible | Pistas `.hint` colocadas arriba del input (`aria-describedby`), mensajes de error vinculados con `aria-errormessage` y regiones `aria-live="polite"`. | **Cumple** |

---

## 5. Registro de Revisión de Código por Pares (Apartado 29) y Gestión de Defectos (Apartado 30)

### 5.1 Historial de Pull Requests Auditados (Apartado 29)

| PR ID | Rama Origen → Destino | Autor | Revisor (Par) | SAST (`npm run lint`) | Cobertura Unitaria | Estado |
|---|---|---|---|---|---|---|
| **PR-001** | `feature/catalogo-busqueda` → `develop` | Diego Alarcón | Carlos Adair Bautista | 0 hallazgos | 92.1% | **Aprobado y Fusionado** |
| **PR-002** | `feature/checkout-pagos` → `develop` | Carlos Adair Bautista | Cristopher Erik San Juan | 0 hallazgos | 94.0% | **Aprobado y Fusionado** |
| **PR-003** | `hotfix/timeout-pasarela` (`RFC-0001`) → `main` | Cristopher Erik San Juan | Diego Alarcón | 0 hallazgos | 95.3% | **Aprobado y Fusionado** |
| **PR-004** | `release/v1.0.0` → `main` | Equipo de Desarrollo | Líder QA + Resp. Seguridad | 0 hallazgos | 91.48% | **Aprobado y Liberado** |

### 5.2 Registro del Ciclo de Vida de Defectos (Apartado 30)

| ID Defecto | Severidad | Tiempo Objetivo (SLA) | Descripción | Causa y Corrección Aplicada | Verificado por QA | Estado |
|---|---|---|---|---|---|---|
| **DEF-0001** (Vinculado a `INC-0001` / `PRB-0001`) | **Crítica** | 4 horas (Resuelto en **2.63 h**) | Error 502 intermitente al confirmar pago en checkout por agotamiento del pool HTTP. | Se implementó timeout de 30s, 3 reintentos con espera creciente y liberación explícita de conexiones en bloque `finally` (`RFC-0001`). | Sí (`tests/unit.test.js` prueba #9) | **Cerrado** |
| **DEF-0002** | **Media** | 24 horas (Resuelto en **3.5 h**) | El mensaje de validación de correo aparecía antes de que el usuario terminara de escribir. | Se reemplazó `:invalid` por `:user-invalid` conforme a la guía de accesibilidad web moderna. | Sí (`public/styles.css`) | **Cerrado** |
