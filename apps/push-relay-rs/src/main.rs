mod apns;
mod config;
mod crypto;
mod fanout;
mod http;
mod migrate;
mod protocol;
mod requests;
mod service;
mod store;
mod validate;
mod worker;

use std::net::SocketAddr;
use std::process::ExitCode;
use std::sync::Arc;

use deadpool_postgres::{ManagerConfig, PoolConfig, RecyclingMethod, Runtime};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use hyper_util::server::graceful::GracefulShutdown;
use tokio::net::TcpListener;
use tokio::signal::unix::{SignalKind, signal};
use tokio::sync::watch;
use tokio_postgres::NoTls;

use crate::apns::ApnsProvider;
use crate::crypto::DataVault;
use crate::service::RelayService;
use crate::store::Store;
use crate::worker::DeliveryWorker;

async fn shutdown_signal() {
    let mut terminate = signal(SignalKind::terminate()).expect("SIGTERM handler");
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = terminate.recv() => {}
    }
}

async fn serve() -> Result<(), String> {
    let config = config::load()?;
    let _ = rustls::crypto::ring::default_provider().install_default();

    let pool = deadpool_postgres::Config {
        url: Some(config.database_url.clone()),
        manager: Some(ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        }),
        pool: Some(PoolConfig::new(10)),
        ..Default::default()
    }
    .create_pool(Some(Runtime::Tokio1), NoTls)
    .map_err(|e| e.to_string())?;
    let store = Store::new(pool.clone());

    let app_ids = config.apps.keys().cloned().collect();
    let service = Arc::new(RelayService::new(
        store.clone(),
        DataVault::new(&config.data_key)?,
        config.public_url.clone(),
        app_ids,
    ));
    let worker = DeliveryWorker::new(
        store,
        ApnsProvider::new(config.apps)?,
        DataVault::new(&config.data_key)?,
    );

    let listener = TcpListener::bind(SocketAddr::from(([0u16; 8], config.port)))
        .await
        .map_err(|e| e.to_string())?;
    println!("Push Relay listening on {}", config.public_url);
    let (stop_worker, worker_shutdown) = watch::channel(false);
    let worker = tokio::spawn(worker.run(worker_shutdown));

    let graceful = GracefulShutdown::new();
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);
    loop {
        tokio::select! {
            accepted = listener.accept() => {
                let stream = match accepted {
                    Ok((stream, _)) => stream,
                    Err(error) => {
                        eprintln!("Accept failed: {error}");
                        continue;
                    }
                };
                let service = service.clone();
                let connection = http1::Builder::new()
                    .serve_connection(TokioIo::new(stream), service_fn(move |request| http::handle(service.clone(), request)));
                let connection = graceful.watch(connection);
                tokio::spawn(async move {
                    let _ = connection.await;
                });
            }
            _ = &mut shutdown => break,
        }
    }

    drop(listener);
    let _ = stop_worker.send(true);
    let _ = worker.await;
    graceful.shutdown().await;
    pool.close();
    Ok(())
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let result = match std::env::args().nth(1).as_deref() {
        Some("migrate") => {
            match std::env::var("PUSH_RELAY_DATABASE_URL").map(|url| url.trim().to_string()) {
                Ok(url) if !url.is_empty() => migrate::run(&url)
                    .await
                    .map(|_| println!("Push Relay database migration completed")),
                _ => Err("PUSH_RELAY_DATABASE_URL is required".into()),
            }
        }
        Some(other) => Err(format!("Unknown command: {other}")),
        None => serve().await,
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
