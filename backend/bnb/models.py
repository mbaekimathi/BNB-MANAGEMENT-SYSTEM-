import uuid
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.files.base import ContentFile
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from PIL import Image, ImageOps

from accounts.models import six_digit_code


def branch_photo_path(instance, filename):
    return f"branch_photos/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


def room_photo_path(instance, filename):
    return f"room_photos/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class Branch(models.Model):
    """A registered BnB branch. Each branch signs in with its own 6-digit code and password."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(
        max_length=120, unique=True,
        error_messages={"unique": "A branch with this name already exists."},
    )
    phone = models.CharField(max_length=20)
    email = models.EmailField(
        unique=True,
        error_messages={"unique": "A branch with this email already exists."},
    )
    location = models.CharField(max_length=255)
    code = models.CharField(
        "6-digit login code", max_length=6, unique=True, validators=[six_digit_code],
        error_messages={"unique": "This code is already taken. Please choose another one."},
    )
    password = models.CharField(max_length=128)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    photo = models.ImageField("profile picture", upload_to=branch_photo_path, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)


class Room(models.Model):
    """A rentable room registered under a BnB branch."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "Under maintenance"
        SUSPENDED = "suspended", "Suspended"

    class Type(models.TextChoices):
        SINGLE = "single", "Single"
        DOUBLE = "double", "Double"
        TWIN = "twin", "Twin"
        QUEEN = "queen", "Queen"
        KING = "king", "King"
        SUITE = "suite", "Suite"
        FAMILY = "family", "Family"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="rooms")
    name = models.CharField("room name or number", max_length=60)
    room_type = models.CharField(max_length=20, choices=Type.choices, default=Type.DOUBLE)
    capacity = models.PositiveSmallIntegerField("guest capacity", default=2)
    price = models.DecimalField("nightly rate", max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    status_reason = models.CharField("suspension or maintenance reason", max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "name"], name="unique_room_name_per_branch"),
        ]

    def __str__(self):
        return f"{self.name} · {self.branch.name}"


def _jpeg(raw, max_side, quality):
    """Re-encodes an uploaded picture as a progressive JPEG capped at `max_side` px."""
    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((max_side, max_side))
    out = BytesIO()
    img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    return ContentFile(out.getvalue())


class RoomPhoto(models.Model):
    """One picture of a room; position 0 is the main image shown everywhere."""

    IMAGE_SIDE = 1280
    THUMB_SIDE = 360

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=room_photo_path)
    thumb = models.ImageField(upload_to=room_photo_path, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "created_at"]

    def __str__(self):
        return f"{self.room.name} photo #{self.position + 1}"

    @classmethod
    def add(cls, room, uploaded, position):
        raw = uploaded.read()
        photo = cls(room=room, position=position)
        stem = uuid.uuid4().hex
        photo.image.save(f"{stem}.jpg", _jpeg(raw, cls.IMAGE_SIDE, 80), save=False)
        photo.thumb.save(f"{stem}_t.jpg", _jpeg(raw, cls.THUMB_SIDE, 75), save=False)
        photo.save()
        return photo


@receiver(post_delete, sender=RoomPhoto)
def _delete_room_photo_files(sender, instance, **kwargs):
    for field in (instance.image, instance.thumb):
        if field:
            field.delete(save=False)


class Booking(models.Model):
    """A guest reservation or an active stay against a room of a BnB branch."""

    class Kind(models.TextChoices):
        RESERVATION = "reservation", "Reservation"
        STAY = "stay", "Walk-in stay"

    class Status(models.TextChoices):
        RESERVED = "reserved", "Reserved"
        OCCUPIED = "occupied", "Occupied"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class IdType(models.TextChoices):
        NATIONAL_ID = "national_id", "National ID"
        PASSPORT = "passport", "Passport"
        DRIVING_LICENCE = "driving_licence", "Driving licence"
        OTHER = "other", "Other"

    # Statuses that block the room for the booking's period.
    ACTIVE_STATUSES = {Status.RESERVED, Status.OCCUPIED}

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="bookings")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="bookings")
    guest_name = models.CharField(max_length=120)
    guest_phone = models.CharField(max_length=20)
    guest_email = models.EmailField(blank=True)
    guest_id_type = models.CharField("ID document type", max_length=20, choices=IdType.choices, blank=True)
    guest_id_number = models.CharField("ID / passport number", max_length=40, blank=True)
    guest_nationality = models.CharField(max_length=60, blank=True)
    guests = models.PositiveSmallIntegerField("number of guests", default=1)
    guest_notes = models.TextField("special requests and notes", blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=20, choices=Status.choices)
    start = models.DateTimeField("move-in / check-in")
    end = models.DateTimeField("check-out")
    deposit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="bookings_taken",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start"]

    def __str__(self):
        return f"{self.guest_name} · {self.room.name} ({self.get_status_display()})"


class BookingGuest(models.Model):
    """An extra guest on a booking — the booking's own `guest_*` fields hold the primary
    guest, so a booking for N people has N-1 companions."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="companions")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    id_type = models.CharField("ID document type", max_length=20, choices=Booking.IdType.choices, blank=True)
    id_number = models.CharField("ID / passport number", max_length=40, blank=True)
    nationality = models.CharField(max_length=60, blank=True)
    notes = models.TextField("special requests and notes", blank=True)
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="companion_bookings",
        help_text="This guest's own room — empty means they share the booking's main room.",
    )
    start = models.DateTimeField("this guest's check-in — blank follows the booking", null=True, blank=True)
    end = models.DateTimeField("this guest's check-out — blank follows the booking", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} · {self.booking}"


class BookingPayment(models.Model):
    """Money received for a booking — one row per payment, so guests can each pay their own
    share. `companion` null means the payment was made by the main guest."""

    class Method(models.TextChoices):
        MPESA = "mpesa", "M-Pesa"
        CASH = "cash", "Cash"
        VISA = "visa", "Visa"
        BANK = "bank", "Bank transfer"
        OTHER = "other", "Other"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payments")
    companion = models.ForeignKey(
        BookingGuest, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices)
    reference = models.CharField("receipt or transaction reference", max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        payer = self.companion.name if self.companion_id else self.booking.guest_name
        return f"{payer} · {self.amount} ({self.get_method_display()})"
