from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


def require(cond, message):
    if not cond:
        raise SystemExit("PERFORMANCE_GUARD FAIL: " + message)


scope = read("scope-admin.js")
canonical = read("supabase-canonical.js")
realtime = read("supabase-realtime.js")
commit = read("followup-commitment-ui.js")
refine = read("followup-ux-refinements.js")
search = read("followup-search-fastfix.js")
schedule = read("followup-schedule-ui.js")
completed = read("followup-completed-queue-fix.js")
kanban = read("kanban-scroll-fix.js")
hub = read("followup-render-hub.js")

# Reloads: one coordinated path, no second CRM_UPDATED reload in scope/canonical.
require("reloadInFlight" in scope and "reloadPending" in scope, "scope reload coalescing missing")
require("CRM_UPDATED" not in scope, "scope-admin reintroduced a CRM_UPDATED reload listener")
require("addEventListener('message'" not in canonical and 'addEventListener("message"' not in canonical,
        "supabase-canonical reintroduced a second global message reload listener")
require("CRM_UPDATED" in realtime and "reloadSoon(true)" in realtime, "central CRM_UPDATED coordinator missing")

# Marco Zero: cause neutralized; expensive document-wide observer must stay gone.
require("base.sincronizado=true" in realtime, "Marco Zero sentinel missing")
require("observe(document.documentElement" not in realtime and "observe(document," not in realtime,
        "global Marco Zero MutationObserver reintroduced")

# Hidden Carteira render guard + consolidated metadata reads.
require("installRenderCoordinator" in realtime and "page-leads" in realtime, "hidden Carteira render guard missing")
for field in ("perfil_produto", "data_fechamento", "created_at"):
    require(field in realtime, f"metadata consolidation missing {field}")
require("syntheticMetadata" in realtime and "leadMetaComplete" in realtime, "metadata shared-cache path missing")

# Duplicate candidate wrapper must load before the UI performs its first refresh.
require(realtime.index("duplicate-phone-br-test.js") < realtime.index("duplicates-ui.js"),
        "duplicate phone wrapper must load before duplicates UI")

# Follow-up: one post-render hub, no independent tbody MutationObservers in consumers.
require("tm:followup-rendered" in hub and "fuRenderFila" in hub, "Follow-up post-render hub missing")
for name, src in {
    "commitments": commit,
    "search": search,
    "schedule": schedule,
    "completed": completed,
    "eligibility/sorting": kanban,
}.items():
    require("MutationObserver" not in src, f"{name} reintroduced a table MutationObserver")
    require("tm:followup-rendered" in src, f"{name} is not consuming the shared post-render signal")

# Commitments: exactly one module owns followup_commitment_state polling.
require("followup_commitment_state" in commit, "commitment source RPC missing")
require("TM_COMMITMENTS" in commit and "tm:commitment-state" in commit, "shared commitment state API missing")
require("followup_commitment_state" not in refine, "duplicate commitment polling reintroduced in refinements")
require("tm:commitment-state" in refine, "refinements are not consuming shared commitment state")

# Search must preserve eligibility established by the eligibility layer.
require("tmFuEligible" in search and "tmFuEligible" in kanban, "search/eligibility coordination missing")

print("PERFORMANCE_GUARD OK")
