import asyncio
import uuid
from typing import Dict, Optional

try:
    from livekit.agents import AgentSession
    from livekit.plugins import cartesia
    LIVEKIT_AVAILABLE = True
except ImportError:
    AgentSession = None  # type: ignore
    cartesia = None  # type: ignore
    LIVEKIT_AVAILABLE = False

try:
    from livekit.plugins import silero  # type: ignore
except Exception:  # pragma: no cover
    silero = None  # fallback if plugin not installed

from .config import settings


class STTSessionWrapper:
    def __init__(self) -> None:
        self.session: Optional[AgentSession] = None
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        if not LIVEKIT_AVAILABLE or self.session is not None:
            return
        vad_component = silero.VAD.load() if silero else None
        self.session = AgentSession(
            stt=cartesia.STT(
                api_key=settings.cartesia_api_key,
                model=settings.stt_model,
                language=settings.stt_language,
            ),
            vad=vad_component,
        )
        async def _runner() -> None:
            await self.session.start()
        loop = asyncio.get_running_loop()
        self._task = loop.create_task(_runner())

    async def stop(self) -> None:
        if self.session is None:
            return
        try:
            # AgentSession uses aclose() for async closing
            await self.session.aclose()
        finally:
            self.session = None
            if self._task is not None:
                self._task.cancel()
                self._task = None


class STTManager:
    def __init__(self) -> None:
        self._sessions: Dict[str, STTSessionWrapper] = {}

    async def start_session(self) -> str:
        session_id = str(uuid.uuid4())
        wrapper = STTSessionWrapper()
        self._sessions[session_id] = wrapper
        await wrapper.start()
        return session_id

    async def stop_session(self, session_id: str) -> bool:
        wrapper = self._sessions.pop(session_id, None)
        if not wrapper:
            return False
        await wrapper.stop()
        return True


stt_manager = STTManager()
