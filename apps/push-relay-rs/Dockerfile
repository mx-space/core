FROM rust:1-alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /src
COPY apps/push-relay-rs/Cargo.toml apps/push-relay-rs/Cargo.lock ./
COPY apps/push-relay-rs/src ./src
COPY apps/push-relay-rs/migrations ./migrations
RUN cargo build --release --locked

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=build /src/target/release/push-relay /usr/local/bin/push-relay
USER nobody
CMD ["push-relay"]
