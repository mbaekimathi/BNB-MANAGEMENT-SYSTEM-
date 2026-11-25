"""Test settings — run the suite on an isolated test database.

The dev machine runs several toolchains at once, and the venv python.exe is a
redirector that re-runs the same command under the base interpreter, so two
`manage.py test` processes can end up sharing the default `test_<db>` name and
destroying each other's schema mid-run. Keying the test database name by pid
keeps concurrent runs apart:

    python manage.py test --settings=config.test_settings
"""
import os

from .settings import *  # noqa: F401,F403

DATABASES["default"]["TEST"] = {"NAME": os.getenv("TEST_DB_NAME", f"test_bnb_pid{os.getpid()}")}
