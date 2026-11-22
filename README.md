# Haven Stays — BnB Management System

| Part | Stack |
| --- | --- |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS 4, Framer Motion, React Router |
| `backend/` | Django 5.1, Django REST Framework, SimpleJWT, django-cors-headers |
| `database/` | MySQL / MariaDB (`utf8mb4`) |

Employees sign in with their work email **or** employee ID (e.g. `EMP-0002`). New sign-ups are
`pending` until a manager/admin approves them in Django admin (`/admin/` → Users → "Approve selected employees").
Set `ACCOUNTS_REQUIRE_APPROVAL=False` in `backend/.env` to let new accounts sign in straight away.

Roles: Administrator, Property Manager, Front Desk, Housekeeping, Maintenance, Accounts.

## Quick start (one command)

Windows: double-click `start.bat` (or run `python run.py`). Mac/Linux: `./start.sh`.
The first run installs everything, creates the MySQL database (asks for your MySQL admin password; XAMPP's is usually empty), creates the tables and asks you to create the first admin account. Later runs just start the backend and frontend and open the login page. Press Ctrl+C to stop.

Needs Python 3.10+, Node.js 22.12+ and a running MySQL/MariaDB.

## Manual setup

### 1. Database

```bash
mysql -u root -p < database/create_database.sql   # creates bnb_management + bnb_user
```

Change the `change-me` password in that file (or with `ALTER USER`) and use the same value in `backend/.env`.

### 2. Backend (port 8000)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then edit DB_PASSWORD, DJANGO_SECRET_KEY
python manage.py migrate
python manage.py createsuperuser                       # first admin account (EMP-0001)
python manage.py runserver
python manage.py test accounts                         # run the tests
```

#### Auth API

| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/api/auth/login/` | `identifier` (email or employee ID), `password`, `remember_me` → `access`, `refresh`, `user` |
| POST | `/api/auth/register/` | `first_name`, `last_name`, `email`, `phone`, `role`, `password`, `confirm_password` |
| POST | `/api/auth/refresh/` | `refresh` → new `access` (+ rotated `refresh`) |
| POST | `/api/auth/logout/` | `refresh` (blacklists it) |
| GET | `/api/auth/me/` | `Authorization: Bearer <access>` |
| GET | `/api/auth/roles/` | Roles an employee can pick at sign-up |

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev        # proxies /api and /admin to http://127.0.0.1:8000
npm run build      # production build in frontend/dist
```

Needs Node.js 20.19+ or 22.12+. Set `VITE_API_URL` if the API is served from another origin.
