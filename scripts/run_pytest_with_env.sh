#!/usr/bin/env bash
set -euo pipefail

# Resolve project root relative to this script
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure apps.backend imports succeed under pytest
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

cd "${PROJECT_ROOT}"
pytest "$@"
