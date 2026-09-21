#!/usr/bin/env python3
import hashlib, json, pathlib, sys, zipfile, tempfile, subprocess

BASELINE_SHA='3d5399f21e509c1fe584f02f54bb4718dfff3da36e5789d913808a2e1ad5eb85'
TARGET_SHA='d90f1015036a14d92bb5dd5824a05d18885883b3fd67a02a7297a5208174bb52'
ALLOWED_CHANGED={'content.js','supabase.js','manifest.json'}
EXPECTED_FILES={'bridge.js','icon16.png','crm.js','icon128.png','icon48.png','index.html','panel.css','content.js','popup.js','supabase.js','manifest.json','popup.html','PILOTO-2.0.12.txt'}
JS_FILES={'bridge.js','crm.js','content.js','popup.js','supabase.js'}

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):
            h.update(b)
    return h.hexdigest()

def extract(z,p):
    with zipfile.ZipFile(z) as x:
        x.extractall(p)

def fail(msg):
    print('FAIL:',msg)
    sys.exit(1)

def main():
    if len(sys.argv)!=3:
        fail('uso: extension_regression_guard.py baseline-2.0.13.zip target-2.0.14.zip')
    base,target=map(pathlib.Path,sys.argv[1:])
    if sha(base)!=BASELINE_SHA:
        fail('baseline 2.0.13 não é o pacote congelado esperado')
    if sha(target)!=TARGET_SHA:
        fail('pacote 2.0.14 não corresponde ao artefato validado')
    with tempfile.TemporaryDirectory() as td:
        b=pathlib.Path(td)/'b'; t=pathlib.Path(td)/'t'
        b.mkdir(); t.mkdir(); extract(base,b); extract(target,t)
        bf={p.name for p in b.iterdir() if p.is_file()}
        tf={p.name for p in t.iterdir() if p.is_file()}
        if bf!=EXPECTED_FILES or tf!=EXPECTED_FILES:
            fail(f'conjunto de arquivos mudou baseline={sorted(bf^EXPECTED_FILES)} target={sorted(tf^EXPECTED_FILES)}')
        changed={f for f in EXPECTED_FILES if sha(b/f)!=sha(t/f)}
        if changed!=ALLOWED_CHANGED:
            fail(f'arquivos alterados fora do escopo: {sorted(changed)}')
        manifest=json.loads((t/'manifest.json').read_text())
        if manifest.get('version')!='2.0.14':
            fail('versão do manifest não é 2.0.14')
        content=(t/'content.js').read_text()
        supabase=(t/'supabase.js').read_text()
        for x in ['function registerCall(lead,result)','registrarLigacao','syncStatus','eventId']:
            if x not in content:
                fail(f'contrato ausente em content.js: {x}')
        for x in ['function registrarLigacao(','/rest/v1/rpc/record_call_at','p_client_event_id','p_occurred_at']:
            if x not in supabase:
                fail(f'contrato ausente em supabase.js: {x}')
        for f in JS_FILES:
            r=subprocess.run(['node','--check',str(t/f)],capture_output=True,text=True)
            if r.returncode:
                fail(f'erro de sintaxe em {f}: {r.stderr.strip()}')
    print(json.dumps({'ok':True,'baseline_sha256':BASELINE_SHA,'target_sha256':TARGET_SHA,'changed_files':sorted(ALLOWED_CHANGED)},ensure_ascii=False))

if __name__=='__main__':
    main()
