from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, parsers, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import six_digit_code

from .models import Booking, Branch, Room
from .permissions import BNB_ROLES, CanManageBookings, CanManageRooms, IsBnBStaff
from .serializers import BookingSerializer, BranchSerializer, RoomSerializer


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


class BookingViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Bookings are scoped to the caller's branch; Admin/IT Support see every booking."""

    permission_classes = [CanManageBookings]
    serializer_class = BookingSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related("branch", "room", "created_by").prefetch_related("companions", "payments__companion")
        if user.role in BNB_ROLES:
            if branch := self.request.query_params.get("branch"):
                qs = qs.filter(branch_id=branch)
            if status := self.request.query_params.get("status"):
                qs = qs.filter(status=status)
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
            detail = "Pick a branch for this booking." if user.role in BNB_ROLES else "Your account isn't allocated to a branch yet."
            raise serializers.ValidationError({"branch": detail})
        serializer.save(branch=branch, created_by=user)

    def perform_update(self, serializer):
        # Branch roles can't move a booking to another branch.
        if self.request.user.role not in BNB_ROLES:
            serializer.validated_data.pop("branch", None)
        serializer.save()

    def _transition(self, request, allowed, new_status):
        booking = self.get_object()
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
