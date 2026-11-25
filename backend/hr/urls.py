from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("employees", views.EmployeeViewSet, basename="hr-employee")
router.register("team", views.BranchTeamViewSet, basename="hr-team")
router.register("attendance", views.AttendanceViewSet, basename="hr-attendance")
router.register("leave", views.LeaveRequestViewSet, basename="hr-leave")
router.register("payroll", views.PayrollEntryViewSet, basename="hr-payroll")
router.register("task-types", views.BranchTaskTypeViewSet, basename="hr-task-type")
router.register("task-assignments", views.BranchTaskAssignmentViewSet, basename="hr-task-assignment")

urlpatterns = [
    path("summary/", views.HRSummaryView.as_view(), name="hr-summary"),
    path("my-attendance/", views.MyAttendanceView.as_view(), name="my-attendance"),
    *router.urls,
]
