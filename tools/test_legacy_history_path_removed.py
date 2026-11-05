#!/usr/bin/env python3
from pathlib import Path
s=Path("crm-whatsapp-followup-visual.js").read_text(encoding="utf-8")
assert "openModal('Eventos WhatsApp'" not in s, "legacy Eventos WhatsApp modal path returned"
assert "function openEvents(){if(typeof window.TM_WA_HISTORY_OPEN==='function')return window.TM_WA_HISTORY_OPEN();}" in s, "openEvents must delegate to new history"
assert "existing&&existing.querySelector('.tm-wa-wa-shell')" in s, "legacy modal must not replace new history shell"
print("LEGACY_HISTORY_PATH_GUARD: PASS")
