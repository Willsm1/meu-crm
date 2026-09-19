from pathlib import Path
p=Path('crm.html')
s=p.read_text(encoding='utf-8')
orig=s

# LOGIN: clean title/subtitle
s=s.replace('>Supabase Auth</div>', '>Acesso ao CRM</div>', 1)
s=s.replace('smoke test V1.3 &middot; o CRM continua usando os dados locais</div>', 'Taurus Magnum CRM</div>', 1)

# LOGIN: browser credential autofill semantics
s=s.replace('id="tm-auth-email" type="email" autocomplete="off" name="tm-login-email"',
            'id="tm-auth-email" type="email" autocomplete="username" name="username" autocapitalize="none" spellcheck="false"',1)
s=s.replace('id="tm-auth-pass" type="password" autocomplete="new-password" name="tm-login-pass"',
            'id="tm-auth-pass" type="password" autocomplete="current-password" name="password"',1)

# LOGIN: add eye button with minimal DOM manipulation after the modal exists
anchor="  document.getElementById('tm-auth-entrar').addEventListener('click', function(){"
if anchor not in s:
    raise SystemExit('login anchor not found')
eye="""  (function(){
    var p=document.getElementById('tm-auth-pass');
    if(!p || document.getElementById('tm-auth-eye')) return;
    var b=document.createElement('button');
    b.id='tm-auth-eye'; b.type='button'; b.textContent='👁';
    b.setAttribute('aria-label','Mostrar senha'); b.title='Mostrar senha';
    b.style.cssText='margin-left:-34px;margin-right:8px;background:none;border:0;color:#94a3b8;cursor:pointer;font-size:15px;vertical-align:middle;position:relative;z-index:2';
    p.style.paddingRight='38px';
    p.insertAdjacentElement('afterend',b);
    b.addEventListener('click',function(){
      var show=p.type==='password'; p.type=show?'text':'password';
      b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
      b.title=show?'Ocultar senha':'Mostrar senha';
    });
  })();

"""
s=s.replace(anchor,eye+anchor,1)

# FOLLOW-UP: priority order and chip
s=s.replace("var _PESO={vencido:0, hoje:1, sem_contato:2, parado:3, em_dia:4};",
            "var _PESO={vencido:0, hoje:1, agendado:2, parado:3, em_dia:4, sem_contato:5};",1)
s=s.replace("hoje:['#fcd34d','rgba(252,211,77,.15)','Hoje'],\n         sem_contato:",
            "hoje:['#fcd34d','rgba(252,211,77,.15)','Hoje'],\n         agendado:['#93c5fd','rgba(59,130,246,.15)','Agendado'],\n         sem_contato:",1)

# FOLLOW-UP: priority filter
s=s.replace('<option value="hoje">Para hoje</option>\n        <option value="sem_contato">Sem contato</option>',
            '<option value="hoje">Para hoje</option>\n        <option value="agendado">Agendados</option>\n        <option value="sem_contato">Sem registro</option>',1)

# FOLLOW-UP: rename final action header
s=s.replace('>AÇÃO</th>', '>RETOMAR EM</th>', 1)

# FOLLOW-UP: countdown next-contact helper in existing Próximo column
old="""      + '<td style="font-size:12px">'+_dt(x.proximo_contato)
        + (x.dias_vencido>0?'<div style="font-size:10px;color:#fca5a5">'+x.dias_vencido+'d atras</div>':'')+'</td>'
"""
new="""      + '<td style="font-size:12px">'+_dt(x.proximo_contato)
        + (x.dias_vencido>0?'<div style="font-size:10px;color:#fca5a5">Vencido há '+x.dias_vencido+'d</div>':(x.dias_vencido===0?'<div style="font-size:10px;color:#fcd34d">Hoje</div>':(x.dias_vencido<0?'<div style="font-size:10px;color:#93c5fd">Faltam '+Math.abs(x.dias_vencido)+'d</div>':'')))+'</td>'
"""
if old not in s:
    raise SystemExit('next contact cell not found')
s=s.replace(old,new,1)

# validations
checks=['Acesso ao CRM','Taurus Magnum CRM','autocomplete="username"','autocomplete="current-password"','tm-auth-eye','agendado','Agendado','RETOMAR EM','Faltam ']
for c in checks:
    if c not in s: raise SystemExit('missing '+c)
if 'smoke test V1.3' in s: raise SystemExit('legacy smoke title remains')
if s==orig: raise SystemExit('no changes')
p.write_text(s,encoding='utf-8')
print('PATCH_OK')
