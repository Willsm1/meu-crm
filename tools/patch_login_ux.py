from pathlib import Path

p=Path('crm.html')
s=p.read_text(encoding='utf-8')

# 1) Title/subtitle cleanup
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

# 2) Browser credential manager semantics
old_email='id=\\"tm-auth-email\\" type=\\"email\\" autocomplete=\\"off\\" name=\\"tm-login-email\\"'
new_email='id=\\"tm-auth-email\\" type=\\"email\\" autocomplete=\\"username\\" name=\\"username\\" autocapitalize=\\"none\\" spellcheck=\\"false\\"'
if old_email not in s:
    raise SystemExit('email attrs not found')
s=s.replace(old_email,new_email,1)

old_pass='id=\\"tm-auth-pass\\" type=\\"password\\" autocomplete=\\"new-password\\" name=\\"tm-login-pass\\"'
new_pass='id=\\"tm-auth-pass\\" type=\\"password\\" autocomplete=\\"current-password\\" name=\\"password\\"'
if old_pass not in s:
    raise SystemExit('password attrs not found')
s=s.replace(old_pass,new_pass,1)

# 3) Inject password visibility button dynamically, preserving existing markup/layout
anchor="""  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
inject="""  (function(){
    var p=document.getElementById('tm-auth-pass');
    if(!p || document.getElementById('tm-auth-eye')) return;
    var wrap=document.createElement('div');
    wrap.style.position='relative';
    wrap.style.marginBottom='12px';
    p.parentNode.insertBefore(wrap,p);
    wrap.appendChild(p);
    p.style.marginBottom='0';
    p.style.paddingRight='38px';
    var eye=document.createElement('button');
    eye.id='tm-auth-eye'; eye.type='button'; eye.setAttribute('aria-label','Mostrar senha'); eye.title='Mostrar senha';
    eye.innerHTML='&#128065;';
    eye.style.cssText='position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#94a3b8;cursor:pointer;padding:4px;font-size:15px;line-height:1';
    eye.addEventListener('click',function(){
      var show=p.type==='password'; p.type=show?'text':'password';
      eye.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
      eye.title=show?'Ocultar senha':'Mostrar senha';
    });
    wrap.appendChild(eye);
  })();

  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
if anchor not in s:
    raise SystemExit('login listener anchor not found')
s=s.replace(anchor,inject,1)

# 4) Enter on password uses existing login button
marker="""  document.getElementById('tm-auth-entrar').addEventListener('click', function(){
"""
# add keydown listener immediately before the login handler we just inserted
keydown="""  var passInput=document.getElementById('tm-auth-pass');
  if(passInput) passInput.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'){ ev.preventDefault(); var b=document.getElementById('tm-auth-entrar'); if(b) b.click(); }
  });

"""
pos=s.find(marker)
if pos<0:
    raise SystemExit('post-injection login handler not found')
s=s[:pos]+keydown+s[pos:]

# invariants
checks=['Acesso ao CRM','Taurus Magnum CRM','autocomplete=\\"username\\"','autocomplete=\\"current-password\\"','tm-auth-eye','Ocultar senha']
for c in checks:
    if c not in s: raise SystemExit('missing '+c)
if 'smoke test V1.3' in s: raise SystemExit('legacy smoke-test title still present')
if 'autocomplete=\\"off\\" name=\\"tm-login-email\\"' in s: raise SystemExit('email autocomplete still off')
if 'autocomplete=\\"new-password\\" name=\\"tm-login-pass\\"' in s: raise SystemExit('password still marked new-password')

p.write_text(s,encoding='utf-8')
print('LOGIN_UX_PATCH_OK')
