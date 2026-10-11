/* =========================================================
   🔥 CONFIGURAÇÃO DO FIREBASE
   Substitua o objeto abaixo pelo seu (pego no console Firebase)
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCQ9-Hqu0HPc-5OrZ0mNSkxRkWYDRgQVK8",
  authDomain: "barbearia-bde16.firebaseapp.com",
  databaseURL: "https://barbearia-bde16-default-rtdb.firebaseio.com",
  projectId: "barbearia-bde16",
  storageBucket: "barbearia-bde16.firebasestorage.app",
  messagingSenderId: "68576699591",
  appId: "1:68576699591:web:e76812d7a8bee5c61ecae2"
};

/* =========================================================
   IMPORTS DO FIREBASE (via CDN)
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* =========================================================
   DADOS PADRÃO
   ========================================================= */
const STORAGE_KEY = 'barbearia_data_v1';

function gerarHorarios(inicio, fim, passo){
  const out = [];
  const [h1,m1] = inicio.split(':').map(Number);
  const [h2,m2] = fim.split(':').map(Number);
  let t = h1*60+m1; const end = h2*60+m2;
  while(t < end){
    out.push(String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0'));
    t += passo;
  }
  return out;
}

const DEFAULT_DATA = {
  config: {
    nome: 'Barbearia Imperial',
    slogan: 'Tradição, estilo e navalha na régua. Seu visual em boas mãos.',
    senha: '1234',
    whatsapp: '5511999999999',
    endereco: 'Rua das Tesouras, 123 — Centro',
    horarioTexto: 'Seg a Sex • 09h às 19h'
  },
  servicos: [
    { id:'s1', nome:'Corte Masculino', preco:35, descricao:'Máquina, tesoura e finalização com pomada.', duracao:30 },
    { id:'s2', nome:'Barba', preco:25, descricao:'Toalha quente, navalha e óleo hidratante.', duracao:20 },
    { id:'s3', nome:'Barba + Cabelo', preco:45, descricao:'Combo completo: corte + barba na navalha.', duracao:50 },
    { id:'s4', nome:'Degradê / Fade', preco:40, descricao:'Degradê na régua com acabamento na navalha.', duracao:40 },
    { id:'s5', nome:'Corte Infantil', preco:30, descricao:'Atendimento com paciência para os pequenos.', duracao:30 },
    { id:'s6', nome:'Sobrancelha', preco:15, descricao:'Design de sobrancelha na navalha.', duracao:15 }
  ],
  agenda: {
    diasSemana: [false, true, true, true, true, true, false],
    bloqueados: [],
    liberados: [],
    horarios: gerarHorarios('09:00','19:00',30)
  },
  pedidos: []
};

/* =========================================================
   ESTADO
   ========================================================= */
let DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
let adminAuthed = sessionStorage.getItem('barber_admin') === '1';
let adminTab = 'pedidos';
let calRef = new Date();
let selDate = null, selHora = null, selServicoId = null;
let editServicoId = null;
let firebaseReady = false;
let saveTimer = null;

/* =========================================================
   FALLBACK: localStorage (usado só se Firebase não estiver configurado)
   ========================================================= */
function loadLocal(){
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){}
  return d;
}
function saveLocal(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); } catch(e){}
}
function mergeDefaults(d){
  d = d || {};
  return {
    config:   Object.assign({}, DEFAULT_DATA.config, d.config || {}),
    servicos: Array.isArray(d.servicos) ? d.servicos : JSON.parse(JSON.stringify(DEFAULT_DATA.servicos)),
    agenda:   Object.assign({}, DEFAULT_DATA.agenda, d.agenda || {}),
    pedidos:  Array.isArray(d.pedidos) ? d.pedidos : []
  };
}

/* =========================================================
   FIREBASE — conexão em tempo real
   ========================================================= */
function initFirebase(){
  const cfgOk = firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes('SEU_PROJETO');
  if(!cfgOk){
    console.warn('⚠️ Firebase não configurado. Usando localStorage (não sincroniza entre usuários).');
    const local = loadLocal();
    if(local) DATA = mergeDefaults(local);
    setSyncStatus('Local (sem sync)', true);
    renderTudo();
    return;
  }

  try{
    const app = initializeApp(firebaseConfig);
    const db  = getDatabase(app);
    const dataRef = ref(db, 'barbearia');

    setSyncStatus('☁️ Conectando...', false);

    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if(val){
        DATA = mergeDefaults(val);
        firebaseReady = true;
        setSyncStatus('☁️ Sincronizado', false);
      } else {
        // Primeira vez: envia os dados padrão
        set(dataRef, DEFAULT_DATA).then(() => {
          firebaseReady = true;
          setSyncStatus('☁️ Sincronizado', false);
        });
      }
      renderTudo();
      // guarda cópia local também (rápido)
      saveLocal();
    }, (err) => {
      console.error('Erro no Firebase:', err);
      setSyncStatus('Erro de conexão', true);
      const local = loadLocal();
      if(local) DATA = mergeDefaults(local);
      renderTudo();
    });

  } catch(e){
    console.error('Falha ao inicializar Firebase:', e);
    setSyncStatus('Erro Firebase', true);
    const local = loadLocal();
    if(local) DATA = mergeDefaults(local);
    renderTudo();
  }
}

function saveData(){
  // Atualiza local imediatamente (feedback rápido)
  saveLocal();

  if(!firebaseReady){
    return; // sem Firebase, só local
  }

  // debounce para não spammar o Firebase
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try{
      const app = initializeApp(firebaseConfig);
      const db  = getDatabase(app);
      set(ref(db, 'barbearia'), DATA)
        .then(() => setSyncStatus('☁️ Salvo', false))
        .catch(err => {
          console.error('Erro ao salvar no Firebase:', err);
          setSyncStatus('Erro ao salvar', true);
          toast('Não foi possível sincronizar. Verifique a conexão.', 'err');
        });
    }catch(e){
      console.error(e);
    }
  }, 250);
}

function setSyncStatus(txt, erro){
  const el = document.getElementById('syncStatus');
  if(!el) return;
  el.textContent = txt;
  el.classList.toggle('err', !!erro);
  el.classList.add('show');
  clearTimeout(el._tm);
  el._tm = setTimeout(() => el.classList.remove('show'), 2500);
}

/* =========================================================
   HELPERS
   ========================================================= */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function ymd(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtData(ds){
  if(!ds) return '—';
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' });
}
function toast(msg, tipo){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = tipo || '';
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2800);
}
function waLink(tel, msg){
  let n = String(tel).replace(/\D/g,'');
  if(n.length <= 11) n = '55' + n;
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
}
function msgWA(p){
  const cfg = DATA.config;
  if(p.status === 'confirmado'){
    return `Olá ${p.nome}! Seu agendamento na ${cfg.nome} está *CONFIRMADO* ✅\n\n` +
           `✂️ Serviço: ${p.servicoNome}\n📅 Data: ${fmtData(p.data)}\n🕐 Horário: ${p.hora}\n` +
           `💰 Valor: R$ ${Number(p.preco).toFixed(2).replace('.',',')}\n\n` +
           `📍 ${cfg.endereco}\n\nAté lá!`;
  }
  if(p.status === 'cancelado'){
    return `Olá ${p.nome}, infelizmente não vamos conseguir te atender em ${fmtData(p.data)} às ${p.hora}. ` +
           `Podemos marcar em outro dia/horário? — ${cfg.nome}`;
  }
  return `Olá ${p.nome}! Recebemos seu pedido de agendamento na ${cfg.nome}.\n\n` +
         `✂️ Serviço: ${p.servicoNome}\n📅 Data: ${fmtData(p.data)}\n🕐 Horário: ${p.hora}\n\n` +
         `Já vou verificar a disponibilidade e te confirmo!`;
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */
function go(v){
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('view-' + v);
  if(el) el.classList.add('active');
  window.scrollTo({ top:0, behavior:'smooth' });

  if(v === 'servicos') renderServicos();
  if(v === 'agendar')  renderAgendar();
  if(v === 'admin')    renderAdmin();
}

/* =========================================================
   RENDER GERAL
   ========================================================= */
function renderTudo(){
  const c = DATA.config;
  document.getElementById('brandName').textContent  = c.nome;
  document.getElementById('heroNome').textContent   = c.nome;
  document.getElementById('heroSlogan').textContent = c.slogan;
  document.getElementById('footerNome').textContent = c.nome;
  document.getElementById('footerEnd').textContent  = c.endereco;
  document.getElementById('heroInfo').innerHTML =
    `<span>📍 ${esc(c.endereco)}</span><span>🕐 ${esc(c.horarioTexto)}</span>`;
  document.title = c.nome + ' — Agendamento';

  renderServicos();
  renderAgendar();
  renderAdmin();
}

/* =========================================================
   SERVIÇOS
   ========================================================= */
function renderServicos(){
  const g = document.getElementById('servicosGrid');
  if(!g) return;
  if(!DATA.servicos.length){
    g.innerHTML = '<p class="muted">Nenhum serviço cadastrado ainda.</p>';
    return;
  }
  g.innerHTML = DATA.servicos.map(s => `
    <div class="servico">
      <div class="servico-top">
        <div class="servico-nome">${esc(s.nome)}</div>
        <div class="servico-preco">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</div>
      </div>
      <p class="servico-desc">${esc(s.descricao || '')}</p>
      ${s.duracao ? `<div class="servico-dur">⏱️ Duração média: ${esc(s.duracao)} min</div>` : ''}
    </div>
  `).join('');
}

/* =========================================================
   AGENDAMENTO
   ========================================================= */
function renderAgendar(){
  const sel = document.getElementById('selServico');
  if(!sel) return;

  const anterior = selServicoId || sel.value;
  sel.innerHTML = '<option value="">Selecione um serviço...</option>' +
    DATA.servicos.map(s =>
      `<option value="${s.id}">${esc(s.nome)} — R$ ${Number(s.preco).toFixed(2).replace('.',',')}</option>`
    ).join('');

  if(anterior && DATA.servicos.some(s => s.id === anterior)){
    sel.value = anterior;
    selServicoId = anterior;
  } else {
    selServicoId = null;
  }
  onServicoChange(false);
  renderCal();
  renderHorarios();
  renderResumo();
}

function onServicoChange(atualizarResumo = true){
  const sel = document.getElementById('selServico');
  selServicoId = sel.value || null;
  const det = document.getElementById('servicoDetalhe');
  const s = DATA.servicos.find(x => x.id === selServicoId);
  det.textContent = s ? (s.descricao || '') + (s.duracao ? ` • ⏱️ ${s.duracao} min` : '') : '';
  if(atualizarResumo) renderResumo();
}

function diaDisponivel(dateStr, dow){
  const ag = DATA.agenda;
  if(ag.bloqueados.includes(dateStr)) return false;
  if(ag.liberados.includes(dateStr))  return true;
  return !!ag.diasSemana[dow];
}

function mudarMes(delta){
  calRef = new Date(calRef.getFullYear(), calRef.getMonth() + delta, 1);
  renderCal();
}

function renderCal(){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  const y = calRef.getFullYear(), m = calRef.getMonth();

  document.getElementById('calMes').textContent =
    new Date(y, m, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });

  grid.innerHTML = '';
  const dowFirst = new Date(y, m, 1).getDay();
  const total    = new Date(y, m+1, 0).getDate();

  for(let i = 0; i < dowFirst; i++){
    const e = document.createElement('div');
    e.className = 'cal-cell empty';
    grid.appendChild(e);
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0);

  for(let d = 1; d <= total; d++){
    const date = new Date(y, m, d);
    const ds   = ymd(date);
    const dow  = date.getDay();
    const past = date < hoje;
    const avail = !past && diaDisponivel(ds, dow);

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-cell ' + (avail ? 'avail' : 'off');
    if(ds === ymd(hoje)) b.classList.add('hoje');
    if(ds === selDate)   b.classList.add('sel');
    b.textContent = d;
    b.disabled = !avail;
    if(avail) b.onclick = () => {
      selDate = ds; selHora = null;
      renderCal(); renderHorarios(); renderResumo();
    };
    grid.appendChild(b);
  }
}

function renderHorarios(){
  const wrap = document.getElementById('horariosChips');
  if(!wrap) return;
  wrap.innerHTML = '';

  if(!selDate){
    wrap.innerHTML = '<p class="muted small">Escolha um dia no calendário primeiro.</p>';
    return;
  }
  const slots = DATA.agenda.horarios || [];
  if(!slots.length){
    wrap.innerHTML = '<p class="muted small">Nenhum horário cadastrado.</p>';
    return;
  }
  const ocupados = DATA.pedidos
    .filter(p => p.data === selDate && p.status !== 'cancelado')
    .map(p => p.hora);

  slots.forEach(h => {
    const busy = ocupados.includes(h);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (busy ? ' busy' : '') + (h === selHora ? ' sel' : '');
    b.textContent = h;
    b.disabled = busy;
    if(!busy) b.onclick = () => { selHora = h; renderHorarios(); renderResumo(); };
    wrap.appendChild(b);
  });
}

function renderResumo(){
  const box = document.getElementById('resumoBox');
  if(!box) return;
  const s = DATA.servicos.find(x => x.id === selServicoId);
  box.innerHTML = `
    <div class="resumo-linha"><span>Serviço</span><span>${s ? esc(s.nome) : '—'}</span></div>
    <div class="resumo-linha"><span>Dia</span><span>${selDate ? fmtData(selDate) : '—'}</span></div>
    <div class="resumo-linha"><span>Horário</span><span>${selHora || '—'}</span></div>
    <div class="resumo-linha resumo-total">
      <span>Total</span>
      <span>${s ? 'R$ ' + Number(s.preco).toFixed(2).replace('.',',') : 'R$ 0,00'}</span>
    </div>`;
}

function enviarPedido(){
  const nome = document.getElementById('inpNome').value.trim();
  const tel  = document.getElementById('inpTel').value.trim();
  const s    = DATA.servicos.find(x => x.id === selServicoId);

  if(!s)             return toast('Escolha um serviço.', 'err');
  if(!selDate)       return toast('Escolha um dia no calendário.', 'err');
  if(!selHora)       return toast('Escolha um horário.', 'err');
  if(nome.length < 2)return toast('Digite seu nome.', 'err');
  if(tel.replace(/\D/g,'').length < 10) return toast('Digite um telefone válido com DDD.', 'err');

  const ocupado = DATA.pedidos.some(p =>
    p.data === selDate && p.hora === selHora && p.status !== 'cancelado');
  if(ocupado){
    toast('Esse horário acabou de ser ocupado. Escolha outro.', 'err');
    selHora = null; renderHorarios(); renderResumo();
    return;
  }

  DATA.pedidos.push({
    id: 'p' + Date.now() + Math.floor(Math.random()*1000),
    nome, telefone: tel,
    servicoId: s.id, servicoNome: s.nome, preco: s.preco,
    data: selDate, hora: selHora,
    status: 'pendente',
    criadoEm: new Date().toISOString()
  });
  saveData();

  const aside = document.querySelector('.agendar-grid');
  aside.innerHTML = `
    <div class="card" style="grid-column:1/-1">
      <div class="sucesso">
        <div class="ico">✓</div>
        <h3>Pedido enviado!</h3>
        <p>
          <b>${esc(nome)}</b>, seu pedido para <b>${esc(s.nome)}</b><br>
          em <b>${fmtData(selDate)}</b> às <b>${selHora}</b> foi registrado.<br><br>
          O barbeiro vai te chamar no WhatsApp <b>${esc(tel)}</b> para confirmar.
        </p>
        <button class="btn btn-ghost" style="margin-top:26px" onclick="location.reload()">
          Voltar ao início
        </button>
      </div>
    </div>`;
  renderAdmin();
}

/* =========================================================
   ADMIN — LOGIN
   ========================================================= */
function login(){
  const v = document.getElementById('inpSenha').value;
  if(v === DATA.config.senha){
    adminAuthed = true;
    sessionStorage.setItem('barber_admin','1');
    document.getElementById('inpSenha').value = '';
    renderAdmin();
    toast('Bem-vindo, chefe! 💈', 'ok');
  } else {
    toast('Senha incorreta.', 'err');
  }
}
function logout(){
  adminAuthed = false;
  sessionStorage.removeItem('barber_admin');
  renderAdmin();
  toast('Sessão encerrada.');
}
function setTab(t){
  adminTab = t;
  renderAdmin();
}

/* =========================================================
   ADMIN — RENDER
   ========================================================= */
function renderAdmin(){
  const loginEl = document.getElementById('adminLogin');
  const panel   = document.getElementById('adminPanel');
  if(!loginEl || !panel) return;

  if(!adminAuthed){
    loginEl.style.display = '';
    panel.style.display = 'none';
    return;
  }
  loginEl.style.display = 'none';
  panel.style.display = '';

  document.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === adminTab);
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const active = document.getElementById('tab-' + adminTab);
  if(active) active.classList.add('active');

  const pend = DATA.pedidos.filter(p => p.status === 'pendente').length;
  const badge = document.getElementById('badgePedidos');
  badge.textContent = pend;
  badge.style.display = pend ? '' : 'none';

  if(adminTab === 'pedidos')  renderAdminPedidos();
  if(adminTab === 'servicos') renderAdminServicos();
  if(adminTab === 'agenda')   renderAdminAgenda();
  if(adminTab === 'config')   renderAdminConfig();
}

/* ---------- PEDIDOS ---------- */
function renderAdminPedidos(){
  const el = document.getElementById('tab-pedidos');
  const ordem = { pendente:0, confirmado:1, cancelado:2 };
  const ps = [...DATA.pedidos].sort((a,b) => {
    const o = ordem[a.status] - ordem[b.status];
    if(o !== 0) return o;
    return (a.data + a.hora).localeCompare(b.data + b.hora);
  });

  if(!ps.length){
    el.innerHTML = '<p class="muted">Nenhum pedido recebido ainda.</p>';
    return;
  }

  el.innerHTML = ps.map(p => `
    <div class="pedido ${p.status}">
      <div class="pedido-main">
        <div class="pedido-top">
          <strong>${esc(p.nome)}</strong>
          <span class="badge ${p.status}">${p.status}</span>
        </div>
        <div class="pedido-info">
          <span>📅 <b>${fmtData(p.data)}</b></span>
          <span>🕐 <b>${esc(p.hora)}</b></span>
          <span>✂️ <b>${esc(p.servicoNome)}</b> — R$ ${Number(p.preco).toFixed(2).replace('.',',')}</span>
        </div>
        <div class="pedido-tel">📞 ${esc(p.telefone)}</div>
      </div>
      <div class="pedido-actions">
        <a class="btn btn-wa btn-sm" target="_blank" rel="noopener"
           href="${waLink(p.telefone, msgWA(p))}">WhatsApp</a>
        ${p.status !== 'confirmado'
          ? `<button class="btn btn-ok btn-sm" onclick="setStatus('${p.id}','confirmado')">Confirmar</button>` : ''}
        ${p.status !== 'cancelado'
          ? `<button class="btn btn-no btn-sm" onclick="setStatus('${p.id}','cancelado')">Cancelar</button>` : ''}
        <button class="btn btn-del btn-sm" onclick="delPedido('${p.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

function setStatus(id, st){
  const p = DATA.pedidos.find(x => x.id === id);
  if(!p) return;
  p.status = st;
  saveData();
  renderAdmin();
  renderHorarios();
  toast(st === 'confirmado' ? 'Pedido confirmado ✅' : 'Pedido cancelado.', st === 'confirmado' ? 'ok' : '');
}

function delPedido(id){
  if(!confirm('Excluir este pedido definitivamente?')) return;
  DATA.pedidos = DATA.pedidos.filter(p => p.id !== id);
  saveData();
  renderAdmin();
  renderHorarios();
  toast('Pedido excluído.');
}

/* ---------- SERVIÇOS ---------- */
function renderAdminServicos(){
  const el = document.getElementById('tab-servicos');
  const editando = DATA.servicos.find(s => s.id === editServicoId);

  el.innerHTML = `
    <div class="card">
      <h3>${editando ? '✏️ Editando: ' + esc(editando.nome) : '➕ Novo serviço'}</h3>
      <div class="grid-3">
        <div class="field">
          <label>Nome</label>
          <input type="text" id="svNome" placeholder="Ex: Barba + Cabelo"
                 value="${editando ? esc(editando.nome) : ''}">
        </div>
        <div class="field">
          <label>Preço (R$)</label>
          <input type="number" id="svPreco" step="0.01" min="0" placeholder="45"
                 inputmode="decimal"
                 value="${editando ? editando.preco : ''}">
        </div>
        <div class="field">
          <label>Duração (min)</label>
          <input type="number" id="svDur" min="0" placeholder="30"
                 inputmode="numeric"
                 value="${editando && editando.duracao ? editando.duracao : ''}">
        </div>
      </div>
      <div class="field">
        <label>Descrição</label>
        <textarea id="svDesc" rows="2" placeholder="Fale um pouco sobre esse corte...">${editando ? esc(editando.descricao || '') : ''}</textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-gold btn-sm" onclick="salvarServico()">
          ${editando ? 'Salvar alterações' : 'Adicionar serviço'}
        </button>
        ${editando ? '<button class="btn btn-ghost btn-sm" onclick="cancelarEdicao()">Cancelar</button>' : ''}
      </div>
    </div>

    <h3 style="margin:22px 0 14px;font-size:1rem">Serviços cadastrados (${DATA.servicos.length})</h3>
    ${DATA.servicos.length ? DATA.servicos.map(s => `
      <div class="servico-admin">
        <div class="servico-admin-info">
          <strong>${esc(s.nome)}</strong>
          <small>${esc(s.descricao || 'Sem descrição')}${s.duracao ? ' • ⏱️ ' + s.duracao + ' min' : ''}</small>
        </div>
        <div class="servico-admin-preco">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="editarServico('${s.id}')">Editar</button>
          <button class="btn btn-del btn-sm" onclick="excluirServico('${s.id}')">Excluir</button>
        </div>
      </div>`).join('') : '<p class="muted">Nenhum serviço cadastrado.</p>'}
  `;
}

function salvarServico(){
  const nome  = document.getElementById('svNome').value.trim();
  const preco = parseFloat(document.getElementById('svPreco').value);
  const dur   = parseInt(document.getElementById('svDur').value);
  const desc  = document.getElementById('svDesc').value.trim();

  if(nome.length < 2)        return toast('Digite o nome do serviço.', 'err');
  if(isNaN(preco) || preco < 0) return toast('Digite um preço válido.', 'err');

  if(editServicoId){
    const s = DATA.servicos.find(x => x.id === editServicoId);
    if(s){ s.nome = nome; s.preco = preco; s.descricao = desc; s.duracao = isNaN(dur) ? 0 : dur; }
    editServicoId = null;
    toast('Serviço atualizado ✅','ok');
  } else {
    DATA.servicos.push({
      id: 's' + Date.now(),
      nome, preco, descricao: desc,
      duracao: isNaN(dur) ? 0 : dur
    });
    toast('Serviço adicionado ✅','ok');
  }
  saveData();
  renderAdmin();
  renderServicos();
  renderAgendar();
}

function editarServico(id){
  editServicoId = id;
  renderAdminServicos();
  window.scrollTo({ top: document.getElementById('view-admin').offsetTop + 60, behavior:'smooth' });
}
function cancelarEdicao(){
  editServicoId = null;
  renderAdminServicos();
}
function excluirServico(id){
  const s = DATA.servicos.find(x => x.id === id);
  if(!confirm('Excluir o serviço "' + (s ? s.nome : '') + '"?')) return;
  DATA.servicos = DATA.servicos.filter(x => x.id !== id);
  if(selServicoId === id) selServicoId = null;
  saveData();
  renderAdmin();
  renderServicos();
  renderAgendar();
  toast('Serviço excluído.');
}

/* ---------- AGENDA ---------- */
const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_NOMES_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

function renderAdminAgenda(){
  const el = document.getElementById('tab-agenda');
  const ag = DATA.agenda;

  el.innerHTML = `
    <div class="card">
      <h3>📆 Dias de trabalho</h3>
      <div class="dias-grid">
        ${DIAS_NOMES.map((n,i) => `
          <button class="dia-btn ${ag.diasSemana[i] ? 'on' : 'off'}"
                  onclick="toggleDia(${i})">${n}</button>
        `).join('')}
      </div>
      <p class="muted small" style="margin-top:12px">
        Verde = aberto • Riscado = fechado
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="presetDias('semSabDom')">Seg–Sex</button>
        <button class="btn btn-ghost btn-sm" onclick="presetDias('comSabado')">Seg–Sáb</button>
        <button class="btn btn-ghost btn-sm" onclick="presetDias('todos')">Todos</button>
      </div>
    </div>

    <div class="card">
      <h3>🚫 Fechar dias específicos</h3>
      <p class="muted small" style="margin-bottom:12px">Feriados, folgas, viagens</p>
      <div class="grid-2">
        <div class="field" style="margin:0">
          <label>Data</label>
          <input type="date" id="inpBloqueio">
        </div>
        <div class="field" style="margin:0;display:flex;align-items:flex-end">
          <button class="btn btn-gold btn-sm" style="width:100%" onclick="addBloqueio()">
            Fechar este dia
          </button>
        </div>
      </div>
      <div class="lista-datas">
        ${ag.bloqueados.length
          ? ag.bloqueados.sort().map(d => `
              <span class="data-tag">🚫 ${fmtData(d)}
                <button onclick="removerBloqueio('${d}')" title="Reabrir">✕</button>
              </span>`).join('')
          : '<p class="muted small">Nenhuma data fechada.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>✅ Abrir dias fora do normal</h3>
      <p class="muted small" style="margin-bottom:12px">
        Ex: trabalhar num sábado específico
      </p>
      <div class="grid-2">
        <div class="field" style="margin:0">
          <label>Data</label>
          <input type="date" id="inpLiberado">
        </div>
        <div class="field" style="margin:0;display:flex;align-items:flex-end">
          <button class="btn btn-ghost btn-sm" style="width:100%" onclick="addLiberado()">
            Abrir este dia
          </button>
        </div>
      </div>
      <div class="lista-datas">
        ${ag.liberados.length
          ? ag.liberados.sort().map(d => `
              <span class="data-tag liberada">✅ ${fmtData(d)}
                <button onclick="removerLiberado('${d}')" title="Remover">✕</button>
              </span>`).join('')
          : '<p class="muted small">Nenhuma data extra aberta.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>🕐 Horários disponíveis</h3>
      <p class="muted small" style="margin-bottom:12px">
        Toque para ativar/desativar
      </p>
      <div class="chips" style="margin-bottom:18px">
        ${ag.horarios.length
          ? ag.horarios.map(h => `
              <button class="chip ${horarioAtivo(h) ? 'on' : 'off'}"
                      onclick="toggleHorario('${h}')">${h}</button>`).join('')
          : '<p class="muted small">Nenhum horário.</p>'}
      </div>

      <hr class="sep">
      <h3 style="font-size:.95rem">⚙️ Gerar grade automática</h3>
      <div class="grid-3">
        <div class="field" style="margin:0">
          <label>Início</label>
          <input type="time" id="gIni" value="09:00">
        </div>
        <div class="field" style="margin:0">
          <label>Fim</label>
          <input type="time" id="gFim" value="19:00">
        </div>
        <div class="field" style="margin:0">
          <label>Intervalo (min)</label>
          <input type="number" id="gInt" value="30" min="5" step="5" inputmode="numeric">
        </div>
      </div>
      <button class="btn btn-gold btn-sm" style="margin-top:14px" onclick="gerarGrade()">
        Gerar grade
      </button>
      <p class="muted small" style="margin-top:10px">⚠️ Substitui a lista atual</p>
    </div>
  `;
}

function horarioAtivo(h){
  return (DATA.agenda.horarios || []).includes(h);
}

function toggleDia(i){
  DATA.agenda.diasSemana[i] = !DATA.agenda.diasSemana[i];
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
}

function presetDias(tipo){
  if(tipo === 'semSabDom') DATA.agenda.diasSemana = [false,true,true,true,true,true,false];
  if(tipo === 'comSabado') DATA.agenda.diasSemana = [false,true,true,true,true,true,true];
  if(tipo === 'todos')     DATA.agenda.diasSemana = [true,true,true,true,true,true,true];
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
  toast('Dias atualizados ✅','ok');
}

function addBloqueio(){
  const v = document.getElementById('inpBloqueio').value;
  if(!v) return toast('Escolha uma data.', 'err');
  if(DATA.agenda.bloqueados.includes(v)) return toast('Essa data já está fechada.');
  DATA.agenda.bloqueados.push(v);
  DATA.agenda.liberados = DATA.agenda.liberados.filter(d => d !== v);
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
  toast('Dia fechado ✅','ok');
}
function removerBloqueio(d){
  DATA.agenda.bloqueados = DATA.agenda.bloqueados.filter(x => x !== d);
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
}
function addLiberado(){
  const v = document.getElementById('inpLiberado').value;
  if(!v) return toast('Escolha uma data.', 'err');
  if(DATA.agenda.liberados.includes(v)) return toast('Essa data já está aberta.');
  DATA.agenda.liberados.push(v);
  DATA.agenda.bloqueados = DATA.agenda.bloqueados.filter(d => d !== v);
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
  toast('Dia aberto ✅','ok');
}
function removerLiberado(d){
  DATA.agenda.liberados = DATA.agenda.liberados.filter(x => x !== d);
  saveData();
  renderAdminAgenda();
  renderCal();
  renderHorarios();
}

function toggleHorario(h){
  const arr = DATA.agenda.horarios;
  const i = arr.indexOf(h);
  if(i >= 0) arr.splice(i,1); else arr.push(h);
  arr.sort();
  saveData();
  renderAdminAgenda();
  renderHorarios();
}

function gerarGrade(){
  const ini  = document.getElementById('gIni').value;
  const fim  = document.getElementById('gFim').value;
  const pass = parseInt(document.getElementById('gInt').value);
  if(!ini || !fim) return toast('Preencha início e fim.', 'err');
  if(!pass || pass < 5) return toast('Intervalo inválido.', 'err');
  const lista = gerarHorarios(ini, fim, pass);
  if(!lista.length) return toast('Nenhum horário gerado.', 'err');
  DATA.agenda.horarios = lista;
  saveData();
  renderAdminAgenda();
  renderHorarios();
  toast(lista.length + ' horários gerados ✅','ok');
}

/* ---------- CONFIG ---------- */
function renderAdminConfig(){
  const el = document.getElementById('tab-config');
  const c = DATA.config;
  el.innerHTML = `
    <div class="card">
      <h3>🏪 Dados da barbearia</h3>
      <div class="field">
        <label>Nome</label>
        <input type="text" id="cfNome" value="${esc(c.nome)}">
      </div>
      <div class="field">
        <label>Slogan</label>
        <input type="text" id="cfSlogan" value="${esc(c.slogan)}">
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Endereço</label>
          <input type="text" id="cfEnd" value="${esc(c.endereco)}">
        </div>
        <div class="field">
          <label>Horário exibido</label>
          <input type="text" id="cfHor" value="${esc(c.horarioTexto)}">
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>WhatsApp (com DDI)</label>
          <input type="text" id="cfZap" value="${esc(c.whatsapp)}"
                 placeholder="5511999999999" inputmode="tel">
        </div>
        <div class="field">
          <label>Senha do painel</label>
          <input type="text" id="cfSenha" value="${esc(c.senha)}">
        </div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="salvarConfig()">Salvar</button>
    </div>

    <div class="card">
      <h3>🗑️ Zona de perigo</h3>
      <p class="muted small" style="margin-bottom:14px">
        Restaura tudo ao padrão. Não tem volta.
      </p>
      <button class="btn btn-no btn-sm" onclick="resetarTudo()">Restaurar padrão</button>
    </div>
  `;
}

function salvarConfig(){
  const c = DATA.config;
  c.nome         = document.getElementById('cfNome').value.trim()   || 'Barbearia';
  c.slogan       = document.getElementById('cfSlogan').value.trim();
  c.endereco     = document.getElementById('cfEnd').value.trim();
  c.horarioTexto = document.getElementById('cfHor').value.trim();
  c.whatsapp     = document.getElementById('cfZap').value.trim();
  const senha    = document.getElementById('cfSenha').value.trim();
  if(senha.length < 3) return toast('A senha precisa ter ao menos 3 caracteres.', 'err');
  c.senha = senha;
  saveData();
  renderTudo();
  toast('Configurações salvas ✅','ok');
}

function resetarTudo(){
  if(!confirm('Isso vai apagar TODOS os serviços, a agenda e os pedidos. Continuar?')) return;
  DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
  editServicoId = null; selDate = null; selHora = null; selServicoId = null;
  saveData();
  renderTudo();
  toast('Tudo restaurado ao padrão.','ok');
}

/* =========================================================
   EXPÕE FUNÇÕES PARA O HTML (onclick)
   ========================================================= */
Object.assign(window, {
  go, login, logout, setTab,
  onServicoChange, mudarMes, enviarPedido,
  setStatus, delPedido,
  salvarServico, editarServico, cancelarEdicao, excluirServico,
  toggleDia, presetDias,
  addBloqueio, removerBloqueio, addLiberado, removerLiberado,
  toggleHorario, gerarGrade,
  salvarConfig, resetarTudo
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
initFirebase();
