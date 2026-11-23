from django.conf import settings
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, six_digit_code

MAX_PHOTO_BYTES = 3 * 1024 * 1024


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "code", "email", "first_name", "last_name", "full_name", "phone", "photo",
            "role", "role_label", "status", "status_label", "last_login", "created_at",
        ]
        read_only_fields = fields

    def get_photo(self, obj):
        if not obj.photo:
            return None
        return obj.photo.url


class RegisterSerializer(serializers.ModelSerializer):
    code = serializers.CharField(validators=[six_digit_code])
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
    photo = serializers.ImageField(required=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone", "code", "password", "confirm_password", "photo"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
            "phone": {"required": True, "allow_blank": False},
        }

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_code(self, value):
        if User.objects.filter(code=value).exists():
            raise serializers.ValidationError("This code is already taken. Please choose another one.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        digits = value.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 9 <= len(digits) <= 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_photo(self, value):
        if value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("The picture must be smaller than 3 MB.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        candidate = User(**{k: v for k, v in attrs.items() if k not in ("password", "photo")})
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        photo = validated_data.pop("photo")
        user = User.objects.create_user(
            role=User.Role.BRANCH_EMPLOYEE, status=User.Status.PENDING, **validated_data
        )
        user.photo.save(photo.name, photo, save=True)
        return user


class LoginSerializer(serializers.Serializer):
    code = serializers.CharField(validators=[six_digit_code])
    password = serializers.CharField(trim_whitespace=False)
    remember_me = serializers.BooleanField(default=False)

    def validate(self, attrs):
        user = User.objects.filter(code=attrs["code"]).first()
        if not user or not user.check_password(attrs["password"]):
            raise serializers.ValidationError({"detail": "Incorrect code or password."})
        if user.status == User.Status.PENDING:
            raise serializers.ValidationError(
                {"detail": "Your account is pending activation. Please wait for it to be approved.", "code": "pending"}
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
