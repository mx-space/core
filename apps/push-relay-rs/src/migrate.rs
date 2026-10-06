use tokio_postgres::NoTls;

const MIGRATION_LOCK_KEY: i64 = 0x7075_726c;

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

pub async fn run(database_url: &str) -> Result<(), String> {
    let (mut client, connection) = tokio_postgres::connect(database_url, NoTls)
        .await
        .map_err(|e| e.to_string())?;
    let connection = tokio::spawn(connection);
    let result = async {
        let tx = client.transaction().await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock($1::bigint)",
            &[&MIGRATION_LOCK_KEY],
        )
        .await?;
        tx.batch_execute(
            "CREATE TABLE IF NOT EXISTS push_relay_schema_migrations (
               filename text PRIMARY KEY,
               applied_at timestamptz NOT NULL DEFAULT now()
             )",
        )
        .await?;
        let done: Vec<String> = tx
            .query("SELECT filename FROM push_relay_schema_migrations", &[])
            .await?
            .iter()
            .map(|row| row.get(0))
            .collect();
        for (filename, sql) in MIGRATIONS {
            if done.iter().any(|applied| applied == filename) {
                println!("skip {filename}");
                continue;
            }
            tx.batch_execute(sql).await?;
            tx.execute(
                "INSERT INTO push_relay_schema_migrations (filename) VALUES ($1)",
                &[filename],
            )
            .await?;
            println!("applied {filename}");
        }
        tx.commit().await
    }
    .await
    .map_err(|e| e.to_string());
    drop(client);
    let _ = connection.await;
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embeds_every_migration_file_in_order() {
        let mut files: Vec<String> =
            std::fs::read_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/migrations"))
                .unwrap()
                .map(|entry| entry.unwrap().file_name().into_string().unwrap())
                .filter(|name| name.ends_with(".sql"))
                .collect();
        files.sort();
        let embedded: Vec<&str> = MIGRATIONS.iter().map(|(name, _)| *name).collect();
        assert_eq!(files, embedded);
    }
}
