from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Branch, BranchSettings


def make(code, role=User.Role.BRANCH_EMPLOYEE, status=User.Status.ACTIVE, branch=None, first="Test"):
    return User.objects.create_user(
        code=code, password="pass-12345", first_name=first, last_name=code, email=f"{code}@x.test",
        phone="0700000000", role=role, status=status, branch=branch,
    )


def make_branch(name, code):
    branch = Branch(name=name, phone="0700000000", email=f"{code}@b.test", location="Nairobi", code=code)
    branch.set_password("pass-12345")
    branch.save()
    return branch


class BranchProfileTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("West House", "111111")
        self.other = make_branch("East House", "222222")
        self.mgr = make("300300", User.Role.BRANCH_MANAGER, branch=self.branch, first="Mia")
        self.recep = make("400400", User.Role.BRANCH_RECEPTIONIST, branch=self.branch, first="Rea")

    def test_manager_reads_own_branch_profile_with_setting_defaults(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.get("/api/bnb/my-branch/")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual(data["id"], self.branch.id)
        self.assertEqual(data["name"], "West House")
        self.assertTrue(data["mpesa_enabled"])
        self.assertTrue(data["cash_enabled"])
        self.assertFalse(data["bank_enabled"])
        self.assertFalse(data["sms_enabled"])

    def test_manager_updates_details_payments_and_comms(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch("/api/bnb/my-branch/", {
            "location": "Mombasa",
            "mpesa_till": "555555",
            "bank_enabled": True,
            "bank_name": "KCB",
            "whatsapp_enabled": True,
            "whatsapp_number": "0712000000",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual(data["location"], "Mombasa")
        self.assertEqual(data["whatsapp_number"], "+254712000000")
        s = BranchSettings.objects.get(branch=self.branch)
        self.assertEqual(s.mpesa_till, "555555")
        self.assertTrue(s.bank_enabled)

    def test_patch_keeps_settings_that_were_not_sent(self):
        self.client.force_authenticate(self.mgr)
        self.client.patch("/api/bnb/my-branch/", {"sms_enabled": True}, format="json")
        r = self.client.patch("/api/bnb/my-branch/", {"location": "Kisumu"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["sms_enabled"])

    def test_manager_updates_api_keys_times_themes_and_drafts(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch("/api/bnb/my-branch/", {
            "mpesa_consumer_key": "ck-123",
            "sms_api_key": "sk-456",
            "opens_at": "06:30",
            "checkout_by": "11:00",
            "role_themes": {"branch_receptionist": "Obsidian"},
            "message_templates": {
                "booking_confirmed": {"enabled": True, "channel": "sms", "subject": "", "body": "Hi {guest_name}"},
            },
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual(data["mpesa_consumer_key"], "ck-123")
        self.assertEqual(data["opens_at"], "06:30:00")
        self.assertEqual(data["role_themes"], {"branch_receptionist": "Obsidian"})
        self.assertEqual(data["message_templates"]["booking_confirmed"]["body"], "Hi {guest_name}")
        s = BranchSettings.objects.get(branch=self.branch)
        self.assertEqual(s.sms_api_key, "sk-456")
        self.assertEqual(str(s.checkout_by), "11:00:00")

    def test_role_themes_rejects_unknown_roles(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch("/api/bnb/my-branch/", {"role_themes": {"not_a_role": "Obsidian"}}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("role_themes", r.json())

    def test_receptionist_can_read_but_not_edit(self):
        self.client.force_authenticate(self.recep)
        self.assertEqual(self.client.get("/api/bnb/my-branch/").status_code, 200)
        r = self.client.patch("/api/bnb/my-branch/", {"location": "Mombasa"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_company_role_picks_a_branch_by_param(self):
        admin = make("700700", User.Role.ADMIN)
        self.client.force_authenticate(admin)
        r = self.client.patch(f"/api/bnb/my-branch/?branch={self.other.id}", {"cash_enabled": False}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["id"], self.other.id)
        self.assertFalse(r.json()["cash_enabled"])

    def test_branch_name_must_stay_unique(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch("/api/bnb/my-branch/", {"name": "East House"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("name", r.json())

    def test_code_and_status_are_read_only(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch("/api/bnb/my-branch/", {"code": "999999", "status": "suspended"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.branch.refresh_from_db()
        self.assertEqual(self.branch.code, "111111")
        self.assertEqual(self.branch.status, Branch.Status.ACTIVE)
