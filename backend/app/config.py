import os
from dataclasses import dataclass
from dotenv import load_dotenv


# Load .env file from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


@dataclass
class Settings:
    livekit_url: str = os.getenv("LIVEKIT_URL", "")
    livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")

    cartesia_api_key: str = os.getenv("CARTESIA_API_KEY", "")

    stt_language: str = os.getenv("STT_LANGUAGE", "en")
    stt_model: str = os.getenv("STT_MODEL", "ink-whisper")

    # Cerebras AI settings
    cerebras_api_key: str = os.getenv("CEREBRAS_API_KEY", "")
    cerebras_base_url: str = os.getenv("CEREBRAS_BASE_URL", "https://api.cerebras.ai/v1")
    cerebras_model: str = os.getenv("CEREBRAS_MODEL", "llama3.1-8b")

    # Database settings
    database_url: str = os.getenv("DATABASE_URL", "")


settings = Settings()


def validate_settings() -> None:
    missing = []
    # LiveKit is optional in current setup
    # if not settings.livekit_url:
    #     missing.append("LIVEKIT_URL")
    # if not settings.livekit_api_key:
    #     missing.append("LIVEKIT_API_KEY")
    # if not settings.livekit_api_secret:
    #     missing.append("LIVEKIT_API_SECRET")
    if not settings.cartesia_api_key:
        missing.append("CARTESIA_API_KEY")
    if not settings.cerebras_api_key:
        missing.append("CEREBRAS_API_KEY")
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
