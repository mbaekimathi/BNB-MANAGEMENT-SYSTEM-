from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User, six_digit_code
from accounts.serializers import MAX_PHOTO_BYTES, PIN_RE, RegisterSerializer, UserSerializer
from bnb.models import Branch

from .models import Attendance, LeaveRequest, PayrollEntry, TaskAssignment, TaskType

BRANCH_ROLES = {
    User.Role.BRANCH_MANAGER,
    User.Role.BRANCH_RECEPTIONIST,
    User.Role.BRANCH_STORE_MANAGER,
    User.Role.BRANCH_EMPLOYEE,
}

# Staff roles a branch manager is allowed to hand out (no branch_manager — that's an HR decision).
TEAM_ROLES = {
    User.Role.BRANCH_RECEPTIONIST,
    User.Role.BRANCH_STORE_MANAGER,
    User.Role.BRANCH_EMPLOYEE,
}


class EmployeeBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "code", "first_name", "last_name", "full_name", "role", "role_label", "photo"]

    def get_photo(self, obj):
        return obj.photo.url if obj.photo else None


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    code = serializers.CharField(validators=[six_digit_code], required=False)
    photo = serializers.ImageField(required=False, allow_null=True)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone", "code", "role", "status", "branch", "photo", "new_password"]
        extra_kwargs = {
            "first_name": {"allow_blank": False},
            "last_name": {"allow_blank": False},
            "phone": {"allow_blank": False},
        }

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Another employee already uses this email.")
        return value

    def validate_code(self, value):
        if User.objects.filter(code=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Another employee already uses this code.")
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
        request = self.context["request"]
        if self.instance == request.user and (
            attrs.get("role", self.instance.role) != self.instance.role
            or attrs.get("status", self.instance.status) != self.instance.status
        ):
            raise serializers.ValidationError("You can't change your own role or status.")
        if attrs.get("role") == User.Role.ADMIN and request.user.role != User.Role.ADMIN:
            raise serializers.ValidationError({"role": "Only an Admin can give someone the Admin role."})
        if self.instance.role == User.Role.ADMIN and request.user.role != User.Role.ADMIN:
            raise serializers.ValidationError("Only an Admin can change another Admin's account.")
        new_role = attrs.get("role", self.instance.role)
        activating = attrs.get("status") == User.Status.ACTIVE and self.instance.status != User.Status.ACTIVE
        if "branch" in attrs or "role" in attrs or activating:
            branch = attrs.get("branch", self.instance.branch)
            if new_role in BRANCH_ROLES:
                if activating and branch is None:
                    raise serializers.ValidationError({"branch": "Choose which branch this person will work at."})
                attrs["branch"] = branch
            else:
                attrs["branch"] = None
        password = attrs.get("new_password")
        if password:
            code = attrs.get("code", self.instance.code)
            if PIN_RE.fullmatch(password):
                if password == code:
                    raise serializers.ValidationError({"new_password": "A 6-digit password can't be the same as the sign-in code."})
            else:
                try:
                    password_validation.validate_password(password, self.instance)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("new_password", "")
        photo = validated_data.pop("photo", False)
        instance = super().update(instance, validated_data)
        if photo is not False:
            if instance.photo:
                instance.photo.delete(save=False)
            if photo:
                instance.photo.save(photo.name, photo, save=False)
        if password:
            instance.set_password(password)
        instance.is_active = instance.status != User.Status.SUSPENDED
        instance.save()
        return instance

    def to_representation(self, instance):
        return UserSerializer(instance, context=self.context).data


class EmployeeCreateSerializer(RegisterSerializer):
    """HR staff register an employee directly — the account starts active and is
    allocated to a branch right away. Branch roles must name their branch;
    company roles are never allocated one."""
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.BRANCH_EMPLOYEE)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)

    class Meta(RegisterSerializer.Meta):
        fields = [*RegisterSerializer.Meta.fields, "role", "branch"]

    def validate_role(self, value):
        if value == User.Role.ADMIN and self.context["request"].user.role != User.Role.ADMIN:
            raise serializers.ValidationError("Only an Admin can give someone the Admin role.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("role") in BRANCH_ROLES:
            if attrs.get("branch") is None:
                raise serializers.ValidationError({"branch": "Choose which branch this person will work at."})
        else:
            attrs["branch"] = None
        return attrs

    def create(self, validated_data):
        photo = validated_data.pop("photo", None)
        user = User.objects.create_user(status=User.Status.ACTIVE, **validated_data)
        if photo:
            user.photo.save(photo.name, photo, save=True)
        return user


class TeamMemberCreateSerializer(RegisterSerializer):
    """A branch manager registers a staff member directly — the account starts
    active and allocated to the manager's own branch."""
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.BRANCH_EMPLOYEE)

    class Meta(RegisterSerializer.Meta):
        fields = [*RegisterSerializer.Meta.fields, "role"]

    def validate_role(self, value):
        if value not in TEAM_ROLES:
            raise serializers.ValidationError("You can only register branch staff roles.")
        return value

    def create(self, validated_data):
        photo = validated_data.pop("photo", None)
        user = User.objects.create_user(
            status=User.Status.ACTIVE, branch=self.context["request"].user.branch, **validated_data
        )
        if photo:
            user.photo.save(photo.name, photo, save=True)
        return user


class TeamMemberUpdateSerializer(EmployeeUpdateSerializer):
    """Branch managers edit staff at their own branch: no company roles, no
    branch transfers, no touching other branch managers' role or status.
    Only approved (active) staff can be changed — for anyone else the sole
    allowed update is the approval itself (status → active)."""

    def validate(self, attrs):
        request = self.context["request"]
        approving = attrs.get("status") == User.Status.ACTIVE and self.instance.status != User.Status.ACTIVE
        if self.instance.status != User.Status.ACTIVE and not approving:
            raise serializers.ValidationError(
                {"detail": "Approve this person first — only approved staff can be edited or suspended."}
            )
        if self.instance.role == User.Role.BRANCH_MANAGER and (
            attrs.get("role", self.instance.role) != self.instance.role
            or attrs.get("status", self.instance.status) != self.instance.status
        ):
            raise serializers.ValidationError("Only HR can change a branch manager's role or status.")
        if "role" in attrs and attrs["role"] not in TEAM_ROLES:
            raise serializers.ValidationError({"role": "You can only give branch staff roles."})
        if "branch" in attrs:
            if attrs["branch"] is not None and attrs["branch"] != request.user.branch:
                raise serializers.ValidationError({"branch": "Staff can only stay at your own branch."})
            del attrs["branch"]
        return super().validate(attrs)


class _EmployeeLinked(serializers.ModelSerializer):
    employee = EmployeeBriefSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee", queryset=User.objects.all(), write_only=True
    )

    def validate(self, attrs):
        model = self.Meta.model
        if self.instance:
            obj = model(**{f.attname: getattr(self.instance, f.attname) for f in model._meta.concrete_fields})
        else:
            obj = model()
        for key, value in attrs.items():
            setattr(obj, key, value)
        try:
            obj.clean()
            obj.validate_constraints()
        except DjangoValidationError as e:
            raise serializers.ValidationError(serializers.as_serializer_error(e))
        return attrs


class AttendanceSerializer(_EmployeeLinked):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id", "employee", "employee_id", "date", "status", "status_label",
            "clock_in", "clock_out", "system_clock_out", "note",
        ]


class LeaveRequestSerializer(_EmployeeLinked):
    type_label = serializers.CharField(source="get_leave_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    days = serializers.IntegerField(read_only=True)
    decided_by = serializers.CharField(source="decided_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "employee", "employee_id", "leave_type", "type_label", "start_date", "end_date", "days",
            "reason", "status", "status_label", "decided_by", "decided_at", "created_at",
        ]
        read_only_fields = ["status", "decided_at", "created_at"]


class PayrollEntrySerializer(_EmployeeLinked):
    net_pay = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PayrollEntry
        fields = [
            "id", "employee", "employee_id", "period", "basic_salary", "allowances", "deductions",
            "net_pay", "status", "status_label", "paid_at",
        ]
        read_only_fields = ["status", "paid_at"]

    def validate_period(self, value):
        return value.replace(day=1)

    def validate(self, attrs):
        for f in ("basic_salary", "allowances", "deductions"):
            if attrs.get(f) is not None and attrs[f] < 0:
                raise serializers.ValidationError({f: "Amounts can't be negative."})
        return super().validate(attrs)


class TaskTypeSerializer(serializers.ModelSerializer):
    open_count = serializers.SerializerMethodField()

    class Meta:
        model = TaskType
        fields = ["id", "name", "description", "open_count", "created_at"]
        read_only_fields = ["created_at"]

    def get_open_count(self, obj):
        return getattr(obj, "open_count", 0)

    def validate_name(self, value):
        value = value.strip()
        qs = TaskType.objects.filter(
            branch_id=self.context["request"].user.branch_id, name__iexact=value
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A task type with this name already exists.")
        return value


class TaskAssignmentSerializer(_EmployeeLinked):
    task_type = TaskTypeSerializer(read_only=True)
    task_type_id = serializers.PrimaryKeyRelatedField(
        source="task_type", queryset=TaskType.objects.all(), write_only=True
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    assigned_by = serializers.CharField(source="assigned_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = TaskAssignment
        fields = [
            "id", "task_type", "task_type_id", "employee", "employee_id", "date", "start", "end",
            "status", "status_label", "note", "assigned_by", "completed_at", "created_at",
        ]
        read_only_fields = ["status", "assigned_by", "completed_at", "created_at"]

    def validate(self, attrs):
        branch_id = self.context["request"].user.branch_id
        employee = attrs.get("employee", self.instance.employee if self.instance else None)
        task_type = attrs.get("task_type", self.instance.task_type if self.instance else None)
        if employee is not None and employee.branch_id != branch_id:
            raise serializers.ValidationError({"employee_id": "This person doesn't work at your branch."})
        if "employee" in attrs and attrs["employee"].status != User.Status.ACTIVE:
            raise serializers.ValidationError({"employee_id": "Only approved staff can be assigned tasks."})
        if task_type is not None and task_type.branch_id != branch_id:
            raise serializers.ValidationError({"task_type_id": "This task type doesn't belong to your branch."})
        return super().validate(attrs)
