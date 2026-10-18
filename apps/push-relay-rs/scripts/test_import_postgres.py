import importlib.util
import io
import json
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("import_postgres", Path(__file__).with_name("import-postgres.py"))
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database = Path(self.directory.name) / "relay.sqlite3"
        with closing(sqlite3.connect(self.database)) as connection:
            for migration in sorted(Path(__file__).resolve().parents[1].joinpath("migrations").glob("*.sql")):
                connection.executescript(migration.read_text())
        self.source = {
            "id": "src_original", "origin": "https://example.com", "label": None,
            "secret_ciphertext": "original-encrypted-credential", "created_at": 1792281600123,
            "updated_at": 1792281600456, "revoked_at": None,
        }

    def export(self, records, exit_code=0):
        process = Mock()
        process.stdin = io.StringIO()
        process.stdout = io.StringIO("\n".join(json.dumps(record) for record in records))
        process.wait.return_value = exit_code
        process.poll.return_value = exit_code
        return patch.object(importer.subprocess, "Popen", return_value=process)

    def sources(self):
        with closing(sqlite3.connect(self.database)) as connection:
            connection.row_factory = sqlite3.Row
            return [dict(row) for row in connection.execute("SELECT * FROM push_sources")]

    def test_import_preserves_credentials_timestamps_and_refuses_overwrite(self):
        with self.export([{"table": "push_sources", "row": self.source}]):
            counts = importer.import_database(self.database, "postgresql://fixture")
        self.assertEqual(counts["push_sources"], 1)
        self.assertEqual(self.sources(), [self.source])
        with self.assertRaisesRegex(ValueError, "must be empty"):
            importer.import_database(self.database, "postgresql://fixture")
        self.assertEqual(self.sources(), [self.source])

    def test_failed_export_rolls_back_rows_already_imported(self):
        with self.export([{"table": "push_sources", "row": self.source}], exit_code=1):
            with self.assertRaisesRegex(ValueError, "export failed"):
                importer.import_database(self.database, "postgresql://fixture")
        self.assertEqual(self.sources(), [])

    def test_constraint_failure_rolls_back_the_whole_import(self):
        row = {**self.source, "id": "src_second", "secret_ciphertext": None}
        with self.export([{"table": "push_sources", "row": item} for item in [self.source, row]]):
            with self.assertRaises(sqlite3.IntegrityError):
                importer.import_database(self.database, "postgresql://fixture")
        self.assertEqual(self.sources(), [])

    def test_missing_destination_is_not_created(self):
        path = self.database.with_name("typo.sqlite3")
        with self.assertRaises(sqlite3.OperationalError):
            importer.import_database(path, "postgresql://fixture")
        self.assertFalse(path.exists())

    def test_source_password_is_not_exposed_in_process_arguments(self):
        with self.export([]) as process:
            importer.import_database(self.database, "postgresql://user:secret%40password@localhost/relay?sslmode=require")
        args, options = process.call_args
        self.assertNotIn("secret", " ".join(args[0]))
        self.assertEqual(options["env"]["PGPASSWORD"], "secret@password")


if __name__ == "__main__":
    unittest.main()
