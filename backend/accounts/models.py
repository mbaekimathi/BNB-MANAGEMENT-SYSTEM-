import uuid
from pathlib import Path

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models

six_digit_code = RegexValidator(r"^\d{6}$", "The code must be exactly 6 digits.")


def profile_photo_path(instance, filename):
    return f"profile_photos/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, code, password, **extra):
        if not code:
            raise ValueError("A 6-digit code is required")
        if extra.get("email"):
            extra["email"] = self.normalize_email(extra["email"]).lower()
        user = self.model(code=code, **extra)
        user.set_password(password)
        user.full_clean(exclude=["password", "photo"])
        user.save(using=self._db)
        return user

    def create_user(self, code, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(code, password, **extra)

    def create_superuser(self, code, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role=User.Role.ADMIN, status=User.Status.ACTIVE)
        return self._create_user(code, password, **extra)


class User(AbstractUser):
    """An employee account. Employees sign in with their 6-digit code and password."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COMPANY_MANAGER = "company_manager", "Company Manager"
        IT_SUPPORT = "it_support", "IT Support"
        COMPANY_STORE_MANAGER = "company_store_manager", "Company Store Manager"
        BRANCH_STORE_MANAGER = "branch_store_manager", "Branch Store Manager"
        BRANCH_MANAGER = "branch_manager", "Branch Manager"
        BRANCH_RECEPTIONIST = "branch_receptionist", "Branch Receptionist"
        BRANCH_EMPLOYEE = "branch_employee", "Branch Employee"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending activation"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    username = None
    code = models.CharField(
        "6-digit code", max_length=6, unique=True, validators=[six_digit_code],
        error_messages={"unique": "This code is already taken. Please choose another one."},
    )
    email = models.EmailField("personal email", unique=True)
    phone = models.CharField(max_length=20)
    photo = models.ImageField("profile picture", upload_to=profile_photo_path, blank=True)
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.BRANCH_EMPLOYEE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    branch = models.ForeignKey(
        "bnb.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="employees",
        help_text="The BnB branch this employee works at (branch roles only).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "code"
    REQUIRED_FIELDS = ["email", "first_name", "last_name", "phone"]

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.code})"

    @property
    def can_sign_in(self):
        return self.is_active and self.status == self.Status.ACTIVE
