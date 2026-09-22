# zap-to-text — privacy & advanced

For first-time setup (`.env`, QR, create group, discover JID), follow the main [README.md](README.md).

**Trigger:** any `audioMessage` in the configured group (`TRANSCRIBE_GROUP_JID`), including your own / PTT  
**Privacy:** other chats are ignored immediately — other groups may log `ignored` + jid; DMs are silent; no media download, OpenAI, markdown, or reply  
**Presence:** `markOnlineOnConnect: false`, no `readMessages`

## Start / stop

```bash
./up.sh
```

Or: `docker compose --env-file .env up -d --build`

Stop (keeps session data): `docker compose down`  
(Do **not** use `-v` unless you intend to wipe auth + seen ids.)

Requires `OPENAI_API_KEY` and `TRANSCRIBE_GROUP_JID` in `.env` for transcription.

### Docker Desktop (macOS)

Settings → General → **Start Docker Desktop when you log in**.  
`restart: unless-stopped` brings the container back when the engine starts.

## Flow

1. Forward a voice note to your configured WhatsApp group
2. Bot replies in the group with the raw transcription (quoted on the audio). No summary.
3. Markdown is written under `./transcripts/` (frontmatter + `## Transcrição` only)

Failures get a short reply: `Falha ao transcrever este áudio.` The reason stays in container logs.

Long transcripts are split into WhatsApp-sized chunks; each chunk quotes the original audio.

## Privacy guarantees

| Layer | Behavior |
|-------|----------|
| App | `remoteJid` must equal `TRANSCRIBE_GROUP_JID` **before** any download/OpenAI/file/content log |
| Drop path | other `@g.us` groups: log `ignored` + jid only; DMs: silent |
| Presence | offline connect; no read receipts from this client |
| Ports | none published |
| Network | Compose default only — no custom or external network |

Honest limit: a linked WhatsApp device still *receives* protocol events for other chats (gray ticks). This process does not download, transcribe, save, or reply to them.

### Cursor `.env` hooks

Hooks under `.cursor/hooks/` block agents from obvious Read/Write/Shell access to `.env` (and some path-construction bypasses). **Best-effort only** — not an absolute sandbox; they do not replace `.gitignore` or OS-level secret hygiene.

### Leak test

```bash
docker compose logs -f zap-to-text
```

Send audio/text in another chat → expect no new `./transcripts/` files and no replies outside the group (DMs stay silent in logs; other groups may show `ignored`). Then forward audio to your transcription group → quoted reply + one `.md`.

## WhatsApp QR (first time / reconnect)

Session files live under `./data/auth`. First start (or after logout) prints a QR in Docker logs:

```bash
docker compose logs -f zap-to-text
```

Scan with WhatsApp → Linked devices. When you see `WhatsApp connection open`, you are paired.

To force a new QR: stop the container, delete `./data/auth`, start again.

## OpenAI

`OPENAI_API_KEY` in `.env`. Model: `whisper-1`, automatic language, no summary.

## Useful commands

```bash
./up.sh
docker compose logs -f zap-to-text
docker compose ps
docker compose restart
```
