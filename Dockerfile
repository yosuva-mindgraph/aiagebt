# syntax=docker/dockerfile:1
# ============================================================================
# Airport in a Box — the deck, as a container you can put on a VM.
#
# Serves dist/index.html (the CANVAS build) over nginx. Static files only: no
# node in the final image, no node_modules, no source, no proxy, no API.
#
# Two stages. The first builds the deck FROM SOURCE so the image is reproducible
# from this repo; the second is nginx plus one HTML file. Nothing from stage one
# survives into stage two except the artifact it generated.
# ============================================================================


# ── stage 0: audit the build CONTEXT ───────────────────────────────────────
# This stage exists because the obvious place to check for config.js does not
# work, and the reason is worth writing down.
#
# The builder below copies an explicit ALLOWLIST (index.html, build.js, src/,
# assets/) rather than `COPY . .`. So a `[ -e config.js ]` test inside the
# builder can never be true — the builder's tree only ever contains what was
# named. That check reads like a guard and is dead code. It was in this file,
# and it passed a test where config.js was sitting in the build context with the
# .dockerignore line deleted. A guard that cannot fail is worse than no guard,
# because it is quoted as assurance.
#
# THIS stage does what that one pretended to. `COPY . /ctx` takes the whole
# context, honouring .dockerignore — so if the config.js line is ever removed or
# mistyped, config.js lands in /ctx and the build stops here with a message that
# names the cause. It is the only construct that can detect a .dockerignore
# regression, because .dockerignore is by definition invisible to anything that
# only sees what .dockerignore let through.
#
# alpine, not node: this stage runs `test` and nothing else.
FROM alpine:3.22 AS context-audit
COPY . /ctx
RUN if [ -e /ctx/config.js ]; then \
      echo ''; \
      echo 'REFUSING TO BUILD: config.js is in the Docker build context.'; \
      echo ''; \
      echo 'config.js holds an ElevenLabs API key, and build.js inlines it VERBATIM'; \
      echo 'into dist/index.html — in cleartext, in the page every visitor loads.'; \
      echo ''; \
      echo 'Fix: restore the `config.js` line in .dockerignore. Do not work around'; \
      echo 'this by deleting the check.'; \
      echo ''; \
      exit 1; \
    fi \
 && echo 'context audit: no config.js in the build context' > /audit-ok


# ── stage 1: build the deck ────────────────────────────────────────────────
# Pinned by digest as well as tag. A tag is a moving pointer — `node:22-alpine`
# is a different image most weeks — and "reproducible from source" is a hollow
# claim if the toolchain underneath it drifts. To update: pull the new tag and
# paste its digest.
FROM node:22-alpine@sha256:b6f26b36c8ff49624cfdac716b8ea1138d606df02586a77d364bb5536a634f85 AS builder

WORKDIR /build

# GUARD 0 is only real if it RUNS. BuildKit prunes stages nothing depends on, so
# a context-audit stage no one references is silently skipped and the build goes
# green having checked nothing. This COPY is what puts it in the dependency
# graph — it is load-bearing, not decorative, and the file it pulls is a
# one-line receipt whose contents are irrelevant.
COPY --from=context-audit /audit-ok /audit-ok

# NO `npm ci`, and this is not an omission.
#
# The canvas target of build.js is pure Node — it requires nothing but `fs` and
# `path` and reads index.html, assets/fonts.css and src/*. The devDependencies
# in package.json (esbuild, three, @gltf-transform, talkinghead) exist for
# `npm run build:vendor`, which regenerates vendor/talkinghead.bundle.js for the
# SEPARATE --3d target this image does not serve.
#
# So there is no install step, no lockfile to honour, no registry reachability
# needed at image-build time, and no network in this stage at all. That is a
# property worth keeping: this image builds on an air-gapped box.
#
# GUARD 1 — and it is this COPY, not a test further down. Naming the inputs
# instead of `COPY . .` means config.js cannot enter the build tree even if
# .dockerignore is deleted outright. It is the strongest of the three guards
# precisely because it is structural: there is no code path to fail open. If you
# ever change this to `COPY . .` for convenience, you are removing a guard and
# putting the key's safety entirely on .dockerignore.
COPY index.html build.js ./
COPY src/ ./src/
COPY assets/ ./assets/

# GUARD 2 — build without the key even if one were somehow present. `--no-config`
# makes build.js skip config.js unconditionally, so the key cannot be inlined
# even in a world where guards 1 and 0 both failed.
#
# `--require-voice` is the OTHER half of that same decision, and the two belong
# on one line because neither is safe alone.
#
# This image ships no ElevenLabs key — guards 0 through 3 exist to make sure of
# it — and it does not need one for exactly one reason: assets/voice-clips.js
# carries every string the deck can speak, pre-rendered. The twelve scenes'
# narration, all 39 knowledge-base answers, and the "I don't have that" reply
# src/ask.js falls back on. There is no runtime text left to synthesise, so
# there is nothing for a credential to be needed FOR. That is what makes this
# a host-and-run container rather than one you have to configure.
#
# Take the payload away and none of the guards notice. src/voice.js reads a
# miss, falls through to the browser's speechSynthesis, and the deck answers in
# the flat robotic voice this mechanism was built to replace — from an image
# that built green, serves a valid page, and talks. The file is GENERATED and
# gitignored, so "is it there" was until now a property of whose laptop ran
# `docker build`. `--require-voice` makes that a build failure instead: no
# clips file, a narration-scope one, or one short of the corpus all stop here
# with a message naming which. It is the difference between shipping the wrong
# thing and being told you were about to.
#
# If this line fails for you, the fix is in the error — usually:
#   node tools/prerender-voice.mjs --scope all      (on a machine with a key)
RUN node build.js --no-config --require-voice

# GUARD 3 — inspect the OUTPUT, not the inputs.
#
# Guards 0-2 all reason about what went in. This one reads the artifact that
# actually ships, which is the only object whose contents matter, and is
# therefore the one guard that stays valid no matter how the stages above are
# refactored. Matches the ElevenLabs prefix (sk_ + >=16 chars) and the Anthropic
# one (sk-ant-).
#
# The length bound is deliberate: config.example.js documents the field as
# `// sk_...`, and a bare `sk_` match would fail the build on a comment.
RUN if grep -qE 'sk_[A-Za-z0-9]{16,}|sk-ant-' dist/index.html; then \
      echo 'REFUSING TO BUILD: the built deck contains something shaped like an API key.'; \
      exit 1; \
    fi

# Precompress once, at maximum effort, so the runtime never spends CPU on it.
# -k keeps the plaintext: nginx needs both, and serves whichever the client's
# Accept-Encoding asks for. Both files are byte-identical in every container
# started from this image, which is what keeps the ETags stable across replicas.
RUN gzip -9 -k dist/index.html \
 && echo "built:  $(wc -c < dist/index.html) bytes raw, $(wc -c < dist/index.html.gz) bytes gzipped"


# ── stage 2: serve it ──────────────────────────────────────────────────────
# alpine-SLIM, not plain alpine. Measured on this build: 21 MB against 93.5 MB,
# and the 72 MB difference is njs, the ACME client and the extra module set —
# a scripting runtime and an ACME implementation, in an image whose entire job
# is to return one static file it already has. That is attack surface bought
# with nothing.
#
# The slim variant keeps everything this actually needs, which is worth stating
# because it is not obvious: http_gzip_static_module is compiled in, envsubst is
# present (so the ${AIB_PORT} template still works), the entrypoint scripts are
# all there, and the nginx user is still uid 101. The one thing it drops that
# this file touches is /usr/bin/wget — see HEALTHCHECK below.
#
# Pinned by digest for the same reason as the builder: a tag moves.
FROM nginx:1.29-alpine-slim@sha256:c9366b8c560169b101ca0e5422ed063b20779e6454c2326b9c9704225c9b0c08

# Default port. Overridable at `docker run -e AIB_PORT=...` because the config
# is a template the stock entrypoint runs envsubst over at boot. Note that
# EXPOSE cannot be dynamic, so if you change AIB_PORT you change the right-hand
# side of -p to match.
ENV AIB_PORT=8080

COPY docker/nginx.conf             /etc/nginx/nginx.conf
COPY docker/default.conf.template  /etc/nginx/templates/default.conf.template

# The only thing that crosses the stage boundary: the generated artifact. No
# node binary, no node_modules, no src/, no build.js.
#
# --chmod=444 on the COPY rather than a later `RUN chmod`, and the difference is
# not cosmetic. overlayfs has no way to change a file's mode in place: a chmod in
# a subsequent layer COPIES THE WHOLE FILE UP into that layer, so the deck and
# its .gz were being stored twice and the image carried 1.73 MB of duplicate.
# Setting the mode as part of the COPY writes it once, correct from the start —
# and it matters more as the artifact grows, since the waste is the size of the
# file. Read-only is right here: nothing should ever write to the document root.
COPY --from=builder --chmod=444 /build/dist/index.html    /usr/share/nginx/html/index.html
COPY --from=builder --chmod=444 /build/dist/index.html.gz /usr/share/nginx/html/index.html.gz

# Two things:
#
#   1. Remove the stock index.html/50x.html. Ours already overwrote index.html;
#      this makes sure the only document this server can return is the deck.
#   2. Make /etc/nginx/conf.d writable by uid 101 — the entrypoint's envsubst
#      step RENDERS the template into it at boot, so it is the one path outside
#      /tmp that has to be writable.
RUN rm -f /usr/share/nginx/html/50x.html \
 && chown -R nginx:nginx /etc/nginx/conf.d \
 && chmod 755 /etc/nginx/conf.d

# uid 101, shipped by the base image. Everything nginx writes (pid, temp paths,
# logs) was redirected to /tmp or /dev/std* in nginx.conf precisely so this
# line can be here without a pile of chowns across /var.
USER nginx

EXPOSE 8080

# `busybox wget`, not `wget`. alpine-slim ships the busybox multi-call binary
# but does not symlink the wget applet onto PATH, so a bare `wget` is
# "not found" — which a HEALTHCHECK reports as UNHEALTHY, i.e. a perfectly
# healthy container that an orchestrator would restart forever. Invoking the
# applet through busybox is exact and costs nothing; the alternative is
# apk add curl for ~4 MB to do what is already in the image.
#
# Shell form on purpose: ${AIB_PORT} has to expand at RUN time, not BUILD time,
# or overriding the port would leave the healthcheck probing the old one and the
# container would go unhealthy while serving perfectly.
#
# start-period covers boot; nginx is up in well under a second, but envsubst and
# the entrypoint scripts run first.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD busybox wget -q -O /dev/null "http://127.0.0.1:${AIB_PORT}/healthz" || exit 1

# Inherited from the base image, restated so it is visible: the stock
# docker-entrypoint.sh is what renders the template, then execs nginx as PID 1
# in the foreground.
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
