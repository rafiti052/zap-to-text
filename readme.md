# zap-to-text

Local Docker service that turns WhatsApp voice notes into text with OpenAI Whisper.

Forward an audio message to your transcription group. The bot replies with the transcript (quoted on the audio) and saves a markdown file under `transcripts/`.

> Local folder name may still be `transcrevezap` from earlier clones — rename on disk if you want; the product name is **zap-to-text**.

## Setup

### 1. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env` and set:

```
OPENAI_API_KEY=sk-...
```

Leave `TRANSCRIBE_GROUP_JID` empty for now — you will discover it after connecting.

### 2. Start the container

```bash
./up.sh
```

Or: `docker compose --env-file .env up -d --build`

### 3. Scan the QR

```bash
docker compose logs -f zap-to-text
```

Scan with WhatsApp → **Linked devices**. When you see a connection-open log (or a group list), you are paired.

### 4. Create a WhatsApp group

In WhatsApp, create a group for transcriptions (e.g. **Audio Transcribe**).

WhatsApp requires at least one contact when creating a group — add someone, create the group, then remove them if you want to stay alone.

### 5. Discover the group JID

With the container running and `TRANSCRIBE_GROUP_JID` still unset, the app lists your groups on connect:

```bash
docker compose logs -f zap-to-text
```

Look for lines like `group` with `name` and `jid` (ends in `@g.us`). Copy the jid of your transcription group.

Until `TRANSCRIBE_GROUP_JID` is set, incoming messages are discarded quietly (no per-chat spam in the logs).

### 6. Set the group JID and restart

In `.env`:

```
TRANSCRIBE_GROUP_JID=1203...@g.us
```

Then restart:

```bash
./up.sh
```

Or: `docker compose up -d`

You should see `WhatsApp connection open` with your `group` jid in the logs.

### 7. Forward audio

Forward a voice note to that group. The bot replies with the transcript and writes markdown under `./transcripts/`.

## Behavior

**Trigger:** any `audioMessage` in the configured group (`TRANSCRIBE_GROUP_JID`), including your own / PTT  
**Privacy:** other chats are ignored immediately — other groups may log `ignored` + jid; DMs are silent; no media download, OpenAI, markdown, or reply  
**Presence:** `markOnlineOnConnect: false`, no `readMessages`

1. Forward a voice note to your configured WhatsApp group
2. Bot replies with the raw transcription (quoted on the audio). No summary.
3. Markdown under `./transcripts/` (frontmatter + `## Transcrição` only)

Failures get a short reply: `Falha ao transcrever este áudio.` Details stay in container logs. Long transcripts are split into WhatsApp-sized chunks.

## Privacy guarantees

| Layer | Behavior |
|-------|----------|
| App | `remoteJid` must equal `TRANSCRIBE_GROUP_JID` **before** any download/OpenAI/file/content log |
| Drop path | other `@g.us` groups: log `ignored` + jid only; DMs: silent |
| Presence | offline connect; no read receipts from this client |
| Ports | none published |
| Network | Compose default only — no custom or external network |

Honest limit: a linked WhatsApp device still *receives* protocol events for other chats (gray ticks). This process does not download, transcribe, save, or reply to them.

### Leak test

```bash
docker compose logs -f zap-to-text
```

Send audio/text in another chat → expect no new `./transcripts/` files and no replies outside the group. Then forward audio to your transcription group → quoted reply + one `.md`.

## Ops

Stop (keeps session data): `docker compose down`  
(Do **not** use `-v` unless you intend to wipe auth + seen ids.)

Session files live under `./data/auth`. To force a new QR: stop, delete `./data/auth`, start again.

### Docker Desktop (macOS)

Settings → General → **Start Docker Desktop when you log in**.  
`restart: unless-stopped` brings the container back when the engine starts.

### Useful commands

```bash
./up.sh
docker compose logs -f zap-to-text
docker compose ps
docker compose restart
```

### OpenAI

`OPENAI_API_KEY` in `.env`. Model: `whisper-1`, automatic language, no summary.

## Optional checks

```bash
npm test
npm run build
bash .cursor/hooks/selftest.sh
```

### Cursor dotenv hooks

This repo ships Cursor hooks that block agents from reading/writing dotenv files via Read, Write, and obvious Shell paths (including some concatenation bypasses). They are **best-effort**: not an absolute sandbox, do not replace `.gitignore`, and determined bypasses may still exist. Keep secrets out of the repo and treat hooks as a seatbelt, not a vault.

## License

MIT
