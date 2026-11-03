from pathlib import Path

p = Path(__file__).resolve().parents[1] / "tools" / "regression_guard.py"
text = p.read_text(encoding="utf-8")

hardening = text.find("# WhatsApp gateway behavioral hardening invariants")
gate = text.find("if errors:")

if hardening < 0:
    raise SystemExit("FAIL: hardening section missing")
if gate < 0:
    raise SystemExit("FAIL: final error gate missing")
if hardening > gate:
    raise SystemExit("FAIL: gateway hardening invariants execute after final error gate")

print("REGRESSION GUARD LAYOUT: PASS")
