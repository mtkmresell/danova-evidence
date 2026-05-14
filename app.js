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

const DEFAULT_UCTY = [
  { id: 'hotovost', icon: '💵', label: 'Hotovost' },
  { id: 'bank',     icon: '🏦', label: 'Podnikatelský účet' },
  { id: 'revolut',  icon: '💳', label: 'Revolut Business' },
];

function getUcty() {
  return state.nastaveni.ucty?.length ? state.nastaveni.ucty : DEFAULT_UCTY;
}

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
  skladItems: [],
  majetek: [],
  nastaveni: {},
  unsubs: [],
  sortDirs: { denik: 'desc', fakturyVydane: 'desc', fakturyPrijate: 'desc', zasoby: 'desc', majetek: 'desc' },
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

  // Custom category toggle
  document.getElementById('t-kategorie').addEventListener('change', () => {
    const isCustom = document.getElementById('t-kategorie').value === '___custom___';
    const customGroup = document.getElementById('t-kategorie-custom-group');
    if (customGroup) customGroup.style.display = isCustom ? '' : 'none';
    if (isCustom) document.getElementById('t-kategorie-custom')?.focus();
  });

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

  // Auto-update pending EUR rates (ČNB publishes around 14:30)
  setTimeout(() => _autoUpdatePendingKurzy(), 3000);
  setInterval(() => _autoUpdatePendingKurzy(), 30 * 60 * 1000);

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
  if (sel._cs) sel._cs.updateLabel();
  sel.addEventListener('change', () => {
    state.rok = parseInt(sel.value);
    refreshAll();
  });
}

function fillCategorySelect(id, cats) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  const isPrijem = cats === PRIJMY_KATEGORIE;
  const customCats = isPrijem
    ? (state.nastaveni.custom_prijmy || [])
    : (state.nastaveni.custom_vydaje || []);
  [...cats, ...customCats].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.zdanitelny ? c.label : `⚪ ${c.label}`;
    sel.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = '___custom___';
  customOpt.textContent = '✏️ Vlastní...';
  sel.appendChild(customOpt);
  if (sel._cs) sel._cs.updateLabel();
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
    if (filter._cs) filter._cs.updateLabel();
  }
}

// ── FIRESTORE SUBSCRIPTIONS ───────────────────────────────────
function subscribeData() {
  const { onSnapshot, query, orderBy } = window._firebase;
  state.unsubs.forEach(u => u());
  state.unsubs = [];

  const sub = (colName, stateKey, sortField) => {
    const q = query(col(colName), orderBy(sortField, 'desc'));
    const unsub = onSnapshot(q, snap => {
      state[stateKey] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      scheduleRefresh();
    }, err => console.error(colName, err));
    state.unsubs.push(unsub);
  };

  sub('transakce',       'transakce',      'datum');
  sub('fakturyVydane',   'fakturyVydane',  'datum');
  sub('fakturyPrijate',  'fakturyPrijate', 'datum');
  sub('zasoby',          'zasoby',         'datum');
  sub('majetek',         'majetek',        'datumPorizeni');
}

// Sekce označené jako zastaralé — vykreslí se při přechodu na ně
const _dirty = new Set();

// Spouští refresh max jednou za 80 ms bez ohledu na počet příchozích snapshotů
let _refreshTimer = null;
function scheduleRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => { _refreshTimer = null; refreshAll(); }, 80);
}

function _renderSection(id) {
  switch (id) {
    case 'dashboard':       renderDashboard();       break;
    case 'penezni-denik':   renderDenik();           break;
    case 'faktury-vydane':  renderFakturyVydane();   break;
    case 'faktury-prijate': renderFakturyPrijate();  break;
    case 'zasoby':          renderZasoby();          break;
    case 'majetek':         renderMajetek();         break;
    case 'danovy-prehled':  renderDanovyPrehled();   break;
  }
}

function refreshAll() {
  updateBadges();
  checkAutoBackup();
  const active = document.querySelector('.section.active')?.id;
  if (active) {
    _renderSection(active);
    _dirty.delete(active);
  }
  // Ostatní sekce označíme jako zastaralé — vykreslí se až při přechodu
  ['dashboard','penezni-denik','faktury-vydane','faktury-prijate','zasoby','majetek','danovy-prehled']
    .forEach(id => { if (id !== active) _dirty.add(id); });
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

  // Pokud má sekce zastaralá data, překresli ji teď
  if (_dirty.has(sectionId)) {
    _renderSection(sectionId);
    _dirty.delete(sectionId);
  }
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

function toggleSort(section) {
  state.sortDirs[section] = state.sortDirs[section] === 'desc' ? 'asc' : 'desc';
  const renders = { denik: renderDenik, fakturyVydane: renderFakturyVydane, fakturyPrijate: renderFakturyPrijate, zasoby: renderZasoby, majetek: renderMajetek };
  if (renders[section]) renders[section]();
}
window.toggleSort = toggleSort;

function updateSortBtn(section) {
  const btn = document.getElementById('sort-btn-' + section);
  if (!btn) return;
  btn.textContent = (state.sortDirs[section] || 'desc') === 'desc' ? '↓ Nejnovější' : '↑ Nejstarší';
}

function cmpDate(a, b, dir) {
  return dir === 'desc' ? (b||'').localeCompare(a||'') : (a||'').localeCompare(b||'');
}

// Extrahuje číselnou část z čísla dokladu pro numerické řazení
// "P202600004" → 202600004, "2026003" → 2026003, "FV2026001" → 2026001
function _cisloNum(s) { return parseInt((s||'').replace(/\D/g,'')) || 0; }

function cmpCislo(a, b, dir) {
  const diff = _cisloNum(b) - _cisloNum(a);
  return dir === 'desc' ? diff : -diff;
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
  const eurMap = _buildEurRateMap();
  return (state.skladItems || [])
    .filter(i => i.homeDate && i.saleState !== 'paid')
    .reduce((s, i) => {
      const price = Number(i.buyPrice||0);
      if ((i.buyCurrency||'CZK').toUpperCase() === 'CZK') return s + price;
      const rate = i.orderNum ? eurMap[i.orderNum] : null;
      return s + (rate ? Math.round(price * rate * 100) / 100 : price);
    }, 0);
}

function _buildEurRateMap() {
  const map = {};
  state.transakce.forEach(t => { if (t.doklad && t.kurzCnb) map[t.doklad] = t.kurzCnb; });
  return map;
}

function _buildSkladDokladMap() {
  const map = {};
  state.transakce.forEach(t => {
    if (t.doklad && t.skladIds && Array.isArray(t.skladIds)) {
      t.skladIds.forEach(id => { map[id] = t.doklad; });
    }
  });
  return map;
}

async function _getNextIdNumber(year) {
  const pattern = new RegExp('^ID' + year + '\\d{5}$');
  let maxNum = 0;
  state.transakce.forEach(t => {
    if (t.doklad && pattern.test(t.doklad)) {
      const n = parseInt(t.doklad.slice(-5));
      if (n > maxNum) maxNum = n;
    }
  });
  const storedMax = (state.nastaveni.idCounters || {})[String(year)] || 0;
  const nextNum = Math.max(maxNum, storedMax) + 1;
  // Update in-memory immediately so next call within same sync gets correct next number
  if (!state.nastaveni.idCounters) state.nastaveni.idCounters = {};
  state.nastaveni.idCounters[String(year)] = nextNum;
  const { updateDoc } = window._firebase;
  await updateDoc(docRef('nastaveni', 'config'), { [`idCounters.${year}`]: nextNum });
  return 'ID' + year + String(nextNum).padStart(5, '0');
}

// ── FORMATOVANI ───────────────────────────────────────────────
function fmtCzk(amount) {
  if (isNaN(amount)) return '0 Kč';
  return new Intl.NumberFormat('cs-CZ', { style:'currency', currency:'CZK', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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
  const found = arr.find(c => c.id === id);
  if (found) return found.label;
  const customArr = typ === 'prijem'
    ? (state.nastaveni.custom_prijmy || [])
    : (state.nastaveni.custom_vydaje || []);
  return customArr.find(c => c.id === id)?.label || id;
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

  // Účty — dynamicky
  const grid = document.getElementById('accounts-grid');
  if (grid) {
    grid.innerHTML = getUcty().map(u => {
      const bal = balanceAccount(u.id);
      const cls = bal >= 0 ? 'positive' : 'negative';
      return `<div class="account-card">
        <div class="account-card-top">
          <span class="account-icon">${u.icon}</span>
          <span class="account-label">${esc(u.label)}</span>
        </div>
        <div class="account-balance ${cls}">${fmtCzk(bal)}</div>
      </div>`;
    }).join('');
  }

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
        <td class="td-amount-income">${t.typ==='prijem' ? fmtCzk(t.castka)+(t.kurzPending?' ⚠️':'') : ''}</td>
        <td class="td-amount-expense">${t.typ==='vydej' ? fmtCzk(t.castka)+(t.kurzPending?' ⚠️':'') : ''}</td>
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
  const _dDir = state.sortDirs.denik || 'desc';
  tx.sort((a, b) => cmpDate(a.datum, b.datum, _dDir));
  updateSortBtn('denik');

  // Summary (always full year)
  const allTx = txByRok(rok);
  const prijmyZd = sumTx(allTx,'prijem',true);
  const vydajeZd = sumTx(allTx,'vydej',true);
  setText('sum-prijmy-zd', fmtCzk(prijmyZd));
  setText('sum-vydaje-zd', fmtCzk(vydajeZd));
  setText('sum-zaklad', fmtCzk(prijmyZd - vydajeZd));
  const sumUctyContainer = document.getElementById('sum-ucty-container');
  if (sumUctyContainer) {
    sumUctyContainer.innerHTML = getUcty().map(u => `
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-item-label">${esc(u.label)}</span>
        <span class="summary-item-value">${fmtCzk(balanceAccount(u.id))}</span>
      </div>`).join('');
  }

  const tbody = document.getElementById('denik-tbody');
  if (!tx.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📒</div><h3>Žádné záznamy</h3><p>Uprav filtry nebo přidej nový záznam</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = tx.map(t => {
    const katLabel = getCatLabel(t.kategorie, t.typ);
    const shortKat = katLabel.length > 28 ? katLabel.substring(0,28)+'…' : katLabel;
    const dokladCell = t.dokladUrl
      ? `<a href="${esc(t.dokladUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--accent);">${esc(t.doklad||'—')}</a>`
      : esc(t.doklad||'—');
    return `<tr style="cursor:pointer;" onclick="showTransakceDetail('${t.id}')">
      <td class="td-muted" style="white-space:nowrap;">${fmtDate(t.datum)}</td>
      <td class="td-muted">${dokladCell}</td>
      <td>${esc(t.popis)}</td>
      <td><span title="${esc(katLabel)}" class="td-muted" style="font-size:0.78rem;">${esc(shortKat)}</span></td>
      <td>${accountIcon(t.ucet)}</td>
      <td class="td-amount-income">${t.typ==='prijem' ? fmtCzk(t.castka)+(t.kurzPending?' ⚠️':'') : ''}</td>
      <td class="td-amount-expense">${t.typ==='vydej' ? fmtCzk(t.castka)+(t.kurzPending?' ⚠️':'') : ''}</td>
      <td>${t.zdanitelny ? '<span class="badge badge-income">Ano</span>' : '<span class="badge badge-neutral">Ne</span>'}</td>
      <td class="td-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon" onclick="editTransakce('${t.id}')" title="Upravit">✏️</button>
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('transakce','${t.id}','záznam',${JSON.stringify(t.popis||'')})" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
window.renderDenik = renderDenik;

function showTransakceDetail(id) {
  const t = state.transakce.find(x => x.id === id);
  if (!t) return;
  const catLabel = getCatLabel(t.kategorie, t.typ);
  const u = getUcty().find(x => x.id === t.ucet);
  const ucetLabel = u ? `${u.icon} ${esc(u.label)}` : esc(t.ucet || '—');

  // Look up invoiceUrl from live SKLAD items if this record has skladIds
  let dokladUrl = t.dokladUrl || null;
  if (!dokladUrl && t.skladIds && Array.isArray(t.skladIds)) {
    const hit = (state.skladItems || []).find(i => t.skladIds.includes(i.id) && i.invoiceUrl);
    if (hit) dokladUrl = hit.invoiceUrl;
  }
  const dokladHtml = dokladUrl
    ? `<a href="${esc(dokladUrl)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;">${esc(t.doklad || '—')} 📎</a>`
    : esc(t.doklad || '—');

  const typBadge = t.typ === 'prijem'
    ? '<span class="badge badge-income">↑ Příjem</span>'
    : '<span class="badge badge-expense">↓ Výdaj</span>';
  const amountColor = t.typ === 'prijem' ? 'var(--income,var(--success))' : 'var(--expense,var(--danger))';

  const row = (label, val) => `<div style="display:flex;gap:1rem;align-items:baseline;">
        <span style="min-width:130px;font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">${label}</span>
        <span>${val}</span>
      </div>`;

  document.getElementById('detail-title').textContent = t.typ === 'prijem' ? '↑ Detail příjmu' : '↓ Detail výdaje';
  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${row('Typ', typBadge)}
      ${row('Datum', fmtDate(t.datum))}
      ${row('Doklad č.', dokladHtml)}
      ${row('Popis', esc(t.popis))}
      ${row('Daňový vliv', t.zdanitelny ? '<span class="badge badge-income">Ano</span>' : '<span class="badge badge-neutral">Ne</span>')}
      <div style="display:flex;gap:1rem;align-items:baseline;">
        <span style="min-width:130px;font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">Částka</span>
        <span style="font-weight:700;font-size:1.15rem;color:${amountColor};">${fmtCzk(t.castka)}</span>
      </div>
      ${t.kurzCnb ? `
      ${row('Původní částka', `<span style="font-weight:600;">${t.castkaCizi} ${t.menaCizi}</span>`)}
      <div style="display:flex;gap:1rem;align-items:baseline;">
        <span style="min-width:130px;font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">Kurz ČNB</span>
        <span>1 ${t.menaCizi} = <strong>${t.kurzCnb} CZK</strong>${t.kurzDatum ? ` <a href="${t.kurzUrl || '#'}" target="_blank" rel="noopener" style="font-size:0.82rem;color:var(--text-muted);">(kurz ČNB ke dni ${fmtDate(t.kurzDatum)}${t.kurzDatum !== t.datum ? `, použito pro transakci ${fmtDate(t.datum)}` : ''})</a>${t.kurzStazeno ? ` <span style="font-size:0.78rem;color:var(--text-muted);">· staženo ${new Date(t.kurzStazeno).toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>` : ''}` : ''}</span>
      </div>
      ${t.kurzPending ? `<div style="display:flex;gap:1rem;align-items:flex-start;">
        <span style="min-width:130px;"></span>
        <div style="background:rgba(255,180,0,0.12);border:1px solid rgba(255,180,0,0.4);border-radius:8px;padding:0.6rem 0.9rem;font-size:0.85rem;">
          ⚠️ Dnešní kurz ČNB ještě nebyl vyhlášen (zveřejnění kolem 14:30). Použit kurz ze dne ${fmtDate(t.kurzDatum)}.
          <br><button onclick="aktualizujKurz('${id}')" style="margin-top:0.5rem;padding:0.3rem 0.8rem;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);cursor:pointer;font-size:0.82rem;">🔄 Aktualizovat kurz</button>
        </div>
      </div>` : ''}` : ''}
      ${row('Účet', ucetLabel)}
      ${row('Kategorie', `<span style="font-size:0.88rem;">${esc(catLabel)}</span>`)}
      ${t.poznamka ? row('Poznámka', `<span style="font-size:0.88rem;color:var(--text-secondary);">${esc(t.poznamka)}</span>`) : ''}
    </div>`;

  document.getElementById('detail-edit-btn').onclick = () => {
    closeModal('modal-transakce-detail');
    editTransakce(id);
  };
  document.getElementById('detail-delete-btn').onclick = () => {
    closeModal('modal-transakce-detail');
    confirmDelete('transakce', id, 'záznam', t.popis||'');
  };
  openModal('modal-transakce-detail');
}
window.showTransakceDetail = showTransakceDetail;

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

  const _fvDir = state.sortDirs.fakturyVydane || 'desc';
  data.sort((a, b) => cmpCislo(a.cislo, b.cislo, _fvDir));
  updateSortBtn('fakturyVydane');

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
        <button class="btn btn-ghost btn-icon" onclick="exportIsdoc('${f.id}')" title="Stáhnout ISDOC (XML faktura)">📄</button>
        ${f.stav!=='zaplaceno' ? `<button class="btn btn-ghost btn-icon" onclick="markFakturaPaid('vydane','${f.id}')" title="Označit jako zaplaceno">✅</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('fakturyVydane','${f.id}','fakturu',${JSON.stringify(f.cislo||'')})" title="Smazat">🗑</button>
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
  const _fpDir = state.sortDirs.fakturyPrijate || 'desc';
  data.sort((a, b) => cmpCislo(a.cislo, b.cislo, _fpDir));
  updateSortBtn('fakturyPrijate');

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
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('fakturyPrijate','${f.id}','fakturu',${JSON.stringify(f.cislo||f.dodavatel||'')})" title="Smazat">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
window.renderFakturyPrijate = renderFakturyPrijate;

// ── ZÁSOBY ────────────────────────────────────────────────────
let _zasobyPohyby = [];

function getPohybKey(p) {
  return p.source === 'manual' ? 'manual__' + p.manualId : (p.skladId || '') + '__' + (p.skladTyp || p.typ);
}

let _savingCisla = false;
async function _saveCislaToFirestore() {
  if (_savingCisla) return;
  _savingCisla = true;
  try {
    const { db, doc, setDoc } = window._firebase;
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), {
      zasobyDokladyCisla: state.nastaveni.zasobyDokladyCisla || {}
    }, { merge: true });
  } catch(e) { console.warn('[ZÁSOBY] Chyba ukládání čísel dokladů', e); }
  _savingCisla = false;
}

function assignDokladCisla(pohyby) {
  const cisla = state.nastaveni.zasobyDokladyCisla || {};
  let changed = false;
  // Procházej v chronologickém pořadí aby čísla odpovídala datumu
  const sorted = [...pohyby].sort((a, b) => (a.datum||'').localeCompare(b.datum||''));
  sorted.forEach(p => {
    const key = getPohybKey(p);
    if (!key || key === '__') return;
    if (cisla[key]) { p.cisloDokladu = cisla[key]; return; }
    const year   = (p.datum||new Date().toISOString()).slice(0,4);
    const prefix = p.typ === 'prijem' ? 'P' : 'V';
    // Derive next number from actual cisla map — stays correct even after user resets records
    const regex = new RegExp('^' + prefix + year + '(\\d+)$');
    let maxN = 0;
    Object.values(cisla).forEach(c => {
      const m = c.match(regex);
      if (m) { const n = parseInt(m[1]); if (n > maxN) maxN = n; }
    });
    const cislo = `${prefix}${year}${String(maxN + 1).padStart(5,'0')}`;
    cisla[key]  = cislo;
    p.cisloDokladu = cislo;
    changed = true;
  });
  if (changed) {
    state.nastaveni.zasobyDokladyCisla = cisla;
    _saveCislaToFirestore();
  }
}

function renderZasoby() {
  const items = state.skladItems || [];
  const syncEnabled = state.nastaveni.skladSyncEnabled;

  const pohyby = [];

  // Auto ze SKLAD.
  const hidden = state.nastaveni.zasobyHiddenIds || [];
  const eurMap = _buildEurRateMap();
  const dokladMap = _buildSkladDokladMap();
  items.filter(i => i.homeDate).forEach(i => {
    const rawPrice = Number(i.buyPrice||0);
    const isEur = (i.buyCurrency||'CZK').toUpperCase() === 'EUR';
    const dokladCislo = dokladMap[i.id] || i.orderNum || '';
    const eurRate = isEur && dokladCislo ? eurMap[dokladCislo] : null;
    const cenaEurBezKurzu = isEur && !eurRate;
    const cenaCzk = isEur ? (eurRate ? Math.round(rawPrice * eurRate * 100) / 100 : rawPrice) : rawPrice;
    const cenaOrigEur = isEur ? rawPrice : null;

    if (!hidden.includes(i.id + '__prijem')) {
      pohyby.push({
        datum: i.homeDate, nazev: i.name||'—', typ: 'prijem',
        cena: cenaCzk, mena: 'CZK', source: 'sklad',
        skladId: i.id, skladTyp: 'prijem', ks: i.qty||1,
        dokladRef: dokladCislo, cenaOrigEur, cenaEurBezKurzu,
        detail: { typ: 'prijem', kategorie: i.category, velikost: i.size, stav: i.condition,
                  buyDate: i.buyDate, buyWhere: i.buyWhere, orderNum: i.orderNum,
                  location: i.location, invoiceUrl: i.invoiceUrl, note: i.note,
                  cenaOrigEur, eurRate }
      });
    }
    if (i.saleState === 'paid' && !hidden.includes(i.id + '__vydej')) {
      pohyby.push({
        datum: i.payoutDate||i.saleDate||i.homeDate, nazev: i.name||'—', typ: 'vydej',
        cena: cenaCzk, mena: 'CZK', source: 'sklad',
        skladId: i.id, skladTyp: 'vydej', ks: i.qty||1,
        dokladRef: i.saleRef||dokladCislo, cenaOrigEur, cenaEurBezKurzu,
        detail: { typ: 'vydej', saleDate: i.saleDate, payoutDate: i.payoutDate,
                  soldWhere: i.soldWhere, sellPrice: i.sellPrice, sellCurrency: i.sellCurrency||'CZK',
                  profit: i.profit, buyPrice: i.buyPrice, buyCurrency: i.buyCurrency||'CZK',
                  saleRef: i.saleRef||'', cenaOrigEur, eurRate }
      });
    }
  });

  // Manuální záznamy
  (state.zasoby || []).forEach(z => {
    pohyby.push({
      datum: z.datum, nazev: z.nazev||'—', typ: z.typ||'prijem',
      cena: Number(z.cena||0), mena: z.mena||'CZK', source: 'manual', manualId: z.id,
      ks: z.ks||1, dokladRef: z.dokladRef||z.saleRef||'', cenaOrigEur: null,
      detail: { typ: z.typ, poznamka: z.poznamka||'', ks: z.ks||1, dokladRef: z.dokladRef||z.saleRef||'' }
    });
  });

  assignDokladCisla(pohyby);
  const _zDir = state.sortDirs.zasoby || 'desc';
  pohyby.sort((a, b) => {
    const dc = cmpDate(a.datum, b.datum, _zDir);
    if (dc !== 0) return dc;
    // Stejné datum: seřadit dle číselné části dokladu (5 číslic za prefixem)
    const na = parseInt((a.cisloDokladu||'').slice(-5)) || 0;
    const nb = parseInt((b.cisloDokladu||'').slice(-5)) || 0;
    return _zDir === 'desc' ? nb - na : na - nb;
  });
  updateSortBtn('zasoby');
  _zasobyPohyby = pohyby;

  // Stats derived from pohyby so hidden records don't count
  const prijmy = pohyby.filter(p => p.typ === 'prijem');
  const vydeje = pohyby.filter(p => p.typ === 'vydej');
  const soldSkladIds = new Set(vydeje.filter(p => p.source === 'sklad').map(p => p.skladId));
  const naSkladePrijmy = prijmy.filter(p => p.source === 'sklad' && !soldSkladIds.has(p.skladId));
  const hodnotaSkladu = naSkladePrijmy.reduce((s, p) => s + (p.cenaEurBezKurzu ? 0 : p.cena), 0);

  setText('zasoby-pocet',   naSkladePrijmy.length + prijmy.filter(p => p.source === 'manual').length);
  setText('zasoby-hodnota', fmtCzk(hodnotaSkladu));
  setText('zasoby-prijmu',  prijmy.length);
  setText('zasoby-vydeju',  vydeje.length);

  const tbody = document.getElementById('zasoby-tbody');
  if (!pohyby.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><h3>Zatím žádné pohyby</h3><p>${syncEnabled ? 'Pohyby se zobrazí po přijetí prvního zboží na sklad' : 'Připoj SKLAD. v Nastavení nebo přidej pohyb ručně'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = pohyby.map((p, idx) => `<tr style="cursor:pointer;" onclick="openPohybDetail(${idx})">
    <td class="td-muted" style="white-space:nowrap;font-size:0.78rem;font-family:monospace;">${esc(p.cisloDokladu||'…')}</td>
    <td class="td-muted" style="white-space:nowrap;">${fmtDate(p.datum)||'—'}</td>
    <td><strong>${esc(p.nazev)}</strong></td>
    <td>${p.typ === 'prijem'
      ? `<span style="color:var(--success);font-weight:600;">↓ Příjem</span>`
      : `<span style="color:var(--text-secondary);">↑ Výdej</span>`}</td>
    <td style="text-align:right;">${p.ks||1}</td>
    <td class="${p.typ === 'prijem' ? 'td-amount-income' : 'td-amount-expense'}" style="text-align:right;">${p.cenaEurBezKurzu ? `<span style="color:var(--danger);font-weight:700;">⚠️ ${p.cenaOrigEur} €</span>` : fmtCzk(p.cena) + (p.cenaOrigEur != null ? `<span style="font-size:0.72rem;color:var(--text-muted);display:block;">(${p.cenaOrigEur} €)</span>` : '')}</td>
    <td style="font-size:0.78rem;color:var(--text-muted);">${esc(p.dokladRef)||'—'}</td>
  </tr>`).join('');
}

function openPohybDetail(idx) {
  const p = _zasobyPohyby[idx];
  if (!p) return;

  // Use live SKLAD data for descriptive fields so edits in SKLAD are reflected immediately
  const live = p.source === 'sklad' ? (state.skladItems||[]).find(i => i.id === p.skladId) : null;
  const d = p.detail || {};

  const typLabel = p.typ === 'prijem'
    ? `<span style="color:var(--success);font-weight:700;">↓ Příjem na sklad</span>`
    : `<span style="color:var(--text-secondary);font-weight:700;">↑ Výdej ze skladu</span>`;
  const sourceLabel = p.source === 'manual'
    ? `<span style="font-size:0.75rem;color:var(--text-muted);">✏️ Manuální záznam</span>`
    : `<span style="font-size:0.75rem;color:var(--text-muted);">🔗 Ze SKLAD.</span>`;
  const ksLabel = `<span style="font-size:0.75rem;color:var(--text-muted);">${p.ks||1} ks</span>`;

  const row = (label, val) => val ? `<tr><td style="color:var(--text-muted);font-size:0.82rem;padding:6px 0;width:45%;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:0.82rem;">${val}</td></tr>` : '';
  let rows = '';

  if (p.source === 'sklad' && d.typ === 'prijem') {
    rows += row('Datum přijetí',  fmtDate(p.datum));
    rows += row('Datum nákupu',   fmtDate(live?.buyDate ?? d.buyDate));
    rows += row('Nák. cena',      fmtCzk(p.cena));
    if (d.cenaOrigEur != null) rows += row('Nák. cena (EUR)', `${d.cenaOrigEur} €${d.eurRate ? ` × kurz ${d.eurRate}` : ' · kurz nedostupný'}`);
    rows += row('Kde koupeno',    esc(live?.buyWhere ?? d.buyWhere));
    rows += row('Č. objednávky',  esc(live?.orderNum ?? d.orderNum));
    rows += row('Kategorie',      esc(live?.category ?? d.kategorie));
    rows += row('Stav',           esc(live?.condition ?? d.stav));
    rows += row('Sklad',          esc(live?.location ?? d.location));
    if ((live?.invoiceUrl ?? d.invoiceUrl)) rows += row('Faktura', `<a href="${esc(live?.invoiceUrl ?? d.invoiceUrl)}" target="_blank" style="color:var(--accent);">Otevřít</a>`);
    rows += row('Poznámka',       esc(live?.note ?? d.note));
  } else if (p.source === 'sklad' && d.typ === 'vydej') {
    rows += row('Datum výdeje',   fmtDate(p.datum));
    rows += row('Datum prodeje',  fmtDate(live?.saleDate ?? d.saleDate));
    rows += row('Kde prodáno',    esc(live?.soldWhere ?? d.soldWhere));
    rows += row('Doklad prodeje', esc(live?.saleRef ?? d.saleRef));
    rows += row('Prodejní cena',  d.sellPrice ? fmtCzk(d.sellPrice) + (d.sellCurrency !== 'CZK' ? ' ' + d.sellCurrency : '') : null);
    rows += row('Nák. cena',      fmtCzk(p.cena));
    if (d.cenaOrigEur != null) rows += row('Nák. cena (EUR)', `${d.cenaOrigEur} € × kurz ${d.eurRate||'?'}`);
    rows += row('Zisk',           d.profit != null ? fmtCzk(d.profit) : null);
  } else {
    rows += row('Datum',                  fmtDate(p.datum));
    rows += row('Nák. cena',             fmtCzk(p.cena));
    rows += row('Doklad nákupu/prodeje',  esc(d.dokladRef));
    rows += row('Poznámka',              esc(d.poznamka));
  }

  if (p.cisloDokladu) rows = row('Č. dokladu', `<span style="font-family:monospace;font-weight:700;">${esc(p.cisloDokladu)}</span>`) + rows;
  document.getElementById('pohyb-detail-title').textContent = p.nazev;
  document.getElementById('pohyb-detail-meta').innerHTML = `${typLabel} &nbsp;·&nbsp; ${sourceLabel} &nbsp;·&nbsp; ${ksLabel}`;
  document.getElementById('pohyb-detail-rows').innerHTML = rows || '<tr><td colspan="2" style="color:var(--text-muted);font-size:0.82rem;">Bez dalších detailů</td></tr>';
  const delBtn = document.getElementById('pohyb-detail-delete');
  if (delBtn) {
    delBtn.style.display = '';
    if (p.source === 'manual') {
      delBtn.onclick = () => { closeModal('modal-pohyb-detail'); confirmDelete('zasoby', p.manualId, 'pohyb', p.nazev); };
    } else {
      delBtn.onclick = () => { closeModal('modal-pohyb-detail'); confirmDelete(null, null, 'pohyb ze zásoby', p.nazev, () => hideSkladPohyb(p.skladId, p.skladTyp)); };
    }
  }
  openModal('modal-pohyb-detail');
}
window.openPohybDetail = openPohybDetail;

async function hideSkladPohyb(skladId, skladTyp) {
  if (!skladId || !skladTyp) return;
  const key = skladId + '__' + skladTyp;
  const current = state.nastaveni.zasobyHiddenIds || [];
  if (current.includes(key)) { closeModal('modal-pohyb-detail'); return; }
  const updated = [...current, key];
  state.nastaveni.zasobyHiddenIds = updated;
  closeModal('modal-pohyb-detail');
  renderZasoby();
  try {
    const { db, doc, setDoc } = window._firebase;
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), { zasobyHiddenIds: updated }, { merge: true });
    showToast('Pohyb skryt', 'success');
  } catch(e) { showToast('Chyba ukládání: '+e.message, 'error'); }
}
window.hideSkladPohyb = hideSkladPohyb;

function openAddPohybModal() {
  document.getElementById('mp-id').value = '';
  document.getElementById('mp-datum').value = new Date().toISOString().slice(0,10);
  document.getElementById('mp-nazev').value = '';
  document.getElementById('mp-typ').value = 'prijem';
  document.getElementById('mp-cena').value = '';
  document.getElementById('mp-mena').value = 'CZK';
  document.getElementById('mp-ks').value = '1';
  document.getElementById('mp-saleref').value = '';
  document.getElementById('mp-poznamka').value = '';
  openModal('modal-pohyb');
}
window.openAddPohybModal = openAddPohybModal;

async function saveManualPohyb() {
  const datum   = document.getElementById('mp-datum')?.value;
  const nazev   = document.getElementById('mp-nazev')?.value.trim();
  const typ     = document.getElementById('mp-typ')?.value;
  const cena    = parseFloat(document.getElementById('mp-cena')?.value);
  const mena    = document.getElementById('mp-mena')?.value || 'CZK';
  const ks       = parseInt(document.getElementById('mp-ks')?.value)||1;
  const dokladRef = document.getElementById('mp-saleref')?.value.trim()||'';
  const pozn     = document.getElementById('mp-poznamka')?.value.trim();
  if (!datum || !nazev || isNaN(cena) || cena < 0) {
    showToast('Vyplň datum, název a cenu', 'error'); return;
  }
  try {
    const id = document.getElementById('mp-id')?.value;
    const data = { datum, nazev, typ, cena, mena, ks, dokladRef, poznamka: pozn };
    if (id) {
      const { updateDoc } = window._firebase;
      await updateDoc(docRef('zasoby', id), data);
    } else {
      const { addDoc } = window._firebase;
      await addDoc(col('zasoby'), data);
    }
    showToast('Pohyb uložen', 'success');
    closeModal('modal-pohyb');
  } catch(e) { showToast('Chyba: ' + e.message, 'error'); }
}
window.saveManualPohyb = saveManualPohyb;

// ── DLOUHODOBÝ MAJETEK ────────────────────────────────────────
function renderMajetek() {
  const rok = parseInt(state.rok);
  const _mDir = state.sortDirs.majetek || 'desc';
  const data = [...state.majetek].sort((a, b) => cmpDate(a.datumPorizeni, b.datumPorizeni, _mDir));
  updateSortBtn('majetek');
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
        <button class="btn btn-ghost btn-icon" onclick="confirmDelete('majetek','${m.id}','majetek',${JSON.stringify(m.nazev||'')})" title="Smazat">🗑</button>
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
  fillAccountSelects();
  renderUctyList();
  renderKategorieList('prijem');
  renderKategorieList('vydej');

  // Restore SKLAD. sync if enabled
  if (state.nastaveni.skladSyncEnabled && state.nastaveni.skladUid) {
    const { skladAuth, onAuthStateChanged } = window._sklad;
    onAuthStateChanged(skladAuth, user => {
      if (user) {
        _startSkladListener(state.nastaveni.skladUid);
        _showSkladConnected();
      } else {
        _showSkladDisconnected();
      }
    });
  }
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
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), data, { merge: true });
    Object.assign(state.nastaveni, data);
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
  // Update category options and hide custom input
  fillCategorySelect('t-kategorie', typ==='prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE);
  const customGroup = document.getElementById('t-kategorie-custom-group');
  if (customGroup) customGroup.style.display = 'none';
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
  ['t-doklad','t-doklad-url','t-popis','t-castka','t-poznamka','t-kategorie-custom'].forEach(id => setVal(id,''));
  const firstUcet = getUcty()[0]?.id || 'hotovost';
  setVal('t-ucet', firstUcet);
  setVal('t-datum', todayStr());
  document.getElementById('t-id').value = '';
  document.getElementById('t-zdanitelny').checked = true;
  const sel = document.getElementById('t-mena');
  if (sel) sel.value = 'CZK';
  _onMenaChange();
  const customGroup = document.getElementById('t-kategorie-custom-group');
  if (customGroup) customGroup.style.display = 'none';
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
  setVal('t-doklad-url', t.dokladUrl||'');
  setVal('t-popis',     t.popis);
  // Handle custom category (value not in known list)
  const knownIds = [
    ...PRIJMY_KATEGORIE, ...VYDAJE_KATEGORIE,
    ...(state.nastaveni.custom_prijmy || []),
    ...(state.nastaveni.custom_vydaje || []),
  ].map(c => c.id);
  if (t.kategorie && !knownIds.includes(t.kategorie)) {
    setVal('t-kategorie', '___custom___');
    const catInput = document.getElementById('t-kategorie-custom');
    if (catInput) catInput.value = t.kategorie;
    const customGroup = document.getElementById('t-kategorie-custom-group');
    if (customGroup) customGroup.style.display = '';
  } else {
    setVal('t-kategorie', t.kategorie);
  }
  setVal('t-ucet',      t.ucet);
  // Pokud záznam má EUR, zobraz castkaCizi v poli a nastav měnu na EUR
  if (t.menaCizi === 'EUR' && t.castkaCizi) {
    const sel = document.getElementById('t-mena');
    if (sel) sel.value = 'EUR';
    setVal('t-castka', t.castkaCizi);
    _onMenaChange();
  } else {
    const sel = document.getElementById('t-mena');
    if (sel) sel.value = 'CZK';
    setVal('t-castka', t.castka);
    _onMenaChange();
  }
  setVal('t-poznamka',  t.poznamka||'');
  document.getElementById('t-zdanitelny').checked = !!t.zdanitelny;
  openModal('modal-transakce');
}
window.editTransakce = editTransakce;

async function saveTransakce() {
  const typ     = document.getElementById('t-typ').value;
  const datum   = getVal('t-datum');
  const popis   = getVal('t-popis').trim();
  const mena    = (document.getElementById('t-mena')?.value || 'CZK');
  const vstup   = parseFloat(getVal('t-castka'));
  let   kategorie = getVal('t-kategorie');
  const ucet    = getVal('t-ucet');

  // Resolve custom category
  if (kategorie === '___custom___') {
    kategorie = (document.getElementById('t-kategorie-custom')?.value || '').trim();
    if (!kategorie) { showToast('Vyplň název vlastní kategorie', 'error'); return; }
  }

  if (!datum || !popis || isNaN(vstup) || vstup <= 0 || !kategorie) {
    showToast('Vyplň všechna povinná pole', 'error'); return;
  }

  // EUR → CZK konverze
  let castka = vstup;
  let kurzData = null;
  if (mena === 'EUR') {
    showToast('Stahuji kurz ČNB…');
    const cnb = await fetchCnbRate(datum, 'EUR');
    if (!cnb) {
      showToast('Kurz ČNB není dostupný. Zkus po 14:30 nebo zadej částku v CZK.', 'error');
      return;
    }
    castka = Math.round(vstup * cnb.rate * 100) / 100;
    const isPending = cnb.source !== datum && datum === todayStr() && _isWorkday(datum);
    kurzData = {
      menaCizi: 'EUR', castkaCizi: vstup, castkaCzkBase: 0,
      kurzCnb: cnb.rate, kurzDatum: cnb.source,
      kurzUrl: cnb.kurzUrl, kurzStazeno: new Date().toISOString(),
      ...(isPending ? { kurzPending: true } : {}),
    };
  }

  const zdanitelny = document.getElementById('t-zdanitelny').checked;
  const dokladUrl = (getVal('t-doklad-url') || '').trim();
  const data = {
    typ, datum, popis,
    doklad:    getVal('t-doklad'),
    dokladUrl: dokladUrl || null,
    castka,
    kategorie,
    ucet,
    zdanitelny,
    poznamka:  getVal('t-poznamka'),
  };
  if (kurzData) Object.assign(data, kurzData);

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

// ── ZÁSOBY CRUD (odstraněno — zásoby jsou auto ze SKLAD.) ─────

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

let _deleteTimerInterval = null;

function confirmDelete(colName, id, label, name, onConfirm) {
  pendingDelete = { colName, id, onConfirm };
  const nameStr = name ? ` „${esc(name)}"` : '';
  document.getElementById('delete-text').innerHTML = `Opravdu chceš smazat ${label}${nameStr}? Tato akce je nevratná.`;
  const btn = document.getElementById('btn-confirm-delete');
  btn.onclick = () => executeDelete();
  btn.disabled = true;
  btn.textContent = 'Smazat (3)';
  if (_deleteTimerInterval) clearInterval(_deleteTimerInterval);
  let count = 3;
  _deleteTimerInterval = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(_deleteTimerInterval);
      _deleteTimerInterval = null;
      btn.disabled = false;
      btn.textContent = 'Smazat';
    } else {
      btn.textContent = `Smazat (${count})`;
    }
  }, 1000);
  openModal('modal-delete');
}
window.confirmDelete = confirmDelete;

function cancelDelete() {
  if (_deleteTimerInterval) { clearInterval(_deleteTimerInterval); _deleteTimerInterval = null; }
  pendingDelete = null;
  closeModal('modal-delete');
}
window.cancelDelete = cancelDelete;

async function executeDelete() {
  if (!pendingDelete) return;
  const { colName, id, onConfirm } = pendingDelete;
  pendingDelete = null;
  if (_deleteTimerInterval) { clearInterval(_deleteTimerInterval); _deleteTimerInterval = null; }
  closeModal('modal-delete');
  if (onConfirm) { onConfirm(); return; }
  try {
    const { deleteDoc } = window._firebase;
    await deleteDoc(docRef(colName, id));
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

// ── ZÁLOHY ────────────────────────────────────────────────────
const BACKUP_INTERVAL_DAYS = 30;
const LS_LAST_BACKUP  = 'evidenceLastBackup';
const LS_SNOOZE       = 'evidenceBackupSnooze';

function _xlsEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _xlsSheet(name, headers, rows) {
  const hdr = headers.map(h => `<Cell ss:StyleID="H"><Data ss:Type="String">${_xlsEsc(h)}</Data></Cell>`).join('');
  const dataRows = rows.map(r =>
    `<Row>${r.map(v => `<Cell><Data ss:Type="String">${_xlsEsc(v)}</Data></Cell>`).join('')}</Row>`
  ).join('');
  return `<Worksheet ss:Name="${_xlsEsc(name)}"><Table><Row>${hdr}</Row>${dataRows}</Table></Worksheet>`;
}

function exportExcelBackup() {
  const asc = (a, b, k) => (a[k]||'').localeCompare(b[k]||'');
  const cisla = state.nastaveni.zasobyDokladyCisla || {};

  const sheets = [];

  // 1. Peněžní deník
  sheets.push(_xlsSheet('Peněžní deník',
    ['Datum','Doklad č.','Popis','Typ','Kategorie','Účet','Částka CZK','Zdanitelný'],
    [...state.transakce].sort((a,b)=>asc(a,b,'datum')).map(t => [
      t.datum||'', t.doklad||'', t.popis||'',
      t.typ==='prijem'?'Příjem':'Výdaj',
      getCatLabel(t.kategorie, t.typ), t.ucet||'',
      t.castka||0, t.zdanitelny?'Ano':'Ne'
    ])
  ));

  // 2. Faktury vydané
  sheets.push(_xlsSheet('Faktury vydané',
    ['Číslo','Datum','Splatnost','Odběratel','Celkem CZK','Stav'],
    [...state.fakturyVydane].sort((a,b)=>asc(a,b,'datum')).map(f => [
      f.cislo||'', f.datum||'', f.splatnost||'', f.odberatel||'', f.celkem||0, f.stav||''
    ])
  ));

  // 3. Faktury přijaté
  sheets.push(_xlsSheet('Faktury přijaté',
    ['Číslo','Datum','Splatnost','Dodavatel','Kategorie','Částka CZK','Stav'],
    [...state.fakturyPrijate].sort((a,b)=>asc(a,b,'datum')).map(f => [
      f.cislo||'', f.datum||'', f.splatnost||'', f.dodavatel||'',
      VYDAJE_KATEGORIE.find(c=>c.id===f.kategorie)?.label || f.kategorie||'',
      f.castka||0, f.stav||''
    ])
  ));

  // 4. Zásoby – příjmy ze SKLAD
  const zRows = [];
  [...(state.skladItems||[])].filter(i=>i.homeDate).sort((a,b)=>asc(a,b,'homeDate')).forEach(i => {
    zRows.push([
      cisla[i.id+'__prijem']||'', i.homeDate||'', i.name||'', 'Příjem', i.qty||1,
      i.buyPrice||0, i.buyCurrency||'CZK', '', i.category||'', i.condition||'', i.size||''
    ]);
    if (i.saleState==='paid') zRows.push([
      cisla[i.id+'__vydej']||'',
      i.payoutDate||i.saleDate||i.homeDate||'', i.name||'', 'Výdej', i.qty||1,
      i.buyPrice||0, i.buyCurrency||'CZK', i.saleRef||'', i.category||'', i.condition||'', i.size||''
    ]);
  });
  // Manuální pohyby
  [...(state.zasoby||[])].sort((a,b)=>asc(a,b,'datum')).forEach(z => {
    zRows.push([
      cisla['manual__'+z.id]||'', z.datum||'', z.nazev||'',
      z.typ==='prijem'?'Příjem':'Výdej', z.ks||1,
      z.cena||0, z.mena||'CZK', z.saleRef||'', '','',''
    ]);
  });
  sheets.push(_xlsSheet('Zásoby pohyby',
    ['Č. dokladu','Datum','Název zboží','Pohyb','Ks','Nák. cena','Měna','Doklad prodeje','Kategorie','Stav','Velikost'],
    zRows
  ));

  // 5. Majetek
  sheets.push(_xlsSheet('Majetek',
    ['Název','Datum pořízení','Pořizovací cena CZK','Odpisová skupina','Datum vyřazení'],
    [...state.majetek].sort((a,b)=>asc(a,b,'datumPorizeni')).map(m => [
      m.nazev||'', m.datumPorizeni||'', m.cenaPorizeni||0,
      `Skupina ${m.skupina||2}`, m.datumVyrazeni||''
    ])
  ));

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="H"><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>
</Styles>
${sheets.join('\n')}
</Workbook>`;

  const today = new Date().toISOString().slice(0,10);
  const blob  = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `danova-evidence-zaloha-${today}.xls`;
  a.click();
  _markBackupDone(today);
}
window.exportExcelBackup = exportExcelBackup;

function exportJsonBackup() {
  const today = new Date().toISOString().slice(0,10);
  const backup = {
    exportDate: today, appVersion: '44',
    transakce:      state.transakce,
    fakturyVydane:  state.fakturyVydane,
    fakturyPrijate: state.fakturyPrijate,
    zasoby:         state.zasoby,
    majetek:        state.majetek,
    nastaveni:      { ...state.nastaveni }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `danova-evidence-zaloha-${today}.json`;
  a.click();
  _markBackupDone(today);
}
window.exportJsonBackup = exportJsonBackup;

function _markBackupDone(today) {
  localStorage.setItem(LS_LAST_BACKUP, today);
  localStorage.removeItem(LS_SNOOZE);
  const banner = document.getElementById('backup-banner');
  if (banner) banner.style.display = 'none';
  updateBackupInfo();
  showToast('Záloha uložena ✓', 'success');
}

function dismissBackupBanner() {
  const snooze = new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);
  localStorage.setItem(LS_SNOOZE, snooze);
  const banner = document.getElementById('backup-banner');
  if (banner) banner.style.display = 'none';
}
window.dismissBackupBanner = dismissBackupBanner;

let _backupChecked = false;
function checkAutoBackup() {
  if (_backupChecked) return;
  _backupChecked = true;
  updateBackupInfo();
  const snooze = localStorage.getItem(LS_SNOOZE);
  const today  = new Date().toISOString().slice(0,10);
  if (snooze && snooze > today) return;
  const last = localStorage.getItem(LS_LAST_BACKUP);
  if (!last) { _showBackupBanner(null); return; }
  const days = (Date.now() - new Date(last).getTime()) / 86400000;
  if (days >= BACKUP_INTERVAL_DAYS) _showBackupBanner(last);
}

function _showBackupBanner(lastBackup) {
  const banner = document.getElementById('backup-banner');
  if (!banner) return;
  const el = document.getElementById('backup-banner-last');
  if (el) el.textContent = lastBackup ? `Poslední záloha: ${fmtDate(lastBackup)}` : 'Zatím jsi žádnou zálohu neudělal';
  banner.style.display = '';
}

function updateBackupInfo() {
  const last = localStorage.getItem(LS_LAST_BACKUP);
  const el   = document.getElementById('backup-last-info');
  if (el) el.textContent = last ? fmtDate(last) : 'Nikdy';
}
window.updateBackupInfo = updateBackupInfo;

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
    headers = ['Č. dokladu','Datum','Název','Pohyb','Ks','Nák. cena','Měna','Doklad prodeje'];
    rows = _zasobyPohyby.map(p => [
      p.cisloDokladu||'', p.datum||'', esc2(p.nazev||''),
      p.typ === 'prijem' ? 'Příjem' : 'Výdej',
      p.ks||1, p.cena||0, p.mena||'CZK', p.saleRef||''
    ]);
    filename = `zasoby-pohyby-${rok}.csv`;
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

// ── EXPORT XML (peněžní deník) ────────────────────────────────
function exportXml(type) {
  const rok = String(state.rok);
  let xml, filename;

  if (type === 'denik') {
    const s = state.nastaveni;
    const txList = txByRok(rok);
    const prijmyZd = sumTx(txList, 'prijem', true);
    const vydajeZd = sumTx(txList, 'vydej', true);
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<DanovaEvidence rok="${rok}" exportDatum="${new Date().toISOString().slice(0,10)}">
  <Podnikatel>
    <Jmeno>${xmlEsc(s.jmeno||'')}</Jmeno>
    <ICO>${xmlEsc(s.ico||'')}</ICO>
    <Adresa>${xmlEsc(s.adresa||'')}</Adresa>
  </Podnikatel>
  <Souhrn>
    <PrijmyZdanitelne>${prijmyZd.toFixed(2)}</PrijmyZdanitelne>
    <VydajeZdanitelne>${vydajeZd.toFixed(2)}</VydajeZdanitelne>
    <ZakladDane>${(prijmyZd - vydajeZd).toFixed(2)}</ZakladDane>
  </Souhrn>
  <Zaznamy>
${txList.map(t => `    <Zaznam>
      <Datum>${t.datum||''}</Datum>
      <Doklad>${xmlEsc(t.doklad||'')}</Doklad>
      <Popis>${xmlEsc(t.popis||'')}</Popis>
      <Typ>${t.typ === 'prijem' ? 'Příjem' : 'Výdej'}</Typ>
      <Kategorie>${xmlEsc(getCatLabel(t.kategorie, t.typ))}</Kategorie>
      <Ucet>${t.ucet||''}</Ucet>
      <Castka>${Number(t.castka||0).toFixed(2)}</Castka>
      <Zdanitelny>${t.zdanitelny ? 'true' : 'false'}</Zdanitelny>
    </Zaznam>`).join('\n')}
  </Zaznamy>
</DanovaEvidence>`;
    filename = `penezni-denik-${rok}.xml`;
  }

  downloadXml(xml, filename);
  showToast('Export XML stažen', 'success');
}
window.exportXml = exportXml;

// ── EXPORT ISDOC (faktura vydaná) ─────────────────────────────
function exportIsdoc(id) {
  const f = state.fakturyVydane.find(x => x.id === id);
  if (!f) return;
  const s = state.nastaveni;
  const polozky = (f.polozky || []).filter(p => p.popis?.trim());
  const celkem = Number(f.celkem || 0);

  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  const linky = polozky.map((p, i) => {
    const castka = Number((p.mnozstvi || 1) * (p.cena || 0)).toFixed(2);
    return `    <InvoiceLine>
      <ID>${i + 1}</ID>
      <InvoicedQuantity unitCode="C62">${p.mnozstvi || 1}</InvoicedQuantity>
      <LineExtensionAmount>${castka}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${castka}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>0.00</LineExtensionTaxAmount>
      <UnitPrice>${Number(p.cena || 0).toFixed(2)}</UnitPrice>
      <UnitPriceTaxInclusive>${Number(p.cena || 0).toFixed(2)}</UnitPriceTaxInclusive>
      <Item>
        <Description>${xmlEsc(p.popis)}</Description>
      </Item>
    </InvoiceLine>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">
  <DocumentType>1</DocumentType>
  <ID>${xmlEsc(f.cislo)}</ID>
  <UUID>${uuid}</UUID>
  <IssueDate>${f.datum}</IssueDate>
  <TaxPointDate>${f.duzp || f.datum}</TaxPointDate>
  <LocalCurrencyCode>CZK</LocalCurrencyCode>
  <CurrRate>1</CurrRate>
  <RefCurrRate>1</RefCurrRate>
  <AccountingSupplierParty>
    <Party>
      <PartyIdentification>
        <ID>${xmlEsc(s.ico||'')}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${xmlEsc(s.jmeno||'')}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${xmlEsc(s.adresa||'')}</StreetName>
        <Country>
          <IdentificationCode>CZ</IdentificationCode>
        </Country>
      </PostalAddress>
    </Party>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <Party>
      <PartyIdentification>
        <ID>${xmlEsc(f.ico||'')}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${xmlEsc(f.odberatel||'')}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${xmlEsc(f.adresaOdberatele||'')}</StreetName>
        <Country>
          <IdentificationCode>CZ</IdentificationCode>
        </Country>
      </PostalAddress>
    </Party>
  </AccountingCustomerParty>
  <InvoiceLines>
${linky}
  </InvoiceLines>
  <TaxTotal>
    <TaxAmount>0.00</TaxAmount>
    <TaxSubTotal>
      <TaxableAmount>${celkem.toFixed(2)}</TaxableAmount>
      <TaxInclusiveAmount>${celkem.toFixed(2)}</TaxInclusiveAmount>
      <TaxAmount>0.00</TaxAmount>
      <TaxCategory>
        <Percent>0</Percent>
        <VATApplicable>false</VATApplicable>
      </TaxCategory>
    </TaxSubTotal>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${celkem.toFixed(2)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${celkem.toFixed(2)}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${celkem.toFixed(2)}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${celkem.toFixed(2)}</DifferenceTaxInclusiveAmount>
    <PayableRoundingAmount>0.00</PayableRoundingAmount>
    <PaidDepositsAmount>0.00</PaidDepositsAmount>
    <PayableAmount>${celkem.toFixed(2)}</PayableAmount>
  </LegalMonetaryTotal>
</Invoice>`;

  downloadXml(xml, `faktura-${f.cislo}.isdoc`);
  showToast('ISDOC faktura stažena', 'success');
}
window.exportIsdoc = exportIsdoc;

function downloadXml(xml, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8;' }));
  a.download = filename;
  a.click();
}

function xmlEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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
  if (!el) return;
  el.value = val;
  if (el._cs) el._cs.updateLabel();
  if (el._dp) el._dp.updateTrigger();
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
  const u = getUcty().find(x => x.id === ucet);
  const label = u ? `${u.icon} ${u.label}` : (ucet || '—');
  return `<span class="account-badge">${label}</span>`;
}

function fillAccountSelects() {
  const ucty = getUcty();
  const tUcet = document.getElementById('t-ucet');
  if (tUcet) {
    const cur = tUcet.value;
    tUcet.innerHTML = ucty.map(u => `<option value="${u.id}">${u.icon} ${u.label}</option>`).join('');
    if (cur && ucty.find(u => u.id === cur)) tUcet.value = cur;
    if (tUcet._cs) tUcet._cs.updateLabel();
  }
  const denikUcet = document.getElementById('denik-ucet');
  if (denikUcet) {
    const cur = denikUcet.value;
    denikUcet.innerHTML = '<option value="">Účet: vše</option>' +
      ucty.map(u => `<option value="${u.id}">${u.icon} ${u.label}</option>`).join('');
    if (cur) denikUcet.value = cur;
    if (denikUcet._cs) denikUcet._cs.updateLabel();
  }
}

function renderUctyList() {
  const list = document.getElementById('modal-ucty-list');
  if (!list) return;
  const ucty = getUcty();
  const isDefault = !state.nastaveni.ucty?.length;
  if (isDefault) {
    list.innerHTML = `<p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem;">Výchozí účty — přidej vlastní nebo je ponech.</p>` +
      ucty.map(u => `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;background:var(--bg-secondary);border-radius:var(--radius);border:1px solid var(--border-subtle);opacity:0.7;">
          <span style="font-size:1.2rem;">${u.icon}</span>
          <span style="flex:1;font-size:0.88rem;">${esc(u.label)}</span>
        </div>`).join('');
  } else {
    list.innerHTML = ucty.map((u, i) => `
      <div id="ucet-row-${i}" style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid var(--border-subtle);">
        <span style="font-size:1.2rem;">${u.icon}</span>
        <span style="flex:1;font-size:0.88rem;">${esc(u.label)}</span>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="editUcetRow(${i})" title="Upravit">✏️</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteUcet(${i})" title="Smazat" style="color:var(--danger);">🗑</button>
      </div>`).join('');
  }
}

function openKategorieModal() {
  openModal('modal-kategorie');
  renderKategorieList('prijem');
  renderKategorieList('vydej');
}
window.openKategorieModal = openKategorieModal;

function openUctyModal() {
  openModal('modal-ucty');
  renderUctyList();
}
window.openUctyModal = openUctyModal;

async function resetZasobyCislování() {
  if (!confirm('Resetovat číslování zásob? Všem záznamům budou přiřazena nová čísla P/V od 001 v chronologickém pořadí. Skryté záznamy číslo nedostanou.')) return;
  const { db, doc, setDoc } = window._firebase;
  state.nastaveni.zasobyDokladyCisla = {};
  state.nastaveni.zasobyCounters = {};
  await setDoc(doc(db,'users',state.uid,'nastaveni','config'), {
    zasobyDokladyCisla: {},
    zasobyCounters: {}
  }, { merge: true });
  renderZasoby();
  alert('Číslování zásob bylo resetováno.');
}
window.resetZasobyCislování = resetZasobyCislování;

function editKategorieRow(typ, index) {
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const cat = (state.nastaveni[key] || [])[index];
  if (!cat) return;
  const row = document.getElementById(`kat-row-${typ}-${index}`);
  if (!row) return;
  row.innerHTML = `
    <input type="text" value="${esc(cat.label)}" id="kat-edit-${typ}-${index}" class="form-control" style="flex:1;font-size:0.82rem;padding:0.25rem 0.5rem;" />
    <button class="btn btn-primary btn-sm" onclick="saveKategorieRow('${typ}',${index})">✓</button>
    <button class="btn btn-ghost btn-sm" onclick="renderKategorieList('${typ}')">✕</button>`;
  document.getElementById(`kat-edit-${typ}-${index}`)?.select();
}
window.editKategorieRow = editKategorieRow;

async function saveKategorieRow(typ, index) {
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const cats = [...(state.nastaveni[key] || [])];
  const newLabel = document.getElementById(`kat-edit-${typ}-${index}`)?.value.trim();
  if (!newLabel) { showToast('Zadej název', 'error'); return; }
  cats[index] = { ...cats[index], label: newLabel };
  await _saveKategorie(typ, cats);
}
window.saveKategorieRow = saveKategorieRow;

function editUcetRow(index) {
  const ucty = getUcty();
  const u = ucty[index];
  if (!u) return;
  const row = document.getElementById(`ucet-row-${index}`);
  if (!row) return;
  row.innerHTML = `
    <input type="text" value="${esc(u.icon)}" id="ucet-edit-icon-${index}" class="form-control" style="width:52px;text-align:center;font-size:1.1rem;padding:0.25rem;" maxlength="4" />
    <input type="text" value="${esc(u.label)}" id="ucet-edit-label-${index}" class="form-control" style="flex:1;font-size:0.88rem;padding:0.25rem 0.5rem;" />
    <button class="btn btn-primary btn-sm" onclick="saveUcetRow(${index})">✓</button>
    <button class="btn btn-ghost btn-sm" onclick="renderUctyList()">✕</button>`;
  document.getElementById(`ucet-edit-label-${index}`)?.select();
}
window.editUcetRow = editUcetRow;

async function saveUcetRow(index) {
  const ucty = [...getUcty()];
  const icon = document.getElementById(`ucet-edit-icon-${index}`)?.value.trim() || '💳';
  const label = document.getElementById(`ucet-edit-label-${index}`)?.value.trim();
  if (!label) { showToast('Zadej název', 'error'); return; }
  ucty[index] = { ...ucty[index], icon, label };
  await _saveUcty(ucty);
}
window.saveUcetRow = saveUcetRow;

async function addUcet() {
  const icon  = (document.getElementById('ucet-new-icon')?.value.trim()) || '💳';
  const label = (document.getElementById('ucet-new-label')?.value.trim()) || '';
  if (!label) { showToast('Zadej název účtu', 'error'); return; }
  const id = 'ucet_' + Date.now();
  const ucty = [...getUcty(), { id, icon, label }];
  await _saveUcty(ucty);
  if (document.getElementById('ucet-new-icon')) document.getElementById('ucet-new-icon').value = '';
  if (document.getElementById('ucet-new-label')) document.getElementById('ucet-new-label').value = '';
}
window.addUcet = addUcet;

async function deleteUcet(index) {
  const ucty = [...getUcty()];
  ucty.splice(index, 1);
  await _saveUcty(ucty);
}
window.deleteUcet = deleteUcet;

async function _saveUcty(ucty) {
  const { db, doc, setDoc } = window._firebase;
  try {
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), { ucty }, { merge: true });
    state.nastaveni.ucty = ucty;
    renderUctyList();
    fillAccountSelects();
    renderDashboard();
    renderDenik();
    showToast('Účty uloženy', 'success');
  } catch(e) {
    showToast('Chyba: ' + e.message, 'error');
  }
}

// ── SPRÁVA KATEGORIÍ ──────────────────────────────────────────
function renderKategorieList(typ) {
  const listId = typ === 'prijem' ? 'modal-kat-prijmy-list' : 'modal-kat-vydaje-list';
  const list = document.getElementById(listId);
  if (!list) return;
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const defaults = typ === 'prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE;
  const custom = state.nastaveni[key] || [];

  const defHtml = defaults.map(c => `
    <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.6rem;background:var(--bg-secondary);border-radius:var(--radius);border:1px solid var(--border-subtle);opacity:0.65;">
      <span style="flex:1;font-size:0.8rem;">${esc(c.label)}</span>
      <span style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;">${c.zdanitelny ? 'zdanit.' : 'nezdanit.'}</span>
    </div>`).join('');

  const custHtml = !custom.length
    ? `<p style="font-size:0.78rem;color:var(--text-muted);padding:0.25rem 0;">Zatím žádné vlastní.</p>`
    : custom.map((c, i) => `
      <div id="kat-row-${typ}-${i}" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.6rem;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid var(--border-subtle);">
        <span style="flex:1;font-size:0.8rem;">${esc(c.label)}</span>
        <span style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;">${c.zdanitelny ? 'zdanit.' : 'nezdanit.'}</span>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="editKategorieRow('${typ}',${i})" title="Přejmenovat" style="font-size:0.75rem;">✏️</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteKategorie('${typ}',${i})" title="Smazat" style="color:var(--danger);font-size:0.75rem;">🗑</button>
      </div>`).join('');

  list.innerHTML = `
    <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.3rem;">Výchozí</div>
    ${defHtml}
    <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0.65rem 0 0.3rem;">Vlastní</div>
    ${custHtml}`;
}

async function addKategorie(typ) {
  const inputId = typ === 'prijem' ? 'kat-prijmy-new' : 'kat-vydaje-new';
  const checkId = typ === 'prijem' ? 'kat-prijmy-zdanitelny' : 'kat-vydaje-zdanitelny';
  const label = (document.getElementById(inputId)?.value || '').trim();
  if (!label) { showToast('Zadej název kategorie', 'error'); return; }
  const zdanitelny = document.getElementById(checkId)?.checked ?? true;
  const id = (typ === 'prijem' ? 'cust_p_' : 'cust_v_') + Date.now();
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const cats = [...(state.nastaveni[key] || []), { id, label, zdanitelny }];
  await _saveKategorie(typ, cats);
  if (document.getElementById(inputId)) document.getElementById(inputId).value = '';
}
window.addKategorie = addKategorie;

async function deleteKategorie(typ, index) {
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const cats = [...(state.nastaveni[key] || [])];
  cats.splice(index, 1);
  await _saveKategorie(typ, cats);
}
window.deleteKategorie = deleteKategorie;

async function _saveKategorie(typ, cats) {
  const key = typ === 'prijem' ? 'custom_prijmy' : 'custom_vydaje';
  const { db, doc, setDoc } = window._firebase;
  try {
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), { [key]: cats }, { merge: true });
    state.nastaveni[key] = cats;
    renderKategorieList(typ);
    // Refresh category dropdown if modal is open
    const curTyp = document.getElementById('t-typ')?.value;
    if (curTyp) fillCategorySelect('t-kategorie', curTyp === 'prijem' ? PRIJMY_KATEGORIE : VYDAJE_KATEGORIE);
    showToast('Kategorie uloženy', 'success');
  } catch(e) {
    showToast('Chyba: ' + e.message, 'error');
  }
}

// ── SKLAD. SYNC ───────────────────────────────────────────────
let _skladUnsub = null;

async function connectSklad() {
  const pwd = document.getElementById('sklad-pwd')?.value;
  const errEl = document.getElementById('sklad-connect-err');
  if (!pwd) { errEl.style.display='block'; errEl.textContent='Zadej heslo.'; return; }
  errEl.style.display = 'none';

  const btn = document.querySelector('#sklad-disconnected .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Připojuji…'; }

  try {
    const { skladAuth, signInWithEmailAndPassword } = window._sklad;
    const email = window._firebase.auth.currentUser.email;
    const cred = await signInWithEmailAndPassword(skladAuth, email, pwd);
    const skladUid = cred.user.uid;

    // Mark all currently existing items as already-seen (don't import retroactively)
    const { syncedIds, syncedSaleIds } = await _getSkladSeenIds(skladUid);
    const { db, doc, setDoc } = window._firebase;
    await setDoc(doc(db,'users',state.uid,'nastaveni','config'), {
      ...state.nastaveni, skladSyncEnabled: true, skladUid,
      skladSyncedIds: syncedIds, skladSyncedSaleIds: syncedSaleIds,
    }, { merge: true });
    Object.assign(state.nastaveni, { skladSyncEnabled: true, skladUid, skladSyncedIds: syncedIds, skladSyncedSaleIds: syncedSaleIds });

    _startSkladListener(skladUid);
    _showSkladConnected();
    showToast('SKLAD. propojeno', 'success');
  } catch(e) {
    errEl.style.display = 'block';
    errEl.textContent = e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
      ? 'Špatné heslo.' : `Chyba: ${e.message}`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Propojit se SKLAD.'; }
  }
}
window.connectSklad = connectSklad;

async function _getSkladSeenIds(skladUid) {
  try {
    const snap = await window._firebase.getDoc(
      window._sklad.doc(window._sklad.skladDb, 'users', skladUid, 'sklad', 'data')
    );
    if (!snap.exists()) return { syncedIds: [], syncedSaleIds: [] };
    const items = snap.data().items || [];
    return {
      syncedIds:     items.map(i => i.id).filter(Boolean),
      syncedSaleIds: items.filter(i => i.saleState === 'paid').map(i => i.id).filter(Boolean),
    };
  } catch { return { syncedIds: [], syncedSaleIds: [] }; }
}

async function disconnectSklad() {
  if (!confirm('Odpojit SKLAD.? Automatická synchronizace se zastaví.')) return;
  if (_skladUnsub) { _skladUnsub(); _skladUnsub = null; }
  await window._sklad.skladAuth.signOut().catch(() => {});
  const { db, doc, setDoc } = window._firebase;
  await setDoc(doc(db,'users',state.uid,'nastaveni','config'), {
    ...state.nastaveni, skladSyncEnabled: false, skladUid: null,
    skladSyncedIds: [], skladSyncedSaleIds: [],
  }, { merge: true });
  state.nastaveni.skladSyncEnabled = false;
  _showSkladDisconnected();
  showToast('SKLAD. odpojeno', 'info');
}
window.disconnectSklad = disconnectSklad;

let _skladSyncLock = false;
let _skladPendingSnap = null; // nejnovější snapshot přijatý během zpracování

function _startSkladListener(skladUid) {
  if (_skladUnsub) { _skladUnsub(); _skladUnsub = null; }
  const { skladDb, onSnapshot, doc } = window._sklad;
  console.log('[SKLAD] spouštím listener pro uid:', skladUid);
  _skladUnsub = onSnapshot(
    doc(skladDb, 'users', skladUid, 'sklad', 'data'),
    snap => {
      console.log('[SKLAD] onSnapshot fired | exists:', snap.exists(), '| lock:', _skladSyncLock);
      if (_skladSyncLock) {
        _skladPendingSnap = snap;
        return;
      }
      _runSkladSync(snap);
    },
    err => { console.error('[SKLAD] listener error:', err); showToast('⚠️ SKLAD. listener chyba: ' + err.message, 'error'); }
  );
}

async function _runSkladSync(snap) {
  _skladSyncLock = true;
  _skladPendingSnap = null;
  try {
    if (!snap.exists()) { console.log('[SKLAD] snapshot neexistuje'); return; }
    const items = snap.data().items || [];
    state.skladItems = items;
    scheduleRefresh();
    _updateSkladSyncInfo();
    console.log('[SKLAD] snapshot přijat, položek celkem:', items.length);

    // Migrace: skladSyncedSaleIds nikdy nebylo inicializováno (starší verze)
    if (state.nastaveni.skladSyncedSaleIds === undefined) {
      await _fixSkladSaleInit(items);
    }

    // Načti nejčerstvější synced IDs přímo z Firestore (ne jen z paměti)
    const { db, doc: docFn, getDoc, setDoc } = window._firebase;
    const cfgSnap = await getDoc(docFn(db,'users',state.uid,'nastaveni','config'));
    const cfg = cfgSnap.exists() ? cfgSnap.data() : state.nastaveni;
    const synced     = [...(cfg.skladSyncedIds     || [])];
    const syncedSale = [...(cfg.skladSyncedSaleIds || [])];
    state.nastaveni.skladSyncedIds     = [...synced];
    state.nastaveni.skladSyncedSaleIds = [...syncedSale];

    // Detailní log proč každá položka prošla / neprošla filtrem
    items.forEach(i => {
      const hasId       = !!i.id;
      const notSynced   = !synced.includes(i.id);
      const hasBuyPrice = Number(i.buyPrice) > 0;
      const hasHomeDate = !!i.homeDate;
      const passes      = hasId && notSynced && hasBuyPrice && hasHomeDate;
      console.log(`[SKLAD] položka "${i.name||'?'}" id=${i.id} buyPrice=${i.buyPrice} homeDate=${i.homeDate||'❌'} inSynced=${!notSynced} → ${passes ? 'PŘIDÁ SE' : `SKIP (id:${hasId} notSynced:${notSynced} price:${hasBuyPrice} homeDate:${hasHomeDate})`}`);
    });

    const newBuys  = items.filter(i => i.id && !synced.includes(i.id) && Number(i.buyPrice) > 0);
    const newSales = items.filter(i => i.id && i.saleState === 'paid' && !syncedSale.includes(i.id));
    console.log('[SKLAD] nové nákupy:', newBuys.length, '| nové prodeje:', newSales.length);

    const buyGroups  = _groupSkladItems(newBuys,  i => i.orderNum ? String(i.orderNum) : null);
    const saleGroups = _groupSkladItems(newSales, i => i.saleRef  ? `${i.saleRef}__${i.soldWhere||''}` : null);

    for (const group of buyGroups)  { await _syncSkladBuyGroup(group);  group.forEach(i => synced.push(i.id)); }
    for (const group of saleGroups) { await _syncSkladSaleGroup(group); group.forEach(i => syncedSale.push(i.id)); }

    if (!buyGroups.length && !saleGroups.length) return;

    await setDoc(docFn(db,'users',state.uid,'nastaveni','config'),
      { skladSyncedIds: synced, skladSyncedSaleIds: syncedSale }, { merge: true });
    state.nastaveni.skladSyncedIds     = synced;
    state.nastaveni.skladSyncedSaleIds = syncedSale;
    _updateSkladSyncInfo();

    if (buyGroups.length) {
      const ni = buyGroups.reduce((s,g)=>s+g.length,0);
      showToast(`SKLAD.: ${ni} nákup${ni>1?'ů':''} → ${buyGroups.length} záznam${buyGroups.length>1?'y':'ů'} ve výdajích`, 'success');
    }
    if (saleGroups.length) {
      const ni = saleGroups.reduce((s,g)=>s+g.length,0);
      showToast(`SKLAD.: ${ni} prodej${ni>1?'ů':''} → ${saleGroups.length} záznam${saleGroups.length>1?'y':'ů'} v příjmech`, 'success');
    }
  } catch(e) {
    console.error('[SKLAD] sync chyba:', e);
    showToast('⚠️ SKLAD. sync chyba: ' + (e.message || e), 'error');
  } finally {
    _skladSyncLock = false;
    // Pokud přišel snapshot během zpracování, zpracuj ho teď
    if (_skladPendingSnap) {
      const pending = _skladPendingSnap;
      _skladPendingSnap = null;
      _runSkladSync(pending);
    }
  }
}

async function smazatChybneImporty() {
  if (!confirm('Smazat VŠECHNY záznamy importované ze SKLAD. (příjmy i výdaje)? Tuto akci nelze vrátit.')) return;
  const { getDocs, deleteDoc } = window._firebase;
  const snap = await getDocs(col('transakce'));
  const toDelete = snap.docs.filter(d => (d.data().poznamka || '').includes('Importováno ze SKLAD.'));
  for (const d of toDelete) await deleteDoc(docRef('transakce', d.id));
  showToast(toDelete.length > 0 ? `Smazáno ${toDelete.length} záznamů ze SKLAD.` : 'Žádné SKLAD. záznamy nenalezeny', 'success');
}
window.smazatChybneImporty = smazatChybneImporty;

async function reinicializovatSkladSync() {
  if (!state.nastaveni.skladSyncEnabled || !state.nastaveni.skladUid) {
    showToast('SKLAD. není propojeno', 'error'); return;
  }
  if (!confirm('Označit všechny aktuální položky ve SKLAD. jako již synchronizované? Nové záznamy v evidenci se NEBUDOU přidávat pro položky, které tam již jsou. Spustí se při příštím pohybu ve SKLAD.')) return;
  const { syncedIds, syncedSaleIds } = await _getSkladSeenIds(state.nastaveni.skladUid);
  const { db, doc, setDoc } = window._firebase;
  await setDoc(doc(db,'users',state.uid,'nastaveni','config'),
    { skladSyncedIds: syncedIds, skladSyncedSaleIds: syncedSaleIds }, { merge: true });
  state.nastaveni.skladSyncedIds     = syncedIds;
  state.nastaveni.skladSyncedSaleIds = syncedSaleIds;
  showToast(`Sync reinicializován — označeno ${syncedIds.length} nákupů a ${syncedSaleIds.length} prodejů jako viděné`, 'success');
}
window.reinicializovatSkladSync = reinicializovatSkladSync;

async function _fixSkladSaleInit(skladItems) {
  // 1. Smaž všechny příjmy, které byly chybně naimportovány ze SKLAD.
  const { getDocs, deleteDoc } = window._firebase;
  const snap = await getDocs(col('transakce'));
  const toDelete = snap.docs.filter(d => {
    const data = d.data();
    return data.typ === 'prijem' && (data.poznamka || '').includes('Importováno ze SKLAD.');
  });
  for (const d of toDelete) {
    await deleteDoc(docRef('transakce', d.id));
  }

  // 2. Inicializuj syncedSaleIds ze všech aktuálně paid položek
  const seenSaleIds = skladItems.filter(i => i.saleState === 'paid').map(i => i.id).filter(Boolean);
  const { db, doc, setDoc } = window._firebase;
  await setDoc(doc(db,'users',state.uid,'nastaveni','config'),
    { skladSyncedSaleIds: seenSaleIds }, { merge: true });
  state.nastaveni.skladSyncedSaleIds = seenSaleIds;

  if (toDelete.length > 0) {
    showToast(`SKLAD.: Odstraněno ${toDelete.length} chybných záznamů, sync opraven`, 'info');
  }
}

// Seskupí položky se stejným klíčem do jednoho záznamu.
// Položky bez klíče (orderNum/saleRef prázdné) jdou každá zvlášť.
// Načte kurz z ČNB pro dané datum a měnu. Zkouší až 5 předchozích dnů (víkendy/svátky).
// Vrací { rate, source } kde rate = CZK za 1 jednotku měny, source = skutečné datum kurzu.
// Zkouší získat kurz z ČNB, až 5 dnů zpět (víkendy/svátky).
// Vrací { rate, source } nebo null.
async function fetchCnbRate(dateStr, currency) {
  let d = new Date(dateStr + 'T12:00:00Z');
  for (let i = 0; i < 5; i++) {
    const iso = d.toISOString().slice(0, 10);
    const cnbApiUrl = `https://api.cnb.cz/cnbapi/exrates/daily?date=${iso}&lang=EN`;

    for (const proxy of [
      `https://corsproxy.io/?${encodeURIComponent(cnbApiUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cnbApiUrl)}`
    ]) {
      try {
        const resp = await fetch(proxy);
        if (resp.ok) {
          const data = await resp.json();
          const list = Array.isArray(data) ? data : (data.rates || []);
          const found = list.find(r => (r.currencyCode || '').toUpperCase() === currency.toUpperCase());
          if (found) {
            const rate = Number(found.rate) / Number(found.amount || 1);
            if (rate > 0) {
              // validFor = skutečné datum platnosti kurzu z ČNB (může se lišit od dotazovaného)
              const validFor = found.validFor || iso;
              const vp = validFor.split('-');
              const kurzUrl = `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${vp[2]}.${vp[1]}.${vp[0]}`;
              console.log(`[SKLAD] kurz ČNB k ${validFor}: 1 ${currency} = ${rate} CZK (dotaz: ${iso})`);
              return { rate, source: validFor, kurzUrl };
            }
          }
        }
      } catch (e) { console.warn('[SKLAD] ČNB proxy chyba:', e.message); }
    }

    d.setUTCDate(d.getUTCDate() - 1);
  }
  console.error('[SKLAD] kurz ČNB nedostupný pro', dateStr, currency);
  return null;
}

let _eurPreviewTimer = null;
const _eurRateCache = {};

window._onMenaChange = function() {
  const mena = document.getElementById('t-mena')?.value || 'CZK';
  const label = document.getElementById('t-castka-label');
  const input = document.getElementById('t-castka');
  if (label) label.innerHTML = `Částka (${mena})<span class="required">*</span>`;
  if (input) input.placeholder = mena === 'EUR' ? '0.00' : '0';
  _updateEurPreview();
};

window._updateEurPreview = function() {
  const mena = document.getElementById('t-mena')?.value || 'CZK';
  const preview = document.getElementById('t-eur-preview');
  if (!preview) return;
  if (mena !== 'EUR') { preview.style.display = 'none'; return; }
  const vstup = parseFloat(document.getElementById('t-castka')?.value);
  if (!vstup || vstup <= 0) { preview.style.display = 'none'; return; }
  const datum = getVal('t-datum') || todayStr();
  preview.style.display = '';
  preview.textContent = 'Načítám kurz ČNB…';
  clearTimeout(_eurPreviewTimer);
  _eurPreviewTimer = setTimeout(async () => {
    let cnb = _eurRateCache[datum];
    if (!cnb) { cnb = await fetchCnbRate(datum, 'EUR'); if (cnb) _eurRateCache[datum] = cnb; }
    if (!cnb) { preview.textContent = '⚠️ Kurz ČNB nedostupný'; return; }
    const czk = Math.round(vstup * cnb.rate * 100) / 100;
    const pendingNote = cnb.source !== datum ? ` · ⚠️ kurz z ${fmtDate(cnb.source)}, dnešní zatím nevyhlášen` : '';
    preview.textContent = `≈ ${fmtCzk(czk)}  ·  1 EUR = ${cnb.rate} CZK ke dni ${fmtDate(cnb.source)}${pendingNote}`;
  }, 500);
};

function _isWorkday(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return dow >= 1 && dow <= 5;
}

async function _autoUpdatePendingKurzy() {
  const today = todayStr();
  const { getDocs, query, where, updateDoc, doc } = window._firebase;
  let snap;
  try {
    snap = await getDocs(query(col('transakce'), where('kurzPending', '==', true)));
  } catch(e) { return; }
  if (snap.empty) return;

  const byDate = new Map();
  snap.docs.forEach(d => {
    const t = d.data();
    if (!byDate.has(t.datum)) byDate.set(t.datum, []);
    byDate.get(t.datum).push({ id: d.id, ...t });
  });

  for (const [datum, records] of byDate) {
    const cnb = await fetchCnbRate(datum, 'EUR');
    if (!cnb || cnb.source !== datum) continue; // kurz ještě není vyhlášen
    for (const t of records) {
      const newCastka = Math.round(((t.castkaCzkBase || 0) + t.castkaCizi * cnb.rate) * 100) / 100;
      const autoUpdate = {
        castka: newCastka,
        kurzCnb: cnb.rate, kurzDatum: cnb.source,
        kurzUrl: cnb.kurzUrl, kurzStazeno: new Date().toISOString(),
        kurzPending: false,
      };
      if (t.poznamka) {
        autoUpdate.poznamka = t.poznamka
          .replace(/ ⏳ Kurz z [^·]+(· ?|$)/g, ' ')
          .replace(/ ⚠️ DOPLŇ RUČNĚ[^·]+(· ?|$)/g, ' ')
          .replace(/ × \d+(?:\.\d+)? = \d+(?:\.\d+)? Kč/g, '')
          .replace(/\s{2,}/g, ' ').trim();
      }
      await updateDoc(docRef('transakce', t.id), autoUpdate);
    }
    showToast(`Kurz ČNB ke dni ${fmtDate(datum)} byl automaticky aktualizován (${records.length} záznam${records.length > 1 ? 'ů' : ''})`);
  }
}

async function aktualizujKurz(transakceId) {
  const { updateDoc } = window._firebase;
  const snap = await (async () => { const { getDoc } = window._firebase; return getDoc(docRef('transakce', transakceId)); })();
  if (!snap.exists()) return;
  const t = snap.data();
  if (!t.menaCizi || !t.datum) return;

  showToast('Stahuji aktuální kurz ČNB…');
  const cnb = await fetchCnbRate(t.datum, t.menaCizi);
  if (!cnb) { showToast('Kurz ČNB zatím není dostupný. Zkuste po 14:30.'); return; }
  if (cnb.source !== t.datum) {
    showToast(`Kurz pro ${fmtDate(t.datum)} stále není vyhlášen. Použit kurz z ${fmtDate(cnb.source)}.`);
  }

  const newCastka = Math.round(((t.castkaCzkBase || 0) + t.castkaCizi * cnb.rate) * 100) / 100;

  // Rebuild poznámka: remove ⏳/⚠️ warnings, update EUR × rate = CZK values
  let newPoznamka = t.poznamka || '';
  if (newPoznamka) {
    newPoznamka = newPoznamka
      .replace(/ ⏳ Kurz z [^·]+(· ?|$)/g, ' ')
      .replace(/ ⚠️ DOPLŇ RUČNĚ[^·]+(· ?|$)/g, ' ')
      .replace(/(\d+(?:\.\d+)?) EUR × \d+(?:\.\d+)? = \d+(?:\.\d+)? Kč/g, (_, eurAmt) => {
        const czk = Math.round(parseFloat(eurAmt) * cnb.rate * 100) / 100;
        return `${eurAmt} EUR × ${cnb.rate} = ${czk.toFixed(2)} Kč`;
      })
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const update = {
    castka: newCastka,
    kurzCnb: cnb.rate, kurzDatum: cnb.source,
    kurzUrl: cnb.kurzUrl, kurzStazeno: new Date().toISOString(),
    kurzPending: cnb.source !== t.datum,
  };
  if (newPoznamka !== (t.poznamka || '')) update.poznamka = newPoznamka;
  await updateDoc(docRef('transakce', transakceId), update);
  showToast(`Kurz aktualizován: 1 ${t.menaCizi} = ${cnb.rate} CZK → ${newCastka.toFixed(2)} Kč`);
  closeModal('modal-transakce-detail');
}


function _groupSkladItems(items, keyFn) {
  const map = new Map();
  const solo = [];
  for (const item of items) {
    const key = keyFn(item);
    if (key) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    } else {
      solo.push([item]);
    }
  }
  return [...map.values(), ...solo];
}

async function _syncSkladBuyGroup(items) {
  const first = items[0];
  const datum = first.homeDate || first.buyDate || (first.dateAdded ? new Date(first.dateAdded).toISOString().slice(0,10) : todayStr());

  const eurItems = items.filter(i => (i.buyCurrency||'CZK').toUpperCase() === 'EUR');
  const czkItems = items.filter(i => (i.buyCurrency||'CZK').toUpperCase() !== 'EUR');
  const castkaCziEur = eurItems.reduce((s,i) => s + Number(i.buyPrice||0), 0);
  const castkaCzk    = czkItems.reduce((s,i) => s + Number(i.buyPrice||0), 0);

  let kurzInfo = null;
  let castka   = castkaCzk;

  if (eurItems.length > 0) {
    const cnb = await fetchCnbRate(datum, 'EUR');
    if (cnb) {
      castka  += castkaCziEur * cnb.rate;
      const isPending = cnb.source !== datum && datum === todayStr() && _isWorkday(datum);
      kurzInfo = { menaCizi: 'EUR', castkaCizi: Math.round(castkaCziEur * 100) / 100,
                   castkaCzkBase: castkaCzk,
                   kurzCnb: cnb.rate, kurzDatum: cnb.source,
                   kurzUrl: cnb.kurzUrl, kurzStazeno: new Date().toISOString(),
                   ...(isPending ? { kurzPending: true } : {}) };
    } else {
      kurzInfo = { menaCizi: 'EUR', castkaCizi: Math.round(castkaCziEur * 100) / 100, castkaCzkBase: castkaCzk, kurzCnb: null, kurzDatum: null };
    }
  }

  const rateOk  = !!(kurzInfo?.kurzCnb);
  const isPending = !!(kurzInfo?.kurzPending);
  const eurTag  = kurzInfo ? ` (${kurzInfo.castkaCizi} EUR)` : '';
  const popis   = items.length === 1
    ? `${first.name || 'Nákup'}${eurTag}`
    : `Nákup: ${items.map(i => i.name || '?').join(' · ')}${eurTag}`;

  const breakdown = items.map(i => {
    const cur = (i.buyCurrency||'CZK').toUpperCase();
    return `${i.name||'?'}: ${Number(i.buyPrice||0)} ${cur}`;
  }).join(' | ');

  const { addDoc } = window._firebase;

  // Determine doklad number: FP, KS with custom number, or auto-generate ID
  let dokladCislo = '';
  if (first.dokladTyp === 'fp' && first.fpCislo) {
    dokladCislo = first.fpCislo;
  } else if (first.dokladTyp === 'ks') {
    const year = datum.slice(0, 4);
    const raw = (first.dokladCislo || '').trim();
    if (raw) {
      // If user already typed the full number (starts with KS), use as-is; else prepend KS+year
      dokladCislo = /^KS/i.test(raw) ? raw.toUpperCase() : `KS${year}${raw.padStart(5, '0')}`;
    } else {
      dokladCislo = `KS${year}${String(Date.now()).slice(-5)}`;
    }
  } else {
    const year = datum.slice(0, 4);
    dokladCislo = await _getNextIdNumber(year);
  }

  const record = {
    typ: 'vydej', datum, popis,
    doklad: dokladCislo,
    skladIds: items.map(i => i.id),
    castka: Math.round(castka * 100) / 100,
    kategorie: 'nakup_zbozi', ucet: 'bank', zdanitelny: true,
    poznamka: `Importováno ze SKLAD.${kurzInfo && !rateOk ? ` ⚠️ DOPLŇ RUČNĚ částku v CZK (${kurzInfo.castkaCizi} EUR, kurz ČNB nedostupný)` : isPending ? ` ⏳ Kurz z ${fmtDate(kurzInfo.kurzDatum)}, dnešní kurz ČNB ještě nebyl vyhlášen` : ''} · ${breakdown}`,
  };
  if (rateOk) Object.assign(record, kurzInfo);
  await addDoc(col('transakce'), record);
}

async function _syncSkladSaleGroup(items) {
  const first = items[0];
  const datum = first.payoutDate || first.saleDate || todayStr();

  const eurItems = items.filter(i => (i.sellCurrency||'CZK').toUpperCase() === 'EUR');
  const czkItems = items.filter(i => (i.sellCurrency||'CZK').toUpperCase() !== 'EUR');
  // EUR items: SKLAD stores sellPrice in CZK (converted on save), original EUR is in sellPriceOrig
  const castkaCziEur = eurItems.reduce((s,i) => s + Number(i.sellPriceOrig || 0), 0);
  // EUR items without sellPriceOrig: add their CZK sellPrice directly
  const czkFromOrphanEur = eurItems.filter(i => !i.sellPriceOrig).reduce((s,i) => s + Number(i.sellPrice||0), 0);
  const castkaCzk    = czkItems.reduce((s,i) => s + Number(i.sellPrice||0), 0) + czkFromOrphanEur;

  let kurzInfo = null;
  let castka   = castkaCzk;

  if (eurItems.length > 0) {
    const cnb = await fetchCnbRate(datum, 'EUR');
    if (cnb) {
      castka  += castkaCziEur * cnb.rate;
      const isPending = cnb.source !== datum && datum === todayStr() && _isWorkday(datum);
      kurzInfo = { menaCizi: 'EUR', castkaCizi: Math.round(castkaCziEur * 100) / 100,
                   castkaCzkBase: castkaCzk,
                   kurzCnb: cnb.rate, kurzDatum: cnb.source,
                   kurzUrl: cnb.kurzUrl, kurzStazeno: new Date().toISOString(),
                   ...(isPending ? { kurzPending: true } : {}) };
    } else {
      kurzInfo = { menaCizi: 'EUR', castkaCizi: Math.round(castkaCziEur * 100) / 100, castkaCzkBase: castkaCzk, kurzCnb: null, kurzDatum: null };
    }
  }

  const rateOk = !!(kurzInfo?.kurzCnb);
  const isPending = !!(kurzInfo?.kurzPending);
  const kde    = first.soldWhere ? ` · ${first.soldWhere}` : '';
  const eurTag = kurzInfo ? ` (${kurzInfo.castkaCizi} EUR)` : '';
  const popis  = items.length === 1
    ? `Prodej: ${first.name || 'položka ze SKLAD.'}${kde}${eurTag}`
    : `Prodej: ${items.map(i => i.name || '?').join(' · ')}${kde}${eurTag}`;

  const breakdown = items.map(i => {
    const cur = (i.sellCurrency||'CZK').toUpperCase();
    const p = cur === 'EUR' ? Number(i.sellPriceOrig || i.sellPrice || 0) : Number(i.sellPrice || 0);
    return `${i.name||'?'}: ${p} ${cur}`;
  }).join(' | ');

  const { addDoc } = window._firebase;
  const record = {
    typ: 'prijem', datum, popis,
    doklad: first.saleRef || '',
    castka: Math.round(castka * 100) / 100,
    kategorie: _prodejKategorie(first.soldWhere), ucet: 'bank', zdanitelny: true,
    poznamka: `Importováno ze SKLAD.${kurzInfo && !rateOk ? ` ⚠️ DOPLŇ RUČNĚ částku v CZK (${kurzInfo.castkaCizi} EUR, kurz ČNB nedostupný)` : isPending ? ` ⏳ Kurz z ${fmtDate(kurzInfo.kurzDatum)}, dnešní kurz ČNB ještě nebyl vyhlášen` : ''} · ${breakdown}`,
  };
  if (rateOk) Object.assign(record, kurzInfo);
  await addDoc(col('transakce'), record);
}

function _prodejKategorie(soldWhere) {
  const w = (soldWhere || '').toLowerCase();
  if (/stockx|klekt|hypeboost|alias|kick/.test(w)) return 'prodej_platforma';
  if (/thebeast|pikastore|released|komis/.test(w))  return 'prodej_komis';
  return 'prodej_local';
}

function _showSkladConnected() {
  document.getElementById('sklad-disconnected').style.display = 'none';
  document.getElementById('sklad-connected').style.display = 'block';
  document.getElementById('sklad-sync-badge').style.display = 'inline-flex';
  _updateSkladSyncInfo();
}

function _showSkladDisconnected() {
  document.getElementById('sklad-disconnected').style.display = 'block';
  document.getElementById('sklad-connected').style.display = 'none';
  document.getElementById('sklad-sync-badge').style.display = 'none';
  document.getElementById('sklad-pwd').value = '';
}

function _updateSkladSyncInfo() {
  const el = document.getElementById('sklad-sync-info');
  if (!el) return;
  const nakupy  = (state.nastaveni.skladSyncedIds     || []).length;
  const prodeje = (state.nastaveni.skladSyncedSaleIds || []).length;
  el.textContent = `Sleduje ${nakupy} nákupů · ${prodeje} prodejů`;

  // Show items that are blocked from syncing
  const synced     = state.nastaveni.skladSyncedIds     || [];
  const syncedSale = state.nastaveni.skladSyncedSaleIds || [];
  const items      = state.skladItems || [];

  const waiting = items
    .filter(i => i.id && !synced.includes(i.id) && !(Number(i.buyPrice) > 0))
    .map(i => ({ name: i.name || '?', reasons: ['chybí nákupní cena'] }));

  const waitingEl  = document.getElementById('sklad-sync-waiting');
  const waitingList = document.getElementById('sklad-sync-waiting-list');
  if (!waitingEl || !waitingList) return;

  if (waiting.length) {
    waitingEl.style.display = '';
    waitingList.innerHTML = waiting.map(w =>
      `<div>• <strong>${esc(w.name)}</strong> — ${w.reasons.join(', ')}</div>`
    ).join('');
  } else {
    waitingEl.style.display = 'none';
    waitingList.innerHTML = '';
  }
}

// ── CUSTOM SELECT ─────────────────────────────────────────────
class CustomSelect {
  constructor(selectEl) {
    this.select = selectEl;
    selectEl._cs = this;
    this._build();
  }

  _variant() {
    if (this.select.classList.contains('form-control')) return 'cs-fc';
    if (this.select.classList.contains('filter-select')) return 'cs-fs';
    return 'cs-sidebar';
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = `cs-wrapper ${this._variant()}`;

    const trigger = document.createElement('div');
    trigger.className = 'cs-trigger';

    const label = document.createElement('span');
    label.className = 'cs-label';

    const arrow = document.createElement('span');
    arrow.className = 'cs-arrow';
    arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>`;

    trigger.append(label, arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown';

    wrap.append(trigger, dropdown);
    this.select.after(wrap);
    this.select.style.display = 'none';

    this._wrap = wrap;
    this._label = label;
    this._dropdown = dropdown;

    this.updateLabel();

    trigger.addEventListener('click', e => { e.stopPropagation(); this._toggle(); });
  }

  updateLabel() {
    const opt = this.select.options[this.select.selectedIndex];
    if (opt) {
      this._label.textContent = opt.text;
      this._label.classList.toggle('cs-placeholder', !opt.value);
    }
  }

  _buildOptions() {
    this._dropdown.innerHTML = '';
    Array.from(this.select.options).forEach(opt => {
      const div = document.createElement('div');
      div.className = 'cs-option' +
        (opt.value === this.select.value ? ' cs-selected' : '') +
        (!opt.value ? ' cs-placeholder-opt' : '');
      div.textContent = opt.text;
      div.addEventListener('click', e => {
        e.stopPropagation();
        this.select.value = opt.value;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateLabel();
        this._close();
      });
      this._dropdown.appendChild(div);
    });
  }

  _open() {
    document.querySelectorAll('.cs-wrapper.cs-open, .dp-wrapper.dp-open').forEach(w => w.classList.remove('cs-open', 'dp-open'));
    this._buildOptions();
    this._wrap.classList.add('cs-open');
    const rect = this._wrap.getBoundingClientRect();
    this._dropdown.classList.toggle('cs-dropdown-up', window.innerHeight - rect.bottom < 260 && rect.top > 260);
  }

  _close() { this._wrap.classList.remove('cs-open'); }
  _toggle() { this._wrap.classList.contains('cs-open') ? this._close() : this._open(); }
}

// ── CUSTOM DATE PICKER ────────────────────────────────────────
const MONTHS_CZ = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
const DAYS_CZ   = ['Po','Út','St','Čt','Pá','So','Ne'];

class CustomDatePicker {
  constructor(inputEl) {
    this.input = inputEl;
    inputEl._dp = this;
    this._vm = null;
    this._vy = null;
    this._build();
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'dp-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'dp-trigger';
    trigger.innerHTML = `<svg class="dp-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg><span class="dp-value dp-empty">Vyberte datum</span>`;

    const cal = document.createElement('div');
    cal.className = 'dp-calendar';

    wrap.append(trigger, cal);
    this.input.after(wrap);
    this.input.style.display = 'none';

    this._wrap = wrap;
    this._valEl = trigger.querySelector('.dp-value');
    this._cal = cal;

    this.updateTrigger();
    trigger.addEventListener('click', e => { e.stopPropagation(); this._toggle(); });
  }

  updateTrigger() {
    const v = this.input.value;
    if (v) {
      const [y, m, d] = v.split('-');
      this._valEl.textContent = `${parseInt(d)}. ${parseInt(m)}. ${y}`;
      this._valEl.classList.remove('dp-empty');
    } else {
      this._valEl.textContent = 'Vyberte datum';
      this._valEl.classList.add('dp-empty');
    }
  }

  _render() {
    const today = todayStr();
    const sel   = this.input.value;
    const ref   = sel ? new Date(sel) : new Date();
    if (this._vm === null) { this._vm = ref.getMonth(); this._vy = ref.getFullYear(); }

    const first = new Date(this._vy, this._vm, 1);
    const last  = new Date(this._vy, this._vm + 1, 0);
    let dow = first.getDay() - 1; if (dow < 0) dow = 6;

    let cells = DAYS_CZ.map(d => `<div class="dp-day-name">${d}</div>`).join('');
    for (let i = 0; i < dow; i++) cells += `<div class="dp-cell dp-empty"></div>`;
    for (let d = 1; d <= last.getDate(); d++) {
      const ds = `${this._vy}-${String(this._vm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells += `<div class="dp-cell${ds===sel?' dp-selected':''}${ds===today?' dp-today':''}" data-date="${ds}">${d}</div>`;
    }

    this._cal.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-d="-1">‹</button>
        <span class="dp-month-year">${MONTHS_CZ[this._vm]} ${this._vy}</span>
        <button type="button" class="dp-nav" data-d="1">›</button>
      </div>
      <div class="dp-grid">${cells}</div>`;

    this._cal.querySelectorAll('.dp-nav').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._vm += parseInt(btn.dataset.d);
        if (this._vm < 0)  { this._vm = 11; this._vy--; }
        if (this._vm > 11) { this._vm = 0;  this._vy++; }
        this._render();
      });
    });

    this._cal.querySelectorAll('.dp-cell:not(.dp-empty)').forEach(cell => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        this.input.value = cell.dataset.date;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateTrigger();
        this._close();
      });
    });
  }

  _open() {
    document.querySelectorAll('.cs-wrapper.cs-open, .dp-wrapper.dp-open').forEach(w => w.classList.remove('cs-open', 'dp-open'));
    this._vm = null;
    this._render();
    this._wrap.classList.add('dp-open');
    const rect = this._wrap.getBoundingClientRect();
    this._cal.classList.toggle('dp-calendar-up', window.innerHeight - rect.bottom < 310 && rect.top > 310);
  }

  _close() { this._wrap.classList.remove('dp-open'); }
  _toggle() { this._wrap.classList.contains('dp-open') ? this._close() : this._open(); }
}

// ── INIT CUSTOM COMPONENTS ────────────────────────────────────
function initCustomComponents() {
  document.querySelectorAll('select').forEach(el => {
    if (el._cs || el.style.display === 'none') return;
    new CustomSelect(el);
  });
  document.querySelectorAll('input[type="date"]').forEach(el => {
    if (el._dp || el.style.display === 'none') return;
    new CustomDatePicker(el);
  });
}

// Close all dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.cs-wrapper.cs-open, .dp-wrapper.dp-open').forEach(w => w.classList.remove('cs-open', 'dp-open'));
});

initCustomComponents();

