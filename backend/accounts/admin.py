from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-created_at"]
    list_display = ["photo_thumb", "code", "first_name", "last_name", "email", "phone", "role", "status", "last_login"]
    list_display_links = ["photo_thumb", "code"]
    list_editable = ["role", "status"]
    list_filter = ["status", "role", "is_staff"]
    search_fields = ["code", "email", "first_name", "last_name", "phone"]
    readonly_fields = ["photo_preview", "last_login", "date_joined", "created_at", "updated_at"]
    actions = ["approve", "suspend"]
    fieldsets = (
        (None, {"fields": ("code", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email", "phone", "photo", "photo_preview")}),
        ("Work", {"fields": ("role", "status", "branch")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("code", "first_name", "last_name", "email", "phone", "role", "status", "password1", "password2")}),
    )

    @admin.display(description="")
    def photo_thumb(self, obj):
        if not obj.photo:
            return ""
        return format_html('<img src="{}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">', obj.photo.url)

    @admin.display(description="Current picture")
    def photo_preview(self, obj):
        if not obj.photo:
            return "—"
        return format_html('<img src="{}" style="width:120px;height:120px;border-radius:16px;object-fit:cover">', obj.photo.url)

    @admin.action(description="Activate selected employees")
    def approve(self, request, queryset):
        queryset.update(status=User.Status.ACTIVE)

    @admin.action(description="Suspend selected employees")
    def suspend(self, request, queryset):
        queryset.update(status=User.Status.SUSPENDED)
