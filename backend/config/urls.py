from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "BnB Management Admin"
admin.site.site_title = "BnB Management"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
]
