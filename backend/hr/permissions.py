from rest_framework.permissions import BasePermission

from accounts.models import User

HR_ROLES = {User.Role.ADMIN, User.Role.IT_SUPPORT}


class IsHRStaff(BasePermission):
    message = "Only Admin and IT Support can open HR management."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_sign_in and user.role in HR_ROLES)


class IsActiveStaff(BasePermission):
    message = "Only active staff can track their attendance."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_sign_in)
