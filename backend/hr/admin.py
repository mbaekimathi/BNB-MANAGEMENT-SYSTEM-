from django.contrib import admin

from .models import Attendance, LeaveRequest, PayrollEntry, TaskAssignment, TaskType


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "status", "clock_in", "clock_out", "system_clock_out")
    list_filter = ("status", "date")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "status")
    list_filter = ("status", "leave_type")


@admin.register(PayrollEntry)
class PayrollEntryAdmin(admin.ModelAdmin):
    list_display = ("employee", "period", "basic_salary", "allowances", "deductions", "status")
    list_filter = ("status", "period")


@admin.register(TaskType)
class TaskTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "created_at")
    list_filter = ("branch",)


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ("task_type", "employee", "branch", "date", "status")
    list_filter = ("status", "branch", "date")
