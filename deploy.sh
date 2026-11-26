#!/usr/bin/env bash
# Full cPanel deploy — run it on the server over SSH:
#   git pull → backend packages → database migrations → static files
#            → frontend build (only if npm exists — frontend/dist is tracked
#              in git, so hosts without Node still get the latest bundle)
#            → wire the public/ docroot → restart the Passenger app
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
if [ ! -x "$VENV_PY" ] && ! command -v "$VENV_PY" >/dev/null 2>&1; then
  # cPanel "Setup Python App" keeps its venvs under ~/virtualenv/<app>/<version>/ —
  # fall back to the newest one when nothing else matched.
  latest="$(ls -dt "$HOME"/virtualenv/*/*/ 2>/dev/null | head -1 || true)"
  [ -n "$latest" ] && [ -x "${latest}bin/python" ] && VENV_PY="${latest}bin/python"
fi
[ -x "$VENV_PY" ] || command -v "$VENV_PY" >/dev/null 2>&1 || \
  fail "No Python virtualenv found — activate your app's venv first (or set PYTHON=/path/to/python), or run ./start.sh once to create backend/.venv"
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

# --- Web docroot ---
# Django's spa() serves <repo>/public/ as the site docroot: the React build,
# with static -> backend/staticfiles and media -> backend/media inside it.
# The links can't live in git (Windows checkouts), so they're wired here.
step "Wiring the web docroot (public/)"
DIST="$ROOT/frontend/dist"
PUBLIC="$ROOT/public"

ensure_link() {
  # ensure_link <link> <target> — symlink where the filesystem allows it,
  # a one-way sync copy where it doesn't (FAT docroots, restricted hosts).
  local link="$1" target="$2"
  if [ -L "$link" ]; then
    if [ "$(readlink "$link")" = "$target" ]; then echo "OK   $link"; return 0; fi
    rm -f "$link"
  elif [ -e "$link" ]; then
    rm -rf "$link"
  fi
  if ln -s "$target" "$link" 2>/dev/null; then
    echo "Link $link -> $target"
  else
    mkdir -p "$link" && cp -a "$target/." "$link/"
    echo "Copy $link (symlinks unavailable)"
  fi
}

ensure_link "$DIST/static" "$ROOT/backend/staticfiles"
ensure_link "$DIST/media"  "$ROOT/backend/media"

if [ -L "$PUBLIC" ]; then
  if [ "$(readlink "$PUBLIC")" = "$DIST" ]; then
    echo "OK   public/ -> frontend/dist"
  else
    rm -f "$PUBLIC" && ln -s "$DIST" "$PUBLIC"
    echo "Link public/ -> frontend/dist (repointed)"
  fi
elif [ -d "$PUBLIC" ]; then
  # A real directory — the host's own docroot. Sync the build into it,
  # keeping files that aren't ours (e.g. .well-known for SSL renewals).
  rm -rf "$PUBLIC/assets"
  cp -a "$DIST/." "$PUBLIC/"
  echo "Synced frontend/dist into the existing public/ directory"
else
  rm -f "$PUBLIC" 2>/dev/null || true
  if ln -s "$DIST" "$PUBLIC" 2>/dev/null; then
    echo "Link public/ -> frontend/dist"
  else
    mkdir -p "$PUBLIC" && cp -a "$DIST/." "$PUBLIC/"
    echo "Copied frontend/dist into public/ (symlinks unavailable)"
  fi
fi

# --- Restart ---
# cPanel "Setup Python App" runs the backend under Phusion Passenger — touching
# tmp/restart.txt in the app root reloads it. The app root is wherever
# passenger_wsgi.py lives; if it can't be found, cover the usual layouts anyway
# (an unread flag file is harmless).
step "Restarting the app"
APP_DIRS=()
for dir in "$ROOT" "$ROOT/backend" "$ROOT/.."; do
  [ -f "$dir/passenger_wsgi.py" ] && APP_DIRS+=("$dir")
done
[ ${#APP_DIRS[@]} -eq 0 ] && APP_DIRS=("$ROOT" "$ROOT/backend")
for dir in "${APP_DIRS[@]}"; do
  mkdir -p "$dir/tmp" && touch "$dir/tmp/restart.txt"
  echo "Restart flag: $dir/tmp/restart.txt"
done
if command -v passenger-config >/dev/null 2>&1; then
  passenger-config restart-app "$ROOT" >/dev/null 2>&1 || true
fi

printf '\n\033[1;32mDeployed.\033[0m Code pulled, backend migrated + static collected, public/ wired, app restarted.\n'
echo "If the site still serves the old version, restart it from cPanel → Setup Python App → Restart."
