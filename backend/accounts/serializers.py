from django.conf import settings
from django.contrib.auth import password_validation
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "employee_id", "email", "first_name", "last_name", "full_name",
            "phone", "role", "role_label", "status", "last_login", "created_at",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in User.SELF_SIGNUP_ROLES])

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone", "role", "password", "confirm_password"]
        extra_kwargs = {"first_name": {"required": True}, "last_name": {"required": True}}

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        candidate = User(**{k: v for k, v in attrs.items() if k != "password"})
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except Exception as exc:  # django ValidationError
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        status = User.Status.PENDING if settings.ACCOUNTS_REQUIRE_APPROVAL else User.Status.ACTIVE
        return User.objects.create_user(status=status, **validated_data)


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Work email or employee ID")
    password = serializers.CharField(trim_whitespace=False)
    remember_me = serializers.BooleanField(default=False)

    default_error = "Incorrect email/employee ID or password."

    def validate(self, attrs):
        ident = attrs["identifier"].strip()
        user = User.objects.filter(Q(email__iexact=ident) | Q(employee_id__iexact=ident)).first()
        if not user or not user.check_password(attrs["password"]):
            raise serializers.ValidationError({"detail": self.default_error})
        if user.status == User.Status.PENDING:
            raise serializers.ValidationError(
                {"detail": "Your account is waiting for a manager to approve it.", "code": "pending"}
            )
        if not user.can_sign_in:
            raise serializers.ValidationError(
                {"detail": "Your account is suspended. Please contact your manager.", "code": "suspended"}
            )
        attrs["user"] = user
        return attrs

    def tokens_for(self, user, remember_me):
        refresh = RefreshToken.for_user(user)
        if remember_me:
            refresh.set_exp(lifetime=settings.SIMPLE_JWT["REMEMBER_ME_REFRESH_LIFETIME"])
        refresh["role"] = user.role
        return {"access": str(refresh.access_token), "refresh": str(refresh)}
