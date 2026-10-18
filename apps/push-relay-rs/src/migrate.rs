use tokio_rusqlite::rusqlite::{self, Connection, TransactionBehavior};

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001_initial.sql",
        include_str!("../migrations/0001_initial.sql"),
    ),
    (
        "0002_binding_reader_preferences.sql",
        include_str!("../migrations/0002_binding_reader_preferences.sql"),
    ),
];

pub fn run(connection: &mut Connection) -> rusqlite::Result<()> {
    let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS push_relay_schema_migrations (
           filename TEXT PRIMARY KEY NOT NULL,
           applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
         )",
    )?;
    for (filename, sql) in MIGRATIONS {
        let applied: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM push_relay_schema_migrations WHERE filename = ?1)",
            [filename],
            |row| row.get(0),
        )?;
        if !applied {
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO push_relay_schema_migrations (filename) VALUES (?1)",
                [filename],
            )?;
        }
    }
    tx.commit()
}
