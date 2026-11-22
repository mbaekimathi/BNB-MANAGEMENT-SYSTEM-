from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User

SIGNUP = {
    "first_name": "Amina",
    "last_name": "Otieno",
    "email": "Amina@BnB.test",
    "phone": "0712345678",
    "role": "receptionist",
    "password": "Sunrise-Suite-42",
    "confirm_password": "Sunrise-Suite-42",
}


class AuthFlowTests(APITestCase):
    def test_signup_creates_pending_employee_with_id(self):
        res = self.client.post(reverse("auth-register"), SIGNUP, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(email="amina@bnb.test")
        self.assertEqual(user.status, User.Status.PENDING)
        self.assertTrue(user.employee_id.startswith("EMP-"))

    def test_signup_rejects_admin_role_and_mismatched_passwords(self):
        res = self.client.post(reverse("auth-register"), {**SIGNUP, "role": "admin", "confirm_password": "x"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("role", res.data)

    def test_pending_employee_cannot_sign_in(self):
        self.client.post(reverse("auth-register"), SIGNUP, format="json")
        res = self.client.post(reverse("auth-login"), {"identifier": "amina@bnb.test", "password": SIGNUP["password"]}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("approve", str(res.data["detail"]))

    @override_settings(ACCOUNTS_REQUIRE_APPROVAL=False)
    def test_active_employee_signs_in_with_email_or_employee_id(self):
        self.client.post(reverse("auth-register"), SIGNUP, format="json")
        user = User.objects.get(email="amina@bnb.test")
        for ident in (user.email, user.employee_id.lower()):
            res = self.client.post(reverse("auth-login"), {"identifier": ident, "password": SIGNUP["password"]}, format="json")
            self.assertEqual(res.status_code, 200, res.data)
            self.assertIn("access", res.data)
        me = self.client.get(reverse("auth-me"), HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.assertEqual(me.data["employee_id"], user.employee_id)

    def test_wrong_password_gives_generic_error(self):
        User.objects.create_user("x@bnb.test", "Sunrise-Suite-42", status=User.Status.ACTIVE)
        res = self.client.post(reverse("auth-login"), {"identifier": "x@bnb.test", "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Incorrect", str(res.data["detail"]))
