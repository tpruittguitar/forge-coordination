"""Tests built from the real email formats read in the Oct 25 2026 audit
(tracking tokens shortened)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "alert-preparse"))
from alert_preparse import (  # noqa: E402
    Preparser, parse_linkedin, parse_indeed, load_seen, save_seen,
    LINKEDIN_SENDER, INDEED_SENDER,
)

TRK = "?trackingId=abc%3D%3D&refId=xyz&lipi=urn%3Ali%3Apage&midToken=AQG&trk=eml-email_job_alert_digest_01&otpToken=" + "N" * 300

LI_1 = f"""Your job alert for Scale ramp rate in United States
30+ new jobs match your preferences.

VP - Operations
Plexus Corp.
Neenah, WI

This company is actively hiring
View job: https://www.linkedin.com/comm/jobs/view/4483191253/{TRK}

---------------------------------------------------------

Vice President, Component Manufacturing + Facilities
Rolls-Royce Power Systems
Aiken, SC
Fast growing
View job: https://www.linkedin.com/comm/jobs/view/4479999999/{TRK}

---------------------------------------------------------

See all jobs on LinkedIn: https://www.linkedin.com/comm/jobs/search-results/?keywords=Scale{TRK}

This email was intended for Tim Pruitt (Manufacturing and Quality | Honda | Volkswagen)
Unsubscribe: https://www.linkedin.com/job-alert-email-unsubscribe?savedSearchId=1{TRK}
"""

LI_2 = f"""Your job alert for ("director of manufacturing" OR "head of manufacturing") (launch OR ramp) in United States
30+ new jobs match your preferences.

Vice President, Component Manufacturing + Facilities
Rolls-Royce Power Systems
Aiken, SC

1 connection
View job: https://www.linkedin.com/comm/jobs/view/4479999999/{TRK}

---------------------------------------------------------

See all jobs on LinkedIn: https://www.linkedin.com/x{TRK}
"""

LI_SIMILAR = f"""Jobs similar to your alert

There were no results for your alert, but these similar jobs may be a fit. Manage alert:
https://www.linkedin.com/comm/jobs/alerts/{TRK}

Director, Engineering Enrichment Operations
BWXT
Oak Ridge
View job: https://www.linkedin.com/comm/jobs/view/4441013389/{TRK}

---------------------------------------------------------

See more jobs: https://www.linkedin.com/x{TRK}
"""

IQ = "&from=ja&qd=" + "R" * 400 + "&tk=1k5o&alid=6a8e&bb=" + "B" * 120 + "&tmtk=1k5o"

INDEED = f"""Indeed Job Alert
22 new (company:Tesla OR company:Rivian) (Director OR "Senior Manager") (quality OR manufacturing) -intern jobs in United States

Jobs 1-3 of 3 new jobs
See matching results on Indeed: https://www.indeed.com/jobs?q=x{IQ}

Director - Supplier Development, Industrialization and Quality
Rivian - Normal, IL
Easily apply
Experience: 15+ years of progressive leadership experience in supplier development.
3 days ago
https://www.indeed.com/rc/clk/dl?jk=0c0aeb9a9c5c4de3{IQ}

Rigout Assembly Supervisor
L&L Fabrication Inc. - Douglas, WY
$65,000 - $80,000 a year
Easily apply
Reports job status to the Operations Manager.
8 days ago
https://www.indeed.com/pagead/clk/dl?mo=r&ad=-6NY{IQ}

Sr. Vision Systems Engineer, Cell Engineering
Tesla - San Diego, CA
$133,000 - $296,400 a year
Experience in high-volume manufacturing is highly desired.
1 day ago
https://www.indeed.com/rc/clk/dl?jk=e6d4bfb371928efe{IQ}

Do not share this email
This email contains secure links that are personalized for you.
Unsubscribe from this job alert: https://subscriptions.indeed.com/alerts/cancel?token=x
"""


def test_linkedin_crlf_digest():
    jobs = parse_linkedin(LI_1.replace("\n", "\r\n"))
    assert [j.job_id for j in jobs] == ["4483191253", "4479999999"]
    assert jobs[0].company == "Plexus Corp."
    jobs = parse_linkedin(LI_1)
    assert [j.title for j in jobs] == ["VP - Operations",
                                      "Vice President, Component Manufacturing + Facilities"]
    assert jobs[0].company == "Plexus Corp." and jobs[0].location == "Neenah, WI"
    assert jobs[1].company == "Rolls-Royce Power Systems"
    assert jobs[0].url == "https://www.linkedin.com/jobs/view/4483191253/"
    assert jobs[0].alert == "Scale ramp rate in United States"


def test_linkedin_similar_fallback():
    jobs = parse_linkedin(LI_SIMILAR)
    assert len(jobs) == 1 and jobs[0].company == "BWXT"
    assert jobs[0].alert == "similar-jobs fallback"


def test_indeed_drops_sponsored_and_keeps_pay():
    jobs, sponsored = parse_indeed(INDEED)
    assert sponsored == 1
    assert [j.job_id for j in jobs] == ["0c0aeb9a9c5c4de3", "e6d4bfb371928efe"]
    assert jobs[0].company == "Rivian" and jobs[0].location == "Normal, IL"
    assert jobs[1].pay == "$133,000 - $296,400 a year"
    assert jobs[1].url == "https://www.indeed.com/viewjob?jk=e6d4bfb371928efe"


def test_dedupe_across_emails():
    p = Preparser()
    a = p.process(LINKEDIN_SENDER, LI_1)
    b = p.process(LINKEDIN_SENDER, LI_2)
    assert len(a) == 2 and len(b) == 1
    assert b[0]["seen_before_review_required"] is True
    assert p.stats["duplicates"] == 0
    assert p.last_dropped == []


def test_size_reduction_and_passthrough():
    p = Preparser()
    for s, b in [(LINKEDIN_SENDER, LI_1), (INDEED_SENDER, INDEED)]:
        p.process(s, b)
    assert p.stats["chars_out"] < p.stats["chars_in"] * 0.5
    assert p.process("jobalert@lensa.com", "anything") is None


def test_seen_file_roundtrip(tmp_path):
    path = tmp_path / "seen.json"
    save_seen(path, ["linkedin:4483191253", "indeed:abc"])
    assert json.loads(path.read_text())["schema"] == "forge.alert-seen.v1"
    assert load_seen(path) == ["indeed:abc", "linkedin:4483191253"]
    p = Preparser(load_seen(path))
    kept = p.process(LINKEDIN_SENDER, LI_1)
    assert [j["job_id"] for j in kept] == ["4483191253", "4479999999"]
    assert kept[0]["seen_before_review_required"] is True
    assert p.stats["duplicates"] == 0
