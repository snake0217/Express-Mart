# Manual de Uso de Git, Gestión de Ramas (GitFlow) y Control de Versiones — ExpressMart

| Metadato | Valor |
| :--- | :--- |
| **Código de Documento** | `MAN-GIT-MC001` |
| **Versión** | `1.0.0` |
| **Fecha de Emisión** | `2026-10-24` |
| **Normativa de Referencia** | Manual de Calidad ExpressMart (`MC-001` §6.1, §9.1) y Plan de Auditoría (`ECTA-01`) |
| **Repositorio Remoto Oficial** | `https://github.com/snake0217/Express-Mart.git` |
| **Responsable Técnico** | Diego Alarcón De Jesús — Líder de Configuración y Despliegue |
| **Estado** | **APROBADO Y VIGENTE** |

---

## 1. Propósito y Alcance

El presente manual establece la guía operativa y normativa para el uso de **Git** y **GitHub** en el proyecto **ExpressMart E-Commerce**, en estricto apego a la **Sección 6.1 (Estándares de Codificación y Commits)** y la **Sección 9.1 (Gestión de Configuración y Control de Versiones — GitFlow)** del Manual de Calidad (`MC-001`).

Aplica a todos los desarrolladores, ingenieros de QA, operadores de despliegue y auditores que interactúen con el código fuente, scripts de base de datos y documentación técnica del repositorio oficial.

---

## 2. Configuración Inicial de Git y Conexión al Repositorio

### 2.1. Verificar la instalación de Git
Ejecuta en la terminal para comprobar que Git está instalado:

```bash
git --version
```

Si no está instalado:
- **Ubuntu / Debian:** `sudo apt update && sudo apt install -y git`
- **Fedora / RHEL:** `sudo dnf install -y git`
- **macOS:** `xcode-select --install` o `brew install git`
- **Windows:** Descargar e instalar desde `https://git-scm.com/download/win`

### 2.2. Configurar identidad del desarrollador
Todo commit en ExpressMart debe registrar el nombre completo y correo institucional del autor para mantener la trazabilidad de auditoría (`ECTA-01`):

```bash
git config --global user.name "Tu Nombre Completo"
git config --global user.email "tu.correo@expressmart.mx"
git config --global init.defaultBranch main
git config --global pull.rebase false
```

Para verificar la configuración aplicada:

```bash
git config --list
```

### 2.3. Clonar el repositorio o vincular un proyecto local existente

- **Opción A — Clonar el repositorio desde cero en una máquina nueva:**
  ```bash
  git clone https://github.com/snake0217/Express-Mart.git
  cd Express-Mart
  ```

- **Opción B — Vincular la carpeta local existente con el repositorio remoto:**
  ```bash
  cd /home/diego/Documentos/pauditoria
  git remote add origin https://github.com/snake0217/Express-Mart.git
  # Si el remoto 'origin' ya existía y deseas actualizar su URL:
  git remote set-url origin https://github.com/snake0217/Express-Mart.git
  git remote -v
  ```

---

## 3. Estrategia de Ramificación (Modelo GitFlow — `MC-001` §9.1)

ExpressMart implementa el flujo **GitFlow**, el cual separa el código productivo estable del trabajo de integración continua y del desarrollo de funcionalidades individuales.

### 3.1. Catálogo de Ramas Oficiales del Proyecto

| Tipo de Rama | Nomenclatura / Ejemplo Real en ExpressMart | Rama de Origen | Rama de Destino (Merge) | Propósito y Reglas de Protección |
| :--- | :--- | :--- | :--- | :--- |
| **Producción** | `main` | Inicial | — | Contiene únicamente versiones estables, auditadas y liberadas a producción. Prohibido hacer commits directos; solo recibe fusiones desde `release/*` o `hotfix/*`. |
| **Integración** | `develop` | `main` | `release/*` | Rama principal de desarrollo e integración continua. Concentra todas las funcionalidades terminadas antes de preparar una versión. |
| **Funcionalidad (Feature)** | `feature/catalogo-busqueda`<br>`feature/checkout-pagos` | `develop` | `develop` | Desarrollo de nuevos módulos, historias de usuario o mejoras técnicas. Se elimina tras fusionarse en `develop`. |
| **Liberación (Release)** | `release/v1.0.0` | `develop` | `main` y `develop` | Congelamiento de funcionalidades para pruebas integrales (UAT), verificación de auditoría (`npm run audit:verify`) y ajustes de metadatos de versión. |
| **Corrección Urgente (Hotfix)** | `hotfix/timeout-pasarela` | `main` | `main` y `develop` | Corrección inmediata de incidentes críticos detectados en producción sin interrumpir el trabajo en curso dentro de `develop`. |

### 3.2. Diagrama de Flujo de Ramas

```
main       o-------------------------o-------------------o (v1.0.0)
            \                       /                   /
hotfix/*     \                     o--- hotfix/timeout /
              \                                       /
release/*      \                               o-----o release/v1.0.0
                \                             /       \
develop          o---o-----------o-----------o---------o---
                      \         / \         /
feature/*              o-------o   o-------o
                       feature/    feature/
                       catalogo    checkout
```

---

## 4. Guía Práctica de Comandos para Creación y Manejo de Ramas

### 4.1. Consultar ramas existentes
```bash
# Ver ramas locales (la rama activa aparece con un asterisco *)
git branch

# Ver todas las ramas (locales y remotas en GitHub)
git branch -a

# Ver el historial gráfico resumido de todas las ramas
git log --oneline --graph --decorate --all -n 15
```

### 4.2. Crear una nueva rama de funcionalidad (`feature/*`)
Toda nueva funcionalidad **debe nacer siempre desde `develop` actualizada**:

```bash
# 1. Cambiarse a la rama develop
git switch develop
# (o bien: git checkout develop)

# 2. Descargar los últimos cambios del servidor remoto
git pull origin develop

# 3. Crear y cambiar a la nueva rama feature/<nombre-descriptivo>
git switch -c feature/notificaciones-correo
# (equivalente clásico: git checkout -b feature/notificaciones-correo)
```

### 4.3. Cambiar entre ramas existentes
```bash
# Cambiar a la rama principal
git switch main

# Cambiar a la rama de integración
git switch develop

# Cambiar a una rama de funcionalidad existente
git switch feature/checkout-pagos
```

### 4.4. Subir (Publicar) una rama nueva a GitHub
La primera vez que subes una rama recién creada al repositorio remoto, debes usar la bandera `-u` (`--set-upstream`) para vincular tu rama local con su homóloga en GitHub:

```bash
git push -u origin feature/notificaciones-correo
```

Para subir todas las ramas locales de una sola vez al repositorio remoto:

```bash
git push -u origin --all
git push origin --tags
```

### 4.5. Fusionar (`merge`) una rama en `develop`
Una vez concluido el desarrollo y validadas las pruebas locales:

```bash
# 1. Ubicarse en la rama destino (develop) y actualizarla
git switch develop
git pull origin develop

# 2. Fusionar la rama de funcionalidad conservando el registro del merge (--no-ff)
git merge --no-ff feature/notificaciones-correo -m "chore(release): merge feature/notificaciones-correo en develop"

# 3. Subir la actualización a GitHub
git push origin develop
```

> **Nota de Gobernanza (`MC-001`):** En entornos colaborativos, la fusión hacia `develop` y `main` se realiza abriendo un **Pull Request (PR)** en GitHub para que pase por revisión de pares (Code Review) y validación automática del pipeline CI/CD (`.github/workflows/ci-cd.yml`).

### 4.6. Crear una rama de Liberación (`release/*`)
Cuando `develop` está lista para salir a producción:

```bash
# 1. Crear la rama release a partir de develop
git switch develop
git switch -c release/v1.1.0

# 2. Ejecutar validaciones obligatorias de calidad y auditoría
npm run lint
npm test
npm run audit:verify

# 3. Fusionar en main y etiquetar la versión
git switch main
git merge --no-ff release/v1.1.0 -m "chore(release): liberación oficial ExpressMart v1.1.0"
git tag -a v1.1.0 -m "Release ExpressMart v1.1.0"

# 4. Devolver posibles ajustes de la release hacia develop
git switch develop
git merge --no-ff release/v1.1.0

# 5. Subir cambios y etiquetas a GitHub
git push origin main develop --tags
```

### 4.7. Crear una rama de Corrección Urgente (`hotfix/*`)
Si ocurre un fallo crítico en producción (`main`):

```bash
# 1. Nace directamente desde main
git switch main
git pull origin main
git switch -c hotfix/timeout-pasarela

# 2. Aplicar corrección, correr tests y hacer commit
git add .
git commit -m "fix(checkout): ajustar timeout y reintento en pasarela de pagos"

# 3. Integrar tanto en main como en develop
git switch main
git merge --no-ff hotfix/timeout-pasarela -m "chore(release): integrar hotfix/timeout-pasarela en main"

git switch develop
git merge --no-ff hotfix/timeout-pasarela -m "chore(release): sincronizar hotfix/timeout-pasarela en develop"

# 4. Subir ambas ramas
git push origin main develop
```

### 4.8. Eliminar ramas obsoletas (Limpieza)
Después de fusionar una rama `feature/*` o `hotfix/*`:

```bash
# Eliminar la rama localmente (seguro: falla si no ha sido fusionada)
git branch -d feature/notificaciones-correo

# Eliminar la rama en el servidor remoto (GitHub)
git push origin --delete feature/notificaciones-correo
```

---

## 5. Estándar de Mensajes de Commit (Conventional Commits — `MC-001` §6.1)

Todos los mensajes de commit deben seguir la estructura estandarizada **Conventional Commits**:

```text
<tipo>(<alcance>): <descripción concisa en minúsculas y verbo imperativo>
```

### 5.1. Tipos de Commit Permitidos

| Tipo | Uso Obligatorio | Ejemplo en ExpressMart |
| :--- | :--- | :--- |
| `feat` | Nueva funcionalidad de negocio o interfaz | `feat(checkout): implementar checkout de 3 pasos en MXN` |
| `fix` | Corrección de un defecto o bug | `fix(payments): manejar timeout de pasarela con backoff` |
| `docs` | Creación o actualización de documentación | `docs(db): agregar política integral de base de datos POL-BD-MC001` |
| `security` | Controles de seguridad, RBAC, MFA o cifrado | `security(auth): aplicar bloqueo tras 5 intentos fallidos` |
| `test` | Adición o ajuste de pruebas unitarias/integración | `test(orders): validar cálculo de IVA 16% y cupones` |
| `refactor` | Mejora interna de código sin alterar funcionalidad | `refactor(catalog): optimizar consulta SQL de filtrado` |
| `perf` | Mejora de tiempos de respuesta o consumo | `perf(db): habilitar modo WAL en SQLite para concurrencia` |
| `ci` / `chore` | Configuración de pipelines, scripts o versiones | `chore(release): preparar paquete candidato release v1.0.0` |

---

## 6. Flujo de Trabajo Diario Paso a Paso (Checklist del Desarrollador)

Antes de registrar cualquier cambio en Git, sigue siempre esta secuencia de **6 pasos**:

1. **Verificar estado y rama actual:**
   ```bash
   git status
   ```
2. **Revisar exactamente qué líneas cambiaron:**
   ```bash
   git diff
   ```
3. **Ejecutar controles de calidad y auditoría antes del commit:**
   ```bash
   export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
   npm run lint
   npm test
   npm run audit:verify
   ```
4. **Agregar archivos al área de preparación (Staging Area):**
   ```bash
   # Agregar archivos específicos (recomendado)
   git add src/routes/orderRoutes.js tests/api.integration.test.js

   # O agregar todos los archivos modificados/nuevos respetando .gitignore
   git add -A
   ```
5. **Crear el commit con mensaje estandarizado:**
   ```bash
   git commit -m "feat(orders): agregar validación de stock mínimo antes del cobro"
   ```
6. **Subir los cambios al repositorio remoto en GitHub:**
   ```bash
   git push origin <nombre-de-tu-rama>
   ```

---

## 7. Resolución de Conflictos, Reversión Segura y Buenas Prácticas

### 7.1. Cómo resolver un conflicto de fusión (`Merge Conflict`)
Si dos personas modificaron las mismas líneas de un archivo y Git detiene el `merge`:
1. Ejecuta `git status` para identificar los archivos marcados como `both modified`.
2. Abre el archivo y localiza las marcas de conflicto:
   ```text
   <<<<<<< HEAD
   (Código en tu rama actual)
   =======
   (Código que viene de la rama que estás fusionando)
   >>>>>>> feature/otra-rama
   ```
3. Conserva el código correcto, elimina las líneas `<<<<<<<`, `=======` y `>>>>>>>`, y guarda el archivo.
4. Ejecuta `npm test` para comprobar que el sistema funciona.
5. Marca el conflicto como resuelto y finaliza el merge:
   ```bash
   git add <archivo-resuelto>
   git commit -m "chore(merge): resolver conflicto de fusión en <archivo>"
   ```

### 7.2. Comandos de emergencia y reversión segura
- **Descartar cambios no guardados en un archivo local:**
  ```bash
  git restore <ruta-del-archivo>
  ```
- **Guardar trabajo temporalmente sin hacer commit (`stash`) para cambiar de rama:**
  ```bash
  git stash push -m "avance parcial en catálogo"
  # Para recuperar los cambios después:
  git stash pop
  ```
- **Revertir un commit que ya fue subido a GitHub (sin borrar el historial de auditoría):**
  ```bash
  git revert <hash-del-commit>
  git push origin main
  ```
  *(Nota: Está prohibido usar `git push --force` en `main` y `develop` para preservar la inmutabilidad del historial exigida por `MC-001`).*

### 7.3. Archivos Prohibidos en Git (`.gitignore`)
Por política de seguridad (`MC-001` §7.1 y `POL-BD-MC001`), **nunca** deben subirse al repositorio:
- Archivos de variables de entorno con secretos reales (`.env`). Solo se versiona `.env.example`.
- Archivos binarios de base de datos activa (`data/*.sqlite`, `data/*.sqlite-wal`, `data/*.sqlite-shm`).
- Respaldos cifrados locales (`backups/*.enc`).
- Dependencias instaladas (`node_modules/`).
