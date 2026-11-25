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


class ChangeRoomTests(APITestCase):
    """A live stay moving to another room — only the unused nights reprice:
    credit = nights left × old rate, cost = nights left × new rate."""

    def setUp(self):
        self.branch = make_branch("West House", "111111")
        self.recep = make("400400", branch=self.branch, first="Rea")
        self.old = make_room(self.branch, "Cottage 1", "5000")
        self.cheap = make_room(self.branch, "Cottage 2", "3000")
        self.same = make_room(self.branch, "Cottage 3", "5000")
        self.dear = make_room(self.branch, "Cottage 4", "7000")
        self.dear2 = make_room(self.branch, "Cottage 5", "7000")
        # Money in or out needs an open till — the front desk opens one first.
        TillSession.objects.create(branch=self.branch, opening_float=0, opened_by=self.recep)
        self.client.force_authenticate(self.recep)

    def book(self, start_offset_h=-1, end_offset_d=3, room=None, kind="stay"):
        r = self.client.post("/api/bnb/bookings/", {
            "room": (room or self.old).id, "guest_name": "Main Guest", "guest_phone": "0712345678",
            "guests": 1, "kind": kind,
            "start": (timezone.now() + timedelta(hours=start_offset_h)).isoformat(),
            "end": (timezone.now() + timedelta(days=end_offset_d)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return Booking.objects.get(pk=r.json()["id"])

    def move(self, booking, room, option, **extra):
        return self.client.post(
            f"/api/bnb/bookings/{booking.pk}/change-room/",
            {"room": room.id, "option": option, **extra}, format="json",
        )

    def test_switch_same_rate(self):
        # Started an hour ago, ends in 3 days — 3 of the 4 nights are unused.
        b = self.book()
        r = self.move(b, self.same, "switch")
        self.assertEqual(r.status_code, 200, r.content)
        b.refresh_from_db()
        self.assertEqual(b.room_id, self.same.id)
        self.assertFalse(BookingPayment.objects.filter(booking=b).exists())

    def test_downgrade_refund(self):
        # credit 3×5000 − cost 3×3000 = 6000 back to the guest.
        b = self.book()
        r = self.move(b, self.cheap, "refund", method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["refund"], "6000.00")
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual(pay.amount, Decimal("-6000"))
        b.refresh_from_db()
        self.assertEqual(b.room_id, self.cheap.id)

    def test_downgrade_extend(self):
        # The 6000 balance buys 6000/3000 = 2 extra nights; checkout moves out.
        b = self.book()
        end = b.end
        r = self.move(b, self.cheap, "extend")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["extra_nights"], 2)
        b.refresh_from_db()
        self.assertEqual(b.end, end + timedelta(days=2))

    def test_downgrade_voucher(self):
        b = self.book()
        r = self.move(b, self.cheap, "voucher")
        self.assertEqual(r.status_code, 200, r.content)
        v = Voucher.objects.get(booking=b)
        self.assertEqual(v.amount, Decimal("6000"))
        self.assertEqual(v.code, r.json()["applied"]["voucher_code"])
        self.assertTrue(v.code.startswith("VC-"))

    def test_upgrade_topup(self):
        # cost 3×7000 − credit 3×5000 = 6000 collected.
        b = self.book()
        r = self.move(b, self.dear, "topup", method="mpesa", reference="QWE123")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["topup"], "6000.00")
        pay = BookingPayment.objects.get(booking=b)
        self.assertEqual((pay.amount, pay.method, pay.reference), (Decimal("6000"), "mpesa", "QWE123"))

    def test_upgrade_shorten(self):
        # 15000 credit covers 2 of 3 nights at 7000 — checkout pulls in a day,
        # the 1000 shortfall of a third night stays as credit.
        b = self.book()
        end = b.end
        r = self.move(b, self.dear, "shorten")
        self.assertEqual(r.status_code, 200, r.content)
        applied = r.json()["applied"]
        self.assertEqual((applied["kept_nights"], applied["leftover"]), (2, "1000.00"))
        b.refresh_from_db()
        self.assertEqual(b.end, end - timedelta(days=1))

    def test_upgrade_split(self):
        # Keep 2 of 3 nights at 7000 = 14000 against the 15000 credit — no
        # top-up needed and the 1000 stays as credit. Keeping all 3 costs
        # 21000, a 6000 top-up.
        b = self.book()
        r = self.move(b, self.dear, "split", nights=2, method="cash")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["applied"]["leftover"], "1000.00")
        b2 = self.book(room=self.old)
        r2 = self.move(b2, self.dear2, "split", nights=3, method="cash")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.json()["applied"]["topup"], "6000.00")

    def test_wrong_option_for_direction(self):
        b = self.book()
        self.assertEqual(self.move(b, self.cheap, "topup").status_code, 400)
        self.assertEqual(self.move(b, self.dear, "refund").status_code, 400)
        self.assertEqual(self.move(b, self.same, "refund").status_code, 400)

    def test_guards(self):
        b = self.book()
        # Same room, missing method on a money option, and a taken room all fail.
        self.assertEqual(self.move(b, self.old, "switch").status_code, 400)
        self.assertEqual(self.move(b, self.cheap, "refund").status_code, 400)
        self.book(room=self.cheap)  # a second live stay already holds the cheap room
        self.assertEqual(self.move(b, self.cheap, "refund", method="cash").status_code, 400)
        # A completed booking can't move.
        b.status = Booking.Status.COMPLETED
        b.save(update_fields=["status"])
        self.assertEqual(self.move(b, self.cheap, "refund", method="cash").status_code, 400)
