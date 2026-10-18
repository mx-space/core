FROM rust:1-alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /src
COPY apps/push-relay-rs/Cargo.toml apps/push-relay-rs/Cargo.lock ./
COPY apps/push-relay-rs/src ./src
COPY apps/push-relay-rs/migrations ./migrations
RUN cargo build --release --locked

FROM alpine:3
RUN apk add --no-cache ca-certificates su-exec \
    && mkdir /data && chown nobody:nogroup /data && chmod 700 /data
COPY --from=build /src/target/release/push-relay /usr/local/bin/push-relay
ENV PUSH_RELAY_DATABASE_PATH=/data/push-relay.sqlite3
VOLUME ["/data"]
USER nobody
CMD ["/bin/sh", "-ec", "umask 077; push-relay migrate; exec push-relay"]
