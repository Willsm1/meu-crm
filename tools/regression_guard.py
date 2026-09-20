from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require_file(name):
    p = ROOT / name
    if not p.exists():
        errors.append(f"missing required file: {name}")
        return ""
    return p.read_text(encoding="utf-8")

def require(text, needle, label, count=None):
    n = text.count(needle)
    if n == 0:
        errors.append(f"missing invariant: {label}")
    elif count is not None and n != count:
        errors.append(f"invariant count mismatch: {label} expected {count}, got {n}")

crm = require_file("crm.html")
realtime = require_file("supabase-realtime.js")
duplicates = require_file("duplicates-ui.js")
require_file("supabase-canonical.js")
require_file("followup-agendar-ui.js")
require_file("followup-schedule-ui.js")
require_file("notifications-ui.js")

require(crm, 'supabase-canonical.js', 'canonical loader present')
require(crm, 'supabase-realtime.js', 'realtime loader present')
require(realtime, 'duplicates-ui.js', 'duplicates UI loader', 1)
require(realtime, 'notifications-ui.js', 'notifications UI loader', 1)
require(realtime, 'TM_SUPABASE_AUTH_CLIENT', 'authenticated Supabase client usage')
require(realtime, 'first.status!==401', 'Follow-up retry limited to HTTP 401')
require(realtime, 'setTimeout(resolve,700)', 'Follow-up retry delay preserved')
require(duplicates, "rpc('duplicate_candidates')", 'duplicate candidates RPC')
require(duplicates, "rpc('consolidate_duplicate'", 'duplicate consolidation RPC')
require(duplicates, 'Confirmar unificação', 'explicit merge confirmation')
require(duplicates, 'Interações antigas não serão movidas nem apagadas', 'append-only interaction promise')

if errors:
    print("REGRESSION GUARD: FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("REGRESSION GUARD: PASS")
