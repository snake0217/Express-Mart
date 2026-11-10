#!/usr/bin/env bash
# ==============================================================================
# Script de Lanzamiento Rápido - Panel Administrativo y Financiero ExpressMart (GUI)
# Conforme a SGC MC-001 v1.0
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$DIR/scripts/admin_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/scripts/admin_panel.py"
elif [ -f "$DIR/admin_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/admin_panel.py"
elif [ -f "$DIR/../scripts/admin_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/../scripts/admin_panel.py"
else
    echo -e "\033[91m[ERROR]\033[0m No se encontró admin_panel.py"
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo -e "\033[91m[ERROR]\033[0m Python 3 no se encuentra instalado en el sistema."
    exit 1
fi

chmod +x "$PYTHON_SCRIPT" 2>/dev/null || true

# Configurar título de ventana de terminal
printf "\033]0;ExpressMart - Panel Administrativo y Financiero\007" 2>/dev/null || true

echo -e "\033[1;34m[ExpressMart]\033[0m Iniciando Panel Administrativo, Financiero y de Cuentas (GUI)..."

# Si se pasa --cli o no hay DISPLAY, ejecuta en consola; de lo contrario abre la GUI
exec python3 "$PYTHON_SCRIPT" "$@"
