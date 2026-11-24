import re

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import six_digit_code

from .models import Booking, BookingGuest, BookingPayment, Branch, Room, RoomPhoto

MAX_PHOTO_BYTES = 3 * 1024 * 1024
PIN_RE = re.compile(r"\d{6}")


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
        value = value.strip()
        digits = value.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 9 <= len(digits) <= 15:
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
            "capacity", "price", "description", "status", "status_label", "status_reason",
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
                  "nationality", "notes", "room", "room_name", "start", "end"]
        read_only_fields = ["id", "room_name"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Each guest's name is required.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if not value:
            return value
        digits = value.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 9 <= len(digits) <= 15:
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
                  "reference", "created_at"]
        read_only_fields = ["id", "companion", "payer", "method_label", "created_at"]

    def get_payer(self, obj):
        return obj.companion.name if obj.companion_id else obj.booking.guest_name

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount must be more than zero.")
        return value

    def validate_reference(self, value):
        return value.strip()


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
    nights = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Booking
        fields = [
            "id", "branch", "branch_name", "room", "room_name",
            "guest_name", "guest_phone", "guest_email",
            "guest_id_type", "guest_id_type_label", "guest_id_number",
            "guest_nationality", "guests", "guest_notes", "companions", "payments",
            "kind", "kind_label", "status", "status_label",
            "start", "end", "nights", "deposit",
            "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_nights(self, obj):
        from math import ceil
        return max(1, ceil((obj.end - obj.start).total_seconds() / 86400))

    def validate_guest_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("The guest's name is required.")
        return value

    def validate_guest_phone(self, value):
        value = value.strip()
        digits = value.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 9 <= len(digits) <= 15:
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
        if room and start and end:
            clash = Booking.objects.filter(
                room=room, status__in=[Booking.Status.RESERVED, Booking.Status.OCCUPIED],
                start__lt=end, end__gt=start,
            )
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            other = clash.select_related("room").first()
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
            if c_start and c_end:
                clash = Booking.objects.filter(
                    room=r, status__in=[Booking.Status.RESERVED, Booking.Status.OCCUPIED],
                    start__lt=c_end, end__gt=c_start,
                )
                if self.instance:
                    clash = clash.exclude(pk=self.instance.pk)
                other = clash.select_related("room").first()
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

        # Status follows the booking kind on create unless a valid live status was sent.
        if self.instance is None:
            kind = attrs.get("kind", Booking.Kind.RESERVATION)
            default = Booking.Status.OCCUPIED if kind == Booking.Kind.STAY else Booking.Status.RESERVED
            sent = attrs.get("status")
            attrs["status"] = sent if sent in Booking.ACTIVE_STATUSES else default
        return attrs

    @staticmethod
    def _save_payments(booking, people, payments):
        """Writes payments against `people` — the party list. `guest` on a payment is its
        party position: 0 = main guest, n = people[n-1]."""
        for p in payments:
            gi = p.pop("guest", 0)
            p["companion"] = people[gi - 1] if gi else None
        BookingPayment.objects.bulk_create(BookingPayment(booking=booking, **p) for p in payments)

    def create(self, validated_data):
        companions = validated_data.pop("companions", [])
        payments = validated_data.pop("payments", [])
        booking = Booking.objects.create(**validated_data)
        people = [BookingGuest.objects.create(booking=booking, **c) for c in companions]
        self._save_payments(booking, people, payments)
        return booking

    def update(self, instance, validated_data):
        companions = validated_data.pop("companions", None)
        payments = validated_data.pop("payments", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        # When companions or payments are sent, the whole list is replaced — payment
        # guests map onto the party that results (new or existing).
        if companions is not None:
            instance.companions.all().delete()
        if payments is not None:
            instance.payments.all().delete()
        if companions is not None or payments is not None:
            people = (
                [BookingGuest.objects.create(booking=instance, **c) for c in companions]
                if companions is not None else list(instance.companions.all())
            )
            self._save_payments(instance, people, payments or [])
        return instance
