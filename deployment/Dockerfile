FROM debian:bookworm-slim

ARG CLOUDFLARED_VERSION=2026.2.0

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -L https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && \
    dpkg -i /tmp/cloudflared.deb && \
    rm /tmp/cloudflared.deb && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Run as non-root user
RUN useradd -m -u 1001 cloudflared
USER cloudflared

ENTRYPOINT ["cloudflared"]
