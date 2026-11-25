from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("branches", views.BranchViewSet, basename="bnb-branch")
router.register("rooms", views.RoomViewSet, basename="bnb-room")
router.register("packages", views.PackageViewSet, basename="bnb-package")
router.register("bookings", views.BookingViewSet, basename="bnb-booking")
router.register("referrals", views.ReferralViewSet, basename="bnb-referral")
router.register("tickets", views.TicketViewSet, basename="bnb-ticket")
router.register("expenses", views.ExpenseViewSet, basename="bnb-expense")
router.register("suppliers", views.SupplierViewSet, basename="bnb-supplier")
router.register("stock-purchases", views.StockPurchaseViewSet, basename="bnb-stock-purchase")
router.register("tills", views.TillViewSet, basename="bnb-till")

urlpatterns = [
    path("my-branch/", views.BranchProfileView.as_view(), name="my-branch"),
    path("clients/<str:key>/", views.ClientPortalView.as_view(), name="client-portal"),
    *router.urls,
]
