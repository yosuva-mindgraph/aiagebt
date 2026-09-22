# ============================================================================
#  The key-holding proxy.
#
#  Two files and no dependencies, so there is no install step and no lockfile
#  to drift. Nothing secret is COPYed: the three keys arrive at RUN time via
#  --env-file, which is why `docker history` and a filesystem grep of the built
#  image both come up empty.
#
#      docker build -t aib-proxy ./proxy
#      docker network create aib          # t3 owns this; shown for context
#      docker run -d --name aib-proxy --network aib --env-file proxy/.env aib-proxy
#
#  PUBLISH NO PORT. Not -p, not --expose-to-the-host, nothing. nginx reaches
#  this over the private bridge as http://aib-proxy:8091; an unpublished
#  container port has no route in from any of the host's external interfaces,
#  and Docker's network namespace is what enforces that.
#
#  BIND_ADDR=0.0.0.0 below is deliberate and is the SAFER choice here, not a
#  relaxation — 0.0.0.0 inside a namespace with no route in beats 127.0.0.1 on
#  the host's own network stack (which is what --network host would force, and
#  under which nginx could not resolve this container by name). The full
#  argument is in the header of server.mjs; do not "fix" this line alone.
# ============================================================================
FROM node:24-alpine

ENV NODE_ENV=production
ENV BIND_ADDR=0.0.0.0
WORKDIR /app

# Ownership set at COPY time so the app directory is not writable by the user
# that runs the process.
COPY --chown=root:root package.json server.mjs ./

USER node

# Documentation only — EXPOSE publishes nothing. It records the port nginx
# should reach on the bridge as http://aib-proxy:8091.
EXPOSE 8091

# 127.0.0.1 here is the container's own loopback, which reaches the 0.0.0.0
# listener from inside. It works under either bind address.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
