from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        LATE = "late", "Late"
        ABSENT = "absent", "Absent"
        OFF = "off", "Day off"

    employee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    clock_in = models.TimeField(null=True, blank=True)
    clock_out = models.TimeField(null=True, blank=True)
    # True when the system ended the shift after the session-check prompt went
    # unanswered — not the employee clocking out normally.
    system_clock_out = models.BooleanField("clocked out by the system", default=False)
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "employee__first_name"]
        indexes = [
            # The register is read one day at a time across every employee.
            models.Index(fields=["date"], name="attendance_date"),
        ]
        constraints = [models.UniqueConstraint(fields=["employee", "date"], name="one_attendance_per_day",
            violation_error_message="Attendance for this employee on this day is already recorded.")]

    def clean(self):
        if self.clock_in and self.clock_out and self.clock_out < self.clock_in:
            raise ValidationError({"clock_out": "Clock-out can't be before clock-in."})


class LeaveRequest(models.Model):
    class Type(models.TextChoices):
        ANNUAL = "annual", "Annual leave"
        SICK = "sick", "Sick leave"
        MATERNITY = "maternity", "Maternity / paternity"
        COMPASSIONATE = "compassionate", "Compassionate leave"
        UNPAID = "unpaid", "Unpaid leave"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.CharField(max_length=20, choices=Type.choices, default=Type.ANNUAL)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # HR screens list requests by status, and "who is away today" is a
            # start/end window lookup.
            models.Index(fields=["status"], name="leave_status"),
            models.Index(fields=["start_date", "end_date"], name="leave_period"),
        ]

    @property
    def days(self):
        return (self.end_date - self.start_date).days + 1

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "The end date can't be before the start date."})


class PayrollEntry(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PAID = "paid", "Paid"

    employee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payroll")
    period = models.DateField(help_text="First day of the pay month.")
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period", "employee__first_name"]
        indexes = [
            # Payroll is read one month at a time, often split by paid/draft.
            models.Index(fields=["period", "status"], name="payroll_period_status"),
        ]
        verbose_name_plural = "payroll entries"
        constraints = [models.UniqueConstraint(fields=["employee", "period"], name="one_payslip_per_month",
            violation_error_message="This employee already has a payslip for that month.")]

    @property
    def net_pay(self):
        return self.basic_salary + self.allowances - self.deductions


class TaskType(models.Model):
    """A kind of work a branch manager hands out — e.g. "Room cleaning" or "Pool duty"."""

    branch = models.ForeignKey("bnb.Branch", on_delete=models.CASCADE, related_name="task_types")
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["branch", "name"], name="unique_task_type_per_branch",
            violation_error_message="A task type with this name already exists.")]

    def __str__(self):
        return f"{self.name} · {self.branch.name}"


class TaskAssignment(models.Model):
    """A task handed to an employee for a shift day, with an optional time window."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"
        CANCELLED = "cancelled", "Cancelled"

    branch = models.ForeignKey("bnb.Branch", on_delete=models.CASCADE, related_name="task_assignments")
    task_type = models.ForeignKey(TaskType, on_delete=models.CASCADE, related_name="assignments")
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_assignments"
    )
    date = models.DateField("shift day")
    start = models.TimeField(null=True, blank=True)
    end = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    note = models.CharField(max_length=255, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "start", "employee__first_name"]
        indexes = [
            # The shift board reads a branch's tasks for a day, often by status.
            models.Index(fields=["branch", "date", "status"], name="task_branch_date_status"),
        ]

    def clean(self):
        if self.start and self.end and self.end < self.start:
            raise ValidationError({"end": "The end time can't be before the start time."})
