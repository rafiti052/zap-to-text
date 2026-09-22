# Audio Transcribe Bridge

Local Docker service that transcribes WhatsApp voice notes with OpenAI Whisper.

Forward an audio message to the **Audio Transcribe** group. The bot replies with the transcript (quoted on the audio) and saves a markdown file under `transcripts/`.

## Setup

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`
2. Run `./up.sh`
3. Scan the QR from the logs: `docker compose logs -f bridge`
4. Forward a voice note to the group

Details, privacy notes, and troubleshooting: [LOCAL_SETUP.md](LOCAL_SETUP.md)

## License

MIT
