from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User, six_digit_code
from accounts.serializers import MAX_PHOTO_BYTES, PIN_RE, UserSerializer
from bnb.models import Branch

from .models import Attendance, LeaveRequest, PayrollEntry

BRANCH_ROLES = {
    User.Role.BRANCH_MANAGER,
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
        fields = ["id", "employee", "employee_id", "date", "status", "status_label", "clock_in", "clock_out", "note"]


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
