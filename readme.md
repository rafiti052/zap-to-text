# zap-to-text

Local Docker service that turns WhatsApp voice notes into text with OpenAI Whisper (via Baileys).

Forward an audio message to your transcription group. The bot replies with the transcript (quoted on the audio) and saves a markdown file under `transcripts/`.

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

## Privacy & advanced notes

See [LOCAL_SETUP.md](LOCAL_SETUP.md) for privacy guarantees, Docker Desktop tips, and useful commands.

## Optional checks

```bash
# Privacy gate unit tests (Node 20+)
node --test app/gate.test.js

# Cursor .env hook self-test (best-effort; not a sandbox)
bash .cursor/hooks/selftest.sh
```

### Cursor `.env` hooks

This repo ships Cursor hooks that block agents from reading/writing `.env` via Read, Write, and obvious Shell paths (including some concatenation bypasses). They are **best-effort**: they are not an absolute sandbox, do not replace `.gitignore`, and determined bypasses may still exist. Keep secrets out of the repo and treat hooks as a seatbelt, not a vault.

## License

MIT
