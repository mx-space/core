#!/usr/bin/env python3
"""Offline import into an initialized, empty SQLite database. Stop both relays first."""

import argparse
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit


TABLE_TIMESTAMPS = {
    "push_installations": ("created_at", "updated_at", "revoked_at"),
    "push_activation_tickets": ("created_at", "expires_at", "claimed_at"),
    "push_sources": ("created_at", "updated_at", "revoked_at"),
    "push_bindings": ("created_at", "updated_at", "revoked_at"),
    "push_events": ("event_time", "created_at"),
    "push_deliveries": ("next_attempt_at", "delivered_at", "created_at", "updated_at"),
}


def export_sql():
    statements = ["BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"]
    for table, timestamps in TABLE_TIMESTAMPS.items():
        fields = ", ".join(
            f"'{column}', floor(extract(epoch FROM t.{column}) * 1000)::bigint"
            for column in timestamps
        )
        statements.append(
            f"SELECT json_build_object('table', '{table}', "
            f"'row', to_jsonb(t) || jsonb_build_object({fields})) FROM {table} t;"
        )
    statements.append("COMMIT;")
    return "\n".join(statements)


def import_database(database: Path, source: str):
    url = urlsplit(source)
    if url.scheme not in ("postgres", "postgresql"):
        raise ValueError("Source must be a PostgreSQL connection URL")
    environment = dict(os.environ)
    if url.password is not None:
        environment["PGPASSWORD"] = unquote(url.password)
    query = []
    for name, value in parse_qsl(url.query, keep_blank_values=True):
        if name == "password":
            environment["PGPASSWORD"] = value
        else:
            query.append((name, value))
    # Keep the password out of the child process's command-line arguments.
    authority = (url.username + "@" if url.username else "") + url.netloc.rsplit("@", 1)[-1]
    source = url._replace(netloc=authority, query=urlencode(query)).geturl()
    counts = dict.fromkeys(TABLE_TIMESTAMPS, 0)
    # mode=rw refuses typos instead of silently creating a new database.
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=rw", uri=True)
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        for table in TABLE_TIMESTAMPS:
            if connection.execute(f"SELECT EXISTS(SELECT 1 FROM {table})").fetchone()[0]:
                raise ValueError("Destination must be empty; existing data was not changed")
        with tempfile.TemporaryFile(mode="w+") as errors:
            process = subprocess.Popen(
                ["psql", "--dbname", source, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", "-"],
                env=environment,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=errors,
                text=True,
            )
            try:
                process.stdin.write(export_sql())
                process.stdin.close()
                for line in process.stdout:
                    record = json.loads(line)
                    table, row = record["table"], record["row"]
                    if table not in TABLE_TIMESTAMPS:
                        raise ValueError("Unknown table in PostgreSQL export")
                    columns = [column[1] for column in connection.execute(f"PRAGMA table_info({table})")]
                    if set(row) != set(columns):
                        raise ValueError(f"Source columns do not match {table}; apply the old PostgreSQL migrations first")
                    values = [
                        json.dumps(row[column], ensure_ascii=False) if column in ("payload", "preferences") else row[column]
                        for column in columns
                    ]
                    connection.execute(
                        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
                        values,
                    )
                    counts[table] += 1
                if process.wait() != 0:
                    raise ValueError("PostgreSQL export failed; check psql connectivity and the source schema")
            finally:
                process.stdout.close()
                if process.poll() is None:
                    process.terminate()
                    process.wait()
        connection.commit()
        return counts
    finally:
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, help="SQLite file initialized by push-relay migrate")
    args = parser.parse_args()
    source = os.environ.get("PUSH_RELAY_DATABASE_URL")
    if not source:
        parser.error("Set PUSH_RELAY_DATABASE_URL to the old PostgreSQL connection URL")
    try:
        print(json.dumps({"imported": import_database(args.database, source)}, indent=2))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f"Import aborted; SQLite changes rolled back: {error}\n")
