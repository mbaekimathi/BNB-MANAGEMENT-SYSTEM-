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


class BranchSettings(models.Model):
    """Per-branch configuration the branch manager edits — the ways guests can pay
    and the channels the branch uses to reach them. One row per branch, created
    lazily the first time settings are saved."""

    branch = models.OneToOneField(Branch, on_delete=models.CASCADE, related_name="settings")

    # Payments — which methods the front desk accepts, plus the details to pay to.
    mpesa_enabled = models.BooleanField("accept M-Pesa", default=True)
    mpesa_till = models.CharField("till or paybill number", max_length=20, blank=True)
    mpesa_account = models.CharField("paybill account reference", max_length=40, blank=True)
    cash_enabled = models.BooleanField("accept cash", default=True)
    card_enabled = models.BooleanField("accept card payments", default=True)
    bank_enabled = models.BooleanField("accept bank transfers", default=False)
    bank_name = models.CharField(max_length=80, blank=True)
    bank_account_name = models.CharField(max_length=120, blank=True)
    bank_account_number = models.CharField(max_length=40, blank=True)

    # Payment API keys — credentials for each provider the branch bills through.
    mpesa_consumer_key = models.CharField("M-Pesa consumer key", max_length=120, blank=True)
    mpesa_consumer_secret = models.CharField("M-Pesa consumer secret", max_length=120, blank=True)
    mpesa_passkey = models.CharField("M-Pesa passkey", max_length=120, blank=True)
    card_api_key = models.CharField("card processor API key", max_length=120, blank=True)
    card_api_secret = models.CharField("card processor API secret", max_length=120, blank=True)

    # Communications — which channels guest messages go out on.
    email_enabled = models.BooleanField("email guests", default=True)
    sms_enabled = models.BooleanField("text guests (SMS)", default=False)
    sms_sender_id = models.CharField("SMS sender name", max_length=11, blank=True)
    whatsapp_enabled = models.BooleanField("WhatsApp guests", default=False)
    whatsapp_number = models.CharField(max_length=20, blank=True)

    # Communications API keys — credentials for each messaging channel.
    email_api_key = models.CharField("email service API key", max_length=120, blank=True)
    sms_api_key = models.CharField("SMS provider API key", max_length=120, blank=True)
    sms_api_username = models.CharField("SMS provider username", max_length=60, blank=True)
    whatsapp_api_key = models.CharField("WhatsApp API key", max_length=120, blank=True)

    # Guest messages — a drafted template per trigger, keyed by trigger slug.
    message_templates = models.JSONField("guest message drafts", default=dict, blank=True)

    # Branch hours — opening/closing and the guest check-in / check-out window.
    opens_at = models.TimeField("opening time", null=True, blank=True)
    closes_at = models.TimeField("closing time", null=True, blank=True)
    checkin_from = models.TimeField("earliest guest check-in", null=True, blank=True)
    checkout_by = models.TimeField("latest guest check-out", null=True, blank=True)

    # Appearance — the workspace theme picked for each staff role.
    role_themes = models.JSONField("theme per role", default=dict, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.branch.name} settings"


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
        DELUXE = "deluxe", "Deluxe"
        EXECUTIVE = "executive", "Executive"
        SUITE = "suite", "Suite"
        FAMILY = "family", "Family"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="rooms")
    name = models.CharField("room name or number", max_length=60)
    room_type = models.CharField(max_length=20, choices=Type.choices, default=Type.DOUBLE)
    capacity = models.PositiveSmallIntegerField("guest capacity", default=2)
    price = models.DecimalField("nightly rate", max_digits=10, decimal_places=2)
    day_rest_price = models.DecimalField(
        "flat day-rest rate", max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="What a day rest bills — blank falls back to the nightly rate.",
    )
    commission = models.DecimalField(
        "commission per booking", max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Commission this room pays out on a booking — blank means none.",
    )
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
        DAY_REST = "day_rest", "Day rest"

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
    guest_phone = models.CharField(max_length=20, blank=True)
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
    tax_reference = models.CharField("tax invoice / reference code", max_length=64, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="bookings_taken",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start"]
        indexes = [
            # Branch boards filter on status and order by check-in.
            models.Index(fields=["branch", "status", "-start"], name="booking_branch_status_start"),
            # Overlap checks hunt live bookings covering a period on one room.
            models.Index(fields=["room", "status", "start", "end"], name="booking_room_period"),
        ]

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


class BookingPackage(models.Model):
    """An extra package sold on a booking — a meal, hire or tour added at
    registration. The name and price are snapshotted so later catalogue edits
    don't rewrite the guest's bill. `companion` null means the package is for
    the booking's main guest."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="extra_packages")
    companion = models.ForeignKey(
        BookingGuest, on_delete=models.SET_NULL, null=True, blank=True, related_name="extra_packages"
    )
    package = models.ForeignKey(
        "ExtraPackage", on_delete=models.SET_NULL, null=True, related_name="sales"
    )
    name = models.CharField("package name when sold", max_length=120)
    amount = models.DecimalField("price when sold", max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} · {self.booking}"


def ticket_attachment_path(instance, filename):
    return f"ticket_files/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class Ticket(models.Model):
    """A work ticket raised at a branch — maintenance, housekeeping, guest requests and more."""

    class Category(models.TextChoices):
        MAINTENANCE = "maintenance", "Maintenance"
        HOUSEKEEPING = "housekeeping", "Housekeeping"
        GUEST_REQUEST = "guest_request", "Guest request"
        COMPLAINT = "complaint", "Complaint"
        IT_SYSTEM = "it_system", "IT/System"
        INVENTORY = "inventory", "Inventory"
        OTHER = "other", "Other"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ASSIGNED = "assigned", "Assigned"
        IN_PROGRESS = "in_progress", "In progress"
        ON_HOLD = "on_hold", "On hold"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"
        REOPENED = "reopened", "Reopened"

    class Source(models.TextChoices):
        RECEPTION = "reception", "Reception"
        PHONE = "phone", "Phone"
        GUEST_PORTAL = "guest_portal", "Guest portal"
        HOUSEKEEPING_APP = "housekeeping_app", "Housekeeping app"
        OTHER = "other", "Other"

    # Statuses that mean the work is done — `resolved_at` tracks when it finished.
    DONE_STATUSES = {Status.RESOLVED, Status.CLOSED}

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="tickets")
    number = models.CharField("ticket number", max_length=12, unique=True, null=True, editable=False)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.MAINTENANCE)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN)
    # Where the issue is — a specific room, or free text for common areas like "Lobby".
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="tickets"
    )
    location = models.CharField("location or common area", max_length=120, blank=True)
    # Optional link to a stay — fills in the related guest for guest-related tickets.
    booking = models.ForeignKey(
        Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="tickets"
    )
    # Who flagged it — the staff member who logged it, plus free text for a guest/contractor.
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tickets_reported",
    )
    reporter_name = models.CharField("reported by (guest or visitor)", max_length=120, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.RECEPTION)
    # Who's fixing it — a staff member or a free-text external contractor.
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tickets_assigned",
    )
    assignee_name = models.CharField("external contractor", max_length=120, blank=True)
    due = models.DateField("due date", null=True, blank=True)
    # Details collected by the status-change popup forms on the tickets board.
    supplier_name = models.CharField("supplier name", max_length=120, blank=True)
    supplier_phone = models.CharField("supplier phone", max_length=30, blank=True)
    started_on = models.DateField("work started on", null=True, blank=True)
    hold_reason = models.CharField("hold reason", max_length=200, blank=True)
    held_on = models.DateField("put on hold on", null=True, blank=True)
    labour_cost = models.DecimalField("labour cost", max_digits=10, decimal_places=2, null=True, blank=True)
    payment_ref = models.CharField("payment reference", max_length=60, blank=True)
    reopen_reason = models.CharField("reopen reason", max_length=200, blank=True)
    reopened_on = models.DateField("reopened on", null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # The tickets board is a branch-scoped list filtered by status.
            models.Index(fields=["branch", "status", "-created_at"], name="ticket_branch_status"),
        ]

    def __str__(self):
        return f"{self.number or 'TCK-????'} · {self.title}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.number is None:
            # Numbers come from the row id, so they only exist after the first save.
            self.number = f"TCK-{self.pk:04d}"
            super().save(update_fields=["number"])


class TicketItem(models.Model):
    """A part or material used to resolve a ticket — each row has a name and unit price."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=160)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} · {self.ticket}"


class TicketAttachment(models.Model):
    """A photo, video or document attached to a ticket; `name` keeps the original filename."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=ticket_attachment_path)
    name = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name or 'file'} · {self.ticket}"


@receiver(post_delete, sender=TicketAttachment)
def _delete_ticket_attachment_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)


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
    receipt_number = models.CharField("receipt number", max_length=12, unique=True, null=True, editable=False)
    reference = models.CharField("receipt or transaction reference", max_length=60, blank=True)
    # When the money actually moved — blank means it was paid as it was recorded.
    paid_at = models.DateTimeField("time the payment was made", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            # Till reports sum a method's payments inside each session's window.
            models.Index(fields=["booking", "method", "created_at"], name="payment_booking_method_time"),
        ]

    def __str__(self):
        payer = self.companion.name if self.companion_id else self.booking.guest_name
        return f"{payer} · {self.amount} ({self.get_method_display()})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.receipt_number is None:
            # Numbers come from the row id, so they only exist after the first save.
            self.receipt_number = f"RCP-{self.pk:04d}"
            super().save(update_fields=["receipt_number"])


class Referral(models.Model):
    """A new client brought in by someone — usually a returning guest. The referrer
    earns a gift voucher, which matures once the referred client pays for the room;
    while the booking is only reserved the referral is partially mature."""

    class Maturity(models.TextChoices):
        PARTIAL = "partial", "Partial — reserved, awaiting payment"
        MATURED = "matured", "Matured — client paid"
        VOID = "void", "Void — booking cancelled"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="referrals")
    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name="referral",
        help_text="The referred client's booking.",
    )
    referrer_name = models.CharField("who referred this client", max_length=120)
    referrer_phone = models.CharField(max_length=20)
    voucher_code = models.CharField("gift voucher code", max_length=12, unique=True, null=True, editable=False)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="vouchers_redeemed",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.referrer_name} → {self.booking.guest_name}"

    @property
    def paid_amount(self):
        """Deposit + every payment recorded on the referred client's booking."""
        return (self.booking.deposit or 0) + sum(p.amount for p in self.booking.payments.all())

    @property
    def maturity(self):
        if self.booking.status == Booking.Status.CANCELLED:
            return self.Maturity.VOID
        return self.Maturity.MATURED if self.paid_amount > 0 else self.Maturity.PARTIAL

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.voucher_code is None:
            # Codes come from the row id, so they only exist after the first save.
            self.voucher_code = f"GV-{self.pk:04d}"
            super().save(update_fields=["voucher_code"])


class Voucher(models.Model):
    """Credit a guest carries away from a room change — the downgrade balance they
    chose to take as a voucher instead of a refund or extra nights. Vouchers
    never expire; only the unused balance is converted."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="vouchers")
    # The booking whose room change issued this voucher.
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="vouchers")
    code = models.CharField("voucher code", max_length=12, unique=True, null=True, editable=False)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    guest_name = models.CharField(max_length=120)
    guest_phone = models.CharField(max_length=20, blank=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="vouchers_collected",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code or 'Voucher'} · {self.guest_name} · {self.amount}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.code is None:
            # Codes come from the row id, so they only exist after the first save.
            self.code = f"VC-{self.pk:04d}"
            super().save(update_fields=["code"])


class ClientSuspension(models.Model):
    """A client barred from new bookings — keyed by the same rollup key the
    clients directory assigns (id:…/ph:…/em:…/nm:…), so the hold follows the
    guest whoever books for them. Profile details stay on the bookings
    themselves; only the suspension lives here."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="client_suspensions")
    key = models.CharField("client rollup key", max_length=140)
    reason = models.CharField(max_length=160, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="client_suspensions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "key"], name="client_suspension_branch_key"),
        ]

    def __str__(self):
        return f"{self.key} · {self.branch.name}"


def package_image_path(instance, filename):
    return f"package_images/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class ExtraPackage(models.Model):
    """An add-on a branch sells on top of a stay — a spa session, dinner, airport
    pickup or tour. Registered by the branch manager; suspended packages stay on
    record but can't be offered to guests."""

    class Category(models.TextChoices):
        FOOD = "food", "Food"
        TRAVEL = "travel", "Travel"
        TOURIST = "tourist", "Tourist"
        SAFE_STORAGE = "safe_storage", "Safe storage"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="extra_packages")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    name = models.CharField("package name", max_length=120)
    description = models.TextField(blank=True)
    amount = models.DecimalField("package price", max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to=package_image_path, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["branch", "status"], name="pkg_branch_status"),
        ]

    def __str__(self):
        return f"{self.name} · {self.branch.name}"


@receiver(post_delete, sender=ExtraPackage)
def _delete_package_image_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)


class Supplier(models.Model):
    """A party the branch pays — stock suppliers and expense payees. Registered
    automatically the first time an expense or purchase names them, so the
    front desk can autocomplete name and phone next time."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "name"], name="supplier_branch_name"),
        ]

    def __str__(self):
        return f"{self.name} · {self.branch.name}"

    @classmethod
    def register(cls, branch, name, phone=""):
        """Remember a supplier for autocomplete — a new name is added, and the
        phone is updated whenever a record gives a different one."""
        name, phone = name.strip(), phone.strip()
        if not name:
            return None
        supplier = cls.objects.filter(branch=branch, name__iexact=name).first()
        if supplier is None:
            return cls.objects.create(branch=branch, name=name, phone=phone)
        if phone and phone != supplier.phone:
            supplier.phone = phone
            supplier.save(update_fields=["phone"])
        return supplier


class Expense(models.Model):
    """Money the branch spent — logged by the front desk from Accounts → Expense.
    `supplier_name` is the person or company the money went to."""

    class Category(models.TextChoices):
        SUPPLIES = "supplies", "Supplies"
        UTILITIES = "utilities", "Utilities"
        MAINTENANCE = "maintenance", "Maintenance"
        SALARIES = "salaries", "Salaries & wages"
        TRANSPORT = "transport", "Transport"
        MARKETING = "marketing", "Marketing"
        FOOD_BEVERAGE = "food_beverage", "Food & beverage"
        OTHER = "other", "Other"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="expenses")
    # The till session the expense was registered under — set on creation;
    # null only for records logged before tills tracked spending.
    session = models.ForeignKey(
        "TillSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses"
    )
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    name = models.CharField("expense name", max_length=160)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    supplier_name = models.CharField("supplier / paid to", max_length=120)
    supplier_phone = models.CharField("supplier phone", max_length=30, blank=True)
    payment_status = models.CharField(
        "payment status", max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PAID
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="expenses_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["branch", "-created_at"], name="expense_branch_created"),
        ]

    def __str__(self):
        return f"{self.name} · {self.amount} ({self.get_payment_status_display()})"


class StockPurchase(models.Model):
    """Stock bought for the branch from an outside supplier — logged from
    Accounts → Buy stock. `unit_price` is the buying price of each item."""

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="stock_purchases")
    # The till session the purchase was registered under — see Expense.session.
    session = models.ForeignKey(
        "TillSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_purchases"
    )
    supplier_name = models.CharField("supplier name", max_length=120)
    supplier_phone = models.CharField("supplier phone", max_length=20, blank=True)
    item = models.CharField("supplied item", max_length=160)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField("buying price each", max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        "payment status", max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PAID
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_purchases_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["branch", "-created_at"], name="stockpurchase_branch_created"),
        ]

    def __str__(self):
        return f"{self.item} × {self.quantity} · {self.supplier_name}"


class TillSession(models.Model):
    """One session of the counter till — opened with cash, M-Pesa and card
    floats, closed with each channel's counted total. A branch can only
    have one open till at a time (enforced in the viewset, which can see
    the caller's branch)."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="till_sessions")
    opening_float = models.DecimalField("opening cash float", max_digits=10, decimal_places=2)
    opening_mpesa = models.DecimalField("opening M-Pesa", max_digits=10, decimal_places=2, default=0)
    opening_card = models.DecimalField("opening credit card", max_digits=10, decimal_places=2, default=0)
    note = models.CharField("opening note", max_length=200, blank=True)
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="till_sessions_opened",
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closing_count = models.DecimalField("cash counted at close", max_digits=10, decimal_places=2, null=True, blank=True)
    closing_mpesa = models.DecimalField("M-Pesa counted at close", max_digits=10, decimal_places=2, null=True, blank=True)
    closing_card = models.DecimalField("card counted at close", max_digits=10, decimal_places=2, null=True, blank=True)
    closing_note = models.CharField("closing note", max_length=200, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="till_sessions_closed",
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]
        indexes = [
            # The counter page asks for the branch's open till on every load.
            models.Index(fields=["branch", "closed_at", "-opened_at"], name="till_branch_open"),
        ]

    def __str__(self):
        state = "closed" if self.closed_at else "open"
        return f"Till · {self.branch.name} · {self.opened_at:%d %b %H:%M} ({state})"


class TillDrawing(models.Model):
    """Money taken out of the till mid-session — change float, a payout,
    banking. `method` is the channel it left through: physical cash, the
    M-Pesa line or the card account. Belongs to a session so every drawing
    lands inside a till report."""

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        MPESA = "mpesa", "M-Pesa"
        VISA = "visa", "Visa card"

    session = models.ForeignKey(TillSession, on_delete=models.CASCADE, related_name="drawings")
    method = models.CharField(max_length=10, choices=Method.choices, default=Method.CASH)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True)
    given_to = models.CharField("drawn by / given to", max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="till_drawings",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.amount} · {self.reason or 'drawing'} ({self.session})"
