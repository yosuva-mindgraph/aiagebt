# Deploying the deck with the key-holding proxy

How to run `aib-presenter` and `aib-proxy` as a pair on the Azure VM, so the public
walkthrough gets a live voice and a live LLM **without a credential in the page**.

This is the deployment procedure for a deck built with `--public-config`. If you are
shipping the emailed file, the booth stick, or the air-gapped build, none of this
applies — that deck makes no network requests at all and wants no proxy. See
`config.public.js` for the three configurations and how they differ.

---

## 1. The shape of it

```
            internet
               │
               │  https://<generated>.trycloudflare.com
               ▼
        ┌──────────────┐
        │  cloudflared │   systemd unit  cloudflared-aib
        │              │   --url http://127.0.0.1:8090
        └──────┬───────┘
               │  (host loopback — NOT a published port on the VM's public NIC)
               ▼
  ┌────────────────────────┐
  │  aib-presenter         │   127.0.0.1:8090 -> :8080
  │  nginx + the deck      │
  │                        │
  │   /         -> the deck (one static HTML file)
  │   /healthz  -> "ok"
  │   /api/     -> proxy_pass ──────────────┐
  └─────────────────────────────────────────┼──┐
                                            │  │  docker network: aib-net
  ┌─────────────────────────────────────────▼──┴──┐
  │  aib-proxy                                    │
  │  holds ELEVENLABS_API_KEY + ANTHROPIC_API_KEY │
  │  listens :8091   ·   publishes NO host port   │
  └───────────────────────────────────────────────┘
```

The single most important property: **the tunnel terminates on the presenter's own
nginx.** `cloudflared` points at `http://127.0.0.1:8090`, which is the presenter. So
`/api/llm` requested by the browser is *same-origin* — it travels the tunnel to this
same nginx, which routes it onward to the proxy over the docker network.

That is why this needs **no new inbound port**, and it is not a nicety: **port 80 is
the only port the Azure NSG allows.** 443, 8080, 3000 and 8443 all time out from
outside. Any design that wants the browser to reach the proxy directly — a second
hostname, a second tunnel, a published `:8091` — is dead on arrival at the NSG. Do not
plan one. If you find yourself needing an inbound port, the design is wrong, not the
firewall.

---

## 2. Before you touch anything: what is already on this VM

There is a **production stack on this box that is not yours to restart.** Confirm it is
healthy *before* you start and *again* after, so that if something breaks you know
whether you did it:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expect, from compose project **`airport-hub`**:

| container | role | note |
|---|---|---|
| `airport-hub` | the product (console + API) | |
| `airport-hub-edge` | nginx | **owns `0.0.0.0:80`** |
| `airport-hub-docs` | docs site | |
| `airport-hub-mailpit` | demo mail catcher | |

and separately the presenter:

| container | role |
|---|---|
| `aib-presenter` | the deck, image `aib-deck:final`, bound `127.0.0.1:8090` |

**Three rules about that stack, and they are hard rules:**

1. **Nothing you create joins the `airport-hub` compose project.** No
   `com.docker.compose.project=airport-hub` label, no adding services to
   `airport-hub/deploy/vm/docker-compose.yml`. If the proxy is in that project, a
   routine `docker compose down` on the hub takes the proxy with it, and a
   `docker compose up -d` recreates *your* container as a side effect of someone
   else's deploy. Run the two containers here with plain `docker run`, or with a
   compose file under its own project name (`-p aib`), and never the hub's.
2. **Nothing you create touches `0.0.0.0:80`.** `airport-hub-edge` owns it. A
   `-p 80:...` anywhere in this procedure either fails to bind or, worse, wins a race
   and takes the hub's front door down. There is no reason to want it: your traffic
   arrives through `cloudflared` on loopback.
3. **Do not `docker compose down`, `restart`, or `prune` anything in that project.**
   In particular `docker system prune -a` will delete the hub's images. If you need to
   clean up, name what you are deleting.

---

## 3. The docker network

The two containers find each other by **container name over a user-defined bridge
network**. That network is not optional and not a matter of taste:

* The default `bridge` network has **no DNS-based service discovery**. `aib-proxy` does
  not resolve to anything on it, so nginx's `proxy_pass` has nothing to talk to.
* A user-defined network gives you docker's embedded DNS at `127.0.0.11`, which is
  exactly what `docker/default.conf.template`'s `resolver` line names.
* It is also an isolation boundary: only containers you explicitly attach can reach the
  proxy.

```bash
docker network create aib-net      # idempotent enough; errors if it exists, which is fine
```

---

## 4. The proxy's secrets

The whole point of the proxy is that the keys live **server-side, on the VM, in a file
that is not in the repo and not in an image.**

### Where the file goes

Outside the repository. `/srv/aib-proxy/aib-proxy.env` is the convention used here,
matching `/srv/airport-hub/var` next door:

```bash
sudo mkdir -p /srv/aib-proxy
sudo install -m 600 -o root -g root /dev/null /srv/aib-proxy/aib-proxy.env
sudo -e /srv/aib-proxy/aib-proxy.env
```

```ini
# /srv/aib-proxy/aib-proxy.env   — mode 0600, root-owned, never in git
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ANTHROPIC_API_KEY=...
```

`0600` matters: this file is the credential. Anyone who can read it can spend the
account.

### Why outside the repo, specifically

The deck's `Dockerfile` has a **context-audit stage that fails the build if any `.env`
is found in the build context** (`.env.example` / `.env.sample` / `.env.template` are
allowed through — they are keyless by convention). `proxy/` is deliberately *not* in
`.dockerignore`, so that check can actually see a stray file rather than being a guard
that cannot fail. Keep the real env file at `/srv/aib-proxy/` and the check never fires
in normal operation while remaining fully able to. If it *does* fire, **move the file —
do not add a `.dockerignore` line to silence it.**

### Why `--env-file` and not `-e`

```bash
# correct
docker run --env-file /srv/aib-proxy/aib-proxy.env ...

# NOT this
docker run -e ELEVENLABS_API_KEY=sk_... ...
```

`-e` puts the key in your shell history, in `ps` output for every user on the box while
the command runs, and in whatever terminal scrollback or session recording is open on a
shared shell. `--env-file` passes a path; the value never appears on a command line.

And never `ENV ELEVENLABS_API_KEY=...` in a Dockerfile, or a `COPY .env`. An image layer
is permanent and readable by anyone who can pull the image — `docker history` will show
it. Secrets arrive at **run time** or not at all.

---

## 5. Run it

### 5a. Build the deck image

From the repo root, on the VM (or wherever you build; the image is reproducible from
source and needs no network at build time):

```bash
docker build -t aib-deck:public .
```

The Dockerfile builds with `--no-config --public-config --require-voice`. That means:

* `--no-config` — no `config.js`, so no key can be inlined.
* `--public-config` — inlines `config.public.js`: the two relative endpoints and
  nothing else.
* `--require-voice` — **refuses to build** unless `assets/voice-clips.js` is a complete
  all-scope payload. This stays required even though a live voice is now reachable,
  because the proxy is an enhancement and must never become a dependency. If the proxy
  is down mid-demo the deck falls back to the baked clips and the walkthrough is
  unaffected.

`assets/voice-clips.js` is generated and gitignored, so a fresh clone does not have one.
Render it once, on a machine with a key:

```bash
node tools/prerender-voice.mjs --scope all
```

### 5b. Run the proxy — **no published port**

```bash
docker run -d \
  --name aib-proxy \
  --network aib-net \
  --env-file /srv/aib-proxy/aib-proxy.env \
  --restart unless-stopped \
  aib-proxy:latest
```

**No `-p` flag. Not `-p 8091:8091`, not `-p 127.0.0.1:8091:8091`.** The proxy is reached
only by the presenter, over `aib-net`, by name. Publishing a port would put a
key-holding service on a host interface for no reason — and on a box where the NSG
allows port 80, a published `:8091` is at best useless and at worst reachable from
anything else on the VM.

Verify it published nothing:

```bash
docker port aib-proxy      # must print NOTHING
```

> **The proxy must listen on `0.0.0.0:8091` inside its own container — not
> `127.0.0.1:8091`.**
>
> This is the one thing in this document that is easy to get backwards, because
> "bind loopback, don't expose" is the right instinct in most other places. It is
> wrong here, and it fails in a way that looks like a networking problem rather than
> a config one.
>
> `127.0.0.1` inside a container is *that container's own* loopback. Another
> container on the same network cannot reach it — each has its own network
> namespace. Bind loopback and nginx gets a connection refused and returns **502**,
> while `docker exec aib-proxy curl 127.0.0.1:8091` from inside works perfectly, which
> sends people hunting the network for a fault that is not there. (Verified both ways
> against this nginx config: container-local `127.0.0.1` → 502; `0.0.0.0` → 200.)
>
> The container is not exposed by this. It is unreachable from the host and from the
> internet because it **publishes no host port** — that is the control doing the work,
> and it is doing it whichever address the process binds inside.

### 5c. Run the presenter

Replace the running one. Note `127.0.0.1:8090` — loopback only, because `cloudflared` is
what reaches it:

```bash
docker rm -f aib-presenter
docker run -d \
  --name aib-presenter \
  --network aib-net \
  -p 127.0.0.1:8090:8080 \
  --restart unless-stopped \
  aib-deck:public
```

`--network aib-net` is what lets nginx resolve `aib-proxy`. A presenter started without
it serves the deck perfectly and 502s every `/api/` call — which is the single most
likely cause if the voice is flat after a redeploy.

**Order does not matter.** nginx resolves the proxy at request time, not at config load,
so the presenter starts whether or not `aib-proxy` is running and a missing proxy is a
502 on `/api/` rather than a container that will not boot. (Confirmed: the presenter
comes up `healthy` with no proxy on the network at all.) That is deliberate — see the
long note in `docker/default.conf.template`.

### 5d. The tunnel

`cloudflared` runs as the systemd unit **`cloudflared-aib`**, with
`--url http://127.0.0.1:8090`. If the presenter was replaced on the same port, the
tunnel needs nothing: it is pointed at a port, not a container.

```bash
systemctl status cloudflared-aib
journalctl -u cloudflared-aib -n 20 --no-pager   # the current public hostname is in here
```

The `*.trycloudflare.com` hostname is **regenerated every time that unit restarts**. It
is not stable and must never be written into a build — which is precisely why
`config.public.js` uses relative paths. Restarting the tunnel changes the URL you hand
out; it does not require rebuilding anything.

---

## 6. Verify

Run these on the VM, in order. Each one isolates a different link in the chain, so the
first failure tells you where the fault is.

```bash
# 1. the deck itself
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/          # 200
curl -s http://127.0.0.1:8090/healthz                                    # ok

# 2. nginx's rendered config is valid and has the /api/ route
docker exec aib-presenter nginx -t
docker exec aib-presenter grep -c 'location /api/' /etc/nginx/conf.d/default.conf   # 1

# 3. the deck is keyless — this is the one that matters
docker exec aib-presenter \
  grep -cE 'sk_[A-Za-z0-9]{16,}|sk-ant-' /usr/share/nginx/html/index.html   # 0
docker exec aib-presenter \
  grep -coE "'/api/(llm|tts)'" /usr/share/nginx/html/index.html             # 2

# 4. the proxy is not on any host interface
docker port aib-proxy                                                    # empty

# 5. end to end, through nginx
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8090/api/llm   # not 502

# 6. the hub is exactly as you found it
docker ps --filter label=com.docker.compose.project=airport-hub \
  --format '{{.Names}}\t{{.Status}}'
```

Then open the public URL and ask the deck a question. If it answers in the real voice,
the whole chain is up. If it answers in a flat robotic voice, the deck is working and
`/api/` is not — start at check 5.

---

## 7. Reading a failure

| symptom | cause |
|---|---|
| `/api/*` → **502**, deck fine | proxy down, not on `aib-net`, or bound to container-local `127.0.0.1` instead of `0.0.0.0` |
| `/api/*` → **404** from the proxy | someone added a trailing slash to `proxy_pass http://aib-proxy:8091` — that makes nginx strip the `/api/` prefix, so `/api/llm` arrives as `/llm`. Remove it. |
| presenter container restart-looping | should not happen with the current config (resolution is deferred). If someone replaced the variable with a literal hostname, nginx resolves at config load and treats failure as fatal. |
| voice is robotic, no errors | `/api/tts` unreachable **or** the build is not a `--public-config` one. Check 3 above distinguishes them. |
| questions answered only from the knowledge base | `/api/llm` unreachable. The deck is designed to do this rather than fail; it is a degradation, not a fault. |
| CSP violations in the console on `/api/` calls | someone uncommented the `connect-src 'none'` CSP line, which is the one for the *air-gapped* image. The `--public-config` image wants `connect-src 'self'`. Both variants are in `docker/default.conf.template`. |
| build fails at `context-audit` | a `config.js` or a real `.env` is in the build context. Move the file; do not delete the check. |

---

## 8. Rollback

The previous deck image is still on the box.

```bash
docker rm -f aib-presenter
docker run -d --name aib-presenter -p 127.0.0.1:8090:8080 \
  --restart unless-stopped aib-deck:final
docker rm -f aib-proxy          # optional; it is inert once nothing routes to it
```

`aib-deck:final` is the pre-proxy image: `--no-config`, no `/api/` route in use, no
network calls. It needs no proxy and no `aib-net`. The tunnel is unaffected — it points
at port 8090 either way. Rollback is one container replacement and touches nothing in
the `airport-hub` project.

---

## 9. The rules, in one place

1. No credential in an image, in a build context, or on a command line. `--env-file`,
   run time, `0600`, outside the repo.
2. `aib-proxy` publishes **no host port**, and listens on `0.0.0.0` **inside** its
   container.
3. Nothing joins the `airport-hub` compose project. Nothing binds `0.0.0.0:80`.
4. No new inbound port — the NSG allows 80 and nothing else. Same-origin `/api/` is the
   design, not a shortcut.
5. No hostname in the artifact. The tunnel's name is ephemeral; the endpoints stay
   relative.
6. The pre-rendered speech stays required. The proxy is an enhancement, never a
   dependency.
