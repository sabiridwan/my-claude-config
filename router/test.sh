#!/usr/bin/env bash
# zync-router test suite. No network, no credentials, no real API calls.
# Layer 1: classification fixtures (pure, offline).
# Layer 2: proxy mechanics against a mock upstream — model rewrite, auth relay,
#          SSE streaming, context hold, and passthrough on bodies it cannot parse.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="$DIR/server.js"
TMP="$(mktemp -d)"
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null; done; rm -rf "$TMP"; }
trap cleanup EXIT

# A server left behind by an interrupted run would keep the port and answer with a stale
# build — the suite would then test yesterday's code and pass.
for port in 9911 9912; do
  for p in $(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null); do
    echo "note: killing stale listener on :$port (pid $p)"; kill "$p" 2>/dev/null
  done
done
sleep 0.3

pass=0; fail=0
ok()   { pass=$((pass+1)); }
bad()  { fail=$((fail+1)); printf 'FAIL  %s\n      want=%s\n      got =%s\n' "$1" "$2" "$3"; }

# ---------- layer 1: classification ----------
t() {
  local prompt="$1" want="$2" got
  got=$(node "$SERVER" --classify "$prompt" 2>/dev/null | awk '{print $1}')
  [ "$got" = "$want" ] && ok || bad "$prompt" "$want" "${got:-<empty>}"
}

echo "--- layer 1: classification ---"
t "hey"                                                  trivial
t "what is the difference between debounce and throttle" trivial
t "is the build passing?"                                trivial
t "where is the checkout handler"                        simple
t "grep for OuisysSubscribe"                             simple
t "fix the typo in the footer"                           simple
t "write a commit message"                               simple
t "add a dark mode toggle"                               moderate
t "scaffold a new landing page"                          moderate
t "make the hero section responsive"                     moderate
t "why does apple pay fail on safari only"               complex
t "find the root cause of the flaky test"                complex
t "the deploy is broken"                                 complex
t "rotate the stripe api key"                            critical
t "run the migration on production"                      critical
t "update the subscription price to 9.99"                critical
t "rm -rf the build dir"                                 critical
t "delete all the test users"                            critical

# Read-only exemption: locating a high-stakes file is still just a grep.
t "find the pricing config"                              simple
t "where is the stripe secret stored"                    simple

# Ambient text must not decide the tier. Both of these are cheap asks wearing
# expensive-looking context — the exact failure that made the old hook useless.
t "<ide_opened_file>/x/src/billing/invoice.ts</ide_opened_file> where is the tab defined" simple
t "https://panel.example.com/create-credit-card add a favicon"                            moderate

# Ordering is load-bearing: 'complex' must outrank the ^find locate rule.
t "find the root cause of the intermittent rounding drift" complex

# Post-compaction resume text is harness scaffolding wearing the summary's dangerous
# nouns (token, payroll, migration), not a new ask — must not veto to critical.
t "This session is being continued from a previous conversation that ran out of context. discussed payroll tokens migration secret api key. Pick up the last task as if the break never happened." -
t "This session is being continued from a previous conversation that ran out of context. discussed payroll tokens migration secret api key. Pick up the last task as if the break never happened. rotate the stripe api key" critical

# ---------- layer 2: proxy mechanics ----------
echo "--- layer 2: proxy mechanics ---"

cat > "$TMP/mock.js" <<'JS'
const http = require('node:http'); const fs = require('node:fs');
http.createServer(async (req, res) => {
  const c = []; for await (const x of req) c.push(x);
  let body = {}; try { body = JSON.parse(Buffer.concat(c).toString() || '{}'); } catch {}
  fs.appendFileSync(process.argv[2], JSON.stringify({
    model: body.model ?? null, auth: req.headers.authorization ?? null, url: req.url,
    beta: req.headers['anthropic-beta'] ?? null, max_tokens: body.max_tokens ?? null,
  }) + '\n');
  // FAIL_ONCE makes the first rewritten request 4xx, so the replay path is exercised.
  if (process.env.FAIL_ONCE && body.model === 'claude-sonnet-5') {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end('{"type":"error","error":{"type":"invalid_request_error"}}');
  }
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.write('event: a\ndata: chunk1\n\n');
  setTimeout(() => res.end('event: b\ndata: chunk2\n\n'), 30);
}).listen(9911, '127.0.0.1');
JS

SEEN="$TMP/seen.jsonl"; : > "$SEEN"
node "$TMP/mock.js" "$SEEN" & PIDS+=($!); disown; sleep 0.6

node -e '
const fs=require("fs"),os=require("os"),p=require("path");
const c=JSON.parse(fs.readFileSync(p.join(os.homedir(),".claude/router/config.json"),"utf8"));
c.upstream="http://127.0.0.1:9911"; c.port=9912;
c.classifier.mode="regex";                 // layer 2 tests the wire, not the LLM
c.log=process.argv[1]+"/router.log";
fs.writeFileSync(process.argv[1]+"/cfg.json",JSON.stringify(c));' "$TMP"

ZYNC_ROUTER_CONFIG="$TMP/cfg.json" node "$SERVER" >/dev/null 2>&1 & PIDS+=($!); disown
sleep 0.8

post() {
  curl -s --max-time 10 -X POST http://127.0.0.1:9912/v1/messages \
    -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' -d @-
}
last() { tail -1 "$SEEN" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s)[process.argv[1]])))' "$1"; }

check() {
  local label="$1" want="$2" got="$3"
  [ "$got" = "$want" ] && ok || bad "$label" "$want" "${got:-<empty>}"
}

# downgrade actually reaches the wire
echo '{"model":"claude-opus-5[1m]","messages":[{"role":"user","content":"where is foo defined"}]}' | post >/dev/null
check "downgrade reaches upstream" "claude-sonnet-5" "$(last model)"

# credentials relayed untouched
check "auth header relayed verbatim" "Bearer RELAY-CHECK" "$(last auth)"

# high-stakes ask is not downgraded
echo '{"model":"claude-opus-5","messages":[{"role":"user","content":"rotate the stripe api key"}]}' | post >/dev/null
check "critical keeps strong model" "claude-opus-5" "$(last model)"

# On a plan without long-context for the cheap models, every model below Opus caps at 200k,
# so a 171k session genuinely has nowhere cheaper to go and must hold. Raise
# guards.contextLimits for Sonnet if the plan ever gains the 1m beta and this becomes a
# real Opus->Sonnet saving again.
node -e 'process.stdout.write(JSON.stringify({model:"claude-opus-5[1m]",messages:[{role:"user",content:"x ".repeat(300000)},{role:"user",content:"where is foo"}]}))' | post >/dev/null
check "past every cheap window, holds requested" "claude-opus-5[1m]" "$(last model)"

# Under the cap the same ask routes, which is where the saving on this plan actually lives.
node -e 'process.stdout.write(JSON.stringify({model:"claude-opus-5",messages:[{role:"user",content:"x ".repeat(100000)},{role:"user",content:"where is foo"}]}))' | post >/dev/null
check "under the cap it still routes" "claude-sonnet-5" "$(last model)"

# An unmatched phrasing must not park on the client's model — defaultTier routes it.
echo '{"model":"claude-opus-5","messages":[{"role":"user","content":"zzz unmatched phrasing"}]}' | post >/dev/null
check "unmatched falls to defaultTier" "claude-sonnet-5" "$(last model)"

# Never climb past what the client chose — routing may spend less, never more.
node -e 'process.stdout.write(JSON.stringify({model:"claude-sonnet-5",messages:[{role:"user",content:"x ".repeat(300000)},{role:"user",content:"where is foo"}]}))' | post >/dev/null
check "never upgrades past the requested model" "claude-sonnet-5" "$(last model)"

# A downgrade to a big-window model must KEEP the 1m beta, or the route is capped at 200k.
printf '%s' '{"model":"claude-opus-5","messages":[{"role":"user","content":"where is foo"}]}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const b=JSON.parse(s); b.messages.unshift({role:"user",content:"x ".repeat(300000)});
      process.stdout.write(JSON.stringify(b));})' \
  | curl -s -o /dev/null --max-time 10 -X POST http://127.0.0.1:9912/v1/messages \
      -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' \
      -H 'anthropic-beta: claude-code-20250219,context-1m-2025-08-07' -d @-
case "$(last beta)" in
  *context-1m*) ok ;;
  *) bad "1m beta kept for a big-window target" "context-1m-* retained" "$(last beta)" ;;
esac

# SSE arrives in order and complete
out=$(echo '{"model":"claude-opus-5","messages":[{"role":"user","content":"hey"}]}' | post | tr -d '\r')
case "$out" in *chunk1*chunk2*) ok ;; *) bad "SSE streams through" "chunk1 then chunk2" "$out" ;; esac

# unparseable body must forward untouched rather than 500
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST http://127.0.0.1:9912/v1/messages \
  -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' -d 'not json at all')
check "malformed body passes through" "200" "$code"

# the 1m-context beta must be pruned when the model is downgraded, or the cheap model
# rejects a flag it does not implement
printf '%s' '{"model":"claude-opus-5","max_tokens":64000,"messages":[{"role":"user","content":"where is foo"}]}' \
  | curl -s -o /dev/null --max-time 10 -X POST http://127.0.0.1:9912/v1/messages \
      -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' \
      -H 'anthropic-beta: claude-code-20250219,oauth-2025-04-20,context-1m-2025-08-07' -d @-
case "$(last beta)" in
  *context-1m*) bad "1m beta pruned on downgrade" "no context-1m-*" "$(last beta)" ;;
  *claude-code-20250219*oauth*) ok ;;
  *) bad "platform betas survive pruning" "claude-code + oauth kept" "$(last beta)" ;;
esac

# A client sending "expect: 100-continue" (curl does it for large bodies) must not break
# the forward — undici's fetch rejects that header outright, and the failure only shows on
# big requests, which is precisely the long-session traffic worth routing.
code=$(printf '%s' '{"model":"claude-opus-5","messages":[{"role":"user","content":"where is foo"}]}' \
  | curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST http://127.0.0.1:9912/v1/messages \
      -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' \
      -H 'expect: 100-continue' -d @-)
check "expect: 100-continue does not break forward" "200" "$code"

# multi-megabyte bodies must survive the hop intact
node -e 'process.stdout.write(JSON.stringify({model:"claude-opus-5[1m]",messages:[{role:"user",content:"x ".repeat(1600000)},{role:"user",content:"where is foo"}]}))' > "$TMP/big.json"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -X POST http://127.0.0.1:9912/v1/messages \
  -H 'content-type: application/json' -H 'authorization: Bearer RELAY-CHECK' --data-binary @"$TMP/big.json")
check "3MB body forwards" "200" "$code"
check "beyond all windows, holds requested" "claude-opus-5[1m]" "$(last model)"

# Stickiness: above the floor a conversation escalates but never drops back, because each
# switch re-reads the whole transcript uncached and a there-and-back costs two misses.
BIG=$(node -e 'process.stdout.write("y ".repeat(120000))')   # ~68k tokens, over the 40k floor
conv() { node -e '
  const [pad, ask] = process.argv.slice(1);
  process.stdout.write(JSON.stringify({model:"claude-opus-5",system:"s",
    messages:[{role:"user",content:pad},{role:"user",content:ask}]}));' "$BIG" "$1" | post >/dev/null; }

conv "where is the config"          # simple -> sonnet, first decision for this conversation
check "sticky: starts cheap"         "claude-sonnet-5" "$(last model)"
conv "why is this failing"          # complex -> escalates
check "sticky: escalates on demand"  "claude-opus-5"   "$(last model)"
conv "where is the config again"    # simple again -> must NOT drop back
check "sticky: never de-escalates"   "claude-opus-5"   "$(last model)"

# Below the floor the transcript is small, a cache miss is cheap, and routing should take
# every saving rather than clinging to an earlier decision.
echo '{"model":"claude-opus-5","system":"s","messages":[{"role":"user","content":"why is this failing"}]}' | post >/dev/null
echo '{"model":"claude-opus-5","system":"s","messages":[{"role":"user","content":"why is this failing"},{"role":"user","content":"where is the config"}]}' | post >/dev/null
check "small context routes freely"  "claude-sonnet-5" "$(last model)"

# non-/v1/messages paths are transparent
echo '{}' | curl -s -o /dev/null --max-time 10 -X POST http://127.0.0.1:9912/v1/models -d @- 
check "other paths untouched" "/v1/models" "$(last url)"

# replay: a 4xx on a request we rewrote must be retried once with the untouched original,
# so a routing mistake costs the saving rather than the turn
for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; PIDS=(); sleep 0.5
: > "$SEEN"
FAIL_ONCE=1 node "$TMP/mock.js" "$SEEN" & PIDS+=($!); disown
ZYNC_ROUTER_CONFIG="$TMP/cfg.json" node "$SERVER" >/dev/null 2>&1 & PIDS+=($!); disown
sleep 0.9
echo '{"model":"claude-opus-5","messages":[{"role":"user","content":"where is foo defined"}]}' | post >/dev/null
check "4xx on rewrite replays original" "claude-opus-5" "$(last model)"
[ "$(wc -l < "$SEEN" | tr -d ' ')" = "2" ] && ok \
  || bad "replay sends exactly one retry" "2 upstream requests" "$(wc -l < "$SEEN" | tr -d ' ')"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
