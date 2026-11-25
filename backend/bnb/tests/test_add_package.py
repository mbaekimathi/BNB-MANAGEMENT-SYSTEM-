from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from bnb.models import Booking, BookingPackage, BookingPayment, ExtraPackage, TillSession

from .test_change_room import make, make_branch, make_room


def make_package(branch, name="Airport pickup", amount="2500", status=ExtraPackage.Status.ACTIVE):
    return ExtraPackage.objects.create(branch=branch, name=name, amount=amount, status=status)


class AddPackageTests(APITestCase):
    """Selling an extra package on a live stay — the catalogue name/price
    snapshot onto the bill, and `method` collects the money in the same call."""

    def setUp(self):
        self.branch = make_branch("North House", "333333")
        self.recep = make("600600", branch=self.branch, first="Pat")
        self.room = make_room(self.branch, "Villa 1", "5000")
        self.pkg = make_package(self.branch)
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

    def add(self, booking, **data):
        return self.client.post(
            f"/api/bnb/bookings/{booking.pk}/add-package/",
            {"package": self.pkg.pk, **data}, format="json",
        )

    def test_bill_only(self):
        """No method — the package lands on the bill, unpaid."""
        b = self.book()
        r = self.add(b)
        self.assertEqual(r.status_code, 200, r.content)
        applied = r.json()["applied"]
        self.assertEqual((applied["name"], applied["amount"]), ("Airport pickup", "2500.00"))
        self.assertNotIn("paid", applied)
        row = BookingPackage.objects.get(booking=b)
        self.assertEqual((row.name, row.amount), ("Airport pickup", Decimal("2500")))
        self.assertFalse(BookingPayment.objects.filter(booking=b).exists())
        # The bill now counts the room nights plus the package.
        nights = int(r.json()["booking"]["nights"])
        self.assertEqual(Decimal(r.json()["booking"]["bill"]), Decimal(nights * 5000 + 2500))

    def test_add_and_pay(self):
        b = self.book()
        r = self.add(b, method="mpesa", reference="PKG123")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["paid"], "2500.00")
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual((pay.amount, pay.method, pay.reference), (Decimal("2500"), "mpesa", "PKG123"))

    def test_pay_defaults_reference_to_package_name(self):
        b = self.book()
        r = self.add(b, method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(BookingPayment.objects.get(booking=b).reference, "Airport pickup")

    def test_guest_position_targets_companion(self):
        r = self.client.post("/api/bnb/bookings/", {
            "room": self.room.id, "guest_name": "Main Guest", "guest_phone": "0712345678",
            "guests": 2, "kind": "stay",
            "companions": [{"name": "Plus One", "phone": "0722000000"}],
            "start": (timezone.now() - timedelta(hours=1)).isoformat(),
            "end": (timezone.now() + timedelta(days=3)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        b = Booking.objects.get(pk=r.json()["id"])
        r = self.add(b, guest=1, method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        row = BookingPackage.objects.get(booking=b)
        self.assertEqual(row.companion.name, "Plus One")
        self.assertEqual(BookingPayment.objects.get(booking=b).companion, row.companion)
        # A position past the party is rejected.
        self.assertEqual(self.add(b, guest=2).status_code, 400)

    def test_guards(self):
        b = self.book()
        # Suspended packages can't be sold.
        self.pkg.status = ExtraPackage.Status.SUSPENDED
        self.pkg.save(update_fields=["status"])
        self.assertEqual(self.add(b).status_code, 400)
        self.pkg.status = ExtraPackage.Status.ACTIVE
        self.pkg.save(update_fields=["status"])
        # Another branch's package is out of reach.
        other_branch = make_branch("South House", "444444")
        foreign = make_package(other_branch)
        self.assertEqual(
            self.client.post(f"/api/bnb/bookings/{b.pk}/add-package/", {"package": foreign.pk}, format="json").status_code,
            400,
        )
        # A finished stay takes nothing.
        b.status = Booking.Status.COMPLETED
        b.save(update_fields=["status"])
        self.assertEqual(self.add(b).status_code, 400)

    def test_till_closed_blocks_payment(self):
        b = self.book()
        self.till.closed_at = timezone.now()
        self.till.save(update_fields=["closed_at"])
        # Collecting is blocked — but the package can still go on the bill.
        self.assertEqual(self.add(b, method="cash").status_code, 400)
        self.assertFalse(BookingPackage.objects.filter(booking=b).exists())
        self.assertEqual(self.add(b).status_code, 200)
        self.assertTrue(BookingPackage.objects.filter(booking=b).exists())
        self.assertFalse(BookingPayment.objects.filter(booking=b).exists())
