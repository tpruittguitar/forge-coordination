"""REV-156: JobSpy half of the read-only source trial. One search per (site, term), so one blocked site never hides
the others. Writes a JSON file the Node step reads. Usage: python jobspy_run.py config.json out.json"""
import json
import sys
import time

cfg = json.load(open(sys.argv[1]))["jobspy"]
out = {"searches": [], "errors": [], "jobs": []}
try:
    from jobspy import scrape_jobs
except Exception as e:  # install failed: report it, never fail the job
    out["errors"].append({"site": "all", "error": "import: " + str(e)[:200]})
    json.dump(out, open(sys.argv[2], "w"))
    sys.exit(0)

for site in cfg["sites"]:
    for term in cfg["searches"]:
        rec = {"site": site, "term": term, "returned": 0}
        try:
            kw = dict(site_name=[site], search_term=term, location=cfg["location"], results_wanted=cfg["resultsWanted"],
                      hours_old=cfg["hoursOld"], country_indeed="USA", verbose=0)
            if site == "google":
                kw["google_search_term"] = term + " jobs in the United States since last week"
            df = scrape_jobs(**kw)
            rows = json.loads(df.to_json(orient="records", date_format="iso")) if df is not None and len(df) else []
            for r in rows:
                r["site"] = r.get("site") or site
                out["jobs"].append({k: r.get(k) for k in ("site", "title", "company", "location", "job_url", "job_url_direct",
                                                          "min_amount", "max_amount", "interval", "date_posted")})
            rec["returned"] = len(rows)
        except Exception as e:
            rec["error"] = str(e)[:200]
            out["errors"].append({"site": site, "term": term, "error": str(e)[:200]})
        out["searches"].append(rec)
        time.sleep(2)

json.dump(out, open(sys.argv[2], "w"))
print(json.dumps({"searches": len(out["searches"]), "jobs": len(out["jobs"]), "errors": len(out["errors"])}))
