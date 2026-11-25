from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User

BNB_ROLES = {User.Role.ADMIN, User.Role.IT_SUPPORT}
BRANCH_ROLES = {
    User.Role.BRANCH_MANAGER,
    User.Role.BRANCH_RECEPTIONIST,
    User.Role.BRANCH_STORE_MANAGER,
    User.Role.BRANCH_EMPLOYEE,
}

ROOM_VIEW_ROLES = BNB_ROLES | BRANCH_ROLES
ROOM_EDIT_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER}
BOOKING_VIEW_ROLES = BNB_ROLES | BRANCH_ROLES
BOOKING_EDIT_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER, User.Role.BRANCH_RECEPTIONIST}
# Any staff member can raise or work a ticket; only managers can delete one.
TICKET_ROLES = BNB_ROLES | BRANCH_ROLES
TICKET_DELETE_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER}
# Allocating a ticket to a staff member or contractor is a manager/receptionist job.
TICKET_ASSIGN_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER, User.Role.BRANCH_RECEPTIONIST}
# Branch staff can read their branch's profile; only its manager can change it.
BRANCH_PROFILE_EDIT_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER}
# Accounts — expenses and stock purchases: branch staff can view, managers and
# receptionists record and change them.
ACCOUNT_VIEW_ROLES = BNB_ROLES | BRANCH_ROLES
ACCOUNT_EDIT_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER, User.Role.BRANCH_RECEPTIONIST}
# Extra packages — branch staff can view, only the branch manager registers,
# edits, suspends and deletes them.
PACKAGE_VIEW_ROLES = BNB_ROLES | BRANCH_ROLES
PACKAGE_EDIT_ROLES = BNB_ROLES | {User.Role.BRANCH_MANAGER}


class IsBnBStaff(BasePermission):
    message = "Only Admin and IT Support can open BnB management."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_sign_in and user.role in BNB_ROLES)


class CanManageRooms(BasePermission):
    """Branch staff can view their branch's rooms; only branch managers (and Admin/IT Support) can change them."""

    message = "Only branch managers can change rooms."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        allowed = ROOM_VIEW_ROLES if request.method in SAFE_METHODS else ROOM_EDIT_ROLES
        return user.role in allowed


class CanManageBookings(BasePermission):
    """Branch staff can view their branch's bookings; managers and receptionists can take and change them."""

    message = "Only branch managers and receptionists can change bookings."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        allowed = BOOKING_VIEW_ROLES if request.method in SAFE_METHODS else BOOKING_EDIT_ROLES
        return user.role in allowed


class CanManageTickets(BasePermission):
    """All branch staff (and Admin/IT Support) can see and raise tickets; deleting needs a manager."""

    message = "You don't have access to tickets."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        if request.method == "DELETE":
            return user.role in TICKET_DELETE_ROLES
        return user.role in TICKET_ROLES


class CanManagePackages(BasePermission):
    """Branch staff can view their branch's extra packages; only the branch manager
    (and Admin/IT Support) can register, edit, suspend or delete them."""

    message = "Only branch managers can change extra packages."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        allowed = PACKAGE_VIEW_ROLES if request.method in SAFE_METHODS else PACKAGE_EDIT_ROLES
        return user.role in allowed


class CanManageAccounts(BasePermission):
    """Branch staff can view their branch's expenses and stock purchases;
    managers and receptionists record and change them."""

    message = "Only branch managers and receptionists can change account records."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        allowed = ACCOUNT_VIEW_ROLES if request.method in SAFE_METHODS else ACCOUNT_EDIT_ROLES
        return user.role in allowed


class TillOwnerWriteOnly(BasePermission):
    """While a till session is open at the branch, only the receptionist who
    opened it may create or change records — everyone else stays read-only so
    nothing is altered outside the accountable session. When no till is open
    this passes; the existing per-endpoint checks already stop money records."""

    message = "Another receptionist has the till open — you're in view-only mode until they close it."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # The lock is on the front-desk role; managers and company roles keep
        # their oversight writes, and other staff keep theirs.
        if user.role != User.Role.BRANCH_RECEPTIONIST or user.branch_id is None:
            return True
        from .models import TillSession  # local import — permissions load early
        session = (
            TillSession.objects.filter(branch_id=user.branch_id, closed_at__isnull=True)
            .only("opened_by_id")
            .first()
        )
        return session is None or session.opened_by_id == user.id


class CanManageBranchProfile(BasePermission):
    """Branch staff can read their branch's settings; only the manager (and Admin/IT Support) edits them."""

    message = "Only the branch manager can change branch settings."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.can_sign_in):
            return False
        allowed = BNB_ROLES | BRANCH_ROLES if request.method in SAFE_METHODS else BRANCH_PROFILE_EDIT_ROLES
        return user.role in allowed
