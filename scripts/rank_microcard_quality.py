"""
Rank microcards for infinite learning mode using GPT-5-nano.

Scoring Criteria (0-100):
- Question clarity and precision (30 pts)
- Answer choices quality - distractors plausible (25 pts)
- Explanation helpfulness (20 pts)
- Alberta curriculum alignment (15 pts)
- Difficulty appropriate for high school (10 pts)

Uses OpenAI GPT-5-nano (small, fast model) with fallback support.
Adds quality_score column to content_microcards table.
"""

import os
import json
import logging
import time
from pathlib import Path
from openai import OpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError
from dotenv import load_dotenv
from datetime import datetime
from supabase import create_client

# Resolve project root
ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

# Load environment variables from .env.local first, then .env
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

# Configuration
LOG_LEVEL = "INFO"
PRIMARY_MODEL = "gpt-5-mini"  # Fast scoring
FALLBACK_MODEL = "gpt-5-nano"  # Even faster fallback
AI_TEMPERATURE = 1.0
AI_MAX_TOKENS = 1500  # Ample room for detailed scoring responses
AI_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2
MAX_RETRY_DELAY = 60
BATCH_SIZE = 50
RATE_LIMIT_DELAY = 0.3  # seconds between requests
CHECKPOINT_FILE = SCRIPTS_DIR / "checkpoint_quality_scoring.json"

# Initialize logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Scoring prompt
SCORING_PROMPT = """You are evaluating a multiple-choice quiz question for Alberta high school students.

Question: {question}

Choices:
{choices}

Correct Answer: {answer}

Explanation: {explanation}

Subject: {subject}
Outcome Code: {outcome_code}

Rate this question on a 0-100 scale using these criteria:

1. **Question Clarity (30 pts)**: Is the question clear, precise, and unambiguous?
   - 25-30: Crystal clear, professionally written
   - 15-24: Clear but could be more precise
   - 5-14: Somewhat unclear or ambiguous
   - 0-4: Confusing or poorly worded

2. **Answer Choices Quality (25 pts)**: Are the distractors plausible? Is there only one clearly correct answer?
   - 20-25: Excellent distractors, one clear answer
   - 12-19: Good distractors, answer is clear
   - 5-11: Weak distractors or answer ambiguous
   - 0-4: Poor distractors or multiple correct answers

3. **Explanation Helpfulness (20 pts)**: Does the explanation teach the concept clearly?
   - 16-20: Excellent teaching, clear reasoning
   - 10-15: Good explanation, mostly clear
   - 4-9: Weak explanation, missing details
   - 0-3: Unhelpful or incorrect explanation

4. **Curriculum Alignment (15 pts)**: Does this align with Alberta Grade 11-12 curriculum standards?
   - 12-15: Perfect alignment, appropriate depth
   - 7-11: Good alignment, reasonable depth
   - 3-6: Weak alignment or wrong level
   - 0-2: Off-topic or wrong curriculum

5. **High School Difficulty (10 pts)**: Is the difficulty appropriate for Grade 11-12?
   - 8-10: Perfect difficulty level
   - 5-7: Slightly too easy or hard
   - 2-4: Much too easy or hard
   - 0-1: Completely inappropriate level

Return ONLY a JSON object with this structure (no additional text):
{{
  "total_score": <0-100>,
  "question_clarity": <0-30>,
  "choices_quality": <0-25>,
  "explanation": <0-20>,
  "curriculum_alignment": <0-15>,
  "difficulty": <0-10>,
  "reasoning": "<1-2 sentence justification for total_score>"
}}"""


def retry_with_backoff(func):
    """Decorator for retry logic with exponential backoff."""
    def wrapper(*args, **kwargs):
        for attempt in range(MAX_RETRIES + 1):
            try:
                return func(*args, **kwargs)
            except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
                if attempt == MAX_RETRIES:
                    logger.error(f"Failed after {MAX_RETRIES} retries: {e}")
                    raise

                delay = min(RETRY_BASE_DELAY * (2 ** attempt), MAX_RETRY_DELAY)
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                time.sleep(delay)

    return wrapper


@retry_with_backoff
def score_microcard(card, model=PRIMARY_MODEL):
    """
    Score a single microcard using AI.

    Args:
        card: Microcard data from database
        model: OpenAI model to use

    Returns:
        dict with scoring results
    """
    # Format choices for prompt
    choices_text = "\n".join([
        f"{chr(65+i)}. {choice}"
        for i, choice in enumerate(card['quick_check']['choices'])
    ])

    prompt = SCORING_PROMPT.format(
        question=card['quick_check']['question'],
        choices=choices_text,
        answer=card['quick_check']['answer'],
        explanation=card['quick_check']['explanation'],
        subject=card['subject'],
        outcome_code=card['outcome_code']
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert evaluator of educational quiz questions. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=AI_TEMPERATURE,
            max_completion_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT
        )

        choice = response.choices[0]

        # Check for refusal
        if hasattr(choice.message, 'refusal') and choice.message.refusal:
            logger.error(f"AI refused: {choice.message.refusal}")
            raise ValueError(f"AI refusal: {choice.message.refusal}")

        result_text = choice.message.content

        if not result_text:
            raise ValueError(f"Empty response (finish_reason: {choice.finish_reason})")

        # Clean and parse JSON
        result_text = result_text.strip()
        if result_text.startswith("```json"):
            result_text = result_text.replace("```json", "").replace("```", "").strip()
        elif result_text.startswith("```"):
            result_text = result_text.replace("```", "").strip()

        result = json.loads(result_text)

        # Validate required fields
        required_fields = ["total_score", "question_clarity", "choices_quality",
                          "explanation", "curriculum_alignment", "difficulty", "reasoning"]
        if not all(k in result for k in required_fields):
            missing = [k for k in required_fields if k not in result]
            raise ValueError(f"Missing fields: {missing}")

        # Validate score ranges
        if not (0 <= result["total_score"] <= 100):
            logger.warning(f"Total score out of range: {result['total_score']}, capping")
            result["total_score"] = max(0, min(100, result["total_score"]))

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error(f"Response: {result_text[:500] if 'result_text' in locals() else 'None'}")
        raise
    except Exception as e:
        logger.error(f"Scoring error: {e}")
        raise


class CheckpointManager:
    """Manages checkpoint file for resumable processing."""

    def __init__(self, path):
        self.path = Path(path)

    def save(self, data):
        """Save checkpoint data."""
        data["_timestamp"] = datetime.now().isoformat()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Checkpoint saved: {self.path}")

    def load(self):
        """Load checkpoint data."""
        if not self.path.exists():
            return None
        with open(self.path, 'r') as f:
            data = json.load(f)
        logger.info(f"Loaded checkpoint from {data.get('_timestamp', 'unknown')}")
        return data

    def clear(self):
        """Delete checkpoint file."""
        if self.path.exists():
            self.path.unlink()
            logger.info("Checkpoint cleared")

    def exists(self):
        """Check if checkpoint exists."""
        return self.path.exists()


def process_all_cards(resume=False):
    """
    Score all active microcards and update database.

    Args:
        resume: Resume from checkpoint if available
    """
    start_time = datetime.now()
    checkpoint = CheckpointManager(CHECKPOINT_FILE)

    # Load checkpoint if resuming
    processed_ids = set()
    start_index = 0
    if resume and checkpoint.exists():
        checkpoint_data = checkpoint.load()
        if checkpoint_data:
            start_index = checkpoint_data.get("last_processed_index", 0) + 1
            processed_ids = set(checkpoint_data.get("processed_ids", []))
            logger.info(f"Resuming from index {start_index}")

    # Fetch all active microcards
    logger.info("Fetching active microcards from database...")
    response = supabase.table("content_microcards") \
        .select("*") \
        .eq("status", "active") \
        .execute()

    cards = response.data
    logger.info(f"Found {len(cards)} active microcards")

    # Process cards
    errors = 0
    low_quality = 0
    high_quality = 0
    current_model = PRIMARY_MODEL
    scores_by_subject = {}

    for i, card in enumerate(cards[start_index:], start=start_index):
        card_id = card['id']

        # Skip if already processed
        if card_id in processed_ids:
            logger.debug(f"Skipping already processed card {card_id}")
            continue

        logger.info(f"[{i+1}/{len(cards)}] Scoring {card['subject']} - {card['outcome_code']}")

        try:
            score_result = score_microcard(card, model=current_model)
        except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
            # Try fallback model
            if current_model == PRIMARY_MODEL:
                logger.warning(f"Switching to fallback model {FALLBACK_MODEL}")
                try:
                    score_result = score_microcard(card, model=FALLBACK_MODEL)
                    current_model = FALLBACK_MODEL
                except Exception:
                    logger.error(f"Failed with fallback model")
                    errors += 1
                    continue
            else:
                errors += 1
                continue
        except Exception as e:
            logger.error(f"Unexpected error scoring card {card_id}: {e}")
            errors += 1
            continue

        total_score = score_result["total_score"]

        # Update database
        try:
            supabase.table("content_microcards") \
                .update({"quality_score": total_score}) \
                .eq("id", card_id) \
                .execute()
            logger.info(f"  ✓ Score: {total_score}/100 - {score_result['reasoning'][:60]}...")
        except Exception as e:
            logger.error(f"Failed to update database for card {card_id}: {e}")
            errors += 1
            continue

        # Track stats
        processed_ids.add(card_id)
        if total_score >= 70:
            high_quality += 1
        else:
            low_quality += 1

        subject = card['subject']
        if subject not in scores_by_subject:
            scores_by_subject[subject] = []
        scores_by_subject[subject].append(total_score)

        # Save checkpoint
        if (i + 1) % BATCH_SIZE == 0:
            checkpoint.save({
                "last_processed_index": i,
                "processed_ids": list(processed_ids),
                "stats": {
                    "high_quality": high_quality,
                    "low_quality": low_quality,
                    "errors": errors
                }
            })

        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)

    # Clear checkpoint after successful completion
    checkpoint.clear()

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()
    minutes = int(duration // 60)
    seconds = int(duration % 60)

    # Print summary
    print("\n" + "="*70)
    print("MICROCARD QUALITY SCORING SUMMARY".center(70))
    print("="*70)
    print(f"Duration: {minutes}m {seconds}s")
    print(f"Total cards: {len(cards)}")
    print(f"Processed: {len(processed_ids)} ({len(processed_ids)/len(cards)*100:.1f}%)")
    print(f"Errors: {errors}")
    print()
    print(f"✅ High quality (≥70): {high_quality} ({high_quality/len(processed_ids)*100:.1f}%)")
    print(f"⚠️  Low quality (<70): {low_quality} ({low_quality/len(processed_ids)*100:.1f}%)")
    print()
    print("Average Scores by Subject:")
    for subject in sorted(scores_by_subject.keys()):
        scores = scores_by_subject[subject]
        avg_score = sum(scores) / len(scores)
        high_count = sum(1 for s in scores if s >= 70)
        print(f"  {subject}: {avg_score:.1f}/100 ({high_count}/{len(scores)} high quality)")
    print("="*70)
    print(f"\n✓ Done! {high_quality} cards ready for infinite mode (score ≥70)")


if __name__ == "__main__":
    import sys

    logger.info("SteadyTrack - Microcard Quality Scorer")
    logger.info("="*60)

    resume_mode = "--resume" in sys.argv

    if resume_mode:
        logger.info("📂 RESUME MODE: Continuing from checkpoint\n")

    try:
        process_all_cards(resume=resume_mode)
    except KeyboardInterrupt:
        logger.warning("\n⚠ Processing interrupted by user")
        logger.info("  Run with --resume flag to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)
