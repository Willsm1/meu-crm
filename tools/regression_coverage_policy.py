#!/usr/bin/env python3
import os, subprocess, sys, fnmatch

EVENT=os.getenv("GITHUB_EVENT_NAME","")
BASE=os.getenv("GITHUB_BASE_SHA","").strip()

if EVENT!="pull_request":
    print("REGRESSION_COVERAGE_POLICY: skipped outside pull_request")
    sys.exit(0)

if not BASE:
    print("REGRESSION_COVERAGE_POLICY: missing GITHUB_BASE_SHA")
    sys.exit(1)

out=subprocess.check_output(["git","diff","--name-only",BASE+"...HEAD"],text=True)
changed=[x.strip() for x in out.splitlines() if x.strip()]

protected_patterns=[
    "crm*.html","index.html","taurus-next.html",
    "crm-*.js","whatsapp-*.js","supabase-realtime.js","actionbar-context-ui.js",
    "services/whatsapp-gateway/*.mjs","services/whatsapp-gateway/*.js",
]
regression_patterns=[
    "taurus-regression-core.js","taurus-regression-panel.js",
    "tools/regression_guard.py","tools/regression_coverage_policy.py",
    "tools/*test*.py","tools/*test*.js","tools/*harness*.html",
    "services/whatsapp-gateway/test/**","services/whatsapp-gateway/tests/**",
    ".github/workflows/regression-guard.yml",
]

def matches(path,patterns):
    return any(fnmatch.fnmatch(path,p) for p in patterns)

protected=[p for p in changed if matches(p,protected_patterns) and not matches(p,regression_patterns)]
coverage=[p for p in changed if matches(p,regression_patterns)]

if protected and not coverage:
    print("REGRESSION_COVERAGE_POLICY: FAIL")
    print("Arquivos críticos alterados sem atualização de proteção anti-regressão:")
    for p in protected: print(" -",p)
    print("Inclua/atualize pelo menos um teste, harness ou invariante de regressão no mesmo PR.")
    sys.exit(1)

print("REGRESSION_COVERAGE_POLICY: PASS")
if protected:
    print("Críticos:",", ".join(protected))
    print("Cobertura:",", ".join(coverage))
else:
    print("Nenhum arquivo crítico alterado.")
