"""
alert_preparse.py - Forge email-lane pre-parser (no AI).

Runs BEFORE any model sees a LinkedIn or Indeed job-alert email. Three rules,
from the Oct 25 2026 alert audit:

  1. Dedupe on employer job ID (LinkedIn /jobs/view/<id>, Indeed jk=<id>).
  2. Strip tracking URLs and footers; keep only canonical job links.
  3. Drop Indeed /pagead/ sponsored listings.

Input : plain-text body of a LinkedIn or Indeed alert email (Gmail PLAIN_TEXT).
Output: compact job records; the model reads these for those two senders.

Other senders pass through untouched (returned as None) so nothing is lost.

Seen-set file (state/alert-seen-jobs.json) persists job keys across runs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

LINKEDIN_SENDER = "jobalerts-noreply@linkedin.com"
INDEED_SENDER = "donotreply@jobalert.indeed.com"
SEEN_SCHEMA = "forge.alert-seen.v1"

LI_JOB_URL = re.compile(r"https://www\.linkedin\.com/comm/jobs/view/(\d+)")
INDEED_URL = re.compile(r"https://www\.indeed\.com/(rc|pagead)/clk/dl\?\S+")
INDEED_JK = re.compile(r"[?&]jk=([0-9a-f]{16})")
PAY = re.compile(r"^\$[\d,]+(?:\.\d+)?(?:\s*-\s*\$[\d,]+(?:\.\d+)?)?\s+(?:a year|an hour|a month)$")
INDEED_HEADER = re.compile(r"^(?P<company>.+?) - (?P<location>.+)$")

# Lines LinkedIn puts between location and the link; not job data.
LI_NOISE = re.compile(
    r"^(Fast growing|This company is actively hiring|Apply with resume & profile|"
    r"\d+ (company alumni|connections?)( work here)?|Easily apply|Responsive employer)$"
)
LI_FOOTER = "See all jobs on LinkedIn:"
LI_FOOTER_SIMILAR = "See more jobs:"
INDEED_FOOTER = "Do not share this email"


@dataclass
class Job:
    source: str            # "linkedin" | "indeed"
    job_id: str            # LinkedIn numeric id or Indeed jk
    title: str
    company: str
    location: str
    pay: str | None
    url: str               # canonical, tracking removed
    alert: str             # saved-search name the email came from

    @property
    def key(self) -> str:
        return f"{self.source}:{self.job_id}"


def _nl(body: str) -> str:
    return body.replace("\r\n", "\n").replace("\r", "\n")


# ---------------------------------------------------------------- LinkedIn
def _li_alert_name(body: str) -> str:
    m = re.search(r"Your job alert for (.+?)\n", body)
    if m:
        return m.group(1).strip()
    return "similar-jobs fallback" if "Jobs similar to your alert" in body else "unknown"


def parse_linkedin(body: str) -> list[Job]:
    body = _nl(body)
    alert = _li_alert_name(body)
    for footer in (LI_FOOTER, LI_FOOTER_SIMILAR):
        body = body.split(footer)[0]
    jobs: list[Job] = []
    for block in re.split(r"\n-{20,}\n", body):
        m = LI_JOB_URL.search(block)
        if not m:
            continue
        head = block[: block.find("View job:")]
        lines = [l.strip() for l in head.splitlines() if l.strip()]
        lines = [l for l in lines if not LI_NOISE.match(l)]
        # Drop alert header lines that precede the first job.
        lines = [l for l in lines if not l.startswith(("Your job alert", "Jobs similar",
                 "There were no results", "Manage alert", "https://"))
                 and not re.match(r"^\d+\+? new jobs? match", l)]
        if len(lines) < 2:
            continue
        title, company = lines[-3:-1] if len(lines) >= 3 else (lines[0], lines[1])
        location = lines[-1] if len(lines) >= 3 else ""
        jid = m.group(1)
        jobs.append(Job("linkedin", jid, title, company, location, None,
                        f"https://www.linkedin.com/jobs/view/{jid}/", alert))
    return jobs


# ---------------------------------------------------------------- Indeed
def _indeed_alert_name(body: str) -> str:
    m = re.search(r"\n\d+ new (.+?) jobs in ", body)
    return m.group(1).strip() if m else "unknown"


def _indeed_head(buf: list[str]) -> tuple[str, str, str]:
    title = buf[0] if buf else ""
    company, location = "", ""
    if len(buf) > 1 and (h := INDEED_HEADER.match(buf[1])):
        company, location = h.group("company"), h.group("location")
    return title, company, location


def parse_indeed(body: str, sponsored_rows: list | None = None) -> tuple[list[Job], int]:
    """Returns (jobs, sponsored_dropped).

    When sponsored_rows is a list, each dropped sponsored card is appended
    as {source, title, company, location}.
    """
    body = _nl(body)
    alert = _indeed_alert_name(body)
    body = body.split(INDEED_FOOTER)[0]
    start = body.find("Jobs 1-")
    if start != -1:
        body = body[body.find("\n", body.find("\n", start) + 1):]  # skip "See matching results" line
    jobs: list[Job] = []
    sponsored = 0
    buf: list[str] = []
    for raw in body.splitlines():
        line = raw.strip()
        u = INDEED_URL.match(line)
        if not u:
            if line:
                buf.append(line)
            continue
        if u.group(1) == "pagead":
            sponsored += 1                      # Rule 3
            if sponsored_rows is not None:
                title, company, location = _indeed_head(buf)
                sponsored_rows.append({"source": "indeed", "title": title, "company": company, "location": location})
        else:
            jk = INDEED_JK.search(line)
            title, company, location = _indeed_head(buf)
            pay = next((b for b in buf[2:] if PAY.match(b)), None)
            if jk:
                jobs.append(Job("indeed", jk.group(1), title, company, location, pay,
                                f"https://www.indeed.com/viewjob?jk={jk.group(1)}", alert))
        buf = []
    return jobs, sponsored


# ---------------------------------------------------------------- seen-set
def load_seen(path: Path) -> list[str]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [str(x) for x in data]
    rows = data.get("seen") or []
    return [str(x) for x in rows]


def save_seen(path: Path, seen: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schema": SEEN_SCHEMA, "seen": sorted(set(seen))}
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _job_drop(job: Job, reason: str) -> dict:
    return {"reason": reason, "source": job.source, "job_id": job.job_id, "title": job.title,
            "company": job.company, "location": job.location, "url": job.url}


# ---------------------------------------------------------------- driver
class Preparser:
    """Holds the seen-set so duplicates are dropped across emails (Rule 1)."""

    def __init__(self, seen: Iterable[str] = ()):
        self.seen: set[str] = set(seen)
        self.last_dropped: list[dict] = []
        self.stats = {"emails": 0, "jobs_in": 0, "duplicates": 0, "sponsored": 0, "kept": 0,
                      "chars_in": 0, "chars_out": 0}

    def process(self, sender: str, body: str) -> list[dict] | None:
        sender = sender.lower()
        self.last_dropped = []
        sponsored_rows: list[dict] = []
        if sender == LINKEDIN_SENDER:
            jobs, sponsored = parse_linkedin(body), 0
        elif sender == INDEED_SENDER:
            jobs, sponsored = parse_indeed(body, sponsored_rows)
        else:
            return None                         # pass through; not handled here
        for row in sponsored_rows:
            self.last_dropped.append({**row, "reason": "sponsored"})
        self.stats["emails"] += 1
        self.stats["jobs_in"] += len(jobs) + sponsored
        self.stats["sponsored"] += sponsored
        self.stats["chars_in"] += len(body)
        out = []
        in_email = set()
        for j in jobs:
            if j.key in in_email:
                self.stats["duplicates"] += 1
                self.last_dropped.append(_job_drop(j, "duplicate"))
                continue
            seen_before = j.key in self.seen
            in_email.add(j.key)
            self.seen.add(j.key)
            d = asdict(j)
            # Observation is not a completed disposition. Cross-run seen keys must not lose unprocessed jobs.
            if seen_before:
                d["seen_before_review_required"] = True
            out.append(d)
        self.stats["kept"] += len(out)
        self.stats["chars_out"] += len(json.dumps(out))
        return out

    def report(self, sender: str, body: str, gmail_id: str | None = None) -> dict:
        kept = self.process(sender, body)
        if kept is None:
            return {"gmail_id": gmail_id, "sender": sender, "passthrough": True, "kept": None, "dropped": []}
        alert = kept[0]["alert"] if kept else ""
        compact = [{k: v for k, v in row.items() if k != "alert"} for row in kept]
        return {"gmail_id": gmail_id, "sender": sender, "passthrough": False, "alert": alert,
                "kept": compact, "dropped": list(self.last_dropped)}


def load_emails(raw: str) -> list[dict]:
    text = raw.strip()
    if not text:
        return []
    if text.startswith("{") or text.startswith("["):
        data = json.loads(text)
        rows = data if isinstance(data, list) else [data]
    else:
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    out = []
    for row in rows:
        if not isinstance(row, dict) or "sender" not in row or "body" not in row:
            raise ValueError("each email needs sender and body")
        out.append(row)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pre-parse LinkedIn and Indeed job-alert bodies")
    parser.add_argument("--seen", required=True, help="path to state/alert-seen-jobs.json")
    parser.add_argument("--input", help="JSON or JSONL file; default stdin")
    args = parser.parse_args(argv)
    seen_path = Path(args.seen)
    prep = Preparser(load_seen(seen_path))
    raw = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
    reports = [prep.report(row["sender"], row["body"], row.get("gmail_id")) for row in load_emails(raw)]
    save_seen(seen_path, prep.seen)
    json.dump({"emails": reports, "stats": prep.stats}, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
