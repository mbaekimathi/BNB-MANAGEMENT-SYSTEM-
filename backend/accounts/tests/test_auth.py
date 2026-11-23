import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User

MEDIA = tempfile.mkdtemp()
PASSWORD = "Sunrise-Suite-42"


def photo(name="me.png"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "orange").save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def signup_data(**overrides):
    data = {
        "first_name": "Amina",
        "last_name": "Otieno",
        "email": "Amina@Mail.test",
        "phone": "0712345678",
        "code": "482913",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        "photo": photo(),
    }
    data.update(overrides)
    return data


@override_settings(MEDIA_ROOT=MEDIA)
class AuthFlowTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def signup(self, **overrides):
        return self.client.post(reverse("auth-register"), signup_data(**overrides), format="multipart")

    def login(self, code="482913", password=PASSWORD):
        return self.client.post(reverse("auth-login"), {"code": code, "password": password}, format="json")

    def test_signup_creates_pending_branch_employee_with_photo(self):
        res = self.signup()
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(code="482913")
        self.assertEqual(user.email, "amina@mail.test")
        self.assertEqual(user.status, User.Status.PENDING)
        self.assertEqual(user.role, User.Role.BRANCH_EMPLOYEE)
        self.assertTrue(user.photo.name.startswith("profile_photos/"))

    def test_signup_ignores_role_sent_by_client(self):
        self.signup(role="admin")
        self.assertEqual(User.objects.get(code="482913").role, User.Role.BRANCH_EMPLOYEE)

    def test_signup_validation(self):
        res = self.signup(code="12ab", confirm_password="other", phone="")
        self.assertEqual(res.status_code, 400)
        for field in ("code", "phone"):
            self.assertIn(field, res.data)

    def test_photo_is_optional(self):
        data = signup_data()
        del data["photo"]
        res = self.client.post(reverse("auth-register"), data, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(User.objects.get(code="482913").photo)
        self.assertIsNone(res.data["user"]["photo"])

    def test_six_digit_password_allowed_but_not_same_as_code(self):
        res = self.signup(password="739104", confirm_password="739104")
        self.assertEqual(res.status_code, 201, res.data)
        User.objects.filter(code="482913").update(status=User.Status.ACTIVE)
        self.assertEqual(self.login(password="739104").status_code, 200)
        res = self.signup(code="555123", email="b@mail.test", password="555123", confirm_password="555123")
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.data)

    def test_short_non_pin_password_rejected(self):
        res = self.signup(password="abc123", confirm_password="abc123")
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.data)

    def test_code_and_email_must_be_unique(self):
        self.signup()
        res = self.signup(email="amina@mail.test")
        self.assertIn("code", res.data)
        self.assertIn("email", res.data)

    def test_pending_employee_cannot_sign_in(self):
        self.signup()
        res = self.login()
        self.assertEqual(res.status_code, 400)
        self.assertIn("pending activation", str(res.data["detail"]))

    def test_active_employee_signs_in_with_code_and_gets_role(self):
        self.signup()
        User.objects.filter(code="482913").update(status=User.Status.ACTIVE, role=User.Role.BRANCH_MANAGER)
        res = self.login()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["user"]["role"], "branch_manager")
        me = self.client.get(reverse("auth-me"), HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.assertEqual(me.data["code"], "482913")
        self.assertTrue(me.data["photo"].startswith("/media/profile_photos/"))

    def test_wrong_password_gives_generic_error(self):
        User.objects.create_user("111111", PASSWORD, email="x@mail.test", phone="0700000000", status=User.Status.ACTIVE)
        res = self.login(code="111111", password="nope")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Incorrect", str(res.data["detail"]))
