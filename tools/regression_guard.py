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

def forbid(text, needle, label):
    if needle in text:
        errors.append(f"forbidden invariant present: {label}")

crm = require_file("crm.html")
realtime = require_file("supabase-realtime.js")
duplicates = require_file("duplicates-ui.js")
actionbar = require_file("actionbar-context-ui.js")
wa_loader = require_file("whatsapp-production-loader.js")
taurus_next = require_file("taurus-next.html")
crm_html = require_file("crm.html")
wa_media_compat = require_file("crm-whatsapp-hosted-media-compat.js")
wa_history = require_file("crm-whatsapp-history-range.js")
scope_privacy = require_file("scope-privacy-ui.js")
wa_media = require_file("crm-whatsapp-media-preview.js")
gateway = require_file("services/whatsapp-gateway/server.mjs")
gateway_core = require_file("services/whatsapp-gateway/core.mjs")
gateway_media_core = require_file("services/whatsapp-gateway/media-core.mjs")
gateway_package = require_file("services/whatsapp-gateway/package.json")
regression_core = require_file("taurus-regression-core.js")
regression_panel = require_file("taurus-regression-panel.js")
require_file("services/whatsapp-gateway/test/core.test.mjs")
require_file("services/whatsapp-gateway/test/media-core.test.mjs")
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
require(wa_loader, 'crm-whatsapp-hosted-media-compat.js', 'hosted media compatibility loaded', 1)
require(wa_loader, 'crm-whatsapp-followup-visual.js', 'validated Follow-up visual loaded', 1)
require(wa_loader, 'crm-whatsapp-matching-visual.js', 'validated matching UI loaded', 1)
require(wa_loader, 'crm-whatsapp-storage-gate.js', 'validated storage gate loaded', 1)
require(wa_loader, 'crm-whatsapp-media-preview.js', 'validated media preview loaded', 1)
require(wa_loader, 'whatsapp-followup-bridge-hosted.js', 'hosted Follow-up bridge loaded', 1)
require(wa_loader, 'crm-whatsapp-followup-hosted-adapter.js', 'hosted KPI adapter loaded', 1)
require(wa_loader, 'crm-whatsapp-connections.js', 'multi-WhatsApp manager loaded', 1)
forbid(taurus_next, "cdn.jsdelivr.net/gh/Willsm1/meu-crm@", "duplicate pinned WhatsApp stack in Taurus Next")
require(taurus_next, "crm.html?nextboot=20261105-scope2", "Taurus Next clean CRM boot source")
require(taurus_next, "supabase-realtime.js?v=20261105-scope1", "Taurus Next fresh realtime root before iframe execution")
require(wa_loader, "crm-whatsapp-history-range.js?v=20261105-global-scope12", "diagnostic conversation history cache version")
require(wa_loader, "crm-whatsapp-followup-visual.js?v=20261104-history-owner3", "current follow-up history ownership cache version")
require(wa_media_compat, 'isLegacyMedia', 'legacy media source translated')
require(wa_media_compat, '/api/whatsapp/media/', 'hosted media endpoint used')
require(wa_media_compat, 'getLeadAssets', 'stored media hydration preserved')

# Taurus anti-regression panel invariants
require(actionbar, "taurus-regression-core.js?v='+Date.now()", "anti-regression cache busting")
require(regression_core, "waitSupabaseClient", "Supabase readiness wait in regression runner")
require(regression_core, "directInsertRegression", "REST fallback for regression report persistence")
require(regression_core, "directRead", "REST fallback for Supabase regression reads")
require(regression_core, "authenticatedUser", "client-independent Supabase session validation")
require(regression_core, "Sessão Supabase válida", "session regression test remains registered")
require(regression_core, "flushPendingReport", "queued retry for unsaved regression reports")
require(regression_core, "tm_regression_pending_report", "pending regression report local queue")
require(regression_core, "client-duplicate", "insert-only duplicate handling for regression reports")

require(actionbar, "taurus-regression-core.js", "anti-regression core loader")
require(actionbar, "taurus-regression-panel.js", "anti-regression panel loader")
require(regression_core, "registerCell", "cell registry API")
require(regression_core, "registerTest", "test registry API")
require(regression_core, "regression_runs", "persistent regression reporting")
require(regression_core, "tm_regression_fixture_", "safe test reset namespace")
require(regression_panel, "RODAR TODOS OS TESTES", "one-click regression action")
require(regression_panel, "Rodar célula", "per-cell regression action")
forbid(regression_core, "localStorage.clear()", "global localStorage reset in regression runner")

# WhatsApp gateway behavioral hardening invariants
require(gateway, "./core.mjs", "gateway tested core import")
require(gateway, "./media-core.mjs", "gateway tested media core import")
require(gateway_core, "disconnectPolicy", "515 restart policy covered")
require(gateway_core, "classifyEvent", "message classification covered")
require(gateway_core, "phoneFromMessageKey", "LID/PN phone resolution covered")
require(gateway_media_core, "downloadMediaBuffer", "media retry helper covered")
require(gateway_media_core, "shouldCleanupLocalMedia", "safe media cleanup policy covered")
require(gateway_package, '"test": "node --test test/*.test.mjs"', "gateway test command")
forbid(gateway, "oneTimeResetWillSession", "hard-coded production WhatsApp auth reset")
require(gateway, "whatsapp_gateway_recovery_targets", "eligible lead recovery source preserved")
require(gateway, "targetedRecoveryUntil", "targeted recovery append window preserved")
require(gateway, "upsertType==='notify'", "realtime notify capture preserved")
require(gateway, "eligible lead live catch-up requested", "eligible live catch-up preserved")
require(wa_history, "tm-wa-wa-shell", "WhatsApp-style conversation shell preserved")
require(wa_history, "TM_WA_HISTORY_OPEN", "conversation history global opener preserved")
require(wa_history, "stopImmediatePropagation", "legacy history click blocked")
require(wa_history, "},true);", "history click listener runs in capture phase")
require(wa_history, "__TM_WA_HISTORY_DIAG__", "temporary history runtime diagnostics present")
require(gateway, "/api/whatsapp/diagnostics/history-ui", "temporary authenticated history diagnostic endpoint present")
require(wa_history, "whatsapp_media_for_lead", "conversation media hydration preserved")
require(wa_history, "Somente histórico", "read-only conversation mode preserved")

if errors:
    print("REGRESSION GUARD: FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("REGRESSION GUARD: PASS")


require(wa_history, 'data-history-renderer="conversation-v2"', "modern WhatsApp history renderer owns lead DOM")
require(wa_media, "body.dataset.historyRenderer==='conversation-v2'", "legacy media renderer cannot overwrite modern history DOM")
require(wa_loader, "crm-whatsapp-media-preview.js?v=20261104-no-render3", "current media preview ownership cache version")
require(actionbar, "whatsapp-production-loader.js?v=20261105-history-scope8", "current production loader media ownership cache version")
require(realtime, "actionbar-context-ui.js?v=20261105-history-scope8", "current actionbar media ownership cache version")
require(taurus_next, "crm.html?nextboot=20261104-clean2", "current Taurus Next clean boot version")
require(taurus_next, "supabase-realtime.js?v=20261104-next-clean2", "current Taurus Next realtime root version")

require(wa_media, "async function renderLeadMedia(leadId){return;}", "legacy media conversation renderer disabled")
forbid(wa_media, "mensagem(ns) registradas", "legacy media conversation copy removed")
require(wa_loader, "crm-whatsapp-history-range.js?v=20261104-render-owner9", "history renderer cache version pinned with media fix")
require(wa_loader, "crm-whatsapp-media-preview.js?v=20261104-no-render3", "media preview no-render cache version")
# no-media-render guard active

require(wa_history, "HISTORY_ALL_FROM", "global WhatsApp history uses independent full-range bounds")
require(wa_history, "p_limit:10000", "global WhatsApp history event limit expanded")
require(wa_history, "p_limit:5000", "lead WhatsApp history message limit expanded")
require(wa_history, "Histórico completo disponível", "lead WhatsApp history no longer labels follow-up date range")
forbid(wa_history, "ev.filter(x=>{const a=new Date(x.at);return a>=from&&a<=to}", "lead WhatsApp history must not inherit follow-up calendar")
# full-history guard active

require(wa_history, ".tm-wa-wa-conversations{overflow-y:auto", "conversation list has independent vertical scroll")
require(wa_history, ".tm-wa-wa-chat-body{flex:1;min-height:0;overflow-y:auto", "chat body has independent vertical scroll")
require(wa_history, "IntersectionObserver", "visible WhatsApp media auto-hydration enabled")
require(wa_history, "rootMargin:'320px 0px'", "media preloads shortly before entering viewport")
require(wa_loader, "crm-whatsapp-history-range.js?v=20261104-scroll-media11", "history scroll/media cache version")

require(regression_core, "20261104-scroll-media11", "runtime regression cache check matches current WhatsApp history asset")
require(regression_core, "2026-11-04.10", "runtime regression core version bumped for current history cache contract")

require(regression_core, "executive-scope-isolated", "Anti-Regressao audits executive data isolation")
require(regression_core, "executive_scope_audit", "Anti-Regressao calls live executive scope audit RPC")
require(regression_core, "2026-11-05.2", "Anti-Regressao version includes executive scope security audit")

require(wa_history, "currentHistoryScope", "WhatsApp history reads the global CRM scope")
require(wa_history, "scope.ids?rawEv.filter", "WhatsApp history filters events by visible lead ids")
require(wa_history, "visão: ", "WhatsApp history identifies the active global view")
require(scope_privacy, "me.role==='admin'||me.role==='gerente'", "global scope selector is available to admin and manager")
require(scope_privacy, "tm-scope-manager", "scope privacy gate preserves manager/admin selector")
require(wa_loader, "crm-whatsapp-history-range.js?v=20261105-global-scope12", "current scoped history cache version")
require(actionbar, "whatsapp-production-loader.js?v=20261105-history-scope8", "current scoped WhatsApp loader cache version")
require(realtime, "scope-privacy-ui.js?v=20261105-manager-scope1", "current manager scope privacy cache version")
require(taurus_next, "crm.html?nextboot=20261105-scope1", "current Taurus Next scope boot version")

require(crm_html, "if(window.CRM_SCOPE){", "Follow-up disables legacy owner filter when global CRM scope is active")
require(crm_html, "var fr=window.CRM_SCOPE ? ''", "Follow-up does not combine global and legacy owner filters")
require(regression_core, "20261105-global-scope12", "Anti-Regressao expects current scoped WhatsApp history asset")
require(regression_core, "2026-11-05.2", "Anti-Regressao version includes scoped history and owner filter fixes")
require(taurus_next, "crm.html?nextboot=20261105-scope2", "Taurus Next boot includes Follow-up single-scope fix")
