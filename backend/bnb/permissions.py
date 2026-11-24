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
