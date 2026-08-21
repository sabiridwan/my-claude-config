"""Rule engine: condition -> debounce -> cooldown -> event.

Raw per-frame conditions fire hundreds of times a minute. Every rule therefore needs
min_duration (how long the condition must hold) and cooldown (how long before it can fire
again). Both are tuned against the shop's own recorded footage, never guessed.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .events import VisionEvent, utc_now

# Only these names are available inside a rule expression.
_SAFE_BUILTINS: dict[str, Any] = {"min": min, "max": max, "abs": abs, "len": len, "sum": sum}


@dataclass
class BusinessHours:
    """weekday (0=Mon) -> (open_hour, close_hour) in local time. Missing day = closed."""

    schedule: dict[int, tuple[float, float]] = field(default_factory=dict)

    def is_open(self, when: datetime | None = None) -> bool:
        when = when or datetime.now()
        window = self.schedule.get(when.weekday())
        if not window:
            return False
        hour = when.hour + when.minute / 60
        return window[0] <= hour < window[1]

    @classmethod
    def from_config(cls, cfg: dict[str, Any] | None) -> BusinessHours:
        if not cfg:
            return cls({d: (0.0, 24.0) for d in range(7)})
        days = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
        schedule = {}
        for name, idx in days.items():
            window = cfg.get(name)
            if window:
                schedule[idx] = (float(window[0]), float(window[1]))
        return cls(schedule)


@dataclass
class Rule:
    key: str
    type: str
    when: str                      # expression over the frame context, e.g. "trays >= 1 and staff == 0"
    severity: str = "MEDIUM"
    min_duration: float = 30.0     # seconds the condition must hold before firing
    cooldown: float = 600.0        # seconds before the same rule can fire again
    hours: str = "any"             # "any" | "business" | "after"
    zone_key: str | None = None
    message: str = ""

    _since: float | None = None
    _last_fired: float = 0.0

    def evaluate(self, context: dict[str, Any], hours: BusinessHours) -> VisionEvent | None:
        now = time.monotonic()

        if self.hours == "business" and not hours.is_open():
            self._since = None
            return None
        if self.hours == "after" and hours.is_open():
            self._since = None
            return None

        try:
            holds = bool(eval(self.when, {"__builtins__": _SAFE_BUILTINS}, context))  # noqa: S307
        except Exception:
            # A rule referencing a zone/class this camera does not have must not kill the loop.
            self._since = None
            return None

        if not holds:
            self._since = None
            return None

        if self._since is None:
            self._since = now
            return None

        held_for = now - self._since
        if held_for < self.min_duration:
            return None
        if now - self._last_fired < self.cooldown:
            return None

        self._last_fired = now
        return VisionEvent(
            type=self.type,
            camera_id=context.get("camera_id", "unknown"),
            zone_key=self.zone_key,
            severity=self.severity,
            occurred_at=utc_now(),
            duration_seconds=round(held_for, 1),
            count=context.get("occupancy"),
            meta={"rule": self.key, "message": self.message,
                  "context": {k: v for k, v in context.items() if isinstance(v, (int, float, str))}},
        )


class RuleEngine:
    def __init__(self, rules: list[Rule], hours: BusinessHours) -> None:
        self.rules = rules
        self.hours = hours

    def evaluate(self, context: dict[str, Any]) -> list[VisionEvent]:
        return [e for e in (rule.evaluate(context, self.hours) for rule in self.rules) if e]

    @classmethod
    def from_config(cls, cfg: dict[str, Any]) -> RuleEngine:
        rules = [Rule(**rule) for rule in cfg.get("rules", [])]
        return cls(rules, BusinessHours.from_config(cfg.get("business_hours")))
