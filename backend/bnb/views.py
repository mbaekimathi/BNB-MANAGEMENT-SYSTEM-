from datetime import datetime, timedelta
from decimal import Decimal
from math import ceil

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import BooleanField, Case, CharField, Count, DecimalField, Exists, ExpressionWrapper, F, Func, IntegerField, Max, Min, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Ceil, Coalesce, Concat, Greatest, Lower, Replace, Trim
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import mixins, parsers, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, six_digit_code
from hr.models import Attendance

from .models import Booking, BookingPackage, BookingPayment, Branch, ClientSuspension, Expense, ExtraPackage, Referral, Room, StockPurchase, Supplier, Ticket, TillSession, Voucher
from .permissions import BNB_ROLES, CanManageAccounts, CanManageBookings, CanManageBranchProfile, CanManagePackages, CanManageRooms, CanManageTickets, IsBnBStaff, TillOwnerWriteOnly
from .serializers import AddPackageSerializer, BookingSerializer, BranchProfileSerializer, BranchSerializer, ClientProfileSerializer, ExpenseSerializer, ExtraPackageSerializer, PayBookingSerializer, ReferralSerializer, RoomChangeSerializer, RoomSerializer, StockPurchaseSerializer, SupplierSerializer, TicketSerializer, TillCloseSerializer, TillDrawingSerializer, TillSessionSerializer, _clear_prefetch, _client_key_of, _lock_rooms, _room_clash

MAX_LIST_LIMIT = 500


def _limit(request, qs):
    """`?limit=N` caps a list at the newest N rows (server-side cap 500) so boards
    can ask for a bounded slice instead of the whole table."""
    raw = request.query_params.get("limit")
    if not raw:
        return qs
    try:
        n = int(raw)
    except ValueError:
        raise serializers.ValidationError({"limit": "Send a whole number."})
    return qs[: max(1, min(n, MAX_LIST_LIMIT))]


_MONEY = DecimalField(max_digits=14, decimal_places=2)


def _parse_dt(raw):
    """An ISO datetime or date; bare dates land at local midnight."""
    if not raw:
        return None
    dt = parse_datetime(raw)
    if dt is None:
        d = parse_date(raw)
        if d is None:
            raise serializers.ValidationError({"from": "Send ISO dates or datetimes."})
        return timezone.make_aware(datetime(d.year, d.month, d.day))
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def _booking_nights():
    """`max(1, ceil(seconds/86400))` — the serializer's `nights` as a SQL expression."""
    seconds = Func(
        F("start"), F("end"),
        function="TIMESTAMPDIFF",
        template="%(function)s(SECOND, %(expressions)s)",
        output_field=IntegerField(),
    )
    return Greatest(Value(1), Ceil(seconds / 86400), output_field=IntegerField())


def _phone_digits():
    """Phone stripped to digits — client keys normalise numbers the same way."""
    return Func(F("guest_phone"), Value("[^0-9]"), Value(""), function="REGEXP_REPLACE", output_field=CharField())


def _client_key():
    """Groups a guest's bookings into one client — mirrors `clientKey` in the app:
    ID number is strongest, then phone digits, email, name. '/' → '_' keeps keys URL-safe.
    Needs a `_phone_digits` annotation in place first."""
    esc = lambda f: Replace(Lower(Trim(f)), Value("/"), Value("_"))
    return Case(
        When(~Q(guest_id_number=""), then=Concat(Value("id:"), esc("guest_id_number"))),
        When(~Q(_phone_digits=""), then=Concat(Value("ph:"), F("_phone_digits"))),
        When(~Q(guest_email=""), then=Concat(Value("em:"), esc("guest_email"))),
        default=Concat(Value("nm:"), esc("guest_name")),
        output_field=CharField(),
    )


class BranchViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsBnBStaff]
    serializer_class = BranchSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    queryset = Branch.objects.all()

    @action(detail=False, methods=["get"], url_path="code-check")
    def code_check(self, request):
        """Live availability check — branch codes are stored on Branch only, never on employee accounts."""
        code = request.query_params.get("code", "")
        try:
            six_digit_code(code)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"code": code, "available": not Branch.objects.filter(code=code).exists()})


class BranchProfileView(APIView):
    """The caller's own branch profile — details, payment methods and guest
    messaging. Branch staff read it; the branch manager (and Admin/IT Support)
    edits it. Company roles pass ?branch=<id> to pick which branch."""

    permission_classes = [CanManageBranchProfile]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def _branch(self, request):
        user = request.user
        if user.role in BNB_ROLES:
            branch_id = request.query_params.get("branch")
            if not branch_id:
                raise serializers.ValidationError({"branch": "Pick a branch."})
            branch = Branch.objects.filter(pk=branch_id).first()
            if branch is None:
                raise NotFound("That branch doesn't exist.")
            return branch
        if user.branch_id is None:
            raise serializers.ValidationError({"detail": "Your account isn't allocated to a branch yet."})
        return user.branch

    def get(self, request):
        return Response(BranchProfileSerializer(self._branch(request)).data)

    def patch(self, request):
        serializer = BranchProfileSerializer(self._branch(request), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(BranchProfileSerializer(serializer.save()).data)


class RoomViewSet(viewsets.ModelViewSet):
    """Rooms are scoped to the caller's branch; Admin/IT Support see every room."""

    permission_classes = [CanManageRooms]
    serializer_class = RoomSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Room.objects.select_related("branch").prefetch_related("photos")
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            return qs
        return qs.filter(branch=user.branch)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get("branch") if user.role in BNB_ROLES else user.branch
        if branch is None:
            detail = "Pick a branch for this room." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        serializer.save(branch=branch)

    def perform_update(self, serializer):
        # Branch roles can't move a room to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        serializer.save()


class PackageViewSet(viewsets.ModelViewSet):
    """Extra packages are scoped to the caller's branch; Admin/IT Support see every package."""

    permission_classes = [CanManagePackages]
    serializer_class = ExtraPackageSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = ExtraPackage.objects.select_related("branch")
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            return qs
        return qs.filter(branch=user.branch)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get("branch") if user.role in BNB_ROLES else user.branch
        if branch is None:
            detail = "Pick a branch for this package." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        serializer.save(branch=branch)

    def perform_update(self, serializer):
        # Branch roles can't move a package to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        serializer.save()


class BookingViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Bookings are scoped to the caller's branch; Admin/IT Support see every booking."""

    permission_classes = [CanManageBookings, TillOwnerWriteOnly]
    serializer_class = BookingSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related("branch", "room", "created_by", "referral").prefetch_related(
            "companions", "companions__room", "payments__companion", "vouchers",
            "extra_packages__companion", "extra_packages__package",
        )
        params = self.request.query_params
        if user.role in BNB_ROLES:
            if branch := params.get("branch"):
                qs = qs.filter(branch_id=branch)
        else:
            qs = qs.filter(branch=user.branch)
        # Filters all roles can use to keep list payloads small: `active` = live
        # bookings only, `status` = comma list, `kind`, `end_from` = stays not yet
        # ended (recent history without the whole table).
        if params.get("active"):
            qs = qs.filter(status__in=Booking.ACTIVE_STATUSES)
        elif statuses := params.get("status"):
            qs = qs.filter(status__in=statuses.split(","))
        if kind := params.get("kind"):
            qs = qs.filter(kind=kind)
        if end_from := params.get("end_from"):
            qs = qs.filter(end__gte=end_from)
        if room := params.get("room"):
            qs = qs.filter(room_id=room)
        if client := params.get("client"):
            # One client's bookings — the rollup key (e.g. "ph:2547…") the
            # clients directory assigns, matched against the same expression.
            qs = qs.annotate(_phone_digits=_phone_digits()).annotate(_key=_client_key()).filter(_key=client)
        return _limit(self.request, qs) if self.action == "list" else qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def _till_open(self, branch):
        return TillSession.objects.filter(branch=branch, closed_at__isnull=True).exists()

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get("branch") if user.role in BNB_ROLES else user.branch
        if branch is None:
            detail = "Pick a branch for this booking." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        # Checking a client in (stay / day rest) needs an open till so the money
        # lands inside a session. A plain reservation can be taken with the till
        # closed — but a deposit or payment on it can't be collected.
        till_open = self._till_open(branch)
        kind = serializer.validated_data.get("kind", Booking.Kind.RESERVATION)
        if kind != Booking.Kind.RESERVATION and not till_open:
            raise serializers.ValidationError({"detail": "The till is closed — open it on the Counter page before registering a client."})
        collecting = bool(serializer.validated_data.get("deposit")) or bool(serializer.validated_data.get("payments"))
        if collecting and not till_open:
            raise serializers.ValidationError({"detail": "The till is closed — open it on the Counter page before collecting a deposit or payment."})
        serializer.save(branch=branch, created_by=user)

    def perform_update(self, serializer):
        # Branch roles can't move a booking to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        # New money via PATCH (a bigger deposit or a payments list) also needs an open till.
        vd = serializer.validated_data
        collecting = bool(vd.get("payments")) or (vd.get("deposit") or 0) > (serializer.instance.deposit or 0)
        if collecting and not self._till_open(serializer.instance.branch):
            raise serializers.ValidationError({"detail": "The till is closed — open it on the Counter page before collecting a deposit or payment."})
        serializer.save()

    def _transition(self, request, allowed, new_status):
        # Lock the row so a check-in and a cancel hitting at once can't both succeed.
        with transaction.atomic():
            booking = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(request, booking)
            if booking.status not in allowed:
                raise serializers.ValidationError({"detail": f"This booking is {booking.get_status_display().lower()}."})
            booking.status = new_status
            booking.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def checkin(self, request, pk=None):
        """A reservation's guest arrived — the room is now occupied."""
        return self._transition(request, [Booking.Status.RESERVED], Booking.Status.OCCUPIED)

    @action(detail=True, methods=["post"])
    def checkout(self, request, pk=None):
        """The guest left — the stay is completed and the room frees up."""
        return self._transition(request, [Booking.Status.RESERVED, Booking.Status.OCCUPIED], Booking.Status.COMPLETED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(request, [Booking.Status.RESERVED, Booking.Status.OCCUPIED], Booking.Status.CANCELLED)

    @action(detail=True, methods=["post"], url_path="change-room")
    def change_room(self, request, pk=None):
        """Move a live booking to another room. Only the unused nights reprice:
        credit = nights left × the current rate, cost = nights left × the new
        rate; `option` settles the difference — a straight swap, refund /
        extend / voucher on a downgrade, top-up / shorten / split on an
        upgrade."""
        ser = RoomChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        now = timezone.now()
        with transaction.atomic():
            booking = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(request, booking)
            if booking.status not in Booking.ACTIVE_STATUSES:
                raise serializers.ValidationError(
                    {"detail": f"This booking is {booking.get_status_display().lower()} — only live stays can change rooms."}
                )

            room = vd["room"]
            if room.pk == booking.room_id:
                raise serializers.ValidationError({"room": f"The guest is already in {room.name}."})
            if room.branch_id != booking.branch_id:
                raise serializers.ValidationError({"room": "That room doesn't belong to this branch."})
            if room.status != Room.Status.ACTIVE:
                raise serializers.ValidationError(
                    {"room": f"{room.name} is {room.get_status_display().lower()} and can't be booked."}
                )
            if booking.companions.filter(room=room).exists():
                raise serializers.ValidationError(
                    {"room": f"A guest on this booking already holds {room.name}."}
                )

            # Only future nights move — nights already slept stay on the old room.
            nights_total = max(1, ceil((booking.end - booking.start).total_seconds() / 86400))
            nights_left = (
                nights_total if now <= booking.start
                else max(0, ceil((booking.end - now).total_seconds() / 86400))
            )
            if nights_left < 1:
                raise serializers.ValidationError({"detail": "This stay has ended — there's nothing left to change."})

            credit = nights_left * booking.room.price
            cost = nights_left * room.price
            diff = credit - cost  # + money owed back to the guest · − shortfall to collect
            option = vd["option"]
            if diff == 0 and option != "switch":
                raise serializers.ValidationError({"option": "The rooms cost the same — just switch."})
            if diff > 0 and option not in ("refund", "extend", "voucher"):
                raise serializers.ValidationError(
                    {"option": "The new room is cheaper — refund the balance, extend the stay, or take a voucher."}
                )
            if diff < 0 and option not in ("topup", "shorten", "split"):
                raise serializers.ValidationError(
                    {"option": "The new room costs more — top up, shorten the stay, or combine both."}
                )

            method, ref = vd.get("method"), (vd.get("reference") or "").strip()
            pay_amt = Decimal(0)  # + collected from the guest · − refunded to them
            voucher_amt, extra, kept, leftover = None, 0, nights_left, Decimal(0)
            new_end = booking.end

            if option == "refund":
                pay_amt = -diff
            elif option == "voucher":
                voucher_amt = diff
            elif option == "extend":
                extra = int(diff // room.price)
                if extra < 1:
                    raise serializers.ValidationError(
                        {"option": f"The balance can't buy a single extra night in {room.name} — refund it or take a voucher."}
                    )
                leftover = diff - extra * room.price
                new_end = booking.end + timedelta(days=extra)
            elif option == "topup":
                pay_amt = -diff
            elif option == "shorten":
                kept = int(credit // room.price)
                if kept < 1:
                    raise serializers.ValidationError(
                        {"option": f"The credit doesn't cover a single night in {room.name} — pick another room."}
                    )
                leftover = credit - kept * room.price
                new_end = booking.end - timedelta(days=nights_left - kept)
            elif option == "split":
                kept = vd.get("nights")
                if kept is None or kept > nights_left:
                    raise serializers.ValidationError(
                        {"nights": f"Keep between 1 and {nights_left} nights in the new room."}
                    )
                top = kept * room.price - credit
                if top > 0:
                    pay_amt = top
                else:
                    leftover = -top
                new_end = booking.end - timedelta(days=nights_left - kept)

            if pay_amt and not method:
                raise serializers.ValidationError({"method": "Pick how the money moves."})
            # Cash in or out lands inside a till session, like every other payment.
            if pay_amt and not self._till_open(booking.branch):
                raise serializers.ValidationError(
                    {"detail": "The till is closed — open it on the Counter page first."}
                )

            # Lock the new room, then re-check it's free over the final window —
            # from now (or the move-in, for a stay not started) to the new end.
            change_from = max(now, booking.start)
            _lock_rooms({room.pk})
            other = _room_clash(room, change_from, new_end, booking.pk)
            if other:
                raise serializers.ValidationError(
                    {"room": f"{room.name} is already {other.status} for that period ({other.guest_name})."}
                )

            payment = None
            if pay_amt:
                payment = BookingPayment.objects.create(
                    booking=booking, amount=pay_amt, method=method,
                    reference=ref or ("Room change refund" if pay_amt < 0 else "Room change top-up"),
                )
            voucher = None
            if voucher_amt:
                voucher = Voucher.objects.create(
                    branch=booking.branch, booking=booking,
                    amount=voucher_amt, guest_name=booking.guest_name, guest_phone=booking.guest_phone,
                )
            booking.room = room
            booking.end = new_end
            booking.save(update_fields=["room", "end", "updated_at"])

        _clear_prefetch(booking)
        applied = {
            "option": option,
            "nights_left": nights_left,
            "credit": str(credit), "cost": str(cost), "difference": str(diff),
        }
        if pay_amt < 0:
            applied["refund"] = str(-pay_amt)
        if pay_amt > 0:
            applied["topup"] = str(pay_amt)
        if payment:
            applied["receipt"] = payment.receipt_number
        if voucher:
            applied["voucher_code"], applied["voucher_amount"] = voucher.code, str(voucher.amount)
        if extra:
            applied["extra_nights"] = extra
        if kept != nights_left:
            applied["kept_nights"] = kept
        if leftover:
            applied["leftover"] = str(leftover)
        return Response({"booking": self.get_serializer(booking).data, "applied": applied})

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Record a payment on a live booking — a top-up against the bill, or
        extra nights bought on the spot. The money lands in the open till and,
        when `extend_nights` is set and the room stays free, the checkout pushes
        out by that many nights at the room's nightly rate."""
        ser = PayBookingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        with transaction.atomic():
            booking = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(request, booking)
            if booking.status not in Booking.ACTIVE_STATUSES:
                raise serializers.ValidationError(
                    {"detail": f"This booking is {booking.get_status_display().lower()} — only live stays take payments."}
                )
            if not self._till_open(booking.branch):
                raise serializers.ValidationError(
                    {"detail": "The till is closed — open it on the Counter page first."}
                )

            extra = vd.get("extend_nights") or 0
            new_end = booking.end
            cost = Decimal(0)
            if extra:
                if booking.kind == Booking.Kind.DAY_REST:
                    raise serializers.ValidationError(
                        {"extend_nights": "Day rests run on hours — this booking can't stretch by nights."}
                    )
                new_end = booking.end + timedelta(days=extra)
                if new_end <= timezone.now():
                    raise serializers.ValidationError(
                        {"extend_nights": "That wouldn't reach tonight — add more nights or check the guest out."}
                    )
                # Lock the room, then confirm it's free over the extension window.
                _lock_rooms({booking.room_id})
                other = _room_clash(booking.room, booking.end, new_end, booking.pk)
                if other:
                    raise serializers.ValidationError(
                        {"extend_nights": f"{booking.room.name} is already {other.status} after the current checkout ({other.guest_name})."}
                    )
                cost = extra * booking.room.price
                booking.end = new_end
                booking.save(update_fields=["end", "updated_at"])

            payment = BookingPayment.objects.create(
                booking=booking, amount=vd["amount"], method=vd["method"],
                reference=(vd.get("reference") or "").strip() or ("Stay extension" if extra else "Top-up"),
            )

        _clear_prefetch(booking)
        applied = {"amount": str(vd["amount"]), "receipt": payment.receipt_number}
        if extra:
            applied["extra_nights"], applied["cost"] = extra, str(cost)
        return Response({"booking": self.get_serializer(booking).data, "applied": applied})

    @action(detail=True, methods=["post"], url_path="add-package")
    def add_package(self, request, pk=None):
        """Sell an extra package to a guest on a live booking — the catalogue
        name and price snapshot onto the bill. Send `method` to collect the
        money in the same call; it lands in the open till like any payment."""
        ser = AddPackageSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        with transaction.atomic():
            booking = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(request, booking)
            if booking.status not in Booking.ACTIVE_STATUSES:
                raise serializers.ValidationError(
                    {"detail": f"This booking is {booking.get_status_display().lower()} — only live stays take packages."}
                )
            pkg = vd["package"]
            if pkg.branch_id != booking.branch_id:
                raise serializers.ValidationError({"package": f"{pkg.name} doesn't belong to this branch."})
            if pkg.status != ExtraPackage.Status.ACTIVE:
                raise serializers.ValidationError({"package": f"{pkg.name} is suspended and can't be sold."})
            # `guest` is the party position — 0 = main guest, n = companions[n-1].
            companions = list(booking.companions.all())
            gi = vd["guest"]
            if gi > len(companions):
                raise serializers.ValidationError({"guest": "That guest isn't on this booking."})
            companion = companions[gi - 1] if gi else None
            method, ref = vd.get("method"), (vd.get("reference") or "").strip()
            # Collecting money lands inside a till session, like every other payment.
            if method and not self._till_open(booking.branch):
                raise serializers.ValidationError(
                    {"detail": "The till is closed — open it on the Counter page first."}
                )
            BookingPackage.objects.create(
                booking=booking, companion=companion, package=pkg,
                name=pkg.name, amount=pkg.amount,
            )
            payment = None
            if method:
                payment = BookingPayment.objects.create(
                    booking=booking, companion=companion, amount=pkg.amount,
                    method=method, reference=ref or pkg.name,
                )

        _clear_prefetch(booking)
        applied = {"name": pkg.name, "amount": str(pkg.amount)}
        if payment:
            applied["paid"] = str(payment.amount)
            applied["receipt"] = payment.receipt_number
        return Response({"booking": self.get_serializer(booking).data, "applied": applied})

    @action(detail=False, methods=["get"])
    def accounts(self, request):
        """Per-room money rollup — one grouped query instead of serialising the
        whole booking table for the accounts page to sum client-side."""
        day_rest = When(kind=Booking.Kind.DAY_REST, then=Value(0))
        pkg = (
            BookingPackage.objects.filter(booking=OuterRef("pk"))
            .values("booking").annotate(s=Sum("amount")).values("s")
        )
        rows = (
            self.get_queryset()
            .exclude(status=Booking.Status.CANCELLED)
            .annotate(n=_booking_nights())
            .annotate(pkg=Coalesce(Subquery(pkg, output_field=_MONEY), Value(0), output_field=_MONEY))
            .values("room")
            .annotate(
                bookings=Count("id"),
                nights=Sum(Case(day_rest, default=F("n"), output_field=IntegerField())),
                billed=Sum(ExpressionWrapper(F("n") * F("room__price") + F("pkg"), output_field=_MONEY)),
                deposits=Sum(Coalesce(F("deposit"), Value(0), output_field=_MONEY)),
            )
            .order_by("room")
        )
        return Response(list(rows))

    @action(detail=False, methods=["get"])
    def clients(self, request):
        """Per-client rollup — groups bookings by the same client key the app
        assigns, so the directory stays one grouped query at any table size.
        `?from=&to=` (ISO) also returns per-client range stats: a stay is
        "in range" when it overlaps the period at all."""
        pay = (
            BookingPayment.objects.filter(booking=OuterRef("pk"))
            .values("booking")
            .annotate(s=Sum("amount"))
            .values("s")
        )
        pkg = (
            BookingPackage.objects.filter(booking=OuterRef("pk"))
            .values("booking").annotate(s=Sum("amount")).values("s")
        )
        base = self.get_queryset()
        qs = (
            base.annotate(_phone_digits=_phone_digits())
            .annotate(n=_booking_nights())
            .annotate(pay=Coalesce(Subquery(pay, output_field=_MONEY), Value(0), output_field=_MONEY))
            .annotate(pkg=Coalesce(Subquery(pkg, output_field=_MONEY), Value(0), output_field=_MONEY))
            .annotate(key=_client_key())
            .annotate(susp=Exists(ClientSuspension.objects.filter(branch=OuterRef("branch"), key=OuterRef("key"))))
            .annotate(susp_reason=Subquery(
                ClientSuspension.objects.filter(branch=OuterRef("branch"), key=OuterRef("key")).values("reason")[:1],
                output_field=CharField(),
            ))
        )
        frm, to = _parse_dt(request.query_params.get("from")), _parse_dt(request.query_params.get("to"))
        overlap = Q(pk__isnull=False)
        if frm and to:
            overlap = Q(start__lt=to) & Q(end__gt=frm)
        cancelled = Q(status=Booking.Status.CANCELLED)
        charge = ExpressionWrapper(F("n") * F("room__price") + F("pkg"), output_field=_MONEY)
        received = ExpressionWrapper(F("pay") + Coalesce(F("deposit"), Value(0), output_field=_MONEY), output_field=_MONEY)
        flag = lambda cond: Max(Case(When(cond, then=Value(1)), default=Value(0), output_field=IntegerField()))
        rows = (
            qs.values("key")
            .annotate(
                name=Max("guest_name"),
                phone=Max("guest_phone"),
                email=Max("guest_email"),
                id_type=Max("guest_id_type"),
                id_number=Max("guest_id_number"),
                nationality=Max("guest_nationality"),
                notes=Max("guest_notes"),
                bookings=Count("id"),
                stays=Sum(Case(When(cancelled, then=Value(0)), default=Value(1), output_field=IntegerField())),
                nights=Sum(
                    Case(When(cancelled | Q(kind=Booking.Kind.DAY_REST), then=Value(0)), default=F("n"), output_field=IntegerField())
                ),
                billed=Sum(Case(When(cancelled, then=Value(0)), default=charge, output_field=_MONEY)),
                paid=Sum(Case(When(cancelled, then=Value(0)), default=received, output_field=_MONEY)),
                last_visit=Max("start"),
                since=Min("created_at"),
                in_house=flag(Q(status=Booking.Status.OCCUPIED)),
                in_range=flag(overlap),
                visits=Sum(Case(When(overlap & ~cancelled, then=Value(1)), default=Value(0), output_field=IntegerField())),
                suspended=Max("susp", output_field=BooleanField()),
                suspend_reason=Max("susp_reason"),
            )
            .order_by("-last_visit")
        )
        # Min/Max avoid CONVERT_TZ, which returns NULL on MySQL installs whose
        # timezone tables aren't loaded (that's what .dates()/`__year` rely on).
        span = base.aggregate(mn=Min("start"), mx=Max("end"))
        years = list(range(span["mx"].year, span["mn"].year - 1, -1)) if span["mn"] and span["mx"] else []
        return Response({"clients": list(rows), "years": years})


class ClientPortalView(APIView):
    """One client's profile — the guest fields live on their bookings, so edits
    fan out to every row under the same rollup key. `status` suspends or
    reinstates the client for new bookings; the hold is keyed like the rollup,
    and follows the client if the edit moves them to a new key."""

    permission_classes = [CanManageBookings]

    PROFILE_FIELDS = (
        "guest_name", "guest_phone", "guest_email", "guest_id_type",
        "guest_id_number", "guest_nationality", "guest_notes",
    )

    def _bookings(self, request, key):
        qs = Booking.objects.all()
        if request.user.role not in BNB_ROLES:
            qs = qs.filter(branch=request.user.branch)
        return qs.annotate(_phone_digits=_phone_digits()).annotate(_key=_client_key()).filter(_key=key)

    def patch(self, request, key):
        ser = ClientProfileSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        with transaction.atomic():
            bookings = list(self._bookings(request, key).select_for_update())
            if not bookings:
                raise NotFound("No client matches that link.")
            branch = bookings[0].branch
            profile = {f: vd[f] for f in self.PROFILE_FIELDS if f in vd}
            if profile:
                Booking.objects.filter(pk__in=[b.pk for b in bookings]).update(**profile, updated_at=timezone.now())
            # The rollup key is derived from the guest fields — an edit can move
            # the client to a new key, and their suspension must follow them.
            merged = {f: getattr(bookings[0], f) for f in self.PROFILE_FIELDS}
            merged.update(profile)
            new_key = _client_key_of(
                merged["guest_name"], merged["guest_phone"],
                merged["guest_email"], merged["guest_id_number"],
            )
            if new_key != key:
                ClientSuspension.objects.filter(branch=branch, key=key).update(key=new_key)
            if "status" not in vd:
                susp = ClientSuspension.objects.filter(branch=branch, key=new_key).first()
                return Response({"key": new_key, "suspended": bool(susp), "reason": susp.reason if susp else ""})
            reason = (vd.get("reason") or "").strip()
            if vd["status"] == "suspended":
                susp, _ = ClientSuspension.objects.get_or_create(
                    branch=branch, key=new_key,
                    defaults={"reason": reason, "created_by": request.user},
                )
                if reason and susp.reason != reason:
                    susp.reason = reason
                    susp.save(update_fields=["reason"])
                return Response({"key": new_key, "suspended": True, "reason": susp.reason})
            ClientSuspension.objects.filter(branch=branch, key=new_key).delete()
            return Response({"key": new_key, "suspended": False, "reason": ""})


class ReferralViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Referrals are scoped to the caller's branch; Admin/IT Support see every referral."""

    permission_classes = [CanManageBookings, TillOwnerWriteOnly]
    serializer_class = ReferralSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Referral.objects.select_related(
            "branch", "booking", "booking__room", "redeemed_by"
        ).prefetch_related(
            "booking__payments", "booking__companions__room",
            "booking__extra_packages",
        )
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
        else:
            qs = qs.filter(branch=user.branch)
        return _limit(self.request, qs) if self.action == "list" else qs

    @action(detail=True, methods=["post"])
    def redeem(self, request, pk=None):
        """Hand over the gift voucher — only once the referral has matured (client paid)."""
        referral = self.get_object()
        if referral.redeemed_at:
            raise serializers.ValidationError({"detail": "This voucher was already redeemed."})
        if referral.maturity != Referral.Maturity.MATURED:
            raise serializers.ValidationError({"detail": "This referral hasn't matured yet — the client hasn't paid."})
        referral.redeemed_at = timezone.now()
        referral.redeemed_by = request.user
        referral.save(update_fields=["redeemed_at", "redeemed_by"])
        return Response(self.get_serializer(referral).data)


class TicketViewSet(viewsets.ModelViewSet):
    """Tickets are scoped to the caller's branch; Admin/IT Support see every ticket."""

    permission_classes = [CanManageTickets, TillOwnerWriteOnly]
    serializer_class = TicketSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Ticket.objects.select_related(
            "branch", "room", "booking", "reported_by", "assigned_to"
        ).prefetch_related("attachments", "items")
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
        else:
            qs = qs.filter(branch=user.branch)
        if statuses := self.request.query_params.get("status"):
            qs = qs.filter(status__in=statuses.split(","))
        return _limit(self.request, qs) if self.action == "list" else qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get("branch") if user.role in BNB_ROLES else user.branch
        if branch is None:
            detail = "Pick a branch for this ticket." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        serializer.save(branch=branch, reported_by=user)

    def perform_update(self, serializer):
        # Branch roles can't move a ticket to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        serializer.save()

    @action(detail=False, methods=["get"])
    def staff(self, request):
        """Active staff tickets can be assigned to — the caller's branch, or all branches for company roles."""
        user = request.user
        qs = User.objects.filter(status=User.Status.ACTIVE).order_by("first_name", "last_name")
        if user.role in BNB_ROLES:
            if branch := request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
        else:
            qs = qs.filter(branch=user.branch)
        return Response([
            {"id": u.id, "name": u.get_full_name() or u.email, "role": u.get_role_display()}
            for u in qs
        ])


class _BranchRecordViewSet(viewsets.ModelViewSet):
    """Branch-scoped money records — expenses and stock purchases. Branch staff
    read their own branch's rows; company roles see everything (or ?branch=<id>)."""

    permission_classes = [CanManageAccounts, TillOwnerWriteOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            return qs
        return qs.filter(branch=user.branch)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get("branch") if user.role in BNB_ROLES else user.branch
        if branch is None:
            detail = "Pick a branch for this record." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        # Money records land inside a till report, so they must belong to the
        # branch's currently open session.
        session = TillSession.objects.filter(branch=branch, closed_at__isnull=True).first()
        if session is None:
            raise serializers.ValidationError({"detail": "The till is closed — open it on the Counter page before registering."})
        record = serializer.save(branch=branch, created_by=user, session=session)
        Supplier.register(branch, record.supplier_name, getattr(record, "supplier_phone", ""))

    def perform_update(self, serializer):
        # Branch roles can't move a record to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        record = serializer.save()
        Supplier.register(record.branch, record.supplier_name, getattr(record, "supplier_phone", ""))


class SupplierViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Suppliers registered automatically by expense and stock records — the
    register popups autocomplete names and phones from this list."""

    permission_classes = [CanManageAccounts]
    serializer_class = SupplierSerializer
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Supplier.objects.all()
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            return qs
        return qs.filter(branch=user.branch)


class ExpenseViewSet(_BranchRecordViewSet):
    """Branch expenses — category, name, amount, supplier, payment status."""

    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related("branch", "created_by")


class StockPurchaseViewSet(_BranchRecordViewSet):
    """Stock bought from suppliers — supplier contact, item, buying price, payment status."""

    serializer_class = StockPurchaseSerializer
    queryset = StockPurchase.objects.select_related("branch", "created_by")


class TillViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """The counter till — open a session, register drawings, close with the
    counted cash. Each session's report (cash in, drawings, expected, over/short)
    is computed by the serializer. Sessions are branch-scoped like other records."""

    permission_classes = [CanManageAccounts, TillOwnerWriteOnly]
    serializer_class = TillSessionSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = TillSession.objects.select_related(
            "branch", "opened_by", "closed_by"
        ).prefetch_related("drawings__created_by")
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            return qs
        return _limit(self.request, qs.filter(branch=user.branch))

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user_branch"] = self.request.user.branch
        return ctx

    def _branch(self, request):
        user = request.user
        if user.role in BNB_ROLES:
            raw = request.data.get("branch")
            if not raw:
                raise serializers.ValidationError({"branch": "Pick a branch."})
            branch = Branch.objects.filter(pk=raw).first()
            if branch is None:
                raise NotFound("That branch doesn't exist.")
            return branch
        if user.branch_id is None:
            raise serializers.ValidationError({"detail": "Your account isn't allocated to a branch yet."})
        return user.branch

    @staticmethod
    def _clock_in(user):
        """Opening the till is the cashier's clock-in — best effort: when today's
        attendance is already on record (on shift or shift done) it's left alone,
        so a second session never rewrites the first shift."""
        today = timezone.localdate()
        record = Attendance.objects.filter(employee=user, date=today).first()
        if record and (record.clock_in or record.clock_out):
            return
        now = timezone.localtime().time().replace(microsecond=0)
        if record:
            record.clock_in = now
            if record.status in (Attendance.Status.ABSENT, Attendance.Status.OFF):
                record.status = Attendance.Status.PRESENT
            record.save(update_fields=["clock_in", "status"])
        else:
            Attendance.objects.create(
                employee=user, date=today, clock_in=now,
                status=Attendance.Status.PRESENT, recorded_by=user,
            )

    @staticmethod
    def _clock_out(user):
        """Closing the till is the cashier's clock-out."""
        record = Attendance.objects.filter(employee=user, date=timezone.localdate()).first()
        if record and record.clock_in and not record.clock_out:
            record.clock_out = timezone.localtime().time().replace(microsecond=0)
            record.save(update_fields=["clock_out"])

    @action(detail=False, methods=["post"])
    def open(self, request):
        """Open the till with a starting float — one open session per branch at a time."""
        branch = self._branch(request)
        if TillSession.objects.filter(branch=branch, closed_at__isnull=True).exists():
            raise serializers.ValidationError({"detail": "The till is already open — close it first."})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save(branch=branch, opened_by=request.user)
            self._clock_in(request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """Close the till with the cash counted in the drawer."""
        session = self.get_object()
        if session.closed_at:
            raise serializers.ValidationError({"detail": "This till session is already closed."})
        closing = TillCloseSerializer(data=request.data)
        closing.is_valid(raise_exception=True)
        with transaction.atomic():
            session.closing_count = closing.validated_data["closing_count"]
            session.closing_note = closing.validated_data.get("closing_note", "")
            session.closed_by = request.user
            session.closed_at = timezone.now()
            session.save(update_fields=["closing_count", "closing_note", "closed_by", "closed_at"])
            self._clock_out(session.opened_by)
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"])
    def drawings(self, request, pk=None):
        """Register cash taken out of the till — the session must still be open."""
        session = self.get_object()
        if session.closed_at:
            raise serializers.ValidationError({"detail": "This till session is closed — open a new one to draw."})
        serializer = TillDrawingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        drawing = serializer.save(session=session, created_by=request.user)
        return Response(TillDrawingSerializer(drawing).data, status=status.HTTP_201_CREATED)
