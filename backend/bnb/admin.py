from django.contrib import admin
from django.utils.html import format_html

from .models import Booking, BookingGuest, BookingPayment, Branch, Room


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["photo_thumb", "code", "name", "email", "phone", "location", "created_at"]
    list_display_links = ["photo_thumb", "code"]
    search_fields = ["code", "name", "email", "phone", "location"]
    readonly_fields = ["photo_preview", "created_at", "updated_at"]

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


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    ordering = ["branch", "name"]
    list_display = ["name", "branch", "room_type", "capacity", "price", "status", "created_at"]
    list_display_links = ["name"]
    list_filter = ["status", "room_type", "branch"]
    search_fields = ["name", "branch__name"]
    readonly_fields = ["created_at", "updated_at"]


class BookingGuestInline(admin.TabularInline):
    model = BookingGuest
    extra = 0


class BookingPaymentInline(admin.TabularInline):
    model = BookingPayment
    extra = 0


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    ordering = ["-start"]
    list_display = ["guest_name", "room", "branch", "kind", "status", "start", "end", "deposit"]
    list_filter = ["status", "kind", "branch"]
    search_fields = ["guest_name", "guest_phone", "guest_email", "guest_id_number", "companions__name", "companions__id_number", "companions__phone", "companions__email", "room__name", "branch__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [BookingGuestInline, BookingPaymentInline]
