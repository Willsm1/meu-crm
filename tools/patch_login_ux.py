from pathlib import Path

p=Path('crm.html')
s=p.read_text(encoding='utf-8')

# title/subtitle cleanup
old="""    + '<div style=\"font-size:13px;font-weight:600;color:#60a5fa;margin-bottom:3px\">Supabase Auth</div>'
    + '<div style=\"font-size:10.5px;color:#4b5e78;margin-bottom:16px\">'
    + 'smoke test V1.3 &middot; o CRM continua usando os dados locais</div>'
"""
new="""    + '<div style=\"font-size:18px;font-weight:700;color:#60a5fa;margin-bottom:4px\">Acesso ao CRM</div>'
    + '<div style=\"font-size:11px;color:#4b5e78;margin-bottom:16px\">Taurus Magnum CRM</div>'
"""
if old not in s:
    raise SystemExit('title block not found')
s=s.replace(old,new,1)

# enable Chrome credential suggestions from the email field
s=s.replace('id=\\"tm-auth-email\\" type=\\"email\\" autocomplete=\\"off\\" name=\\"tm-login-email\\"',
            'id=\\"tm-auth-email\\" type=\\"email\\" autocomplete=\\"username\\" name=\\"username\\" autocapitalize=\\"none\\" spellcheck=\\"false\\"',1)
s=s.replace('id=\\"tm-auth-pass\\" type=\\"password\\" autocomplete=\\"new-password\\" name=\\"tm-login-pass\\"',
            'id=\\"tm-auth-pass\\" type=\\"password\\" autocomplete=\\"current-password\\" name=\\"password\\"',1)

# password eye: add relative wrapper and preserve exact visual sizing
oldpass="""    +   '<input id=\"tm-auth-pass\" type=\"password\" autocomplete=\"current-password\" name=\"password\" '
    +   'style=\"width:100%;box-sizing:border-box;background:#080f1e;border:.5px solid rgba(59,130,246,.3);'
    +   'border-radius:7px;color:#e2e8f0;font-size:12px;padding:8px 10px;outline:none;margin-bottom:12px\">'
"""
newpass="""    +   '<div style=\"position:relative;margin-bottom:12px\">'
    +   '<input id=\"tm-auth-pass\" type=\"password\" autocomplete=\"current-password\" name=\"password\" '
    +   'style=\"width:100%;box-sizing:border-box;background:#080f1e;border:.5px solid rgba(59,130,246,.3);'
    +   'border-radius:7px;color:#e2e8f0;font-size:12px;padding:8px 38px 8px 10px;outline:none;margin:0\">'
    +   '<button id=\"tm-auth-eye\" type=\"button\" aria-label=\"Mostrar senha\" title=\"Mostrar senha\" '
    +   'style=\"position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#94a3b8;cursor:pointer;padding:4px;font-size:15px;line-height:1\">&#128065;</button>'
    +   '</div>'
"""
if oldpass not in s:
    raise SystemExit('password block not found')
s=s.replace(oldpass,newpass,1)

# add eye behavior before login button handler
anchor="""  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
insert="""  var eye=document.getElementById('tm-auth-eye');
  if(eye) eye.addEventListener('click', function(){
    var p=document.getElementById('tm-auth-pass'); if(!p) return;
    var show=p.type==='password'; p.type=show?'text':'password';
    eye.setAttribute('aria-label', show?'Ocultar senha':'Mostrar senha');
    eye.setAttribute('title', show?'Ocultar senha':'Mostrar senha');
  });

  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
if anchor not in s:
    raise SystemExit('login listener anchor not found')
s=s.replace(anchor,insert,1)

# login form autofill semantics: Enter in password submits through existing button
anchor2="""  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
# no second replace needed; validate marker exists once after insertion

# invariants
checks=[
    'Acesso ao CRM', 'Taurus Magnum CRM', 'autocomplete=\\"username\\"',
    'autocomplete=\\"current-password\\"', 'tm-auth-eye', 'Ocultar senha'
]
for c in checks:
    if c not in s: raise SystemExit('missing '+c)
if 'smoke test V1.3' in s: raise SystemExit('legacy smoke-test title still present')
if 'autocomplete=\\"off\\" name=\\"tm-login-email\\"' in s: raise SystemExit('email autocomplete still off')

p.write_text(s,encoding='utf-8')
print('LOGIN_UX_PATCH_OK')
