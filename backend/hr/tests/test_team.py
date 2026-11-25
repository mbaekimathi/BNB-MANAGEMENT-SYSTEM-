from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Branch
from hr.models import TaskType

from .test_hr import make


def make_branch(code="400400"):
    return Branch.objects.create(
        name=f"Branch {code}", phone="0700000000", email=f"branch{code}@x.test",
        location="Test town", code=code, password="x",
    )


class TeamApiTests(APITestCase):
    def setUp(self):
        self.branch = make_branch()
        self.other_branch = make_branch("400401")
        self.mgr = make("500500", User.Role.BRANCH_MANAGER, first="Meg")
        self.mgr.branch = self.branch
        self.mgr.save()
        self.emp = make("600600", first="Eli")
        self.emp.branch = self.branch
        self.emp.save()
        self.outsider = make("700700", first="Oli")
        self.outsider.branch = self.other_branch
        self.outsider.save()
        self.client.force_authenticate(self.mgr)

    def test_only_branch_managers_allowed(self):
        self.client.force_authenticate(self.emp)
        self.assertEqual(self.client.get("/api/hr/team/").status_code, 403)

    def test_list_only_own_branch(self):
        codes = {u["code"] for u in self.client.get("/api/hr/team/").json()}
        self.assertEqual(codes, {"500500", "600600"})

    def test_register_member_active_at_own_branch(self):
        r = self.client.post("/api/hr/team/", {
            "first_name": "New", "last_name": "Staff", "email": "new@x.test", "phone": "0711000000",
            "code": "800800", "role": "branch_receptionist", "password": "pass-12345",
            "confirm_password": "pass-12345",
        })
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertEqual((data["status"], data["role"], data["branch"]), ("active", "branch_receptionist", self.branch.id))

    def test_register_rejects_manager_role_and_bad_code(self):
        body = {
            "first_name": "N", "last_name": "S", "email": "n@x.test", "phone": "0711000000",
            "password": "pass-12345", "confirm_password": "pass-12345",
        }
        r = self.client.post("/api/hr/team/", {**body, "code": "800801", "role": "branch_manager"})
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/hr/team/", {**body, "code": "600600", "role": "branch_employee"})
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/hr/team/", {**body, "code": "800802", "role": "admin"})
        self.assertEqual(r.status_code, 400)

    def test_register_without_branch_fails(self):
        mgr = make("500501", User.Role.BRANCH_MANAGER, first="Solo")
        self.client.force_authenticate(mgr)
        self.assertEqual(self.client.get("/api/hr/team/").json(), [])
        r = self.client.post("/api/hr/team/", {
            "first_name": "N", "last_name": "S", "email": "n@x.test", "phone": "0711000000",
            "code": "800803", "role": "branch_employee", "password": "pass-12345",
            "confirm_password": "pass-12345",
        })
        self.assertEqual(r.status_code, 400)

    def test_update_scoped_rules(self):
        url = f"/api/hr/team/{self.emp.id}/"
        r = self.client.patch(url, {"first_name": "Elias", "role": "branch_store_manager"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.json()["first_name"], r.json()["role"]), ("Elias", "branch_store_manager"))
        self.assertEqual(self.client.patch(url, {"role": "admin"}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"branch": self.other_branch.id}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/hr/team/{self.outsider.id}/", {"first_name": "X"}).status_code, 404)

    def test_manager_role_and_status_locked(self):
        url = f"/api/hr/team/{self.mgr.id}/"
        r = self.client.patch(url, {"first_name": "Megan"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.patch(url, {"role": "branch_employee"}).status_code, 400)
        self.assertEqual(self.client.post(f"/api/hr/team/{self.mgr.id}/suspend/").status_code, 400)

    def test_suspend_and_activate(self):
        r = self.client.post(f"/api/hr/team/{self.emp.id}/suspend/")
        self.assertEqual(r.json()["status"], "suspended")
        self.emp.refresh_from_db()
        self.assertFalse(self.emp.is_active)
        r = self.client.post(f"/api/hr/team/{self.emp.id}/activate/")
        self.assertEqual(r.json()["status"], "active")
        self.emp.refresh_from_db()
        self.assertTrue(self.emp.is_active)

    def test_delete_rules(self):
        self.assertEqual(self.client.delete(f"/api/hr/team/{self.mgr.id}/").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/hr/team/{self.outsider.id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/hr/team/{self.emp.id}/").status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.emp.id).exists())


class TaskApiTests(APITestCase):
    def setUp(self):
        self.branch = make_branch()
        self.other_branch = make_branch("400402")
        self.mgr = make("500502", User.Role.BRANCH_MANAGER, first="Meg")
        self.mgr.branch = self.branch
        self.mgr.save()
        self.emp = make("600601", first="Eli")
        self.emp.branch = self.branch
        self.emp.save()
        self.outsider = make("700701", first="Oli")
        self.outsider.branch = self.other_branch
        self.outsider.save()
        self.client.force_authenticate(self.mgr)

    def _make_type(self, name="Room cleaning"):
        r = self.client.post("/api/hr/task-types/", {"name": name, "description": "Daily"})
        assert r.status_code == 201, r.content
        return r.json()

    def test_only_branch_managers_allowed(self):
        self.client.force_authenticate(self.emp)
        self.assertEqual(self.client.get("/api/hr/task-types/").status_code, 403)
        self.assertEqual(self.client.get("/api/hr/task-assignments/").status_code, 403)

    def test_task_type_crud_scoped(self):
        tt = self._make_type()
        self.assertEqual(tt["open_count"], 0)
        self.assertEqual(self.client.post("/api/hr/task-types/", {"name": "room cleaning"}).status_code, 400)
        # Types from other branches stay hidden.
        TaskType.objects.create(branch=self.other_branch, name="Pool duty")
        names = [x["name"] for x in self.client.get("/api/hr/task-types/").json()]
        self.assertEqual(names, ["Room cleaning"])
        # Rename, then delete.
        r = self.client.patch(f"/api/hr/task-types/{tt['id']}/", {"name": "Deep cleaning"})
        self.assertEqual(r.json()["name"], "Deep cleaning")
        self.assertEqual(self.client.delete(f"/api/hr/task-types/{tt['id']}/").status_code, 204)

    def test_assign_and_transitions(self):
        tt = self._make_type()
        r = self.client.post("/api/hr/task-assignments/", {
            "employee_id": self.emp.id, "task_type_id": tt["id"], "date": "2026-11-25",
            "start": "09:00", "end": "12:00", "note": "Rooms 1–6",
        })
        self.assertEqual(r.status_code, 201, r.content)
        task = r.json()
        self.assertEqual((task["status"], task["task_type"]["name"], task["assigned_by"]),
                         ("pending", "Room cleaning", "Meg 500502"))
        task_id = task["id"]
        self.assertEqual(self.client.get("/api/hr/task-assignments/?date=2026-11-25").json()[0]["id"], task_id)
        self.assertEqual(self.client.get("/api/hr/task-assignments/?date=2026-11-26").json(), [])
        # pending → in progress → done; a done task can't move again.
        self.assertEqual(self.client.post(f"/api/hr/task-assignments/{task_id}/start/").json()["status"], "in_progress")
        r = self.client.post(f"/api/hr/task-assignments/{task_id}/complete/")
        self.assertEqual(r.json()["status"], "done")
        self.assertTrue(r.json()["completed_at"])
        self.assertEqual(self.client.post(f"/api/hr/task-assignments/{task_id}/cancel/").status_code, 400)
        # A type in use can't be deleted until its assignments go.
        self.assertEqual(self.client.delete(f"/api/hr/task-types/{tt['id']}/").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/hr/task-assignments/{task_id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/hr/task-types/{tt['id']}/").status_code, 204)

    def test_assign_validation(self):
        tt = self._make_type()
        other_tt = TaskType.objects.create(branch=self.other_branch, name="Pool duty")
        post = lambda b: self.client.post("/api/hr/task-assignments/", b)
        r = post({"employee_id": self.outsider.id, "task_type_id": tt["id"], "date": "2026-11-25"})
        self.assertIn("employee_id", r.json())
        r = post({"employee_id": self.emp.id, "task_type_id": other_tt.id, "date": "2026-11-25"})
        self.assertIn("task_type_id", r.json())
        r = post({"employee_id": self.emp.id, "task_type_id": tt["id"], "date": "2026-11-25",
                  "start": "12:00", "end": "09:00"})
        self.assertIn("end", r.json())
