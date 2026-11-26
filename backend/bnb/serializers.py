import json
import re
from decimal import Decimal

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User, six_digit_code

from .models import Booking, BookingGuest, BookingPackage, BookingPayment, Branch, BranchSettings, ClientSuspension, Expense, ExtraPackage, Referral, Room, RoomPhoto, StockPurchase, Supplier, Ticket, TicketAttachment, TicketItem, TillDrawing, TillSession, Voucher
from .permissions import TICKET_ASSIGN_ROLES

MAX_PHOTO_BYTES = 3 * 1024 * 1024
PIN_RE = re.compile(r"\d{6}")


DEFAULT_DIAL = "254"  # The system runs Kenyan branches — see _phone_tail.


def _phone_tail(value):
    """The last 9 digits of a phone number — identifies a local line across +254/07 formats."""
    return re.sub(r"\D", "", value or "")[-9:]


def _valid_phone(value):
    digits = value.lstrip("+").replace(" ", "").replace("-", "")
    return digits.isdigit() and 9 <= len(digits) <= 15


def _client_key_of(name="", phone="", email="", id_number=""):
    """The rollup key a guest maps to — mirrors `clientKey` in the app and the
    clients view's `_client_key`: ID number, then phone digits, email, name."""
    idn = (id_number or "").strip().lower().replace("/", "_")
    if idn:
        return f"id:{idn}"
    ph = re.sub(r"\D", "", phone or "")
    if ph:
        return f"ph:{ph}"
    em = (email or "").strip().lower().replace("/", "_")
    if em:
        return f"em:{em}"
    return f"nm:{(name or '').strip().lower().replace('/', '_')}"


def _normalize_phone(value):
    """The stored form — +<country code><subscriber>, no spaces or dashes. A number
    typed in local format (795… or 0795…) is assumed Kenyan and gets the +254."""
    v = re.sub(r"[\s-]+", "", (value or "").strip())
    if not v:
        return v
    if v.startswith("+"):
        # A trunk 0 left after the code — "+254 0…" is "+254…".
        trunk = "+" + DEFAULT_DIAL + "0"
        if v.startswith(trunk):
            v = "+" + DEFAULT_DIAL + v[len(trunk):]
        return v
    if v.startswith(DEFAULT_DIAL):
        return "+" + v
    return "+" + DEFAULT_DIAL + v.lstrip("0")


def _clear_prefetch(instance):
    """Drop an instance's cached prefetched relations. Nested rows replaced inside
    create/update leave stale objects in the cache, which then leaks into the
    serialized response."""
    cache = getattr(instance, "_prefetched_objects_cache", None)
    if cache is not None:
        cache.clear()


def _room_clash(room, start, end, exclude=None):
    """The live booking (reserved/occupied) overlapping `room` over [start, end), if any."""
    qs = Booking.objects.filter(
        room=room, status__in=Booking.ACTIVE_STATUSES, start__lt=end, end__gt=start,
    )
    if exclude:
        qs = qs.exclude(pk=exclude)
    return qs.select_related("room").first()


def _check_room_clashes(room, start, end, companions, instance=None):
    """Raises a validation error if the main room or a companion's own room is
    already booked for the period. `companions` are dicts holding Room objects."""
    exclude = getattr(instance, "pk", None)
    if room and start and end:
        other = _room_clash(room, start, end, exclude)
        if other:
            raise serializers.ValidationError(
                {"room": f"{room.name} is already {other.status} for that period ({other.guest_name})."}
            )
    for c in companions or []:
        r = c.get("room")
        if not r:
            continue
        c_start, c_end = c.get("start") or start, c.get("end") or end
        if c_start and c_end:
            other = _room_clash(r, c_start, c_end, exclude)
            if other:
                raise serializers.ValidationError(
                    {"companions": f"{r.name} is already {other.status} for that period ({other.guest_name})."}
                )


def _lock_rooms(room_ids):
    """Lock room rows (in a stable order) so concurrent booking writes serialize
    on the rooms instead of racing past each other's overlap checks."""
    if room_ids:
        list(Room.objects.select_for_update().filter(pk__in=room_ids).order_by("pk"))


class BranchSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, required=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, required=False)
    status = serializers.ChoiceField(choices=Branch.Status.choices, required=False)
    photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Branch
        fields = [
            "id", "name", "phone", "email", "location", "code",
            "password", "confirm_password", "status", "photo", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "code": {"validators": [six_digit_code]},
        }

    def validate_email(self, value):
        value = value.strip().lower()
        qs = Branch.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A branch with this email already exists.")
        return value

    def validate_code(self, value):
        qs = Branch.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This code is already taken. Please choose another one.")
        return value

    def validate_phone(self, value):
        value = _normalize_phone(value)
        if not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_photo(self, value):
        if value and value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("The picture must be smaller than 3 MB.")
        return value

    def validate(self, attrs):
        password = attrs.get("password")
        if self.instance is None or password:
            if not password:
                raise serializers.ValidationError({"password": "This field is required."})
            if password != attrs.pop("confirm_password", None):
                raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
            if PIN_RE.fullmatch(password):
                if password == attrs.get("code", getattr(self.instance, "code", None)):
                    raise serializers.ValidationError(
                        {"password": "The 6-digit password can't be the same as the sign-in code."}
                    )
                return attrs
            try:
                password_validation.validate_password(password)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)})
        else:
            attrs.pop("confirm_password", None)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        branch = Branch(**validated_data)
        branch.set_password(password)
        branch.save()
        return branch

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["photo"] = instance.photo.url if instance.photo else None
        return data


BRANCH_SETTINGS_FIELDS = (
    "mpesa_enabled", "mpesa_till", "mpesa_account",
    "cash_enabled", "card_enabled",
    "bank_enabled", "bank_name", "bank_account_name", "bank_account_number",
    "mpesa_consumer_key", "mpesa_consumer_secret", "mpesa_passkey",
    "card_api_key", "card_api_secret",
    "email_enabled", "sms_enabled", "sms_sender_id",
    "whatsapp_enabled", "whatsapp_number",
    "email_api_key", "sms_api_key", "sms_api_username", "whatsapp_api_key",
    "message_templates",
    "opens_at", "closes_at", "checkin_from", "checkout_by",
    "role_themes",
)


class BranchProfileSerializer(serializers.Serializer):
    """The branch's own profile — details, payment methods and guest messaging —
    edited by its manager from Branch settings. Settings fields sit flat beside the
    branch fields; reads fall back to the model defaults when no settings row exists."""

    # Branch details — the subset a manager can change; code and status stay read-only.
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    location = serializers.CharField(max_length=255)
    code = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_label = serializers.CharField(read_only=True)
    photo = serializers.ImageField(required=False, allow_null=True)

    # Payments
    mpesa_enabled = serializers.BooleanField(required=False)
    mpesa_till = serializers.CharField(max_length=20, required=False, allow_blank=True)
    mpesa_account = serializers.CharField(max_length=40, required=False, allow_blank=True)
    cash_enabled = serializers.BooleanField(required=False)
    card_enabled = serializers.BooleanField(required=False)
    bank_enabled = serializers.BooleanField(required=False)
    bank_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    bank_account_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    bank_account_number = serializers.CharField(max_length=40, required=False, allow_blank=True)

    # Payment API keys
    mpesa_consumer_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    mpesa_consumer_secret = serializers.CharField(max_length=120, required=False, allow_blank=True)
    mpesa_passkey = serializers.CharField(max_length=120, required=False, allow_blank=True)
    card_api_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    card_api_secret = serializers.CharField(max_length=120, required=False, allow_blank=True)

    # Communications
    email_enabled = serializers.BooleanField(required=False)
    sms_enabled = serializers.BooleanField(required=False)
    sms_sender_id = serializers.CharField(max_length=11, required=False, allow_blank=True)
    whatsapp_enabled = serializers.BooleanField(required=False)
    whatsapp_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # Communications API keys
    email_api_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    sms_api_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    sms_api_username = serializers.CharField(max_length=60, required=False, allow_blank=True)
    whatsapp_api_key = serializers.CharField(max_length=120, required=False, allow_blank=True)

    # Guest message drafts, keyed by trigger
    message_templates = serializers.JSONField(required=False)

    # Branch hours and guest check-in / check-out window
    opens_at = serializers.TimeField(required=False, allow_null=True)
    closes_at = serializers.TimeField(required=False, allow_null=True)
    checkin_from = serializers.TimeField(required=False, allow_null=True)
    checkout_by = serializers.TimeField(required=False, allow_null=True)

    # Appearance — theme name per staff role
    role_themes = serializers.JSONField(required=False)

    updated_at = serializers.DateTimeField(read_only=True)

    def validate_message_templates(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Send an object keyed by message trigger.")
        for trigger, draft in value.items():
            if not isinstance(draft, dict) or not all(
                isinstance(draft.get(k, d), t)
                for k, t, d in (("enabled", bool, True), ("channel", str, ""), ("subject", str, ""), ("body", str, ""))
            ):
                raise serializers.ValidationError(f"The '{trigger}' draft must have enabled/channel/subject/body fields.")
        return value

    def validate_role_themes(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Send an object of role → theme name.")
        valid = set(User.Role.values)
        for role, theme in value.items():
            if role not in valid:
                raise serializers.ValidationError(f"'{role}' isn't a valid role.")
            if not isinstance(theme, str):
                raise serializers.ValidationError("Theme names must be text.")
        return value

    def validate_name(self, value):
        value = value.strip()
        qs = Branch.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A branch with this name already exists.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        qs = Branch.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A branch with this email already exists.")
        return value

    def validate_phone(self, value):
        value = _normalize_phone(value)
        if not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_whatsapp_number(self, value):
        value = _normalize_phone(value)
        if value and not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid WhatsApp number.")
        return value

    def validate_photo(self, value):
        if value and value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("The picture must be smaller than 3 MB.")
        return value

    def update(self, instance, validated_data):
        settings_data = {k: validated_data.pop(k) for k in BRANCH_SETTINGS_FIELDS if k in validated_data}
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if settings_data:
            settings_obj = getattr(instance, "settings", None) or BranchSettings(branch=instance)
            for key, value in settings_data.items():
                setattr(settings_obj, key, value)
            settings_obj.save()
        return instance

    def to_representation(self, instance):
        settings_obj = getattr(instance, "settings", None) or BranchSettings(branch=instance)
        data = {
            "id": instance.id,
            "name": instance.name,
            "phone": instance.phone,
            "email": instance.email,
            "location": instance.location,
            "code": instance.code,
            "status": instance.status,
            "status_label": instance.get_status_display(),
            "photo": instance.photo.url if instance.photo else None,
            "updated_at": instance.updated_at,
        }
        for key in BRANCH_SETTINGS_FIELDS:
            data[key] = getattr(settings_obj, key)
        return data


class _UserBranchDefault:
    """Default `branch` for room writes — the caller's own branch (None for company roles)."""

    requires_context = True

    def __call__(self, serializer_field):
        return serializer_field.context["request"].user.branch


class RoomPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumb = serializers.SerializerMethodField()

    class Meta:
        model = RoomPhoto
        fields = ["id", "url", "thumb", "position"]
        read_only_fields = fields

    def get_url(self, obj):
        return obj.image.url if obj.image else None

    def get_thumb(self, obj):
        if obj.thumb:
            return obj.thumb.url
        return obj.image.url if obj.image else None


MAX_ROOM_PHOTOS = 8


class RoomSerializer(serializers.ModelSerializer):
    # Branch roles never send a branch — the default fills in their own and the viewset enforces it.
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    type_label = serializers.CharField(source="get_room_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    status = serializers.ChoiceField(choices=Room.Status.choices, required=False)
    photo = serializers.SerializerMethodField()
    photos = RoomPhotoSerializer(many=True, read_only=True)
    # Write-only photo management: `new_photos` are files to add; `remove_photos` is
    # comma-separated ids to delete; `main_photo` is "e:<id>" or "n:<index>" to make first.
    new_photos = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False, max_length=MAX_ROOM_PHOTOS
    )
    remove_photos = serializers.CharField(write_only=True, required=False, allow_blank=True)
    main_photo = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Room
        fields = [
            "id", "branch", "branch_name", "name", "room_type", "type_label",
            "capacity", "price", "day_rest_price", "commission", "description", "status", "status_label", "status_reason",
            "photo", "photos", "new_photos", "remove_photos", "main_photo", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        # The model's UniqueConstraint still guards the DB; validate() reports a
        # friendlier per-field error instead of a generic non-field one.
        validators = []

    def get_photo(self, obj):
        first = obj.photos.first()
        if not first:
            return None
        return first.thumb.url if first.thumb else (first.image.url if first.image else None)

    def to_internal_value(self, data):
        # FormData can't send null — an empty optional rate clears to "no override".
        if hasattr(data, "get") and (data.get("day_rest_price") == "" or data.get("commission") == ""):
            data = data.copy()
            for f in ("day_rest_price", "commission"):
                if data.get(f) == "":
                    data[f] = None
        return super().to_internal_value(data)

    def validate_name(self, value):
        return value.strip()

    def validate_capacity(self, value):
        if not 1 <= value <= 30:
            raise serializers.ValidationError("Capacity must be between 1 and 30 guests.")
        return value

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("The nightly rate can't be negative.")
        return value

    def validate_day_rest_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("The day-rest rate can't be negative.")
        return value

    def validate_commission(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("The commission can't be negative.")
        return value

    def validate_status_reason(self, value):
        return value.strip()

    def _remove_ids(self, raw):
        ids = set()
        for part in (raw or "").split(","):
            part = part.strip()
            if part.isdigit():
                ids.add(int(part))
            elif part:
                raise serializers.ValidationError({"remove_photos": "Send comma-separated photo ids."})
        return ids

    def validate(self, attrs):
        # The branch the room will actually be saved under — the caller's own for branch
        # roles, the chosen/existing one for company roles.
        user_branch = self.context.get("user_branch")
        if self.instance:
            branch = self.instance.branch if user_branch else (attrs.get("branch") or self.instance.branch)
        else:
            branch = user_branch or attrs.get("branch")
        name = attrs.get("name", getattr(self.instance, "name", ""))
        if branch and name:
            qs = Room.objects.filter(branch=branch, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "A room with this name already exists in this branch."})

        new_files = attrs.get("new_photos") or []
        for f in new_files:
            if f.size > MAX_PHOTO_BYTES:
                raise serializers.ValidationError({"new_photos": "Each picture must be smaller than 3 MB."})
        removes = self._remove_ids(attrs.get("remove_photos", ""))
        if removes:
            owned = set(self.instance.photos.filter(id__in=removes).values_list("id", flat=True)) if self.instance else set()
            if owned != removes:
                raise serializers.ValidationError({"remove_photos": "One of those pictures doesn't belong to this room."})
        keep = (self.instance.photos.count() - len(removes)) if self.instance else 0
        if keep + len(new_files) > MAX_ROOM_PHOTOS:
            raise serializers.ValidationError({"new_photos": f"A room can have at most {MAX_ROOM_PHOTOS} pictures."})
        main = (attrs.get("main_photo") or "").partition(":")
        if main[0] and (main[0] not in ("e", "n") or not main[2].isdigit()):
            raise serializers.ValidationError({"main_photo": "Use 'e:<photo id>' or 'n:<new photo index>'."})
        if main[0] == "e" and self.instance and not self.instance.photos.filter(id=int(main[2])).exists():
            raise serializers.ValidationError({"main_photo": "That picture doesn't belong to this room."})
        if main[0] == "n" and int(main[2]) >= len(new_files):
            raise serializers.ValidationError({"main_photo": "That new picture index is out of range."})
        return attrs

    def create(self, validated_data):
        files = validated_data.pop("new_photos", [])
        room = Room.objects.create(**validated_data)
        for pos, f in enumerate(files):
            RoomPhoto.add(room, f, pos)
        return room

    def update(self, instance, validated_data):
        files = validated_data.pop("new_photos", [])
        removes = self._remove_ids(validated_data.pop("remove_photos", ""))
        main = validated_data.pop("main_photo", "")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if instance.status == Room.Status.ACTIVE:
            instance.status_reason = ""
        instance.save()

        for p in instance.photos.filter(id__in=removes):
            p.delete()
        added = [RoomPhoto.add(instance, f, 1000 + i) for i, f in enumerate(files)]
        self._resequence(instance, main, added)
        _clear_prefetch(instance)
        return instance

    def _resequence(self, room, main_token, added):
        # Query fresh — `room.photos` may hold a stale prefetch cache after deletions.
        photos = list(RoomPhoto.objects.filter(room=room))
        if main_token:
            kind, _, val = main_token.partition(":")
            target = None
            if kind == "e":
                target = next((p for p in photos if p.id == int(val)), None)
            elif kind == "n" and int(val) < len(added):
                target = added[int(val)]
            if target:
                photos = [target] + [p for p in photos if p.pk != target.pk]
        for i, p in enumerate(photos):
            if p.position != i:
                p.position = i
                p.save(update_fields=["position"])


class BookingGuestSerializer(serializers.ModelSerializer):
    id_type = serializers.ChoiceField(choices=Booking.IdType.choices, required=False, allow_blank=True)
    id_type_label = serializers.CharField(source="get_id_type_display", read_only=True, default=None)
    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all(), required=False, allow_null=True)
    room_name = serializers.CharField(source="room.name", read_only=True, default=None)

    class Meta:
        model = BookingGuest
        fields = ["id", "name", "phone", "email", "id_type", "id_type_label", "id_number",
                  "nationality", "notes", "room", "room_name", "start", "end", "rate"]
        read_only_fields = ["id", "room_name"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Each guest's name is required.")
        return value

    def validate_phone(self, value):
        value = _normalize_phone(value)
        if value and not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_id_number(self, value):
        return value.strip()

    def validate_nationality(self, value):
        return value.strip()

    def validate_notes(self, value):
        return value.strip()

    def validate_rate(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("The room rate can't be negative.")
        return value

    def validate(self, attrs):
        if attrs.get("id_number") and not attrs.get("id_type"):
            attrs["id_type"] = Booking.IdType.NATIONAL_ID
        start, end = attrs.get("start"), attrs.get("end")
        if (start and not end) or (end and not start):
            raise serializers.ValidationError(
                {"end": "Give both a check-in and a check-out, or leave both empty to follow the booking."}
            )
        if start and end and end <= start:
            raise serializers.ValidationError({"end": "The check-out must be after the check-in."})
        return attrs


# Channels real money moves through — "pay later" is a zero-amount marker a
# check-in leaves behind, not somewhere cash in or out can flow. Compared
# against the raw value, not Method.LATER, so a partially-synced deploy with
# an older models.py still boots.
MONEY_METHODS = [m for m in BookingPayment.Method.values if m != "later"]


class BookingPaymentSerializer(serializers.ModelSerializer):
    """One payment row. `guest` is the party position on write: 0 = main guest,
    n = the nth extra guest (companions[n-1])."""

    guest = serializers.IntegerField(min_value=0, required=False, default=0, write_only=True)
    payer = serializers.SerializerMethodField()
    method = serializers.ChoiceField(choices=BookingPayment.Method.choices)
    method_label = serializers.CharField(source="get_method_display", read_only=True)

    class Meta:
        model = BookingPayment
        fields = ["id", "guest", "companion", "payer", "amount", "method", "method_label",
                  "receipt_number", "reference", "paid_at", "created_at"]
        read_only_fields = ["id", "companion", "payer", "method_label", "receipt_number", "created_at"]

    def get_payer(self, obj):
        return obj.companion.name if obj.companion_id else obj.booking.guest_name

    def validate(self, attrs):
        """'later' rows are markers only — they must carry a zero amount, while
        every real money channel names a positive one."""
        later = attrs.get("method") == "later"
        amount = attrs.get("amount")
        if later and amount not in (None, Decimal(0)):
            raise serializers.ValidationError({"amount": "A pay-later marker carries no amount."})
        if not later and amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "The amount must be more than zero."})
        return attrs

    def validate_reference(self, value):
        return value.strip()


class BookingPackageSerializer(serializers.ModelSerializer):
    """One package picked for a guest on a booking. `guest` is the party
    position on write: 0 = main guest, n = companions[n-1] — the same key
    payments use. name/amount snapshot from the catalogue package at sale."""

    guest = serializers.IntegerField(min_value=0, required=False, default=0, write_only=True)
    payer = serializers.SerializerMethodField()

    class Meta:
        model = BookingPackage
        fields = ["id", "guest", "package", "payer", "name", "amount", "created_at"]
        read_only_fields = ["id", "payer", "name", "amount", "created_at"]

    def get_payer(self, obj):
        return obj.companion.name if obj.companion_id else obj.booking.guest_name


class ReferralSerializer(serializers.ModelSerializer):
    """A referrer and the new client's booking they sent. `maturity` is computed:
    reserved-but-unpaid is partial, any money received matures it, cancelled voids it."""

    guest_name = serializers.CharField(source="booking.guest_name", read_only=True)
    guest_phone = serializers.CharField(source="booking.guest_phone", read_only=True)
    room_name = serializers.CharField(source="booking.room.name", read_only=True, default=None)
    booking_status = serializers.CharField(source="booking.status", read_only=True)
    booking_status_label = serializers.CharField(source="booking.get_status_display", read_only=True)
    maturity = serializers.SerializerMethodField()
    maturity_label = serializers.SerializerMethodField()
    paid = serializers.SerializerMethodField()
    billed = serializers.SerializerMethodField()
    redeemed_by_name = serializers.CharField(source="redeemed_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Referral
        fields = [
            "id", "booking", "guest_name", "guest_phone", "room_name",
            "booking_status", "booking_status_label",
            "referrer_name", "referrer_phone", "voucher_code",
            "maturity", "maturity_label", "paid", "billed",
            "redeemed_at", "redeemed_by_name", "created_at",
        ]
        read_only_fields = fields

    def get_maturity(self, obj):
        return obj.maturity

    def get_maturity_label(self, obj):
        return Referral.Maturity(obj.maturity).label

    def get_paid(self, obj):
        return str(obj.paid_amount)

    def get_billed(self, obj):
        return BookingSerializer().get_bill(obj.booking)


class VoucherSerializer(serializers.ModelSerializer):
    """A room-change credit voucher on a booking — read-only; issued by the
    change-room action, redeemed later at the front desk."""

    class Meta:
        model = Voucher
        fields = ["id", "code", "amount", "redeemed_at", "created_at"]
        read_only_fields = fields


class ExtraPackageSerializer(serializers.ModelSerializer):
    """A branch's extra package — `image` accepts a file on write or null to clear it."""

    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = ExtraPackage
        fields = [
            "id", "branch", "branch_name", "category", "category_label",
            "name", "description", "amount", "image",
            "status", "status_label", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Relative URL — the frontend serves /media itself (dev proxy / same origin).
        data["image"] = instance.image.url if instance.image else None
        return data

    def validate_name(self, value):
        return value.strip()

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("The amount can't be negative.")
        return value

    def validate_image(self, value):
        if value and value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("This picture is too large — keep it under 3 MB.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    room_name = serializers.CharField(source="room.name", read_only=True, default=None)
    kind = serializers.ChoiceField(choices=Booking.Kind.choices, required=False, default=Booking.Kind.RESERVATION)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status = serializers.ChoiceField(choices=Booking.Status.choices, required=False)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    guest_id_type = serializers.ChoiceField(choices=Booking.IdType.choices, required=False, allow_blank=True)
    guest_id_type_label = serializers.CharField(source="get_guest_id_type_display", read_only=True, default=None)
    companions = BookingGuestSerializer(many=True, required=False)
    payments = BookingPaymentSerializer(many=True, required=False)
    packages = BookingPackageSerializer(many=True, required=False, source="extra_packages")
    nights = serializers.SerializerMethodField()
    bill = serializers.SerializerMethodField()
    paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)
    # Write-only referral capture — the person who sent this client, for new guests.
    referrer_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    referrer_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    referral = ReferralSerializer(read_only=True)
    vouchers = VoucherSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "branch", "branch_name", "room", "room_name",
            "guest_name", "guest_phone", "guest_email",
            "guest_id_type", "guest_id_type_label", "guest_id_number",
            "guest_nationality", "guests", "guest_notes", "companions", "payments", "packages",
            "kind", "kind_label", "status", "status_label",
            "start", "end", "nights", "deposit", "tax_reference", "rate", "bill", "paid", "balance",
            "referrer_name", "referrer_phone", "referral", "vouchers",
            "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_nights(self, obj):
        from math import ceil
        return max(1, ceil((obj.end - obj.start).total_seconds() / 86400))

    def get_bill(self, obj):
        """Estimated charge — every distinct room × its billed nights; a companion's own
        period overrides the booking's, and a shared room bills for the longest stay.
        A day rest is a flat rate per room whatever the hours — the room's own
        day-rest rate when it has one, the nightly rate otherwise. An agreed `rate`
        settled at the desk replaces the listed price for that room."""
        from math import ceil
        day_rest = obj.kind == Booking.Kind.DAY_REST

        def listed(room):
            return (room.day_rest_price or room.price) if day_rest else room.price

        days, prices = {}, {}
        if obj.room_id:
            days[obj.room_id] = 1 if day_rest else self.get_nights(obj)
            prices[obj.room_id] = obj.rate if obj.rate is not None else listed(obj.room)
        for c in obj.companions.all():
            if not c.room_id:
                continue
            if day_rest:
                d = 1
            else:
                s, e = c.start or obj.start, c.end or obj.end
                d = max(1, ceil((e - s).total_seconds() / 86400))
            days[c.room_id] = max(days.get(c.room_id, 0), d)
            prices[c.room_id] = c.rate if c.rate is not None else (
                listed(c.room) if c.room else Decimal(0))
        rooms_total = sum(prices.get(rid, Decimal(0)) * n for rid, n in days.items())
        # Extra packages bill on top of the rooms — the snapshot price on each row.
        return str(rooms_total + sum(p.amount for p in obj.extra_packages.all()))

    def get_paid(self, obj):
        """Money received — the reservation deposit plus every recorded payment."""
        return str((obj.deposit or 0) + sum(p.amount for p in obj.payments.all()))

    def get_balance(self, obj):
        """What the guest still owes — negative means they've overpaid."""
        return str(Decimal(self.get_bill(obj)) - Decimal(self.get_paid(obj)))

    def validate_guest_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("The guest's name is required.")
        return value

    def validate_guest_phone(self, value):
        value = _normalize_phone(value)
        if value and not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_guest_email(self, value):
        return value.strip().lower()

    def validate_guest_id_number(self, value):
        return value.strip()

    def validate_guest_nationality(self, value):
        return value.strip()

    def validate_guest_notes(self, value):
        return value.strip()

    def validate_guests(self, value):
        if not 1 <= value <= 30:
            raise serializers.ValidationError("Guests must be between 1 and 30.")
        return value

    def validate_deposit(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("The deposit can't be negative.")
        return value

    def validate_rate(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("The room rate can't be negative.")
        return value

    def validate_tax_reference(self, value):
        return value.strip()

    def validate(self, attrs):
        user_branch = self.context.get("user_branch")
        if self.instance:
            branch = self.instance.branch if user_branch else (attrs.get("branch") or self.instance.branch)
        else:
            branch = user_branch or attrs.get("branch")
        room = attrs.get("room", getattr(self.instance, "room", None))
        start = attrs.get("start", getattr(self.instance, "start", None))
        end = attrs.get("end", getattr(self.instance, "end", None))

        if branch is None:
            raise serializers.ValidationError({"branch": "Pick a branch for this booking."})
        if room and room.branch_id != branch.id:
            raise serializers.ValidationError({"room": "That room doesn't belong to this branch."})
        if room and room.status != Room.Status.ACTIVE:
            raise serializers.ValidationError({"room": f"{room.name} is {room.get_status_display().lower()} and can't be booked."})
        if start and end and end <= start:
            raise serializers.ValidationError({"end": "The check-out must be after the move-in time."})

        # A new booking can't overlap another live booking on the same room.
        # Extra guests' own rooms are checked again below, after the room rules.
        if room and start and end:
            other = _room_clash(room, start, end, getattr(self.instance, "pk", None))
            if other:
                raise serializers.ValidationError(
                    {"room": f"{room.name} is already {other.status} for that period ({other.guest_name})."}
                )

        # An ID number without a document type defaults to a national ID.
        if attrs.get("guest_id_number") and not attrs.get(
            "guest_id_type", getattr(self.instance, "guest_id_type", None)
        ):
            attrs["guest_id_type"] = Booking.IdType.NATIONAL_ID

        # Every person past the first needs their own entry — no more, no less than guests-1.
        companions = attrs.get("companions")
        if companions is not None:
            total = attrs.get("guests", getattr(self.instance, "guests", 1))
            if len(companions) > max(0, total - 1):
                raise serializers.ValidationError(
                    {"companions": f"You listed {len(companions)} extra guests, but the party is only {total} people."}
                )

        # Extra guests may take their own rooms — each must be bookable for that guest's
        # own period (falling back to the booking's) and different from the main room.
        # Each becomes a separate client on create, so two guests can't hold the same one.
        seen = set()
        for c in companions or []:
            r = c.get("room")
            if not r:
                continue
            c_start, c_end = c.get("start") or start, c.get("end") or end
            if branch and r.branch_id != branch.id:
                raise serializers.ValidationError({"companions": f"{r.name} doesn't belong to this branch."})
            if r.status != Room.Status.ACTIVE:
                raise serializers.ValidationError({"companions": f"{r.name} is {r.get_status_display().lower()} and can't be booked."})
            if room and r.id == room.id:
                raise serializers.ValidationError({"companions": f"{r.name} is the main room — leave that guest's room empty to share it."})
            if r.id in seen:
                raise serializers.ValidationError(
                    {"companions": f"{r.name} is picked for two guests — give each their own room, or leave it empty to share the main room."}
                )
            seen.add(r.id)
            if c_start and c_end:
                other = _room_clash(r, c_start, c_end, getattr(self.instance, "pk", None))
                if other:
                    raise serializers.ValidationError(
                        {"companions": f"{r.name} is already {other.status} for that period ({other.guest_name})."}
                    )

        # A payment's `guest` must point inside the party: 0 = main guest, n = companions[n-1].
        payments = attrs.get("payments")
        if payments is not None:
            limit = len(companions) if companions is not None else (
                self.instance.companions.count() if self.instance else 0
            )
            for p in payments:
                if p.get("guest", 0) > limit:
                    raise serializers.ValidationError(
                        {"payments": "A payment points at a guest who isn't in this booking."}
                    )

        # Package picks use the same party-position key as payments; each one
        # names a catalogue package from this branch that's still on sale.
        packages = attrs.get("extra_packages")
        if packages is not None:
            limit = len(companions) if companions is not None else (
                self.instance.companions.count() if self.instance else 0
            )
            for p in packages:
                if p.get("guest", 0) > limit:
                    raise serializers.ValidationError(
                        {"packages": "A package points at a guest who isn't in this booking."}
                    )
                pkg = p.get("package")
                if pkg is None:
                    raise serializers.ValidationError({"packages": "Pick which package each selection is."})
                if branch and pkg.branch_id != branch.id:
                    raise serializers.ValidationError({"packages": f"{pkg.name} doesn't belong to this branch."})
                if pkg.status != ExtraPackage.Status.ACTIVE:
                    raise serializers.ValidationError({"packages": f"{pkg.name} is suspended and can't be sold."})

        # Referrals come as a pair — the referrer's name and their phone number.
        ref_name = (attrs.get("referrer_name") or "").strip()
        ref_phone = _normalize_phone(attrs.get("referrer_phone"))
        if ref_name and not ref_phone:
            raise serializers.ValidationError({"referrer_phone": "Give the referrer's phone number too."})
        if ref_phone:
            if not ref_name:
                raise serializers.ValidationError({"referrer_name": "Give the referrer's name too."})
            if not _valid_phone(ref_phone):
                raise serializers.ValidationError({"referrer_phone": "Enter a valid phone number."})
            guest_phone = attrs.get("guest_phone", getattr(self.instance, "guest_phone", ""))
            if guest_phone and _phone_tail(ref_phone) == _phone_tail(guest_phone):
                raise serializers.ValidationError({"referrer_phone": "The referrer can't be the guest themself."})
            attrs["referrer_name"] = ref_name
            attrs["referrer_phone"] = ref_phone

        # Status follows the booking kind on create unless a valid live status was sent.
        if self.instance is None:
            kind = attrs.get("kind", Booking.Kind.RESERVATION)
            default = Booking.Status.RESERVED if kind == Booking.Kind.RESERVATION else Booking.Status.OCCUPIED
            sent = attrs.get("status")
            attrs["status"] = sent if sent in Booking.ACTIVE_STATUSES else default
            # A suspended client can't take new bookings — the hold is keyed the
            # same way the clients directory groups guests.
            key = _client_key_of(
                attrs.get("guest_name", ""), attrs.get("guest_phone", ""),
                attrs.get("guest_email", ""), attrs.get("guest_id_number", ""),
            )
            if ClientSuspension.objects.filter(branch=branch, key=key).exists():
                raise serializers.ValidationError(
                    {"detail": "This client's account is suspended — they can't make new bookings."}
                )
        return attrs

    @staticmethod
    def _save_payments(booking, people, payments):
        """Writes payments against `people` — the party list. `guest` on a payment is its
        party position: 0 = main guest, n = people[n-1]. A member that's a Booking
        (an extra guest with their own room) receives the payment on their own
        booking; a BookingGuest lands it on the main booking under their name."""
        buckets = {}
        for p in payments:
            gi = p.pop("guest", 0)
            member = people[gi - 1] if gi else None
            if isinstance(member, Booking):
                target, p["companion"] = member, None
            else:
                target, p["companion"] = booking, member
            buckets.setdefault(target, []).append(p)
        for b, rows in buckets.items():
            BookingPayment.objects.bulk_create(BookingPayment(booking=b, **p) for p in rows)
            # bulk_create skips save(), so the receipt numbers get stamped on after.
            for p in BookingPayment.objects.filter(booking=b, receipt_number__isnull=True):
                p.save()

    @staticmethod
    def _save_packages(booking, people, packages):
        """Writes package picks against `people` — the same party-position key as
        payments. The catalogue name/price snapshot onto each row so the bill
        stays put even if the package is later edited or removed."""
        rows = []
        for p in packages:
            gi = p.get("guest", 0)
            pkg = p["package"]
            member = people[gi - 1] if gi else None
            target, companion = (member, None) if isinstance(member, Booking) else (booking, member)
            rows.append(BookingPackage(
                booking=target, companion=companion,
                package=pkg, name=pkg.name, amount=pkg.amount,
            ))
        BookingPackage.objects.bulk_create(rows)

    def create(self, validated_data):
        companions = validated_data.pop("companions", [])
        payments = validated_data.pop("payments", [])
        packages = validated_data.pop("extra_packages", [])
        ref_name = validated_data.pop("referrer_name", "")
        ref_phone = validated_data.pop("referrer_phone", "")
        with transaction.atomic():
            # Lock the booked rooms, then re-check overlaps — two concurrent creates
            # otherwise both pass validate() and double-book the room.
            room_ids = {validated_data["room"].pk} | {c["room"].pk for c in companions if c.get("room")}
            _lock_rooms(room_ids)
            _check_room_clashes(
                validated_data["room"], validated_data["start"], validated_data["end"], companions,
            )
            # An extra guest with their own room becomes a full booking — a separate
            # client with their own room, bill and payments, registered in one go.
            # Guests left without a room stay BookingGuest rows on the main booking:
            # they share the main room and count in its headcount.
            validated_data["guests"] = 1 + sum(1 for c in companions if not c.get("room"))
            booking = Booking.objects.create(**validated_data)
            people = []
            for c in companions:
                if c.get("room"):
                    people.append(Booking.objects.create(
                        branch=booking.branch, kind=booking.kind, status=booking.status,
                        room=c["room"], rate=c.get("rate"),
                        start=c.get("start") or booking.start,
                        end=c.get("end") or booking.end,
                        guest_name=c["name"], guest_phone=c.get("phone", ""), guest_email=c.get("email", ""),
                        guest_id_type=c.get("id_type", ""), guest_id_number=c.get("id_number", ""),
                        guest_nationality=c.get("nationality", ""), guest_notes=c.get("notes", ""),
                        guests=1, created_by=booking.created_by,
                    ))
                else:
                    people.append(BookingGuest.objects.create(booking=booking, **c))
            self._save_payments(booking, people, payments)
            self._save_packages(booking, people, packages)
            if ref_phone:
                Referral.objects.create(
                    branch=booking.branch, booking=booking,
                    referrer_name=ref_name, referrer_phone=ref_phone,
                )
        return booking

    def update(self, instance, validated_data):
        companions = validated_data.pop("companions", None)
        payments = validated_data.pop("payments", None)
        packages = validated_data.pop("extra_packages", None)
        ref_name = validated_data.pop("referrer_name", None)
        ref_phone = validated_data.pop("referrer_phone", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        # Companion dicts, or the booking's existing companions as dict-shaped rows.
        comp_rows = companions if companions is not None else [
            {"room": c.room, "start": c.start, "end": c.end} for c in instance.companions.all()
        ]
        with transaction.atomic():
            # Lock the booking row so concurrent edits to it serialize too.
            Booking.objects.select_for_update().filter(pk=instance.pk).exists()
            room_ids = {instance.room_id} | {c["room"].pk for c in comp_rows if c.get("room")}
            _lock_rooms(room_ids)
            _check_room_clashes(instance.room, instance.start, instance.end, comp_rows, instance)
            instance.save()
            if ref_phone:
                Referral.objects.update_or_create(
                    booking=instance,
                    defaults={"branch": instance.branch, "referrer_name": ref_name or "", "referrer_phone": ref_phone},
                )
            # When companions or payments are sent, the whole list is replaced — payment
            # guests map onto the party that results (new or existing).
            if companions is not None:
                instance.companions.all().delete()
            if payments is not None:
                instance.payments.all().delete()
            if packages is not None:
                instance.extra_packages.all().delete()
            if companions is not None or payments is not None or packages is not None:
                people = (
                    [BookingGuest.objects.create(booking=instance, **c) for c in companions]
                    if companions is not None else list(instance.companions.all())
                )
                self._save_payments(instance, people, payments or [])
                self._save_packages(instance, people, packages or [])
        _clear_prefetch(instance)
        return instance


class RoomChangeSerializer(serializers.Serializer):
    """A room move on a live booking. `option` settles the price difference on the
    unused nights — switch (same rate); refund, extend or voucher when the new
    room is cheaper; topup, shorten or split when it costs more."""

    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all())
    option = serializers.ChoiceField(choices=[
        "switch", "refund", "extend", "voucher", "topup", "shorten", "split",
    ])
    # `split` only — how many of the remaining nights to keep in the new room.
    nights = serializers.IntegerField(required=False, min_value=1)
    # Money movement — the channel a top-up comes in or a refund leaves through.
    method = serializers.ChoiceField(choices=MONEY_METHODS, required=False)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class CancelBookingSerializer(serializers.Serializer):
    """What happens to money already collected when a booking is cancelled —
    'refund' hands the paid balance back through a channel (the till must be
    open), 'voucher' turns it into a credit voucher the guest redeems on a
    future stay; 'keep' leaves it on record as a refund due."""

    settle = serializers.ChoiceField(choices=["keep", "refund", "voucher"], required=False, default="keep")
    method = serializers.ChoiceField(choices=MONEY_METHODS, required=False)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class PayBookingSerializer(serializers.Serializer):
    """A top-up on a live booking — one new payment row. `extend_nights` also
    buys extra nights on the same room when it's free past checkout."""

    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=MONEY_METHODS)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)
    # When the money actually moved — blank means it was paid as it was recorded.
    paid_at = serializers.DateTimeField(required=False, allow_null=True)
    # Buy extra nights on the same room — the payment covers the extension.
    extend_nights = serializers.IntegerField(required=False, min_value=1, max_value=365)


class AddPackageSerializer(serializers.Serializer):
    """Sell an extra package on a live booking — the catalogue name/price snapshot
    onto a BookingPackage row. `guest` is the same party-position key payments use.
    Send `method` to collect the price in the same call; without it the package
    just goes on the bill."""

    package = serializers.PrimaryKeyRelatedField(queryset=ExtraPackage.objects.all())
    guest = serializers.IntegerField(required=False, default=0, min_value=0)
    method = serializers.ChoiceField(choices=MONEY_METHODS, required=False)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class ClientProfileSerializer(serializers.Serializer):
    """A client profile edit — the guest fields live on their bookings, so the
    update fans out to every booking under the same client key. `status`
    suspends or reinstates the client for new bookings."""

    guest_name = serializers.CharField(required=False, max_length=120)
    guest_phone = serializers.CharField(required=False, max_length=20)
    guest_email = serializers.EmailField(required=False, allow_blank=True)
    guest_id_type = serializers.ChoiceField(choices=Booking.IdType.choices, required=False, allow_blank=True)
    guest_id_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    guest_nationality = serializers.CharField(required=False, allow_blank=True, max_length=60)
    guest_notes = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=["active", "suspended"], required=False)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=160)

    def validate_guest_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("The guest's name is required.")
        return value

    def validate_guest_phone(self, value):
        value = _normalize_phone(value)
        if not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_guest_email(self, value):
        return value.strip().lower()

    def validate_guest_id_number(self, value):
        return value.strip()

    def validate_guest_nationality(self, value):
        return value.strip()

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError({"detail": "Nothing to change."})
        # An ID number without a document type defaults to a national ID.
        if attrs.get("guest_id_number") and "guest_id_type" not in attrs:
            attrs["guest_id_type"] = Booking.IdType.NATIONAL_ID
        return attrs


MAX_TICKET_FILES = 10
MAX_TICKET_FILE_BYTES = 10 * 1024 * 1024


class TicketAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = ["id", "url", "name", "created_at"]
        read_only_fields = fields

    def get_url(self, obj):
        return obj.file.url if obj.file else None


class TicketItemSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=160)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))

    class Meta:
        model = TicketItem
        fields = ["id", "name", "price"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the item a name.")
        return value


class TicketSerializer(serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all(), required=False, allow_null=True)
    room_name = serializers.CharField(source="room.name", read_only=True, default=None)
    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all(), required=False, allow_null=True)
    guest_name = serializers.CharField(source="booking.guest_name", read_only=True, default=None)
    category = serializers.ChoiceField(choices=Ticket.Category.choices, required=False)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status = serializers.ChoiceField(choices=Ticket.Status.choices, required=False)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    source = serializers.ChoiceField(choices=Ticket.Source.choices, required=False)
    source_label = serializers.CharField(source="get_source_display", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.get_full_name", read_only=True, default=None)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True, default=None)
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    # Write-only attachment management: `new_files` are uploads to add;
    # `remove_files` is comma-separated attachment ids to delete.
    new_files = serializers.ListField(
        child=serializers.FileField(), write_only=True, required=False, max_length=MAX_TICKET_FILES
    )
    remove_files = serializers.CharField(write_only=True, required=False, allow_blank=True)
    # Parts/materials used to resolve the ticket — send the full list to replace the old one.
    items = TicketItemSerializer(many=True, required=False)
    items_total = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "number", "branch", "branch_name", "title", "description",
            "category", "category_label", "priority", "priority_label", "status", "status_label",
            "room", "room_name", "location", "booking", "guest_name",
            "reported_by_name", "reporter_name", "source", "source_label",
            "assigned_to", "assigned_to_name", "assignee_name",
            "due", "supplier_name", "supplier_phone", "started_on",
            "hold_reason", "held_on", "labour_cost", "payment_ref",
            "reopen_reason", "reopened_on", "resolved_at",
            "items", "items_total", "attachments", "new_files", "remove_files", "created_at",
        ]
        read_only_fields = ["id", "number", "resolved_at", "created_at"]

    def get_items_total(self, obj):
        return sum((i.price for i in obj.items.all()), Decimal("0"))

    def to_internal_value(self, data):
        # Multipart submissions can't nest objects — `items` arrives as a JSON string.
        if isinstance(data.get("items"), str):
            data = data.copy()
            try:
                data["items"] = json.loads(data["items"])
            except ValueError:
                raise serializers.ValidationError({"items": "Send a list of {name, price} objects."})
        return super().to_internal_value(data)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the ticket a title.")
        return value

    def validate_location(self, value):
        return value.strip()

    def validate_reporter_name(self, value):
        return value.strip()

    def validate_assignee_name(self, value):
        return value.strip()

    def validate_supplier_name(self, value):
        return value.strip()

    def validate_supplier_phone(self, value):
        return value.strip()

    def validate_hold_reason(self, value):
        return value.strip()

    def validate_payment_ref(self, value):
        return value.strip()

    def validate_reopen_reason(self, value):
        return value.strip()

    def _remove_ids(self, raw):
        ids = set()
        for part in (raw or "").split(","):
            part = part.strip()
            if part.isdigit():
                ids.add(int(part))
            elif part:
                raise serializers.ValidationError({"remove_files": "Send comma-separated attachment ids."})
        return ids

    def validate(self, attrs):
        user_branch = self.context.get("user_branch")
        if self.instance:
            branch = self.instance.branch if user_branch else (attrs.get("branch") or self.instance.branch)
        else:
            branch = user_branch or attrs.get("branch")

        room = attrs.get("room", getattr(self.instance, "room", None))
        if room and branch and room.branch_id != branch.id:
            raise serializers.ValidationError({"room": "That room doesn't belong to this branch."})
        booking = attrs.get("booking", getattr(self.instance, "booking", None))
        if booking and branch and booking.branch_id != branch.id:
            raise serializers.ValidationError({"booking": "That booking doesn't belong to this branch."})

        # Handing the ticket to someone — a staff member or an external contractor —
        # is restricted to the branch manager and receptionist (and Admin/IT Support).
        request = self.context["request"]
        if ("assigned_to" in attrs or "assignee_name" in attrs) and request.user.role not in TICKET_ASSIGN_ROLES:
            raise serializers.ValidationError(
                {"assigned_to": "Only the branch manager or receptionist can allocate a ticket."}
            )
        assigned_to = attrs.get("assigned_to", getattr(self.instance, "assigned_to", None))
        if assigned_to and not assigned_to.can_sign_in:
            raise serializers.ValidationError({"assigned_to": "That staff account isn't active."})
        if assigned_to and branch and assigned_to.branch_id and assigned_to.branch_id != branch.id:
            raise serializers.ValidationError({"assigned_to": "That employee doesn't work at this branch."})
        assignee_name = attrs.get("assignee_name", getattr(self.instance, "assignee_name", ""))
        if assigned_to and assignee_name:
            raise serializers.ValidationError({"assignee_name": "Assign to a staff member or a contractor, not both."})

        new_files = attrs.get("new_files") or []
        for f in new_files:
            if f.size > MAX_TICKET_FILE_BYTES:
                raise serializers.ValidationError({"new_files": "Each attachment must be smaller than 10 MB."})
        removes = self._remove_ids(attrs.get("remove_files", ""))
        if removes:
            owned = set(self.instance.attachments.filter(id__in=removes).values_list("id", flat=True)) if self.instance else set()
            if owned != removes:
                raise serializers.ValidationError({"remove_files": "One of those files doesn't belong to this ticket."})
        keep = (self.instance.attachments.count() - len(removes)) if self.instance else 0
        if keep + len(new_files) > MAX_TICKET_FILES:
            raise serializers.ValidationError({"new_files": f"A ticket can have at most {MAX_TICKET_FILES} attachments."})

        # Handing a new ticket straight to someone marks it Assigned, unless a status was sent.
        if self.instance is None and (assigned_to or attrs.get("assignee_name")):
            attrs.setdefault("status", Ticket.Status.ASSIGNED)
        return attrs

    def _save_items(self, ticket, items):
        """`None` leaves the rows alone; a list replaces them all."""
        if items is None:
            return
        ticket.items.all().delete()
        for item in items:
            TicketItem.objects.create(ticket=ticket, **item)

    def create(self, validated_data):
        files = validated_data.pop("new_files", [])
        items = validated_data.pop("items", None)
        validated_data.pop("remove_files", "")
        ticket = Ticket.objects.create(**validated_data)
        if ticket.status in Ticket.DONE_STATUSES:
            ticket.resolved_at = timezone.now()
            ticket.save(update_fields=["resolved_at"])
        self._save_items(ticket, items)
        for f in files:
            TicketAttachment.objects.create(ticket=ticket, file=f, name=getattr(f, "name", "")[:160])
        return ticket

    def update(self, instance, validated_data):
        files = validated_data.pop("new_files", [])
        items = validated_data.pop("items", None)
        removes = self._remove_ids(validated_data.pop("remove_files", ""))
        was_done = instance.status in Ticket.DONE_STATUSES
        for key, value in validated_data.items():
            setattr(instance, key, value)
        now_done = instance.status in Ticket.DONE_STATUSES
        if now_done and not was_done:
            instance.resolved_at = timezone.now()
        elif was_done and not now_done:
            instance.resolved_at = None
        instance.save()
        self._save_items(instance, items)
        for a in instance.attachments.filter(id__in=removes):
            a.delete()
        for f in files:
            TicketAttachment.objects.create(ticket=instance, file=f, name=getattr(f, "name", "")[:160])
        _clear_prefetch(instance)
        return instance


class ExpenseSerializer(serializers.ModelSerializer):
    """A branch expense — category, name, amount, who it was given to and its
    payment status. Branch staff record these from Accounts → Register expenses."""

    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    session = serializers.PrimaryKeyRelatedField(read_only=True)
    category = serializers.ChoiceField(choices=Expense.Category.choices, required=False)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    payment_status = serializers.ChoiceField(choices=Expense.PaymentStatus.choices, required=False)
    payment_status_label = serializers.CharField(source="get_payment_status_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Expense
        fields = [
            "id", "branch", "branch_name", "session", "category", "category_label",
            "name", "amount", "supplier_name", "supplier_phone",
            "payment_status", "payment_status_label",
            "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the expense a name.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount must be more than zero.")
        return value

    def validate_supplier_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the supplier's name.")
        return value

    def validate_supplier_phone(self, value):
        value = _normalize_phone(value)
        if value and not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value


class SupplierSerializer(serializers.ModelSerializer):
    """A supplier/payee for autocomplete — registered automatically by expense
    and stock-purchase records."""

    class Meta:
        model = Supplier
        fields = ["id", "name", "phone"]


class StockPurchaseSerializer(serializers.ModelSerializer):
    """A stock purchase from an outside supplier — supplier contact, the supplied
    item, its buying price and the payment status."""

    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    session = serializers.PrimaryKeyRelatedField(read_only=True)
    payment_status = serializers.ChoiceField(choices=StockPurchase.PaymentStatus.choices, required=False)
    payment_status_label = serializers.CharField(source="get_payment_status_display", read_only=True)
    total = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = StockPurchase
        fields = [
            "id", "branch", "branch_name", "session", "supplier_name", "supplier_phone",
            "item", "quantity", "unit_price", "total",
            "payment_status", "payment_status_label",
            "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_total(self, obj):
        return str(obj.unit_price * obj.quantity)

    def validate_supplier_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the supplier's name.")
        return value

    def validate_supplier_phone(self, value):
        value = _normalize_phone(value)
        if value and not _valid_phone(value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_item(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name the supplied item.")
        return value

    def validate_quantity(self, value):
        if not 1 <= value <= 100000:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("The buying price can't be negative.")
        return value


class TillDrawingSerializer(serializers.ModelSerializer):
    """Money taken out of the till — amount, reason and who it went to."""

    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = TillDrawing
        fields = ["id", "method", "amount", "reason", "given_to", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount must be more than zero.")
        return value

    def validate_reason(self, value):
        return value.strip()

    def validate_given_to(self, value):
        return value.strip()


class TillSessionSerializer(serializers.ModelSerializer):
    """A till session with its report computed: payments taken per channel in
    the session window, drawings out, expected channel totals and the
    over/short against each counted close."""

    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False, allow_null=True, default=_UserBranchDefault()
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    status = serializers.SerializerMethodField()
    opened_by = serializers.PrimaryKeyRelatedField(read_only=True)
    opened_by_name = serializers.CharField(source="opened_by.get_full_name", read_only=True, default=None)
    closed_by_name = serializers.CharField(source="closed_by.get_full_name", read_only=True, default=None)
    drawings = TillDrawingSerializer(many=True, read_only=True)
    drawings_total = serializers.SerializerMethodField()
    drawings_cash = serializers.SerializerMethodField()
    drawings_mpesa = serializers.SerializerMethodField()
    drawings_card = serializers.SerializerMethodField()
    cash_in = serializers.SerializerMethodField()
    cash_in_count = serializers.SerializerMethodField()
    mpesa_in = serializers.SerializerMethodField()
    mpesa_in_count = serializers.SerializerMethodField()
    card_in = serializers.SerializerMethodField()
    card_in_count = serializers.SerializerMethodField()
    expected = serializers.SerializerMethodField()
    expected_mpesa = serializers.SerializerMethodField()
    expected_card = serializers.SerializerMethodField()
    over_short = serializers.SerializerMethodField()
    over_short_mpesa = serializers.SerializerMethodField()
    over_short_card = serializers.SerializerMethodField()

    class Meta:
        model = TillSession
        fields = [
            "id", "branch", "branch_name", "status",
            "opened_by", "opened_by_name", "opened_at", "opening_float", "opening_mpesa", "opening_card", "note",
            "closed_by_name", "closed_at", "closing_count", "closing_mpesa", "closing_card", "closing_note",
            "drawings", "drawings_total", "drawings_cash", "drawings_mpesa", "drawings_card",
            "cash_in", "cash_in_count", "mpesa_in", "mpesa_in_count", "card_in", "card_in_count",
            "expected", "expected_mpesa", "expected_card",
            "over_short", "over_short_mpesa", "over_short_card",
        ]
        read_only_fields = ["id", "opened_at", "closed_at"]

    def _payments(self, obj, method):
        """Booking payments of one method received inside the session window —
        each channel's balance only sees its own payments (bank/other don't
        flow through the till)."""
        end = obj.closed_at or timezone.now()
        return BookingPayment.objects.filter(
            booking__branch=obj.branch,
            method=method,
            created_at__gte=obj.opened_at,
            created_at__lt=end,
        )

    def get_status(self, obj):
        return "closed" if obj.closed_at else "open"

    def get_drawings_total(self, obj):
        return str(sum((d.amount for d in obj.drawings.all()), Decimal(0)))

    def _drawings_channel(self, obj, method):
        return sum((d.amount for d in obj.drawings.all() if d.method == method), Decimal(0))

    def get_drawings_cash(self, obj):
        return str(self._drawings_channel(obj, TillDrawing.Method.CASH))

    def get_drawings_mpesa(self, obj):
        return str(self._drawings_channel(obj, TillDrawing.Method.MPESA))

    def get_drawings_card(self, obj):
        return str(self._drawings_channel(obj, TillDrawing.Method.VISA))

    def _channel_total(self, obj, channel, method):
        """One channel's payments-in total. The list queryset annotates the
        `_cash_in`/`_mpesa_in`/`_card_in` subqueries — instances built outside
        it (open/close responses) fall back to asking the DB."""
        attr = f"_{channel}_in"
        if hasattr(obj, attr):
            return Decimal(getattr(obj, attr))
        return self._payments(obj, method).aggregate(s=Sum("amount"))["s"] or Decimal(0)

    def _channel_count(self, obj, channel, method):
        attr = f"_{channel}_in_count"
        if hasattr(obj, attr):
            return int(getattr(obj, attr))
        return self._payments(obj, method).count()

    def get_cash_in(self, obj):
        return str(self._channel_total(obj, "cash", BookingPayment.Method.CASH))

    def get_cash_in_count(self, obj):
        return self._channel_count(obj, "cash", BookingPayment.Method.CASH)

    def get_mpesa_in(self, obj):
        return str(self._channel_total(obj, "mpesa", BookingPayment.Method.MPESA))

    def get_mpesa_in_count(self, obj):
        return self._channel_count(obj, "mpesa", BookingPayment.Method.MPESA)

    def get_card_in(self, obj):
        return str(self._channel_total(obj, "card", BookingPayment.Method.VISA))

    def get_card_in_count(self, obj):
        return self._channel_count(obj, "card", BookingPayment.Method.VISA)

    def _expected(self, obj):
        """The drawer only holds cash — M-Pesa/card drawings don't touch it."""
        return obj.opening_float + self._channel_total(obj, "cash", BookingPayment.Method.CASH) - Decimal(self.get_drawings_cash(obj))

    def _expected_mpesa(self, obj):
        return obj.opening_mpesa + self._channel_total(obj, "mpesa", BookingPayment.Method.MPESA) - Decimal(self.get_drawings_mpesa(obj))

    def _expected_card(self, obj):
        return obj.opening_card + self._channel_total(obj, "card", BookingPayment.Method.VISA) - Decimal(self.get_drawings_card(obj))

    def get_expected(self, obj):
        return str(self._expected(obj))

    def get_expected_mpesa(self, obj):
        return str(self._expected_mpesa(obj))

    def get_expected_card(self, obj):
        return str(self._expected_card(obj))

    @staticmethod
    def _diff(counted, expected):
        """Counted minus expected — positive is over, negative is short."""
        if counted is None:
            return None
        return str(counted - expected)

    def get_over_short(self, obj):
        if obj.closed_at is None:
            return None
        return self._diff(obj.closing_count, self._expected(obj))

    def get_over_short_mpesa(self, obj):
        if obj.closed_at is None:
            return None
        return self._diff(obj.closing_mpesa, self._expected_mpesa(obj))

    def get_over_short_card(self, obj):
        if obj.closed_at is None:
            return None
        return self._diff(obj.closing_card, self._expected_card(obj))

    def validate_opening_float(self, value):
        if value < 0:
            raise serializers.ValidationError("The opening float can't be negative.")
        return value

    def validate_opening_mpesa(self, value):
        if value < 0:
            raise serializers.ValidationError("The opening M-Pesa can't be negative.")
        return value

    def validate_opening_card(self, value):
        if value < 0:
            raise serializers.ValidationError("The opening credit card can't be negative.")
        return value

    def validate_note(self, value):
        return value.strip()

    def validate_closing_note(self, value):
        return value.strip()


class TillCloseSerializer(serializers.Serializer):
    """Body of the close-till action — each channel's counted total."""

    closing_count = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    closing_mpesa = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True)
    closing_card = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True)
    closing_note = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_closing_note(self, value):
        return value.strip()
