from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models, transaction


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role=User.Role.ADMIN, status=User.Status.ACTIVE)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """An employee account. Every person who works on the BnB signs in with one of these."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        MANAGER = "manager", "Property Manager"
        RECEPTIONIST = "receptionist", "Front Desk"
        HOUSEKEEPING = "housekeeping", "Housekeeping"
        MAINTENANCE = "maintenance", "Maintenance"
        ACCOUNTANT = "accountant", "Accounts"

    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting approval"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    SELF_SIGNUP_ROLES = [Role.MANAGER, Role.RECEPTIONIST, Role.HOUSEKEEPING, Role.MAINTENANCE, Role.ACCOUNTANT]

    username = None
    email = models.EmailField("email address", unique=True)
    employee_id = models.CharField(max_length=20, unique=True, editable=False)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.RECEPTIONIST)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.employee_id})"

    @property
    def can_sign_in(self):
        return self.is_active and self.status == self.Status.ACTIVE

    def save(self, *args, **kwargs):
        if not self.employee_id:
            with transaction.atomic():
                last = User.objects.select_for_update().order_by("-id").values_list("id", flat=True).first() or 0
                self.employee_id = f"EMP-{last + 1:04d}"
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)
