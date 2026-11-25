from datetime import date

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Branch
from hr.models import Attendance, LeaveRequest, PayrollEntry


def make(code, role=User.Role.BRANCH_EMPLOYEE, status=User.Status.ACTIVE, first="Test"):
    return User.objects.create_user(
        code=code, password="pass-12345", first_name=first, last_name=code, email=f"{code}@x.test",
        phone="0700000000", role=role, status=status,
    )


class HRApiTests(APITestCase):
    def setUp(self):
        self.it = make("100100", User.Role.IT_SUPPORT, first="Ivy")
        self.emp = make("200200", first="Eli")
        self.pending = make("300300", status=User.Status.PENDING, first="Pam")
        self.client.force_authenticate(self.it)

    def test_only_hr_roles_allowed(self):
        self.client.force_authenticate(self.emp)
        self.assertEqual(self.client.get("/api/hr/summary/").status_code, 403)
        self.assertEqual(self.client.get("/api/hr/employees/").status_code, 403)

    def test_summary_counts(self):
        data = self.client.get("/api/hr/summary/").json()
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["status"]["pending"], 1)
        self.assertEqual(next(r for r in data["roles"] if r["value"] == "it_support")["count"], 1)

    def test_search_and_filter(self):
        self.assertEqual(len(self.client.get("/api/hr/employees/?q=eli").json()), 1)
        self.assertEqual([u["code"] for u in self.client.get("/api/hr/employees/?status=pending").json()], ["300300"])

    def test_activate_with_role_and_suspend(self):
        branch = Branch.objects.create(
            name="Branch 900900", phone="0700000000", email="branch900900@x.test",
            location="Test town", code="900900", password="x",
        )
        r = self.client.post(
            f"/api/hr/employees/{self.pending.id}/activate/",
            {"role": "branch_receptionist", "branch": branch.id},
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.pending.refresh_from_db()
        self.assertEqual((self.pending.status, self.pending.role), ("active", "branch_receptionist"))
        self.client.post(f"/api/hr/employees/{self.pending.id}/suspend/")
        self.pending.refresh_from_db()
        self.assertFalse(self.pending.is_active)

    def test_cannot_change_own_role_or_grant_admin(self):
        r = self.client.patch(f"/api/hr/employees/{self.it.id}/", {"role": "admin"})
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/hr/employees/{self.emp.id}/", {"role": "admin"})
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/hr/employees/{self.emp.id}/", {"role": "branch_manager"})
        self.assertEqual(r.json()["role"], "branch_manager")

    def test_edit_all_details(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image
        buf = BytesIO(); Image.new("RGB", (20, 20), "red").save(buf, "JPEG")
        url = f"/api/hr/employees/{self.emp.id}/"
        r = self.client.patch(url, {
            "first_name": "Elias", "last_name": "Kamau", "email": "Elias@X.test", "phone": "0711222333",
            "code": "200201", "role": "branch_manager", "status": "suspended", "new_password": "987654",
            "photo": SimpleUploadedFile("a.jpg", buf.getvalue(), content_type="image/jpeg"),
        }, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.emp.refresh_from_db()
        self.assertEqual((self.emp.first_name, self.emp.email, self.emp.code, self.emp.status), ("Elias", "elias@x.test", "200201", "suspended"))
        self.assertFalse(self.emp.is_active)
        self.assertTrue(self.emp.check_password("987654"))
        self.assertTrue(self.emp.photo)
        r = self.client.patch(url, {"photo": None}, format="json")
        self.emp.refresh_from_db()
        self.assertFalse(self.emp.photo)
        self.assertEqual(self.client.patch(url, {"code": "300300"}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"email": "300300@x.test"}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"new_password": "200201"}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"new_password": "short"}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"phone": "abc"}).status_code, 400)

    def test_attendance_one_per_day(self):
        today = timezone.localdate().isoformat()
        body = {"employee_id": self.emp.id, "date": today, "status": "present", "clock_in": "08:00"}
        self.assertEqual(self.client.post("/api/hr/attendance/", body).status_code, 201)
        r = self.client.post("/api/hr/attendance/", body)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(self.client.get("/api/hr/attendance/").json()), 1)
        r = self.client.post("/api/hr/attendance/", {**body, "date": "2026-01-02", "clock_in": "10:00", "clock_out": "09:00"})
        self.assertIn("clock_out", r.json())

    def test_leave_approve(self):
        r = self.client.post("/api/hr/leave/", {"employee_id": self.emp.id, "leave_type": "sick",
                                                "start_date": "2026-12-01", "end_date": "2026-12-03"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["days"], 3)
        leave_id = r.json()["id"]
        r = self.client.post(f"/api/hr/leave/{leave_id}/approve/")
        self.assertEqual(r.json()["status"], "approved")
        self.assertEqual(self.client.post(f"/api/hr/leave/{leave_id}/reject/").status_code, 400)
        r = self.client.post("/api/hr/leave/", {"employee_id": self.emp.id, "start_date": "2026-12-05", "end_date": "2026-12-01"})
        self.assertIn("end_date", r.json())

    def test_my_attendance_toggle_flow(self):
        self.client.force_authenticate(self.emp)
        self.assertIsNone(self.client.get("/api/hr/my-attendance/").json()["record"])
        r = self.client.post("/api/hr/my-attendance/", {"action": "check-in"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["clock_in"])
        self.assertEqual(r.json()["status"], "present")
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "check-in"}).status_code, 400)
        r = self.client.post("/api/hr/my-attendance/", {"action": "check-out"})
        self.assertTrue(r.json()["clock_out"])
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "check-out"}).status_code, 400)
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "check-in"}).status_code, 400)
        rec = Attendance.objects.get(employee=self.emp)
        self.assertEqual((rec.status, rec.recorded_by), ("present", self.emp))
        self.assertTrue(rec.clock_in and rec.clock_out)

    def test_my_attendance_requires_active_staff(self):
        self.client.force_authenticate(self.pending)
        self.assertEqual(self.client.get("/api/hr/my-attendance/").status_code, 403)
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "check-in"}).status_code, 403)
        self.client.force_authenticate(self.emp)
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "check-out"}).status_code, 400)
        self.assertEqual(self.client.post("/api/hr/my-attendance/", {"action": "nope"}).status_code, 400)

    def test_payroll_month_and_pay(self):
        period = timezone.localdate().replace(day=1)
        r = self.client.post("/api/hr/payroll/", {"employee_id": self.emp.id, "period": period.replace(day=15).isoformat(),
                                                  "basic_salary": "30000", "allowances": "5000", "deductions": "2500"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["net_pay"], "32500.00")
        self.assertEqual(r.json()["period"], period.isoformat())
        entry = r.json()["id"]
        self.assertEqual(self.client.get("/api/hr/summary/").json()["payroll_month"]["net_total"], "32500.00")
        self.assertEqual(self.client.post(f"/api/hr/payroll/{entry}/pay/").json()["status"], "paid")
        self.assertEqual(self.client.delete(f"/api/hr/payroll/{entry}/").status_code, 400)
        self.assertEqual(self.client.get("/api/hr/payroll/?period=2020-01").json(), [])
