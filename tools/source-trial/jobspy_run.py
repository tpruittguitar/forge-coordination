"""REV-156: JobSpy half of the read-only source trial. One search per (site, term), so one blocked site never hides
the others. Writes a JSON file the Node step reads. Usage: python jobspy_run.py config.json out.json"""
import json
import logging
import sys
import time


class _Capture(logging.Handler):
    """JobSpy logs a blocked site (e.g. "403 (blocked: use a proxy)") and returns no rows instead of raising, which
    made blocked sites look like clean empty searches. Keep the first ERROR logged during each search."""
    def __init__(self):
        super().__init__(logging.ERROR)
        self.first = None

    def emit(self, record):
        if self.first is None:
            self.first = record.getMessage()[:200]


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
        cap = _Capture()
        logging.getLogger("jobspy").addHandler(cap)
        try:
            kw = dict(site_name=[site], search_term=term, location=cfg["location"], results_wanted=cfg["resultsWanted"],
                      hours_old=cfg["hoursOld"], country_indeed="USA", verbose=0)
            df = scrape_jobs(**kw)
            rows = json.loads(df.to_json(orient="records", date_format="iso")) if df is not None and len(df) else []
            for r in rows:
                r["site"] = r.get("site") or site
                out["jobs"].append({k: r.get(k) for k in ("site", "title", "company", "location", "job_url", "job_url_direct",
                                                          "min_amount", "max_amount", "interval", "date_posted")})
            rec["returned"] = len(rows)
        except Exception as e:
            rec["error"] = str(e)[:200]
        finally:
            logging.getLogger("jobspy").removeHandler(cap)
        if not rec["returned"] and "error" not in rec and cap.first:
            rec["error"] = cap.first
        out["searches"].append(rec)
        time.sleep(2)

# One error line per site (a blocked site fails every search the same way), with how many searches it hit.
for site in cfg["sites"]:
    failed = [s for s in out["searches"] if s["site"] == site and s.get("error")]
    if failed:
        n = sum(1 for s in out["searches"] if s["site"] == site)
        out["errors"].append({"site": site, "error": "%s (%d of %d searches)" % (failed[0]["error"], len(failed), n)})

json.dump(out, open(sys.argv[2], "w"))
print(json.dumps({"searches": len(out["searches"]), "jobs": len(out["jobs"]), "errors": len(out["errors"])}))
