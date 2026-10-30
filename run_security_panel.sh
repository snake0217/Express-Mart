#!/usr/bin/env bash
# ==============================================================================
# Script de Lanzamiento Rápido - Panel de Seguridad ExpressMart (MC-001)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Buscar scripts/security_panel.py ya sea desde la raíz o desde la carpeta scripts/
if [ -f "$DIR/scripts/security_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/scripts/security_panel.py"
elif [ -f "$DIR/security_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/security_panel.py"
elif [ -f "$DIR/../scripts/security_panel.py" ]; then
    PYTHON_SCRIPT="$DIR/../scripts/security_panel.py"
else
    echo -e "\033[91m[ERROR]\033[0m No se encontró security_panel.py"
    exit 1
fi

# Verificar que python3 esté disponible
if ! command -v python3 &>/dev/null; then
    echo -e "\033[91m[ERROR]\033[0m Python 3 no se encuentra instalado en el sistema."
    echo "Por favor instale Python 3 para ejecutar el panel de seguridad."
    exit 1
fi

chmod +x "$PYTHON_SCRIPT" 2>/dev/null || true

# Configurar título de ventana de terminal
printf "\033]0;ExpressMart - Panel de Seguridad y Auditoría\007" 2>/dev/null || true

# Ejecutar el script en Python pasando todos los argumentos
exec python3 "$PYTHON_SCRIPT" "$@"
