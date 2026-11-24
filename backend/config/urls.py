from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "BnB Management Admin"
admin.site.site_title = "BnB Management"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/hr/", include("hr.urls")),
    path("api/bnb/", include("bnb.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
