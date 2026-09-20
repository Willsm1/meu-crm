from pathlib import Path
p=Path('crm.html')
s=p.read_text(encoding='utf-8')
repls={
 'followup-schedule-ui.js?v=20260920-1228':'followup-schedule-ui.js?v=20260920-1455',
 'followup-agendar-ui.js?v=20260920-1228':'followup-agendar-ui.js?v=20260920-1455',
 'supabase-realtime.js?v=20260920-1228':'supabase-realtime.js?v=20260920-1455',
}
for a,b in repls.items():
    if a not in s: raise SystemExit('missing expected tag: '+a)
    s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8')
