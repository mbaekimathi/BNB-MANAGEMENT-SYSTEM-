# Haven Stays — BnB Management System

| Part | Stack |
| --- | --- |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS 4, Framer Motion, React Router |
| `backend/` | Django 5.1, Django REST Framework, SimpleJWT, django-cors-headers, Pillow |
| `database/` | MySQL / MariaDB (`utf8mb4`) |

Employees sign in with their **6-digit code** and password, and land on their role's page (e.g. `/branch-employee`).
New sign-ups choose their own code, upload a profile picture, join as **Branch Employee** and stay
**Pending activation** until an admin activates them in Django admin (`/admin/` → Users → "Activate selected employees").

Roles: Admin, Company Manager, IT Support, Company Store Manager, Branch Store Manager, Branch Manager,
Branch Receptionist, Branch Employee. Admins change an employee's role in Django admin.

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
python manage.py createsuperuser                       # first admin account (asks for a 6-digit code)
python manage.py runserver
python manage.py test accounts                         # run the tests
```

#### Auth API

| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/api/auth/login/` | `code` (6 digits), `password`, `remember_me` → `access`, `refresh`, `user` |
| POST | `/api/auth/register/` | multipart: `first_name`, `last_name`, `email`, `phone`, `code`, `password`, `confirm_password`, `photo` |
| POST | `/api/auth/refresh/` | `refresh` → new `access` (+ rotated `refresh`) |
| POST | `/api/auth/logout/` | `refresh` (blacklists it) |
| GET | `/api/auth/me/` | `Authorization: Bearer <access>` |
| GET | `/api/auth/roles/` | All roles |

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev        # proxies /api and /admin to http://127.0.0.1:8000
npm run build      # production build in frontend/dist
```

Needs Node.js 20.19+ or 22.12+. Set `VITE_API_URL` if the API is served from another origin.
