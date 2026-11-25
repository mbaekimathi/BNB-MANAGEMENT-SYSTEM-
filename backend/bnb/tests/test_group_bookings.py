from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Booking, BookingPayment, Branch, Room, TillSession


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


class GroupBookingTests(APITestCase):
    """A party where extra guests hold their own rooms registers as separate
    clients — one booking each, each with its own room, bill and payments."""

    def setUp(self):
        self.branch = make_branch("West House", "111111")
        self.recep = make("400400", branch=self.branch, first="Rea")
        self.r1 = make_room(self.branch, "Cottage 1")
        self.r2 = make_room(self.branch, "Cottage 2")
        self.r3 = make_room(self.branch, "Cottage 3")
        self.start = (timezone.now() + timedelta(hours=1)).isoformat()
        self.end = (timezone.now() + timedelta(days=2)).isoformat()
        # Check-ins are locked to an open till — the front desk opens one first.
        TillSession.objects.create(branch=self.branch, opening_float=0, opened_by=self.recep)
        self.client.force_authenticate(self.recep)

    def post(self, companions, payments=None, guests=None):
        return self.client.post("/api/bnb/bookings/", {
            "room": self.r1.id, "guest_name": "Main Guest", "guest_phone": "0712345678",
            "guests": guests if guests is not None else len(companions) + 1,
            "kind": "stay", "start": self.start, "end": self.end,
            "companions": companions, "payments": payments or [],
        }, format="json")

    def test_own_room_companions_become_separate_clients(self):
        r = self.post([
            {"name": "Guest Two", "phone": "0722222222", "room": self.r2.id},
            {"name": "Guest Three", "phone": "0733333333", "room": self.r3.id},
        ])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Booking.objects.count(), 3)
        main = Booking.objects.get(pk=r.json()["id"])
        self.assertEqual(main.guests, 1)  # nobody shares the main room
        self.assertEqual(main.companions.count(), 0)
        members = {b.guest_name: b for b in Booking.objects.exclude(pk=main.pk)}
        self.assertEqual(set(members), {"Guest Two", "Guest Three"})
        self.assertEqual(members["Guest Two"].room_id, self.r2.id)
        self.assertEqual(members["Guest Three"].room_id, self.r3.id)
        self.assertTrue(all(b.status == main.status for b in members.values()))
        self.assertTrue(all(b.guests == 1 for b in members.values()))

    def test_room_sharer_stays_on_the_main_booking(self):
        r = self.post([
            {"name": "Guest Two", "phone": "0722222222", "room": self.r2.id},
            {"name": "Guest Three", "phone": "0733333333", "room": None},
        ])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Booking.objects.count(), 2)
        main = Booking.objects.get(pk=r.json()["id"])
        self.assertEqual(main.guests, 2)  # main guest + the sharer
        self.assertEqual(main.companions.get().name, "Guest Three")

    def test_payments_follow_each_member_to_their_booking(self):
        r = self.post(
            [
                {"name": "Guest Two", "phone": "0722222222", "room": self.r2.id},
                {"name": "Guest Three", "phone": "0733333333", "room": None},
            ],
            payments=[
                {"guest": 0, "amount": "6000", "method": "cash", "reference": "R1"},
                {"guest": 1, "amount": "5000", "method": "mpesa", "reference": "R2"},
                {"guest": 2, "amount": "2000", "method": "cash", "reference": "R3"},
            ],
        )
        self.assertEqual(r.status_code, 201, r.content)
        main = Booking.objects.get(pk=r.json()["id"])
        member = Booking.objects.get(guest_name="Guest Two")
        # Guest 0's and the room-sharer's money land on the main booking — the
        # sharer's row names them as the payer via `companion`.
        by_amount = {str(p.amount): p for p in main.payments.all()}
        self.assertIsNone(by_amount["6000.00"].companion_id)
        self.assertEqual(by_amount["2000.00"].companion_id, main.companions.get().id)
        member_payments = list(member.payments.all())
        self.assertEqual(len(member_payments), 1)
        self.assertEqual(str(member_payments[0].amount), "5000.00")
        self.assertEqual(member_payments[0].reference, "R2")

    def test_each_payment_gets_a_receipt_number(self):
        """Payments written through bulk_create skip save(), so the numbers
        are stamped on afterwards — one unique RCP- number per payment."""
        r = self.post([], payments=[
            {"guest": 0, "amount": "6000", "method": "cash"},
            {"guest": 0, "amount": "1000", "method": "mpesa", "reference": "QAB123"},
        ])
        self.assertEqual(r.status_code, 201, r.content)
        numbers = list(BookingPayment.objects.values_list("receipt_number", flat=True))
        self.assertEqual(len(numbers), 2)
        self.assertTrue(all(n and n.startswith("RCP-") for n in numbers))
        self.assertEqual(len(set(numbers)), 2)

    def test_two_companions_cannot_hold_the_same_room(self):
        r = self.post([
            {"name": "Guest Two", "phone": "0722222222", "room": self.r2.id},
            {"name": "Guest Three", "phone": "0733333333", "room": self.r2.id},
        ])
        self.assertEqual(r.status_code, 400)
        self.assertIn("companions", r.json())
        self.assertEqual(Booking.objects.count(), 0)

    def test_companion_room_cannot_be_the_main_room(self):
        r = self.post([
            {"name": "Guest Two", "phone": "0722222222", "room": self.r1.id},
        ])
        self.assertEqual(r.status_code, 400)
        self.assertIn("companions", r.json())
        self.assertEqual(Booking.objects.count(), 0)

    def test_each_member_checks_out_independently(self):
        r = self.post([
            {"name": "Guest Two", "phone": "0722222222", "room": self.r2.id},
        ])
        self.assertEqual(r.status_code, 201, r.content)
        member = Booking.objects.get(guest_name="Guest Two")
        out = self.client.post(f"/api/bnb/bookings/{member.id}/checkout/", {}, format="json")
        self.assertEqual(out.status_code, 200, out.content)
        member.refresh_from_db()
        self.assertEqual(member.status, "completed")
        # Only that client's room frees — the main booking stays live.
        self.assertEqual(Booking.objects.get(pk=r.json()["id"]).status, "occupied")
