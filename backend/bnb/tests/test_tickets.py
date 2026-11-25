from rest_framework.test import APITestCase

from accounts.models import User
from bnb.models import Branch, Ticket


def make(code, role=User.Role.BRANCH_EMPLOYEE, status=User.Status.ACTIVE, branch=None, first="Test"):
    return User.objects.create_user(
        code=code, password="pass-12345", first_name=first, last_name=code, email=f"{code}@x.test",
        phone="0700000000", role=role, status=status, branch=branch,
    )


def make_branch(name, code):
    branch = Branch(name=name, phone="0700000000", email=f"{code}@b.test", location="Nairobi", code=code)
    branch.set_password("pass-12345")
    branch.save()
    return branch


class TicketAssignTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("West House", "111111")
        self.other = make_branch("East House", "222222")
        self.mgr = make("300300", User.Role.BRANCH_MANAGER, branch=self.branch, first="Mia")
        self.recep = make("400400", User.Role.BRANCH_RECEPTIONIST, branch=self.branch, first="Rea")
        self.emp = make("500500", branch=self.branch, first="Eli")
        self.outside = make("600600", branch=self.other, first="Oli")
        self.ticket = Ticket.objects.create(branch=self.branch, title="Leaking tap", reported_by=self.mgr)

    def test_manager_assigns_branch_employee(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"assigned_to": self.emp.id}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["assigned_to"], self.emp.id)

    def test_receptionist_assigns_branch_employee(self):
        self.client.force_authenticate(self.recep)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"assigned_to": self.emp.id}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    def test_cannot_assign_employee_from_another_branch(self):
        self.client.force_authenticate(self.mgr)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"assigned_to": self.outside.id}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("assigned_to", r.json())

    def test_branch_employee_cannot_allocate(self):
        self.client.force_authenticate(self.emp)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"assigned_to": self.emp.id}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"assignee_name": "FixIt Ltd"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_branch_employee_can_still_work_the_ticket(self):
        self.ticket.assigned_to = self.emp
        self.ticket.save(update_fields=["assigned_to"])
        self.client.force_authenticate(self.emp)
        r = self.client.patch(f"/api/bnb/tickets/{self.ticket.id}/", {"status": "in_progress"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    def test_staff_list_is_scoped_to_callers_branch(self):
        self.client.force_authenticate(self.recep)
        names = {s["name"] for s in self.client.get("/api/bnb/tickets/staff/").json()}
        self.assertEqual(names, {u.get_full_name() for u in (self.mgr, self.recep, self.emp)})
