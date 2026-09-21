# ============================================================================
#  The key-holding proxy.
#
#  Two files and no dependencies, so there is no install step and no lockfile
#  to drift. Nothing secret is COPYed: the three keys arrive at RUN time via
#  --env-file, which is why `docker history` and a filesystem grep of the built
#  image both come up empty.
#
#      docker build -t aib-proxy ./proxy
#      docker run -d --name aib-proxy --network host --env-file proxy/.env aib-proxy
#
#  --network host is REQUIRED, and it is the reason no port is published. The
#  server binds 127.0.0.1 only; on the host network that is the host's loopback,
#  which is exactly what nginx proxies /api/ to and what nothing off-box can
#  reach. Run it on a bridge network instead and 127.0.0.1 is the container's
#  own loopback — reachable by nothing, including nginx.
# ============================================================================
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Ownership set at COPY time so the app directory is not writable by the user
# that runs the process.
COPY --chown=root:root package.json server.mjs ./

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
