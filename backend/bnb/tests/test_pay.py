from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from bnb.models import Booking, BookingPayment, TillSession

from .test_change_room import make, make_branch, make_room


class PayTests(APITestCase):
    """A top-up on a live booking — money into the open till, and
    `extend_nights` buys extra nights on the same room at its nightly rate."""

    def setUp(self):
        self.branch = make_branch("East House", "222222")
        self.recep = make("500500", branch=self.branch, first="Pam")
        self.room = make_room(self.branch, "Suite 1", "5000")
        self.other = make_room(self.branch, "Suite 2", "4000")
        # Money in needs an open till — the front desk opens one first.
        self.till = TillSession.objects.create(branch=self.branch, opening_float=0, opened_by=self.recep)
        self.client.force_authenticate(self.recep)

    def book(self, start_offset_h=-1, end_offset_d=3, room=None, kind="stay"):
        r = self.client.post("/api/bnb/bookings/", {
            "room": (room or self.room).id, "guest_name": "Main Guest", "guest_phone": "0712345678",
            "guests": 1, "kind": kind,
            "start": (timezone.now() + timedelta(hours=start_offset_h)).isoformat(),
            "end": (timezone.now() + timedelta(days=end_offset_d)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return Booking.objects.get(pk=r.json()["id"])

    def pay(self, booking, **data):
        return self.client.post(f"/api/bnb/bookings/{booking.pk}/pay/", data, format="json")

    def test_topup(self):
        b = self.book()
        r = self.pay(b, amount="2000", method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["amount"], "2000.00")
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual((pay.amount, pay.method, pay.reference), (Decimal("2000"), "cash", "Top-up"))
        self.assertNotIn("extra_nights", r.json()["applied"])

    def test_receipt_number_assigned(self):
        """Every payment gets a receipt number — echoed back in `applied`."""
        b = self.book()
        r = self.pay(b, amount="2000", method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual(pay.receipt_number, f"RCP-{pay.pk:04d}")
        self.assertEqual(r.json()["applied"]["receipt"], pay.receipt_number)

    def test_extend(self):
        b = self.book()
        end = b.end
        r = self.pay(b, amount="10000", method="mpesa", reference="ABC123", extend_nights=2)
        self.assertEqual(r.status_code, 200, r.content)
        applied = r.json()["applied"]
        self.assertEqual((applied["extra_nights"], applied["cost"]), (2, "10000.00"))
        b.refresh_from_db()
        self.assertEqual(b.end, end + timedelta(days=2))
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual((pay.amount, pay.method, pay.reference), (Decimal("10000"), "mpesa", "ABC123"))

    def test_extend_clash_rolls_back(self):
        b = self.book()
        # Another stay holds the room right after b's current checkout.
        self.book(start_offset_h=76, end_offset_d=6)
        r = self.pay(b, amount="10000", method="cash", extend_nights=2)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(BookingPayment.objects.filter(booking=b).exists())

    def test_till_closed(self):
        b = self.book()
        self.till.closed_at = timezone.now()
        self.till.save(update_fields=["closed_at"])
        r = self.pay(b, amount="1000", method="cash")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(BookingPayment.objects.filter(booking=b).exists())

    def test_guards(self):
        b = self.book()
        # Zero / negative amounts and a missing method are rejected outright.
        self.assertEqual(self.pay(b, amount="0", method="cash").status_code, 400)
        self.assertEqual(self.pay(b, amount="500").status_code, 400)
        # A day rest can't stretch by nights, and a finished stay can't pay.
        day = self.book(kind="day_rest", room=self.other)
        self.assertEqual(self.pay(day, amount="1000", method="cash", extend_nights=1).status_code, 400)
        b.status = Booking.Status.COMPLETED
        b.save(update_fields=["status"])
        self.assertEqual(self.pay(b, amount="1000", method="cash").status_code, 400)
