from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("branches", views.BranchViewSet, basename="bnb-branch")
router.register("rooms", views.RoomViewSet, basename="bnb-room")
router.register("bookings", views.BookingViewSet, basename="bnb-booking")

urlpatterns = [*router.urls]
