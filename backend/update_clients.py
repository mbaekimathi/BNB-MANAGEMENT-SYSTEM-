"""Replaces every client in the system with the guests on the current
front-desk room register (Raya Hotel, rooms 14-57 + the "DE" second entries).

Wipes all bookings, companions, payments, packages, referrals, vouchers and
client suspensions across every branch, then rebuilds the register:

- Each register row becomes a booking on the room matching its sheet row
  number (rows 14-57 -> rooms 14-57). Rooms 22, 24 and 28 exist on the sheet
  but not in the DB, so they are created first.
- "DE" rows are second entries — companions on the same room where the dates
  overlap, otherwise their own booking on a free room.
- Phone numbers and M-Pesa transaction codes are generated dummy data.
- Red-flagged register rows are noted on the booking ("FLAGGED in register").
- Positive opening balances are recorded as M-Pesa advance payments made
  before check-in; rows with no payment land as unpaid balances.

Run from backend/:  .venv/Scripts/python.exe update_clients.py
"""
import os
import random
import string
from datetime import datetime, time as dtime, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.utils import timezone

from bnb.models import (
    Booking, BookingGuest, BookingPackage, BookingPayment, Branch,
    ClientSuspension, Referral, Room, Voucher,
)
from accounts.models import User

random.seed(20261127)

TZ = timezone.get_current_timezone()
TODAY = timezone.localdate()


def at(day, hour, minute=0):
    return timezone.make_aware(datetime.combine(day, dtime.min), TZ) + timedelta(
        hours=hour, minutes=minute)


def phone():
    return f"07{random.randint(10, 99)}{random.randint(100000, 999999)}"


def mpesa_ref():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


def pay_ref(method):
    if method == "mpesa":
        return mpesa_ref()
    if method == "visa":
        return f"VISA-{random.randint(100000, 999999)}"
    if method == "bank":
        return f"TRF{random.randint(10000000, 99999999)}"
    return f"CSH{random.randint(100000, 999999)}"


def wipe_clients():
    """Delete every client-facing record — config (branches/rooms) stays."""
    order = [
        ("booking payments", BookingPayment), ("booking packages", BookingPackage),
        ("booking guests", BookingGuest), ("referrals", Referral),
        ("vouchers", Voucher), ("bookings", Booking),
        ("client suspensions", ClientSuspension),
    ]
    for label, model in order:
        n = model.objects.count()
        model.objects.all().delete()
        print(f"  wiped {n:>5} {label}")


# ---------------------------------------------------------------- register
# room, guest, type, pax, market source / contact note, in, out, rate,
# (paid amount, method), mpesa advance (positive opening balance),
# flagged (red row). Methods: cash = Cash column, mpesa = yellow-highlighted
# cells, visa = the two Card-column cells (2,500 + 2,000 = the sheet's 4,500).
D = lambda s: datetime.strptime(s, "%d.%m.%y").date()
REGISTER = [
    (1,  "DINAH KERUBO",       "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (2,  "ERICK ANTONY",       "double", 1, "JOHNTE JEGA 2.5",      D("22.11.26"), D("28.11.26"), 2000, 0,          None,    False),
    (3,  "ALLY CHARLES",       "double", 1, "JOHNTE JEGA 2.5",      D("22.11.26"), D("28.11.26"), 2000, 0,          None,    False),
    (4,  "NATHAN/BRIAN/DOREEN","twin",   1, "REG (UG)",             D("26.11.26"), D("28.11.26"), 2500, 2500,       "cash",  False),
    (5,  "ELINGAA MICHAEL",    "deluxe", 1, "MOZAIKO",              D("22.11.26"), D("24.11.26"), 1000, 1000,       "cash",  False),
    (6,  "CAROLINE YEGO",      "double", 1, "WALKIN",               D("25.11.26"), D("28.11.26"), 2000, 0,          "cash",  True),
    (7,  "SHARON",             "deluxe", 1, "REG",                  D("26.11.26"), D("27.11.26"), 1500, 1000,       "cash",  False),
    (8,  "DOROTHY LUSUETI",    "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (9,  "BENJAMIN KIMBOWA",   "deluxe", 1, "BENJAMIN 0722455474 (UG 3.5)", D("26.11.26"), D("28.11.26"), 1000, 6000, "cash", False),
    (10, "GODFREY MOTHORI",    "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (11, "DAVID",              "single", 1, "MOZAIKO (conductor)",  D("26.11.26"), D("28.11.26"), 1000, 1000,       "cash",  False),
    (12, "DANIEL CHISMA",      "single", 1, "OMOSH",                D("26.11.26"), D("27.11.26"), 2000, 2000,       "mpesa", False),
    (14, "KAFANG",             "double", 1, "REGULAR",              D("15.03.26"), D("16.03.26"), 2000, 0,          "cash",  True),
    (15, "JOSEPH MULO",        "double", 1, "REG",                  D("12.11.26"), D("13.11.26"), 2000, 0,          "cash",  True),
    (16, "KHALID SAID",        "double", 1, "JANE 30/3/26 (TZ)",    D("25.11.26"), D("26.11.26"), 2000, 0,          "cash",  True),
    (17, "RACHEL",             "double", 1, "WALKIN",               D("19.11.26"), D("20.11.26"), 2000, 6000,       "cash",  False),
    (18, "SCHOLASTICA BOLLEH", "twin",   1, "GEORGE JEGA",          D("22.11.26"), D("25.11.26"), 2500, 2500,       "cash",  False),
    (19, "VIVIAN JEPTANUI",    "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (20, "SAMUEL MUTABAZI",    "double", 1, "REG",                  D("25.11.26"), D("29.11.26"), 2000, 0,          None,    False),
    (21, "GODFREY GRACEWELL",  "deluxe", 1, "DUMA JEGA (R.D)",      D("22.11.26"), D("24.11.26"), 2500, 2500,       "visa",  True),
    (22, "DUNCAN NDEGE",       "single", 1, "WALKIN",               D("26.11.26"), D("27.11.26"), 2000, 2000,       "visa",  False),
    (23, "OWEN",               "single", 1, "REG",                  D("26.11.26"), D("28.11.26"), 1500, 1500,       "cash",  False),
    (24, "BAZANGU MUTUMBA",    "double", 1, "ISAACK 0725101119 (Congolese)", D("25.11.26"), D("28.11.26"), 2500, 2500, "cash", False),
    (25, "BOBBAN",             "double", 1, "TAHMEED",              D("20.11.26"), D("21.11.26"), 1500, 0,          "cash",  True),
    (26, "ABDALLAH",           "double", 1, "REG",                  D("26.11.26"), D("27.11.26"), 2000, 2000,       "cash",  False),
    (27, "VASTHY KAVIRA",      "single", 1, "KIM BEBETO",           D("21.11.26"), D("23.11.26"), 1000, 0,          None,    False),
    (28, "HILLARY CHONWONY",   "double", 1, "WALKIN",               D("26.11.26"), D("27.11.26"), 1500, 1500,       "mpesa", False),
    (29, "RONALD OUMA",        "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (30, "DANATUS SOMBA",      "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (31, "MAVEN",              "double", 1, "BENJAMIN JEGA 2.5 (Canada)", D("24.11.26"), D("25.11.26"), 2000, 0,    None,    False),
    (32, "WILLIAM PETEIT",     "double", 1, "STAN BEBETO",          D("21.11.26"), D("27.11.26"), 2500, 0,          None,    False),
    (33, "GEORGE NYAMBONGO",   "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (34, "BENSON NYAKUNDI",    "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (35, "THOMAS KAZUNGU",     "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (36, "ABDUL AZIZA",        "deluxe", 2, "JOSEPH 0722508472",    D("14.10.26"), D("15.10.26"), 1000, 0,          "cash",  True),
    (37, "HILARY KIMTAI",      "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (38, "MWALA FAUSTINE",     "double", 1, "MWANGI",               D("25.11.26"), D("28.11.26"), 2500, 0,          None,    False),
    (39, "MERCY LUKELA",       "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (40, "HAROUN ABBAKER",     "double", 1, "WALKIN",               D("26.11.26"), D("27.11.26"), 2000, 2000,       "cash",  False),
    (41, "MOSES ONDERI",       "single", 1, "WALKIN",               D("26.11.26"), D("28.11.26"), 2000, 2000,       "cash",  False),
    (42, "LOUISE NKASA",       "single", 1, "BEN (Congolaise)",     D("24.11.26"), D("25.11.26"), 2000, 2000,       "cash",  False),
    (43, "AFRED ODHIAMBO",     "single", 1, "WALKIN",               D("26.11.26"), D("27.11.26"), 2000, 2000,       "mpesa", False),
    (44, "DANIEL NDUNGU",      "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (45, "CATHERINE NDUNGE",   "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (46, "JOSEPH PRO",         "double", 1, "TAHMEED (driver)",     D("19.11.26"), D("20.11.26"), 1500, 0,          "cash",  True),
    (47, "JOHN MAINA",         "double", 1, "PROGRESSIVE",          D("26.11.26"), D("27.11.26"), 1500, 0,          "cash",  False),
    (48, "LYDIA MAYO",         "double", 1, "AGENT",                D("26.11.26"), D("27.11.26"), 2500, 2500,       "mpesa", False),
    (49, "NESTA MWALE",        "double", 1, "DAN JEGA",             D("26.11.26"), D("27.11.26"), 2500, 2500,       "cash",  False),
    (50, "STEPHEN MATHAYO",    "double", 1, "JOEL TRINITY",         D("26.11.26"), D("27.11.26"), 2500, 2500,       "cash",  False),
    (53, "MUSA",               "single", 1, "driver",               D("26.11.26"), D("28.11.26"), 1000, 1000,       "cash",  False),
    (54, "OSMAN OSMAN",        "double", 1, "REGULAR",              D("25.09.26"), D("28.09.26"), 1500, 0,          "cash",  True),
    (55, "VENOLIA",            "single", 1, "REGULAR",              D("26.11.26"), D("28.11.26"), 1500, 1500,       "cash",  False),
    (56, "KENETH NYAWEGI",     "single", 1, "WALKIN",               D("26.11.26"), D("27.11.26"), 2000, 2000,       "mpesa", False),
    (57, "ABDALLAH",           "single", 1, "MOZAIKO (driver)",     D("26.11.26"), D("28.11.26"), 1000, 1000,       "cash",  False),
]

# Positive opening balances — advance money already held, taken by M-Pesa
# before the stay: room -> amount.
ADVANCES = {2: 2000, 3: 2000, 20: 4000, 27: 1000, 31: 2000, 32: 2500, 38: 2500}

# Row 52 — Daniel Ng'ang'a checked in and out the same day -> day rest.
DAY_RESTS = [
    (52, "DANIEL NG'ANG'A", "single", 1, "WALKIN", D("25.11.26"), 1500, 1500),
]

# "DE" section — second entries. `room` is the register room; when the dates
# don't overlap the room's main booking they get their own booking instead.
DE_OWN = [
    # room, guest, market source / note, in, out, rate, cash
    (27, "NINAH KUBAI", "PROGRESSIVE",       D("26.11.26"), D("27.11.26"), 1500, 0),
]
DE_COMPANIONS = [
    # room, guest, market source / note, in, out, rate, cash
    (1,  "AGNES",           "MOZAIKO (hostess)", D("26.11.26"), D("28.11.26"), 1000, 1000),
    (56, "ARK",             "SHOWER (UG)", D("26.11.26"), D("28.11.26"), 1300, 1300),
    (53, "KISII B2X",       "REGULAR",     D("26.11.26"), D("27.11.26"), 1500, 0),
    (55, "DAPHINE MUTHONI", "PROGRESSIVE", D("26.11.26"), D("27.11.26"), 1500, 0),
    (57, "MARGRET",         "",            D("26.11.26"), D("27.11.26"), 1500, 1500),
]


def status_for(checkin, checkout):
    if checkout < TODAY:
        return Booking.Status.COMPLETED
    return Booking.Status.OCCUPIED


def make_booking(branch, room, name, source, checkin, checkout, rate, pax,
                 paid, method, advance, flagged, desk_user, kind=Booking.Kind.STAY):
    status = status_for(checkin, checkout)
    notes = [f"Market source: {source}"] if source else []
    if flagged:
        notes.append("FLAGGED red on the register — check balance.")
    walkin = source.upper().startswith("WALKIN")
    start, end = at(checkin, 12, random.choice([0, 15, 30])), at(checkout, 10)
    created = (start - timedelta(hours=random.randint(0, 3)) if walkin
               else at(checkin, 10) - timedelta(days=random.randint(1, 8),
                                                hours=random.randint(0, 8)))
    b = Booking.objects.create(
        branch=branch, room=room, guest_name=name, guest_phone=phone(),
        guest_nationality="", guests=pax, guest_notes="\n".join(notes),
        kind=kind, status=status, start=start, end=end, rate=rate,
        created_by=desk_user,
    )
    Booking.objects.filter(pk=b.pk).update(created_at=created, updated_at=created)

    def pay(amount, method, when, companion=None):
        p = BookingPayment.objects.create(
            booking=b, companion=companion, amount=amount, method=method,
            reference=pay_ref(method))
        BookingPayment.objects.filter(pk=p.pk).update(created_at=when)
        return p

    if advance:
        # Positive opening balance — money already held, came in by M-Pesa
        # a few days before the stay.
        pay(advance, "mpesa",
            at(checkin, random.randint(9, 18)) - timedelta(days=random.randint(2, 6)))
    if paid and method:
        # In-house guests pay at the desk today (the register day); guests who
        # already checked out paid during their stay.
        when = (at(TODAY, random.randint(7, 14), random.randint(0, 59))
                if status == Booking.Status.OCCUPIED
                else at(checkout, 9, random.randint(0, 59)) - timedelta(days=1))
        pay(paid, method, when)
    return b


def main():
    branch = Branch.objects.get(name="Raya Hotel")
    desk_user = (User.objects.filter(branch=branch).first()
                 or User.objects.first())

    print("Wiping clients…")
    wipe_clients()

    # Rooms on the sheet that are missing from the branch.
    for name, rtype, cap, price in [("22", "single", 1, 2000),
                                    ("24", "double", 2, 2500),
                                    ("28", "double", 2, 2500)]:
        Room.objects.get_or_create(
            branch=branch, name=name,
            defaults={"room_type": rtype, "capacity": cap, "price": price})

    rooms = {r.name: r for r in Room.objects.filter(branch=branch)}
    bookings = {}

    print("Seeding register…")
    for row in REGISTER:
        room, name, rtype, pax, source, cin, cout, rate, paid, method, flag = row
        bookings[room] = make_booking(
            branch, rooms[str(room)], name, source, cin, cout, rate, pax,
            paid, method, ADVANCES.get(room, 0), flag, desk_user)

    for room, name, rtype, pax, source, day, rate, cash in DAY_RESTS:
        b = Booking.objects.create(
            branch=branch, room=rooms[str(room)], guest_name=name,
            guest_phone=phone(), guests=pax,
            guest_notes=f"Market source: {source}" if source else "",
            kind=Booking.Kind.DAY_REST, status=Booking.Status.COMPLETED,
            start=at(day, 10, 30), end=at(day, 16, 30), rate=rate,
            created_by=desk_user)
        Booking.objects.filter(pk=b.pk).update(created_at=at(day, 10))
        p = BookingPayment.objects.create(booking=b, amount=cash, method="cash",
                                          reference=pay_ref("cash"))
        BookingPayment.objects.filter(pk=p.pk).update(
            created_at=at(TODAY, random.randint(7, 14), random.randint(0, 59)))

    for room, name, source, cin, cout, rate, cash in DE_OWN:
        bookings[room] = make_booking(
            branch, rooms[str(room)], name, source, cin, cout, rate, 1,
            cash, "cash", 0, False, desk_user)

    for room, name, source, cin, cout, rate, cash in DE_COMPANIONS:
        b = bookings[room]
        c = BookingGuest.objects.create(
            booking=b, name=name, phone=phone(),
            notes=f"Market source: {source}" if source else "",
            start=at(cin, 12), end=at(cout, 10), rate=rate)
        b.guests += 1
        b.save(update_fields=["guests"])
        if cash:
            p = BookingPayment.objects.create(
                booking=b, companion=c, amount=cash, method="cash",
                reference=pay_ref("cash"))
            BookingPayment.objects.filter(pk=p.pk).update(
                created_at=at(TODAY, random.randint(7, 14), random.randint(0, 59)))

    print(f"  bookings:  {Booking.objects.count()}")
    print(f"  guests:    {BookingGuest.objects.count()} companions")
    print(f"  payments:  {BookingPayment.objects.count()} "
          f"({BookingPayment.objects.filter(method='mpesa').count()} M-Pesa)")
    print(f"  occupied:  {Booking.objects.filter(status='occupied').count()} · "
          f"completed: {Booking.objects.filter(status='completed').count()}")


if __name__ == "__main__":
    main()
