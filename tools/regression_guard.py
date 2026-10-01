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
actionbar = require_file("actionbar-context-ui.js")
wa_loader = require_file("whatsapp-production-loader.js")
require_file("supabase-canonical.js")
require_file("followup-agendar-ui.js")
require_file("followup-schedule-ui.js")
require_file("notifications-ui.js")
require_file("crm-whatsapp-runtime.js")
require_file("crm-whatsapp-connections.js")
require_file("whatsapp-followup-bridge-hosted.js")
require_file("crm-whatsapp-followup-hosted-adapter.js")
require_file("crm-whatsapp-storage-gate.js")
require_file("crm-whatsapp-media-preview.js")

# Production MAIN invariants
require(crm, 'supabase-canonical.js', 'canonical loader present')
require(crm, 'supabase-realtime.js', 'realtime loader present')
require(crm, 'is_critical', 'critical lead support preserved')
require(realtime, 'duplicates-ui.js', 'duplicates UI loader', 1)
require(realtime, 'notifications-ui.js', 'notifications UI loader', 1)
require(realtime, 'TM_SUPABASE_AUTH_CLIENT', 'authenticated Supabase client usage')
require(realtime, 'first.status!==401', 'Follow-up retry limited to HTTP 401')
require(realtime, 'setTimeout(resolve,700)', 'Follow-up retry delay preserved')
require(duplicates, "callRpc('duplicate_candidates'", 'duplicate candidates RPC')
require(duplicates, "callRpc('consolidate_duplicate'", 'duplicate consolidation RPC')
require(duplicates, "btn.style.display='none'", 'duplicate button hidden by default')
require(duplicates, "groups.length?'inline-flex':'none'", 'duplicate button visible only with candidates')
require(duplicates, 'Mesmo telefone + mesmo responsável', 'duplicate owner rule disclosed')
require(duplicates, 'Confirmar unificação', 'explicit merge confirmation')
require(duplicates, 'Interações antigas não serão movidas nem apagadas', 'append-only interaction promise')

# Direct WhatsApp-on-main integration invariants
require(actionbar, 'whatsapp-production-loader.js', 'WhatsApp production loader attached to current main UI stack', 1)
require(wa_loader, 'crm-whatsapp-runtime.js', 'hosted WhatsApp runtime loaded', 1)
require(wa_loader, 'crm-whatsapp-followup-visual.js', 'validated Follow-up visual loaded', 1)
require(wa_loader, 'crm-whatsapp-matching-visual.js', 'validated matching UI loaded', 1)
require(wa_loader, 'crm-whatsapp-storage-gate.js', 'validated storage gate loaded', 1)
require(wa_loader, 'crm-whatsapp-media-preview.js', 'validated media preview loaded', 1)
require(wa_loader, 'whatsapp-followup-bridge-hosted.js', 'hosted Follow-up bridge loaded', 1)
require(wa_loader, 'crm-whatsapp-followup-hosted-adapter.js', 'hosted KPI adapter loaded', 1)
require(wa_loader, 'crm-whatsapp-connections.js', 'multi-WhatsApp manager loaded', 1)

if errors:
    print("REGRESSION GUARD: FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("REGRESSION GUARD: PASS")
