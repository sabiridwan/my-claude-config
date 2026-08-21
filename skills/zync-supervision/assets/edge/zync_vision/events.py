"""Vision event — the only thing this agent produces."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class VisionEvent:
    type: str
    camera_id: str
    occurred_at: datetime = field(default_factory=utc_now)
    zone_key: str | None = None
    severity: str = "INFO"
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    count: int | None = None
    clip_url: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def event_key(self) -> str:
        """Idempotency key — the server upserts on it, so replay after an outage cannot
        double the footfall. Microseconds + duration + count are in the hash because two
        trackers can leave the same zone inside the same second and those are two events."""
        raw = "|".join([
            self.camera_id,
            self.type,
            self.zone_key or "",
            str(int(self.occurred_at.timestamp() * 1_000_000)),
            str(self.duration_seconds or ""),
            str(self.count or ""),
        ])
        return hashlib.sha1(raw.encode()).hexdigest()

    def to_payload(self) -> dict[str, Any]:
        return {
            "eventKey": self.event_key,
            "type": self.type,
            "severity": self.severity,
            "cameraId": self.camera_id,
            "zoneKey": self.zone_key,
            "occurredAt": self.occurred_at.isoformat(),
            "endedAt": self.ended_at.isoformat() if self.ended_at else None,
            "durationSeconds": self.duration_seconds,
            "count": self.count,
            "clipUrl": self.clip_url,
            "meta": self.meta,
        }
