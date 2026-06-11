#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict

import ssl
import urllib.request

JOBS = Path("data/llm/jobs")
OUT = Path("data/llm/results")


def load_env_local(env_path: str = ".env.local"):
    p = Path(env_path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def openai_chat(model: str, system_prompt: str, user_prompt: str, api_key: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=90) as resp:
        body = resp.read()
    j = json.loads(body.decode("utf-8"))
    return j["choices"][0]["message"]["content"].strip()


def run_subject(subject: str, limit: int, model: str):
    load_env_local()
    api_key = os.environ.get("OPENAI_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_KEY not set; add it to .env.local or environment")

    src = JOBS / f"{subject}.jsonl"
    if not src.exists():
        raise SystemExit(f"Jobs file not found: {src}")
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{subject}.jsonl"

    system = (
        "You are a curriculum content editor. Rewrite noisy, extracted textbook fragments into clear, "
        "student-friendly summaries addressing the given Alberta curriculum outcome. Keep it factual, concise, "
        "and neutral. Avoid quoting gibberish; infer intended meaning when clear."
    )

    done = 0
    with src.open("r", encoding="utf-8") as fin, dst.open("w", encoding="utf-8") as fout:
        for line in fin:
            if limit and done >= limit:
                break
            job = json.loads(line)
            subject = job["subject"]
            code = job.get("code", "?")
            desc = job.get("description", "")
            evid = job.get("evidence", [])
            # Build a compact prompt with top evidence snippets and sources
            examples = []
            for e in evid[:6]:
                src_pages = ",".join(str(p) for p in e.get("pages", [])[:6])
                examples.append(f"- {e.get('heading') or ''} (pages {src_pages}):\n  " + " \n  ".join(e.get("snippets", [])[:2]))
            user = (
                f"Outcome {code}: {desc}\n\n"
                f"Evidence (noisy extracts):\n" + "\n".join(examples) + "\n\n"
                "Write JSON with keys: summary (2-4 sentences), bullets (3 items), sources ([{doc_stem,pages}])."
            )
            # Try model, then fallbacks if 404
            tried = []
            models = [model, "gpt-4.1", "gpt-4o", "gpt-4o-mini"]
            content = None
            for m in models:
                if m in tried:
                    continue
                tried.append(m)
                try:
                    text = openai_chat(m, system, user, api_key)
                    content = text
                    break
                except Exception as e:
                    # simple backoff and continue
                    time.sleep(1.5)
                    continue
            if content is None:
                result = {"subject": subject, "code": code, "error": "api_failed"}
            else:
                # attempt to parse JSON; if not, wrap as summary only
                try:
                    parsed = json.loads(content)
                    result = {"subject": subject, "code": code, **parsed}
                except Exception:
                    result = {"subject": subject, "code": code, "summary": content, "bullets": [], "sources": []}

            fout.write(json.dumps(result, ensure_ascii=False) + "\n")
            done += 1
            print(f"[{done}] {subject} {code}")

    print(f"Wrote {dst}")


def main():
    parser = argparse.ArgumentParser(description="Run LLM over alignment jobs")
    parser.add_argument("--subject", required=True, choices=["biology", "chemistry", "physics", "math", "english", "social"])
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--model", default="gpt-5")
    args = parser.parse_args()
    run_subject(args.subject, args.limit, args.model)


if __name__ == "__main__":
    main()

