from look_common import *
def row(k,v,note=''):
    return f'<div style="display:grid;grid-template-columns:200px 1fr;gap:16px;padding:9px 14px;border-bottom:1px solid var(--div);align-items:center;font-size:14px"><span class="lbl">{k}</span><span>{v}{note}</span></div>'
build='<span style="display:flex;align-items:center;gap:8px;white-space:nowrap;min-width:0"><span class="mono p" style="font-size:12px;letter-spacing:.04em;text-transform:none"><span class="c u">PR #121</span> · <span class="c u">e7389ed</span> · deployed 18 Oct 17:38 ET</span><span class="s" style="overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1">· REV-017 · State-write fix: Writer merges explorer state, never overwrites (includes REV-016 tests)</span><span class="chip"><span class="g">✓</span> same commit as this page</span></span>'
panel=f'''<div class="panel" style="width:1240px"><div class="ph"><span class="t">Settings › Writer</span><span class="x">read-only · from writer_status · as of 18:30</span></div>
{row('Health','<span class="chip"><span class="g">✓</span> OK</span> <span class="s">no current faults</span>')}
{row('Writer','<span class="p">IDLE</span> <span class="s">· lock free · queue trigger installed</span>')}
<div style="display:grid;grid-template-columns:200px 1fr;gap:16px;padding:12px 14px;border-bottom:1px solid var(--div);align-items:center;background:var(--plate);border-left:3px solid var(--c)"><span class="lbl p">Writer build</span>{build}</div>
{row('Frontend','<span class="mono" style="font-size:12px;letter-spacing:.04em;text-transform:none"><span class="c u">e7389ed</span></span> <span class="s">· main · Netlify</span>')}
{row('Scoring model','<span class="p">rev 24</span> <span class="s">· published model · all weights shared</span>')}
{row('Lane queue','<span class="p">3</span> <span class="s">· oldest 2 min · 0 held</span>')}
{row('Unverified writes','<span class="p">none</span>')}
</div>'''
states=[('Normal','<span class="c u">PR #121</span> · <span class="c u">e7389ed</span> · deployed 18 Oct 17:38 ET <span class="chip"><span class="g">✓</span> same commit as this page</span>','b.pr, b.commit, b.deployedAt; chip when b.commit equals build-info commitShort'),
('Different commit','<span class="c u">PR #119</span> · <span class="c u">93e357d</span> · deployed 18 Oct 16:20 ET <span class="chip">page is e7389ed</span>','neutral: Writer and frontend deploy separately; no colour'),
('No PR in subject','no PR · <span class="c u">5c367c0</span> · deployed 17 Oct 23:10 ET','b.pr null → "no PR" + subject'),
('Dirty deploy','<span class="a">▸</span> <span class="c u">e7389ed+dirty</span> · deployed from uncommitted changes','deploy.sh appends +dirty; amber attention, glyph + words'),
('No stamp','<span class="a">▸</span> deployed without a build stamp','commit = "source" and no PR (Code.gs default)'),
('Too old','<span class="a">▸</span> predates writer_status · deploy needed to report its build','w.unsupported'),
('Unreachable','<span class="r">⊗</span> Writer not answering · last answer 18:12','w.fetchError (same item as Needs you › Failed)')]
st='<div class="panel" style="width:1240px;margin-top:24px"><div class="ph"><span class="t">Writer build line · every state</span><span class="x">one line · mono 12 px · links cyan · never a version number the Writer does not report</span></div>'+''.join(f'<div style="display:grid;grid-template-columns:200px 1fr 420px;gap:16px;padding:10px 14px;border-bottom:1px solid var(--div);align-items:center"><span class="lbl">{a}</span><span class="mono p" style="font-size:12px;letter-spacing:.04em;text-transform:none">{b}</span><span class="s" style="font-size:13px">{c}</span></div>' for a,b,c in states)+'</div>'
call='''
<div class="callout" style="left:1340px;top:120px;width:1180px"><b>1 · One line, highest on the Writer card after health</b><br>"Writer build" row: PR link · short commit link · deployed time (ET) · REV + subject (Secondary, truncated with ellipsis, full text on hover) · comparison chip. 3 px cyan left bar marks it as the row this frame is about (mock emphasis only; the built row has no bar).</div>
<div class="callout" style="left:1340px;top:250px;width:1180px"><b>2 · L-2: only what writer_status.build reports</b><br>Fields are commit, pr, subject, deployedAt (deploy.sh stamps WRITER_BUILD). The Apps Script version number ("v69") is not reported, so it is not drawn. FOR TIM: if you want "v69" on this line, deploy.sh must add the version to WRITER_BUILD first.</div>
<div class="callout" style="left:1340px;top:380px;width:1180px"><b>3 · Colour</b><br>Normal and "different commit" states are neutral. Amber ▸ only for dirty / unstamped / too old (attention, words say why). Red ⊗ only when the Writer does not answer.</div>
'''
body=board_head('M-07','Settings › Writer · build line','V-05 V-10 V-11',src='Build values from foreman-cockpit main (PR #121, e7389ed, REV-017); deployed time is mock')+f'<div style="position:absolute;left:40px;top:110px">{panel}{st}</div>'+call
open('m07.html','w').write(page(body,2560,1440))
