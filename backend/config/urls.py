from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import Http404, HttpResponse
from django.urls import include, path, re_path

admin.site.site_header = "BnB Management Admin"
admin.site.site_title = "BnB Management"

# Production: the built React app is uploaded to <app root>/public/, which
# Passenger/Apache uses as the docroot. Paths that aren't real files in there
# fall through to Django — serve index.html so React Router can take over.
INDEX_HTML = settings.BASE_DIR.parent / "public" / "index.html"


def spa(request):
    if not INDEX_HTML.is_file():
        raise Http404
    return HttpResponse(INDEX_HTML.read_text(encoding="utf-8"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/hr/", include("hr.urls")),
    path("api/bnb/", include("bnb.urls")),
    re_path(r"^(?!api/|admin/|static/|media/|assets/).*$", spa),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
