"""
Async concurrent version of microcard quality scorer.
Processes 785 microcards with 15 concurrent requests for 10-15x speedup.

Usage:
    python rank_microcard_quality_async.py --resume
"""

import os
import json
import logging
import asyncio
from pathlib import Path
from openai import AsyncOpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError
from dotenv import load_dotenv
from datetime import datetime
from supabase import create_client

# Resolve project root
ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

# Load environment variables
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

# Configuration
LOG_LEVEL = "INFO"
PRIMARY_MODEL = "gpt-5-mini"
FALLBACK_MODEL = "gpt-5-nano"
AI_TEMPERATURE = 1.0
AI_MAX_TOKENS = 1500
AI_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2
MAX_RETRY_DELAY = 60
BATCH_SIZE = 50
CONCURRENT_REQUESTS = 15  # Process 15 cards at once
CHECKPOINT_FILE = SCRIPTS_DIR / "checkpoint_quality_scoring_async.json"

# Initialize logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize async OpenAI client
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
2. **Answer Choices Quality (25 pts)**: Are the distractors plausible? Is there only one clearly correct answer?
3. **Explanation Helpfulness (20 pts)**: Does the explanation teach the concept clearly?
4. **Curriculum Alignment (15 pts)**: Does this align with Alberta Grade 11-12 curriculum standards?
5. **High School Difficulty (10 pts)**: Is the difficulty appropriate for Grade 11-12?

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


async def score_microcard_async(card, model=PRIMARY_MODEL):
    """Async version of score_microcard."""
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

    response = await async_client.chat.completions.create(
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

    if hasattr(choice.message, 'refusal') and choice.message.refusal:
        raise ValueError(f"AI refusal: {choice.message.refusal}")

    result_text = choice.message.content

    if not result_text:
        raise ValueError(f"Empty response (finish_reason: {choice.finish_reason})")

    result_text = result_text.strip()
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    elif result_text.startswith("```"):
        result_text = result_text.replace("```", "").strip()

    result = json.loads(result_text)

    required_fields = ["total_score", "question_clarity", "choices_quality",
                      "explanation", "curriculum_alignment", "difficulty", "reasoning"]
    if not all(k in result for k in required_fields):
        missing = [k for k in required_fields if k not in result]
        raise ValueError(f"Missing fields: {missing}")

    if not (0 <= result["total_score"] <= 100):
        result["total_score"] = max(0, min(100, result["total_score"]))

    return result


async def process_card_with_retry(card, semaphore, current_model, stats):
    """Process a single card with retry logic and rate limiting."""
    async with semaphore:
        try:
            for attempt in range(MAX_RETRIES + 1):
                try:
                    score_result = await score_microcard_async(card, model=current_model)
                    break
                except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
                    if attempt == MAX_RETRIES:
                        logger.error(f"Failed after {MAX_RETRIES} retries: {e}")
                        stats["errors"] += 1
                        return None

                    delay = min(RETRY_BASE_DELAY * (2 ** attempt), MAX_RETRY_DELAY)
                    await asyncio.sleep(delay)

            total_score = score_result["total_score"]

            # Update database
            supabase.table("content_microcards") \
                .update({"quality_score": total_score}) \
                .eq("id", card['id']) \
                .execute()

            logger.info(f"  ✓ [{card['subject'][:15]}] Score: {total_score}/100 - {score_result['reasoning'][:50]}...")

            return (card['id'], total_score)

        except Exception as e:
            logger.error(f"Error scoring card {card['id']}: {e}")
            stats["errors"] += 1
            return None


async def process_batch(cards_batch, semaphore, current_model, stats):
    """Process a batch of cards concurrently."""
    results = await asyncio.gather(
        *[process_card_with_retry(card, semaphore, current_model, stats) for card in cards_batch],
        return_exceptions=True
    )

    processed = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Exception in batch: {result}")
            stats["errors"] += 1
        elif result is not None:
            processed.append(result)

    return processed


async def process_all_cards_async(resume=False):
    """Async version: Process all cards concurrently."""
    start_time = datetime.now()

    # Load checkpoint if resuming
    processed_ids = set()
    if resume and CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            checkpoint_data = json.load(f)
            processed_ids = set(checkpoint_data.get("processed_ids", []))
        logger.info(f"Resuming with {len(processed_ids)} cards already processed")

    # Fetch all active microcards
    logger.info("Fetching active microcards from database...")
    response = supabase.table("content_microcards") \
        .select("*") \
        .eq("status", "active") \
        .execute()

    cards = response.data
    logger.info(f"Found {len(cards)} active microcards")

    # Filter out already processed cards
    cards_to_process = [card for card in cards if card['id'] not in processed_ids]
    logger.info(f"Processing {len(cards_to_process)} cards ({len(processed_ids)} already done)")

    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(CONCURRENT_REQUESTS)

    # Stats tracking
    stats = {"errors": 0, "high_quality": 0, "low_quality": 0}
    current_model = PRIMARY_MODEL
    scores_by_subject = {}

    # Process in batches for checkpointing
    for batch_start in range(0, len(cards_to_process), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(cards_to_process))
        batch = cards_to_process[batch_start:batch_end]

        logger.info(f"Processing batch {batch_start+1}-{batch_end} of {len(cards_to_process)}")

        # Process batch concurrently
        batch_results = await process_batch(batch, semaphore, current_model, stats)

        # Update stats
        for card_id, score in batch_results:
            processed_ids.add(card_id)

            if score >= 70:
                stats["high_quality"] += 1
            else:
                stats["low_quality"] += 1

            # Find subject
            card = next((c for c in batch if c['id'] == card_id), None)
            if card:
                subject = card['subject']
                if subject not in scores_by_subject:
                    scores_by_subject[subject] = []
                scores_by_subject[subject].append(score)

        # Save checkpoint
        with open(CHECKPOINT_FILE, 'w') as f:
            json.dump({
                "processed_ids": list(processed_ids),
                "timestamp": datetime.now().isoformat(),
                "stats": stats
            }, f, indent=2)

        logger.info(f"💾 Checkpoint saved ({len(processed_ids)}/{len(cards)} cards)")

    # Clear checkpoint
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()

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
    print(f"Errors: {stats['errors']}")
    print()
    print(f"✅ High quality (≥70): {stats['high_quality']} ({stats['high_quality']/len(processed_ids)*100:.1f}%)")
    print(f"⚠️  Low quality (<70): {stats['low_quality']} ({stats['low_quality']/len(processed_ids)*100:.1f}%)")
    print()
    print("Average Scores by Subject:")
    for subject in sorted(scores_by_subject.keys()):
        scores = scores_by_subject[subject]
        avg_score = sum(scores) / len(scores)
        high_count = sum(1 for s in scores if s >= 70)
        print(f"  {subject}: {avg_score:.1f}/100 ({high_count}/{len(scores)} high quality)")
    print("="*70)
    print(f"\n✓ Done! {stats['high_quality']} cards ready for infinite mode (score ≥70)")


def main():
    import sys

    logger.info("SteadyTrack - Microcard Quality Scorer (Async Concurrent)")
    logger.info("="*60)

    resume_mode = "--resume" in sys.argv

    if resume_mode:
        logger.info("📂 RESUME MODE: Continuing from checkpoint\n")

    logger.info(f"Concurrent requests: {CONCURRENT_REQUESTS}")
    logger.info(f"Model: {PRIMARY_MODEL}\n")

    try:
        asyncio.run(process_all_cards_async(resume=resume_mode))
    except KeyboardInterrupt:
        logger.warning("\n⚠ Processing interrupted by user")
        logger.info("  Run with --resume flag to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
