#!/usr/bin/env python3
"""Sets up and starts the whole BnB system (MySQL database, Django backend, React frontend).

Usage:  python run.py
The first run installs everything and creates the database; later runs just start the servers.
Press Ctrl+C to stop both servers.
"""
import getpass
import hashlib
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import venv
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
ENV_FILE = BACKEND / ".env"
IS_WINDOWS = os.name == "nt"
VENV_PY = VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
FRONTEND_URL = "http://localhost:5173"


def step(msg):
    print(f"\n\033[1;33m==> {msg}\033[0m", flush=True)


def fail(msg):
    print(f"\n\033[1;31mERROR: {msg}\033[0m")
    sys.exit(1)


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_env():
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    return values


def set_env(key, value):
    lines = ENV_FILE.read_text().splitlines()
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n")


def setup_python():
    step("Backend: Python packages")
    if sys.version_info < (3, 10):
        fail("Python 3.10 or newer is needed. Download it from https://www.python.org/downloads/")
    if not VENV_PY.exists():
        venv.create(VENV, with_pip=True)
    req = BACKEND / "requirements.txt"
    stamp = VENV / ".requirements.sha256"
    if not stamp.exists() or stamp.read_text() != file_hash(req):
        run([str(VENV_PY), "-m", "pip", "install", "--upgrade", "pip", "-q"])
        run([str(VENV_PY), "-m", "pip", "install", "-r", str(req)])
        stamp.write_text(file_hash(req))
    else:
        print("Already installed.")


def setup_env_file():
    if not ENV_FILE.exists():
        shutil.copy(BACKEND / ".env.example", ENV_FILE)
        set_env("DJANGO_SECRET_KEY", secrets.token_urlsafe(50))
        set_env("DB_PASSWORD", "")


def db_works():
    code = (
        "import os, MySQLdb\n"
        "from dotenv import load_dotenv\n"
        "load_dotenv('.env')\n"
        "MySQLdb.connect(host=os.getenv('DB_HOST','127.0.0.1'), port=int(os.getenv('DB_PORT','3306')),"
        " user=os.getenv('DB_USER'), passwd=os.getenv('DB_PASSWORD',''), db=os.getenv('DB_NAME'))\n"
    )
    return subprocess.run([str(VENV_PY), "-c", code], cwd=BACKEND, capture_output=True).returncode == 0


def setup_database():
    step("Database: MySQL")
    if db_works():
        print("Connected.")
        return
    env = read_env()
    name, user = env.get("DB_NAME", "bnb_management"), env.get("DB_USER", "bnb_user")
    host, port = env.get("DB_HOST", "127.0.0.1"), env.get("DB_PORT", "3306")
    print(f"Creating database '{name}' and user '{user}' on MySQL at {host}:{port}.")
    print("Make sure MySQL is running (MySQL Workbench, XAMPP, WAMP or the MySQL service).")
    root_user = input("MySQL admin username [root]: ").strip() or "root"
    root_pw = getpass.getpass(f"MySQL password for '{root_user}' (leave empty if none): ")
    app_pw = env.get("DB_PASSWORD") or secrets.token_urlsafe(18)
    code = (
        "import sys, MySQLdb\n"
        "host, port, ru, rp, name, user, pw = sys.argv[1:]\n"
        "c = MySQLdb.connect(host=host, port=int(port), user=ru, passwd=rp)\n"
        "cur = c.cursor()\n"
        "cur.execute(f'CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')\n"
        "for h in ('localhost', '127.0.0.1'):\n"
        "    cur.execute(f\"CREATE USER IF NOT EXISTS '{user}'@'{h}' IDENTIFIED BY %s\", (pw,))\n"
        "    cur.execute(f\"ALTER USER '{user}'@'{h}' IDENTIFIED BY %s\", (pw,))\n"
        "    cur.execute(f\"GRANT ALL PRIVILEGES ON `{name}`.* TO '{user}'@'{h}'\")\n"
        "    cur.execute(f\"GRANT ALL PRIVILEGES ON `test_{name}`.* TO '{user}'@'{h}'\")\n"
        "cur.execute('FLUSH PRIVILEGES')\n"
    )
    result = subprocess.run([str(VENV_PY), "-c", code, host, port, root_user, root_pw, name, user, app_pw], capture_output=True, text=True)
    if result.returncode != 0:
        fail("Could not create the database:\n" + result.stderr.strip().splitlines()[-1]
             + "\nCheck that MySQL is running and the admin password is right, then run this again.")
    set_env("DB_PASSWORD", app_pw)
    print("Database ready (password saved in backend/.env).")


def manage(*args, **kw):
    return run([str(VENV_PY), "manage.py", *args], cwd=BACKEND, **kw)


def setup_django():
    step("Backend: database tables")
    manage("migrate", "--noinput")
    has_admin = subprocess.run(
        [str(VENV_PY), "manage.py", "shell", "-c",
         "from accounts.models import User; import sys; sys.exit(0 if User.objects.filter(is_superuser=True).exists() else 1)"],
        cwd=BACKEND,
    ).returncode == 0
    if not has_admin:
        step("Create your first admin account (this is how you sign in and approve staff)")
        manage("createsuperuser")


def setup_frontend():
    step("Frontend: Node packages")
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        fail("Node.js is not installed. Download the LTS version from https://nodejs.org/ and run this again.")
    version = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    major, minor = (int(x) for x in version.split(".")[:2])
    if (major, minor) < (20, 19) or (major == 21) or (major == 22 and minor < 12):
        fail(f"Node.js {version} is too old. Install the LTS version (22 or newer) from https://nodejs.org/")
    lock = FRONTEND / "package-lock.json"
    stamp = FRONTEND / "node_modules" / ".lock.sha256"
    if not stamp.exists() or stamp.read_text() != file_hash(lock):
        run([npm, "install"], cwd=FRONTEND)
        stamp.write_text(file_hash(lock))
    else:
        print("Already installed.")
    return npm


def port_free(port):
    with socket.socket() as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) != 0


def backend_up():
    """Our API answers 401 to an unauthenticated /auth/me/ — anything else isn't it."""
    try:
        urllib.request.urlopen("http://127.0.0.1:8000/api/auth/me/", timeout=2)
    except urllib.error.HTTPError as e:
        return e.code == 401
    except OSError:
        return False
    return False


def frontend_up():
    try:
        html = urllib.request.urlopen(FRONTEND_URL, timeout=2).read().decode("utf-8", "ignore")
        return "Haven Stays" in html
    except OSError:
        return False


def spawn(cmd, cwd):
    # POSIX: new process group so stop_tree can signal the whole family at once.
    kw = {"start_new_session": True} if not IS_WINDOWS else {}
    return subprocess.Popen(cmd, cwd=cwd, **kw)


def stop_tree(p):
    """Kill the process and its children — `npm run dev` and runserver each
    spawn a child that would otherwise keep holding the port after we exit."""
    if IS_WINDOWS:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
    else:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass


def start(npm):
    step("Starting servers")
    backend, frontend = backend_up(), frontend_up()
    if not backend and not port_free(8000):
        fail("Port 8000 is in use by another app — close it, then run this again.")
    if not frontend and not port_free(5173):
        fail("Port 5173 is in use by another app — close it, then run this again.")

    procs = []
    if backend:
        print("Backend already running on :8000 — leaving it as is.")
    else:
        procs.append(spawn([str(VENV_PY), "manage.py", "runserver", "127.0.0.1:8000"], BACKEND))
    if frontend:
        print("Frontend already running on :5173 — leaving it as is.")
    else:
        procs.append(spawn([npm, "run", "dev", "--", "--port", "5173", "--strictPort"], FRONTEND))

    if procs:
        time.sleep(4)
        if any(p.poll() is not None for p in procs):
            fail("A server failed to start — see its output above.")

    print(f"\n\033[1;32mBnB system is running:\033[0m")
    print(f"  Employee login : {FRONTEND_URL}/login")
    print("  Admin (approve staff): http://127.0.0.1:8000/admin")
    webbrowser.open(f"{FRONTEND_URL}/login")
    if not procs:
        return  # Both were already up — nothing here to babysit.
    print("Press Ctrl+C to stop.\n")
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            if p.poll() is None:
                stop_tree(p)
        for p in procs:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()
        print("Stopped.")


def main():
    if IS_WINDOWS:
        os.system("")  # turns on coloured output in the Windows console
    setup_python()
    setup_env_file()
    setup_database()
    setup_django()
    npm = setup_frontend()
    start(npm)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        fail(f"A setup step failed: {' '.join(map(str, exc.cmd))}")
