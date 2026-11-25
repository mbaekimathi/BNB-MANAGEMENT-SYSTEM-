from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from bnb.models import Booking, ClientSuspension

from .test_change_room import make, make_branch, make_room


class ClientPortalTests(APITestCase):
    """The client portal's profile edits and suspension — guest details live on
    the bookings, so edits fan out to every row under the same rollup key, and a
    suspension blocks new bookings until it's lifted."""

    def setUp(self):
        self.branch = make_branch("Lake House", "555555")
        self.recep = make("700700", branch=self.branch, first="Sam")
        self.room = make_room(self.branch, "Cabin 1", "5000")
        self.client.force_authenticate(self.recep)

    def book(self, name="Main Guest", phone="0712345678", **extra):
        r = self.client.post("/api/bnb/bookings/", {
            "room": self.room.id, "guest_name": name, "guest_phone": phone,
            "guests": 1, "kind": "reservation",
            "start": (timezone.now() + timedelta(days=10)).isoformat(),
            "end": (timezone.now() + timedelta(days=12)).isoformat(),
            **extra,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return Booking.objects.get(pk=r.json()["id"])

    def patch(self, key, **data):
        return self.client.patch(f"/api/bnb/clients/{key}/", data, format="json")

    def test_profile_edit_fans_out(self):
        a = self.book()
        # A second booking under the same key (same phone) — both must update.
        a.end += timedelta(days=10)
        a.start += timedelta(days=10)
        a.save()
        b = self.book()
        key = "ph:254712345678"
        r = self.patch(key, guest_name="Jane Muthoni", guest_nationality="Kenyan", guest_notes="VIP")
        self.assertEqual(r.status_code, 200, r.content)
        for bk in (a, b):
            bk.refresh_from_db()
            self.assertEqual((bk.guest_name, bk.guest_nationality, bk.guest_notes), ("Jane Muthoni", "Kenyan", "VIP"))

    def test_profile_edit_moves_key(self):
        self.book()
        r = self.patch("ph:254712345678", guest_phone="0722000000")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["key"], "ph:254722000000")
        self.assertEqual(Booking.objects.get().guest_phone, "+254722000000")
        # The old key no longer matches anyone.
        self.assertEqual(self.patch("ph:254712345678", guest_name="X").status_code, 404)

    def test_suspend_blocks_new_bookings(self):
        self.book()
        r = self.patch("ph:254712345678", status="suspended", reason="Damaged room last stay")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["suspended"])
        self.assertTrue(ClientSuspension.objects.filter(key="ph:254712345678").exists())
        r = self.client.post("/api/bnb/bookings/", {
            "room": self.room.id, "guest_name": "Same Person", "guest_phone": "0712345678",
            "guests": 1, "kind": "reservation",
            "start": (timezone.now() + timedelta(days=14)).isoformat(),
            "end": (timezone.now() + timedelta(days=15)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reinstate_allows_bookings(self):
        self.book()
        self.patch("ph:254712345678", status="suspended", reason="Noise complaints")
        r = self.patch("ph:254712345678", status="active")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(r.json()["suspended"])
        self.assertFalse(ClientSuspension.objects.exists())
        self.book(
            start=(timezone.now() + timedelta(days=20)).isoformat(),
            end=(timezone.now() + timedelta(days=22)).isoformat(),
        )

    def test_suspension_follows_key_change(self):
        self.book()
        self.patch("ph:254712345678", status="suspended")
        # Editing the phone moves the client — the hold must move with them.
        r = self.patch("ph:254712345678", guest_phone="0733000000")
        self.assertEqual(r.json()["key"], "ph:254733000000")
        self.assertTrue(r.json()["suspended"])
        self.assertTrue(ClientSuspension.objects.filter(key="ph:254733000000").exists())
        r = self.client.post("/api/bnb/bookings/", {
            "room": self.room.id, "guest_name": "Same Person", "guest_phone": "0733000000",
            "guests": 1, "kind": "reservation",
            "start": (timezone.now() + timedelta(days=14)).isoformat(),
            "end": (timezone.now() + timedelta(days=15)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_rollup_marks_suspended_clients(self):
        self.book()
        r = self.client.get("/api/bnb/bookings/clients/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["clients"][0]["suspended"])
        self.patch("ph:254712345678", status="suspended")
        r = self.client.get("/api/bnb/bookings/clients/")
        self.assertTrue(r.json()["clients"][0]["suspended"])
