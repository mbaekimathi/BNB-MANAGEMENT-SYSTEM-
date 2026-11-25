"""Resets transactional data and seeds ~2 months of coherent demo activity.

Keeps configuration (branches, rooms + photos, extra-package catalogue,
users, branch settings, task types) and rebuilds everything a front desk
would have produced: bookings, payments, companions, extra-package sales,
referral vouchers, credit vouchers, till sessions + drawings, expenses,
stock purchases, suppliers, tickets, attendance, task assignments, leave
requests and payroll.

Run from backend/:  .venv/Scripts/python.exe seed_demo.py
"""
import os
import random
import string
from datetime import datetime, time as dtime, timedelta
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from bnb.models import (
    Booking, BookingGuest, BookingPackage, BookingPayment, Branch,
    ClientSuspension, Expense, ExtraPackage, Referral, Room, StockPurchase,
    Supplier, Ticket, TicketItem, TillDrawing, TillSession, Voucher,
)
from hr.models import (
    Attendance, LeaveRequest, PayrollEntry, TaskAssignment, TaskType,
)

random.seed(20240817)

TZ = timezone.get_current_timezone()
TODAY = timezone.localdate()
START = TODAY - timedelta(days=60)
FUTURE = TODAY + timedelta(days=10)
DAYS = [START + timedelta(days=i) for i in range(61)]  # START … TODAY inclusive


def at(day, hour, minute=0):
    """A timezone-aware datetime on `day` — minute may overflow the hour."""
    return timezone.make_aware(datetime.combine(day, dtime.min), TZ) + timedelta(
        hours=hour, minutes=minute)


def rand_dt(day, h1=8, h2=21):
    """Random wall-clock time on `day` between h1:00 and h2:00 — always inside
    a till window (sessions open 06:45, close 21:30+)."""
    return at(day, random.randint(h1, h2), random.randint(0, 59))


def money(lo, hi, step=100):
    return Decimal(random.randrange(int(lo), int(hi) + 1, int(step)))


# ---------------------------------------------------------------- name pools
FIRST = [
    "Wanjiru", "Otieno", "Mwangi", "Achieng", "Kiprop", "Nyambura", "Kamau",
    "Wairimu", "Mutua", "Njeri", "Omondi", "Chebet", "Maina", "Atieno",
    "Kilonzo", "Wafula", "Moraa", "Kariuki", "Anyango", "Barasa", "Wambui",
    "Gitonga", "Kerubo", "Njoroge", "Adhiambo", "Mutiso", "Nyakerario",
    "Cherono", "Muriuki", "Awuor", "Kiptoo", "Wanjiku", "Onyango", "Muthoni",
    "Simiyu", "Kwamboka", "Ruto", "Nafula", "Ogutu", "Kanini",
]
LAST = [
    "Kimani", "Odhiambo", "Ndegwa", "Juma", "Wafula", "Mbugua", "Owino",
    "Chepkirui", "Mwangi", "Akinyi", "Musyoka", "Wanjala", "Nyakundi",
    "Gichuki", "Achieng", "Baraka", "Wesonga", "Kibet", "Moraa", "Njogu",
    "Ochieng", "Wambua", "Kirwa", "Atieno", "Mulei", "Nyanchama", "Sang",
    "Wairimu", "Ogot", "Khasoa",
]
INTL = [
    ("Sarah", "Johnson", "American"), ("Michael", "Smith", "British"),
    ("Aisha", "Mohammed", "Tanzanian"), ("David", "Mugisha", "Ugandan"),
    ("Emma", "van der Berg", "Dutch"), ("Lucas", "Muller", "German"),
    ("Priya", "Sharma", "Indian"), ("Chen", "Wei", "Chinese"),
    ("Fatuma", "Hassan", "Somali"), ("Jean", "Uwase", "Rwandan"),
    ("Maria", "Santos", "Brazilian"), ("Tom", "Baker", "British"),
    ("Grace", "Nakato", "Ugandan"), ("Peter", "Mwalimu", "Tanzanian"),
]
NATIONALITIES = ["Kenyan"] * 7 + ["Ugandan", "Tanzanian", "British", "American",
                                "German", "Dutch", "Indian", "Rwandan", "Somali", "Nigerian"]
EMAIL_HOSTS = ["gmail.com", "gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]

SUPPLIERS = [
    ("Naivas Supermarket", "0711002200"), ("KAPA Oil Refineries", "0722334455"),
    ("Bidco Africa", "0733445566"), ("ElecTric Solutions Ltd", "0744556677"),
    ("Aqua Pure Supplies", "0755667788"), ("Mama Mboga Fresh", "0766778899"),
    ("CleanCo Distributors", "0777889900"), ("Kenchic Ltd", "0788990011"),
    ("Brookside Dairy", "0799001122"), ("Unga Farm Care", "0700112233"),
]
STOCK_ITEMS = [
    ("Bottled water 500ml (crate)", 24, 280), ("Soda 300ml (crate)", 24, 480),
    ("Minute Maid juice 400ml (crate)", 12, 540), ("Beer assorted (crate)", 24, 2400),
    ("Toilet paper (bale)", 48, 620), ("Bath soap (carton)", 72, 1150),
    ("Laundry detergent 5kg", 4, 1450), ("Toothpaste & brush kit (box)", 50, 800),
    ("Instant coffee sachets (box)", 100, 950), ("Tea bags (box)", 100, 780),
    ("Sugar 2kg", 10, 380), ("Milk UHT 500ml (case)", 12, 660),
    ("Snack biscuits (carton)", 60, 900), ("Disinfectant 5L", 4, 980),
]
EXPENSE_POOL = [
    ("utilities", "Kenya Power electricity bill", (8000, 24000)),
    ("utilities", "County water bill", (2500, 8000)),
    ("utilities", "Zuku fibre internet", (4499, 4499)),
    ("supplies", "Housekeeping supplies", (1500, 6000)),
    ("supplies", "Guest toiletries restock", (1200, 4500)),
    ("maintenance", "Plumber — leaking pipes repair", (1500, 7000)),
    ("maintenance", "Electrician — faulty sockets", (1200, 5500)),
    ("maintenance", "AC servicing — rooms block", (3000, 9000)),
    ("maintenance", "Fumigation service", (6000, 14000)),
    ("transport", "Fuel for shuttle van", (3000, 8000)),
    ("food_beverage", "Fresh produce — kitchen", (2000, 7000)),
    ("food_beverage", "Bakery — breakfast bread", (800, 2500)),
    ("marketing", "Facebook ads boost", (1500, 5000)),
    ("salaries", "Casual workers — garden & cleaning", (2000, 6000)),
    ("other", "Security company monthly fee", (9000, 15000)),
    ("other", "Garbage collection fee", (1500, 3500)),
]
TICKET_TEMPLATES = {
    "maintenance": [
        "Leaking shower head", "AC not cooling", "TV remote not working",
        "Door lock jammed", "Hot water not working", "Broken window latch",
        "Toilet cistern running", "Ceiling fan noisy", "Socket sparking",
        "Bed frame loose",
    ],
    "housekeeping": [
        "Deep clean after checkout", "Stained bedsheets replacement",
        "Carpet shampoo needed", "Extra towels requested",
        "Balcony rails need scrubbing", "Curtain rail fell off",
    ],
    "guest_request": [
        "Late checkout request", "Baby cot requested", "Extra pillows",
        "Airport pickup enquiry", "Early breakfast request",
    ],
    "complaint": [
        "Noise from neighbouring room", "Slow Wi-Fi in room",
        "Cold breakfast complaint", "Mosquitoes in room",
    ],
    "it_system": ["POS printer jammed", "Wi-Fi router restart — block B", "Key card encoder fault"],
    "inventory": ["Towel stock running low", "Minibar items short"],
    "other": ["Signage for parking", "Garden lighting review"],
}
DRAWING_REASONS = {
    "cash": ["Banked to KCB", "Banked to Equity", "Cash to manager", "Change float top-up"],
    "mpesa": ["M-Pesa float withdrawal to bank", "Till sweep to head office", "Sent to supplier via M-Pesa"],
    "visa": ["Card settlement transfer", "Card float to bank"],
}
TASK_NAMES = ["Room cleaning", "Breakfast prep", "Laundry & linen", "Grounds & pool",
              "Maintenance check", "Front desk cover", "Stock take"]
DRAWING_GIVERS = ["Branch manager", "Accountant", "Head office", "Owner"]


def phone():
    return f"07{random.randint(10, 99)}{random.randint(100000, 999999)}"


def guest():
    """(name, phone, email, nationality) — mostly Kenyan, some international."""
    if random.random() < 0.72:
        first, last = random.choice(FIRST), random.choice(LAST)
        nationality = random.choice(NATIONALITIES)
    else:
        first, last, nationality = random.choice(INTL)
    name = f"{first} {last}"
    email = f"{first.lower()}.{last.lower().replace(' ', '')}@{random.choice(EMAIL_HOSTS)}" if random.random() < 0.6 else ""
    return name, phone(), email, nationality


def mpesa_ref():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


def pay_ref(method):
    if method == "mpesa":
        return mpesa_ref()
    if method == "visa":
        return f"VISA-{random.randint(100000, 999999)}"
    if method == "bank":
        return f"TRF{random.randint(10000000, 99999999)}"
    return ""


def overlaps(intervals, start, end):
    return any(s < end and start < e for s, e in intervals)


def wipe():
    """Delete every transactional record — config stays."""
    order = [
        ("till drawings", TillDrawing), ("till sessions", TillSession),
        ("expenses", Expense), ("stock purchases", StockPurchase), ("suppliers", Supplier),
        ("vouchers", Voucher), ("referrals", Referral),
        ("booking payments", BookingPayment), ("booking packages", BookingPackage),
        ("booking guests", BookingGuest), ("bookings", Booking),
        ("client suspensions", ClientSuspension),
        ("tickets", Ticket), ("task assignments", TaskAssignment),
        ("attendance", Attendance), ("leave requests", LeaveRequest), ("payroll", PayrollEntry),
    ]
    for label, model in order:
        n = model.objects.count()
        model.objects.all().delete()
        print(f"  wiped {n:>5} {label}")


def make_payment(booking, amount, method, when, companion=None):
    p = BookingPayment.objects.create(
        booking=booking, companion=companion, amount=amount,
        method=method, reference=pay_ref(method),
    )
    BookingPayment.objects.filter(pk=p.pk).update(created_at=when)
    p.created_at = when
    return p


def weighted_method():
    return random.choices(
        ["mpesa", "cash", "visa", "bank", "other"],
        weights=[52, 30, 12, 3, 3], k=1,
    )[0]


def seed_bookings(branch, desk_user, rooms, busy):
    """Walk each active room day-by-day filling it like a real register.
    Returns (bookings, day_payments) — day_payments maps date → [payments]."""
    bookings = []
    day_payments = {}
    catalogue = list(ExtraPackage.objects.filter(branch=branch, status="active"))

    def record_payment(p):
        day_payments.setdefault(timezone.localtime(p.created_at).date(), []).append(p)

    def make_booking(room, start_dt, end_dt, kind):
        name, ph, em, nat = guest()
        booked_ahead = start_dt.date() > TODAY or random.random() < 0.55
        if booked_ahead:
            created = start_dt - timedelta(days=random.randint(1, 12), hours=random.randint(0, 10))
            if created > timezone.now():
                created = timezone.now() - timedelta(hours=random.randint(1, 6))
            if created.date() < START:
                created = at(START, 9) + timedelta(minutes=random.randint(0, 300))
            kind = kind if kind == Booking.Kind.DAY_REST else Booking.Kind.RESERVATION
        else:
            created = start_dt - timedelta(hours=random.randint(0, 3))
        if end_dt <= timezone.now():
            status = Booking.Status.COMPLETED
        elif start_dt <= timezone.now():
            status = Booking.Status.OCCUPIED
        else:
            status = Booking.Status.RESERVED
        b = Booking.objects.create(
            branch=branch, room=room, guest_name=name, guest_phone=ph, guest_email=em,
            guest_id_type=random.choice(["national_id", "national_id", "passport", "driving_licence"]),
            guest_id_number=f"{random.randint(10000000, 39999999)}" if random.random() < 0.8 else "",
            guest_nationality=nat, guests=1, kind=kind, status=status,
            start=start_dt, end=end_dt, created_by=desk_user,
        )
        Booking.objects.filter(pk=b.pk).update(created_at=created, updated_at=created)
        b.created_at = created
        busy[room.id].append((start_dt, end_dt))
        return b

    def add_companions(b):
        """0–3 extra guests; a few bookings are groups where companions take
        their own rooms (billed on those rooms too)."""
        if random.random() < 0.18:
            count = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
            for _ in range(count):
                cname, cph, cem, cnat = guest()
                BookingGuest.objects.create(
                    booking=b, name=cname, phone=cph, email=cem, nationality=cnat,
                    id_type=random.choice(["national_id", "passport"]),
                    id_number=f"{random.randint(10000000, 39999999)}" if random.random() < 0.7 else "",
                )
                b.guests += 1
        elif random.random() < 0.05:
            # Group booking — companions with their own rooms.
            free_rooms = [r for r in rooms if r.id != b.room_id
                          and not overlaps(busy[r.id], b.start, b.end)]
            for r in random.sample(free_rooms, k=min(len(free_rooms), random.randint(1, 2))):
                cname, cph, cem, cnat = guest()
                BookingGuest.objects.create(
                    booking=b, name=cname, phone=cph, email=cem, nationality=cnat,
                    room=r, start=b.start, end=b.end,
                    id_type="national_id", id_number=f"{random.randint(10000000, 39999999)}",
                )
                busy[r.id].append((b.start, b.end))
                b.guests += 1
        if b.guests != 1:
            b.save(update_fields=["guests"])

    def add_packages(b):
        if random.random() < 0.38 and catalogue:
            for _ in range(random.choices([1, 2, 3], weights=[65, 25, 10])[0]):
                pkg = random.choice(catalogue)
                bp = BookingPackage.objects.create(booking=b, package=pkg, name=pkg.name, amount=pkg.amount)
                BookingPackage.objects.filter(pk=bp.pk).update(
                    created_at=rand_dt(min(timezone.localdate(), (b.start + timedelta(days=random.randint(0, 1))).date()))
                )

    def bill_of(b):
        days = {b.room_id: 1 if b.kind == Booking.Kind.DAY_REST else
                max(1, round((b.end - b.start).total_seconds() / 86400))}
        prices = {b.room_id: b.room.price}
        for c in b.companions.all():
            if not c.room_id:
                continue
            s, e = c.start or b.start, c.end or b.end
            d = 1 if b.kind == Booking.Kind.DAY_REST else max(1, round((e - s).total_seconds() / 86400))
            days[c.room_id] = max(days.get(c.room_id, 0), d)
            prices[c.room_id] = c.room.price
        return sum(prices[r] * n for r, n in days.items()) + sum(
            p.amount for p in b.extra_packages.all())

    def add_payments(b, bill):
        if b.status == Booking.Status.CANCELLED:
            return
        stay_day = timezone.localtime(b.start).date()
        paid_target = bill
        if b.status == Booking.Status.COMPLETED and random.random() < 0.09:
            paid_target = (bill * random.randint(70, 90) // 100)  # outstanding balance
        elif b.status == Booking.Status.OCCUPIED:
            paid_target = (bill * random.randint(55, 100) // 100)
        elif b.status == Booking.Status.RESERVED:
            paid_target = (bill * random.choice([0, 30, 50, 100]) // 100)
        if paid_target <= 0:
            return

        # Advance deposit for reservations made ahead of the stay.
        remaining = paid_target
        if (b.kind == Booking.Kind.RESERVATION and paid_target >= bill * Decimal("0.3")
                and random.random() < 0.5):
            dep = min((bill * random.randint(25, 50) // 100).quantize(Decimal("1")), remaining)
            b.deposit = dep
            b.save(update_fields=["deposit"])
            # Deposit lands as a payment too? No — `paid` = deposit + payments.
            remaining -= dep

        if remaining > 0 and b.status != Booking.Status.RESERVED:
            # Split the balance into 1–2 payments across the stay.
            parts = [remaining]
            if remaining > 8000 and random.random() < 0.2:
                first = (remaining * random.randint(40, 65) // 100).quantize(Decimal("1"))
                parts = [first, remaining - first]
            last_day = min(timezone.localtime(b.end).date(), TODAY)
            for i, amt in enumerate(parts):
                when = rand_dt(min(stay_day + timedelta(days=i), last_day))
                record_payment(make_payment(b, amt, weighted_method(), when))
        elif remaining > 0:  # reserved — a part-payment on the reservation day
            record_payment(make_payment(
                b, remaining, weighted_method(),
                rand_dt(timezone.localtime(b.created_at).date())))

    for room in rooms:
        cursor = START
        while cursor <= FUTURE:
            weekend = cursor.weekday() >= 4
            occ = 0.62 if weekend else 0.45
            if cursor > TODAY:
                occ = 0.30  # forward reservations
            r = random.random()
            if r < 0.05 and cursor <= TODAY:
                # Day rest — same-day in/out.
                b = make_booking(room, at(cursor, 10, random.choice([0, 30])),
                                 at(cursor, 16, random.choice([0, 30])), Booking.Kind.DAY_REST)
                add_companions(b)
                add_packages(b)
                add_payments(b, bill_of(b))
                bookings.append(b)
                cursor += timedelta(days=1)
            elif r < occ:
                nights = random.choices([1, 2, 3, 4, 5, 7], weights=[34, 30, 17, 9, 6, 4])[0]
                start_dt = at(cursor, random.choice([11, 12, 13, 14, 15]), random.choice([0, 15, 30, 45]))
                end_dt = at(cursor + timedelta(days=nights), random.choice([9, 10, 11]), random.choice([0, 15, 30]))
                b = make_booking(room, start_dt, end_dt, Booking.Kind.STAY)
                add_companions(b)
                add_packages(b)
                add_payments(b, bill_of(b))
                bookings.append(b)
                cursor += timedelta(days=nights + random.choice([0, 0, 1, 2]))
            else:
                cursor += timedelta(days=1)

    # A handful of cancelled bookings (don't block rooms, mostly unpaid).
    for _ in range(max(3, len(bookings) // 40)):
        room = random.choice(rooms)
        day = START + timedelta(days=random.randint(0, 68))
        name, ph, em, nat = guest()
        b = Booking.objects.create(
            branch=branch, room=room, guest_name=name, guest_phone=ph, guest_email=em,
            guest_nationality=nat, guests=1, kind=Booking.Kind.RESERVATION,
            status=Booking.Status.CANCELLED,
            start=at(day, 14), end=at(day + timedelta(days=random.randint(1, 3)), 11),
            created_by=desk_user,
        )
        Booking.objects.filter(pk=b.pk).update(created_at=at(day - timedelta(days=random.randint(1, 7)), 10))
        bookings.append(b)

    return bookings, day_payments


def seed_tills(branch, staff, day_payments):
    """One till per day. M-Pesa/card balances carry over day to day; the day's
    cash is mostly banked by a closing-time drawing so the drawer lands near
    its float, with occasional over/short like a real count."""
    front = staff[0]
    mpesa_bal, card_bal = money(20000, 45000, 1000), money(10000, 25000, 1000)
    sessions = {}
    for day in DAYS:
        cash_in = sum(p.amount for p in day_payments.get(day, []) if p.method == "cash")
        mpesa_in = sum(p.amount for p in day_payments.get(day, []) if p.method == "mpesa")
        card_in = sum(p.amount for p in day_payments.get(day, []) if p.method in ("visa",))

        sess = TillSession.objects.create(
            branch=branch, opening_float=money(3000, 6000, 500),
            opening_mpesa=mpesa_bal, opening_card=card_bal,
            note="", opened_by=front,
        )
        opened = at(day, 6, 45 + random.randint(0, 30))
        TillSession.objects.filter(pk=sess.pk).update(opened_at=opened)
        sess.opened_at = opened

        # Mid/late-day drawings — keep cash draws under what the drawer holds.
        draws = []
        if cash_in > 4000 and random.random() < 0.75:
            amt = min(money(2000, int(cash_in), 500), cash_in - 500)
            if amt > 0:
                d = TillDrawing.objects.create(
                    session=sess, method="cash", amount=amt,
                    reason=random.choice(DRAWING_REASONS["cash"]),
                    given_to=random.choice(DRAWING_GIVERS), created_by=front)
                TillDrawing.objects.filter(pk=d.pk).update(created_at=rand_dt(day, 15, 20))
                draws.append(d)
        if mpesa_in > 10000 and random.random() < 0.4:
            d = TillDrawing.objects.create(
                session=sess, method="mpesa", amount=money(5000, int(min(mpesa_in, 60000)), 1000),
                reason=random.choice(DRAWING_REASONS["mpesa"]),
                given_to=random.choice(DRAWING_GIVERS), created_by=front)
            TillDrawing.objects.filter(pk=d.pk).update(created_at=rand_dt(day, 14, 19))
            draws.append(d)
        if card_in > 8000 and random.random() < 0.2:
            d = TillDrawing.objects.create(
                session=sess, method="visa", amount=money(5000, int(min(card_in, 30000)), 1000),
                reason=random.choice(DRAWING_REASONS["visa"]),
                given_to=random.choice(DRAWING_GIVERS), created_by=front)
            TillDrawing.objects.filter(pk=d.pk).update(created_at=rand_dt(day, 16, 20))
            draws.append(d)

        cash_drawn = sum(d.amount for d in draws if d.method == "cash")
        expected = sess.opening_float + cash_in - cash_drawn
        # Close every past day; leave today open for the counter.
        if day < TODAY:
            variance = random.choices(
                [0, random.randint(-250, -40), random.randint(40, 150)],
                weights=[80, 12, 8])[0]
            sess.closing_count = max(Decimal(0), expected + Decimal(variance))
            sess.closed_by = random.choice(staff)
            sess.closing_note = "" if variance == 0 else ("Counted short" if variance < 0 else "Slightly over")
            sess.closed_at = at(day, 21, 30 + random.randint(0, 45))
            sess.save()

        # Balances carry into tomorrow's opening figures.
        mpesa_bal += mpesa_in - sum(d.amount for d in draws if d.method == "mpesa")
        card_bal += card_in - sum(d.amount for d in draws if d.method == "visa")
        sessions[day] = sess
    return sessions


def seed_spend(branch, staff, sessions):
    """Expenses + stock purchases pinned to each day's till session."""
    for day in DAYS:
        sess = sessions[day]
        # 1–2 expenses most days; pending occasionally.
        for _ in range(random.choices([0, 1, 2], weights=[30, 50, 20])[0]):
            cat, name, (lo, hi) = random.choice(EXPENSE_POOL)
            sname, sph = random.choice(SUPPLIERS)
            e = Expense.objects.create(
                branch=branch, session=sess, category=cat, name=name,
                amount=money(lo, hi), supplier_name=sname, supplier_phone=sph,
                payment_status=random.choices(["paid", "pending"], weights=[88, 12])[0],
                created_by=random.choice(staff))
            Expense.objects.filter(pk=e.pk).update(
                created_at=rand_dt(day), updated_at=rand_dt(day))
            Supplier.register(branch, sname, sph)
        # Stock top-ups a few times a week.
        if random.random() < 0.38:
            for _ in range(random.choices([1, 2], weights=[75, 25])[0]):
                item, qty_u, unit = random.choice(STOCK_ITEMS)
                qty = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
                sname, sph = random.choice(SUPPLIERS[:6])
                sp = StockPurchase.objects.create(
                    branch=branch, session=sess, supplier_name=sname, supplier_phone=sph,
                    item=item, quantity=qty * qty_u, unit_price=Decimal(unit),
                    payment_status=random.choices(["paid", "pending"], weights=[85, 15])[0],
                    created_by=random.choice(staff))
                StockPurchase.objects.filter(pk=sp.pk).update(
                    created_at=rand_dt(day, 9, 18), updated_at=rand_dt(day, 9, 18))
                Supplier.register(branch, sname, sph)


def seed_referrals_vouchers(branch, staff, bookings):
    """Gift vouchers from referrals + credit vouchers from room changes."""
    front = staff[0]
    completed = [b for b in bookings if b.status == Booking.Status.COMPLETED]
    names_pool = [b.guest_name for b in completed[:40]] or ["Regular Guest"]
    referred = random.sample(
        [b for b in bookings if b.status != Booking.Status.CANCELLED],
        k=max(4, len(bookings) // 9))
    for b in referred:
        ref = Referral.objects.create(
            branch=branch, booking=b,
            referrer_name=random.choice(names_pool), referrer_phone=phone())
        ref.created_at = max(timezone.localtime(b.created_at), at(START, 8))
        Referral.objects.filter(pk=ref.pk).update(created_at=ref.created_at)
        # Matured vouchers get redeemed at the counter some of the time.
        if ref.paid_amount > 0 and random.random() < 0.4:
            when = rand_dt(min(timezone.localtime(b.start).date() + timedelta(days=random.randint(2, 15)), TODAY))
            ref.redeemed_at = when
            ref.redeemed_by = front
            ref.save()
            Referral.objects.filter(pk=ref.pk).update(redeemed_at=when)

    for b in random.sample(completed, k=min(len(completed), random.randint(4, 7))):
        v = Voucher.objects.create(
            branch=branch, booking=b, amount=money(500, 3500, 100),
            guest_name=b.guest_name, guest_phone=b.guest_phone)
        issued = timezone.localtime(b.end).date()
        v.created_at = rand_dt(issued, 9, 12)
        Voucher.objects.filter(pk=v.pk).update(created_at=v.created_at)
        if random.random() < 0.5:
            when = rand_dt(min(issued + timedelta(days=random.randint(3, 20)), TODAY))
            v.redeemed_at, v.redeemed_by = when, front
            v.save()
            Voucher.objects.filter(pk=v.pk).update(redeemed_at=when)


def seed_tickets(branch, staff, rooms):
    pool = []
    for cat, titles in TICKET_TEMPLATES.items():
        pool += [(cat, t) for t in titles]
    for _ in range(random.randint(26, 34)):
        cat, title = random.choice(pool)
        created_day = START + timedelta(days=random.randint(0, 61))
        created = rand_dt(created_day, 7, 20)
        resolved = created_day < TODAY - timedelta(days=2) or random.random() < 0.4
        status = random.choice(["resolved", "resolved", "closed"]) if resolved else \
            random.choice(["open", "assigned", "in_progress", "on_hold"])
        room = random.choice(rooms) if random.random() < 0.75 else None
        tk = Ticket.objects.create(
            branch=branch, title=title, category=cat,
            priority=random.choices(["low", "medium", "high", "urgent"], weights=[25, 45, 22, 8])[0],
            status=status, room=room,
            location="" if room else random.choice(["Lobby", "Kitchen", "Parking", "Pool area", "Corridor"]),
            reported_by=random.choice(staff),
            source=random.choices(["reception", "phone", "other"], weights=[70, 20, 10])[0],
            assigned_to=random.choice(staff) if random.random() < 0.7 else None,
            assignee_name="" if random.random() < 0.7 else random.choice(
                ["QuickFix Plumbers", "ElecTric Solutions", "CoolAir Services"]),
            due=created_day + timedelta(days=random.randint(1, 5)),
            resolved_at=(created + timedelta(hours=random.randint(2, 72))) if resolved else None,
        )
        if resolved and cat == "maintenance" and random.random() < 0.6:
            tk.labour_cost = money(500, 4500, 100)
            for _ in range(random.randint(1, 3)):
                TicketItem.objects.create(
                    ticket=tk, name=random.choice(
                        ["Shower head", "Pipe fittings", "Fuses & bulbs", "Door hinges",
                         "Silicone sealant", "AC filter", "Tap washers", "Paint touch-up"]),
                    price=money(150, 1800, 50))
        tk.save()
        Ticket.objects.filter(pk=tk.pk).update(created_at=created, updated_at=created)


def seed_hr(branch, staff):
    """Attendance for the last 60 days, task assignments, leave, payroll."""
    desk = staff[0]
    for emp in staff:
        for day in DAYS:
            r = random.random()
            off = day.weekday() == 6 or r < 0.08
            if off:
                st, cin, cout = "off", None, None
            elif r < 0.2:
                st = "late"
                cin, cout = dtime(8, random.randint(5, 55)), dtime(18, random.randint(0, 30))
            else:
                st = "present"
                cin, cout = dtime(6, random.randint(50, 59)) if random.random() < 0.5 else \
                    dtime(7, random.randint(0, 15)), dtime(18, random.randint(0, 45))
            if day == TODAY and timezone.localtime().hour < 18:
                cout = None
            Attendance.objects.create(
                employee=emp, date=day, status=st, clock_in=cin, clock_out=cout,
                recorded_by=desk,
            )

    types = []
    for name in TASK_NAMES:
        t, _ = TaskType.objects.get_or_create(branch=branch, name=name,
                                              defaults={"description": f"Daily {name.lower()} duties"})
        types.append(t)
    for day in DAYS:
        for _ in range(random.randint(1, 3)):
            ttype = random.choice(types)
            done = day < TODAY and random.random() < 0.88
            ta = TaskAssignment.objects.create(
                branch=branch, task_type=ttype, employee=random.choice(staff),
                date=day, start=dtime(random.choice([7, 8, 9]), 0),
                end=dtime(random.choice([15, 16, 17]), 0),
                status="done" if done else random.choice(
                    ["pending", "in_progress", "done"] if day == TODAY else ["pending", "cancelled"]),
                note="" if random.random() < 0.8 else random.choice(
                    ["Priority rooms first", "VIP guest arriving", "Stock running low", "Deep clean required"]),
                assigned_by=desk,
                completed_at=(at(day, 16) if done else None))
            TaskAssignment.objects.filter(pk=ta.pk).update(created_at=at(day - timedelta(days=1), 18))

    # Payroll — last month paid, this month drafted.
    first_this = TODAY.replace(day=1)
    first_last = (first_this - timedelta(days=1)).replace(day=1)
    for emp in staff:
        basic = Decimal(80000 if emp.role == "branch_manager"
                        else 45000 if emp.role == "branch_receptionist" else 34000)
        PayrollEntry.objects.create(
            employee=emp, period=first_last, basic_salary=basic,
            allowances=money(3000, 9000), deductions=money(1500, 5000),
            status="paid", paid_at=at(first_last + timedelta(days=27), 14))
        PayrollEntry.objects.create(
            employee=emp, period=first_this, basic_salary=basic,
            allowances=money(3000, 9000), deductions=money(1500, 5000), status="draft")

    # A couple of leave requests for flavour.
    emp = random.choice(staff)
    LeaveRequest.objects.create(
        employee=emp, leave_type="annual",
        start_date=TODAY + timedelta(days=14), end_date=TODAY + timedelta(days=18),
        reason="Family matter", status="pending")
    LeaveRequest.objects.create(
        employee=random.choice(staff), leave_type=random.choice(["sick", "compassionate"]),
        start_date=START + timedelta(days=20), end_date=START + timedelta(days=22),
        reason="", status="approved", decided_by=desk,
        decided_at=at(START + timedelta(days=18), 10))


def main():
    print("Wiping transactional data …")
    with transaction.atomic():
        wipe()

        staff_by_branch = {}
        for u in User.objects.filter(branch__isnull=False).select_related("branch"):
            staff_by_branch.setdefault(u.branch_id, []).append(u)

        for branch in Branch.objects.all().order_by("id"):
            staff = staff_by_branch.get(branch.id) or list(User.objects.filter(branch__isnull=False)[:1])
            # Receptionist first, then manager, then employees — used as the
            # front-desk user on bookings, tills and redemptions.
            staff.sort(key=lambda u: {"branch_receptionist": 0, "branch_manager": 1}.get(u.role, 2))
            rooms = list(Room.objects.filter(branch=branch, status="active"))
            busy = {r.id: [] for r in rooms}
            print(f"\n{branch.name}: {len(rooms)} rooms, staff: "
                  + ", ".join(u.get_full_name() or u.username for u in staff))

            bookings, day_payments = seed_bookings(branch, staff[0], rooms, busy)
            sessions = seed_tills(branch, staff, day_payments)
            seed_spend(branch, staff, sessions)
            seed_referrals_vouchers(branch, staff, bookings)
            seed_tickets(branch, staff, rooms)
            seed_hr(branch, staff)
            print(f"  {len(bookings)} bookings · {sum(len(v) for v in day_payments.values())} payments")

    print("\nDone — seeded:", {
        "bookings": Booking.objects.count(),
        "payments": BookingPayment.objects.count(),
        "companions": BookingGuest.objects.count(),
        "package sales": BookingPackage.objects.count(),
        "referrals": Referral.objects.count(),
        "vouchers": Voucher.objects.count(),
        "tills": TillSession.objects.count(),
        "drawings": TillDrawing.objects.count(),
        "expenses": Expense.objects.count(),
        "purchases": StockPurchase.objects.count(),
        "suppliers": Supplier.objects.count(),
        "tickets": Ticket.objects.count(),
        "attendance": Attendance.objects.count(),
        "tasks": TaskAssignment.objects.count(),
        "payroll": PayrollEntry.objects.count(),
        "leave": LeaveRequest.objects.count(),
    })


if __name__ == "__main__":
    main()
