# Pay-disclosure salary search guide

Reviewed: 2026-10-31. Purpose: guide salary-source searches, not decide legal compliance for an individual employer.
Statewide private-sector posting requirements currently identified: 14 states plus DC. Thresholds, territorial nexus,
exceptions and posting dates matter; this is not a rule that every advertisement in these locations contains pay.
Official sources below supersede older secondary guides. Recheck the official source when a law changes or coverage is unclear.

| Jurisdiction | Posting requirement effective | Basic coverage / search cue | Official source |
| --- | --- | --- | --- |
| California | 2023-01-01 | 15+ employees; agency guidance requires at least one CA employee. Include roles potentially filled in CA, including remotely. | https://www.dir.ca.gov/dlse/california_equal_pay_act.htm |
| Colorado | 2021-01-01; amended 2024 | Employers with CO employees; CO work and covered remote roles. A fully remote role is not exempt merely because the ad excludes CO applicants. | https://cdle.colorado.gov/sites/cdle/files/Compliance%20Assistance%20Letter%20to%20Employers%2C%20Remote%20Jobs%20Covered%20by%20EPEWA%20%5Baccessible%5D.pdf |
| Connecticut | 2026-10-01 | Public and internal advertisements disclose wage/range and general benefits; no general large-employer threshold for this provision. Older request/offer-only guidance under PA21-30 is incomplete after PA26-12. | https://portal.ct.gov/governor/news/press-releases/2026/05-2026/governor-lamont-signs-legislation-protecting-workers-rights ; https://www.cga.ct.gov/2026/ba/pdf/2026HB-05003-R010709-BA.pdf |
| Hawaii | 2024-01-01 | 50+ employees; exclusions include internal transfers/promotions and specified collective-bargaining public jobs. Do not mistake a proposed threshold change for an enacted law. | https://data.capitol.hawaii.gov/sessions/session2023/bills/GM1306_.pdf |
| Illinois | 2025-01-01 | 15+ employees; IL work or out-of-state work reporting to an IL supervisor, office or work site; pay and benefits. | https://labor.illinois.gov/faqs/equal-pay-act-salary-transparency-faq.html |
| Maine | 2026-07-29 | 10+ employees; commission-only roles have a commission disclosure exception rather than an ordinary salary range. | https://www.maine.gov/labor/news_events/article.shtml?id=13356290 ; https://www.legis.maine.gov/legis/statutes/26/title26sec622-A.html |
| Maryland | 2024-10-01 | No general headcount floor; work physically performed at least partly in MD, including covered remote roles. Separate ranges for distinct locations/levels. | https://labor.maryland.gov/labor/wages/esswagerangefaq.shtml |
| Massachusetts | 2025-10-29 | 25+ employees in the Commonwealth; pay range for covered positions. | https://www.mass.gov/info-details/pay-transparency-in-massachusetts |
| Minnesota | 2025-01-01 | 30+ employees at one or more MN sites; starting range or fixed rate and general benefits/other compensation. | https://www.revisor.mn.gov/statutes/cite/181.173 |
| New Jersey | 2025-06-01 | 10+ employees over 20 calendar weeks, with NJ business/employment/application nexus; pay and benefits. Check agency guidance for remote and staffing exceptions. | https://www.nj.gov/labor/paytransparency/ |
| New York | 2023-09-17 | 4+ employees; NY work and certain out-of-state roles reporting to a NY supervisor, office or site. Employer headquarters alone does not cover every remote role. | https://dol.ny.gov/node/45456 |
| Vermont | 2025-07-01 | 5+ employees with at least one VT employee; VT jobs and covered remote work predominantly serving a VT office/site. | https://ago.vermont.gov/sites/ago/files/2024-12/Final%20Version%20of%20H%20704%20Guidance%20%2812-31-24%29.pdf |
| Virginia | 2026-07-01 | Covered employers must disclose good-faith pay/range in public/internal job postings; no general large-employer threshold. | https://doli.virginia.gov/2026/07/01/employment-law-updates-new-legislation-protecting-virginia-workers-applies-beginning-july-1-2026/ |
| Washington | 2023-01-01 | 15+ employees, including out-of-state staff, and a WA employment nexus; postings recruiting WA-based workers include pay, benefits and other compensation. | https://lni.wa.gov/workers-rights/wages/equal-pay-opportunities-act/equal-pay-and-opportunities-act-qa |
| District of Columbia | 2024-06-30 | Covered DC employers; advertised minimum/maximum projected salary or hourly pay. DC is not a state. | https://oag.dc.gov/worker-rights/wage-and-hour-laws |

## Different categories that must stay separate

- Nevada: range/rate disclosure after an applicant completes an interview; not a general statewide advertisement mandate.
  https://www.leg.state.nv.us/division/legal/lawlibrary/NRS/NRS-613.html (NRS613.133).
- Rhode Island: disclosure on request and at hire/transfer; not a general statewide advertisement mandate.
  https://rules.sos.ri.gov/regulations/part/260-30-05-8?reg_id=12779 (8.8.2).
- Delaware: statewide posting requirement enacted but effective 2027-09-26, not active on this review date.
  https://delcode.delaware.gov/title19/c007/sc01/ (section709C).
- Local coverage can exist without a statewide mandate. Cleveland OH requires pay ranges in formal postings for covered
  employers with 15+ employees within the city, effective 2025-10-27. Do not promote this to all Ohio jobs.
  https://www.clevelandohio.gov/city-hall/boards-commissions/fair-employment-wage-board/laws-procedures
- Hawaii SB2386's 2026 proposed threshold/exemption changes had no Act number and stopped in conference on the official
  status page reviewed. Do not apply the introduced or amended bill as enacted law:
  https://data.capitol.hawaii.gov/session/measure_indiv.aspx?billnumber=2386&billtype=SB&year=2026

## Shared pipeline search procedure

1. Read the exact employer/ATS posting for EVERY state, including voluntarily disclosed ranges. Check the bottom of the
   full description, compensation sections, structured JobPosting.baseSalary and authoritative ATS pay-range fields.
   Preserve pay units, currency, date, location-specific bands, and base versus bonus/equity/total compensation.
2. If pay is missing, check an identity-matched employer copy. Same posting identity, company, title, location and level
   must agree. An aggregator's own salary prediction is not an employer disclosure. A snippet alone is not a full source.
3. For a covered-jurisdiction target, prioritize finding its actual disclosure before estimating. Missing pay may mean
   incomplete extraction, a different location band, an exempt employer, an old posting or noncompliance; the law itself
   does not supply a salary, authorize invented pay or require indefinitely blocking the job.
4. Only then look for same-employer, same-level/function/scope comparables in these jurisdictions or remote variants.
   These remain comparables: never label a CA/NY band as the exact pay for a TX job. Preserve geography in the model.
5. Voluntary disclosures outside the list remain equally valid evidence. Slate and Scout are useful employer searches,
   not guarantees of pay on every role. Do not exclude a posting because its state lacks a mandate.
6. Reuse the existing shared company/site reference and salary evidence. Code handles extraction, ranking/deduplication,
   estimation and provenance; Writer handles canonical changes and final scoring; AI handles bounded ambiguous sources.

Implementation audit: tools/enrich-ats-pay/lib.js PAY_TRANSPARENCY already contains exactly these 14 states plus DC,
including CT, ME and VA. It ranks similar postings in lib.js and Workday detail candidates in run.js; it is a search hint,
not a compliance engine. No state-list expansion, new recurring AI task or master salary mutation was needed for this
research. Existing shared instructions route salary research through docs/COMPENSATION_CONTEXT.md and this linked guide.
