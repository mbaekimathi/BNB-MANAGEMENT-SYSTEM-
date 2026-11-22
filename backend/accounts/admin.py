from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-created_at"]
    list_display = ["employee_id", "email", "first_name", "last_name", "role", "status", "last_login"]
    list_filter = ["status", "role", "is_staff"]
    search_fields = ["email", "employee_id", "first_name", "last_name", "phone"]
    readonly_fields = ["employee_id", "last_login", "date_joined", "created_at", "updated_at"]
    actions = ["approve", "suspend"]
    fieldsets = (
        (None, {"fields": ("employee_id", "email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone")}),
        ("Work", {"fields": ("role", "status")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "first_name", "last_name", "role", "status", "password1", "password2")}),
    )

    @admin.action(description="Approve selected employees")
    def approve(self, request, queryset):
        queryset.update(status=User.Status.ACTIVE)

    @admin.action(description="Suspend selected employees")
    def suspend(self, request, queryset):
        queryset.update(status=User.Status.SUSPENDED)
