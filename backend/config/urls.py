import posixpath

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponse
from django.urls import include, path, re_path

admin.site.site_header = "BnB Management Admin"
admin.site.site_title = "BnB Management"

# Production: the React build lives in <app root>/public/ (a symlink to
# frontend/dist, with static -> staticfiles and media -> media inside it).
# Some hosts pass every request to Passenger instead of serving docroot
# files from Apache, so serve real files here too and fall back to
# index.html so React Router can take over.
DOCROOT = settings.BASE_DIR.parent / "public"
INDEX_HTML = DOCROOT / "index.html"


def spa(request):
    rel = posixpath.normpath(request.path.lstrip("/"))
    if rel != "." and not rel.startswith(".."):
        candidate = DOCROOT / rel
        if candidate.is_file():
            return FileResponse(candidate.open("rb"))
    if INDEX_HTML.is_file():
        return HttpResponse(INDEX_HTML.read_text(encoding="utf-8"), content_type="text/html")
    raise Http404


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/hr/", include("hr.urls")),
    path("api/bnb/", include("bnb.urls")),
    re_path(r"^(?!api/|admin/).*$", spa),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
