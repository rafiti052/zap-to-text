# Local bridge — Audio Transcribe (Baileys, one container)

Single Node process with Baileys. No Evolution, Postgres, Redis, n8n, or Python app.

**Group:** `Audio Transcribe` → `120363412859178311@g.us`  
**Trigger:** any `audioMessage` in that group (including your own / PTT)  
**Privacy:** other chats are ignored immediately — log only `ignored` + jid; no media download, OpenAI, markdown, or reply  
**Presence:** `markOnlineOnConnect: false`, no `readMessages`

## Start once

```bash
./up.sh
```

Or: `docker compose --env-file .env up -d --build`

Stop (keeps volumes): `docker compose down`  
(Do **not** use `-v` unless you intend to wipe Baileys auth + seen ids.)

Requires `OPENAI_API_KEY` in `.env`.

### Docker Desktop (macOS)

Settings → General → **Start Docker Desktop when you log in**.  
`restart: unless-stopped` brings the bridge back when the engine starts.

## Flow

1. Forward a voice note to the WhatsApp group **Audio Transcribe**
2. Bot replies in the group with the raw transcription (quoted on the audio). No summary.
3. Markdown is written under `./transcripts/` (frontmatter + `## Transcrição` only)

Failures get a short reply: `Falha ao transcrever este áudio.` The reason stays in container logs.

Long transcripts are split into WhatsApp-sized chunks; each chunk quotes the original audio.

## Privacy guarantees

| Layer | Behavior |
|-------|----------|
| Bridge | `remoteJid` must equal the group JID **before** any download/OpenAI/file/content log |
| Drop path | log `ignored` + jid only |
| Presence | offline connect; no read receipts from this client |
| Ports | none published |

Honest limit: a linked WhatsApp device still *receives* protocol events for other chats (gray ticks). This process does not download, transcribe, save, or reply to them.

### Leak test

```bash
docker compose logs -f bridge
```

Send audio/text in another chat → expect only `ignored`; zero new `./transcripts/` files; zero replies outside the group. Then forward audio to **Audio Transcribe** → quoted reply + one `.md`.

## WhatsApp QR (first time / reconnect)

Session files live under `./data/auth` (volume). First start (or after logout) prints a QR in Docker logs:

```bash
docker compose logs -f bridge
```

Scan with WhatsApp → Linked devices. When you see `WhatsApp connection open`, you are paired.

To force a new QR: stop the container, delete `./data/auth`, start again.

## OpenAI

`OPENAI_API_KEY` in `.env`. Model: `whisper-1`, automatic language, no summary.

## Useful commands

```bash
./up.sh                          # rebuild + up
docker compose logs -f bridge
docker compose ps
docker compose restart
```
