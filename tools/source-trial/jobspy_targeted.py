"""Targeted JobSpy lookup (Tim 2026-11-17): one search per stuck helper return and site, description fetch on.
python tools/source-trial/jobspy_targeted.py /tmp/targets.json /tmp/jobspy-targeted.json
Never fails the job: install or site errors are recorded in the output file."""
import json, sys, time

targets = json.load(open(sys.argv[1]))
out = {"jobs": [], "errors": []}
try:
    from jobspy import scrape_jobs
except Exception as e:
    out["errors"].append({"key": "all", "error": "import: " + str(e)[:200]})
    json.dump(out, open(sys.argv[2], "w"))
    sys.exit(0)

KEEP = ("site", "title", "company", "location", "job_url", "job_url_direct", "description", "date_posted")
# Tim 2026-11-17: a full posting description found on any site is verification. From GitHub runners, Glassdoor and
# ZipRecruiter answer 403 and Google returns no jobs (PR #420 live run, 40 of 40 searches), so only these two are used.
SITES = ("linkedin", "indeed")
for i, t in enumerate(targets):
    for site in SITES:
        kw = dict(site_name=[site], search_term=f"{t['title']} {t['company']}", location=t.get("location") or "United States",
                  results_wanted=5, country_indeed="USA", verbose=0)
        if site == "google":
            kw["google_search_term"] = f"{t['title']} {t['company']} jobs near {t.get('location') or 'United States'}"
        try:
            try:
                df = scrape_jobs(fetch_description=True, **kw)
            except TypeError:  # older python-jobspy
                df = scrape_jobs(linkedin_fetch_description=True, **kw)
            rows = json.loads(df.to_json(orient="records", date_format="iso")) if df is not None and len(df) else []
            for r in rows:
                r["site"] = r.get("site") or site
                job = {k: r.get(k) for k in KEEP}
                job["targetKey"] = t["key"]
                out["jobs"].append(job)
        except Exception as e:
            out["errors"].append({"key": t["key"], "site": site, "error": str(e)[:200]})
        time.sleep(1)
json.dump(out, open(sys.argv[2], "w"))
print(json.dumps({"targets": len(targets), "jobs": len(out["jobs"]), "errors": len(out["errors"])}))
