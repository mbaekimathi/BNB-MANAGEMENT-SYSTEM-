from django.contrib import admin
from django.utils.html import format_html

from .models import Booking, BookingGuest, BookingPayment, Branch, BranchSettings, Expense, Referral, Room, StockPurchase, Supplier, Ticket, TicketAttachment, TicketItem, TillDrawing, TillSession, Voucher


class BranchSettingsInline(admin.StackedInline):
    model = BranchSettings
    can_delete = False
    extra = 0
    fieldsets = [
        ("Payments", {"fields": [
            "mpesa_enabled", "mpesa_till", "mpesa_account",
            "cash_enabled", "card_enabled",
            "bank_enabled", "bank_name", "bank_account_name", "bank_account_number",
        ]}),
        ("Communications", {"fields": [
            "email_enabled", "sms_enabled", "sms_sender_id",
            "whatsapp_enabled", "whatsapp_number",
        ]}),
    ]


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["photo_thumb", "code", "name", "email", "phone", "location", "created_at"]
    list_display_links = ["photo_thumb", "code"]
    search_fields = ["code", "name", "email", "phone", "location"]
    readonly_fields = ["photo_preview", "created_at", "updated_at"]
    inlines = [BranchSettingsInline]

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
    list_display = ["name", "branch", "room_type", "capacity", "price", "day_rest_price", "commission", "status", "created_at"]
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
    readonly_fields = ["receipt_number"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    ordering = ["-start"]
    list_display = ["guest_name", "room", "branch", "kind", "status", "start", "end", "deposit"]
    list_filter = ["status", "kind", "branch"]
    search_fields = ["guest_name", "guest_phone", "guest_email", "guest_id_number", "companions__name", "companions__id_number", "companions__phone", "companions__email", "room__name", "branch__name"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [BookingGuestInline, BookingPaymentInline]


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["voucher_code", "referrer_name", "referrer_phone", "booking", "branch", "redeemed_at", "created_at"]
    list_filter = ["branch", "redeemed_at"]
    search_fields = ["voucher_code", "referrer_name", "referrer_phone", "booking__guest_name", "booking__guest_phone", "branch__name"]
    readonly_fields = ["voucher_code", "created_at"]


@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["code", "guest_name", "guest_phone", "amount", "booking", "branch", "redeemed_at", "created_at"]
    list_filter = ["branch", "redeemed_at"]
    search_fields = ["code", "guest_name", "guest_phone", "booking__guest_name", "branch__name"]
    readonly_fields = ["code", "created_at"]


class TicketItemInline(admin.TabularInline):
    model = TicketItem
    extra = 0
    readonly_fields = ["created_at"]


class TicketAttachmentInline(admin.TabularInline):
    model = TicketAttachment
    extra = 0
    readonly_fields = ["name", "created_at"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["number", "title", "branch", "category", "priority", "status", "due", "created_at"]
    list_filter = ["status", "priority", "category", "branch"]
    search_fields = ["number", "title", "reporter_name", "assignee_name", "location", "booking__guest_name", "branch__name"]
    readonly_fields = ["number", "created_at", "updated_at", "resolved_at"]
    inlines = [TicketItemInline, TicketAttachmentInline]


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["name", "branch", "session", "category", "amount", "supplier_name", "payment_status", "created_by", "created_at"]
    list_filter = ["category", "payment_status", "branch"]
    search_fields = ["name", "supplier_name", "supplier_phone", "branch__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(StockPurchase)
class StockPurchaseAdmin(admin.ModelAdmin):
    ordering = ["-created_at"]
    list_display = ["item", "quantity", "unit_price", "supplier_name", "supplier_phone", "branch", "session", "payment_status", "created_by", "created_at"]
    list_filter = ["payment_status", "branch"]
    search_fields = ["item", "supplier_name", "supplier_phone", "branch__name"]
    readonly_fields = ["created_at", "updated_at"]


class TillDrawingInline(admin.TabularInline):
    model = TillDrawing
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    ordering = ["name"]
    list_display = ["name", "phone", "branch"]
    list_filter = ["branch"]
    search_fields = ["name", "phone"]


@admin.register(TillSession)
class TillSessionAdmin(admin.ModelAdmin):
    ordering = ["-opened_at"]
    list_display = ["branch", "opened_by", "opened_at", "opening_float", "opening_mpesa", "opening_card", "closed_at", "closing_count", "closing_mpesa", "closing_card"]
    list_filter = ["branch", "closed_at"]
    readonly_fields = ["opened_at"]
    inlines = [TillDrawingInline]
