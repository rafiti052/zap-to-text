# zap-to-text

Local Docker service that turns WhatsApp voice notes into text with OpenAI Whisper (via Baileys).

Forward an audio message to your transcription group. The bot replies with the transcript (quoted on the audio) and saves a markdown file under `transcripts/`.

## Setup

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`
2. Run `./up.sh`
3. Scan the QR from the logs: `docker compose logs -f zap-to-text`
4. Forward a voice note to the group

Details, privacy notes, and troubleshooting: [LOCAL_SETUP.md](LOCAL_SETUP.md)

## License

MIT
