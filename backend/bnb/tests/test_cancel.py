from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Booking, BookingPayment, Branch, Room, TillSession, Voucher


def make(code, role=User.Role.BRANCH_RECEPTIONIST, branch=None, first="Test"):
    return User.objects.create_user(
        code=code, password="pass-12345", first_name=first, last_name=code, email=f"{code}@x.test",
        phone="0700000000", role=role, status=User.Status.ACTIVE, branch=branch,
    )


def make_branch(name, code):
    branch = Branch(name=name, phone="0700000000", email=f"{code}@b.test", location="Nairobi", code=code)
    branch.set_password("pass-12345")
    branch.save()
    return branch


def make_room(branch, name, price="5000"):
    return Room.objects.create(branch=branch, name=name, room_type=Room.Type.TWIN, price=price)


class CancelBookingTests(APITestCase):
    """Cancelling a live stay settles money already collected — withdraw it as
    a refund, turn it into a redeemable voucher, or keep it as a refund due."""

    def setUp(self):
        self.branch = make_branch("West House", "111111")
        self.recep = make("400400", branch=self.branch, first="Rea")
        self.room = make_room(self.branch, "Cottage 1", "5000")
        TillSession.objects.create(branch=self.branch, opening_float=0, opened_by=self.recep)
        self.client.force_authenticate(self.recep)

    def book(self, paid=False):
        payload = {
            "room": self.room.id, "guest_name": "Main Guest", "guest_phone": "0712345678",
            "guests": 1, "kind": "stay",
            "start": (timezone.now() - timedelta(hours=1)).isoformat(),
            "end": (timezone.now() + timedelta(days=3)).isoformat(),
        }
        if paid:
            payload["deposit"] = 15000
        r = self.client.post("/api/bnb/bookings/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return Booking.objects.get(pk=r.json()["id"])

    def cancel(self, booking, **data):
        return self.client.post(f"/api/bnb/bookings/{booking.pk}/cancel/", data, format="json")

    def test_keep_is_the_default(self):
        # No settle option — the booking cancels and the money stays on record.
        b = self.book(paid=True)
        r = self.cancel(b)
        self.assertEqual(r.status_code, 200, r.content)
        b.refresh_from_db()
        self.assertEqual(b.status, Booking.Status.CANCELLED)
        self.assertEqual(r.json()["paid"], "15000.00")
        self.assertFalse(Voucher.objects.filter(booking=b).exists())

    def test_refund_withdraws_the_balance(self):
        b = self.book(paid=True)
        r = self.cancel(b, settle="refund", method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        pay = BookingPayment.objects.get(booking=b, method="cash")
        self.assertEqual(pay.amount, Decimal("-15000"))
        self.assertEqual(pay.reference, "Cancellation refund")
        # The negative payment nets the collected money back to zero.
        self.assertEqual(r.json()["paid"], "0.00")

    def test_voucher_issues_credit(self):
        b = self.book(paid=True)
        r = self.cancel(b, settle="voucher")
        self.assertEqual(r.status_code, 200, r.content)
        v = Voucher.objects.get(booking=b)
        self.assertEqual(v.amount, Decimal("15000"))
        self.assertTrue(v.code.startswith("VC-"))
        self.assertEqual(r.json()["vouchers"][0]["code"], v.code)
        self.assertIsNone(r.json()["vouchers"][0]["redeemed_at"])

    def test_refund_needs_method_and_till(self):
        b = self.book(paid=True)
        self.assertEqual(self.cancel(b, settle="refund").status_code, 400)
        TillSession.objects.filter(branch=self.branch).update(closed_at=timezone.now())
        self.assertEqual(self.cancel(b, settle="refund", method="cash").status_code, 400)
        b.refresh_from_db()
        self.assertEqual(b.status, Booking.Status.OCCUPIED)

    def test_settle_without_money_collected_fails(self):
        b = self.book()
        self.assertEqual(self.cancel(b, settle="refund", method="cash").status_code, 400)
        self.assertEqual(self.cancel(b, settle="voucher").status_code, 400)
        r = self.cancel(b)
        self.assertEqual(r.status_code, 200, r.content)

    def test_completed_booking_cant_cancel(self):
        b = self.book()
        b.status = Booking.Status.COMPLETED
        b.save(update_fields=["status"])
        self.assertEqual(self.cancel(b).status_code, 400)
