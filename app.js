// ============================================================
// DAŇOVÁ EVIDENCE — app.js
// Hlavní aplikační logika
// ============================================================

// ── KATEGORIE ────────────────────────────────────────────────
const PRIJMY_KATEGORIE = [
  { id: 'prodej_local',    label: 'Prodej — lokální (Instagram, FB, Vinted, Bazoš…)', zdanitelny: true },
  { id: 'prodej_komis',    label: 'Prodej — komisní (Thebeast, Pikastore, Released…)', zdanitelny: true },
  { id: 'prodej_platforma',label: 'Prodej — platformy (StockX, Klekt, Hypeboost, Alias…)', zdanitelny: true },
  { id: 'obsah_spoluprace',label: 'Obsah a spolupráce (sociální sítě, brand deals)', zdanitelny: true },
  { id: 'ostatni_prijmy',  label: 'Ostatní zdanitelné příjmy', zdanitelny: true },
  { id: 'vklad_osobni',    label: 'Vklad z osobního majetku', zdanitelny: false },
  { id: 'prijata_pujcka',  label: 'Přijatá půjčka', zdanitelny: false },
];

const VYDAJE_KATEGORIE = [
  { id: 'nakup_zbozi',     label: 'Nákup zboží (tenisky, oblečení, pokémoni…)', zdanitelny: true },
  { id: 'postovne',        label: 'Poštovné a balné', zdanitelny: true },
  { id: 'balici_material', label: 'Balicí materiál (krabice, fólie…)', zdanitelny: true },
  { id: 'poplatky_platf',  label: 'Poplatky prodejní platformy (Vinted, Bazoš, StockX…)', zdanitelny: true },
  { id: 'poplatky_komis',  label: 'Poplatky komisní prodej (Thebeast, Pikastore…)', zdanitelny: true },
  { id: 'reklama',         label: 'Reklama a marketing', zdanitelny: true },
  { id: 'telefon_inet',    label: 'Telefon a internet (poměrná část)', zdanitelny: true },
  { id: 'doprava',         label: 'Doprava (cesta za nákupem, doručení)', zdanitelny: true },
  { id: 'kancelarske',     label: 'Kancelářské potřeby', zdanitelny: true },
  { id: 'ostatni_vydaje',  label: 'Ostatní daňové výdaje', zdanitelny: true },
  { id: 'vyber_osobni',    label: 'Výběr pro osobní potřebu', zdanitelny: false },
  { id: 'splatka_pujcky',  label: 'Splátka půjčky', zdanitelny: false },
];

const MESICE = ['','Leden','Únor','Březen','Duben','Květen','Červen',
                'Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

// Odpisové sazby rovnoměrné (1.rok / další roky) a doby v letech
const ODP_SKUPINY = {
  1: { roky: 3,  sazba1: 20,   sazba: 40 },
  2: { roky: 5,  sazba1: 11,   sazba: 22.25 },
  3: { roky: 10, sazba1: 5.5,  sazba: 10.5 },
  4: { roky: 20, sazba1: 2.15, sazba: 5.15 },
  5: { roky: 30, sazba1: 1.4,  sazba: 3.4 },
  6: { roky: 50, sazba1: 1.02, sazba: 2.02 },
};

// ── APP STATE ─────────────────────────────────────────────────
const state = {
  uid: null,
  rok: new Date().getFullYear(),
  transakce: [],
  fakturyVydane: [],
  fakturyPrijate: [],
  zasoby: [],
  majetek: [],
  nastaveni: {},
  unsubs: [],
};

// ── FIREBASE REFS ─────────────────────────────────────────────
function col(name) {
  const { db, collection } = window._firebase;
  return collection(db, 'users', state.uid, name);
}

function docRef(colName, id) {
  const { db, doc } = window._firebase;
  return doc(db, 'users', state.uid, colName, id);
}

// ── AUTH ──────────────────────────────────────────────────────
function initAuth() {
  const { auth, onAuthStateChanged } = window._firebase;
  onAuthStateChanged(auth, user => {
    if (user) {
      state.uid = user.uid;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      initApp(user);
    } else {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      state.unsubs.forEach(u => u());
      state.unsubs = [];
    }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;
    btn.textContent = 'Přihlašuji…';
    btn.disabled = true;
    errEl.style.display = 'none';
    try {
      const { auth, signInWithEmailAndPassword } = window._firebase;
      await signInWithEmailAndPassword(auth, email, pwd);
    } catch(err) {
      errEl.style.display = 'block';
      errEl.textContent = loginErrMsg(err.code);
      btn.textContent = 'Přihlásit se';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    const { auth, signOut } = window._firebase;
    await signOut(auth);
    showToast('Odhlášen/a', 'info');
  });
}
initAuth();

function loginErrMsg(code) {
  const map = {
    'auth/user-not-found': 'Účet s tímto emailem neexistuje.',
    'auth/wrong-password': 'Špatné heslo.',
    'auth/invalid-credential': 'Nesprávný email nebo heslo.',
    'auth/too-many-requests': 'Příliš mnoho pokusů. Zkus to za chvíli.',
    'auth/network-request-failed': 'Síťová chyba. Zkontroluj připojení.',
  };
  return map[code] || `Chyba přihlášení: ${code}`;
}

// ── INIT APP ──────────────────────────────────────────────────
async function initApp(user) {
  // User info in sidebar
  const name = user.email.split('@')[0];
  document.getElementById('user-name').textContent = user.email;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();

  // Year selector
  buildYearSelector();

  // Fill category selects
  fillCategorySelect('t-kategorie', PRIJMY_KATEGORIE);
  fillExpenseCategorySelect('fp-kategorie-modal', VYDAJE_KATEGORIE);
  fillExpenseCategorySelect('fp-kategorie', VYDAJE_KATEGORIE);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.section));
  });

  // Mobile sidebar
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // Load nastaveni first
  await loadNastaveni();

  // Subscribe to real-time data
  subscribeData();

  navigate('dashboard');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

function buildYearSelector() {
  const sel = document.getElementById('year-select');
  const current = new Date().getFullYear();
  sel.innerHTML = '';
  for (let y = current; y >= 2024; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === state.rok) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    state.rok = parseInt(sel.value);
    refreshAll();
  });
}

function fillCategorySelect(id, cats) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.zdanitelny ? c.label : `⚪ ${c.label}`;
    sel.appendChild(opt);
  });
}

function fillExpenseCategorySelect(id, cats) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">— vyberte —</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.zdanitelny ? c.label : `⚪ ${c.label}`;
    sel.appendChild(opt);
  });
  // Also fill filter
  const filter = document.getElementById('fp-kategorie');
  if (filter) {
    filter.innerHTML = '<option value="">Kategorie: vše</option>';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      filter.appendChild(opt);
    });
  }
}

// ── FIRESTORE SUBSCRIPTIONS ───────────────────────────────────
function subscribeData() {
  const { onSnapshot, query, orderBy } = window._firebase;
  state.unsubs.forEach(u => u());
  state.unsubs = [];

  const sub = (colName, stateKey, sortField, cb) => {
    const q = query(col(colName), orderBy(sortField, 'desc'));
    const unsub = onSnapshot(q, snap => {
      state[stateKey] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cb && cb();
    }, err => console.error(colName, err));
    state.unsubs.push(unsub);
  };

  sub('transakce',       'transakce',      'datum',   refreshAll);
  sub('fakturyVydane',   'fakturyVydane',  'datum',   refreshAll);
  sub('fakturyPrijate',  'fakturyPrijate', 'datum',   refreshAll);
  sub('zasoby',          'zasoby',         'datum',   refreshAll);
  sub('majetek',         'majetek',        'datumPorizeni', refreshAll);
}

function refreshAll() {
  renderDashboard();
  renderDenik();
  renderFakturyVydane();
  renderFakturyPrijate();
  renderZasoby();
  renderMajetek();
  renderDanovyPrehled();
  updateBadges();
}

// ── NAVIGATE ──────────────────────────────────────────────────
function navigate(sectionId) {
  if (!sectionId) return;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const sec = document.getElementById(sectionId);
  if (sec) sec.classList.add('active');

  const btn = document.querySelector(`[data-section="${sectionId}"]`);
  if (btn) btn.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'penezni-denik': 'Peněžní deník',
    'faktury-vydane': 'Faktury vydané',
    'faktury-prijate': 'Faktury přijaté',
    'zasoby': 'Zásoby',
    'majetek': 'Dlouhodobý majetek',
    'danovy-prehled': 'Daňový přehled',
    'nastaveni': 'Nastavení',
  };
  document.getElementById('mobile-title').textContent = titles[sectionId] || '';
  closeSidebar();
  window.scrollTo(0, 0);
}
window.navigate = navigate;

// ── COMPUTED DATA HELPERS ─────────────────────────────────────
function txByRok(rok) {
  return state.transakce.filter(t => t.datum && t.datum.startsWith(rok));
}

function sumTx(txList, typ, zdanitelny = null) {
  return txList
    .filter(t => t.typ === typ && (zdanitelny === null || t.zdanitelny === zdanitelny))
    .reduce((s, t) => s + (Number(t.castka) || 0), 0);
}

function balanceAccount(ucet) {
  const pocat = Number(state.nastaveni[`pocat_${ucet}`] || 0);
  const vsechny = state.transakce;
  const prijmy = vsechny.filter(t => t.ucet === ucet && t.typ === 'prijem').reduce((s,t) => s + Number(t.castka||0), 0);
  const vydaje = vsechny.filter(t => t.ucet === ucet && t.typ === 'vydej').reduce((s,t) => s + Number(t.castka||0), 0);
  return pocat + prijmy - vydaje;
}

function getOdpisyRok(rok) {
  return state.majetek.reduce((sum, m) => {
    const poriz = m.datumPorizeni || '';
    const rokPoriz = parseInt(poriz.substring(0,4));
    if (isNaN(rokPoriz)) return sum;
    const rokCislo = parseInt(rok);
    if (rokCislo < rokPoriz) return sum;
    if (m.datumVyrazeni && m.datumVyrazeni.startsWith(rok) === false && m.datumVyrazeni < `${rok}-01-01`) return sum;
    const sk = ODP_SKUPINY[m.skupina] || ODP_SKUPINY[2];
    const je1rok = rokCislo === rokPoriz;
    const odpis = Number(m.cenaPorizeni || 0) * (je1rok ? sk.sazba1 : sk.sazba) / 100;
    return sum + odpis;
  }, 0);
}

function getZasobyHodnota() {
  return state.zasoby.reduce((s, z) => s + (Number(z.celkemCena)||0), 0);
}

// ── FORMATOVANI ───────────────────────────────────────────────
function fmtCzk(amount) {
  if (isNaN(amount)) return '0 Kč';
  return new Intl.NumberFormat('cs-CZ', { style:'currency', currency:'CZK', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function isOverdue(splatnost) {
  if (!splatnost) return false;
  return splatnost < new Date().toISOString().slice(0,10);
}

function getCatLabel(id, typ) {
  const arr = typ === 'prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE;
  return arr.find(c => c.id === id)?.label || id;
}

function isZdanitelny(katId, typ) {
  const arr = typ === 'prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE;
  return arr.find(c => c.id === katId)?.zdanitelny ?? true;
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const rok = String(state.rok);
  const tx = txByRok(rok);
  const prijmyZd  = sumTx(tx, 'prijem', true);
  const vydajeZd  = sumTx(tx, 'vydej',  true);
  const odpisy    = getOdpisyRok(rok);
  const zasoby    = getZasobyHodnota();
  const zakladDane = prijmyZd - vydajeZd - odpisy;

  document.getElementById('dashboard-subtitle').textContent = `Přehled za rok ${rok}`;
  document.getElementById('tax-year-label').textContent = rok;

  // Účty
  ['hotovost','bank','revolut'].forEach(ucet => {
    const bal = balanceAccount(ucet);
    const el = document.getElementById(`balance-${ucet}`);
    if (el) {
      el.textContent = fmtCzk(bal);
      el.className = 'account-balance ' + (bal >= 0 ? 'positive' : 'negative');
    }
  });

  // Stats
  setText('stat-prijmy', fmtCzk(prijmyZd));
  setText('stat-vydaje', fmtCzk(vydajeZd));
  setText('stat-zaklad', fmtCzk(zakladDane));

  // Nezaplacené faktury
  const nezVydane = state.fakturyVydane.filter(f => f.stav !== 'zaplaceno').length;
  const nezPrijate = state.fakturyPrijate.filter(f => f.stav !== 'zaplaceno').length;
  const nezCelkem = nezVydane + nezPrijate;
  setText('stat-nezaplacene', nezCelkem);
  setText('stat-nezaplacene-sub', `${nezVydane} vyd. · ${nezPrijate} přij.`);

  // Tax box
  setText('tax-prijmy', fmtCzk(prijmyZd));
  setText('tax-vydaje', `− ${fmtCzk(vydajeZd)}`);
  setText('tax-odpisy', `− ${fmtCzk(odpisy)}`);
  setText('tax-zaklad-final', fmtCzk(zakladDane));

  // Recent transactions
  const recent = [...state.transakce].slice(0, 8);
  const tbody = document.getElementById('recent-transactions');
  if (!recent.length) {
    tbody.innerHTML = `<div class="empty-state"><div class="empty-icon">📒</div><h3>Zatím žádné záznamy</h3><p>Přidej první příjem nebo výdaj tlačítkem "Nový záznam"</p></div>`;
    return;
  }
  tbody.innerHTML = `<table><thead><tr><th>Datum</th><th>Popis</th><th>Účet</th><th>Příjem</th><th>Výdej</th></tr></thead><tbody>
    ${recent.map(t => `
      <tr>
        <td class="td-muted">${fmtDate(t.datum)}</td>
        <td>${esc(t.popis)}</td>
        <td>${accountIcon(t.ucet)}</td>
        <td class="td-amount-income">${t.typ==='prijem' ? fmtCzk(t.castka) : ''}</td>
        <td class="td-amount-expense">${t.typ==='vydej' ? fmtCzk(t.castka) : ''}</td>
      </tr>`).join('')}
  </tbody></table>`;
}

// ── PENĚŽNÍ DENÍK ─────────────────────────────────────────────
function renderDenik() {
  const rok = String(state.rok);
  let tx = txByRok(rok);

  const search = (document.getElementById('denik-search')?.value || '').toLowerCase();
  const typF   = document.getElementById('denik-typ')?.value || '';
  const ucetF  = document.getElementById('denik-ucet')?.value || '';
  const mesicF = document.getElementById('denik-mesic')?.value || '';

  if (search) tx = tx.filter(t => (t.popis||'').toLowerCase().includes(search) || (t.doklad||'').toLowerCase().includes(search));
  if (typF)   tx = tx.filter(t => t.typ === typF);
  if (ucetF)  tx = tx.filter(t => t.ucet === ucetF);
  if (mesicF) tx = tx.filter(t => t.datum && t.datum.substring(5,7) === mesicF.padStart(2,'0'));

  // Summary (always full year)
  const allTx = txByRok(rok);
  const prijmyZd = sumTx(allTx,'prijem',true);
  const vydajeZd = sumTx(allTx,'vydej',true);
  setText('sum-prijmy-zd', fmtCzk(prijmyZd));
  setText('sum-vydaje-zd', fmtCzk(vydajeZd));
  setText('sum-zaklad', fmtCzk(prijmyZd - vydajeZd));
  setText('sum-hotovost', fmtCzk(balanceAccount('hotovost')));
  setText('sum-bank',     fmtCzk(balanceAccount('bank')));
  setText('sum-revolut',  fmtCzk(balanceAccount('revolut')));

  const tbody = document.getElementById('denik-tbody');
  if (!tx.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📒</div><h3>Žádné záznamy</h3><p>Uprav filtry nebo přidej nový záznam</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = tx.map(t => {
    const katLabel = getCatLabel(t.kategorie, t.typ);
    const shortKat = katLabel.length > 28 ? katLabel.substring(0,28)+'…' : katLabel;
    return `<tr>
      <td class="td-muted" style="white-space:nowrap;">${fmtDate(t.datum)}</td>
      <td class="td-muted">${esc(t.doklad||'—')}</td>
      <td>${esc(t.popis)}</td>
      <td><span title="${esc(katLabel)}" class="td-muted" style="font-size:0.78rem;">${esc(shortKat)}</span></td>
      <td>${accountIcon(t.ucet)}</td>
      <td class="td-amount-income">${t.typ==='prijem' ? fmtCzk(t.castka) : ''}</td>
      <td class="td-amount-expense">${t.typ==='vydej' ? fmtCzk(t.castka) : ''}</td>
      <td>${t.zdanitelny ? '<span class="badge badge-income">Ano</span>' : '<span class="badge badge-neutral">Ne</span>'}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-icon" onclick="editTransakce('${t.id}')" title="Upravit">✏️</button>
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('transakce','${t.id}','záznam')" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
window.renderDenik = renderDenik;

// ── FAKTURY VYDANÉ ────────────────────────────────────────────
function renderFakturyVydane() {
  const rok = String(state.rok);
  let data = state.fakturyVydane.filter(f => f.datum?.startsWith(rok));

  const search = (document.getElementById('fv-search')?.value||'').toLowerCase();
  const stavF  = document.getElementById('fv-stav')?.value||'';
  const today  = new Date().toISOString().slice(0,10);

  if (search) data = data.filter(f => (f.cislo||'').toLowerCase().includes(search) || (f.odberatel||'').toLowerCase().includes(search));
  if (stavF === 'zaplaceno')   data = data.filter(f => f.stav === 'zaplaceno');
  if (stavF === 'nezaplaceno') data = data.filter(f => f.stav !== 'zaplaceno' && !(f.splatnost < today));
  if (stavF === 'po-splatnosti') data = data.filter(f => f.stav !== 'zaplaceno' && f.splatnost && f.splatnost < today);

  const allRok = state.fakturyVydane.filter(f => f.datum?.startsWith(rok));
  const celkem    = allRok.reduce((s,f)=>s+Number(f.celkem||0),0);
  const zaplaceno = allRok.filter(f=>f.stav==='zaplaceno').reduce((s,f)=>s+Number(f.celkem||0),0);
  setText('fv-celkem',    fmtCzk(celkem));
  setText('fv-zaplaceno', fmtCzk(zaplaceno));
  setText('fv-ceka',      fmtCzk(celkem - zaplaceno));

  const tbody = document.getElementById('fv-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📄</div><h3>Žádné faktury</h3><p>Uprav filtry nebo přidej novou fakturu</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(f => {
    const overdue = f.stav !== 'zaplaceno' && f.splatnost && f.splatnost < today;
    const stavBadge = f.stav === 'zaplaceno'
      ? '<span class="badge badge-paid">✓ Zaplaceno</span>'
      : overdue
        ? '<span class="badge badge-overdue">⚠ Po splatnosti</span>'
        : '<span class="badge badge-pending">⏳ Čeká</span>';
    return `<tr>
      <td><strong>${esc(f.cislo)}</strong></td>
      <td class="td-muted">${fmtDate(f.datum)}</td>
      <td class="td-muted" style="${overdue?'color:var(--danger);':''}">${fmtDate(f.splatnost)}</td>
      <td>${esc(f.odberatel)}</td>
      <td class="td-amount-income">${fmtCzk(f.celkem)}</td>
      <td>${stavBadge}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-icon" onclick="editFakturaVydana('${f.id}')" title="Upravit">✏️</button>
        ${f.stav!=='zaplaceno' ? `<button class="btn btn-ghost btn-icon" onclick="markFakturaPaid('vydane','${f.id}')" title="Označit jako zaplaceno">✅</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('fakturyVydane','${f.id}','fakturu')" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
window.renderFakturyVydane = renderFakturyVydane;

// ── FAKTURY PŘIJATÉ ───────────────────────────────────────────
function renderFakturyPrijate() {
  const rok = String(state.rok);
  let data = state.fakturyPrijate.filter(f => f.datum?.startsWith(rok));
  const today = new Date().toISOString().slice(0,10);

  const search = (document.getElementById('fp-search')?.value||'').toLowerCase();
  const stavF  = document.getElementById('fp-stav')?.value||'';
  const katF   = document.getElementById('fp-kategorie')?.value||'';

  if (search)  data = data.filter(f => (f.cislo||'').toLowerCase().includes(search)||(f.dodavatel||'').toLowerCase().includes(search));
  if (stavF==='zaplaceno')    data = data.filter(f=>f.stav==='zaplaceno');
  if (stavF==='nezaplaceno')  data = data.filter(f=>f.stav!=='zaplaceno'&&!(f.splatnost<today));
  if (stavF==='po-splatnosti') data = data.filter(f=>f.stav!=='zaplaceno'&&f.splatnost&&f.splatnost<today);
  if (katF) data = data.filter(f=>f.kategorie===katF);

  const allRok = state.fakturyPrijate.filter(f=>f.datum?.startsWith(rok));
  const celkem    = allRok.reduce((s,f)=>s+Number(f.castka||0),0);
  const zaplaceno = allRok.filter(f=>f.stav==='zaplaceno').reduce((s,f)=>s+Number(f.castka||0),0);
  setText('fp-celkem',    fmtCzk(celkem));
  setText('fp-zaplaceno', fmtCzk(zaplaceno));
  setText('fp-ceka',      fmtCzk(celkem-zaplaceno));

  const tbody = document.getElementById('fp-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📥</div><h3>Žádné faktury</h3><p>Uprav filtry nebo přidej novou přijatou fakturu</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(f => {
    const overdue = f.stav!=='zaplaceno' && f.splatnost && f.splatnost < today;
    const stavBadge = f.stav==='zaplaceno'
      ? '<span class="badge badge-paid">✓ Zaplaceno</span>'
      : overdue ? '<span class="badge badge-overdue">⚠ Po splatnosti</span>'
      : '<span class="badge badge-pending">⏳ Čeká</span>';
    const katLabel = VYDAJE_KATEGORIE.find(c=>c.id===f.kategorie)?.label || f.kategorie || '—';
    const shortKat = katLabel.length>22 ? katLabel.substring(0,22)+'…' : katLabel;
    return `<tr>
      <td><strong>${esc(f.cislo)}</strong></td>
      <td class="td-muted">${fmtDate(f.datum)}</td>
      <td class="td-muted" style="${overdue?'color:var(--danger);':''}">${fmtDate(f.splatnost)}</td>
      <td>${esc(f.dodavatel)}</td>
      <td><span class="td-muted" style="font-size:0.78rem;" title="${esc(katLabel)}">${esc(shortKat)}</span></td>
      <td class="td-amount-expense">${fmtCzk(f.castka)}</td>
      <td>${stavBadge}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-icon" onclick="editFakturaPrijata('${f.id}')" title="Upravit">✏️</button>
        ${f.stav!=='zaplaceno' ? `<button class="btn btn-ghost btn-icon" onclick="markFakturaPaid('prijate','${f.id}')" title="Označit jako zaplaceno">✅</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('fakturyPrijate','${f.id}','fakturu')" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
window.renderFakturyPrijate = renderFakturyPrijate;

// ── ZÁSOBY ────────────────────────────────────────────────────
function renderZasoby() {
  const data = state.zasoby;
  const pocet = data.length;
  const hodnota = getZasobyHodnota();
  const prumer = pocet > 0 ? hodnota / pocet : 0;
  setText('zasoby-pocet',   pocet);
  setText('zasoby-hodnota', fmtCzk(hodnota));
  setText('zasoby-prumer',  fmtCzk(prumer));

  const tbody = document.getElementById('zasoby-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><h3>Zásoby jsou prázdné</h3><p>Přidej zboží, které je aktuálně na skladě</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(z => `<tr>
    <td><strong>${esc(z.nazev)}</strong></td>
    <td class="td-muted">${fmtDate(z.datum)}</td>
    <td>${z.mnozstvi} ks</td>
    <td>${fmtCzk(z.cenaNaKus)}</td>
    <td class="td-amount-income">${fmtCzk(z.celkemCena)}</td>
    <td class="td-muted" style="font-size:0.78rem;">${esc(z.poznamka||'—')}</td>
    <td class="td-actions">
      <button class="btn btn-ghost btn-icon" onclick="editZasoba('${z.id}')" title="Upravit">✏️</button>
      <button class="btn btn-ghost btn-icon" onclick="confirmDelete('zasoby','${z.id}','zásobu')" title="Smazat">🗑</button>
    </td>
  </tr>`).join('');
}

// ── DLOUHODOBÝ MAJETEK ────────────────────────────────────────
function renderMajetek() {
  const rok = parseInt(state.rok);
  const data = state.majetek;
  const pocet = data.filter(m=>!m.datumVyrazeni).length;
  const celkem = data.reduce((s,m)=>s+Number(m.cenaPorizeni||0),0);
  const zustatky = data.filter(m=>!m.datumVyrazeni).reduce((s,m)=>{
    const sk = ODP_SKUPINY[m.skupina]||ODP_SKUPINY[2];
    const rokPoriz = parseInt((m.datumPorizeni||'').substring(0,4));
    const rokyOdpisu = Math.min(rok - rokPoriz, sk.roky);
    const zustatkovaCena = Math.max(0, calcZustatkovaCena(m, rok));
    return s + zustatkovaCena;
  },0);
  const odpisyRok = getOdpisyRok(String(state.rok));
  setText('majetek-pocet',      pocet);
  setText('majetek-celkem',     fmtCzk(celkem));
  setText('majetek-zustatky',   fmtCzk(zustatky));
  setText('majetek-odpisy-rok', fmtCzk(odpisyRok));

  const tbody = document.getElementById('majetek-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏗️</div><h3>Zatím žádný majetek</h3><p>Majetek pod 80 000 Kč jde přímo do výdajů</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(m => {
    const sk = ODP_SKUPINY[m.skupina]||ODP_SKUPINY[2];
    const rokPoriz = parseInt((m.datumPorizeni||'').substring(0,4));
    const je1rok = rok === rokPoriz;
    const odpisRok = Number(m.cenaPorizeni||0) * (je1rok ? sk.sazba1 : sk.sazba) / 100;
    const zust = calcZustatkovaCena(m, rok);
    const vyrazen = !!m.datumVyrazeni;
    return `<tr>
      <td><strong>${esc(m.nazev)}</strong><br/><span class="td-muted" style="font-size:0.75rem;">${esc(m.popis||'')}</span></td>
      <td class="td-muted">${fmtDate(m.datumPorizeni)}</td>
      <td>${fmtCzk(m.cenaPorizeni)}</td>
      <td>Skupina ${m.skupina} (${sk.roky} let)</td>
      <td class="td-amount-expense">${fmtCzk(odpisRok)}</td>
      <td>${fmtCzk(Math.max(0,zust))}</td>
      <td>${vyrazen ? `<span class="badge badge-neutral">Vyřazen ${fmtDate(m.datumVyrazeni)}</span>` : '<span class="badge badge-income">Aktivní</span>'}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-icon" onclick="editMajetek('${m.id}')" title="Upravit">✏️</button>
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('majetek','${m.id}','majetek')" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function calcZustatkovaCena(m, rokAktualni) {
  const sk = ODP_SKUPINY[m.skupina]||ODP_SKUPINY[2];
  const rokPoriz = parseInt((m.datumPorizeni||'').substring(0,4));
  if (isNaN(rokPoriz)) return Number(m.cenaPorizeni||0);
  let zust = Number(m.cenaPorizeni||0);
  for (let r = rokPoriz; r <= rokAktualni; r++) {
    const je1rok = r === rokPoriz;
    const odpis = zust * 0; // rovnoměrná metoda - počítáme ze vstupní ceny
    const odpisR = Number(m.cenaPorizeni||0) * (je1rok ? sk.sazba1 : sk.sazba) / 100;
    zust -= odpisR;
    if (zust <= 0) return 0;
  }
  return zust;
}

// ── DAŇOVÝ PŘEHLED ────────────────────────────────────────────
function renderDanovyPrehled() {
  const rok = String(state.rok);
  document.getElementById('dp-subtitle').textContent = `Výpočet základu daně pro rok ${rok}`;

  const tx = txByRok(rok);
  const prijmyZd  = sumTx(tx,'prijem',true);
  const vydajeZd  = sumTx(tx,'vydej',true);
  const odpisy    = getOdpisyRok(rok);
  const zasoby    = getZasobyHodnota();
  const zakladDane = prijmyZd - vydajeZd - odpisy;

  setText('dp-prijmy', fmtCzk(prijmyZd));
  setText('dp-vydaje', `− ${fmtCzk(vydajeZd)}`);
  setText('dp-odpisy', `− ${fmtCzk(odpisy)}`);
  setText('dp-zasoby', `+ ${fmtCzk(zasoby)}`);
  setText('dp-zaklad', fmtCzk(zakladDane));

  // Příjmy podle kategorií
  const ptable = document.getElementById('dp-prijmy-table');
  const priKat = {};
  tx.filter(t=>t.typ==='prijem'&&t.zdanitelny).forEach(t => {
    priKat[t.kategorie] = (priKat[t.kategorie]||0) + Number(t.castka||0);
  });
  if (Object.keys(priKat).length) {
    ptable.innerHTML = Object.entries(priKat).sort((a,b)=>b[1]-a[1]).map(([id,val])=>{
      const pct = prijmyZd > 0 ? ((val/prijmyZd)*100).toFixed(1) : '0';
      return `<tr><td>${esc(getCatLabel(id,'prijem'))}</td><td style="text-align:right;color:var(--success);font-weight:600;">${fmtCzk(val)}</td><td style="text-align:right;color:var(--text-secondary);">${pct}%</td></tr>`;
    }).join('') + `<tr style="font-weight:700;border-top:1px solid var(--border);"><td>CELKEM</td><td style="text-align:right;color:var(--success);">${fmtCzk(prijmyZd)}</td><td></td></tr>`;
  } else {
    ptable.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:1.5rem;"><div class="empty-icon">💰</div><h3>Žádné příjmy</h3></div></td></tr>`;
  }

  // Výdaje podle kategorií
  const vtable = document.getElementById('dp-vydaje-table');
  const vydKat = {};
  tx.filter(t=>t.typ==='vydej'&&t.zdanitelny).forEach(t => {
    vydKat[t.kategorie] = (vydKat[t.kategorie]||0) + Number(t.castka||0);
  });
  if (Object.keys(vydKat).length) {
    vtable.innerHTML = Object.entries(vydKat).sort((a,b)=>b[1]-a[1]).map(([id,val])=>{
      const pct = vydajeZd > 0 ? ((val/vydajeZd)*100).toFixed(1) : '0';
      return `<tr><td>${esc(getCatLabel(id,'vydej'))}</td><td style="text-align:right;color:var(--danger);font-weight:600;">${fmtCzk(val)}</td><td style="text-align:right;color:var(--text-secondary);">${pct}%</td></tr>`;
    }).join('') + `<tr style="font-weight:700;border-top:1px solid var(--border);"><td>CELKEM</td><td style="text-align:right;color:var(--danger);">${fmtCzk(vydajeZd)}</td><td></td></tr>`;
  } else {
    vtable.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:1.5rem;"><div class="empty-icon">💸</div><h3>Žádné výdaje</h3></div></td></tr>`;
  }

  // Měsíční přehled
  const mtable = document.getElementById('dp-mesice-table');
  const mesiceData = {};
  for (let m=1;m<=12;m++) mesiceData[m] = {prijmy:0,vydaje:0};
  tx.filter(t=>t.zdanitelny).forEach(t => {
    const m = parseInt(t.datum?.substring(5,7));
    if (!m || !mesiceData[m]) return;
    if (t.typ==='prijem') mesiceData[m].prijmy += Number(t.castka||0);
    else mesiceData[m].vydaje += Number(t.castka||0);
  });
  mtable.innerHTML = Object.entries(mesiceData).map(([m,d])=>{
    const rozdil = d.prijmy - d.vydaje;
    const hasData = d.prijmy>0||d.vydaje>0;
    return `<tr style="${!hasData?'opacity:0.4;':''}">
      <td>${MESICE[m]}</td>
      <td style="text-align:right;color:var(--success);">${d.prijmy>0?fmtCzk(d.prijmy):'—'}</td>
      <td style="text-align:right;color:var(--danger);">${d.vydaje>0?fmtCzk(d.vydaje):'—'}</td>
      <td style="text-align:right;font-weight:600;color:${rozdil>=0?'var(--success)':'var(--danger)'};">${hasData?fmtCzk(rozdil):'—'}</td>
    </tr>`;
  }).join('');

  // Upozornění na obrat
  const obratWarn = document.getElementById('obrat-warning');
  const limitDPH = 2000000;
  const obratPct = (prijmyZd / limitDPH) * 100;
  if (obratPct >= 75) {
    obratWarn.style.display = 'block';
    const zbyvaDo = limitDPH - prijmyZd;
    document.getElementById('obrat-warning-text').textContent =
      obratPct >= 100
        ? `Tvůj obrat ${fmtCzk(prijmyZd)} překročil limit ${fmtCzk(limitDPH)} pro povinnou registraci k DPH! Okamžitě kontaktuj daňového poradce.`
        : `Tvůj obrat za rok ${rok} je ${fmtCzk(prijmyZd)} (${obratPct.toFixed(1)}% limitu). Do povinné registrace k DPH zbývá ${fmtCzk(zbyvaDo)}.`;
  } else {
    obratWarn.style.display = 'none';
  }
}

// ── NASTAVENÍ ─────────────────────────────────────────────────
async function loadNastaveni() {
  const { getDoc } = window._firebase;
  const { db, doc } = window._firebase;
  try {
    const snap = await getDoc(doc(db,'users',state.uid,'nastaveni','config'));
    if (snap.exists()) {
      state.nastaveni = snap.data();
      const s = state.nastaveni;
      setVal('set-jmeno',       s.jmeno||'');
      setVal('set-ico',         s.ico||'');
      setVal('set-adresa',      s.adresa||'');
      setVal('set-ucet',        s.cisloUctu||'');
      setVal('set-obor',        s.obor||'');
      setVal('set-rok-zahajeni',s.rokZahajeni||'');
      setVal('set-pocat-hotovost', s.pocat_hotovost||'');
      setVal('set-pocat-bank',     s.pocat_bank||'');
      setVal('set-pocat-revolut',  s.pocat_revolut||'');
    }
  } catch(e) { console.error('loadNastaveni', e); }
}

async function saveNastaveni() {
  const { db, doc, setDoc } = window._firebase;
  const data = {
    jmeno:         getVal('set-jmeno'),
    ico:           getVal('set-ico'),
    adresa:        getVal('set-adresa'),
    cisloUctu:     getVal('set-ucet'),
    obor:          getVal('set-obor'),
    rokZahajeni:   getVal('set-rok-zahajeni'),
    pocat_hotovost:Number(getVal('set-pocat-hotovost')||0),
    pocat_bank:    Number(getVal('set-pocat-bank')||0),
    pocat_revolut: Number(getVal('set-pocat-revolut')||0),
  };
  try {
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), data);
    state.nastaveni = data;
    refreshAll();
    showToast('Nastavení uloženo', 'success');
  } catch(e) {
    showToast('Chyba uložení: ' + e.message, 'error');
  }
}
window.saveNastaveni = saveNastaveni;

// ── TRANSAKCE CRUD ────────────────────────────────────────────
let currentTransakceTyp = 'prijem';

function setTransakceTyp(typ) {
  currentTransakceTyp = typ;
  document.getElementById('t-typ').value = typ;
  document.getElementById('toggle-prijem').className = 'type-toggle-btn ' + (typ==='prijem' ? 'active-income' : '');
  document.getElementById('toggle-vydej').className  = 'type-toggle-btn ' + (typ==='vydej'  ? 'active-expense' : '');
  // Update category options
  fillCategorySelect('t-kategorie', typ==='prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE);
}
window.setTransakceTyp = setTransakceTyp;

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}
window.openModal = openModal;

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}
window.closeModal = closeModal;

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

function openModalNewTransakce() {
  clearTransakceForm();
  document.getElementById('modal-transakce-title').textContent = '📒 Nový záznam';
  document.getElementById('t-datum').value = todayStr();
  setTransakceTyp('prijem');
  openModal('modal-transakce');
}
window.openModalNewTransakce = openModalNewTransakce;

// Override default + button
document.addEventListener('click', e => {
  if (e.target.closest('[onclick="openModal(\'modal-transakce\')"]') ||
      e.target.getAttribute('onclick') === "openModal('modal-transakce')") {
    // handled by the element's onclick - but we need to clear the form
    clearTransakceForm();
    document.getElementById('modal-transakce-title').textContent = '📒 Nový záznam';
    document.getElementById('t-datum').value = todayStr();
    setTransakceTyp('prijem');
  }
});

function clearTransakceForm() {
  ['t-doklad','t-popis','t-castka','t-poznamka'].forEach(id => setVal(id,''));
  setVal('t-ucet','hotovost');
  setVal('t-datum', todayStr());
  document.getElementById('t-id').value = '';
  document.getElementById('t-zdanitelny').checked = true;
  setTransakceTyp('prijem');
}

function editTransakce(id) {
  const t = state.transakce.find(x=>x.id===id);
  if (!t) return;
  clearTransakceForm();
  document.getElementById('modal-transakce-title').textContent = '✏️ Upravit záznam';
  document.getElementById('t-id').value = id;
  setTransakceTyp(t.typ);
  fillCategorySelect('t-kategorie', t.typ==='prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE);
  setVal('t-datum',     t.datum);
  setVal('t-doklad',    t.doklad||'');
  setVal('t-popis',     t.popis);
  setVal('t-kategorie', t.kategorie);
  setVal('t-ucet',      t.ucet);
  setVal('t-castka',    t.castka);
  setVal('t-poznamka',  t.poznamka||'');
  document.getElementById('t-zdanitelny').checked = !!t.zdanitelny;
  openModal('modal-transakce');
}
window.editTransakce = editTransakce;

async function saveTransakce() {
  const typ     = document.getElementById('t-typ').value;
  const datum   = getVal('t-datum');
  const popis   = getVal('t-popis').trim();
  const castka  = parseFloat(getVal('t-castka'));
  const kategorie = getVal('t-kategorie');
  const ucet    = getVal('t-ucet');

  if (!datum || !popis || isNaN(castka) || castka <= 0 || !kategorie) {
    showToast('Vyplň všechna povinná pole', 'error'); return;
  }

  const zdanitelny = document.getElementById('t-zdanitelny').checked;
  const data = {
    typ, datum, popis,
    doklad:    getVal('t-doklad'),
    castka,
    kategorie,
    ucet,
    zdanitelny,
    poznamka:  getVal('t-poznamka'),
  };

  const id = document.getElementById('t-id').value;
  try {
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('transakce', id), data);
      showToast('Záznam upraven', 'success');
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('transakce'), data);
      showToast('Záznam přidán', 'success');
    }
    closeModal('modal-transakce');
  } catch(e) {
    showToast('Chyba: ' + e.message, 'error');
  }
}
window.saveTransakce = saveTransakce;

// ── FAKTURY VYDANÉ CRUD ───────────────────────────────────────
let fvItems = [];

function openModalFakturaVydana() {
  fvItems = [{ popis:'', mnozstvi:1, cena:0 }];
  document.getElementById('modal-fv-title').textContent = '📄 Nová faktura vydaná';
  document.getElementById('fv-id').value = '';
  ['fv-cislo','fv-odberatel','fv-ico','fv-adresa-odb','fv-poznamka'].forEach(id=>setVal(id,''));
  setVal('fv-datum',    todayStr());
  setVal('fv-splatnost', addDays(todayStr(), 14));
  setVal('fv-duzp',     todayStr());
  setVal('fv-platba','prevod');
  setVal('fv-stav-modal','nezaplaceno');
  setVal('fv-datum-zaplaceni','');
  // Generate invoice number
  const lastNum = state.fakturyVydane.length;
  const rok = state.rok;
  setVal('fv-cislo', `${rok}${String(lastNum+1).padStart(3,'0')}`);
  renderFvItems();
  openModal('modal-faktura-vydana');
}
window.openModalFakturaVydana = openModalFakturaVydana;

function editFakturaVydana(id) {
  const f = state.fakturyVydane.find(x=>x.id===id);
  if (!f) return;
  fvItems = (f.polozky||[{popis:'',mnozstvi:1,cena:0}]).map(p=>({...p}));
  document.getElementById('modal-fv-title').textContent = '✏️ Upravit fakturu';
  document.getElementById('fv-id').value = id;
  setVal('fv-cislo',          f.cislo);
  setVal('fv-datum',          f.datum);
  setVal('fv-splatnost',      f.splatnost||'');
  setVal('fv-duzp',           f.duzp||'');
  setVal('fv-odberatel',      f.odberatel);
  setVal('fv-ico',            f.ico||'');
  setVal('fv-adresa-odb',     f.adresaOdberatele||'');
  setVal('fv-platba',         f.platba||'prevod');
  setVal('fv-stav-modal',     f.stav||'nezaplaceno');
  setVal('fv-datum-zaplaceni',f.datumZaplaceni||'');
  setVal('fv-poznamka',       f.poznamka||'');
  renderFvItems();
  openModal('modal-faktura-vydana');
}
window.editFakturaVydana = editFakturaVydana;

function addFvItem() {
  fvItems.push({ popis:'', mnozstvi:1, cena:0 });
  renderFvItems();
}
window.addFvItem = addFvItem;

function renderFvItems() {
  const tbody = document.getElementById('fv-items-body');
  tbody.innerHTML = fvItems.map((item, i) => `<tr>
    <td><input type="text" value="${esc(item.popis)}" oninput="fvItems[${i}].popis=this.value" placeholder="Popis položky" /></td>
    <td><input type="number" value="${item.mnozstvi}" min="1" step="1" oninput="fvItems[${i}].mnozstvi=Number(this.value);updateFvTotal()" style="width:60px;" /></td>
    <td><input type="number" value="${item.cena}" min="0" step="0.01" oninput="fvItems[${i}].cena=Number(this.value);updateFvTotal()" /></td>
    <td style="text-align:right;font-weight:600;color:var(--accent);">${fmtCzk((item.mnozstvi||1)*(item.cena||0))}</td>
    <td><button type="button" class="remove-item" onclick="removeFvItem(${i})" ${fvItems.length===1?'disabled':''}>✕</button></td>
  </tr>`).join('');
  updateFvTotal();
}

function removeFvItem(i) {
  if (fvItems.length <= 1) return;
  fvItems.splice(i, 1);
  renderFvItems();
}
window.removeFvItem = removeFvItem;

function updateFvTotal() {
  const total = fvItems.reduce((s,it)=>s+(it.mnozstvi||1)*(it.cena||0),0);
  setText('fv-total-display', fmtCzk(total));
}
window.updateFvTotal = updateFvTotal;

async function saveFakturaVydana() {
  const cislo     = getVal('fv-cislo').trim();
  const datum     = getVal('fv-datum');
  const odberatel = getVal('fv-odberatel').trim();
  if (!cislo||!datum||!odberatel||!fvItems.length) {
    showToast('Vyplň číslo, datum a odběratele', 'error'); return;
  }
  const polozky = fvItems.filter(it=>it.popis.trim());
  if (!polozky.length) { showToast('Přidej alespoň jednu položku s popisem','error'); return; }
  const celkem = polozky.reduce((s,it)=>s+(it.mnozstvi||1)*(it.cena||0),0);

  const data = {
    cislo, datum,
    splatnost: getVal('fv-splatnost'),
    duzp:      getVal('fv-duzp'),
    odberatel,
    ico:       getVal('fv-ico'),
    adresaOdberatele: getVal('fv-adresa-odb'),
    polozky, celkem,
    platba:    getVal('fv-platba'),
    stav:      getVal('fv-stav-modal'),
    datumZaplaceni: getVal('fv-datum-zaplaceni'),
    poznamka:  getVal('fv-poznamka'),
  };

  const id = getVal('fv-id');
  try {
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('fakturyVydane', id), data);
      showToast('Faktura upravena', 'success');
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('fakturyVydane'), data);
      showToast('Faktura přidána', 'success');
    }
    closeModal('modal-faktura-vydana');
  } catch(e) { showToast('Chyba: '+e.message,'error'); }
}
window.saveFakturaVydana = saveFakturaVydana;

// ── FAKTURY PŘIJATÉ CRUD ──────────────────────────────────────
function openModalFakturaPrijata() {
  document.getElementById('modal-fp-title').textContent = '📥 Nová přijatá faktura';
  document.getElementById('fp-id').value = '';
  ['fp-cislo','fp-dodavatel','fp-ico','fp-popis','fp-poznamka'].forEach(id=>setVal(id,''));
  setVal('fp-datum',    todayStr());
  setVal('fp-splatnost','');
  setVal('fp-castka',   '');
  setVal('fp-ucet',     'bank');
  setVal('fp-stav-modal','nezaplaceno');
  setVal('fp-datum-zaplaceni','');
  setVal('fp-kategorie-modal','');
  openModal('modal-faktura-prijata');
}
window.openModalFakturaPrijata = openModalFakturaPrijata;

function editFakturaPrijata(id) {
  const f = state.fakturyPrijate.find(x=>x.id===id);
  if (!f) return;
  document.getElementById('modal-fp-title').textContent = '✏️ Upravit přijatou fakturu';
  document.getElementById('fp-id').value = id;
  setVal('fp-cislo',          f.cislo);
  setVal('fp-datum',          f.datum);
  setVal('fp-splatnost',      f.splatnost||'');
  setVal('fp-dodavatel',      f.dodavatel);
  setVal('fp-ico',            f.ico||'');
  setVal('fp-popis',          f.popis||'');
  setVal('fp-castka',         f.castka);
  setVal('fp-ucet',           f.ucet||'bank');
  setVal('fp-stav-modal',     f.stav||'nezaplaceno');
  setVal('fp-datum-zaplaceni',f.datumZaplaceni||'');
  setVal('fp-kategorie-modal',f.kategorie||'');
  setVal('fp-poznamka',       f.poznamka||'');
  openModal('modal-faktura-prijata');
}
window.editFakturaPrijata = editFakturaPrijata;

async function saveFakturaPrijata() {
  const cislo    = getVal('fp-cislo').trim();
  const datum    = getVal('fp-datum');
  const dodavatel= getVal('fp-dodavatel').trim();
  const castka   = parseFloat(getVal('fp-castka'));
  const kategorie= getVal('fp-kategorie-modal');
  if (!cislo||!datum||!dodavatel||isNaN(castka)||castka<=0||!kategorie) {
    showToast('Vyplň všechna povinná pole','error'); return;
  }
  const data = {
    cislo, datum,
    splatnost:      getVal('fp-splatnost'),
    dodavatel,
    ico:            getVal('fp-ico'),
    popis:          getVal('fp-popis'),
    castka,
    kategorie,
    ucet:           getVal('fp-ucet'),
    stav:           getVal('fp-stav-modal'),
    datumZaplaceni: getVal('fp-datum-zaplaceni'),
    poznamka:       getVal('fp-poznamka'),
  };
  const id = getVal('fp-id');
  try {
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('fakturyPrijate',id),data);
      showToast('Faktura upravena','success');
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('fakturyPrijate'),data);
      showToast('Faktura přidána','success');
    }
    closeModal('modal-faktura-prijata');
  } catch(e) { showToast('Chyba: '+e.message,'error'); }
}
window.saveFakturaPrijata = saveFakturaPrijata;

// ── ZÁSOBY CRUD ───────────────────────────────────────────────
function editZasoba(id) {
  const z = state.zasoby.find(x=>x.id===id);
  if (!z) return;
  document.getElementById('modal-zasoba-title').textContent = '✏️ Upravit zásobu';
  document.getElementById('z-id').value = id;
  setVal('z-nazev',    z.nazev);
  setVal('z-datum',    z.datum);
  setVal('z-mnozstvi', z.mnozstvi);
  setVal('z-cena',     z.cenaNaKus);
  setVal('z-celkem',   z.celkemCena);
  setVal('z-poznamka', z.poznamka||'');
  openModal('modal-zasoba');
}
window.editZasoba = editZasoba;

function updateZasobaCelkem() {
  const mnoz = parseFloat(document.getElementById('z-mnozstvi')?.value)||1;
  const cena = parseFloat(document.getElementById('z-cena')?.value)||0;
  const celk = document.getElementById('z-celkem');
  if (celk) celk.value = (mnoz*cena).toFixed(2);
}
window.updateZasobaCelkem = updateZasobaCelkem;

async function saveZasoba() {
  const nazev  = getVal('z-nazev').trim();
  const datum  = getVal('z-datum');
  const mnoz   = parseInt(getVal('z-mnozstvi'))||1;
  const cena   = parseFloat(getVal('z-cena'));
  if (!nazev||!datum||isNaN(cena)||cena<0) {
    showToast('Vyplň název, datum a cenu','error'); return;
  }
  const data = {
    nazev, datum,
    mnozstvi:   mnoz,
    cenaNaKus:  cena,
    celkemCena: mnoz * cena,
    poznamka:   getVal('z-poznamka'),
  };
  const id = getVal('z-id');
  try {
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('zasoby',id),data);
      showToast('Zásoba upravena','success');
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('zasoby'),data);
      showToast('Zásoba přidána','success');
    }
    closeModal('modal-zasoba');
    // Also add mnozstvi listener
    document.getElementById('z-mnozstvi')?.addEventListener('input', updateZasobaCelkem);
  } catch(e) { showToast('Chyba: '+e.message,'error'); }
}
window.saveZasoba = saveZasoba;

// ── MAJETEK CRUD ──────────────────────────────────────────────
function editMajetek(id) {
  const m = state.majetek.find(x=>x.id===id);
  if (!m) return;
  document.getElementById('modal-majetek-title').textContent = '✏️ Upravit majetek';
  document.getElementById('m-id').value = id;
  setVal('m-nazev',  m.nazev);
  setVal('m-datum',  m.datumPorizeni);
  setVal('m-cena',   m.cenaPorizeni);
  setVal('m-skupina',m.skupina);
  setVal('m-metoda', m.metoda||'rovnomerne');
  setVal('m-popis',  m.popis||'');
  openModal('modal-majetek');
}
window.editMajetek = editMajetek;

async function saveMajetek() {
  const nazev = getVal('m-nazev').trim();
  const datum = getVal('m-datum');
  const cena  = parseFloat(getVal('m-cena'));
  if (!nazev||!datum||isNaN(cena)||cena<=0) {
    showToast('Vyplň název, datum a cenu','error'); return;
  }
  const data = {
    nazev,
    datumPorizeni: datum,
    cenaPorizeni:  cena,
    skupina:       parseInt(getVal('m-skupina')),
    metoda:        getVal('m-metoda'),
    popis:         getVal('m-popis'),
  };
  const id = getVal('m-id');
  try {
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('majetek',id),data);
      showToast('Majetek upraven','success');
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('majetek'),data);
      showToast('Majetek přidán','success');
    }
    closeModal('modal-majetek');
  } catch(e) { showToast('Chyba: '+e.message,'error'); }
}
window.saveMajetek = saveMajetek;

// ── MARK PAID ─────────────────────────────────────────────────
async function markFakturaPaid(typ, id) {
  const colName = typ==='vydane' ? 'fakturyVydane' : 'fakturyPrijate';
  try {
    const { updateDoc } = window._firebase;
    await updateDoc(docRef(colName, id), {
      stav: 'zaplaceno',
      datumZaplaceni: todayStr(),
    });
    showToast('Označeno jako zaplaceno','success');
  } catch(e) { showToast('Chyba: '+e.message,'error'); }
}
window.markFakturaPaid = markFakturaPaid;

// ── DELETE ────────────────────────────────────────────────────
let pendingDelete = null;

function confirmDelete(colName, id, label) {
  pendingDelete = { colName, id };
  document.getElementById('delete-text').textContent = `Opravdu chceš smazat tento ${label}? Tato akce je nevratná.`;
  document.getElementById('btn-confirm-delete').onclick = () => executeDelete();
  openModal('modal-delete');
}
window.confirmDelete = confirmDelete;

async function executeDelete() {
  if (!pendingDelete) return;
  const { colName, id } = pendingDelete;
  pendingDelete = null;
  try {
    const { deleteDoc } = window._firebase;
    await deleteDoc(docRef(colName, id));
    closeModal('modal-delete');
    showToast('Smazáno','success');
  } catch(e) { showToast('Chyba smazání: '+e.message,'error'); }
}

// ── BADGES ────────────────────────────────────────────────────
function updateBadges() {
  const today = new Date().toISOString().slice(0,10);
  const nezVydane  = state.fakturyVydane.filter(f=>f.stav!=='zaplaceno'&&f.splatnost&&f.splatnost<today).length;
  const nezPrijate = state.fakturyPrijate.filter(f=>f.stav!=='zaplaceno'&&f.splatnost&&f.splatnost<today).length;
  const bv = document.getElementById('badge-vydane');
  const bp = document.getElementById('badge-prijate');
  if (bv) { bv.textContent=nezVydane; bv.style.display=nezVydane?'inline':'none'; }
  if (bp) { bp.textContent=nezPrijate; bp.style.display=nezPrijate?'inline':'none'; }
}

// ── EXPORT CSV ────────────────────────────────────────────────
function exportCsv(type) {
  let rows, filename, headers;
  const rok = String(state.rok);

  if (type==='denik') {
    headers = ['Datum','Doklad','Popis','Typ','Kategorie','Účet','Částka','Zdanitelný'];
    rows = txByRok(rok).map(t=>[t.datum, t.doklad||'', esc2(t.popis), t.typ==='prijem'?'Příjem':'Výdaj',
      getCatLabel(t.kategorie,t.typ), t.ucet, t.castka, t.zdanitelny?'Ano':'Ne']);
    filename = `penezni-denik-${rok}.csv`;
  } else if (type==='faktury-vydane') {
    headers = ['Číslo','Datum','Splatnost','Odběratel','Celkem','Stav'];
    rows = state.fakturyVydane.filter(f=>f.datum?.startsWith(rok)).map(f=>
      [f.cislo, f.datum, f.splatnost||'', esc2(f.odberatel), f.celkem, f.stav]);
    filename = `faktury-vydane-${rok}.csv`;
  } else if (type==='faktury-prijate') {
    headers = ['Číslo','Datum','Splatnost','Dodavatel','Kategorie','Částka','Stav'];
    rows = state.fakturyPrijate.filter(f=>f.datum?.startsWith(rok)).map(f=>
      [f.cislo, f.datum, f.splatnost||'', esc2(f.dodavatel), getCatLabel(f.kategorie,'vydej'), f.castka, f.stav]);
    filename = `faktury-prijate-${rok}.csv`;
  } else if (type==='zasoby') {
    headers = ['Název','Datum','Množství','Cena/ks','Celkem'];
    rows = state.zasoby.map(z=>[esc2(z.nazev),z.datum,z.mnozstvi,z.cenaNaKus,z.celkemCena]);
    filename = `zasoby-${rok}.csv`;
  }

  const bom = '﻿';
  const csv = bom + [headers, ...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = filename;
  a.click();
  showToast('Export CSV stažen','success');
}
window.exportCsv = exportCsv;

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type='info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── UTILS ─────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function esc2(str) {
  return String(str||'').replace(/"/g,'""');
}

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function accountIcon(ucet) {
  const icons = { hotovost:'💵 Hotovost', bank:'🏦 Banka', revolut:'💳 Revolut' };
  return `<span class="account-badge">${icons[ucet]||ucet}</span>`;
}

// Pridaj event listener na z-mnozstvi vo formulari
document.getElementById('z-mnozstvi')?.addEventListener('input', updateZasobaCelkem);
document.getElementById('z-cena')?.addEventListener('input', updateZasobaCelkem);
