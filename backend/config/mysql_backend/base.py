"""MySQL backend that also runs on MariaDB 10.4 (the version bundled with XAMPP).

Django 5.1 officially needs MariaDB 10.5+. The only 10.5 feature it relies on for normal use is
INSERT ... RETURNING, so on 10.4 we switch that off and Django falls back to LAST_INSERT_ID().
MySQL 8 and MariaDB 10.5+ behave exactly like the stock backend.
"""
from django.db.backends.mysql import base, features


class DatabaseFeatures(features.DatabaseFeatures):
    @property
    def minimum_database_version(self):
        if self.connection.mysql_is_mariadb:
            return (10, 4)
        return super().minimum_database_version

    @property
    def can_return_columns_from_insert(self):
        return self.connection.mysql_is_mariadb and self.connection.mysql_version >= (10, 5)

    @property
    def can_return_rows_from_bulk_insert(self):
        return self.can_return_columns_from_insert


class DatabaseWrapper(base.DatabaseWrapper):
    features_class = DatabaseFeatures
