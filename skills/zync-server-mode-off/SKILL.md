---
name: zync-server-mode-off
description: Turn off zync server mode for this chat session so work runs on the local Mac again. Triggers on "zync-server-mode-off", "server mode off", "stop server mode", "back to local", "come back from the server".
---

# Server mode — off

```bash
~/.claude/server-mode/activate.sh off
```

Then confirm in one line which target was released and that work is local again.

Before deactivating, check for unfinished background jobs on the server and tell
the user if any are still running — they keep running after deactivation, but
`zrun --tail` will no longer be reachable until server mode is on again:

```bash
~/.claude/server-mode/zrun --jobs
```
