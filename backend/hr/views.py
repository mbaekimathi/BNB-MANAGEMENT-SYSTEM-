from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, parsers, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, six_digit_code
from accounts.serializers import UserSerializer

from .models import Attendance, LeaveRequest, PayrollEntry, TaskAssignment, TaskType
from .permissions import IsActiveStaff, IsBranchManager, IsHRStaff
from .serializers import (
    AttendanceSerializer,
    EmployeeBriefSerializer,
    EmployeeCreateSerializer,
    EmployeeUpdateSerializer,
    LeaveRequestSerializer,
    PayrollEntrySerializer,
    TaskAssignmentSerializer,
    TaskTypeSerializer,
    TeamMemberCreateSerializer,
    TeamMemberUpdateSerializer,
)


def _parse_date(value, default=None):
    try:
        return date.fromisoformat(value) if value else default
    except ValueError:
        raise serializers.ValidationError({"date": "Use the format YYYY-MM-DD."})


def _parse_month(value):
    if not value:
        return timezone.localdate().replace(day=1)
    try:
        return date.fromisoformat(f"{value}-01")
    except ValueError:
        raise serializers.ValidationError({"period": "Use the format YYYY-MM."})


class HRSummaryView(APIView):
    permission_classes = [IsHRStaff]

    def get(self, request):
        today = timezone.localdate()
        month = today.replace(day=1)
        users = User.objects.select_related("branch")
        by_status = dict(users.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        by_role = dict(users.values_list("role").annotate(n=Count("id")).values_list("role", "n"))
        attendance = dict(
            Attendance.objects.filter(date=today).values_list("status").annotate(n=Count("id")).values_list("status", "n")
        )
        payroll = PayrollEntry.objects.filter(period=month)
        totals = payroll.aggregate(b=Sum("basic_salary"), a=Sum("allowances"), d=Sum("deductions"))
        net = (totals["b"] or Decimal(0)) + (totals["a"] or Decimal(0)) - (totals["d"] or Decimal(0))
        on_leave = LeaveRequest.objects.filter(
            status=LeaveRequest.Status.APPROVED, start_date__lte=today, end_date__gte=today
        ).count()
        return Response({
            "total": users.count(),
            "status": {s.value: by_status.get(s.value, 0) for s in User.Status},
            "roles": [{"value": r.value, "label": r.label, "count": by_role.get(r.value, 0)} for r in User.Role],
            "joined_last_30_days": users.filter(created_at__gte=timezone.now() - timedelta(days=30)).count(),
            "attendance_today": {s.value: attendance.get(s.value, 0) for s in Attendance.Status},
            "on_leave_today": on_leave,
            "leave_pending": LeaveRequest.objects.filter(status=LeaveRequest.Status.PENDING).count(),
            "payroll_month": {"period": month, "entries": payroll.count(), "net_total": f"{net:.2f}",
                              "paid": payroll.filter(status=PayrollEntry.Status.PAID).count()},
            "recent": UserSerializer(users.order_by("-created_at")[:5], many=True, context={"request": request}).data,
        })


class EmployeeViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsHRStaff]
    http_method_names = ["get", "patch", "post"]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = User.objects.select_related("branch")
        params = self.request.query_params
        if q := params.get("q", "").strip():
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(code__icontains=q)
                | Q(email__icontains=q) | Q(phone__icontains=q)
            )
        if s := params.get("status"):
            qs = qs.filter(status=s)
        if r := params.get("role"):
            qs = qs.filter(role=r)
        return qs.order_by("first_name", "last_name") if params.get("sort") == "name" else qs

    def get_serializer_class(self):
        if self.action == "choices":
            return EmployeeBriefSerializer
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeUpdateSerializer if self.action in ("update", "partial_update") else UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="code-check")
    def code_check(self, request):
        """Live availability check for a sign-in code while a form is being filled."""
        code = request.query_params.get("code", "")
        try:
            six_digit_code(code)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"code": code, "available": not User.objects.filter(code=code).exists()})

    @action(detail=False, methods=["get"], url_path="email-check")
    def email_check(self, request):
        """Live availability check for a personal email while a form is being filled."""
        email = (request.query_params.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Send an email to check."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"email": email, "available": not User.objects.filter(email__iexact=email).exists()})

    @action(detail=False)
    def choices(self, request):
        qs = User.objects.filter(status=User.Status.ACTIVE).order_by("first_name", "last_name")
        return Response(EmployeeBriefSerializer(qs, many=True).data)

    def _set_status(self, request, new_status, role=None, branch=None):
        user = self.get_object()
        data = {"status": new_status}
        if role:
            data["role"] = role
        if branch is not None or new_status == User.Status.ACTIVE:
            data["branch"] = branch
        serializer = EmployeeUpdateSerializer(user, data=data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        role = request.data.get("role")
        if role and role not in User.Role.values:
            raise serializers.ValidationError({"role": "Unknown role."})
        branch = request.data.get("branch")
        return self._set_status(request, User.Status.ACTIVE, role, branch)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, User.Status.SUSPENDED)


class BranchTeamViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """A branch manager registers and manages the staff allocated to their own branch."""
    permission_classes = [IsBranchManager]
    http_method_names = ["get", "post", "patch", "delete"]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = (
            User.objects.select_related("branch").filter(branch_id=user.branch_id)
            if user.branch_id else User.objects.none()
        )
        params = self.request.query_params
        if q := params.get("q", "").strip():
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(code__icontains=q)
                | Q(email__icontains=q) | Q(phone__icontains=q)
            )
        if s := params.get("status"):
            qs = qs.filter(status=s)
        if r := params.get("role"):
            qs = qs.filter(role=r)
        return qs.order_by("first_name", "last_name")

    def get_serializer_class(self):
        if self.action == "create":
            return TeamMemberCreateSerializer
        if self.action in ("update", "partial_update"):
            return TeamMemberUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        if not request.user.branch_id:
            raise serializers.ValidationError({"detail": "You haven't been allocated to a branch yet."})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def _set_status(self, request, new_status, role=None):
        user = self.get_object()
        if new_status == User.Status.SUSPENDED and user.status != User.Status.ACTIVE:
            raise serializers.ValidationError({"detail": "Only approved staff can be suspended."})
        data = {"status": new_status}
        if role:
            data["role"] = role
        serializer = TeamMemberUpdateSerializer(
            user, data=data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        role = request.data.get("role")
        if role and role not in User.Role.values:
            raise serializers.ValidationError({"role": "Unknown role."})
        return self._set_status(request, User.Status.ACTIVE, role)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, User.Status.SUSPENDED)

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise serializers.ValidationError({"detail": "You can't delete your own account."})
        if instance.role == User.Role.BRANCH_MANAGER:
            raise serializers.ValidationError({"detail": "Only HR can remove a branch manager."})
        instance.delete()


class _RecorderMixin:
    permission_classes = [IsHRStaff]
    http_method_names = ["get", "post", "patch", "delete"]


class AttendanceViewSet(_RecorderMixin, viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        qs = Attendance.objects.select_related("employee")
        if self.action != "list":
            return qs
        params = self.request.query_params
        day = _parse_date(params.get("date"), timezone.localdate())
        qs = qs.filter(date=day)
        if e := params.get("employee"):
            qs = qs.filter(employee_id=e)
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class MyAttendanceView(APIView):
    """Self-service attendance: a staff member checks in and out of their own shift."""
    permission_classes = [IsActiveStaff]

    def _today(self, request):
        return Attendance.objects.filter(employee=request.user, date=timezone.localdate()).first()

    def _data(self, request, record):
        return AttendanceSerializer(record, context={"request": request}).data

    def _save(self, record):
        try:
            record.full_clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(serializers.as_serializer_error(e))
        record.save()

    def get(self, request):
        record = self._today(request)
        return Response({
            "record": self._data(request, record) if record else None,
            "server_now": timezone.localtime().isoformat(),
        })

    def post(self, request):
        action = request.data.get("action")
        record = self._today(request)
        now = timezone.localtime().time().replace(microsecond=0)

        if action == "check-in":
            if record and record.clock_out:
                raise serializers.ValidationError({"detail": "You've already checked out for today."})
            if record and record.clock_in:
                raise serializers.ValidationError({"detail": "You're already checked in."})
            if record:
                record.clock_in = now
                if record.status in (Attendance.Status.ABSENT, Attendance.Status.OFF):
                    record.status = Attendance.Status.PRESENT
                self._save(record)
            else:
                record = Attendance.objects.create(
                    employee=request.user, date=timezone.localdate(), clock_in=now,
                    status=Attendance.Status.PRESENT, recorded_by=request.user,
                )
        elif action in ("check-out", "system-check-out"):
            if not record or not record.clock_in or record.clock_out:
                raise serializers.ValidationError({"detail": "You need to check in before you can check out."})
            record.clock_out = now
            record.system_clock_out = action == "system-check-out"
            self._save(record)
        else:
            raise serializers.ValidationError({"action": "Use 'check-in', 'check-out' or 'system-check-out'."})

        return Response(self._data(request, record))


class LeaveRequestViewSet(_RecorderMixin, viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("employee", "decided_by")
        if self.action == "list" and (s := self.request.query_params.get("status")):
            qs = qs.filter(status=s)
        return qs

    def _decide(self, request, new_status):
        leave = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if leave.status != LeaveRequest.Status.PENDING:
            raise serializers.ValidationError({"detail": "This request has already been decided."})
        leave.status, leave.decided_by, leave.decided_at = new_status, request.user, timezone.now()
        leave.save()
        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, LeaveRequest.Status.APPROVED)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, LeaveRequest.Status.REJECTED)


class PayrollEntryViewSet(_RecorderMixin, viewsets.ModelViewSet):
    serializer_class = PayrollEntrySerializer

    def get_queryset(self):
        qs = PayrollEntry.objects.select_related("employee")
        if self.action == "list":
            qs = qs.filter(period=_parse_month(self.request.query_params.get("period")))
        return qs

    def perform_destroy(self, instance):
        if instance.status == PayrollEntry.Status.PAID:
            raise serializers.ValidationError({"detail": "A paid payslip can't be deleted."})
        instance.delete()

    def perform_update(self, serializer):
        if serializer.instance.status == PayrollEntry.Status.PAID:
            raise serializers.ValidationError({"detail": "A paid payslip can't be changed."})
        serializer.save()

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        entry = self.get_object()
        if entry.status != PayrollEntry.Status.PAID:
            entry.status, entry.paid_at = PayrollEntry.Status.PAID, timezone.now()
            entry.save()
        return Response(self.get_serializer(entry).data, status=status.HTTP_200_OK)


class _BranchScoped:
    """Everything in these viewsets stays inside the manager's own branch."""
    permission_classes = [IsBranchManager]
    http_method_names = ["get", "post", "patch", "delete"]

    def _branch(self):
        branch = self.request.user.branch
        if branch is None:
            raise serializers.ValidationError({"detail": "You haven't been allocated to a branch yet."})
        return branch


class BranchTaskTypeViewSet(_BranchScoped, viewsets.ModelViewSet):
    """The catalogue of task types a branch manager hands out to their team."""
    serializer_class = TaskTypeSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.branch_id:
            return TaskType.objects.none()
        return TaskType.objects.filter(branch_id=user.branch_id).annotate(
            open_count=Count(
                "assignments",
                filter=Q(assignments__status__in=[
                    TaskAssignment.Status.PENDING, TaskAssignment.Status.IN_PROGRESS,
                ]),
            )
        )

    def perform_create(self, serializer):
        serializer.save(branch=self._branch())

    def perform_destroy(self, instance):
        if instance.assignments.exists():
            raise serializers.ValidationError(
                {"detail": "This task type still has assignments — delete them first."}
            )
        instance.delete()


class BranchTaskAssignmentViewSet(_BranchScoped, viewsets.ModelViewSet):
    """Tasks a branch manager has handed to staff at their own branch."""
    serializer_class = TaskAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = TaskAssignment.objects.select_related("task_type", "employee", "assigned_by")
        if not user.branch_id:
            return qs.none()
        qs = qs.filter(branch_id=user.branch_id)
        if self.action == "list":
            params = self.request.query_params
            if d := params.get("date"):
                qs = qs.filter(date=_parse_date(d))
            if s := params.get("status"):
                qs = qs.filter(status=s)
            if e := params.get("employee"):
                qs = qs.filter(employee_id=e)
        return qs

    def perform_create(self, serializer):
        serializer.save(branch=self._branch(), assigned_by=self.request.user)

    def _set_status(self, request, new_status):
        task = self.get_object()
        if task.status == TaskAssignment.Status.DONE:
            raise serializers.ValidationError({"detail": "This task is already done."})
        task.status = new_status
        task.completed_at = timezone.now() if new_status == TaskAssignment.Status.DONE else None
        task.save()
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._set_status(request, TaskAssignment.Status.IN_PROGRESS)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._set_status(request, TaskAssignment.Status.DONE)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._set_status(request, TaskAssignment.Status.CANCELLED)
