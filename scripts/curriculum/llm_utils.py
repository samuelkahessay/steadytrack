#!/usr/bin/env python3
"""
Shared async LLM utilities for curriculum resource management.
Based on civiccheckyyc async processing architecture.

Features:
- AsyncOpenAI client management
- Exponential backoff retry decorator
- Checkpoint management for resumability
- URL verification utilities
- Rate limiting with semaphores
"""

import os
import json
import logging
import asyncio
import functools
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Callable, Optional
from datetime import datetime

from openai import AsyncOpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError

# Configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds
MAX_RETRY_DELAY = 60  # seconds
CONCURRENT_REQUESTS = 15  # Number of concurrent API requests

# Model Configuration
# Use gpt-4o as primary (excellent quality/cost balance)
# Fallback to gpt-5 if available, else gpt-4o-mini
PRIMARY_MODEL = "gpt-4o"
FALLBACK_MODEL = "gpt-5"  # Will auto-fallback to gpt-4o-mini if gpt-5 not available

# Timeouts
AI_TIMEOUT = 30  # seconds
URL_VERIFY_TIMEOUT = 10  # seconds

# Get paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
DATA_DIR = ROOT_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True, parents=True)

# Initialize logger
logger = logging.getLogger(__name__)


def setup_logging(log_file: Optional[Path] = None, level: str = "INFO"):
    """Setup logging configuration."""
    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format=log_format,
            datefmt=date_format,
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
    else:
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format=log_format,
            datefmt=date_format
        )

    return logging.getLogger()


def get_openai_api_key() -> str:
    """Get OpenAI API key from environment or .env.local"""
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")

    if not api_key:
        env_local = ROOT_DIR / ".env.local"
        if env_local.exists():
            with open(env_local) as f:
                for line in f:
                    if "OPENAI" in line and "KEY" in line:
                        api_key = line.split('=', 1)[1].strip().strip('"\'')
                        break

    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment or .env.local")

    return api_key


def get_async_client() -> AsyncOpenAI:
    """Get configured AsyncOpenAI client"""
    return AsyncOpenAI(api_key=get_openai_api_key())


def async_retry_with_backoff(
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
    max_delay: float = MAX_RETRY_DELAY,
    exceptions: tuple = (RateLimitError, APIError, APIConnectionError, APITimeoutError)
):
    """
    Async decorator that retries a coroutine with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds (will be used as 2^n)
        max_delay: Maximum delay between retries (cap)
        exceptions: Tuple of exceptions to catch and retry on

    Usage:
        @async_retry_with_backoff(max_retries=3)
        async def fetch_data():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries:
                        logger.error(
                            f"{func.__name__} failed after {max_retries} retries: {e}"
                        )
                        raise

                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (2 ** attempt), max_delay)

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{max_retries} failed, "
                        f"retrying in {delay:.1f}s: {e}"
                    )

                    await asyncio.sleep(delay)

        return wrapper
    return decorator


class CheckpointManager:
    """Manages checkpoints for resumable processing"""

    def __init__(self, checkpoint_file: Path, interval: int = 50):
        self.checkpoint_file = checkpoint_file
        self.interval = interval
        self.checkpoint_file.parent.mkdir(parents=True, exist_ok=True)

    def exists(self) -> bool:
        """Check if checkpoint exists"""
        return self.checkpoint_file.exists()

    def load(self) -> Optional[dict]:
        """Load checkpoint data"""
        if not self.exists():
            return None

        try:
            with open(self.checkpoint_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return None

    def save(self, data: dict):
        """Save checkpoint data"""
        try:
            with open(self.checkpoint_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")

    def clear(self):
        """Remove checkpoint file"""
        if self.exists():
            try:
                self.checkpoint_file.unlink()
            except Exception as e:
                logger.error(f"Failed to clear checkpoint: {e}")


async def verify_url_async(url: str, timeout: float = URL_VERIFY_TIMEOUT) -> bool:
    """
    Async URL verification.

    Args:
        url: URL to verify
        timeout: Timeout in seconds

    Returns:
        True if URL is accessible (200-399 status)
    """
    try:
        # Run sync urllib in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: _verify_url_sync(url, timeout)
        )
        return result
    except Exception:
        return False


def _verify_url_sync(url: str, timeout: float) -> bool:
    """Synchronous URL verification (called from async)"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.getcode() < 400
    except Exception:
        return False


async def verify_urls_batch(urls: list[str], semaphore: Optional[asyncio.Semaphore] = None) -> dict[str, bool]:
    """
    Verify multiple URLs concurrently.

    Args:
        urls: List of URLs to verify
        semaphore: Optional semaphore for rate limiting

    Returns:
        Dict mapping URL to verification result
    """
    if semaphore is None:
        semaphore = asyncio.Semaphore(CONCURRENT_REQUESTS)

    async def verify_with_semaphore(url: str) -> tuple[str, bool]:
        async with semaphore:
            result = await verify_url_async(url)
            return (url, result)

    results = await asyncio.gather(
        *[verify_with_semaphore(url) for url in urls],
        return_exceptions=True
    )

    # Filter out exceptions
    verified = {}
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Exception verifying URL: {result}")
        elif result is not None:
            url, is_valid = result
            verified[url] = is_valid

    return verified


def format_duration(seconds: float) -> str:
    """Format duration in seconds to human-readable string"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"


def extract_domain(url: str) -> str:
    """Extract domain from URL"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return "unknown"


def infer_resource_type_from_url(url: str) -> Optional[str]:
    """Infer resource type from URL patterns"""
    url_lower = url.lower()

    if "khanacademy.org" in url_lower:
        if "/e/" in url_lower:
            return "practice"
        elif "/v/" in url_lower or "/video" in url_lower:
            return "video"
        else:
            return "article"
    elif "phet.colorado.edu" in url_lower:
        return "simulation"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "video"
    elif "openstax.org" in url_lower or "libretexts.org" in url_lower:
        return "article"
    elif "wikipedia.org" in url_lower:
        return "reference"

    return None


def infer_source_from_url(url: str) -> str:
    """Infer source/provider from URL"""
    domain = extract_domain(url).lower()

    if "khanacademy.org" in domain:
        return "Khan Academy"
    elif "phet.colorado.edu" in domain:
        return "PhET"
    elif "openstax.org" in domain:
        return "OpenStax"
    elif "libretexts.org" in domain:
        return "LibreTexts"
    elif "youtube.com" in domain or "youtu.be" in domain:
        return "YouTube"
    elif "wikipedia.org" in domain:
        return "Wikipedia"
    elif "mit.edu" in domain or "ocw.mit.edu" in domain:
        return "MIT OCW"
    elif "ck12.org" in domain:
        return "CK-12"
    elif "crashcourse" in domain:
        return "CrashCourse"
    elif "bozemanscience" in domain:
        return "Bozeman Science"

    return domain


def is_embeddable(url: str) -> bool:
    """Check if resource is likely embeddable"""
    url_lower = url.lower()
    return (
        "youtube.com" in url_lower or
        "youtu.be" in url_lower or
        "phet.colorado.edu" in url_lower
    )


class ProgressTracker:
    """Track and display progress for async batch processing"""

    def __init__(self, total: int, desc: str = "Processing"):
        self.total = total
        self.processed = 0
        self.desc = desc
        self.start_time = datetime.now()

    def update(self, count: int = 1):
        """Update progress"""
        self.processed += count
        self._display()

    def _display(self):
        """Display progress"""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        rate = self.processed / elapsed if elapsed > 0 else 0
        remaining = (self.total - self.processed) / rate if rate > 0 else 0

        percent = (self.processed / self.total * 100) if self.total > 0 else 0

        print(
            f"\r{self.desc}: {self.processed}/{self.total} ({percent:.1f}%) | "
            f"Rate: {rate:.1f}/s | ETA: {format_duration(remaining)}",
            end="", flush=True
        )

    def finish(self):
        """Finish progress tracking"""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        print(f"\r{self.desc}: {self.processed}/{self.total} (100%) | "
              f"Completed in {format_duration(elapsed)}")
