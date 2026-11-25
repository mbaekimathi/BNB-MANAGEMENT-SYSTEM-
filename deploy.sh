#!/usr/bin/env bash
# Deploys the latest code from GitHub:
#   git pull → backend packages → database migrations → static files
#            → frontend build (only if npm exists — frontend/dist is tracked
#              in git, so hosts without Node still get the latest bundle)
#
# Usage:  bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }
hash_of() { sha256sum "$1" | cut -d' ' -f1; }

step "Pulling latest code from GitHub"
SELF_SUM="$(hash_of "$0" 2>/dev/null || echo x)"
git pull --ff-only || fail "git pull failed — commit or stash local changes first."
# git pull may have replaced this very script — re-exec so the rest of the
# deploy runs the new version, not the stale copy bash already loaded.
if [ "$(hash_of "$0" 2>/dev/null || echo x)" != "$SELF_SUM" ]; then
  echo "deploy.sh changed in this pull — restarting with the updated script."
  exec bash "$0" "$@"
fi

# --- Backend ---
# Prefer an already-active virtualenv (e.g. cPanel "Setup Python App"); then backend/.venv.
if [ -n "${PYTHON:-}" ]; then
  VENV_PY="$PYTHON"
elif [ -n "${VIRTUAL_ENV:-}" ] && [ -x "$VIRTUAL_ENV/bin/python" ]; then
  VENV_PY="$VIRTUAL_ENV/bin/python"
else
  VENV_PY="$ROOT/backend/.venv/bin/python"
  [ -x "$VENV_PY" ] || VENV_PY="$ROOT/backend/.venv/Scripts/python.exe"   # Windows venv layout
fi
[ -x "$VENV_PY" ] || command -v "$VENV_PY" >/dev/null 2>&1 || \
  fail "No Python virtualenv found — activate your app's venv first, or run ./start.sh once to create backend/.venv"
echo "Using Python: $VENV_PY"

step "Backend: Python packages"
REQ_HASH="$(hash_of backend/requirements.txt)"
STAMP="$(dirname "$VENV_PY")/../.requirements.sha256"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$REQ_HASH" ]; then
  "$VENV_PY" -m pip install -r backend/requirements.txt
  echo "$REQ_HASH" > "$STAMP"
else
  echo "Already up to date."
fi

step "Backend: database migrations"
(cd backend && "$VENV_PY" manage.py migrate --noinput)

step "Backend: static files"
(cd backend && "$VENV_PY" manage.py collectstatic --noinput --clear)

# --- Frontend ---
# frontend/dist is committed to the repo, so `git pull` already delivered the
# latest production bundle. Rebuilding is only needed on machines that have
# Node (e.g. a dev box); shared hosts like cPanel typically don't.
if command -v npm >/dev/null 2>&1; then
  step "Frontend: Node packages"
  LOCK_HASH="$(hash_of frontend/package-lock.json)"
  FSTAMP="frontend/node_modules/.lock.sha256"
  if [ ! -f "$FSTAMP" ] || [ "$(cat "$FSTAMP")" != "$LOCK_HASH" ]; then
    (cd frontend && npm install)
    echo "$LOCK_HASH" > "$FSTAMP"
  else
    echo "Already up to date."
  fi

  step "Frontend: production build"
  (cd frontend && npm run build)
else
  step "Frontend"
  echo "npm not found — using the pre-built frontend/dist bundle tracked in git."
fi

printf '\n\033[1;32mDeployed.\033[0m Backend migrated + static collected, frontend dist is in place.\n'
echo "Restart your app server to pick up the changes (e.g. touch tmp/restart.txt on Passenger,"
echo "or restart the Django/systemd service you're using)."
