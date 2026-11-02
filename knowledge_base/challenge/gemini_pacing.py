"""
Rate-limited, cached Gemini calls for the challenge generator.

One shared limiter covers every call (generation, extras, blind solve):
  - sliding 60 s window capped at CHALLENGE_MAX_RPM requests (default 12) and CHALLENGE_MAX_TPM tokens (default 200000)
  - at least MIN_GAP_S seconds between call starts
  - exponential backoff on 429/5xx (honours a retry delay when the error gives one)
  - a daily call budget (CHALLENGE_DAILY_CALL_BUDGET, default 400) kept in work/budget.json
  - every raw response is cached to disk before it is parsed, so a resume never pays twice
"""

import os
import re
import sys
import time
from collections import deque
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "playground"))

from pg_common import GEMINI_MODEL, ROOT, load_json, save_json  # noqa: E402

WORK = os.path.join(HERE, "work")
RAW_DIR = os.path.join(WORK, "raw")
BUDGET_FILE = os.path.join(WORK, "budget.json")

MAX_RPM = int(os.environ.get("CHALLENGE_MAX_RPM", "12"))
MAX_TPM = int(os.environ.get("CHALLENGE_MAX_TPM", "200000"))
DAILY_BUDGET = int(os.environ.get("CHALLENGE_DAILY_CALL_BUDGET", "400"))
MIN_GAP_S = 5.0
BACKOFF = [15, 30, 60, 120]
WINDOW_S = 60.0


class EmptyResponse(RuntimeError):
    """Every retry of one prompt came back empty."""


class StopRun(Exception):
    """Stop cleanly: the daily quota or the local call budget is used up."""


class RateLimiter:
    def __init__(self, max_rpm=MAX_RPM, max_tpm=MAX_TPM, min_gap=MIN_GAP_S, clock=time.monotonic, sleep=time.sleep):
        self.max_rpm, self.max_tpm, self.min_gap = max_rpm, max_tpm, min_gap
        self.clock, self.sleep = clock, sleep
        self.calls = deque()    # start times
        self.tokens = deque()   # (time, tokens)
        self.last_start = None

    def _prune(self, now):
        while self.calls and now - self.calls[0] >= WINDOW_S:
            self.calls.popleft()
        while self.tokens and now - self.tokens[0][0] >= WINDOW_S:
            self.tokens.popleft()

    def wait_time(self, est_tokens: int) -> float:
        now = self.clock()
        self._prune(now)
        wait = 0.0
        if self.last_start is not None:
            wait = max(wait, self.last_start + self.min_gap - now)
        if len(self.calls) >= self.max_rpm:
            wait = max(wait, self.calls[0] + WINDOW_S - now)
        used = sum(t for _, t in self.tokens)
        if used + est_tokens > self.max_tpm:
            # wait until enough of the window has expired
            remaining = used
            for stamp, t in self.tokens:
                remaining -= t
                wait = max(wait, stamp + WINDOW_S - now)
                if remaining + est_tokens <= self.max_tpm:
                    break
        return max(wait, 0.0)

    def acquire(self, est_tokens: int):
        while True:
            wait = self.wait_time(est_tokens)
            if wait <= 0:
                break
            self.sleep(wait + 0.05)
        now = self.clock()
        self.calls.append(now)
        self.last_start = now

    def record(self, tokens: int):
        self.tokens.append((self.clock(), tokens))


def _budget_load() -> dict:
    data = load_json(BUDGET_FILE, {}) or {}
    if data.get("date") != date.today().isoformat():
        data = {"date": date.today().isoformat(), "calls": 0}
    return data


def _budget_bump():
    data = _budget_load()
    data["calls"] += 1
    save_json(BUDGET_FILE, data)


def calls_today() -> int:
    return _budget_load()["calls"]


def retry_delay(message: str):
    m = re.search(r"retry(?:Delay)?\D{0,12}(\d+(?:\.\d+)?)\s*s", message, re.I)
    return float(m.group(1)) if m else None


def is_daily_quota(message: str) -> bool:
    return bool(re.search(r"per ?day|daily|RequestsPerDay", message, re.I)) and "RESOURCE_EXHAUSTED" in message


def make_client():
    from dotenv import load_dotenv
    from google import genai

    load_dotenv(os.path.join(ROOT, ".env"))
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY not found in environment variables.")
    return genai.Client(api_key=key)


class Gemini:
    def __init__(self, client=None, limiter=None):
        self.client = client or make_client()
        self.limiter = limiter or RateLimiter()

    def call(self, tag: str, prompt: str, max_output_tokens: int, model: str = GEMINI_MODEL,
             temperature: float = 0.7) -> str:
        """Return the raw response text; reads/writes work/raw/<tag>.txt so a repeat costs nothing."""
        from google.genai import types as gtypes

        cache = os.path.join(RAW_DIR, tag + ".txt")
        if os.path.exists(cache):
            with open(cache, encoding="utf-8") as f:
                return f.read()

        est = len(prompt) // 4 + max_output_tokens
        for attempt in range(len(BACKOFF) + 1):
            if calls_today() >= DAILY_BUDGET:
                raise StopRun(f"daily call budget reached ({DAILY_BUDGET})")
            self.limiter.acquire(est)
            _budget_bump()
            try:
                resp = self.client.models.generate_content(
                    model=model, contents=prompt,
                    config=gtypes.GenerateContentConfig(
                        response_mime_type="application/json", temperature=temperature,
                        max_output_tokens=max_output_tokens),
                )
            except Exception as exc:
                msg = str(exc)
                if is_daily_quota(msg):
                    raise StopRun("Gemini daily quota exhausted") from exc
                transient = any(t in msg for t in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "500"))
                if transient and attempt == len(BACKOFF):
                    raise StopRun("Gemini is still unavailable after retries (503/429)") from exc
                if not transient:
                    raise
                delay = retry_delay(msg) or BACKOFF[attempt]
                print(f"    transient error, retrying in {delay:.0f}s ({attempt + 1}/{len(BACKOFF)})", flush=True)
                time.sleep(delay)
                continue
            usage = getattr(resp, "usage_metadata", None)
            self.limiter.record(getattr(usage, "total_token_count", None) or est)
            text = resp.text or ""
            if not text.strip():
                print("    empty response, retrying", flush=True)
                temperature = min(temperature + 0.3, 1.0)  # a deterministic empty answer would repeat forever
                time.sleep(BACKOFF[0])
                continue
            os.makedirs(RAW_DIR, exist_ok=True)
            with open(cache, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            return text
        raise EmptyResponse("Gemini kept returning empty responses")
