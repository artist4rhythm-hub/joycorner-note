// 조이코너 노트 — 교사 전용 아이 돌봄 앱 (GitHub Pages + Firebase)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
  query, where, onSnapshot, writeBatch, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, OWNER_EMAIL } from './firebase-config.js';

/* ---------- 작은 도구들 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const DOW = '일월화수목금토';
const fmtMD = s => { const d = parseD(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const sundayOnOrBefore = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const ko = (a, b) => String(a).localeCompare(String(b), 'ko');
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 괜찮아요 */ } };
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  att: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 14l2 2 4-4"/>',
  kids: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  stats: '<path d="M5 20V11M12 20V4M19 20v-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  room: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 16h7"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'
};
const svg = (p, s = 24, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ---------- 파이어베이스 ---------- */
const configured = !String(firebaseConfig.apiKey).includes('붙여넣기');
let auth, db;
if (configured) {
  const fbApp = initializeApp(firebaseConfig);
  auth = getAuth(fbApp);
  try {
    db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch { db = getFirestore(fbApp); }
}

/* ---------- 상태 ---------- */
const S = {
  phase: 'boot', user: null, me: null,
  classes: {}, myClasses: [], cur: null,
  kids: {}, att: {}, fam: {}, schedule: [],
  attDate: ymd(sundayOnOrBefore(new Date())),
  watchKey: '', unsubAtt: null, pending: false,
  kidFor: null, kidData: null, staff: [], staffEx: {}, editStaff: null, editStaff2: null, importOk: false, noteKind: '', bip: null, helpDev: null, showArchived: false, lastKey: ''
};
const appEl = $('#app');

/* ---------- 데이터 읽기 ---------- */
async function loadAll() {
  const cs = await getDocs(collection(db, 'classes'));
  S.classes = {}; cs.forEach(d => { S.classes[d.id] = { id: d.id, ...d.data() }; });
  const isAdmin = S.me.role === 'admin';
  S.myClasses = (isAdmin ? Object.keys(S.classes) : (S.me.classes || []).filter(c => S.classes[c])).sort();
  const saved = lsGet('jc_cur');
  S.cur = S.myClasses.includes(saved) ? saved : S.myClasses[0] || null;
  await Promise.all(S.myClasses.map(async c => {
    const k = await getDocs(query(collection(db, 'children'), where('classId', '==', c)));
    S.kids[c] = k.docs.map(d => ({ id: d.id, ...d.data() }));
    const a = await getDocs(query(collection(db, 'attendance'), where('classId', '==', c)));
    S.att[c] = {}; a.forEach(d => { S.att[c][d.data().date] = d.data().marks || {}; });
  }));
  const sc = await getDocs(collection(db, 'schedule'));
  S.schedule = sc.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ko(a.date, b.date));
  try {
    const st = await getDocs(collection(db, 'staff'));
    S.staff = st.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || ko(a.name, b.name));
  } catch { S.staff = []; }
  const mine = S.staff.find(x => x.email && x.email === S.me.email); if (mine) S.me.name = mine.name;
  R.notices = null; R.events = null; await loadRoom();
  // 가정 정보는 미리 받아 두면 인터넷이 끊겨도 볼 수 있어요
  S.myClasses.forEach(c => (S.kids[c] || []).forEach(k => { if (k.familyId && !S.fam[k.familyId]) loadFam(k.familyId); }));
}
async function loadFam(id) {
  if (S.fam[id]) return S.fam[id];
  try { const s = await getDoc(doc(db, 'families', id)); if (s.exists()) S.fam[id] = { id, ...s.data() }; } catch { /* 권한/오프라인 */ }
  return S.fam[id];
}

/* ---------- 계산 ---------- */
const activeKids = c => (S.kids[c] || []).filter(k => (k.status || 'active') === 'active').sort((a, b) => ko(a.name, b.name));
const allKids = () => S.myClasses.flatMap(c => S.kids[c] || []);
const findKid = id => allKids().find(k => k.id === id);
const recorded = c => Object.keys(S.att[c] || {}).filter(d => Object.values(S.att[c][d] || {}).includes('p')).sort();
const presentCount = (c, d) => activeKids(c).filter(k => (S.att[c]?.[d] || {})[k.id] === 'p').length;
function streak(c, kid) {
  let n = 0;
  for (const d of recorded(c).reverse()) {
    if (kid.since && d < kid.since) break;
    if (S.att[c][d][kid.id] === 'p') break;
    n++;
  }
  return n;
}
const careList = c => activeKids(c)
  .map(k => ({ k, n: streak(c, k) }))
  .filter(x => x.n >= 2 || (x.k.flags || []).includes('장기결석'))
  .sort((a, b) => b.n - a.n);
function kidRate(c, kid, weeks = 8) {
  const ds = recorded(c).slice(-weeks).filter(d => !kid.since || d >= kid.since);
  if (!ds.length) return null;
  return ds.filter(d => S.att[c][d][kid.id] === 'p').length / ds.length;
}
const schedFor = d => S.schedule.find(x => x.date === d);
// '김혜원, 김소명' 같은 칸에 이 이름이 정확히 들어 있는가 (현우 ≠ 김현우)
const hasName = (str, name) => !!name && String(str || '').split(/[,\s·/()]+/).includes(name);
function classStaff(c) {
  const l = S.staff.filter(x => (x.classes || []).includes(c));
  return { homeroom: l.filter(x => (x.classRole || {})[c] === '담임').map(x => x.name), assistants: l.filter(x => (x.classRole || {})[c] !== '담임').map(x => x.name) };
}
const roleLabel = st => st.role === 'director' ? '디렉터' : st.role === 'admin' ? '시스템 관리자' : st.kind === 'helper' ? '헬퍼' : '교사';
const canManageRoles = () => !!(S.me.owner || S.me.director);
// 내가 이 사람의 권한을 바꿀 수 있는가 (수퍼관리자 > 디렉터 > 관리자 > 교사)
const canEditStaff = st => S.me.owner || (S.me.director ? st.role !== 'director' : !['admin', 'director'].includes(st.role));
function upcomingBirthdays(c) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return activeKids(c).filter(k => k.birth).map(k => {
    const [, m, d] = k.birth.split('-').map(Number);
    let n = new Date(today.getFullYear(), m - 1, d);
    if (n < today) n = new Date(today.getFullYear() + 1, m - 1, d);
    return { k, n, days: Math.round((n - today) / 86400000), label: `${m}/${d}` };
  }).filter(x => x.days <= 45).sort((a, b) => a.days - b.days);
}

/* ---------- 그림 ---------- */
function avatar(k, size = 64) {
  if (k.thumb) return `<img class="ph" src="${k.thumb}" alt="" loading="lazy" decoding="async" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
  const h = hash(k.id || k.name), kind = ['bear', 'bunny', 'cat', 'mouse'][h % 4], color = (h >> 3) % 6 + 1;
  return `<span class="avw" style="width:${size}px;height:${size}px"><span class="av c${color}" style="display:block;transform:scale(${size / 64});transform-origin:0 0"><i class="ear l ${kind}"></i><i class="ear r ${kind}"></i><span class="head"><i class="eye l"></i><i class="eye r"></i><i class="cheek l"></i><i class="cheek r"></i><i class="mouth"></i></span></span></span>`;
}

/* ---------- 화면 조각 ---------- */
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; appEl.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function sheet(html) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sbg'; bg.id = 'sheet';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
  appEl.appendChild(bg);
  return bg;
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }

function classChips() {
  if (S.myClasses.length < 2) return '';
  return `<div class="seg" role="tablist">${S.myClasses.map(c => `<button role="tab" class="${c === S.cur ? 'on' : ''}" data-act="cls" data-id="${c}">${esc(S.classes[c].name)}</button>`).join('')}</div>`;
}
// 각 화면은 nav('탭이름')으로 어느 탭이 켜질지만 알려 주고, 실제 메뉴는 paint()가 붙여요
function nav(active) { S.navActive = active; return ''; }
function navHtml(active) {
  const t = (k, ic, label) => `<button class="tab ${active === k ? 'on' : ''}" data-act="go" data-to="${k}">${svg(ICON[ic])}<span>${label}</span></button>`;
  return `<nav class="nav" aria-label="메뉴"><div class="brand"><img src="icon-192.png" alt="조이코너" width="52" height="52"></div>${t('home', 'home', '홈')}${t('attend', 'att', '출석')}${t('friends', 'kids', '친구들')}${t('worship', 'music', '예배')}${t('room', 'room', '교사실')}<button class="tab deskonly ${active === 'help' ? 'on' : ''}" data-act="go" data-to="help">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>')}<span>도우미</span></button></nav>`;
}
const noClass = () => `<div class="center"><div class="big">아직 반이 없어요</div><div class="sub">${S.me.role === 'admin' ? '설정에서 시트 데이터를 가져오거나 교사를 등록해 주세요.' : '관리자에게 맡을 반을 정해 달라고 말해 주세요.'}</div>${S.me.role === 'admin' ? `<button class="cta" style="max-width:280px" data-act="go" data-to="settings">설정 열기</button>` : ''}</div>`;

/* ---------- 로그인/대기 ---------- */
function vLogin() {
  return `<div class="center"><img src="logo-dark.png" alt="JOY 조이코너" class="loginlogo"><div class="hello" style="font-size:22px">교사 노트</div><div class="sub">우리 친구들을 기억하고 돌보는<br>선생님 전용 앱이에요</div><button class="cta" style="max-width:300px" data-act="login">구글로 로그인</button></div>`;
}
const vSetup = () => `<div class="center"><div class="big">설정이 아직 안 끝났어요</div><div class="sub">firebase-config.js 파일에 파이어베이스 설정 값을 붙여넣어 주세요.<br>(안내서 2단계)</div></div>`;
const vPending = () => `<div class="center"><div class="big">아직 등록되지 않았어요</div><div class="sub">${esc(S.user.email)}<br>이 이메일을 관리자에게 알려 주세요.<br>등록되면 바로 들어올 수 있어요.</div><button class="sec" data-act="logout">다른 계정으로 로그인</button><button class="ghost" data-act="reload">다시 확인하기</button></div>`;

/* ---------- 홈 ---------- */
function vHome() {
  const c = S.cur; const name = S.me.name || S.user.displayName || '';
  const header = `<header class="hd"><div><div class="hello">안녕하세요, ${esc(name)} 선생님!</div><div class="sub">${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${DOW[new Date().getDay()]}요일</div></div><div class="btns"><button class="iconbtn" data-act="go" data-to="help" aria-label="도우미">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>')}</button><button class="iconbtn" data-act="go" data-to="settings" aria-label="설정">${svg(ICON.gear)}</button></div></header>${welcomeLine()}`;
  if (!c) return `<div class="scroll">${header}${noClass()}${versionCard()}</div>`;
  const cl = S.classes[c], kids = activeKids(c), faces = kids.slice(0, 3);
  const todayStr = ymd(new Date());
  const nextS = S.schedule.find(x => x.date >= todayStr && !x.noService) || S.schedule[S.schedule.length - 1];
  const diff = nextS ? Math.round((parseD(nextS.date) - parseD(todayStr)) / 86400000) : 99;
  const care = careList(c).slice(0, 6), bdays = upcomingBirthdays(c).slice(0, 4);
  return `<div class="scroll cols">${header}${classChips()}
<section class="card"><div class="rowtop"><div style="display:flex;padding-left:10px">${faces.map(k => `<span style="margin-left:-10px;border:3px solid #fff;border-radius:50%;display:block;line-height:0">${avatar(k, 46)}</span>`).join('')}</div><div><div class="big">${esc(cl.name)}</div><div class="sub">친구 ${kids.length}명</div></div></div>
<div class="chips">${(() => { const cs = classStaff(c); const h = cs.homeroom.map(n => `<span class="chip">담임 ${esc(n)}</span>`).join('') + cs.assistants.map(n => `<span class="chip">${esc(n)}</span>`).join(''); return h || (S.me.role === 'admin' ? `<button class="chip dashed" data-act="go" data-to="settings">+ 교사 명단에서 정해 주세요</button>` : '<span class="chip">담임 미정</span>'); })()}</div>
<button class="cta" data-act="go" data-to="attend">${svg(ICON.checkc, 28, 2.4)}출석 시작하기</button></section>
${nextS ? `<section class="card"><div class="lbl"><span>${diff <= 7 ? '이번 주일' : '다음 주일'} · ${fmtMD(nextS.date)}</span></div><div class="big">${esc(nextS.story || (nextS.noService ? '조이코너 예배 없음' : '이야기 준비 중'))}</div><div class="meta">${nextS.preacher ? `<span>설교 ${esc(nextS.preacher)}</span>` : ''}${nextS.offering ? `<span>헌금기도 ${esc(nextS.offering)} 가정</span>` : ''}${nextS.pray ? `<span>중보기도 ${esc(nextS.pray)}</span>` : ''}</div></section>` : ''}
${(() => { const me = S.me.name || ''; if (!me || !nextS) return ''; const L = { preacher: '성경이야기 설교', pray: '중보기도 인도', nation: '성전건축·나라 기도', chant: '챈트', dance: '율동', guitar: '기타·메트로놈' }; const m = Object.entries(L).filter(([k]) => hasName(nextS[k], me)).map(([, l]) => l); return m.length ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>${fmtMD(nextS.date)} 내 담당</span></div><div class="chips">${m.map(x => `<span class="chip">${x}</span>`).join('')}</div><button class="ghost" data-act="go" data-to="worship">주일 예배 보기</button></section>` : ''; })()}
<section class="card"><div class="lbl"><span>돌봄이 필요해요</span></div>${care.length ? `<div class="carerow">${care.map(x => `<button class="carekid" data-act="kid" data-id="${x.k.id}">${avatar(x.k, 56)}<b>${esc(x.k.name)}</b><span class="tag">${x.n >= 2 ? x.n + '주 결석' : '장기결석'}</span></button>`).join('')}</div>` : `<div class="sub">지금은 걱정되는 친구가 없어요. 감사해요!</div>`}</section>
<section class="card"><div class="lbl"><span>곧 생일이에요</span></div>${bdays.length ? bdays.map(x => `<div class="bday"><span class="d">${x.label}</span><span>${esc(x.k.name)}${x.days === 0 ? ' · 오늘!' : ''}</span></div>`).join('') : `<div class="sub">45일 안에 생일인 친구가 없어요.</div>`}</section>

${homeNoticeCard()}${homeEventsCard()}${versionCard()}
</div>${nav('home')}`;
}

/* ---------- 출석 ---------- */
function vAttend() {
  const c = S.cur; if (!c) return `<div class="scroll">${noClass()}</div>${nav('attend')}`;
  const kids = activeKids(c), d = S.attDate, marks = (S.att[c] || {})[d] || {};
  const n = kids.filter(k => marks[k.id] === 'p').length, pct = kids.length ? Math.round(n / kids.length * 100) : 0;
  const sch = schedFor(d), maxD = ymd(sundayOnOrBefore(new Date()));
  const dd = parseD(d);
  return `<div class="ahead"><div class="top"><div class="ttl" style="font-size:22px">${esc(S.classes[c].name)} <span class="cnt">${n}<small>/${kids.length}</small></span></div>
<div class="date"><button data-act="week" data-n="-7" aria-label="지난 주">◀</button><span>${dd.getMonth() + 1}/${dd.getDate()} 주일</span><button data-act="week" data-n="7" aria-label="다음 주" ${d >= maxD ? 'disabled' : ''}>▶</button></div></div>
<div class="row2"><div class="bar"><div class="fill" style="width:${pct}%"></div></div><span class="save ${S.pending ? 'wait' : ''}">${S.pending ? '대기 중' : '저장됨'}</span><button class="pri sm" data-act="allIn">${svg(ICON.checkc, 20, 2.4)}전원 출석</button></div></div>
<div class="scroll" style="padding-top:8px">${classChips()}
<div class="story">${sch ? (sch.noService ? '이 주일은 조이코너 예배가 없어요' : '오늘의 이야기 · ' + esc(sch.story || '')) : ''}${S.pending ? ' · 인터넷이 연결되면 저절로 올라가요' : ''}</div>
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><p class="hint">한 번 누르면 출석, 다시 누르면 취소</p><button class="ghost" style="min-height:40px;padding:0 14px;font-size:13px;flex:none" data-act="clearAsk">다시 하기</button></div>
<div class="grid">${kids.map(k => { const on = marks[k.id] === 'p'; return `<button class="kid ${on ? 'on' : ''}" data-act="toggle" data-id="${k.id}" aria-pressed="${on}"><span class="stamp">${svg(ICON.check, 18, 3)}</span>${avatar(k, 64)}<b class="nm">${esc(k.name)}</b><span class="st">${on ? '왔어요' : '아직'}</span></button>`; }).join('')}</div>
<button class="addkid" data-act="addKid">+ 새로 온 친구 등록</button><button class="ghost" data-act="go" data-to="stats">출석 통계 보기</button></div>${nav('attend')}`;
}
function ensureAttWatch() {
  const want = S.route === 'attend' && S.cur ? `${S.cur}_${S.attDate}` : '';
  if (want === S.watchKey) return;
  if (S.unsubAtt) { S.unsubAtt(); S.unsubAtt = null; }
  S.watchKey = want; S.pending = false;
  if (!want) return;
  const c = S.cur, d = S.attDate;
  S.unsubAtt = onSnapshot(doc(db, 'attendance', want), { includeMetadataChanges: true }, snap => {
    if (snap.exists()) { (S.att[c] ||= {})[d] = snap.data().marks || {}; }
    S.pending = snap.metadata.hasPendingWrites;
    if (S.route === 'attend' && S.watchKey === want) paint();
  }, () => { /* 권한 없음 등은 조용히 */ });
}
function writeMarks(marksPatch) {
  const c = S.cur, d = S.attDate;
  return setDoc(doc(db, 'attendance', `${c}_${d}`), { classId: c, date: d, marks: marksPatch, updatedAt: serverTimestamp(), updatedBy: S.me.email }, { merge: true })
    .catch(e => toast('저장하지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)));
}
function toggleKid(id) {
  const c = S.cur, d = S.attDate; const marks = ((S.att[c] ||= {})[d] ||= {});
  const on = marks[id] === 'p'; if (on) delete marks[id]; else marks[id] = 'p';
  paint(); writeMarks({ [id]: on ? deleteField() : 'p' });
}

/* ---------- 친구들 ---------- */
function vFriends() {
  const c = S.cur; if (!c) return `<div class="scroll">${noClass()}</div>${nav('friends')}`;
  const kids = activeKids(c), arch = (S.kids[c] || []).filter(k => (k.status || 'active') !== 'active').sort((a, b) => ko(a.name, b.name));
  const row = k => {
    const n = streak(c, k);
    return `<button class="row" data-act="kid" data-id="${k.id}" data-name="${esc(k.name)}">${avatar(k, 48)}<span class="grow"><span class="nm">${esc(k.name)}</span><span class="sub">${k.birth ? k.birth.replace(/-/g, '.') + ' 생' : '생일 모름'}</span></span>${n >= 2 ? `<span class="tag">${n}주 결석</span>` : ''}${(k.flags || []).filter(f => f !== '장기결석').map(f => `<span class="tag g">${esc(f)}</span>`).join('')}</button>`;
  };
  return `<div class="scroll"><div class="ttl">친구들</div>${classChips()}
<input class="search" id="q" type="search" placeholder="이름으로 찾기" autocomplete="off">
<div class="list klist" id="klist">${kids.map(row).join('')}</div>
${arch.length ? (S.showArchived ? `<div class="lbl">함께하지 않는 친구</div><div class="list">${arch.map(row).join('')}</div>` : `<button class="ghost" data-act="showArch">함께하지 않는 친구 ${arch.length}명 보기</button>`) : ''}
<button class="addkid" data-act="addKid">+ 새로 온 친구 등록</button></div>${nav('friends')}`;
}

/* ---------- 아이 카드 ---------- */
async function loadKid(id) {
  const k = findKid(id); if (!k) { S.kidData = { missing: true }; return; }
  const data = { photos: {}, notes: [], fam: null };
  S.kidData = data; S.kidFor = id;
  const [fam, p0, p1, p2, notes] = await Promise.all([
    loadFam(k.familyId),
    ...['main', '1', '2'].map(s => getDoc(doc(db, 'photos', `${id}_${s}`)).then(x => x.exists() ? x.data().data : null).catch(() => null)),
    getDocs(query(collection(db, 'careNotes'), where('classId', '==', k.classId), where('childId', '==', id))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => [])
  ]);
  if (S.kidFor !== id) return;
  data.fam = fam; data.photos = { main: p0, 1: p1, 2: p2 };
  data.notes = notes.sort((a, b) => ko(b.date || '', a.date || ''));
  if (S.route === 'kid') paint();
}
function vKid() {
  const k = findKid(S.arg);
  if (!k) return `<div class="scroll"><button class="back" data-act="back">← 돌아가기</button><div class="sub">친구를 찾을 수 없어요.</div></div>${nav('friends')}`;
  const c = k.classId, kd = S.kidData && S.kidFor === k.id ? S.kidData : null, fam = S.fam[k.familyId] || kd?.fam;
  const slot = (s, cls, label) => {
    const src = kd?.photos?.[s] || (s === 'main' ? k.thumb : null);
    return `<button class="slot ${cls}" data-act="photo" data-slot="${s}" aria-label="${label} 사진 바꾸기">${src ? `<img src="${src}" alt="${esc(k.name)} ${label}">` : `사진 넣기`}<span class="plus">+</span></button>`;
  };
  const ds = recorded(c).slice(-8);
  const p = (who, nm, cell, tel, role) => nm ? `<div class="person"><div><b>${esc(nm)}</b> <span class="sub">${role}</span>${cell ? `<div class="cell">${esc(/^\d?[A-Za-z]?\d+$/.test(cell) ? '셀 ' + cell : cell)}</div>` : ''}</div>${tel ? `<div class="contact"><a href="tel:${esc(tel)}">전화</a><a href="sms:${esc(tel)}">문자</a></div>` : ''}</div>` : '';
  const n = streak(c, k);
  return `<div class="scroll cols"><div class="hd"><button class="back" data-act="back">← 친구들</button><button class="sec" data-act="editKid" style="min-height:44px">고치기</button></div>
<div class="rowtop"><div><div class="ttl">${esc(k.name)}</div><div class="sub">${esc(S.classes[c]?.name || '')} · ${k.birth ? k.birth.replace(/-/g, '.') + ' 생' : '생일 모름'}</div></div></div>
<div class="chips">${n >= 2 ? `<span class="tag">${n}주째 결석</span>` : ''}${(k.flags || []).map(f => `<span class="tag g">${esc(f)}</span>`).join('')}${k.remark ? `<span class="chip sm">${esc(k.remark)}</span>` : ''}</div>
${k.note ? `<div class="note">${esc(k.note)}</div>` : ''}
<div class="photos">${slot('main', 'main', '대표')}${slot('1', '', '추가1')}${slot('2', '', '추가2')}</div>
<section class="card"><div class="lbl"><span>최근 출석</span></div>${ds.length ? `<div class="dots">${ds.map(d => { const v = S.att[c][d][k.id] === 'p' ? 'p' : 'a'; const dd = parseD(d); return `<div class="dot"><i class="${(k.since && d < k.since) ? '' : v}"></i>${dd.getMonth() + 1}/${dd.getDate()}</div>`; }).join('')}</div><div class="sub">초록은 왔어요, 분홍은 못 왔어요</div>` : `<div class="sub">아직 출석 기록이 없어요.</div>`}</section>
<section class="card"><div class="lbl"><span>가정</span></div>${fam ? `${p('f', fam.father, fam.fatherCell, fam.fatherTel, '아버지')}${p('m', fam.mother, fam.motherCell, fam.motherTel, '어머니')}${(fam.siblings || []).length ? `<div class="chips">${fam.siblings.map(s => `<span class="chip sm">${esc(s.name)}${s.org ? ' · ' + esc(s.org) : ''}</span>`).join('')}</div>` : ''}${(!fam.father && !fam.mother) ? '<div class="sub">부모님 정보가 아직 없어요. 고치기에서 적어 주세요.</div>' : ''}` : `<div class="sub">불러오는 중…</div>`}</section>
${(kd?.notes || []).some(x => x.kind === '기도제목') ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>기도 제목</span></div>${kd.notes.filter(x => x.kind === '기도제목').slice(0, 5).map(x => `<div class="note"><span style="white-space:pre-wrap">${esc(x.text)}</span><small><span>${esc(x.date || '')} · ${esc(x.byName || '')}</span></small></div>`).join('')}</section>` : ''}
<section class="card"><div class="lbl"><span>돌봄 기록</span></div>
<div class="chips">${NOTE_KINDS.map(t => `<button class="chip sm kindbtn ${S.noteKind === t ? 'on' : ''}" data-act="noteKind" data-id="${t}">${t}</button>`).join('')}</div>
<textarea id="noteText" placeholder="심방, 통화, 기도제목, 아이의 변화 등을 적어 주세요"></textarea>
<button class="sec" data-act="noteAdd">기록 남기기</button>
${(kd?.notes || []).map(x => `<div class="note">${x.kind ? `<span class="tag g" style="align-self:flex-start">${esc(x.kind)}</span>` : ''}<span style="white-space:pre-wrap">${esc(x.text)}</span><small><span>${esc(x.date || '')} · ${esc(x.byName || '')}</span>${(x.by === S.me.email || S.me.role === 'admin') ? `<button data-act="noteDel" data-id="${x.id}">지우기</button>` : ''}</small></div>`).join('')}</section></div>${nav('friends')}`;
}

/* ---------- 통계 ---------- */
function classAvg(c, w = 4) {
  const kids = activeKids(c).length, ds = recorded(c).slice(-w);
  if (!kids || !ds.length) return null;
  return ds.reduce((s, d) => s + presentCount(c, d), 0) / ds.length / kids;
}
function vStats() {
  const c = S.cur; if (!c) return `<div class="scroll"><div class="ttl">교사실</div>${roomTabs('stats')}${noClass()}</div>${nav('room')}`;
  const kids = activeKids(c), total = kids.length, ds = recorded(c).slice(-8);
  const counts = ds.map(d => presentCount(c, d));
  const now = new Date(), mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const mds = recorded(c).filter(d => d.startsWith(mk));
  const useDs = mds.length ? mds : recorded(c).slice(-4);
  const avgN = useDs.length ? useDs.reduce((s, d) => s + presentCount(c, d), 0) / useDs.length : 0;
  const avgP = total && useDs.length ? Math.round(avgN / total * 100) : null;
  const care = careList(c).filter(x => x.n >= 2);
  const low = kids.map(k => ({ k, r: kidRate(c, k) })).filter(x => x.r !== null).sort((a, b) => a.r - b.r).slice(0, 5);
  return `<div class="scroll cols"><div class="ttl">교사실</div>${roomTabs('stats')}${classChips()}
<section class="card"><div class="lbl"><span>${esc(S.classes[c].name)} 최근 ${ds.length}주 출석</span></div>${ds.length ? `<div class="chart">${counts.map((n, i) => `<div class="col"><b>${n}</b><i class="${i === counts.length - 1 ? 'cur' : ''}" style="height:${Math.max(4, Math.round(n / Math.max(total, 1) * 100))}px"></i></div>`).join('')}</div><div class="axis">${ds.map(d => { const x = parseD(d); return `<span>${x.getMonth() + 1}/${x.getDate()}</span>`; }).join('')}</div>` : `<div class="sub">출석을 기록하면 여기에 그래프가 나와요.</div>`}</section>
<div class="twoc"><section class="card"><div class="lbl"><span>${mds.length ? '이번 달 평균' : '최근 4주 평균'}</span></div><div class="bigp">${avgP ?? '-'}<small>%</small></div><div class="s2">${total}명 중 평균 ${Math.round(avgN)}명</div></section>
<section class="card"><div class="lbl"><span>돌봄 신호</span></div><div class="bigp">${care.length}<small>명</small></div><div class="s2">2주 이상 연속 결석</div></section></div>
${low.length ? `<section class="card"><div class="lbl"><span>출석이 적은 친구 (최근 8주)</span></div>${low.map(x => `<button class="hb" style="border:0;background:none;padding:6px 0;cursor:pointer;min-height:44px" data-act="kid" data-id="${x.k.id}"><span class="nm w">${esc(x.k.name)}</span><div class="tr"><i style="width:${Math.round(x.r * 100)}%"></i></div><span class="pc">${Math.round(x.r * 100)}%</span></button>`).join('')}</section>` : ''}
${S.myClasses.length > 1 ? `<section class="card"><div class="lbl"><span>반별 비교 (최근 4주 평균)</span></div>${S.myClasses.map(k => { const a = classAvg(k); return `<div class="hb"><span class="nm">${esc(S.classes[k].name)}</span><div class="tr"><i style="width:${a === null ? 0 : Math.round(a * 100)}%"></i></div><span class="pc">${a === null ? '-' : Math.round(a * 100) + '%'}</span></div>`; }).join('')}</section>` : ''}
<div class="s2">* 비율은 지금 함께하는 친구 수를 기준으로 계산해요.</div></div>${nav('room')}`;
}

/* ---------- 설정 ---------- */
function vSettings() {
  const admin = S.me.role === 'admin';
  return `<div class="scroll cols"><div class="hd"><button class="back" data-act="back">← 홈</button></div><div class="ttl">설정</div>
<section class="card"><div class="lbl"><span>내 정보</span></div><div class="big" style="font-size:22px">${esc(S.me.name || S.user.displayName || '')}</div><div class="sub">${esc(S.user.email)} · ${S.me.owner ? '수퍼관리자' : S.me.director ? '디렉터' : admin ? '시스템 관리자' : '교사'}</div><button class="sec" data-act="logout">로그아웃</button></section>
${admin ? `
${vStaffList()}
<section class="card"><div class="lbl"><span>시트 데이터 가져오기</span></div><div class="sub">처음에는 joycorner-import.json(전체). 그 뒤에 더할 때는 extra 파일(아이 정보는 건드리지 않아요).</div><label class="filebtn">${svg('<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>', 20, 1.8)}<span id="impName">파일 고르기</span><input type="file" id="impFile" accept="application/json,.json" hidden></label><div class="pbar hide" id="impBar"><i></i></div><div class="sub" id="impMsg"></div><button class="sec" data-act="runImport">가져오기 시작</button></section>
<section class="card"><div class="lbl"><span>연도별 백업</span></div><div class="sub">한 해의 기록을 파일 하나로 내려받아 보관해요.</div><div class="two"><label class="fld">연도<select class="in" id="bk_year">${[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1].map(y => `<option ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select></label><span></span></div><div class="btns" style="flex-wrap:wrap"><button class="ghost" data-act="backup" data-id="0">사진 빼고</button><button class="ghost" data-act="backup" data-id="1">사진까지</button></div><div class="s2" id="bk_msg"></div></section>
${isDirectorMe() ? `<section class="card"><div class="lbl"><span>새해 반 올리기</span><span class="s2">디렉터</span></div><div class="sub">해가 바뀌면 모든 반이 한 학년씩 올라가고, 7세반은 졸업해요.</div><button class="sec" data-act="go" data-to="promote">반 올리기 화면 열기</button></section>` : ''}
${S.me.owner ? `<section class="card"><div class="lbl"><span>사용 현황</span><span class="s2">수퍼관리자</span></div><div class="sub">누가 언제 어떤 화면을 많이 쓰는지 봐요.</div><button class="sec" data-act="go" data-to="usage">사용 현황 보기</button></section>` : ''}
<section class="card"><div class="lbl"><span>출석 기록 내려받기</span></div><div class="sub">엑셀로 열 수 있는 파일(CSV)이에요. 백업용으로 좋아요.</div><div class="btns" style="flex-wrap:wrap">${S.myClasses.map(c => `<button class="ghost" data-act="csv" data-id="${c}">${esc(S.classes[c].name)}</button>`).join('')}</div></section>` : ''}
<div class="s2 full" style="text-align:center">조이코너 노트 ${APP_VERSION} · 아이들의 얼굴과 정보는 로그인한 선생님에게만 보여요<br>이 앱에는 카페24(주)가 제공한 Cafe24 동동 글꼴이 적용되어 있어요.</div></div>${nav('home')}`;
}

function vStaffList() {
  const total = S.staff.length, linked = S.staff.filter(x => x.email).length;
  const row = (st, c) => `<button class="row" data-act="staff" data-id="${st.id}"><span class="grow"><span class="nm">${esc(st.name)}${c ? ` <span class="tag ${(st.classRole || {})[c] === '담임' ? '' : 'g'}">${esc((st.classRole || {})[c] || '보조')}</span>` : ''}${st.role === 'admin' || st.role === 'director' ? ` <span class="tag">${roleLabel(st)}</span>` : ''}</span><span class="sub">${esc((st.duties || []).join(' · ') || '맡은 역할 없음')}</span></span><span class="chip sm" style="${st.email ? 'background:#DDF1E3;color:#1E6B3E' : ''}">${st.email ? '구글 연결됨' : '연결 전'}</span></button>`;
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  const groups = cls.map(cl => {
    const l = S.staff.filter(x => (x.classes || []).includes(cl.id)).sort((a, b) => ((a.classRole || {})[cl.id] === '담임' ? 0 : 1) - ((b.classRole || {})[cl.id] === '담임' ? 0 : 1));
    return l.length ? `<div class="lbl" style="margin-top:6px">${esc(cl.name)}</div><div class="list">${l.map(x => row(x, cl.id)).join('')}</div>` : '';
  }).join('');
  const dirs = S.staff.filter(x => x.role === 'director');
  const helpers = S.staff.filter(x => x.kind === 'helper');
  const free = S.staff.filter(x => !(x.classes || []).length && x.role !== 'director' && x.kind !== 'helper');
  return `<section class="card"><div class="lbl"><span>교사 명단</span><span class="s2">구글 연결 ${linked}/${total}</span></div>
<div class="sub">명단을 먼저 만들어 두고, 구글 계정은 나중에 연결하면 돼요. 연결 전에는 수퍼관리자·디렉터·시스템 관리자가 내용을 고쳐요. 디렉터는 수퍼관리자가, 시스템 관리자는 디렉터가 정해요.</div>
${dirs.length ? `<div class="lbl" style="margin-top:6px">디렉터 (조이코너 전체 관리)</div><div class="list">${dirs.map(x => row(x)).join('')}</div>` : ''}${groups}${free.length ? `<div class="lbl" style="margin-top:6px">반 없음</div><div class="list">${free.map(x => row(x)).join('')}</div>` : ''}${helpers.length ? `<div class="lbl" style="margin-top:6px">헬퍼 선생님 (일일·외부)</div><div class="list">${helpers.map(x => row(x)).join('')}</div>` : ''}
${total ? '' : '<div class="sub">아직 명단이 없어요. 시트 데이터를 가져오면 15명이 들어와요.</div>'}
<button class="sec" data-act="staff">+ 교사 추가</button></section>`;
}

/* ---------- 그리기 ---------- */
const VIEWS = { home: vHome, attend: vAttend, friends: vFriends, kid: vKid, stats: vStats, settings: vSettings, worship: vWorship, room: vRoom, notice: vNotice, event: vEvent, staff: vStaff, help: vHelp, usage: vUsage, promote: vPromote };
function paint() {
  if (S.phase === 'setup') { appEl.innerHTML = vSetup(); return; }
  if (S.phase === 'boot') { appEl.innerHTML = '<div class="center"><div class="sub">불러오는 중…</div></div>'; return; }
  if (S.phase === 'login') { appEl.innerHTML = vLogin(); return; }
  if (S.phase === 'pending') { appEl.innerHTML = vPending(); return; }
  const sc = $('.scroll'), top = sc ? sc.scrollTop : 0, key = S.route + (S.arg || '') + S.cur;
  const sheetEl = $('#sheet');
  S.navActive = 'home';
  const view = (VIEWS[S.route] || vHome)();
  appEl.innerHTML = `<main class="main">${view}</main>${navHtml(S.navActive)}`;
  if (sheetEl) appEl.appendChild(sheetEl);
  const sc2 = $('.scroll');
  if (sc2 && key === S.lastKey) sc2.scrollTop = top;
  S.lastKey = key;
}
function route() {
  const [, r, a] = (location.hash || '#/home').split('/');
  S.route = VIEWS[r] ? r : 'home'; S.arg = a || '';
  if (S.phase !== 'ready') return paint();
  ensureAttWatch();
  if (S.route !== 'kid') S.kidFor = null;
  usageScreen(S.route);
  if (S.route === 'promote') { PROMO.inc = null; }
  if (S.route === 'worship') loadWorship().then(() => { if (S.route === 'worship') paint(); });
  if (['room', 'notice', 'stats', 'home', 'event', 'staff'].includes(S.route)) loadRoom().then(() => { if (['room', 'notice', 'home', 'event', 'staff'].includes(S.route)) paint(); });
  if (S.route === 'staff' && S.arg && !(S.staffEx[S.arg] && S.staffEx[S.arg].notes)) { S.staffEx[S.arg] = { notes: null }; loadStaffExtra(S.arg); }
  if (S.route === 'kid' && S.kidFor !== S.arg) { S.kidData = null; S.kidFor = S.arg; loadKid(S.arg).catch(() => { }); }
  paint();
}
window.addEventListener('hashchange', () => { closeSheet(); route(); });
const go = h => { if (location.hash === '#/' + h) route(); else location.hash = '#/' + h; };

/* ---------- 사진 자르기 ---------- */
function pickPhoto(kidId, slot) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { toast('이 사진은 열 수 없어요'); return; }
    openCrop(kidId, slot, bmp);
  };
  inp.click();
}
function openCrop(kidId, slot, bmp) {
  const SZ = 300; const st = { s: Math.max(SZ / bmp.width, SZ / bmp.height) }; st.min = st.s; st.x = (SZ - bmp.width * st.s) / 2; st.y = (SZ - bmp.height * st.s) / 2;
  sheet(`<div class="ttl" style="font-size:22px">얼굴이 가운데 오게 맞춰 주세요</div><div class="crop" id="cropBox"><canvas id="cv" width="${SZ}" height="${SZ}"></canvas></div><label class="fld">크게 / 작게<input type="range" id="zoom" min="${st.min}" max="${st.min * 5}" step="0.001" value="${st.s}"></label><div class="btns"><button class="pri" data-act="cropSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const clamp = () => { st.x = Math.min(0, Math.max(SZ - bmp.width * st.s, st.x)); st.y = Math.min(0, Math.max(SZ - bmp.height * st.s, st.y)); };
  const draw = () => { clamp(); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, SZ, SZ); ctx.drawImage(bmp, st.x, st.y, bmp.width * st.s, bmp.height * st.s); };
  draw();
  let drag = null; const box = $('#cropBox');
  box.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox: st.x, oy: st.y }; box.setPointerCapture(e.pointerId); };
  box.onpointermove = e => { if (!drag) return; const k = SZ / box.clientWidth; st.x = drag.ox + (e.clientX - drag.x) * k; st.y = drag.oy + (e.clientY - drag.y) * k; draw(); };
  box.onpointerup = box.onpointercancel = () => { drag = null; };
  $('#zoom').oninput = e => { const ns = Number(e.target.value), cx = (SZ / 2 - st.x) / st.s, cy = (SZ / 2 - st.y) / st.s; st.s = ns; st.x = SZ / 2 - cx * ns; st.y = SZ / 2 - cy * ns; draw(); };
  S.cropSave = async () => {
    const out = (px, q) => { const o = document.createElement('canvas'); o.width = o.height = px; o.getContext('2d').drawImage(bmp, st.x * px / SZ, st.y * px / SZ, bmp.width * st.s * px / SZ, bmp.height * st.s * px / SZ); return o.toDataURL('image/jpeg', q); };
    const k = findKid(kidId); const full = out(400, 0.82);
    try {
      await setDoc(doc(db, 'photos', `${kidId}_${slot}`), { childId: kidId, classId: k.classId, slot, data: full, updatedAt: serverTimestamp() });
      if (slot === 'main') { const th = out(160, 0.74); await updateDoc(doc(db, 'children', kidId), { thumb: th }); k.thumb = th; }
      if (S.kidData && S.kidFor === kidId) S.kidData.photos[slot] = full;
      closeSheet(); toast('사진을 저장했어요'); paint();
    } catch (e) { toast('사진을 저장하지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)); }
  };
}

/* ---------- 입력 창들 ---------- */
const val = id => (document.getElementById(id)?.value || '').trim();
function editKidSheet() {
  const k = findKid(S.arg), f = S.fam[k.familyId] || {};
  const admin = S.me.role === 'admin';
  sheet(`<div class="ttl" style="font-size:24px">${esc(k.name)} 고치기</div>
<label class="fld">이름<input class="in" id="e_name" value="${esc(k.name)}"></label>
<label class="fld">생일<input class="in" id="e_birth" type="date" value="${esc(k.birth || '')}"></label>
<label class="fld">메모<input class="in" id="e_remark" value="${esc(k.remark || '')}" placeholder="예: 알레르기, 좋아하는 것"></label>
<label class="chk"><input type="checkbox" id="e_long" ${(k.flags || []).includes('장기결석') ? 'checked' : ''}>장기결석으로 표시</label>
<div class="two"><label class="fld">아버지<input class="in" id="e_fn" value="${esc(f.father || '')}"></label><label class="fld">아버지 연락처<input class="in" id="e_ft" type="tel" value="${esc(f.fatherTel || '')}"></label></div>
<div class="two"><label class="fld">어머니<input class="in" id="e_mn" value="${esc(f.mother || '')}"></label><label class="fld">어머니 연락처<input class="in" id="e_mt" type="tel" value="${esc(f.motherTel || '')}"></label></div>
<div class="two"><label class="fld">아버지 셀<input class="in" id="e_fc" value="${esc(f.fatherCell || '')}"></label><label class="fld">어머니 셀<input class="in" id="e_mc" value="${esc(f.motherCell || '')}"></label></div>
${admin ? `<div class="two"><label class="fld">반<select class="in" id="e_cls">${Object.values(S.classes).sort((a, b) => a.age - b.age).map(c => `<option value="${c.id}" ${c.id === k.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="fld">상태<select class="in" id="e_status">${[['active', '함께해요'], ['graduated', '졸업했어요'], ['moved', '이사/이동했어요'], ['paused', '쉬고 있어요']].map(([v, l]) => `<option value="${v}" ${(k.status || 'active') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>` : ''}
<div class="btns"><button class="pri" data-act="saveKid">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
async function saveKid() {
  const k = findKid(S.arg), name = val('e_name'); if (!name) return toast('이름을 적어 주세요');
  const flags = (k.flags || []).filter(x => x !== '장기결석'); if ($('#e_long').checked) flags.push('장기결석');
  const patch = { name, birth: val('e_birth'), remark: val('e_remark'), flags };
  const admin = S.me.role === 'admin'; const oldClass = k.classId;
  if (admin) { patch.classId = val('e_cls') || k.classId; patch.status = val('e_status') || 'active'; }
  const fpatch = { father: val('e_fn'), fatherTel: val('e_ft'), fatherCell: val('e_fc'), mother: val('e_mn'), motherTel: val('e_mt'), motherCell: val('e_mc') };
  try {
    await updateDoc(doc(db, 'children', k.id), patch);
    if (k.familyId) await setDoc(doc(db, 'families', k.familyId), fpatch, { merge: true });
    S.fam[k.familyId] = { ...(S.fam[k.familyId] || {}), ...fpatch, id: k.familyId };
    Object.assign(k, patch);
    if (admin && patch.classId !== oldClass) await moveClass(k, oldClass);
    closeSheet(); toast('저장했어요'); route();
  } catch (e) { toast('저장하지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)); }
}
async function moveClass(k, oldClass) {
  S.kids[oldClass] = (S.kids[oldClass] || []).filter(x => x.id !== k.id); (S.kids[k.classId] ||= []).push(k);
  for (const s of ['main', '1', '2']) { try { const r = doc(db, 'photos', `${k.id}_${s}`); if ((await getDoc(r)).exists()) await updateDoc(r, { classId: k.classId }); } catch { /* 없음 */ } }
  try {
    const ns = await getDocs(query(collection(db, 'careNotes'), where('classId', '==', oldClass), where('childId', '==', k.id)));
    for (const d of ns.docs) await updateDoc(d.ref, { classId: k.classId });
  } catch { /* 없음 */ }
  const ids = new Set(allKids().filter(x => x.familyId === k.familyId).map(x => x.classId));
  if (k.familyId) await setDoc(doc(db, 'families', k.familyId), { classIds: [...ids] }, { merge: true });
}
function addKidSheet() {
  sheet(`<div class="ttl" style="font-size:24px">새로 온 친구</div><div class="sub">${esc(S.classes[S.cur].name)}에 등록해요.</div>
<label class="fld">이름<input class="in" id="n_name"></label><label class="fld">생일<input class="in" id="n_birth" type="date"></label>
<div class="two"><label class="fld">아버지<input class="in" id="n_fn"></label><label class="fld">아버지 연락처<input class="in" id="n_ft" type="tel"></label></div>
<div class="two"><label class="fld">어머니<input class="in" id="n_mn"></label><label class="fld">어머니 연락처<input class="in" id="n_mt" type="tel"></label></div>
<div class="btns"><button class="pri" data-act="addKidSave">등록</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
async function addKidSave() {
  const name = val('n_name'); if (!name) return toast('이름을 적어 주세요');
  const c = S.cur; const famRef = doc(collection(db, 'families')), kidRef = doc(collection(db, 'children'));
  const fam = { father: val('n_fn'), fatherTel: val('n_ft'), mother: val('n_mn'), motherTel: val('n_mt'), fatherCell: '', motherCell: '', siblings: [], childIds: [kidRef.id], classIds: [c] };
  const kid = { classId: c, name, birth: val('n_birth'), birthYear: val('n_birth') ? Number(val('n_birth').slice(0, 4)) : null, status: 'active', familyId: famRef.id, flags: ['새친구'], remark: '', note: '', thumb: '', since: S.attDate };
  try {
    await setDoc(famRef, fam); await setDoc(kidRef, { ...kid, createdAt: serverTimestamp() });
    S.fam[famRef.id] = { id: famRef.id, ...fam }; (S.kids[c] ||= []).push({ id: kidRef.id, ...kid });
    closeSheet(); toast(name + ' 친구를 등록했어요'); paint();
  } catch (e) { toast('등록하지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)); }
}
async function addNote() {
  const text = val('noteText'); if (!text) return toast('내용을 적어 주세요');
  const k = findKid(S.arg); const ref = doc(collection(db, 'careNotes'));
  const n = { childId: k.id, classId: k.classId, text, kind: S.noteKind || '', date: ymd(new Date()), by: S.me.email, byName: S.me.name || S.user.displayName || '' };
  try { await setDoc(ref, { ...n, createdAt: serverTimestamp() }); S.kidData.notes.unshift({ id: ref.id, ...n }); paint(); toast('기록을 남겼어요'); } catch (e) { toast('저장하지 못했어요'); }
}

/* ---------- 관리자 기능 ---------- */
function staffSheet(id) {
  const st = id ? S.staff.find(x => x.id === id) : { name: '', role: 'teacher', classes: [], classRole: {}, duties: [], email: '' };
  if (!st) return;
  if (id && !canEditStaff(st)) return toast(st.role === 'director' ? '디렉터 정보는 수퍼관리자만 고칠 수 있어요' : '시스템 관리자 정보는 수퍼관리자와 디렉터만 고칠 수 있어요');
  S.editStaff = id || null;
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  sheet(`<div class="ttl" style="font-size:24px">${id ? esc(st.name) + ' 선생님' : '교사 추가'}</div>
<label class="fld">이름<input class="in" id="s_name" value="${esc(st.name)}"></label>
<label class="fld">권한<select class="in" id="s_role" ${canManageRoles() ? '' : 'disabled'}><option value="teacher" ${!['admin', 'director'].includes(st.role) ? 'selected' : ''}>교사 (맡은 반만)</option><option value="admin" ${st.role === 'admin' ? 'selected' : ''}>시스템 관리자 (아이·데이터 관리)</option>${S.me.owner || st.role === 'director' ? `<option value="director" ${st.role === 'director' ? 'selected' : ''}>디렉터 (조이코너 전체 관리 장)</option>` : ''}</select></label>
<div class="s2">${S.me.owner ? '디렉터는 조이코너 전체를 맡고, 시스템 관리자를 정할 수 있어요.' : canManageRoles() ? '시스템 관리자까지 정할 수 있어요. 디렉터는 수퍼관리자가 정해요.' : '권한은 수퍼관리자와 디렉터가 정해요.'}</div>
<label class="fld">구분<select class="in" id="s_kind"><option value="regular" ${st.kind !== 'helper' ? 'selected' : ''}>선생님</option><option value="helper" ${st.kind === 'helper' ? 'selected' : ''}>헬퍼 선생님 (일일·외부)</option></select></label>
<div class="fld">맡은 반</div>${cls.map(c => `<div class="two" style="align-items:center"><span style="font-size:18px">${esc(c.name)}</span><select class="in" id="s_cr_${c.id}"><option value="">맡지 않음</option><option value="담임" ${(st.classRole || {})[c.id] === '담임' ? 'selected' : ''}>담임</option><option value="보조" ${(st.classRole || {})[c.id] === '보조' ? 'selected' : ''}>보조</option></select></div>`).join('') || '<div class="s2">반은 데이터를 가져오면 생겨요.</div>'}
<label class="fld">맡은 역할 (쉼표로 구분)<input class="in" id="s_duty" value="${esc((st.duties || []).join(', '))}" placeholder="예: 율동, 기도 인도"></label>
<label class="fld">구글 계정 이메일 (나중에 넣어도 돼요)<input class="in" id="s_email" type="email" value="${esc(st.email || '')}" placeholder="example@gmail.com"></label>
<div class="s2">이메일을 넣으면 그 구글 계정으로 로그인할 수 있어요. 지우면 로그인이 막혀요.</div>
<div class="btns"><button class="pri" data-act="saveStaff">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="delStaffAsk">명단에서 빼기</button>' : ''}`);
}
async function saveStaff() {
  const id = S.editStaff, old = id ? S.staff.find(x => x.id === id) : {};
  const name = val('s_name'); if (!name) return toast('이름을 적어 주세요');
  let role = canManageRoles() ? val('s_role') : (old.role || 'teacher');
  if (role === 'director' && !S.me.owner) role = old.role || 'teacher';
  const classRole = {}, classes = [];
  Object.keys(S.classes).forEach(c => { const v = val('s_cr_' + c); if (v) { classRole[c] = v; classes.push(c); } });
  const duties = val('s_duty').split(',').map(x => x.trim()).filter(Boolean);
  const email = val('s_email').toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast('이메일을 확인해 주세요');
  if (email && S.staff.some(x => x.email === email && x.id !== id)) return toast('이 이메일은 다른 선생님에게 연결되어 있어요');
  const owner = OWNER_EMAIL.toLowerCase();
  const ref = id ? doc(db, 'staff', id) : doc(collection(db, 'staff'));
  const data = { name, role, kind: val('s_kind') || 'regular', classes, classRole, duties, email, order: old.order ?? (Math.max(0, ...S.staff.map(x => x.order || 0)) + 1) };
  ['phone', 'birth', 'intro', 'thumb', 'photo'].forEach(k => { if (old[k] !== undefined) data[k] = old[k]; });
  const prev = old.email || '';
  try {
    await setDoc(ref, data);
    if (prev && prev !== email) {
      if (prev === owner) await setDoc(doc(db, 'teachers', prev), { name: S.me.name || '', role: 'admin', classes: [] });
      else await deleteDoc(doc(db, 'teachers', prev));
    }
    if (email) await setDoc(doc(db, 'teachers', email), { staffId: ref.id, name, role: email === owner ? 'admin' : role, classes });
    const i = S.staff.findIndex(x => x.id === ref.id);
    if (i >= 0) S.staff[i] = { id: ref.id, ...data }; else S.staff.push({ id: ref.id, ...data });
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { toast('저장하지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)); }
}
async function delStaff() {
  const id = S.editStaff, st = S.staff.find(x => x.id === id); if (!st) return;
  try {
    await deleteDoc(doc(db, 'staff', id));
    if (st.email && st.email !== OWNER_EMAIL.toLowerCase()) await deleteDoc(doc(db, 'teachers', st.email));
    S.staff = S.staff.filter(x => x.id !== id); closeSheet(); toast('명단에서 뺐어요'); paint();
  } catch (e) { toast('지우지 못했어요: ' + (e.code === 'permission-denied' ? '권한이 없어요' : e.message)); }
}
async function runImport() {
  const f = $('#impFile')?.files[0]; if (!f) return toast('가져올 파일을 먼저 골라 주세요');
  let data; try { data = JSON.parse(await f.text()); } catch { return toast('파일을 읽을 수 없어요'); }
  if (!data.children && !data.duties && !data.staff && !data.schedulePatch) return toast('조이코너 가져오기 파일이 아니에요');
  if (data.children && !S.importOk && allKids().length) {
    return sheet(`<div class="ttl" style="font-size:22px">이미 아이들 정보가 있어요</div><div class="sub">다시 가져오면 아이·가정·출석·일정이 시트 내용으로 덮어써져요. 그동안 앱에서 고친 내용이 사라질 수 있어요. (교사 명단의 구글 연결은 그대로 남아요)</div><div class="btns"><button class="pri" data-act="importYes">그래도 가져오기</button><button class="sec" data-act="sheetClose">취소</button></div>`);
  }
  S.importOk = false;
  const ops = [];
  for (const v of (data.staff || [])) { const { id, ...r } = v; ops.push([doc(db, 'staff', id), r, true]); }
  for (const [id, v] of Object.entries(data.classes || {})) ops.push([doc(db, 'classes', id), v]);
  for (const v of (data.families || [])) { const { id, ...r } = v; ops.push([doc(db, 'families', id), r]); }
  for (const v of (data.children || [])) { const { id, ...r } = v; ops.push([doc(db, 'children', id), { ...r, createdAt: serverTimestamp() }]); }
  for (const [id, v] of Object.entries(data.attendance || {})) ops.push([doc(db, 'attendance', id), { ...v, updatedBy: 'import' }]);
  for (const v of (data.schedule || [])) ops.push([doc(db, 'schedule', v.date), v]);
  for (const v of (data.duties || [])) { const { id, ...r } = v; ops.push([doc(db, 'duties', id), r]); }
  for (const v of (data.schedulePatch || [])) ops.push([doc(db, 'schedule', v.date), v, true]);
  for (const v of (data.incoming || [])) { const { id, ...r } = v; ops.push([doc(db, 'incoming', id), r, true]); }
  for (const v of (data.stories || [])) { const { id, ...r } = v; ops.push([doc(db, 'stories', id), r]); }
  const photoOps = Object.entries(data.photos || {}).map(([id, v]) => [doc(db, 'photos', id), v]);
  const chunks = []; for (let i = 0; i < ops.length; i += 150) chunks.push(ops.slice(i, i + 150));
  for (let i = 0; i < photoOps.length; i += 15) chunks.push(photoOps.slice(i, i + 15));
  const bar = $('#impBar'), fill = bar.firstElementChild, msg = $('#impMsg'); bar.classList.remove('hide');
  try {
    for (let i = 0; i < chunks.length; i++) {
      const b = writeBatch(db); chunks[i].forEach(([r, d, m]) => (m ? b.set(r, d, { merge: true }) : b.set(r, d))); await b.commit();
      fill.style.width = Math.round((i + 1) / chunks.length * 100) + '%'; msg.textContent = `올리는 중… ${i + 1}/${chunks.length}`;
    }
    msg.textContent = '끝났어요! 화면을 새로 불러올게요.'; W.duties = null; W.stories = null; await loadAll(); route(); toast('가져오기가 끝났어요');
  } catch (e) { msg.textContent = '중간에 멈췄어요: ' + (e.code === 'permission-denied' ? '권한 문제예요. 규칙을 확인해 주세요' : e.message); }
}
function downloadCsv(c) {
  const kids = activeKids(c), ds = Object.keys(S.att[c] || {}).sort();
  const rows = [['이름', '생일', ...ds], ...kids.map(k => [k.name, k.birth || '', ...ds.map(d => (S.att[c][d] || {})[k.id] === 'p' ? 'O' : 'X')])];
  const csv = '﻿' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `조이코너_${S.classes[c].name}_출석.csv`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- 주일 예배 (이번 주 · 설교 · 악보 · 업무 분담) ---------- */
const W = { tab: 'week', date: null, sermons: null, songs: {}, setlist: {}, comments: {}, duties: null, stories: null, pages: {}, editSermon: null, editSong: null, editDuty: null };
const nextSunday = () => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate()); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return ymd(d); };
const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const isAdminMe = () => S.me.role === 'admin';
const myName = () => S.me.name || S.user.displayName || '';
const statusLabel = st => st === 'done' ? '점검 완료' : st === 'review' ? '점검 요청' : '작성 중';
const errMsg = e => (e && e.code === 'permission-denied') ? '권한이 없어요 (구글 계정이 교사 명단에 연결되어 있어야 해요)' : (e && e.message) || '';

async function loadWorship() {
  if (!W.date) W.date = nextSunday();
  const jobs = [];
  if (W.sermons === null) { W.sermons = undefined; jobs.push(getDocs(collection(db, 'sermons')).then(s => { W.sermons = s.docs.map(d => ({ id: d.id, ...d.data() })); }).catch(() => { W.sermons = []; })); }
  if (W.duties === null) { W.duties = undefined; jobs.push(getDocs(collection(db, 'duties')).then(s => { W.duties = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); }).catch(() => { W.duties = []; })); }
  if (W.stories === null) { W.stories = undefined; jobs.push(getDocs(collection(db, 'stories')).then(s => { W.stories = s.docs.map(d => ({ id: d.id, ...d.data() })); }).catch(() => { W.stories = []; })); }
  if (!W.songs[W.date]) jobs.push(loadSongs(W.date));
  await Promise.all(jobs);
}
async function loadSongs(d) {
  if (W.songs[d]) return;
  try {
    const [s, sl] = await Promise.all([getDocs(query(collection(db, 'songs'), where('date', '==', d))), getDoc(doc(db, 'setlists', d))]);
    W.songs[d] = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    W.setlist[d] = sl.exists() ? sl.data() : { memo: '' };
  } catch { W.songs[d] = []; W.setlist[d] = { memo: '' }; }
}
async function loadComments(postId) {
  try {
    const s = await getDocs(query(collection(db, 'comments'), where('postId', '==', postId)));
    W.comments[postId] = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ko(a.at || '', b.at || ''));
  } catch { W.comments[postId] = []; }
}

function vWorship() {
  if (!W.date) W.date = nextSunday();
  const d = W.date, dd = parseD(d);
  if (W.tab === 'duty') W.tab = 'week';
  const tabs = [['week', '이번 주'], ['sermon', '설교'], ['songs', '악보']];
  const ready = Array.isArray(W.sermons) && Array.isArray(W.duties) && Array.isArray(W.stories) && W.songs[d];
  const head = `<div class="ttl">주일 예배</div>
<div class="seg">${tabs.map(([k, l]) => `<button class="${W.tab === k ? 'on' : ''}" data-act="wtab" data-id="${k}">${l}</button>`).join('')}</div>
${W.tab === 'duty' ? '' : `<div class="weekbar"><button data-act="wweek" data-n="-7" aria-label="지난 주">◀</button><b>${dd.getFullYear() !== new Date().getFullYear() ? dd.getFullYear() + '년 ' : ''}${dd.getMonth() + 1}월 ${dd.getDate()}일 주일${d === nextSunday() ? ' · 이번 주' : ''}</b><button data-act="wweek" data-n="7" aria-label="다음 주">▶</button></div>`}`;
  let body = '<div class="sub">불러오는 중…</div>';
  if (ready) body = W.tab === 'week' ? wWeek(d) : W.tab === 'sermon' ? wSermon(d) : wSongs(d);
  return `<div class="scroll ${W.tab === 'week' ? 'cols' : 'narrow'}">${head}${body}</div>${nav('worship')}`;
}

/* 이번 주 */

/* 설교 */
function wSermon(d) {
  const list = W.sermons.filter(x => x.date === d);
  const s = schedFor(d) || {};
  const title = (list[0] && list[0].title) || s.story || '';
  const story = title ? W.stories.find(x => x.title && (x.title === title || title.includes(x.title) || x.title.includes(title))) : null;
  const past = W.sermons.filter(x => x.date !== d).sort((a, b) => ko(b.date, a.date)).slice(0, 30);
  return `${list.map(sermonCard).join('') || `<section class="card"><div class="sub">${s.story ? `이번 주 이야기 <b>${esc(s.story)}</b>${s.preacher ? ' · ' + esc(s.preacher) : ''}<br>` : ''}아직 올라온 설교가 없어요.</div></section>`}
${list.some(x => x.authorEmail === S.me.email) ? '' : '<button class="cta" data-act="sermonNew">설교 올리기</button>'}
${story && (story.notes || story.links) ? `<section class="card"><div class="lbl"><span>설교 참고 · 표준 순서 ${story.no}번</span></div>${story.notes ? `<div class="post">${linkify(story.notes)}</div>` : ''}${story.links ? `<div class="lbl"><span>참고 설교 영상</span></div><div class="post">${linkify(story.links)}</div>` : ''}</section>` : ''}
${past.length ? `<section class="card"><div class="lbl"><span>지난 설교</span></div><div class="list">${past.map(p => `<button class="row" data-act="wgo" data-id="${p.date}" style="min-height:56px"><span class="grow"><span class="nm" style="font-size:17px">${esc(p.title || '제목 없음')}</span><span class="sub">${fmtMD(p.date)} · ${esc(p.authorName || '')}</span></span><span class="tag ${p.status === 'done' ? 'g' : ''}">${statusLabel(p.status)}</span></button>`).join('')}</div></section>` : ''}`;
}
function sermonCard(p) {
  const mine = p.authorEmail === S.me.email, admin = isAdminMe();
  if (!(p.id in W.comments)) { W.comments[p.id] = null; loadComments(p.id).then(() => { if (S.route === 'worship') paint(); }); }
  const cm = W.comments[p.id];
  const chk = [['room', '참여룸'], ['activity', '활동'], ['drama', '연극']].filter(([k]) => p.check && p.check[k]).map(([, l]) => `<span class="chip sm">${l}</span>`).join('');
  return `<section class="card"><div class="lbl"><span>${esc(p.authorName || '')} 선생님</span><span class="tag ${p.status === 'done' ? 'g' : ''}">${statusLabel(p.status)}</span></div>
<div class="big">${esc(p.title || '제목 없음')}</div>${p.passage ? `<div class="sub">본문 · ${esc(p.passage)}</div>` : ''}
${chk ? `<div class="chips">${chk}</div>` : ''}
${p.script ? `<div class="lbl"><span>대본</span></div><div class="post">${linkify(p.script)}</div>` : ''}
${p.quiz ? `<div class="lbl"><span>O/X 퀴즈</span></div><div class="post">${linkify(p.quiz)}</div>` : ''}
${p.links ? `<div class="lbl"><span>자료 (PPT·그림·영상)</span></div><div class="post">${linkify(p.links)}</div>` : ''}
${mine || admin ? `<div class="btns" style="flex-wrap:wrap"><button class="ghost" data-act="sermonEdit" data-id="${p.id}">고치기</button>${mine && p.status === 'draft' ? `<button class="ghost" data-act="sermonStatus" data-id="${p.id}" data-s="review">점검 요청</button>` : ''}${admin && p.status !== 'done' ? `<button class="ghost" data-act="sermonStatus" data-id="${p.id}" data-s="done">점검 완료</button>` : ''}</div>` : ''}
<div class="lbl" style="margin-top:4px"><span>댓글 ${cm ? cm.length : ''}</span></div>
${cm === null ? '<div class="s2">불러오는 중…</div>' : cm.map(c => `<div class="note"><span style="white-space:pre-wrap">${linkify(c.text)}</span><small><span>${esc(c.byName || '')}${c.role ? ' · ' + esc(c.role) : ''} · ${esc((c.at || '').slice(5, 10).replace('-', '/'))}</span>${c.by === S.me.email || admin ? `<button data-act="cmDel" data-id="${c.id}" data-p="${p.id}">지우기</button>` : ''}</small></div>`).join('')}
<textarea id="cm_${p.id}" placeholder="격려나 피드백을 남겨 주세요" style="min-height:64px"></textarea><button class="sec" data-act="cmAdd" data-id="${p.id}">댓글 달기</button></section>`;
}
function sermonSheet(id) {
  const s = schedFor(W.date) || {};
  const p = id ? W.sermons.find(x => x.id === id) : { date: W.date, title: s.story || '', passage: '', script: '', quiz: '', links: '', check: {} };
  if (!p) return;
  W.editSermon = id || null;
  sheet(`<div class="ttl" style="font-size:24px">${id ? '설교 고치기' : '설교 올리기'}</div>
<div class="two"><label class="fld">주일<input class="in" type="date" id="p_date" value="${esc(p.date)}"></label><label class="fld">본문<input class="in" id="p_passage" value="${esc(p.passage || '')}" placeholder="예: 삼상 17장"></label></div>
<label class="fld">제목<input class="in" id="p_title" value="${esc(p.title || '')}"></label>
<label class="fld">대본<textarea id="p_script" style="min-height:220px" placeholder="성경이야기 대본을 적어 주세요">${esc(p.script || '')}</textarea></label>
<label class="fld">O/X 퀴즈<textarea id="p_quiz" placeholder="1. 다윗은 돌 다섯 개를 골랐어요. (O)">${esc(p.quiz || '')}</textarea></label>
<label class="fld">자료 링크 (PPT·구글 드라이브·영상)<textarea id="p_links" style="min-height:60px" placeholder="https://...">${esc(p.links || '')}</textarea></label>
<div class="fld">이번 설교에 들어가는 것</div><div class="chips">${[['room', '참여룸'], ['activity', '활동'], ['drama', '연극']].map(([k, l]) => `<label class="chk" style="min-height:40px;margin-right:8px"><input type="checkbox" id="p_${k}" ${p.check && p.check[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>
<div class="btns"><button class="pri" data-act="sermonSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="sermonDel">설교 지우기</button>' : ''}`);
}
async function sermonSave() {
  const id = W.editSermon, old = id ? W.sermons.find(x => x.id === id) : null;
  const data = { date: val('p_date') || W.date, title: val('p_title'), passage: val('p_passage'), script: $('#p_script').value, quiz: $('#p_quiz').value, links: $('#p_links').value.trim(), check: { room: $('#p_room').checked, activity: $('#p_activity').checked, drama: $('#p_drama').checked } };
  if (!data.title) return toast('제목을 적어 주세요');
  const ref = id ? doc(db, 'sermons', id) : doc(collection(db, 'sermons'));
  const full = id ? { ...old, ...data, updatedAt: new Date().toISOString() } : { ...data, status: 'draft', authorEmail: S.me.email, authorName: myName(), at: new Date().toISOString() };
  delete full.id;
  try {
    await setDoc(ref, full);
    if (old) Object.assign(old, full); else W.sermons.push({ id: ref.id, ...full });
    W.date = data.date; await loadSongs(W.date);
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function sermonDel() {
  const id = W.editSermon;
  try { await deleteDoc(doc(db, 'sermons', id)); W.sermons = W.sermons.filter(x => x.id !== id); closeSheet(); toast('지웠어요'); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}
async function sermonStatus(d) {
  const p = W.sermons.find(x => x.id === d.id); if (!p) return;
  const patch = { status: d.s }; if (d.s === 'done') { patch.reviewedBy = myName(); patch.reviewedAt = new Date().toISOString(); }
  try { await updateDoc(doc(db, 'sermons', p.id), patch); Object.assign(p, patch); toast(d.s === 'done' ? '점검 완료로 표시했어요' : '점검을 요청했어요'); paint(); } catch (e) { toast('바꾸지 못했어요: ' + errMsg(e)); }
}
async function addComment(postId, type) {
  const el = document.getElementById('cm_' + postId), text = (el?.value || '').trim(); if (!text) return toast('댓글을 적어 주세요');
  const ref = doc(collection(db, 'comments'));
  const role = S.me.owner ? '' : S.me.director ? '디렉터' : '';
  const c = { postId, postType: type || 'sermon', text, by: S.me.email, byName: myName(), role, at: new Date().toISOString() };
  try { await setDoc(ref, c); (W.comments[postId] ||= []).push({ id: ref.id, ...c }); paint(); } catch (e) { toast('댓글을 달지 못했어요: ' + errMsg(e)); }
}
async function delComment(id, postId) {
  try { await deleteDoc(doc(db, 'comments', id)); W.comments[postId] = (W.comments[postId] || []).filter(x => x.id !== id); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* 악보 */
async function slSave() {
  const d = W.date, memo = $('#sl_memo').value;
  try { const data = { date: d, memo, by: S.me.email, byName: myName(), at: new Date().toISOString() }; await setDoc(doc(db, 'setlists', d), data); W.setlist[d] = data; toast('기록을 저장했어요'); paint(); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function songMove(id, dir) {
  const list = W.songs[W.date] || [], i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const changed = [];
  list.forEach((g, k) => { if (g.order !== k + 1) { g.order = k + 1; changed.push(g); } });
  paint();
  try { const b = writeBatch(db); changed.forEach(g => b.update(doc(db, 'songs', g.id), { order: g.order })); await b.commit(); } catch (e) { toast('순서를 저장하지 못했어요: ' + errMsg(e)); }
}

/* 업무 분담 */
function wDuty() {
  const me = myName(), list = W.duties, admin = isAdminMe();
  const mine = list.filter(x => me && (x.people || []).includes(me));
  const empty = list.filter(x => !(x.people || []).length);
  const secs = ['예배 전', '예배 시', '예배 후'];
  return `${mine.length ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>내가 맡은 일</span></div><div class="chips">${mine.map(x => `<span class="chip">${esc(x.role)}</span>`).join('')}</div></section>` : ''}
${empty.length ? `<section class="card"><div class="lbl"><span>담당이 필요한 자리 ${empty.length}곳</span></div><div class="chips">${empty.map(x => `<span class="tag">${esc(x.role)}</span>`).join(' ')}</div></section>` : ''}
${secs.map(sec => { const l = list.filter(x => (x.section || '예배 시') === sec); if (!l.length) return ''; return `<div class="ttl" style="font-size:20px;margin-top:4px">${sec}</div>${l.map(x => `<button class="card tapcard duty" data-act="dutyEdit" data-id="${x.id}" ${admin ? '' : 'disabled'}><div class="lbl"><span>${esc(x.area)}${x.area !== x.role ? ' · ' + esc(x.role) : ''}</span>${(x.people || []).length ? '' : '<span class="tag">담당 필요</span>'}</div><div style="font-size:14px">${esc(x.desc || '')}</div>${(x.people || []).length ? `<div class="chips">${x.people.map(n => `<span class="chip sm ${n === me ? 'mine' : ''}">${esc(n)}</span>`).join('')}</div>` : ''}${x.note ? `<div class="s2" style="white-space:pre-wrap">※ ${esc(x.note)}</div>` : ''}</button>`).join('')}`; }).join('')}
${admin ? '<button class="sec" data-act="dutyEdit">+ 역할 추가</button>' : ''}
${list.length ? '' : '<div class="sub">업무 분담이 아직 없어요. 설정에서 joycorner-extra.json을 가져와 주세요.</div>'}`;
}
async function dutyDel() {
  const id = W.editDuty;
  try { await deleteDoc(doc(db, 'duties', id)); W.duties = W.duties.filter(y => y.id !== id); closeSheet(); toast('지웠어요'); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 교사실 (공지 · 캘린더 · 업무 분담 · 조직도 · 통계) ---------- */
const APP_VERSION = 'v9';
const APP_DATE = '2026-11-10';
const CHANGELOG = [
  { v: 'v9', date: '11월 11일', items: ['일정: 종일 또는 몇 시부터 몇 시까지', '순서표: 날짜 더하기 · 한 해 빈 주일 한 번에 만들기', '캘린더의 "예배 없음" 일정이 순서표·예배 탭에 함께 반영돼요', '주일 카드에 그날 일정이 함께 보여요', '눈 깜빡임: 두 번 → 다음, 세 번 → 이전'] },
  { v: 'v8', date: '11월 11일', items: ['순서표를 월별 서랍과 주일 카드로 정리 (아이콘 · 맡은 횟수 타일)', '헌금기도도 아이 얼굴 카드와 나이로', '선생님 색이 겹치지 않게, 사진을 넣으면 사진으로', '업무 분담 사람별 카드 · 반 올리기 화면을 가나다순 격자로', '위쪽 메뉴 칸 길이를 모든 화면에서 같게', '캘린더 기간 일정: 끌어서 고르기(컴퓨터) · 길게 눌러 고르기(폰)', '사진은 화면에 보일 때 불러와서 더 빨라졌어요'] },
  { v: 'v7', date: '11월 10일', items: ['권한 정리: 수퍼관리자 · 디렉터 · 시스템 관리자(데이터 담당) · 교사 · 헬퍼 선생님', '교사 돌봄 기록은 디렉터와 쓴 사람만 봐요', '이름 칸을 선생님 카드 고르기로 (업무 분담 · 주일 담당), 헬퍼 선생님 카드 바로 만들기', '교사실 순서표: 설교·기도 인도·챈트·율동·기타·헌금기도를 종류별로 한눈에, 사전 점검 표시', '캘린더에 주일 담당이 자동으로 보여요 · 내 순서 표시', '선생님 카드 사진을 눌러 바로 바꾸기', '사용 현황(수퍼관리자), 연도별 백업, 새해 반 올리기(디렉터)', '줄 바꿈 때 낱말이 끊기지 않게 정리'] },
  { v: 'v6', date: '11월 10일', items: ['조이코너 로고로 앱 아이콘을 바꿨어요', '사진은 10장까지, ‹ ›로 보는 순서를 정해요 (악보·공지·일정)', '악보 넘겨 보기: 전체 화면, 옆으로 밀어 넘기기, 페달·키보드, 눈 깜빡임(실험)', '교사 영혼 카드: 맡은 일, 다가오는 순서, 부재 시 대신할 분, 돌봄 기록', '업무 분담·조직도의 이름이 영혼 카드로 열려요', '캘린더 일정 상세: 사진·댓글, 부재 알리기, 설교 일정 누를 때 오류 고침', '도우미와 홈 화면 바로가기 안내, 새 버전 알림'] },
  { v: 'v5', date: '11월 10일', items: ['카페24 동동 글꼴로 바꿨어요', '패드·컴퓨터에서는 왼쪽 메뉴와 여러 칸 화면으로 넓게 보여요', '교사실: 공지 게시판(링크·사진), 캘린더, 업무 분담 표, 조직도', '돌봄 기록에 종류(통화·문자·심방·기도제목·특이사항)를 붙일 수 있어요', '홈에서 지금 버전과 바뀐 점을 볼 수 있어요'] },
  { v: 'v4', date: '11월 10일', items: ['출석 화면 위쪽을 줄였어요', '예배 탭: 이번 주 담당, 설교 올리기·댓글·점검, 주별 악보'] },
  { v: 'v3', date: '11월 10일', items: ['디렉터 권한 (조이코너 전체 관리 장)'] },
  { v: 'v2', date: '11월 10일', items: ['교사 명단을 먼저 만들고 구글 계정은 나중에 연결'] },
  { v: 'v1', date: '11월 10일', items: ['출석, 친구들, 아이 카드, 통계, 시트 데이터 가져오기'] }
];
const R = { tab: 'notice', notices: null, events: null, month: null, day: null, editNotice: null, editEvent: null, editPreset: null, dutyView: 'table', open: {} };
const ROOM_TABS = [['notice', '공지'], ['cal', '캘린더'], ['turns', '순서표'], ['duty', '업무 분담'], ['org', '조직도'], ['stats', '통계']];
const roomTabs = active => `<div class="seg">${ROOM_TABS.map(([k, l]) => `<button class="${active === k ? 'on' : ''}" data-act="rtab" data-id="${k}">${l}</button>`).join('')}</div>`;
const NOTE_KINDS = ['통화', '문자', '심방', '기도제목', '특이사항'];

async function loadNotices() {
  try { const s = await getDocs(collection(db, 'notices')); R.notices = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch { R.notices = []; }
}
async function loadEvents() {
  try { const s = await getDocs(collection(db, 'events')); R.events = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch { R.events = []; }
}
async function loadDuties() {
  if (Array.isArray(W.duties)) return;
  try { const s = await getDocs(collection(db, 'duties')); W.duties = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); } catch { W.duties = []; }
}
async function loadRoom() {
  const jobs = [];
  if (R.notices === null) { R.notices = undefined; jobs.push(loadNotices()); }
  if (R.events === null) { R.events = undefined; jobs.push(loadEvents()); }
  if (W.duties === null) { W.duties = undefined; jobs.push((async () => { W.duties = null; await loadDuties(); })()); }
  await Promise.all(jobs);
}
const sortedNotices = () => (R.notices || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || ko(b.at || '', a.at || ''));

function vRoom() {
  const ready = Array.isArray(R.notices) && Array.isArray(R.events) && Array.isArray(W.duties);
  const body = !ready ? '<div class="sub full">불러오는 중…</div>' : R.tab === 'cal' ? rCal() : R.tab === 'turns' ? rTurns() : R.tab === 'duty' ? rDuty() : R.tab === 'org' ? rOrg() : rNotices();
  const cols = R.tab === 'notice' ? 'cols' : '';
  return `<div class="scroll ${cols}"><div class="ttl">교사실</div>${roomTabs(R.tab)}${body}</div>${nav('room')}`;
}

/* 공지 */
function rNotices() {
  const list = sortedNotices(), admin = isAdminMe();
  return `${admin ? '<button class="cta full" data-act="noticeNew">+ 공지 올리기</button>' : ''}
${list.length ? list.map(n => `<button class="card tapcard ncard" data-act="noticeOpen" data-id="${n.id}">${n.thumb ? `<img class="nthumb" src="${n.thumb}" alt="">` : ''}<div class="lbl"><span>${n.pinned ? '📌 ' : ''}${esc(n.category || '공지')}${n.eventDate ? ' · ' + fmtMD(n.eventDate) : ''}</span><span class="s2">${esc((n.at || '').slice(5, 10).replace('-', '/'))}</span></div><div class="big" style="font-size:21px">${esc(n.title)}</div><div class="clamp">${esc(n.body || '')}</div><div class="s2">${esc(n.authorName || '')}${n.imgCount ? ` · 사진 ${n.imgCount}장` : ''}${n.links ? ' · 링크' : ''}</div></button>`).join('') : '<div class="sub full">아직 공지가 없어요.</div>'}`;
}
function commentBlock(postId, type) {
  if (!(postId in W.comments)) { W.comments[postId] = null; loadComments(postId).then(() => paint()); }
  const cm = W.comments[postId], admin = isAdminMe();
  return `<section class="card"><div class="lbl"><span>댓글 ${cm ? cm.length : ''}</span></div>
${cm === null ? '<div class="s2">불러오는 중…</div>' : cm.map(c => `<div class="note"><span style="white-space:pre-wrap">${linkify(c.text)}</span><small><span>${esc(c.byName || '')}${c.role ? ' · ' + esc(c.role) : ''} · ${esc((c.at || '').slice(5, 10).replace('-', '/'))}</span>${c.by === S.me.email || admin ? `<button data-act="cmDel" data-id="${c.id}" data-p="${postId}">지우기</button>` : ''}</small></div>`).join('')}
<textarea id="cm_${postId}" placeholder="댓글을 남겨 주세요" style="min-height:64px"></textarea><button class="sec" data-act="cmAdd" data-id="${postId}" data-t="${type}">댓글 달기</button></section>`;
}
async function shrink(file, max, limit, q = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let url = '';
  for (let i = 0; i < 7; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q);
    if (url.length < limit) return url;
    max = Math.round(max * 0.85); q = Math.max(0.5, q - 0.06);
  }
  return url;
}

/* 캘린더 */

/* 업무 분담 (한눈에) */

/* 조직도 */

/* 홈에 붙는 조각 */
function homeNoticeCard() {
  const l = sortedNotices().slice(0, 3);
  if (!l.length) return '';
  return `<section class="card"><div class="lbl"><span>공지</span><button class="linkbtn" data-act="rtab" data-id="notice">전체 보기</button></div>${l.map(n => `<button class="row calrow" data-act="noticeOpen" data-id="${n.id}"><span class="grow"><span style="font-size:16px">${n.pinned ? '📌 ' : ''}${esc(n.title)}</span><span class="sub">${esc(n.category || '공지')}${n.eventDate ? ' · ' + fmtMD(n.eventDate) : ''}</span></span></button>`).join('')}</section>`;
}
function homeEventsCard() {
  const today = ymd(new Date()), out = [];
  for (let i = 0; i < 14; i++) { const d = addDays(today, i); itemsOn(d).filter(x => x.kind === 'evt' || x.kind === 'meet').forEach(x => out.push({ d, ...x })); }
  if (!out.length) return '';
  return `<section class="card"><div class="lbl"><span>다가오는 일정 (2주)</span><button class="linkbtn" data-act="rtab" data-id="cal">캘린더</button></div>${out.slice(0, 5).map(x => `<div class="bday"><span class="d">${parseD(x.d).getMonth() + 1}/${parseD(x.d).getDate()}</span><span>${esc(x.label)}${x.sub ? ` <span class="s2">${esc(x.sub)}</span>` : ''}</span></div>`).join('')}</section>`;
}
function versionCard() {
  return `<button class="vcard full" data-act="changelog"><span>조이코너 노트 <b>${APP_VERSION}</b> · ${parseD(APP_DATE).getMonth() + 1}월 ${parseD(APP_DATE).getDate()}일 업데이트</span><span class="linkbtn">바뀐 점 보기</span></button>`;
}
function changelogSheet() {
  sheet(`<div class="ttl" style="font-size:24px">업데이트 기록</div>${CHANGELOG.map(c => `<section class="card"><div class="lbl"><span>${c.v} · ${c.date}</span>${c.v === APP_VERSION ? '<span class="tag g">지금 버전</span>' : ''}</div><ul class="ul">${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('')}<button class="sec" data-act="sheetClose">닫기</button><div class="s2" style="text-align:center">이 앱에는 카페24(주)가 제공한 Cafe24 동동 글꼴이 적용되어 있어요.</div>`);
}

/* ================= v6 ================= */

/* ---------- 사진 고르기 (최대 10장 · 순서 바꾸기) ---------- */
const PK = {};
const PK_OPT = {
  score: { max: 10, px: 2000, limit: 950000, q: 0.86 },
  photo: { max: 10, px: 1400, limit: 800000, q: 0.82 },
  face: { max: 1, px: 480, limit: 200000, q: 0.82 }
};
const IMG = {};
function pkInit(id, urls, type) { PK[id] = { type, items: urls.filter(Boolean).map(u => ({ url: u })), busy: false }; }
function pkHtml(id) {
  const p = PK[id], max = PK_OPT[p.type].max, one = max === 1;
  return `<div class="picker ${one ? 'one' : ''}" id="pk_${id}"><div class="pkgrid">${p.items.map((it, i) => `<figure class="pkitem"><img src="${it.url}" alt="${i + 1}번째 사진">${one ? '' : `<span class="pkn">${i + 1}</span>`}<div class="pkbar">${one ? '' : `<button type="button" data-act="pkMove" data-id="${id}" data-i="${i}" data-n="-1" aria-label="앞으로" ${i === 0 ? 'disabled' : ''}>‹</button>`}<button type="button" data-act="pkDel" data-id="${id}" data-i="${i}" aria-label="빼기">✕</button>${one ? '' : `<button type="button" data-act="pkMove" data-id="${id}" data-i="${i}" data-n="1" aria-label="뒤로" ${i === p.items.length - 1 ? 'disabled' : ''}>›</button>`}</div></figure>`).join('')}
${p.items.length < max ? `<label class="pkadd">${p.busy ? '<span class="spin"></span><span>준비 중…</span>' : `<span class="pkplus">${svg('<path d="M12 5v14M5 12h14"/>', 22, 2.2)}</span><span>${one ? '사진 고르기' : '사진 추가'}</span>`}${one ? '' : `<small>${p.items.length} / ${max}</small>`}<input type="file" accept="image/*" ${one ? '' : 'multiple'} data-pk="${id}" hidden></label>` : ''}</div>
${p.items.length > 1 ? '<div class="s2">‹ › 를 눌러 보는 순서를 바꿔요</div>' : ''}</div>`;
}
const pkRender = id => { const el = document.getElementById('pk_' + id); if (el) el.outerHTML = pkHtml(id); };
async function pkAdd(id, files) {
  const p = PK[id]; if (!p) return;
  const o = PK_OPT[p.type], room = o.max - p.items.length, list = [...files].slice(0, room);
  if (files.length > room) toast(`최대 ${o.max}장까지 올릴 수 있어요`);
  p.busy = true; pkRender(id);
  for (const f of list) { try { p.items.push({ url: await shrink(f, o.px, o.limit, o.q), fresh: true }); } catch { toast('열 수 없는 사진이 있어요'); } pkRender(id); }
  p.busy = false; pkRender(id);
}
function pkMove(id, i, n) { const it = PK[id].items, j = i + n; if (j < 0 || j >= it.length) return; [it[i], it[j]] = [it[j], it[i]]; pkRender(id); }
function pkDel(id, i) { PK[id].items.splice(i, 1); pkRender(id); }
async function pkSave(id, coll, baseId, extra, oldCount) {
  const items = PK[id].items;
  for (let i = 0; i < items.length; i++) { await setDoc(doc(db, coll, `${baseId}_${i}`), { ...extra, n: i, data: items[i].url }); IMG[`${coll}/${baseId}_${i}`] = items[i].url; }
  for (let i = items.length; i < (oldCount || 0); i++) { await deleteDoc(doc(db, coll, `${baseId}_${i}`)).catch(() => { }); delete IMG[`${coll}/${baseId}_${i}`]; }
  return items.length;
}
async function loadImg(coll, key) {
  const k = coll + '/' + key;
  if (typeof IMG[k] === 'string') return IMG[k];
  if (IMG[k] instanceof Promise) return IMG[k];
  IMG[k] = getDoc(doc(db, coll, key)).then(s => (IMG[k] = s.exists() ? s.data().data : '')).catch(() => (IMG[k] = ''));
  return IMG[k];
}
const loadImgs = (coll, baseId, n) => Promise.all(Array.from({ length: n || 0 }, (_, i) => loadImg(coll, `${baseId}_${i}`)));
const imgNow = (coll, key) => (typeof IMG[coll + '/' + key] === 'string' ? IMG[coll + '/' + key] : '');
function thumbFrom(url, px = 360) {
  return new Promise(res => { const im = new Image(); im.onload = () => { const k = Math.min(1, px / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = () => res(''); im.src = url; });
}
function gallery(coll, baseId, n, title) {
  if (!n) return '';
  const cells = Array.from({ length: n }, (_, i) => {
    const key = `${baseId}_${i}`, u = imgNow(coll, key);
    if (!u) loadImg(coll, key).then(() => paint());
    return `<button class="gcell" data-act="galOpen" data-c="${coll}" data-b="${baseId}" data-n="${n}" data-i="${i}" data-t="${esc(title)}">${u ? `<img src="${u}" alt="${esc(title)} 사진 ${i + 1}">` : '<span class="spin"></span>'}</button>`;
  }).join('');
  return `<div class="gallery ${n === 1 ? 'single' : ''}">${cells}</div>`;
}

/* ---------- 전체 화면으로 넘겨 보기 ---------- */
const VW = { pages: [], i: 0, el: null, scale: 1, tx: 0, ty: 0, lock: null, cam: null, pushed: false };
const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
function openViewer(pages, start) {
  if (!pages.length) return toast('볼 사진이 없어요');
  closeViewer(true);
  VW.pages = pages; VW.i = Math.max(0, Math.min(start || 0, pages.length - 1));
  const el = document.createElement('div'); el.className = 'viewer'; el.id = 'viewer';
  el.innerHTML = `<div class="vtop"><div class="vtitle"><b id="vLab"></b><span id="vSub"></span></div>${pages.some(p => p.coll === 'scorePages') ? `<button class="vbtn" data-v="blink" aria-label="눈 깜빡임으로 넘기기" title="눈 깜빡임으로 넘기기 (실험)">${svg(EYE, 22, 1.8)}</button>` : ''}<button class="vbtn" data-v="close" aria-label="닫기">${svg('<path d="M6 6l12 12M18 6L6 18"/>', 22, 2)}</button></div>
<div class="vstage" id="vStage"><img id="vImg" alt="" draggable="false"><div class="vedge" id="vEdge"></div></div>
<div class="vfoot"><span id="vCount"></span><span class="vhelp">옆으로 밀면 넘어가요 · 위아래로 밀거나 가운데를 누르면 닫혀요</span></div><div class="vcam" id="vCam" hidden></div>`;
  document.body.appendChild(el); VW.el = el;
  el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; e.stopPropagation(); if (b.dataset.v === 'close') closeViewer(); else toggleBlink(); });
  bindGestures(el.querySelector('#vStage'));
  document.addEventListener('keydown', vKey);
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { VW.lock = l; }).catch(() => { }); } catch { /* 화면 꺼짐 막기를 못 해도 괜찮아요 */ }
  try { if (document.documentElement.requestFullscreen && !/iPhone|iPad|iPod/.test(navigator.userAgent)) document.documentElement.requestFullscreen().catch(() => { }); } catch { /* 전체 화면 없음 */ }
  history.pushState({ viewer: 1 }, ''); VW.pushed = true;
  vShow();
}
function closeViewer(silent) {
  if (!VW.el) return;
  stopBlink();
  VW.el.remove(); VW.el = null;
  document.removeEventListener('keydown', vKey);
  try { if (VW.lock) VW.lock.release(); } catch { /* 없음 */ } VW.lock = null;
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* 없음 */ }
  if (VW.pushed && !silent) { VW.pushed = false; history.back(); } else VW.pushed = false;
}
window.addEventListener('popstate', () => { if (VW.el) { VW.pushed = false; closeViewer(true); } });
function applyT() { const img = document.getElementById('vImg'); if (img) img.style.transform = VW.scale > 1 ? `translate(${VW.tx}px,${VW.ty}px) scale(${VW.scale})` : ''; }
async function vShow(dir) {
  const p = VW.pages[VW.i]; if (!p || !VW.el) return;
  VW.scale = 1; VW.tx = VW.ty = 0; applyT();
  $('#vLab').textContent = p.label || ''; $('#vSub').textContent = p.sub || ''; $('#vCount').textContent = `${VW.i + 1} / ${VW.pages.length}`;
  const img = $('#vImg'), want = VW.i;
  img.classList.remove('in-l', 'in-r'); img.classList.add('loading');
  const url = await loadImg(p.coll, p.key);
  if (VW.i !== want || !VW.el) return;
  img.src = url || ''; img.classList.remove('loading');
  if (dir) { void img.offsetWidth; img.classList.add(dir > 0 ? 'in-r' : 'in-l'); }
  [VW.i + 1, VW.i - 1, VW.i + 2].forEach(j => { const q = VW.pages[j]; if (q) loadImg(q.coll, q.key); });
}
function vGo(d) {
  const j = VW.i + d;
  if (j < 0 || j >= VW.pages.length) {
    const e = $('#vEdge'); if (e) { e.textContent = d > 0 ? '마지막 장이에요' : '첫 장이에요'; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }
    return;
  }
  VW.i = j; vShow(d);
}
function vKey(e) {
  if (!VW.el) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' ', 'Enter', 'ArrowDown'].includes(k)) { e.preventDefault(); vGo(1); }
  else if (['ArrowLeft', 'PageUp', 'ArrowUp', 'Backspace'].includes(k)) { e.preventDefault(); vGo(-1); }
  else if (k === 'Escape') closeViewer();
}
function bindGestures(st) {
  const pts = new Map(); let start = null, pinch = null, moved = false, t0 = 0;
  const atEdge = dx => (dx > 0 && VW.i === 0) || (dx < 0 && VW.i === VW.pages.length - 1);
  st.addEventListener('pointerdown', e => {
    try { st.setPointerCapture(e.pointerId); } catch { /* 없음 */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, tx: VW.tx, ty: VW.ty }; moved = false; t0 = Date.now(); }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: VW.scale }; moved = true; }
  });
  st.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const img = $('#vImg');
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; VW.scale = Math.min(4, Math.max(1, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); if (VW.scale === 1) VW.tx = VW.ty = 0; applyT(); return; }
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    if (VW.scale > 1) { VW.tx = start.tx + dx; VW.ty = start.ty + dy; applyT(); return; }
    if (Math.abs(dx) > Math.abs(dy)) { img.style.transform = `translateX(${dx * (atEdge(dx) ? 0.25 : 1)}px)`; img.style.opacity = '1'; }
    else { img.style.transform = `translateY(${dy * 0.6}px)`; img.style.opacity = String(Math.max(0.35, 1 - Math.abs(dy) / 420)); }
  });
  const finish = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size === 1) { const [a] = [...pts.values()]; start = { x: a.x, y: a.y, tx: VW.tx, ty: VW.ty }; } if (pts.size === 0) { pinch = null; start = null; } return; }
    if (pts.size) return;
    const s = start; start = null; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y, img = $('#vImg');
    img.style.opacity = '';
    if (VW.scale > 1) { if (!moved) { VW.scale = 1; VW.tx = VW.ty = 0; } applyT(); return; }
    img.style.transform = '';
    if (!moved && Date.now() - t0 < 500) {
      const r = st.getBoundingClientRect(), x = e.clientX - r.left;
      if (x < r.width * 0.28) vGo(-1); else if (x > r.width * 0.72) vGo(1); else closeViewer();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) vGo(dx < 0 ? 1 : -1);
    else if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) closeViewer();
  };
  st.addEventListener('pointerup', finish);
  st.addEventListener('pointercancel', e => { pts.delete(e.pointerId); if (!pts.size) { start = null; pinch = null; const img = $('#vImg'); if (img) { img.style.opacity = ''; } applyT(); } });
  st.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); VW.scale = Math.min(4, Math.max(1, VW.scale * (e.deltaY < 0 ? 1.1 : 0.9))); if (VW.scale === 1) VW.tx = VW.ty = 0; applyT(); }, { passive: false });
}

/* 눈 깜빡임으로 넘기기 (실험) — 영상은 휴대폰 안에서만 쓰고 어디에도 보내지 않아요 */
async function toggleBlink() {
  if (VW.cam) { stopBlink(); toast('눈 깜빡임 넘기기를 껐어요'); return; }
  try { await startBlink(); }
  catch (e) { stopBlink(); toast('카메라를 쓸 수 없어요: ' + (e && e.name === 'NotAllowedError' ? '카메라 허용이 필요해요' : (e && e.message) || '이 기기에서는 어려워요')); }
}
async function startBlink() {
  const box = $('#vCam'); box.hidden = false; box.className = 'vcam'; box.innerHTML = '<div class="vcamst">눈 인식 준비 중… (처음엔 10초쯤 걸려요)</div>';
  const VER = '0.10.14', base = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const vision = await import(`${base}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
  const opt = d => ({ baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: d }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 });
  let lm; try { lm = await vision.FaceLandmarker.createFromOptions(files, opt('GPU')); } catch { lm = await vision.FaceLandmarker.createFromOptions(files, opt('CPU')); }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
  if (!VW.el) { stream.getTracks().forEach(t => t.stop()); return; }
  const video = document.createElement('video'); video.playsInline = true; video.muted = true; video.srcObject = stream; await video.play();
  box.innerHTML = ''; box.appendChild(video);
  const st = document.createElement('div'); st.className = 'vcamst'; box.appendChild(st);
  const HINT = '두 번 깜빡 → 다음 · 세 번 깜빡 → 이전';
  st.textContent = HINT;
  const cam = VW.cam = { stream, video, lm, raf: 0, closed: false, t0: 0, last1: 0, cool: 0, lastT: -1, st, HINT };
  const btn = VW.el.querySelector('[data-v=blink]'); if (btn) btn.classList.add('on');
  const loop = () => {
    if (VW.cam !== cam) return;
    const now = performance.now();
    if (video.currentTime !== cam.lastT) {
      cam.lastT = video.currentTime;
      let r = null; try { r = lm.detectForVideo(video, now); } catch { r = null; }
      const bs = r && r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
      if (bs) {
        const g = n => (bs.find(c => c.categoryName === n) || {}).score || 0;
        const sc = (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2;
        box.classList.remove('noface'); box.classList.toggle('closed', sc > 0.5);
        if (!cam.closed && sc > 0.55) { cam.closed = true; cam.t0 = now; }
        else if (cam.closed && sc < 0.35) {
          cam.closed = false; const dur = now - cam.t0;
          if (now > cam.cool) {
            if (dur < 500) {
              cam.n = (now - (cam.lastEnd || 0) < 700) ? (cam.n || 0) + 1 : 1; cam.lastEnd = now;
              clearTimeout(cam.tm);
              cam.tm = setTimeout(() => {
                if (VW.cam !== cam) return;
                const n = cam.n; cam.n = 0;
                if (n === 2) { cam.cool = performance.now() + 700; vGo(1); camFlash('다음 장 ▶'); }
                else if (n >= 3) { cam.cool = performance.now() + 700; vGo(-1); camFlash('◀ 이전 장'); }
              }, 650);
            }
          }
        }
      } else box.classList.add('noface');
    }
    cam.raf = requestAnimationFrame(loop);
  };
  loop();
}
function camFlash(t) { const c = VW.cam; if (!c) return; c.st.textContent = t; c.st.classList.add('hit'); setTimeout(() => { if (VW.cam === c) { c.st.textContent = c.HINT; c.st.classList.remove('hit'); } }, 900); }
function stopBlink() {
  const c = VW.cam; VW.cam = null;
  if (c) { cancelAnimationFrame(c.raf); c.stream.getTracks().forEach(t => t.stop()); try { c.lm.close(); } catch { /* 없음 */ } }
  const b = document.getElementById('vCam'); if (b) { b.hidden = true; b.innerHTML = ''; }
  const btn = VW.el && VW.el.querySelector('[data-v=blink]'); if (btn) btn.classList.remove('on');
}

/* ---------- 악보 ---------- */
function setPages(d) {
  const out = [];
  (W.songs[d] || []).forEach((g, idx) => { for (let n = 0; n < (g.pages || 0); n++) out.push({ coll: 'scorePages', key: `${g.id}_${n}`, label: `${idx + 1}. ${g.title}`, sub: [g.key ? '키 ' + g.key : '', g.pages > 1 ? `${n + 1}/${g.pages}쪽` : '', g.memo ? g.memo.split('\n')[0] : ''].filter(Boolean).join(' · '), song: g.id }); });
  return out;
}
function songPlay(id) {
  const pages = setPages(W.date);
  if (!pages.length) return toast('아직 올라온 악보 사진이 없어요');
  const i = id ? Math.max(0, pages.findIndex(p => p.song === id)) : 0;
  if (id && !pages.some(p => p.song === id)) return toast('이 곡은 악보 사진이 없어요');
  openViewer(pages, i);
}
function wSongs(d) {
  const list = W.songs[d] || [], sl = W.setlist[d] || {}, total = list.reduce((s, g) => s + (g.pages || 0), 0);
  return `${total ? `<button class="cta" data-act="songPlay" data-id="">${svg('<path d="M7 5l12 7-12 7z"/>', 24, 2)}악보 넘겨 보기 · ${total}장</button>` : ''}
<section class="card"><div class="lbl"><span>이번 주 악보 ${list.length}곡</span></div>
${list.length ? `<div class="list">${list.map((g, i) => `<div class="songrow"><button class="row" data-act="songPlay" data-id="${g.id}"><span class="num2">${i + 1}</span><span class="grow"><span class="nm" style="font-size:18px">${esc(g.title)}</span><span class="sub">${[g.key ? '키 ' + g.key : '', g.pages ? `${g.pages}장` : '사진 없음'].filter(Boolean).map(esc).join(' · ')}</span></span></button><div class="mv"><button data-act="songMove" data-id="${g.id}" data-n="-1" aria-label="위로" ${i === 0 ? 'disabled' : ''}>▲</button><button data-act="songMove" data-id="${g.id}" data-n="1" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></div><button class="editbtn" data-act="songEdit" data-id="${g.id}" aria-label="${esc(g.title)} 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18, 1.8)}</button></div>`).join('')}</div>` : '<div class="sub">아직 올라온 악보가 없어요. 보통 6~10곡을 올려요.</div>'}
<button class="sec" data-act="songNew">+ 곡 추가</button></section>
<section class="card"><div class="lbl"><span>예배 순서 · 기록</span></div><textarea id="sl_memo" style="min-height:120px" placeholder="예: 여는 찬양 → 기도 → 챈트 → 율동 찬양 → 성경이야기 → 헌금 → 광고">${esc(sl.memo || '')}</textarea><button class="sec" data-act="slSave">기록 저장</button>${sl.byName ? `<div class="s2">마지막 저장 · ${esc(sl.byName)}</div>` : ''}</section>`;
}
async function songSheet(id) {
  const list = W.songs[W.date] || [], sg = id ? list.find(x => x.id === id) : { title: '', key: '', memo: '', link: '', pages: 0 };
  if (!sg) return;
  W.editSong = id || null;
  pkInit('song', id ? await loadImgs('scorePages', id, sg.pages) : [], 'score');
  sheet(`<div class="ttl" style="font-size:24px">${id ? '곡 고치기' : '곡 추가'} · ${fmtMD(W.date)}</div>
<label class="fld">곡 제목<input class="in" id="g_title" value="${esc(sg.title)}"></label>
<div class="two"><label class="fld">키<input class="in" id="g_key" value="${esc(sg.key || '')}" placeholder="예: G"></label><label class="fld">링크 (영상·PDF)<input class="in" id="g_link" value="${esc(sg.link || '')}" placeholder="https://"></label></div>
<label class="fld">메모 (반복, 율동, 엔딩 등)<textarea id="g_memo" style="min-height:60px">${esc(sg.memo || '')}</textarea></label>
<div class="fld">악보 사진 (최대 10장)</div>${pkHtml('song')}
<div class="sub" id="g_msg"></div>
<div class="btns"><button class="pri" data-act="songSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="songDel">곡 지우기</button>' : ''}`);
}
async function songSave() {
  if (PK.song && PK.song.busy) return toast('사진을 준비하고 있어요. 잠시만요');
  const id = W.editSong, d = W.date, list = W.songs[d] || (W.songs[d] = []);
  const title = val('g_title'); if (!title) return toast('곡 제목을 적어 주세요');
  const ref = id ? doc(db, 'songs', id) : doc(collection(db, 'songs'));
  const old = id ? list.find(x => x.id === id) : null;
  const data = { date: d, title, key: val('g_key'), link: val('g_link'), memo: $('#g_memo').value.trim(), order: old ? old.order : (list.length ? Math.max(...list.map(x => x.order || 0)) + 1 : 1), pages: 0, by: (old && old.by) || S.me.email, byName: (old && old.byName) || myName() };
  const msg = $('#g_msg'); msg.textContent = '저장 중…';
  try {
    data.pages = await pkSave('song', 'scorePages', ref.id, { songId: ref.id, date: d }, old ? old.pages : 0);
    await setDoc(ref, data);
    if (old) Object.assign(old, data); else list.push({ id: ref.id, ...data });
    list.sort((a, b) => a.order - b.order);
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { msg.textContent = ''; toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function songDel() {
  const id = W.editSong, d = W.date, sg = (W.songs[d] || []).find(x => x.id === id); if (!sg) return;
  try {
    for (let i = 0; i < (sg.pages || 0); i++) await deleteDoc(doc(db, 'scorePages', `${id}_${i}`)).catch(() => { });
    await deleteDoc(doc(db, 'songs', id));
    W.songs[d] = W.songs[d].filter(x => x.id !== id); closeSheet(); toast('지웠어요'); paint();
  } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 공지 ---------- */
function vNotice() {
  const n = (R.notices || []).find(x => x.id === S.arg);
  if (!n) return `<div class="scroll narrow"><button class="back" data-act="go" data-to="room">← 교사실</button><div class="sub">${Array.isArray(R.notices) ? '공지를 찾을 수 없어요.' : '불러오는 중…'}</div></div>${nav('room')}`;
  const admin = isAdminMe();
  return `<div class="scroll narrow"><div class="hd"><button class="back" data-act="go" data-to="room">← 교사실</button>${admin ? `<button class="sec sm2" data-act="noticeEdit" data-id="${n.id}">고치기</button>` : ''}</div>
<article class="article"><div class="eyebrow">${n.pinned ? '고정 · ' : ''}${esc(n.category || '공지')} · ${esc((n.at || '').slice(0, 10).replace(/-/g, '.'))} · ${esc(n.authorName || '')}</div>
<h1 class="atitle">${esc(n.title)}</h1>
${n.eventDate ? `<div class="when"><div><b>${fmtMD(n.eventDate)} ${DOW[parseD(n.eventDate).getDay()]}요일</b>${n.eventTime ? ` · ${esc(n.eventTime)}` : ''}</div><div class="btns"><a class="ghost alink sm2" href="${gcalUrl({ title: n.title, date: n.eventDate, time: n.eventTime, memo: n.body })}" target="_blank" rel="noopener">구글 캘린더에 추가</a><button class="ghost sm2" data-act="calGo" data-id="${n.eventDate}">앱 캘린더</button></div></div>` : ''}
${gallery('noticeImages', n.id, n.imgCount, n.title)}
${n.body ? `<div class="post">${linkify(n.body)}</div>` : ''}
${n.links ? `<div class="links">${n.links.split('\n').filter(Boolean).map(l => `<a class="linkcard" href="${esc(l.trim())}" target="_blank" rel="noopener">${svg('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', 18, 1.8)}<span>${esc(l.trim().replace(/^https?:\/\//, '').slice(0, 60))}</span></a>`).join('')}</div>` : ''}
</article>
${commentBlock(n.id, 'notice')}</div>${nav('room')}`;
}
async function noticeSheet(id) {
  const n = id ? R.notices.find(x => x.id === id) : { category: '공지', title: '', body: '', links: '', eventDate: '', eventTime: '', pinned: false, imgCount: 0 };
  if (!n) return;
  R.editNotice = id || null;
  pkInit('notice', id ? await loadImgs('noticeImages', id, n.imgCount) : [], 'photo');
  sheet(`<div class="ttl" style="font-size:24px">${id ? '공지 고치기' : '공지 올리기'}</div>
<div class="two"><label class="fld">종류<select class="in" id="n_cat">${['공지', '행사', '자료', '기도'].map(c => `<option ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="chk" style="align-self:end"><input type="checkbox" id="n_pin" ${n.pinned ? 'checked' : ''}>맨 위에 고정</label></div>
<label class="fld">제목<input class="in" id="n_title" value="${esc(n.title)}"></label>
<label class="fld">내용<textarea id="n_body" style="min-height:180px">${esc(n.body || '')}</textarea></label>
<label class="fld">링크 (한 줄에 하나씩)<textarea id="n_links" style="min-height:60px" placeholder="https://">${esc(n.links || '')}</textarea></label>
<div class="two"><label class="fld">행사 날짜 (있으면)<input class="in" type="date" id="n_date" value="${esc(n.eventDate || '')}"></label><label class="fld">시간<input class="in" id="n_time" value="${esc(n.eventTime || '')}" placeholder="예: 13:30"></label></div>
<div class="fld">사진 (최대 10장)</div>${pkHtml('notice')}
<div class="sub" id="n_msg"></div>
<div class="btns"><button class="pri" data-act="noticeSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="noticeDel">공지 지우기</button>' : ''}`);
}
async function noticeSave() {
  if (PK.notice && PK.notice.busy) return toast('사진을 준비하고 있어요. 잠시만요');
  const id = R.editNotice, old = id ? R.notices.find(x => x.id === id) : null;
  const title = val('n_title'); if (!title) return toast('제목을 적어 주세요');
  const ref = id ? doc(db, 'notices', id) : doc(collection(db, 'notices'));
  const data = { category: val('n_cat'), title, body: $('#n_body').value, links: $('#n_links').value.trim(), eventDate: val('n_date'), eventTime: val('n_time'), pinned: $('#n_pin').checked,
    imgCount: 0, thumb: '', authorEmail: old ? old.authorEmail : S.me.email, authorName: old ? old.authorName : myName(), at: old ? old.at : new Date().toISOString() };
  const msg = $('#n_msg'); msg.textContent = '저장 중…';
  try {
    data.imgCount = await pkSave('notice', 'noticeImages', ref.id, { noticeId: ref.id }, old ? old.imgCount : 0);
    data.thumb = data.imgCount ? await thumbFrom(PK.notice.items[0].url, 480) : '';
    await setDoc(ref, data);
    if (old) Object.assign(old, data); else R.notices.push({ id: ref.id, ...data });
    closeSheet(); toast('저장했어요'); if (S.route === 'notice' && S.arg === ref.id) paint(); else go('notice/' + ref.id);
  } catch (e) { msg.textContent = ''; toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function noticeDel() {
  const id = R.editNotice, n = R.notices.find(x => x.id === id); if (!n) return;
  try {
    for (let i = 0; i < (n.imgCount || 0); i++) await deleteDoc(doc(db, 'noticeImages', `${id}_${i}`)).catch(() => { });
    await deleteDoc(doc(db, 'notices', id)); R.notices = R.notices.filter(x => x.id !== id); closeSheet(); toast('지웠어요'); go('room');
  } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 캘린더 ---------- */
const KIND_CLASS = { 회의: 'meet', 교육: 'meet', 부재: 'away' };
const itemAct = x => x.notice ? `data-act="noticeOpen" data-id="${x.notice}"` : x.kid ? `data-act="kid" data-id="${x.kid}"` : x.staff ? `data-act="staffOpen" data-id="${x.staff}"` : x.event ? `data-act="eventOpen" data-id="${x.event}"` : `data-act="wgoWeek" data-id="${x.d}"`;
const itemRow = (x, showDate) => `<button class="row calrow" ${itemAct(x)}><i class="cdot ${x.kind}"></i><span class="grow"><span class="it">${esc(x.label)}</span>${x.sub ? `<span class="sub">${esc(x.sub)}</span>` : ''}</span>${showDate ? `<span class="s2">${parseD(x.d).getMonth() + 1}/${parseD(x.d).getDate()}</span>` : '<span class="chev">›</span>'}</button>`;
function vEvent() {
  const e = (R.events || []).find(x => x.id === S.arg);
  if (!e) return `<div class="scroll narrow"><button class="back" data-act="calBack">← 캘린더</button><div class="sub">${Array.isArray(R.events) ? '일정을 찾을 수 없어요.' : '불러오는 중…'}</div></div>${nav('room')}`;
  const can = e.by === S.me.email || isAdminMe();
  const st = e.staffId ? S.staff.find(x => x.id === e.staffId) : null;
  return `<div class="scroll narrow"><div class="hd"><button class="back" data-act="calBack">← 캘린더</button>${can ? `<button class="sec sm2" data-act="eventEdit" data-id="${e.id}">고치기</button>` : ''}</div>
<article class="article"><div class="eyebrow"><i class="cdot ${KIND_CLASS[e.kind] || 'evt'}"></i> ${esc(e.kind || '행사')} · 올린 사람 ${esc(e.byName || '')}</div>
<h1 class="atitle">${esc(e.title)}</h1>
<div class="when"><div><b>${fmtMD(e.date)} ${DOW[parseD(e.date).getDay()]}요일${e.endDate && e.endDate > e.date ? ` – ${fmtMD(e.endDate)} ${DOW[parseD(e.endDate).getDay()]}요일` : ''}</b> · ${esc(timeText(e))}${e.place ? `<div class="sub">${esc(e.place)}</div>` : ''}</div><div class="btns"><a class="ghost alink sm2" href="${gcalUrl(e)}" target="_blank" rel="noopener">구글 캘린더에 추가</a></div></div>
${st ? `<div class="chips">${staffChip(st.name)}</div>${awayHandover(st)}` : ''}
${gallery('eventImages', e.id, e.imgCount, e.title)}
${e.memo ? `<div class="post">${linkify(e.memo)}</div>` : ''}</article>
${commentBlock(e.id, 'event')}</div>${nav('room')}`;
}

/* ---------- 교사 영혼 카드 ---------- */
function staffChip(name, cls = '') {
  const st = S.staff.find(x => x.name === name);
  if (!st) return `<span class="chip sm ${cls}">${esc(name)}</span>`;
  return `<button class="schip ${cls}" data-act="staffOpen" data-id="${st.id}">${staffAv(st, 24)}<span>${esc(name)}</span></button>`;
}
const SCHED_LABEL = { preacher: '설교', pray: '중보기도 인도', nation: '성전건축·나라 기도', chant: '챈트', dance: '율동', guitar: '기타·메트로놈' };
function upcomingTurns(name, n = 6) {
  const today = ymd(new Date()), out = [];
  S.schedule.filter(r => r.date >= today && !r.noService).forEach(r => Object.entries(SCHED_LABEL).forEach(([k, l]) => { if (hasName(r[k], name)) out.push({ date: r.date, label: l }); }));
  return out.slice(0, n);
}
const dutiesOf = name => (W.duties || []).filter(x => (x.people || []).includes(name));
const awayOn = d => (R.events || []).filter(e => e.kind === '부재' && e.date === d && e.staffId).map(e => S.staff.find(s => s.id === e.staffId)).filter(Boolean);
function awayHandover(st) {
  const ds = dutiesOf(st.name);
  if (!ds.length) return '';
  return `<div class="handover">${ds.map(x => `<div class="hrow"><span>${esc(x.role)}</span><span class="arrow">→</span><span>${(x.backup || []).length ? x.backup.map(n => staffChip(n)).join(' ') : '<span class="s2">대신할 분을 정해 주세요</span>'}</span></div>`).join('')}</div>`;
}
async function loadStaffExtra(id) {
  const st = S.staff.find(x => x.id === id); if (!st) return;
  const ex = S.staffEx[id] = S.staffEx[id] || { notes: null };
  const q = S.me.director ? query(collection(db, 'staffNotes'), where('staffId', '==', id)) : query(collection(db, 'staffNotes'), where('staffId', '==', id), where('by', '==', S.me.email));
  try { const s = await getDocs(q); ex.notes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ko(b.at || '', a.at || '')); } catch { ex.notes = []; }
  if (st.photo) loadImg('staffPhotos', id);
  if (S.route === 'staff') paint();
}
function vStaff() {
  const st = S.staff.find(x => x.id === S.arg);
  if (!st) return `<div class="scroll narrow"><button class="back" data-act="back2">← 뒤로</button><div class="sub">선생님을 찾을 수 없어요.</div></div>${nav('room')}`;
  const ex = S.staffEx[st.id] || {}, admin = isAdminMe(), mine = st.email && st.email === S.me.email;
  const big = st.photo ? imgNow('staffPhotos', st.id) : '';
  const cls = Object.entries(st.classRole || {}).map(([c, r]) => `${(S.classes[c] || {}).name || c} ${r}`);
  const ds = dutiesOf(st.name), turns = upcomingTurns(st.name);
  const aways = (R.events || []).filter(e => e.kind === '부재' && e.staffId === st.id && e.date >= ymd(new Date())).sort((a, b) => ko(a.date, b.date));
  const canNotes = isDirectorMe() || mine;
  const notes = ex.notes || [];
  return `<div class="scroll cols"><div class="hd"><button class="back" data-act="back2">← 뒤로</button>${admin || mine ? `<button class="sec sm2" data-act="staffEdit" data-id="${st.id}">고치기</button>` : ''}</div>
<section class="card hero full">${admin || mine ? `<button class="heroph" data-act="staffEdit" data-id="${st.id}" aria-label="사진 바꾸기">${big ? `<img src="${big}" alt="${esc(st.name)} 선생님">` : staffAv(st, 132)}<span class="cam">${svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 18, 1.8)}</span></button>` : `<div class="heroph">${big ? `<img src="${big}" alt="${esc(st.name)} 선생님">` : staffAv(st, 132)}</div>`}
<div class="herotx"><div class="eyebrow">교사 영혼 카드</div><h1 class="atitle" style="margin:2px 0 6px">${esc(st.name)} 선생님</h1>
<div class="chips">${st.role === 'director' || st.role === 'admin' ? `<span class="tag">${roleLabel(st)}</span>` : ''}${cls.map(c => `<span class="chip sm rose">${esc(c)}</span>`).join('')}${st.email ? '' : (admin ? '<span class="chip sm">구글 연결 전</span>' : '')}</div>
${st.intro ? `<p class="intro">${esc(st.intro)}</p>` : ''}
<div class="btns" style="flex-wrap:wrap">${st.phone ? `<a class="ghost alink sm2" href="tel:${esc(st.phone)}">전화</a><a class="ghost alink sm2" href="sms:${esc(st.phone)}">문자</a>` : ''}${admin || mine ? `<button class="ghost sm2" data-act="awayNew" data-id="${st.id}">부재 알리기</button>` : ''}</div>
${st.birth ? `<div class="s2">생일 ${esc(st.birth.slice(5).replace('-', '/'))}</div>` : ''}</div></section>
<section class="card"><div class="lbl"><span>맡은 일 ${ds.length}</span></div>${ds.length ? ds.map(x => `<div class="duty1"><div><b>${esc(x.role)}</b><span class="s2"> · ${esc(x.section || '')}</span></div><div class="s2">부재 시 ${(x.backup || []).length ? x.backup.map(esc).join(', ') : '<em class="need">대신할 분 미정</em>'}</div></div>`).join('') : '<div class="sub">맡은 일이 없어요.</div>'}</section>
<section class="card"><div class="lbl"><span>다가오는 순서</span></div>${turns.length ? turns.map(t => `<div class="bday"><span class="d">${parseD(t.date).getMonth() + 1}/${parseD(t.date).getDate()}</span><span>${esc(t.label)}</span></div>`).join('') : '<div class="sub">일정표에 다가오는 순서가 없어요.</div>'}</section>
${aways.length ? `<section class="card"><div class="lbl"><span>부재 예정</span></div>${aways.map(e => `<button class="row calrow" data-act="eventOpen" data-id="${e.id}"><i class="cdot away"></i><span class="grow"><span class="it">${fmtMD(e.date)}</span>${e.memo ? `<span class="sub">${esc(e.memo)}</span>` : ''}</span><span class="chev">›</span></button>`).join('')}${awayHandover(st)}</section>` : ''}
${canNotes ? `<section class="card ${notes.some(x => x.kind === '기도제목') ? '' : ''}"><div class="lbl"><span>돌봄 기록</span><span class="s2">디렉터와 쓴 사람만 봐요</span></div>
${notes.filter(x => x.kind === '기도제목').slice(0, 3).map(x => `<div class="note pray"><span style="white-space:pre-wrap">${esc(x.text)}</span><small><span>기도제목 · ${esc((x.at || '').slice(0, 10))}</span></small></div>`).join('')}
<div class="chips">${NOTE_KINDS.map(t => `<button class="chip sm kindbtn ${S.noteKind === t ? 'on' : ''}" data-act="noteKind" data-id="${t}">${t}</button>`).join('')}</div>
<textarea id="snText" placeholder="기도제목, 근황, 나눈 이야기를 적어 주세요"></textarea><button class="sec" data-act="snAdd" data-id="${st.id}">기록 남기기</button>
${ex.notes === null || ex.notes === undefined ? '<div class="s2">불러오는 중…</div>' : notes.filter(x => x.kind !== '기도제목').map(x => `<div class="note">${x.kind ? `<span class="tag g" style="align-self:flex-start">${esc(x.kind)}</span>` : ''}<span style="white-space:pre-wrap">${esc(x.text)}</span><small><span>${esc((x.at || '').slice(0, 10))} · ${esc(x.byName || '')}</span>${x.by === S.me.email || S.me.director ? `<button data-act="snDel" data-id="${x.id}" data-s="${st.id}">지우기</button>` : ''}</small></div>`).join('')}</section>` : ''}
</div>${nav('room')}`;
}
async function staffEditSheet(id) {
  const st = S.staff.find(x => x.id === id); if (!st) return;
  pkInit('face', st.photo ? [await loadImg('staffPhotos', id)] : [], 'face');
  S.editStaff2 = id;
  sheet(`<div class="ttl" style="font-size:24px">${esc(st.name)} 선생님 카드</div>
<div class="fld">사진</div>${pkHtml('face')}
<div class="two"><label class="fld">휴대폰<input class="in" type="tel" id="sf_phone" value="${esc(st.phone || '')}" placeholder="010-0000-0000"></label><label class="fld">생일<input class="in" type="date" id="sf_birth" value="${esc(st.birth || '')}"></label></div>
<label class="fld">한 줄 소개<input class="in" id="sf_intro" value="${esc(st.intro || '')}" placeholder="예: 율동으로 아이들과 함께 찬양해요"></label>
<div class="sub" id="sf_msg"></div>
<div class="btns"><button class="pri" data-act="staffEditSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${isAdminMe() ? `<button class="ghost" data-act="staff" data-id="${st.id}">권한 · 반 · 구글 계정 고치기</button>` : ''}`);
}
async function staffEditSave() {
  if (PK.face && PK.face.busy) return toast('사진을 준비하고 있어요');
  const id = S.editStaff2, st = S.staff.find(x => x.id === id); if (!st) return;
  const patch = { phone: val('sf_phone'), birth: val('sf_birth'), intro: val('sf_intro'), photo: PK.face.items.length > 0, thumb: '' };
  const msg = $('#sf_msg'); msg.textContent = '저장 중…';
  try {
    if (patch.photo) {
      const url = PK.face.items[0].url;
      await setDoc(doc(db, 'staffPhotos', id), { staffId: id, data: url }); IMG['staffPhotos/' + id] = url;
      patch.thumb = await thumbFrom(url, 160);
    } else if (st.photo) { await deleteDoc(doc(db, 'staffPhotos', id)).catch(() => { }); delete IMG['staffPhotos/' + id]; }
    await updateDoc(doc(db, 'staff', id), patch);
    Object.assign(st, patch); closeSheet(); toast('저장했어요'); paint();
  } catch (e) { msg.textContent = ''; toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function snAdd(staffId) {
  const text = val('snText'); if (!text) return toast('내용을 적어 주세요');
  const ref = doc(collection(db, 'staffNotes'));
  const n = { staffId, text, kind: S.noteKind || '', by: S.me.email, byName: myName(), at: new Date().toISOString() };
  try { await setDoc(ref, n); (S.staffEx[staffId].notes ||= []).unshift({ id: ref.id, ...n }); paint(); toast('기록을 남겼어요'); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function snDel(id, staffId) {
  try { await deleteDoc(doc(db, 'staffNotes', id)); S.staffEx[staffId].notes = S.staffEx[staffId].notes.filter(x => x.id !== id); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 업무 분담 (한눈에) ---------- */
function rDuty() {
  const me = myName(), list = W.duties, admin = isAdminMe();
  const sun = nextSunday(), away = awayOn(sun).map(s => s.name);
  const empty = list.filter(x => !(x.people || []).length);
  const toggle = `<div class="seg full" style="max-width:420px"><button class="${R.dutyView === 'table' ? 'on' : ''}" data-act="dutyView" data-id="table">역할별</button><button class="${R.dutyView === 'people' ? 'on' : ''}" data-act="dutyView" data-id="people">사람별</button></div>`;
  const awayNote = away.length ? `<div class="note full"><b>${fmtMD(sun)} 부재</b> · ${away.map(n => { const bk = [...new Set(dutiesOf(n).flatMap(x => x.backup || []))]; return `${esc(n)}${bk.length ? ` → 대신 ${bk.map(esc).join(', ')}` : ''}`; }).join(' / ')}</div>` : '';
  const top = `${awayNote}${empty.length ? `<div class="note full soft">담당이 비어 있는 자리 · ${empty.map(x => esc(x.role)).join(', ')}</div>` : ''}`;
  if (R.dutyView === 'people') return toggle + top + dutyPeople();
  const secs = ['예배 전', '예배 시', '예배 후'];
  R.open = R.open || {};
  return `${toggle}${top}<div class="tablewrap full"><table class="dtable"><thead><tr><th>역할</th><th>담당</th><th class="hide-m">부재 시</th>${admin ? '<th class="w1"></th>' : ''}</tr></thead>
${secs.map(sec => { const l = list.filter(x => (x.section || '예배 시') === sec); if (!l.length) return ''; return `<tbody><tr class="secrow"><td colspan="${admin ? 4 : 3}">${sec}</td></tr>${l.map(x => `<tr class="click ${(x.people || []).length ? '' : 'emptyrow'}" data-act="dutyOpen" data-id="${x.id}"><td><span class="area">${esc(x.area !== x.role ? x.area : '')}</span><b>${esc(x.role)}</b>${R.open[x.id] ? `<div class="desc">${esc(x.desc || '')}${x.note ? `<br>※ ${esc(x.note)}` : ''}</div>` : ''}</td><td class="ppl">${(x.people || []).length ? x.people.map(n => staffChip(n, `${n === me ? 'mine' : ''} ${away.includes(n) ? 'away' : ''}`)).join('') : '<span class="tag">담당 필요</span>'}${(x.backup || []).length ? `<div class="show-m s2">부재 시 ${x.backup.map(esc).join(', ')}</div>` : ''}</td><td class="hide-m ppl">${(x.backup || []).map(n => staffChip(n)).join('')}</td>${admin ? `<td class="w1"><button class="editbtn" data-act="dutyEdit" data-id="${x.id}" aria-label="${esc(x.role)} 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 16, 1.8)}</button></td>` : ''}</tr>`).join('')}</tbody>`; }).join('')}
</table></div><div class="s2 full">줄을 누르면 하는 일이 펼쳐져요${admin ? ' · 연필을 누르면 고쳐요' : ''}</div>${admin ? '<button class="sec full" data-act="dutyEdit">+ 역할 추가</button>' : ''}${list.length ? '' : '<div class="sub full">업무 분담이 아직 없어요. 설정에서 joycorner-extra.json을 가져와 주세요.</div>'}`;
}
function dutySheet(id) {
  if (!isAdminMe()) return;
  const x = id ? W.duties.find(y => y.id === id) : { section: '예배 시', area: '', role: '', desc: '', people: [], backup: [], note: '' };
  if (!x) return;
  W.editDuty = id || null;
  spInit('du_people', x.people || []); spInit('du_backup', x.backup || []);
  sheet(`<div class="ttl" style="font-size:24px">${id ? '역할 고치기' : '역할 추가'}</div>
<div class="two"><label class="fld">언제<select class="in" id="u_sec">${['예배 전', '예배 시', '예배 후'].map(s => `<option ${x.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fld">구분<input class="in" id="u_area" value="${esc(x.area)}" placeholder="예: 환영"></label></div>
<label class="fld">역할<input class="in" id="u_role" value="${esc(x.role)}" placeholder="예: 입장 (이름표)"></label>
<label class="fld">하는 일<textarea id="u_desc">${esc(x.desc || '')}</textarea></label>
<div class="fld">담당</div>${spHtml('du_people')}
<div class="fld">부재 시 대신할 분</div>${spHtml('du_backup')}
<label class="fld">비고<textarea id="u_note" style="min-height:60px">${esc(x.note || '')}</textarea></label>
<div class="btns"><button class="pri" data-act="dutySave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="dutyDel">역할 지우기</button>' : ''}`);

}
async function dutySave() {
  const id = W.editDuty, old = id ? W.duties.find(y => y.id === id) : null;
  const role = val('u_role'); if (!role) return toast('역할을 적어 주세요');
  const split = v => v.split(',').map(t => t.trim()).filter(Boolean);
  const data = { section: val('u_sec'), area: val('u_area') || role, role, desc: $('#u_desc').value.trim(), people: [...SP.du_people], backup: [...SP.du_backup], note: $('#u_note').value.trim(), order: old ? old.order : Math.max(0, ...W.duties.map(y => y.order || 0)) + 1 };
  const ref = id ? doc(db, 'duties', id) : doc(collection(db, 'duties'));
  try { await setDoc(ref, data); if (old) Object.assign(old, data); else W.duties.push({ id: ref.id, ...data }); W.duties.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); closeSheet(); toast('저장했어요'); paint(); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}

/* ---------- 조직도 ---------- */
function rOrg() {
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  const dirs = S.staff.filter(x => x.role === 'director'), admins = S.staff.filter(x => x.role === 'admin');
  const chips = names => names.length ? `<div class="ochips">${names.map(n => staffChip(n)).join('')}</div>` : '<span class="s2">미정</span>';
  const classBoxes = cls.map(c => { const cs = classStaff(c.id); const n = S.kids[c.id] ? activeKids(c.id).length : null; return `<div class="obox"><div class="ohead"><b>${esc(c.name)}</b>${n !== null ? `<span class="s2">아이 ${n}명</span>` : ''}</div><div class="olbl">담임</div>${chips(cs.homeroom)}<div class="olbl">보조</div>${chips(cs.assistants)}</div>`; }).join('');
  const teams = {}; (W.duties || []).forEach(x => { (teams[x.area] ||= []).push(x); });
  const teamBoxes = Object.entries(teams).map(([area, l]) => `<div class="obox team"><div class="ohead"><b>${esc(area)}</b></div>${l.map(x => `<div class="olbl">${esc(x.role)}</div>${(x.people || []).length ? chips(x.people) : '<em class="need">담당 필요</em>'}`).join('')}</div>`).join('');
  const rows = cls.map(c => { const cs = classStaff(c.id); const n = S.kids[c.id] ? activeKids(c.id).length : null; const a = S.kids[c.id] ? classAvg(c.id) : null; return `<tr><td><b>${esc(c.name)}</b></td><td class="ppl">${cs.homeroom.map(x => staffChip(x)).join('') || '-'}</td><td class="ppl">${cs.assistants.map(x => staffChip(x)).join('') || '-'}</td><td>${n ?? '-'}</td><td>${a === null ? '-' : Math.round(a * 100) + '%'}</td></tr>`; }).join('');
  return `<section class="card full org"><div class="otop"><div class="obox root"><img src="logo-white.png" alt="조이코너" class="ologo"><span>교사 ${S.staff.length}명 · 아이 ${allKids().filter(k => (k.status || 'active') === 'active').length}명${S.me.role === 'admin' ? '' : ' (내 반)'}</span></div></div>
<div class="oline"></div><div class="otop"><div class="obox dir"><div class="ohead"><b>디렉터</b></div>${chips(dirs.map(x => x.name))}</div></div>
${admins.length ? `<div class="oline"></div><div class="otop"><div class="obox adm"><div class="ohead"><b>관리자</b></div>${chips(admins.map(x => x.name))}</div></div>` : ''}
<div class="oline"></div><div class="orow">${classBoxes}</div></section>
<section class="card full"><div class="lbl"><span>반별 한눈에</span></div><div class="tablewrap"><table class="dtable"><thead><tr><th>반</th><th>담임</th><th>보조</th><th>아이</th><th>4주 출석</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section class="card full"><div class="lbl"><span>사역팀</span><span class="s2">업무 분담 기준</span></div><div class="orow teams">${teamBoxes || '<div class="sub">업무 분담을 가져오면 사역팀이 보여요.</div>'}</div></section>`;
}

/* ---------- 도우미 · 홈 화면 바로가기 ---------- */
const HC = { home: '#C62828', att: '#2F7D4F', kids: '#E08A00', music: '#7B4FB8', room: '#3A6EA5', staff: '#C2185B', install: '#2E9D8F', faq: '#6B5646', lock: '#455A64', start: '#C62828', score: '#7B4FB8' };
const HELP = [
  { id: 'start', t: '처음 시작', ic: 'home', c: HC.start, go: 'home', steps: [['구글로 로그인', '관리자가 교사 명단에 내 구글 메일을 넣어 두면 바로 들어올 수 있어요.'], ['내 반 확인', '홈 맨 위에 맡은 반과 친구 수가 보여요. 여러 반을 맡으면 위쪽 버튼으로 바꿔요.'], ['홈 화면에 바로가기', '휴대폰 홈 화면에 아이콘을 만들어 두면 앱처럼 열려요.']], tips: ['도우미는 홈 오른쪽 위 (?)에서 언제든 열 수 있어요'] },
  { id: 'install', t: '홈 화면에 바로가기', ic: 'install', c: HC.install },
  { id: 'attend', t: '출석 체크', ic: 'att', c: HC.att, go: 'attend', steps: [['아래 [출석] 누르기', '이번 주일 날짜로 열려요. ◀ ▶로 지난 주일도 고칠 수 있어요.'], ['친구 사진 한 번 누르기', '초록색이 되면 출석이에요. 다시 누르면 취소돼요.'], ['저절로 저장', '따로 저장 버튼이 없어요. 인터넷이 약하면 연결될 때 올라가요.']], tips: ['[전원 출석]을 누른 뒤 안 온 친구만 다시 눌러도 돼요', '새로 온 친구는 맨 아래 [새로 온 친구 등록]'] },
  { id: 'kids', t: '친구들 · 아이 카드', ic: 'kids', c: HC.kids, go: 'friends', steps: [['[친구들]에서 이름 누르기', '아이 카드가 열려요.'], ['사진 넣기', '대표 사진 1장과 추가 사진 2장을 넣을 수 있어요. 얼굴이 가운데 오게 맞춰요.'], ['돌봄 기록', '통화·문자·심방·기도제목을 골라 적어요. 기도제목은 위에 따로 모여요.']], tips: ['2주 이상 못 온 친구는 홈 [돌봄이 필요해요]에 보여요'] },
  { id: 'worship', t: '설교 · 악보', ic: 'music', c: HC.music, go: 'worship', steps: [['[예배] → 설교', '대본·퀴즈·자료 링크를 올리고 [점검 요청]을 누르면 디렉터가 확인해요.'], ['[예배] → 악보', '곡마다 악보 사진을 10장까지 올리고 ‹ ›로 순서를 정해요.'], ['악보 넘겨 보기', '위 빨간 버튼을 누르면 전체 화면으로 열려요.']] },
  { id: 'score', t: '악보 넘기기', ic: 'score', c: HC.score, go: 'worship', steps: [['옆으로 밀기', '왼쪽으로 밀면 다음 장, 오른쪽으로 밀면 이전 장이에요. 맨 앞·맨 끝에서는 멈춰요.'], ['화면 양쪽 누르기', '오른쪽 가장자리는 다음, 왼쪽 가장자리는 이전, 가운데는 닫기예요.'], ['위아래로 밀기', '창이 닫혀요. 두 손가락으로 벌리면 크게 볼 수 있어요.'], ['페달 · 키보드', '블루투스 악보 페달(→, ↓, PageDown)과 키보드 화살표로도 넘어가요.'], ['눈 깜빡임 (실험)', '눈 모양 버튼을 누르고 카메라를 허용하면, 두 번 빠르게 깜빡이면 다음 장, 세 번 빠르게 깜빡이면 이전 장이에요. 한 번 깜빡이는 건 넘어가지 않아요. 영상은 휴대폰 안에서만 쓰여요.']], tips: ['악보를 보는 동안 화면이 꺼지지 않아요', '눈 깜빡임은 밝은 곳에서 얼굴이 화면 정면에 있을 때 잘 돼요'] },
  { id: 'room', t: '교사실 · 공지 · 캘린더', ic: 'room', c: HC.room, go: 'room', steps: [['공지', '디렉터·관리자가 행사 안내를 사진·링크와 함께 올리고, 모두 댓글을 달 수 있어요.'], ['캘린더', '주일·행사·회의·부재·생일이 한 달 판에 보여요. 날짜를 누르고 [+ 일정]으로 올려요.'], ['일정 상세', '일정을 누르면 사진과 댓글이 있어요. [구글 캘린더에 추가]도 돼요.']] },
  { id: 'staff', t: '교사 영혼 카드 · 업무 분담', ic: 'staff', c: HC.staff, go: 'room', steps: [['이름을 누르면 카드', '업무 분담·조직도·캘린더의 선생님 이름을 누르면 영혼 카드가 열려요.'], ['맡은 일 한눈에', '역할, 다가오는 순서, 부재 시 대신할 분이 정리돼 있어요.'], ['부재 알리기', '못 오는 주일을 알리면 캘린더와 업무 분담에 대신할 분이 보여요.']], tips: ['교사 돌봄 기록은 쓴 사람과 디렉터만 봐요'] },
  { id: 'privacy', t: '누가 무엇을 보나', ic: 'lock', c: HC.lock },
  { id: 'faq', t: '자주 묻는 질문', ic: 'faq', c: HC.faq }
];
const HELP_IC = {
  home: ICON.home, att: ICON.att, kids: ICON.kids, music: ICON.music, room: ICON.room,
  staff: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>', install: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 7v7m-3-3 3 3 3-3"/>',
  faq: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  score: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><path d="M15 16l3-3 3 3" transform="translate(-3 0)"/>'
};
const FAQ = [
  ['새 버전이 안 보여요', '앱 위쪽에 "새 버전" 줄이 뜨면 [지금 새로고침]을 눌러요. 안 뜨면 홈 화면 앱을 완전히 닫았다가 다시 열어요.'],
  ['"권한이 없어요"가 떠요', '교사 명단에 내 구글 메일이 연결되어 있어야 해요. 디렉터나 관리자에게 말해 주세요.'],
  ['다른 반 친구가 안 보여요', '선생님은 맡은 반만 볼 수 있어요. 디렉터·관리자는 모든 반을 봐요.'],
  ['악보 사진이 흐려요', '종이를 밝은 곳에서 정면으로 찍거나, PDF는 화면을 캡처해서 올리면 또렷해요. 장당 1MB 안쪽으로 자동으로 줄여요.'],
  ['눈 깜빡임 넘기기가 안 돼요', '카메라 허용이 필요해요. 처음 켤 때 10초쯤 준비 시간이 걸리고, 아이폰은 사파리에서 잘 돼요. 페달이 가장 확실해요.'],
  ['사진은 몇 장까지 올려요?', '악보·공지·일정은 10장까지, 아이 카드는 대표 1장 + 추가 2장이에요.'],
  ['인터넷이 끊기면요?', '출석은 그대로 눌러도 돼요. 연결되면 저절로 올라가요.'],
  ['구글 캘린더와 연결돼요?', '일정마다 [구글 캘린더에 추가]를 누르면 내 캘린더에 들어가요. 자동 연동은 다음 단계에서 준비할게요.']
];
const devGuess = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'pc';
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.bip = e; });
function vHelp() {
  const topic = S.arg ? HELP.find(h => h.id === S.arg) : null;
  const back = `<button class="back" data-act="${topic ? 'helpHome' : 'go'}" data-to="home">← ${topic ? '도우미' : '홈'}</button>`;
  if (!topic) {
    return `<div class="scroll narrow">${back}<div class="eyebrow">도우미</div><h1 class="atitle">무엇을 도와드릴까요?</h1>
<input class="search" id="hq" type="search" placeholder="찾기 — 예: 악보, 출석, 부재" autocomplete="off">
<div class="btns" style="flex-wrap:wrap"><button class="ghost sm2" data-act="helpGo" data-id="install">홈 화면에 바로가기</button><button class="ghost sm2" data-act="helpGo" data-id="start">처음 시작</button><button class="ghost sm2" data-act="helpGo" data-id="faq">자주 묻는 질문</button></div>
<div class="htiles" id="htiles">${HELP.map(h => `<button class="htile" data-act="helpGo" data-id="${h.id}" data-k="${esc(h.t + ' ' + (h.steps || []).map(s => s.join(' ')).join(' '))}"><span class="hic" style="background:${h.c}">${svg(HELP_IC[h.ic] || ICON.home, 24, 1.8)}</span><b>${esc(h.t)}</b></button>`).join('')}</div>
<div class="s2" style="text-align:center">조이코너 노트 ${APP_VERSION}</div></div>${nav('help')}`;
  }
  let body = '';
  if (topic.id === 'install') body = helpInstall();
  else if (topic.id === 'faq') body = FAQ.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  else if (topic.id === 'privacy') body = `<div class="pgrid">${[['맡은 반 선생님', '그 반 아이 카드·사진·가정·출석·돌봄 기록'], ['디렉터', '모든 반, 교사 명단·권한, 공지, 설교 점검, 반 올리기, 교사 돌봄 기록'], ['시스템 관리자', '모든 반 아이·가정 데이터, 가져오기, 일정표·업무 분담, 백업'], ['교사 모두', '공지, 캘린더, 순서표, 업무 분담, 조직도, 설교, 악보'], ['쓴 사람 + 디렉터', '교사 영혼 카드의 돌봄 기록 (시스템 관리자도 못 봐요)'], ['수퍼관리자', '사용 현황 · 디렉터 지정']].map(([a, b]) => `<section class="card"><div class="lbl"><span>${a}</span></div><div>${b}</div></section>`).join('')}</div><div class="note">아이 정보는 깃허브에 올라가지 않고, 로그인한 선생님에게만 보여요.</div>`;
  else body = `<ol class="steps">${topic.steps.map(([a, b], i) => `<li><span class="sn">${i + 1}</span><div><b>${esc(a)}</b><p>${esc(b)}</p></div></li>`).join('')}</ol>${(topic.tips || []).length ? `<div class="chips">${topic.tips.map(t => `<span class="chip sm">💡 ${esc(t)}</span>`).join('')}</div>` : ''}${topic.go ? `<button class="cta" data-act="go" data-to="${topic.go}">${esc(topic.t)} 화면 열기</button>` : ''}`;
  return `<div class="scroll narrow">${back}<div class="hhead"><span class="hic" style="background:${topic.c}">${svg(HELP_IC[topic.ic] || ICON.home, 26, 1.8)}</span><h1 class="atitle">${esc(topic.t)}</h1></div>${body}</div>${nav('help')}`;
}
function helpInstall() {
  const dev = S.helpDev || devGuess();
  const tabs = [['ios', '아이폰 · 아이패드'], ['android', '안드로이드'], ['pc', '컴퓨터']];
  const steps = {
    ios: [['사파리로 열기', '카카오톡 안에서 열렸다면 오른쪽 아래 ⋯ → [다른 브라우저로 열기] → 사파리.'], ['공유 버튼 누르기', '아래(아이패드는 위) 가운데 네모 위 화살표 ⬆ 버튼이에요.'], ['[홈 화면에 추가]', '목록을 조금 내리면 있어요. 이름을 확인하고 [추가].']],
    android: [['크롬으로 열기', '카카오톡 안이라면 ⋮ → [다른 브라우저로 열기].'], ['⋮ 메뉴 누르기', '오른쪽 위 점 세 개예요.'], ['[앱 설치] 또는 [홈 화면에 추가]', '[설치]를 누르면 홈 화면에 조이코너 아이콘이 생겨요.']],
    pc: [['크롬 · 엣지로 열기', '주소창 오른쪽 끝을 봐요.'], ['설치 아이콘 누르기', '모니터 모양에 화살표가 있는 아이콘이에요.'], ['[설치]', '바탕화면과 작업표시줄에 앱처럼 생겨요.']]
  }[dev];
  return `${isStandalone() ? '<div class="note">지금 홈 화면 앱으로 열려 있어요. 따로 할 일이 없어요!</div>' : ''}
${S.bip && !isStandalone() ? '<button class="cta" data-act="installNow">지금 설치</button>' : ''}
<div class="seg">${tabs.map(([k, l]) => `<button class="${dev === k ? 'on' : ''}" data-act="helpDev" data-id="${k}">${l}</button>`).join('')}</div>
<div class="installwrap"><ol class="steps">${steps.map(([a, b], i) => `<li><span class="sn">${i + 1}</span><div><b>${esc(a)}</b><p>${esc(b)}</p></div></li>`).join('')}</ol>
<div class="phone ${dev}"><div class="pscreen">${Array.from({ length: 11 }, (_, i) => `<i style="background:${['#A8D0F0', '#FFD66B', '#B9DDB0', '#F4A9A0', '#D9BFF2', '#F6C28B'][i % 6]}"></i>`).join('')}<img src="icon-192.png" alt="조이코너 아이콘" class="pnew"><span class="plabel">조이코너</span></div></div></div>`;
}
function welcomeLine() {
  let off = false; try { off = localStorage.getItem('jc_welcome_off') === '1'; } catch { /* 없음 */ }
  if (off) return '';
  const sa = isStandalone();
  return `<div class="welcome full"><img src="icon-192.png" alt="" width="40" height="40"><span class="t"><b>처음이세요?</b><span>${sa ? '도우미에서 기능을 차근차근 볼 수 있어요.' : '홈 화면에 바로가기를 만들면 앱처럼 열려요.'}</span></span>${sa ? '' : '<button class="ghost sm2" data-act="helpGo" data-id="install">바로가기</button>'}<button class="ghost sm2" data-act="go" data-to="help">도우미</button><button class="x" data-act="welcomeOff" aria-label="닫기">×</button></div>`;
}

/* ---------- 새 버전 알림 ---------- */
async function checkVersion() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json();
    if (j.v && j.v !== APP_VERSION && !document.getElementById('newver')) {
      const b = document.createElement('div'); b.id = 'newver'; b.className = 'newver';
      b.innerHTML = `<span>새 버전 <b>${esc(j.v)}</b>이 나왔어요</span><button data-act="reload">지금 새로고침</button>`;
      document.body.prepend(b);
    }
  } catch { /* 오프라인 */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.phase === 'ready') checkVersion(); });

/* ================= v7 ================= */
const isDirectorMe = () => !!(S.me.owner || S.me.director);

/* ---------- 선생님 카드 고르기 (이름 입력 대신) ---------- */
const SP = {};
const NAME_SPLIT = /\s*[,，·/]\s*|\s+및\s+/;
const splitNames = v => String(v || '').split(NAME_SPLIT).map(x => x.trim()).filter(Boolean);
function spInit(id, names) { SP[id] = splitNames(Array.isArray(names) ? names.join(',') : names); }
function spHtml(id) {
  const sel = SP[id] || [];
  const reg = S.staff.filter(x => x.kind !== 'helper'), helpers = S.staff.filter(x => x.kind === 'helper');
  const tog = st => `<button type="button" class="sptog ${sel.includes(st.name) ? 'on' : ''}" data-act="spTog" data-id="${id}" data-n="${esc(st.name)}">${staffAv(st, 26)}<span>${esc(st.name)}</span></button>`;
  const extra = sel.filter(n => !S.staff.some(s => s.name === n));
  return `<div class="sp" id="sp_${id}">
<div class="spsel">${sel.length ? sel.map(n => { const st = S.staff.find(s => s.name === n); return `<span class="spchip">${st ? staffAv(st, 22) : '<span class="mono" style="width:22px;height:22px;font-size:11px;background:#eee">글</span>'}<span>${esc(n)}</span><button type="button" data-act="spTog" data-id="${id}" data-n="${esc(n)}" aria-label="${esc(n)} 빼기">✕</button></span>`; }).join('') : '<span class="s2">아래에서 선생님 카드를 골라 주세요</span>'}</div>
<div class="spall"><div class="splbl">선생님</div><div class="spgrid">${reg.map(tog).join('')}</div>
${helpers.length ? `<div class="splbl">헬퍼 선생님</div><div class="spgrid">${helpers.map(tog).join('')}</div>` : ''}
${extra.length ? `<div class="splbl">카드 없이 적은 이름</div><div class="s2">${extra.map(esc).join(', ')}</div>` : ''}
<div class="spnew"><input class="in" id="spn_${id}" placeholder="새 이름 (외부·일일 선생님, 팀 이름 등)"><button type="button" class="ghost sm2" data-act="spNew" data-id="${id}">헬퍼 카드 만들기</button><button type="button" class="ghost sm2" data-act="spText" data-id="${id}">글로만 넣기</button></div></div></div>`;
}
const spRender = id => { const el = document.getElementById('sp_' + id); if (el) el.outerHTML = spHtml(id); };
function spTog(id, n) { const l = SP[id]; const i = l.indexOf(n); if (i >= 0) l.splice(i, 1); else l.push(n); spRender(id); }
async function spNew(id, textOnly) {
  const el = document.getElementById('spn_' + id), name = (el && el.value || '').trim();
  if (!name) return toast('이름을 적어 주세요');
  if (!textOnly && !S.staff.some(s => s.name === name)) {
    const ref = doc(collection(db, 'staff'));
    const data = { name, kind: 'helper', role: 'teacher', classes: [], classRole: {}, duties: [], email: '', order: Math.max(0, ...S.staff.map(x => x.order || 0)) + 1 };
    try { await setDoc(ref, data); S.staff.push({ id: ref.id, ...data }); toast(`${name} 헬퍼 선생님 카드를 만들었어요`); } catch (e) { return toast('카드를 만들지 못했어요: ' + errMsg(e)); }
  }
  if (!SP[id].includes(name)) SP[id].push(name);
  spRender(id);
}
const spVal = id => (SP[id] || []).join(', ');

/* ---------- 주일 담당 (일정표) ---------- */
const TURN_KEYS = [['preacher', '설교'], ['pray', '중보기도 인도'], ['nation', '성전건축·나라 기도'], ['chant', '챈트'], ['dance', '율동'], ['guitar', '기타·메트로놈']];
function schedSheet(dateArg) {
  const d = typeof dateArg === 'string' && /^\d{4}-/.test(dateArg) ? dateArg : W.date;
  S.schedDate = d;
  const s = schedFor(d) || {}, c = s.check || {};
  TURN_KEYS.forEach(([k]) => spInit('sc_' + k, s[k] || ''));
  const f = (id, label, v, ph = '') => `<label class="fld">${label}<input class="in" id="sc_${id}" value="${esc(v || '')}" placeholder="${ph}"></label>`;
  sheet(`<div class="ttl" style="font-size:24px">${fmtMD(d)} 주일 담당</div>
${f('story', '성경이야기 제목', s.story)}
${TURN_KEYS.map(([k, l]) => `<div class="fld">${l}</div>${spHtml('sc_' + k)}${k === 'chant' ? f('verse', '챈트 말씀', s.verse, '예: 시 84:11') : ''}`).join('')}
${f('offering', '헌금기도 (아이 이름)', s.offering)}
<div class="fld">설교 사전 점검</div><div class="two"><label class="fld">점검 날짜<input class="in" type="date" id="sc_cdate" value="${esc(c.date || '')}"></label><div class="chips" style="align-self:end">${[['feedback', '피드백'], ['room', '참여룸'], ['activity', '활동'], ['drama', '연극']].map(([k, l]) => `<label class="chk" style="min-height:40px;margin-right:6px"><input type="checkbox" id="sc_c_${k}" ${c[k] ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
<label class="chk"><input type="checkbox" id="sc_done" ${s.done ? 'checked' : ''}>율동·챈트 준비 확인 (기도여부)</label>
<label class="chk"><input type="checkbox" id="sc_no" ${s.noService ? 'checked' : ''}>이 주일은 조이코너 예배 없음</label>
${s.ref ? `<div class="s2">시트 참고 칸: ${esc(s.ref)}</div>` : ''}
<div class="btns"><button class="pri" data-act="schedSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
async function schedSave() {
  const d = S.schedDate || W.date;
  const data = { date: d, noService: $('#sc_no').checked, done: $('#sc_done').checked, story: val('sc_story'), verse: val('sc_verse'), offering: val('sc_offering'),
    check: { date: val('sc_cdate'), feedback: $('#sc_c_feedback').checked, room: $('#sc_c_room').checked, activity: $('#sc_c_activity').checked, drama: $('#sc_c_drama').checked } };
  TURN_KEYS.forEach(([k]) => { data[k] = spVal('sc_' + k); });
  try {
    await setDoc(doc(db, 'schedule', d), data, { merge: true });
    const i = S.schedule.findIndex(x => x.date === d);
    if (i >= 0) Object.assign(S.schedule[i], data); else { S.schedule.push({ id: d, ...data }); S.schedule.sort((a, b) => ko(a.date, b.date)); }
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}

/* ---------- 교사실 · 순서표 ---------- */
const TURN_ALL = [['story', '성경이야기'], ...TURN_KEYS, ['offering', '헌금기도']];
function checkBadge(r) {
  const c = r.check || {}; const n = ['feedback', 'room', 'activity', 'drama'].filter(k => c[k]).length;
  if (!c.date && !n) return '';
  return `<span class="tag ${n ? 'g' : ''}" title="사전 점검 ${esc(c.date || '')}">점검${c.date ? ' ' + esc(c.date.slice(5).replace('-', '/')) : ''}${n ? ' · ' + n : ''}</span>`;
}

/* 캘린더: 주일 담당 자동 표시 */

/* ---------- 사용 현황 (수퍼관리자) ---------- */
const USG = { screens: {}, acts: {}, minutes: 0, hours: {}, device: '', started: false, last: Date.now() };
const devKind = () => /iPad|Tablet/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (innerWidth >= 720 && innerWidth < 1100 && navigator.maxTouchPoints > 0) ? '패드' : (innerWidth < 720 || /iPhone|Android.+Mobile/.test(navigator.userAgent)) ? '휴대폰' : '컴퓨터';
function usageScreen(r) { if (S.phase !== 'ready') return; USG.screens[r] = (USG.screens[r] || 0) + 1; }
function usageAct(a) { if (S.phase !== 'ready' || !a) return; USG.acts[a] = (USG.acts[a] || 0) + 1; }
setInterval(() => { if (S.phase === 'ready' && document.visibilityState === 'visible') { const h = pad(new Date().getHours()); USG.minutes += 0.5; USG.hours[h] = (USG.hours[h] || 0) + 0.5; } }, 30000);
async function flushUsage() {
  if (S.phase !== 'ready' || !db) return;
  const has = USG.minutes || Object.keys(USG.screens).length || Object.keys(USG.acts).length || !USG.started;
  if (!has) return;
  const date = ymd(new Date()), id = `${S.me.email}_${date}`;
  const data = { email: S.me.email, name: S.me.name || S.user.displayName || '', date, last: new Date().toISOString() };
  if (USG.minutes) data.minutes = increment(USG.minutes);
  if (Object.keys(USG.hours).length) data.hours = Object.fromEntries(Object.entries(USG.hours).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(USG.screens).length) data.screens = Object.fromEntries(Object.entries(USG.screens).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(USG.acts).length) data.acts = Object.fromEntries(Object.entries(USG.acts).map(([k, v]) => [k, increment(v)]));
  if (!USG.started) { data.device = { [devKind()]: increment(1) }; data.opens = increment(1); }
  const snap = { ...USG }; USG.screens = {}; USG.acts = {}; USG.minutes = 0; USG.hours = {}; USG.started = true;
  try { await setDoc(doc(db, 'usage', id), data, { merge: true }); } catch { Object.assign(USG, { minutes: snap.minutes }); }
}
setInterval(flushUsage, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushUsage(); });
window.addEventListener('pagehide', flushUsage);
const SCREEN_NAME = { home: '홈', attend: '출석', friends: '친구들', kid: '아이 카드', stats: '통계', settings: '설정', worship: '예배', room: '교사실', notice: '공지', event: '일정', staff: '교사 카드', help: '도우미', usage: '사용 현황', promote: '반 올리기' };
const ACT_NAME = { toggle: '출석 체크', allIn: '전원 출석', noteAdd: '아이 돌봄 기록', sermonSave: '설교 올림', cmAdd: '댓글', songSave: '악보 올림', songPlay: '악보 넘겨 보기', noticeSave: '공지 올림', eventSave: '일정 올림', snAdd: '교사 돌봄 기록', photo: '아이 사진', addKidSave: '새 친구 등록', schedSave: '담당 고침', dutySave: '업무 분담 고침', awayNew: '부재 알림', installNow: '앱 설치', backup: '백업' };
async function vUsageLoad(force) {
  if (!S.me.owner) return;
  R.us = R.us || { days: 30, rows: null };
  if (R.us.rows && !force) return;
  const from = addDays(ymd(new Date()), -(R.us.days - 1));
  try { const s = await getDocs(query(collection(db, 'usage'), where('date', '>=', from))); R.us.rows = s.docs.map(d => d.data()); } catch (e) { R.us.rows = []; toast('사용 현황을 불러오지 못했어요: ' + errMsg(e)); }
  if (S.route === 'usage') paint();
}
function vUsage() {
  if (!S.me.owner) return `<div class="scroll narrow"><div class="sub">수퍼관리자만 볼 수 있어요.</div></div>${nav('home')}`;
  R.us = R.us || { days: 30, rows: null };
  if (!R.us.rows) { vUsageLoad(); return `<div class="scroll narrow"><button class="back" data-act="go" data-to="settings">← 설정</button><div class="sub">불러오는 중…</div></div>${nav('home')}`; }
  const rows = R.us.rows, sum = (o, m) => { Object.entries(m || {}).forEach(([k, v]) => { o[k] = (o[k] || 0) + (Number(v) || 0); }); return o; };
  const per = {}; rows.forEach(r => { const p = per[r.email] = per[r.email] || { name: r.name, email: r.email, days: 0, min: 0, last: '' }; p.days++; p.min += Number(r.minutes) || 0; if ((r.last || '') > p.last) p.last = r.last; });
  const hours = rows.reduce((o, r) => sum(o, r.hours), {}), screens = rows.reduce((o, r) => sum(o, r.screens), {}), acts = rows.reduce((o, r) => sum(o, r.acts), {}), dev = rows.reduce((o, r) => sum(o, r.device), {});
  const totalMin = Object.values(per).reduce((s, p) => s + p.min, 0);
  const linked = S.staff.filter(x => x.email), never = linked.filter(x => !per[x.email]);
  const maxH = Math.max(1, ...Object.values(hours));
  const bars = (o, names) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8); const mx = Math.max(1, ...e.map(x => x[1])); return e.length ? e.map(([k, v]) => `<div class="hb"><span class="nm w">${esc((names && names[k]) || k)}</span><div class="tr"><i style="width:${Math.round(v / mx * 100)}%"></i></div><span class="pc">${Math.round(v)}</span></div>`).join('') : '<div class="s2">아직 기록이 없어요</div>'; };
  const minTxt = m => m < 60 ? `${Math.round(m)}분` : `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분`;
  return `<div class="scroll cols"><div class="hd"><button class="back" data-act="go" data-to="settings">← 설정</button><button class="sec sm2" data-act="usageReload">새로 불러오기</button></div>
<div class="ttl">사용 현황</div><div class="seg" style="max-width:360px">${[7, 30, 90].map(n => `<button class="${R.us.days === n ? 'on' : ''}" data-act="usageDays" data-id="${n}">${n}일</button>`).join('')}</div>
<div class="s2 full">개발 개선을 위한 기록이에요. 어떤 화면을 언제 많이 쓰는지만 모으고, 접속 위치나 입력한 내용은 모으지 않아요. 수퍼관리자만 봐요.</div>
<section class="card"><div class="lbl"><span>한눈에</span></div><div class="kv"><span>쓴 선생님</span><b>${Object.keys(per).length}명 / 연결 ${linked.length}명</b></div><div class="kv"><span>모두 쓴 시간</span><b>${minTxt(totalMin)}</b></div><div class="kv"><span>한 사람 평균</span><b>${minTxt(totalMin / Math.max(1, Object.keys(per).length))}</b></div></section>
<section class="card"><div class="lbl"><span>시간대 (분)</span></div><div class="hours">${Array.from({ length: 24 }, (_, h) => { const v = hours[pad(h)] || 0; return `<div class="hcol" title="${h}시 ${Math.round(v)}분"><i style="height:${Math.round(v / maxH * 100)}%"></i><span>${h % 3 === 0 ? h : ''}</span></div>`; }).join('')}</div></section>
<section class="card"><div class="lbl"><span>기기</span></div>${bars(dev)}</section>
<section class="card"><div class="lbl"><span>많이 연 화면</span></div>${bars(screens, SCREEN_NAME)}</section>
<section class="card"><div class="lbl"><span>많이 한 일</span></div>${bars(acts, ACT_NAME)}</section>
<section class="card"><div class="lbl"><span>선생님별</span></div>${Object.values(per).sort((a, b) => b.min - a.min).map(p => `<div class="kv"><span>${esc(p.name || p.email)}</span><b>${p.days}일 · ${minTxt(p.min)} · ${esc((p.last || '').slice(5, 10).replace('-', '/'))}</b></div>`).join('') || '<div class="s2">아직 없어요</div>'}</section>
${never.length ? `<section class="card"><div class="lbl"><span>이 기간에 안 들어온 선생님</span></div><div class="chips">${never.map(x => staffChip(x.name)).join('')}</div></section>` : ''}</div>${nav('home')}`;
}

/* ---------- 연도별 백업 ---------- */
async function runBackup(withPhotos) {
  const y = val('bk_year') || String(new Date().getFullYear());
  const msg = $('#bk_msg'); msg.textContent = '모으는 중…';
  const inYear = (o, keys) => keys.some(k => String(o[k] || '').startsWith(y));
  const plan = [
    ['classes'], ['staff'], ['teachers'], ['children'], ['families'], ['duties'], ['stories'], ['incoming'], ['promotions'],
    ['attendance', o => inYear(o, ['date'])], ['careNotes'], ['schedule', o => inYear(o, ['date'])], ['sermons', o => inYear(o, ['date'])],
    ['comments', o => inYear(o, ['at'])], ['songs', o => inYear(o, ['date'])], ['setlists', o => inYear(o, ['date'])],
    ['notices', o => inYear(o, ['at', 'eventDate'])], ['events', o => inYear(o, ['date'])]
  ];
  if (S.me.director) plan.push(['staffNotes']);
  if (withPhotos) plan.push(['photos'], ['staffPhotos'], ['scorePages', o => inYear(o, ['date'])], ['noticeImages'], ['eventImages']);
  const out = { kind: 'backup', app: '조이코너 노트', version: APP_VERSION, year: y, at: new Date().toISOString(), by: S.me.email, collections: {} };
  let n = 0;
  for (const [name, filt] of plan) {
    msg.textContent = `모으는 중… ${name}`;
    try {
      const s = await getDocs(collection(db, name));
      const m = {}; s.docs.forEach(d => { const o = d.data(); if (!filt || filt(o)) { m[d.id] = o; n++; } });
      out.collections[name] = m;
    } catch { out.collections[name] = { _error: '권한이 없어 빠졌어요' }; }
  }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `조이코너_백업_${y}${withPhotos ? '_사진포함' : ''}_${ymd(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  msg.textContent = `${n}건을 내려받았어요 (${(blob.size / 1048576).toFixed(1)}MB). 컴퓨터나 드라이브에 보관해 주세요.`;
  usageAct('backup');
}

/* ---------- 새해 반 올리기 (디렉터) ---------- */
const PROMO = { year: null, keep: {}, inc: null, done: null };
async function promoLoad() {
  PROMO.year = PROMO.year || (new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  try { const s = await getDocs(collection(db, 'incoming')); PROMO.inc = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ko(a.name, b.name)); } catch { PROMO.inc = []; }
  try { const p = await getDoc(doc(db, 'promotions', String(PROMO.year))); PROMO.done = p.exists() ? p.data() : null; } catch { PROMO.done = null; }
  if (S.route === 'promote') paint();
}
async function promoRun() {
  closeSheet();
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age), byAge = a => cls.find(c => c.age === a);
  const ops = [], moved = [], grad = [];
  for (const c of cls.slice().reverse()) {
    const nx = byAge(c.age + 1);
    for (const k of activeKids(c.id)) {
      if (PROMO.keep[k.id] === false) continue;
      if (nx) { ops.push(['u', doc(db, 'children', k.id), { classId: nx.id }]); moved.push([k, c.id, nx.id]); }
      else { ops.push(['u', doc(db, 'children', k.id), { status: 'graduated', gradYear: PROMO.year }]); grad.push(k); }
    }
  }
  const first = cls[0]; const newKids = [];
  for (const x of (PROMO.inc || []).filter(x => String(x.year) === String(PROMO.year) && !x.added && PROMO.keep['in:' + x.id] !== false)) {
    let fam = Object.values(S.fam).find(f => f.father && f.mother && f.father === x.father && f.mother === x.mother);
    const kidRef = doc(collection(db, 'children'));
    let famId;
    if (fam) { famId = fam.id; ops.push(['m', doc(db, 'families', famId), { childIds: [...new Set([...(fam.childIds || []), kidRef.id])] }]); }
    else { const fr = doc(collection(db, 'families')); famId = fr.id; ops.push(['s', fr, { father: x.father, mother: x.mother, fatherCell: x.cell, motherCell: x.cell, fatherTel: '', motherTel: '', siblings: [], childIds: [kidRef.id], classIds: [first.id] }]); S.fam[famId] = { id: famId, father: x.father, mother: x.mother, childIds: [kidRef.id], classIds: [first.id] }; }
    const kid = { classId: first.id, name: x.name, birth: x.birth || '', birthYear: x.birthYear || null, status: 'active', familyId: famId, flags: ['새친구'], remark: x.note || '', note: `${PROMO.year}년 ${x.from || ''}에서 올라왔어요`, thumb: '', since: `${PROMO.year}-01-01` };
    ops.push(['s', kidRef, kid]); newKids.push({ id: kidRef.id, ...kid });
    ops.push(['m', doc(db, 'incoming', x.id), { added: true, childId: kidRef.id }]);
  }
  // 사진·돌봄 기록도 새 반으로
  for (const [k, , to] of moved) {
    for (const s of ['main', '1', '2']) ops.push(['mx', doc(db, 'photos', `${k.id}_${s}`), { classId: to }]);
  }
  toast('반을 올리는 중이에요…');
  try {
    // 사진은 없을 수도 있어서 먼저 있는지 확인
    const photoOps = ops.filter(o => o[0] === 'mx');
    const realPhoto = [];
    await Promise.all(photoOps.map(async o => { try { if ((await getDoc(o[1])).exists()) realPhoto.push(['m', o[1], o[2]]); } catch { /* 없음 */ } }));
    const all = ops.filter(o => o[0] !== 'mx').concat(realPhoto);
    for (const [k, from, to] of moved) {
      try { const ns = await getDocs(query(collection(db, 'careNotes'), where('classId', '==', from), where('childId', '==', k.id))); ns.docs.forEach(d => all.push(['m', d.ref, { classId: to }])); } catch { /* 없음 */ }
    }
    for (let i = 0; i < all.length; i += 400) {
      const b = writeBatch(db);
      all.slice(i, i + 400).forEach(([t, r, d]) => { if (t === 'u') b.update(r, d); else if (t === 'm') b.set(r, d, { merge: true }); else b.set(r, d); });
      await b.commit();
    }
    // 가정의 반 목록 다시 맞추기
    await loadAll();
    const fb = writeBatch(db); let fn = 0;
    allKids().forEach(k => { const f = S.fam[k.familyId]; if (!f) return; const ids = [...new Set(allKids().filter(x => x.familyId === k.familyId && (x.status || 'active') === 'active').map(x => x.classId))]; if (JSON.stringify((f.classIds || []).slice().sort()) !== JSON.stringify(ids.slice().sort()) && ids.length) { f.classIds = ids; fb.set(doc(db, 'families', f.id), { classIds: ids }, { merge: true }); fn++; } });
    if (fn) await fb.commit();
    await setDoc(doc(db, 'promotions', String(PROMO.year)), { year: PROMO.year, at: new Date().toISOString(), by: S.me.email, moved: moved.length, graduated: grad.length, added: newKids.length });
    PROMO.inc = null; PROMO.keep = {};
    toast(`끝났어요! 올라감 ${moved.length} · 졸업 ${grad.length} · 새 친구 ${newKids.length}`);
    go('home');
  } catch (e) { toast('중간에 멈췄어요: ' + errMsg(e)); }
}

/* ================= v8 · 오와 열 맞추기 ================= */

/* ---------- 얼굴 카드 ---------- */
const PALETTE = ['#F4A9A0', '#A8D0F0', '#B9DDB0', '#FFD66B', '#D9BFF2', '#F6C28B', '#9ED9D1', '#F7B7D2', '#C5CAE9', '#E6EE9C', '#FFCC80', '#B0BEC5', '#CE93D8', '#80CBC4', '#FFAB91', '#AED581', '#90CAF9', '#F48FB1', '#BCAAA4', '#DCE775'];
function staffColor(st) {
  const list = S.staff.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || ko(a.name, b.name));
  const i = Math.max(0, list.findIndex(x => x.id === st.id));
  return PALETTE[i % PALETTE.length];
}
const monoColor = n => { const st = S.staff.find(x => x.name === n); return st ? staffColor(st) : PALETTE[hash(n) % PALETTE.length]; };
const monoChar = n => (n && n.length >= 3 ? n[1] : (n || '?')[0]);
const LAZY = 'loading="lazy" decoding="async"';
function staffAv(st, sz) {
  return st.thumb ? `<img class="ph" src="${st.thumb}" alt="" ${LAZY} width="${sz}" height="${sz}" style="width:${sz}px;height:${sz}px">`
    : `<span class="mono" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.46)}px;background:${staffColor(st)}">${esc(monoChar(st.name))}</span>`;
}
const kidAge = k => (S.classes[k.classId] || {}).age;
const cleanKidName = n => String(n || '').replace(/\(.*?\)/g, '').replace(/\s*가정$/, '').trim();
const kidByName = n => { const c = cleanKidName(n); return c ? allKids().find(k => k.name === c) : null; };
function kidTile(k, sub) {
  const age = kidAge(k);
  return `<button class="tile" data-act="kid" data-id="${k.id}">${avatar(k, 36)}<span class="tt"><b>${esc(k.name)}</b><span>${sub !== undefined ? sub : (age ? age + '세' : '')}</span></span></button>`;
}
function staffTile(n, sub, extra = '') {
  const st = S.staff.find(x => x.name === n);
  if (!st) return `<span class="tile txt"><span class="mono" style="width:36px;height:36px;font-size:15px;background:#EFE4D2">${svg('<path d="M5 20c0-4 3-7 7-7s7 3 7 7"/><circle cx="12" cy="8" r="4"/>', 18, 1.6)}</span><span class="tt"><b>${esc(n)}</b>${sub ? `<span>${sub}</span>` : ''}</span>${extra}</span>`;
  return `<button class="tile" data-act="staffOpen" data-id="${st.id}">${staffAv(st, 36)}<span class="tt"><b>${esc(n)}</b><span>${sub !== undefined ? sub : (st.kind === 'helper' ? '헬퍼' : roleLabel(st) === '교사' ? '' : roleLabel(st))}</span></span>${extra}</button>`;
}
function offeringHtml(v) {
  if (!v) return '<span class="dash">-</span>';
  const k = kidByName(v);
  return k ? kidTile(k, `${kidAge(k) || ''}세 · 헌금기도`) : `<span class="txtname">${esc(v)}</span>`;
}

/* ---------- 아이콘 ---------- */
const TI = {
  story: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h6"/>',
  preacher: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  pray: '<path d="M12 3c-2 3-5 6-5 10a5 5 0 0 0 10 0c0-4-3-7-5-10z"/>',
  nation: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/>',
  chant: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M18 14v6m-3-3h6"/>',
  dance: '<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 7M12 13l3 7M7 9l5 2 5-2"/>',
  guitar: '<path d="M14 4l6 6M17 7l-6 6"/><circle cx="8" cy="16" r="4"/><circle cx="8" cy="16" r="1"/>',
  offering: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  mine: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'
};
const TURN_LBL = { story: '성경이야기', preacher: '설교', pray: '중보기도', nation: '나라 기도', chant: '챈트', dance: '율동', guitar: '기타', offering: '헌금기도' };
const ico = (k, s = 18) => `<span class="ic">${svg(TI[k] || TI.all, s, 1.8)}</span>`;

/* ---------- 주일 카드 (이번 주 · 순서표 · 캘린더에서 같이 써요) ---------- */
function sundayRows(s, keys) {
  return keys.map(k => `<div class="rrow ${k !== 'offering' && hasName(s[k], myName()) ? 'me' : ''}"><span class="rl">${ico(k)}${TURN_LBL[k]}${k === 'chant' && s.verse ? `<em>${esc(s.verse)}</em>` : ''}</span><span class="rv">${k === 'offering' ? offeringHtml(s.offering) : (s[k] ? namesHtml(s[k]) : '<span class="dash">-</span>')}</span></div>`).join('');
}
function namesHtml(v) {
  const l = splitNames(v);
  if (!l.length) return '<span class="dash">-</span>';
  return `<span class="chipcol">${l.map(n => S.staff.some(s => s.name === n) ? staffChip(n) : `<span class="txtname">${esc(n)}</span>`).join('')}</span>`;
}
function sundayCard(s, opts = {}) {
  const d = parseD(s.date), now = s.date === nextSunday();
  const keys = ['preacher', 'pray', 'nation', 'chant', 'dance', 'guitar', 'offering'];
  return `<article class="sunday ${now ? 'now' : ''} ${s.noService ? 'off' : ''}"><header><span class="sd"><b>${d.getMonth() + 1}/${d.getDate()}</b><small>주일</small></span><span class="st">${esc(s.story || (s.noService ? '조이코너 예배 없음' : '이야기 미정'))}</span>${now ? '<span class="tag">이번 주</span>' : ''}${checkBadge(s)}${isAdminMe() && !opts.noEdit ? `<button class="editbtn" data-act="schedEditDate" data-id="${s.date}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 담당 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 16, 1.8)}</button>` : ''}</header>
${sundayEventsHtml(s.date)}${s.noService ? `<div class="offnote">${esc(s.noServiceNote || '이 주일은 조이코너 예배가 없어요')}</div>` : `<div class="rrows">${sundayRows(s, keys)}</div>`}</article>`;
}
function wWeek(d) {
  const s = schedFor(d) || { date: d };
  const sermons = W.sermons.filter(x => x.date === d), songs = W.songs[d] || [];
  const away = awayOn(d);
  return `<div class="full">${sundayCard(s)}</div>
${away.length ? `<section class="card"><div class="lbl"><span>이번 주 부재</span></div>${away.map(st => `<div class="hrow">${staffChip(st.name)}${awayHandover(st)}</div>`).join('')}</section>` : ''}
<div class="statgrid full"><button class="stat" data-act="wtab" data-id="sermon">${ico('preacher', 22)}<span><b>${sermons.length ? statusLabel(sermons[0].status) : '아직 없음'}</b><small>설교${sermons.length ? ' · ' + esc(sermons[0].authorName || '') : ''}</small></span></button>
<button class="stat" data-act="wtab" data-id="songs">${svg(ICON.music, 22, 1.8)}<span><b>${songs.length}곡</b><small>악보${songs.length ? ' · 넘겨 보기' : ''}</small></span></button></div>`;
}
function dayTurnsHtml(d) {
  const s = schedFor(d);
  if (!s || s.noService) return '';
  return `<div class="dayturns"><div class="splbl">주일 담당</div><div class="rrows">${sundayRows(s, ['preacher', 'pray', 'nation', 'chant', 'dance', 'guitar', 'offering'])}</div></div>`;
}

/* ---------- 순서표: 월별 서랍 ---------- */
const MONTHS = '1월 2월 3월 4월 5월 6월 7월 8월 9월 10월 11월 12월'.split(' ');
function rTurns() {
  R.turnCat = R.turnCat || 'all';
  R.turnYear = R.turnYear || ymd(new Date()).slice(0, 4);
  R.openM = R.openM || {};
  const today = ymd(new Date()), me = myName(), Y = R.turnYear;
  const thisY = ymd(new Date()).slice(0, 4);
  const years = [...new Set([...S.schedule.map(r => r.date.slice(0, 4)), thisY, String(Number(thisY) + 1)])].sort();
  const cats = [['all', '전체'], ['preacher', '설교'], ['pray', '중보기도'], ['nation', '나라 기도'], ['chant', '챈트'], ['dance', '율동'], ['guitar', '기타'], ['offering', '헌금기도'], ['mine', '내 순서']];
  const head = `<div class="catbar full">${cats.map(([k, l]) => `<button class="cat ${R.turnCat === k ? 'on' : ''}" data-act="turnCat" data-id="${k}">${ico(k, 20)}<span>${l}</span></button>`).join('')}</div>
<div class="yearbar full">${years.map(y => `<button class="${y === Y ? 'on' : ''}" data-act="turnYear" data-id="${y}">${y}년</button>`).join('')}</div>${turnTools(Y)}`;
  const rows = S.schedule.filter(r => r.date.slice(0, 4) === Y);
  const byMonth = {}; rows.forEach(r => { (byMonth[Number(r.date.slice(5, 7))] ||= []).push(r); });
  const curM = today.slice(0, 4) === Y ? Number(today.slice(5, 7)) : 0;
  const isOpen = m => R.openM[Y + '-' + m] !== undefined ? R.openM[Y + '-' + m] : (m === curM || m === curM + 1 || (!curM && m === 1));
  const k = R.turnCat;
  let summary = '';
  if (k !== 'all' && k !== 'mine') {
    const count = {}; rows.forEach(r => splitNames(r[k]).forEach(n => { const key = k === 'offering' ? cleanKidName(n) : n; count[key] = (count[key] || 0) + 1; }));
    const ent = Object.entries(count).sort((a, b) => b[1] - a[1] || ko(a[0], b[0]));
    const known = ent.filter(([n]) => k === 'offering' ? kidByName(n) : S.staff.some(s => s.name === n)), other = ent.filter(x => !known.includes(x));
    summary = `<details class="drawer full" ${R.openCount ? 'open' : ''} data-dr="count"><summary>${ico(k, 20)}<b>${Y}년 ${TURN_LBL[k]} 맡은 횟수</b><span class="s2">${known.length}${k === 'offering' ? '가정' : '명'}${other.length ? ` · 그 밖에 ${other.reduce((s, x) => s + x[1], 0)}건` : ''}</span></summary>
<div class="tilegrid">${known.map(([n, c]) => k === 'offering' ? kidTile(kidByName(n), `${kidAge(kidByName(n)) || ''}세 · ${c}번`) : staffTile(n, `${c}번`)).join('')}</div>
${other.length ? `<div class="splbl">초청 · 그 밖에</div><div class="tilegrid">${other.map(([n, c]) => staffTile(n, `${c}번`)).join('')}</div>` : ''}</details>`;
  }
  const monthBody = (m, list) => {
    if (k === 'all') return `<div class="sungrid">${list.map(r => sundayCard(r)).join('')}</div>`;
    if (k === 'mine') {
      const mine = list.flatMap(r => TURN_KEYS.filter(([kk]) => hasName(r[kk], me)).map(([kk]) => ({ r, kk })));
      return mine.length ? `<div class="tlist">${mine.map(x => `<div class="trow2"><span class="sd sm"><b>${parseD(x.r.date).getMonth() + 1}/${parseD(x.r.date).getDate()}</b></span><span class="rl">${ico(x.kk)}${TURN_LBL[x.kk]}</span><span class="s2 grow">${esc(x.r.story || '')}</span></div>`).join('')}</div>` : '<div class="s2">이 달에는 내 순서가 없어요.</div>';
    }
    return `<div class="tlist">${list.map(r => `<div class="trow2 ${r.date === nextSunday() ? 'now' : ''}"><span class="sd sm"><b>${parseD(r.date).getMonth() + 1}/${parseD(r.date).getDate()}</b></span><span class="tv">${r.noService ? '<span class="s2">예배 없음</span>' : k === 'offering' ? offeringHtml(r.offering) : namesHtml(r[k])}</span><span class="tx s2">${k === 'preacher' ? esc(r.story || '') + ' ' + checkBadge(r) : k === 'chant' ? esc(r.verse || '') : ''}</span>${isAdminMe() ? `<button class="editbtn" data-act="schedEditDate" data-id="${r.date}" aria-label="고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 16, 1.8)}</button>` : ''}</div>`).join('')}</div>`;
  };
  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  const mini = list => { const names = [...new Set(list.flatMap(r => k === 'all' || k === 'mine' ? splitNames(r.preacher) : splitNames(r[k])))].filter(n => S.staff.some(s => s.name === n)).slice(0, 5); return names.map(n => staffAv(S.staff.find(s => s.name === n), 22)).join(''); };
  const drawerM = m => { const miss = isAdminMe() ? sundaysOfYear(Y, m).filter(d => !schedFor(d)).length : 0; return `<details class="drawer full" data-dr="${Y}-${m}" ${isOpen(m) ? 'open' : ''}><summary><span class="mname">${MONTHS[m - 1]}</span><span class="s2">주일 ${byMonth[m].length}번${m === curM ? ' · 이번 달' : ''}</span><span class="minis">${mini(byMonth[m])}</span></summary>${miss ? `<button class="addrow" data-act="turnFillM" data-id="${Y}-${m}">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.2)} 이 달 빈 주일 ${miss}번 더하기</button>` : ''}${monthBody(m, byMonth[m])}</details>`; };
  const ahead = curM ? months.filter(m => m >= curM) : months, past = curM ? months.filter(m => m < curM) : [];
  return `${head}${summary}${ahead.map(drawerM).join('')}${past.length ? `<details class="drawer full soft" data-dr="${Y}-past" ${R.openM[Y + '-past'] ? 'open' : ''}><summary><span class="mname">지난 달</span><span class="s2">${MONTHS[past[0] - 1]} – ${MONTHS[past[past.length - 1] - 1]}</span></summary><div class="pastwrap">${past.slice().reverse().map(drawerM).join('')}</div></details>` : ''}${months.length ? '' : '<div class="sub full">이 해의 일정표가 없어요.</div>'}`;
}

/* ---------- 업무 분담 · 사람별 카드 ---------- */
function dutyPeople() {
  const list = W.duties, me = myName(), admin = isAdminMe();
  const regs = S.staff.filter(x => x.kind !== 'helper').map(x => x.name), helpers = S.staff.filter(x => x.kind === 'helper').map(x => x.name);
  const card = n => {
    const st = S.staff.find(x => x.name === n), ds = dutiesOf(n), turns = upcomingTurns(n, 99).filter(t => t.date < addDays(ymd(new Date()), 35));
    const cls = st ? Object.entries(st.classRole || {}).map(([c, r]) => `${(S.classes[c] || {}).name || c} ${r}`) : [];
    return `<article class="pcard2 ${n === me ? 'me' : ''}"><button class="phead" ${st ? `data-act="staffOpen" data-id="${st.id}"` : ''}>${st ? staffAv(st, 52) : ''}<span class="tt"><b>${esc(n)}</b><span>${cls.map(esc).join(' · ') || (st && st.kind === 'helper' ? '헬퍼 선생님' : '반 없음')}</span></span>${st && (st.role === 'director' || st.role === 'admin') ? `<span class="tag">${roleLabel(st)}</span>` : ''}</button>
<div class="pstats"><span>${svg('<path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"/>', 16, 2)}<b>${ds.length}</b>맡은 일</span><span>${svg(ICON.room, 16, 1.8)}<b>${turns.length}</b>다가올 순서</span></div>
${ds.length ? `<div class="rolegrid">${ds.map(x => `<span>${esc(x.role)}</span>`).join('')}</div>` : '<div class="s2">맡은 일이 없어요</div>'}</article>`;
  };
  const light = admin ? regs.filter(n => dutiesOf(n).length <= 1) : [];
  return `<div class="pgrid2 full">${regs.map(card).join('')}</div>
${helpers.length ? `<details class="drawer full"><summary><b>헬퍼 선생님</b><span class="s2">${helpers.length}명</span></summary><div class="pgrid2">${helpers.map(card).join('')}</div></details>` : ''}
${light.length ? `<details class="drawer full soft"><summary><b>새 역할을 부탁드릴 수 있는 선생님</b><span class="s2">관리자에게만 보여요</span></summary><div class="tilegrid">${light.map(n => staffTile(n, `맡은 일 ${dutiesOf(n).length}`)).join('')}</div></details>` : ''}`;
}

/* ---------- 반 올리기 (가나다 · 격자) ---------- */
function vPromote() {
  if (!isDirectorMe()) return `<div class="scroll narrow"><button class="back" data-act="go" data-to="settings">← 설정</button><div class="sub">디렉터만 할 수 있어요.</div></div>${nav('home')}`;
  if (PROMO.inc === null) { promoLoad(); return `<div class="scroll narrow"><div class="sub">불러오는 중…</div></div>${nav('home')}`; }
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  const byAge = a => cls.find(c => c.age === a);
  const plan = cls.map(c => { const nx = byAge(c.age + 1); return { c, to: nx ? nx.name : '졸업', kids: activeKids(c.id) }; }).reverse();
  const incY = PROMO.inc.filter(x => String(x.year) === String(PROMO.year) && !x.added).sort((a, b) => ko(a.name, b.name));
  const on = id => PROMO.keep[id] !== false;
  const tile = (id, av, name, sub) => `<button class="tile sel ${on(id) ? 'on' : ''}" data-act="promoTog" data-id="${id}">${av}<span class="tt"><b>${esc(name)}</b><span>${sub}</span></span><span class="tick">${svg(ICON.check, 14, 3)}</span></button>`;
  const total = plan.reduce((s, p) => s + p.kids.filter(k => on(k.id)).length, 0) + incY.filter(x => on('in:' + x.id)).length;
  return `<div class="scroll"><button class="back" data-act="go" data-to="settings">← 설정</button><div class="eyebrow">디렉터</div><h1 class="atitle">${PROMO.year}년 반 올리기</h1>
${PROMO.done ? `<div class="note full">${PROMO.year}년 반 올리기는 ${esc((PROMO.done.at || '').slice(0, 10))}에 이미 했어요. 다시 하면 한 번 더 올라가요.</div>` : ''}
<div class="statgrid full">${plan.map(p => `<div class="stat flat"><span><b>${p.kids.filter(k => on(k.id)).length}<small>/${p.kids.length}</small></b><small>${esc(p.c.name)} → ${esc(p.to)}</small></span></div>`).join('')}<div class="stat flat"><span><b>${incY.filter(x => on('in:' + x.id)).length}<small>/${incY.length}</small></b><small>조이베이비 → ${esc((cls[0] || {}).name || '5세반')}</small></span></div></div>
<div class="note soft full"><span>빨간 테두리 친구만 움직여요. 누르면 이번에는 그대로 둬요.</span><span>실행 전에 꼭 백업을 받아 주세요. <button class="linkbtn" data-act="go" data-to="settings">백업하러 가기 ›</button></span></div>
${plan.map(p => `<details class="drawer full" open><summary><b>${esc(p.c.name)}</b>${svg('<path d="M5 12h14m-5-5 5 5-5 5"/>', 18, 2)}<b class="to">${esc(p.to)}</b><span class="s2">${p.kids.filter(k => on(k.id)).length} / ${p.kids.length}명</span></summary><div class="tilegrid">${p.kids.map(k => tile(k.id, avatar(k, 36), k.name, `${p.c.age}세 → ${p.to === '졸업' ? '졸업' : (p.c.age + 1) + '세'}`)).join('')}</div></details>`).join('')}
<details class="drawer full" open><summary><b>조이베이비</b>${svg('<path d="M5 12h14m-5-5 5 5-5 5"/>', 18, 2)}<b class="to">${esc((cls[0] || {}).name || '5세반')}</b><span class="s2">${incY.length}명</span></summary>${incY.length ? `<div class="tilegrid">${incY.map(x => tile('in:' + x.id, `<span class="mono" style="width:36px;height:36px;font-size:15px;background:${PALETTE[hash(x.name) % PALETTE.length]}">${esc(monoChar(x.name))}</span>`, x.name, `${x.birth ? x.birth.slice(2, 4) + '년생' : ''}${x.gender ? ' · ' + esc(x.gender) : ''}`)).join('')}</div><div class="s2">부모님 이름이 같은 가정은 형제로 묶여요.</div>` : '<div class="s2">설정 → 가져오기에서 joycorner-extra2.json을 넣으면 명단이 보여요.</div>'}</details>
<div class="note full">올린 뒤에는 선생님들의 반 배정도 바꿔 주세요 (설정 → 교사 명단).</div>
<button class="cta full" data-act="promoAsk">${PROMO.year}년 반 올리기 실행 · ${total}명</button></div>${nav('home')}`;
}

/* ---------- 캘린더: 기간 일정 ---------- */
const evSpan = e => e.endDate && e.endDate > e.date ? [e.date, e.endDate] : [e.date, e.date];
const fmtShort = s => `${parseD(s).getMonth() + 1}/${parseD(s).getDate()}`;
function rCal() {
  const today = ymd(new Date());
  if (!/^\d{4}-\d{2}$/.test(R.month || '')) R.month = today.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(R.day || '')) R.day = today;
  const [y, m] = R.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const cells = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(ymd(d)); }
  const weeks = cells[35].slice(0, 7) === R.month ? 6 : 5;
  const day = itemsOn(R.day), dd = parseD(R.day);
  const upcoming = []; for (let i = 0; i < 21; i++) itemsOn(addDays(today, i)).filter(x => x.kind !== 'sun' && (!x.span || x.first || i === 0)).forEach(x => upcoming.push(x));
  const rng = R.range && R.range.end ? [R.range.start, R.range.end].sort() : R.range ? [R.range.start, R.range.start] : null;
  return `<div class="calwrap full"><section class="card cal"><div class="calhead"><button data-act="calMonth" data-n="-1" aria-label="지난 달">‹</button><b>${y}년 ${m}월</b><button data-act="calMonth" data-n="1" aria-label="다음 달">›</button></div>
${R.range ? `<div class="rangebar">${svg('<path d="M4 7h16M4 12h16M4 17h10"/>', 16, 2)}<span>${R.range.end ? `${fmtShort(rng[0])} – ${fmtShort(rng[1])}` : `${fmtShort(R.range.start)}부터 — 끝 날짜를 눌러 주세요`}</span><button class="linkbtn" data-act="rangeCancel">취소</button></div>` : ''}
<div class="cgrid" id="cgrid">${'일월화수목금토'.split('').map((w, i) => `<span class="cw ${i === 0 ? 'sun' : ''}">${w}</span>`).join('')}
${cells.slice(0, weeks * 7).map(d => { const it = itemsOn(d); const out = d.slice(0, 7) !== R.month; const inR = rng && d >= rng[0] && d <= rng[1]; const s = schedFor(d); const mine = s && TURN_KEYS.some(([k]) => hasName(s[k], myName())); return `<button class="cday ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${d === R.day ? 'sel' : ''} ${parseD(d).getDay() === 0 ? 'sun' : ''} ${inR ? 'inrange' : ''}" data-act="calDay" data-id="${d}"><span class="dn">${parseD(d).getDate()}${mine ? '<i class="mydot" title="내 순서"></i>' : ''}</span><span class="dots">${it.slice(0, 4).map(x => `<i class="cdot ${x.kind}"></i>`).join('')}</span><span class="clab">${it.slice(0, 3).map(x => `<em class="${x.kind} ${x.span ? 'span' : ''}">${x.span && !x.first && parseD(d).getDay() !== 0 ? '&nbsp;' : esc(x.label)}</em>`).join('')}</span></button>`; }).join('')}</div>
<div class="legend"><span><i class="cdot sun"></i>주일</span><span><i class="cdot evt"></i>행사</span><span><i class="cdot meet"></i>회의·교육</span><span><i class="cdot away"></i>부재</span><span><i class="cdot bday"></i>생일</span><span><i class="mydot"></i>내 순서</span></div>
<div class="s2">${matchMedia('(pointer:fine)').matches ? '날짜를 끌어서 고르면 기간 일정을 바로 넣어요.' : '날짜를 길게 누른 뒤 끝 날짜를 누르면 기간 일정을 넣어요.'}</div></section>
<div class="calside"><section class="card"><div class="lbl"><span>${dd.getMonth() + 1}월 ${dd.getDate()}일 ${DOW[dd.getDay()]}요일</span><button class="linkbtn" data-act="eventNew">+ 일정</button></div>${day.filter(x => x.kind !== 'sun').length ? day.filter(x => x.kind !== 'sun').map(x => itemRow(x)).join('') : (schedFor(R.day) ? '' : '<div class="sub">일정이 없어요.</div>')}${schedFor(R.day) ? `<div class="mtop">${sundayCard(schedFor(R.day))}</div>` : ''}</section>
<section class="card"><div class="lbl"><span>다가오는 3주</span></div>${upcoming.length ? upcoming.slice(0, 12).map(x => itemRow(x, true)).join('') : '<div class="sub">다가오는 행사·생일이 없어요.</div>'}</section></div></div>`;
}
/* 끌어서 기간 고르기 (마우스) · 길게 눌러 고르기 (터치) */
const CD = { on: false };
appEl.addEventListener('pointerdown', e => {
  const c = e.target.closest('.cday'); if (!c || S.route !== 'room' || R.tab !== 'cal') return;
  if (e.pointerType === 'mouse') { Object.assign(CD, { on: true, mouse: true, start: c.dataset.id, end: c.dataset.id, moved: false }); }
  else { clearTimeout(CD.t); Object.assign(CD, { on: false, mouse: false, x: e.clientX, y: e.clientY, t: setTimeout(() => { R.range = { start: c.dataset.id }; S.skipClick = true; try { navigator.vibrate && navigator.vibrate(15); } catch { /* 없음 */ } paint(); }, 450) }); }
});
appEl.addEventListener('pointermove', e => {
  if (!CD.mouse && CD.t && (Math.abs(e.clientX - CD.x) > 10 || Math.abs(e.clientY - CD.y) > 10)) { clearTimeout(CD.t); CD.t = null; }
  if (!CD.on || !CD.mouse) return;
  const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest('.cday'); if (!c) return;
  if (c.dataset.id !== CD.end) { CD.end = c.dataset.id; CD.moved = CD.end !== CD.start; const [a, b] = [CD.start, CD.end].sort(); document.querySelectorAll('#cgrid .cday').forEach(x => x.classList.toggle('inrange', CD.moved && x.dataset.id >= a && x.dataset.id <= b)); }
});
appEl.addEventListener('pointerup', () => {
  clearTimeout(CD.t); CD.t = null;
  if (CD.on && CD.mouse && CD.moved) { const [a, b] = [CD.start, CD.end].sort(); S.skipClick = true; CD.on = false; eventSheet(null, { date: a, endDate: b }); return; }
  CD.on = false;
});
function calDayPick(id) {
  if (R.range && !R.range.end) { const [a, b] = [R.range.start, id].sort(); R.range = null; paint(); return eventSheet(null, { date: a, endDate: b === a ? '' : b }); }
  R.day = id; R.month = id.slice(0, 7); paint();
}

/* ================= v9 · 시간 · 주일 추가 · 캘린더 연동 ================= */

/* ---------- 시간 ---------- */
function timeText(e) {
  if (!e) return '';
  if (e.allDay || (!e.time && !e.endTime)) return '종일';
  return e.endTime ? `${e.time}–${e.endTime}` : e.time;
}
function gcalUrl(e) {
  const D = s => s.replace(/-/g, '');
  const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
  const tm = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? `${pad(m[1])}${m[2]}00` : ''; };
  let dates;
  if (e.allDay || !tm(e.time)) dates = `${D(e.date)}/${D(addDays(end, 1))}`;
  else {
    let et = tm(e.endTime);
    if (!et) { const h = Number(e.time.split(':')[0]) + 1; et = `${pad(Math.min(h, 23))}${e.time.split(':')[1]}00`; }
    dates = `${D(e.date)}T${tm(e.time)}/${D(end)}T${et}`;
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title || '', dates, details: (e.memo || '').slice(0, 500), location: e.place || '', ctz: 'Asia/Seoul' });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function itemsOn(d) {
  const out = [];
  const s = schedFor(d);
  if (s && !(s.noService && s.noServiceBy && (R.events || []).some(e => e.id === s.noServiceBy))) out.push({ d, kind: s.noService ? 'off' : 'sun', label: s.noService ? (s.noServiceNote || '조이코너 예배 없음') : (s.story || '주일 예배'), sub: s.noService ? '' : (s.preacher ? '설교 ' + s.preacher : '') });
  (R.notices || []).filter(n => n.eventDate === d).forEach(n => out.push({ d, kind: 'evt', label: n.title, sub: n.eventTime || '', notice: n.id }));
  (R.events || []).filter(e => { const [a, b] = evSpan(e); return a <= d && d <= b; }).forEach(e => { const [a, b] = evSpan(e); out.push({ d, kind: e.kind === '예배 없음' ? 'off' : (KIND_CLASS[e.kind] || 'evt'), label: e.title, sub: [a !== b ? `${fmtShort(a)}–${fmtShort(b)}` : '', timeText(e), e.place].filter(Boolean).join(' · '), event: e.id, span: a !== b, first: d === a }); });
  const md = d.slice(5);
  allKids().filter(k => (k.status || 'active') === 'active' && k.birth && k.birth.slice(5) === md).forEach(k => out.push({ d, kind: 'bday', label: k.name + ' 생일', sub: (S.classes[k.classId] || {}).name || '', kid: k.id }));
  S.staff.filter(st => st.birth && st.birth.slice(5) === md).forEach(st => out.push({ d, kind: 'bday', label: st.name + ' 선생님 생일', sub: '', staff: st.id }));
  return out;
}
const dayEvents = d => itemsOn(d).filter(x => x.notice || x.event);

/* ---------- 일정 넣기 (종일 / 몇 시부터 몇 시까지) ---------- */
async function eventSheet(id, preset) {
  const e = id ? R.events.find(x => x.id === id) : Object.assign({ title: '', date: R.day || ymd(new Date()), endDate: '', allDay: true, time: '', endTime: '', place: '', memo: '', kind: '행사', imgCount: 0 }, preset || {});
  if (!e) return;
  const allDay = e.allDay !== undefined ? e.allDay : !e.time;
  R.editEvent = id || null; R.editPreset = preset || null;
  pkInit('event', id ? await loadImgs('eventImages', id, e.imgCount) : [], 'photo');
  const kinds = ['행사', '회의', '교육', '부재', '기타'].concat(isAdminMe() ? ['예배 없음'] : []);
  sheet(`<div class="ttl" style="font-size:24px">${id ? '일정 고치기' : (e.kind === '부재' ? '부재 알리기' : '일정 추가')}</div>
<label class="fld">제목<input class="in" id="e2_title" value="${esc(e.title)}" placeholder="예: 교사 리트릿"></label>
<div class="fld">종류</div><div class="kindgrid">${kinds.map(k => `<label class="kindopt ${e.kind === k ? 'on' : ''}"><input type="radio" name="e2_kind" value="${k}" ${e.kind === k ? 'checked' : ''}><i class="cdot ${k === '예배 없음' ? 'off' : (KIND_CLASS[k] || 'evt')}"></i>${k}</label>`).join('')}</div>
<div class="s2" id="e2_offnote" ${e.kind === '예배 없음' ? '' : 'hidden'}>이 기간의 주일은 순서표와 예배 탭에 "조이코너 예배 없음"으로 함께 바뀌어요.</div>
<div class="timebox">
<div class="two"><label class="fld">시작 날짜<input class="in" type="date" id="e2_date" value="${esc(e.date)}"></label><label class="fld">끝 날짜 <span class="s2">(하루면 비워 두세요)</span><input class="in" type="date" id="e2_end" value="${esc(e.endDate || '')}"></label></div>
<label class="switch"><input type="checkbox" id="e2_allday" ${allDay ? 'checked' : ''}><span class="sw"></span><b>종일</b><span class="s2">시간 없이 하루 종일</span></label>
<div class="two" id="e2_times" ${allDay ? 'hidden' : ''}><label class="fld">시작 시간<input class="in" type="time" id="e2_time" value="${esc(e.time || '')}" step="300"></label><label class="fld">끝 시간<input class="in" type="time" id="e2_etime" value="${esc(e.endTime || '')}" step="300"></label></div>
<div class="quickt" id="e2_quick" ${allDay ? 'hidden' : ''}>${['09:00', '11:00', '12:00', '13:30', '15:00', '19:30'].map(t => `<button type="button" class="chip sm" data-act="quickTime" data-id="${t}">${t}</button>`).join('')}<span class="s2">시작 시간을 누르면 끝 시간은 1시간 뒤로 맞춰져요</span></div>
</div>
<label class="fld">장소<input class="in" id="e2_place" value="${esc(e.place || '')}"></label>
<label class="fld">메모<textarea id="e2_memo" style="min-height:70px">${esc(e.memo || '')}</textarea></label>
<div class="fld">사진 (최대 10장)</div>${pkHtml('event')}
<div class="sub" id="e2_msg"></div>
<div class="btns"><button class="pri" data-act="eventSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="eventDel">일정 지우기</button>' : ''}`);
  const box = $('#sheet');
  box.addEventListener('change', ev => {
    if (ev.target.id === 'e2_allday') { const on = ev.target.checked; $('#e2_times').hidden = on; $('#e2_quick').hidden = on; }
    if (ev.target.name === 'e2_kind') { box.querySelectorAll('.kindopt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); $('#e2_offnote').hidden = ev.target.value !== '예배 없음'; }
    if (ev.target.id === 'e2_time' && ev.target.value && !$('#e2_etime').value) $('#e2_etime').value = plusHour(ev.target.value);
  });
}
const plusHour = t => { const [h, m] = t.split(':').map(Number); return `${pad(Math.min(23, h + 1))}:${pad(m)}`; };
function sundaysIn(a, b) { const out = []; let d = parseD(a); const end = parseD(b || a); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); while (d <= end) { out.push(ymd(d)); d.setDate(d.getDate() + 7); } return out; }
async function linkNoService(eventId, oldEv, newEv) {
  const oldS = oldEv && oldEv.kind === '예배 없음' ? sundaysIn(...evSpan(oldEv)) : [];
  const newS = newEv && newEv.kind === '예배 없음' ? sundaysIn(...evSpan(newEv)) : [];
  const b = writeBatch(db); let n = 0;
  oldS.filter(d => !newS.includes(d)).forEach(d => { const s = schedFor(d); if (s && s.noServiceBy === eventId) { b.set(doc(db, 'schedule', d), { noService: false, noServiceBy: '', noServiceNote: '' }, { merge: true }); Object.assign(s, { noService: false, noServiceBy: '', noServiceNote: '' }); n++; } });
  newS.forEach(d => { const patch = { date: d, noService: true, noServiceBy: eventId, noServiceNote: newEv.title }; b.set(doc(db, 'schedule', d), patch, { merge: true }); const s = schedFor(d); if (s) Object.assign(s, patch); else { S.schedule.push({ id: d, ...patch }); S.schedule.sort((x, y) => ko(x.date, y.date)); } n++; });
  if (n) await b.commit();
  return newS.length;
}
async function eventSave() {
  if (PK.event && PK.event.busy) return toast('사진을 준비하고 있어요. 잠시만요');
  const id = R.editEvent, old = id ? { ...R.events.find(x => x.id === id) } : null, pre = R.editPreset || {};
  const title = val('e2_title'); if (!title) return toast('제목을 적어 주세요');
  const date = val('e2_date') || R.day; let endDate = val('e2_end'); if (endDate && endDate <= date) endDate = '';
  const allDay = $('#e2_allday').checked, time = allDay ? '' : val('e2_time'), endTime = allDay ? '' : val('e2_etime');
  if (!allDay && !time) return toast('시작 시간을 넣거나 "종일"을 켜 주세요');
  if (!allDay && endTime && !endDate && endTime <= time) return toast('끝 시간이 시작 시간보다 늦어야 해요');
  const kind = (document.querySelector('input[name=e2_kind]:checked') || {}).value || '행사';
  const ref = id ? doc(db, 'events', id) : doc(collection(db, 'events'));
  const data = { title, date, endDate, allDay, time, endTime, kind, place: val('e2_place'), memo: $('#e2_memo').value.trim(), staffId: old ? (old.staffId || '') : (pre.staffId || ''), imgCount: 0, by: old ? old.by : S.me.email, byName: old ? old.byName : myName() };
  const msg = $('#e2_msg'); msg.textContent = '저장 중…';
  try {
    data.imgCount = await pkSave('event', 'eventImages', ref.id, { eventId: ref.id }, old ? old.imgCount : 0);
    await setDoc(ref, data);
    const live = R.events.find(x => x.id === ref.id);
    if (live) Object.assign(live, data); else R.events.push({ id: ref.id, ...data });
    let linked = 0;
    if (isAdminMe() && (kind === '예배 없음' || (old && old.kind === '예배 없음'))) linked = await linkNoService(ref.id, old, data);
    R.day = data.date; R.month = data.date.slice(0, 7);
    closeSheet(); toast(linked ? `저장했어요 · 주일 ${linked}번을 "예배 없음"으로 바꿨어요` : '저장했어요');
    if (S.route === 'event' && S.arg === ref.id) paint(); else if (S.route === 'staff' || (S.route === 'room' && R.tab === 'cal')) paint(); else go('event/' + ref.id);
  } catch (err) { msg.textContent = ''; toast('저장하지 못했어요: ' + errMsg(err)); }
}
async function eventDel() {
  const id = R.editEvent, e = R.events.find(x => x.id === id); if (!e) return;
  try {
    for (let i = 0; i < (e.imgCount || 0); i++) await deleteDoc(doc(db, 'eventImages', `${id}_${i}`)).catch(() => { });
    if (e.kind === '예배 없음' && isAdminMe()) await linkNoService(id, e, null);
    await deleteDoc(doc(db, 'events', id)); R.events = R.events.filter(x => x.id !== id); closeSheet(); toast('지웠어요');
    if (S.route === 'event') { R.tab = 'cal'; go('room'); } else paint();
  } catch (err) { toast('지우지 못했어요: ' + errMsg(err)); }
}

/* ---------- 순서표에 주일 더하기 ---------- */
function sundaysOfYear(y, m) {
  const out = []; const d = new Date(Number(y), m ? m - 1 : 0, 1); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  while (d.getFullYear() === Number(y) && (!m || d.getMonth() === m - 1)) { out.push(ymd(d)); d.setDate(d.getDate() + 7); }
  return out;
}
async function fillSundays(dates) {
  const miss = dates.filter(d => !schedFor(d)); if (!miss.length) return toast('이미 다 있어요');
  try {
    for (let i = 0; i < miss.length; i += 400) { const b = writeBatch(db); miss.slice(i, i + 400).forEach(d => b.set(doc(db, 'schedule', d), { date: d }, { merge: true })); await b.commit(); }
    miss.forEach(d => S.schedule.push({ id: d, date: d })); S.schedule.sort((a, b) => ko(a.date, b.date));
    toast(`주일 ${miss.length}번을 만들었어요. 카드의 연필을 눌러 채워 주세요`); paint();
  } catch (e) { toast('만들지 못했어요: ' + errMsg(e)); }
}
function turnAddSheet() {
  let d = nextSunday(); while (schedFor(d)) d = addDays(d, 7);
  sheet(`<div class="ttl" style="font-size:24px">일정표에 날짜 더하기</div>
<div class="sub">보통은 주일이에요. 특별 예배처럼 다른 날도 넣을 수 있어요.</div>
<label class="fld">날짜<input class="in" type="date" id="ta_date" value="${d}"></label>
<div class="btns"><button class="pri" data-act="turnAddGo">담당 넣기</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
function turnTools(Y) {
  if (!isAdminMe()) return '';
  const miss = sundaysOfYear(Y).filter(d => !schedFor(d)).length;
  return `<div class="toolbar full"><button class="sec sm2" data-act="turnAdd">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.2)} 날짜 더하기</button>${miss ? `<button class="ghost sm2" data-act="turnFill" data-id="${Y}">${Y}년 빈 주일 ${miss}번 만들기</button>` : ''}</div>`;
}
function sundayEventsHtml(d) {
  const ev = dayEvents(d); if (!ev.length) return '';
  return `<div class="evchips">${ev.map(x => `<button class="evchip ${x.kind}" ${itemAct(x)}><i class="cdot ${x.kind}"></i>${esc(x.label)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

/* ---------- 클릭 처리 ---------- */
const ACT = {
  login: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') toast('로그인하지 못했어요: ' + (e.code || e.message)); } },
  logout: async () => { await signOut(auth); },
  reload: () => location.reload(),
  go: d => go(d.to),
  back: () => { if (S.route === 'kid') go('friends'); else go('home'); },
  cls: d => { S.cur = d.id; lsSet('jc_cur', d.id); route(); },
  toggle: d => toggleKid(d.id),
  allIn: () => { const c = S.cur, d = S.attDate; const m = ((S.att[c] ||= {})[d] ||= {}); const patch = {}; activeKids(c).forEach(k => { m[k.id] = 'p'; patch[k.id] = 'p'; }); paint(); writeMarks(patch); },
  clearAsk: () => sheet(`<div class="ttl" style="font-size:22px">출석을 모두 지울까요?</div><div class="sub">이 주일의 체크가 전부 사라져요.</div><div class="btns"><button class="pri" data-act="clearYes">네, 지울게요</button><button class="sec" data-act="sheetClose">아니요</button></div>`),
  clearYes: () => { const c = S.cur, d = S.attDate; const m = (S.att[c] ||= {}); const patch = {}; Object.keys(m[d] || {}).forEach(id => { patch[id] = deleteField(); }); m[d] = {}; closeSheet(); paint(); if (Object.keys(patch).length) writeMarks(patch); },
  week: d => { const nd = addDays(S.attDate, Number(d.n)); if (nd > ymd(sundayOnOrBefore(new Date()))) return; S.attDate = nd; route(); },
  kid: d => go('kid/' + d.id),
  editKid: editKidSheet, saveKid,
  photo: d => pickPhoto(S.arg, d.slot), cropSave: () => S.cropSave(),
  sheetClose: closeSheet,
  addKid: addKidSheet, addKidSave,
  noteAdd: addNote,
  noteDel: async d => { try { await deleteDoc(doc(db, 'careNotes', d.id)); S.kidData.notes = S.kidData.notes.filter(x => x.id !== d.id); paint(); } catch { toast('지우지 못했어요'); } },
  showArch: () => { S.showArchived = true; paint(); },
  staff: d => staffSheet(d.id), saveStaff,
  delStaffAsk: () => { const st = S.staff.find(x => x.id === S.editStaff); sheet(`<div class="ttl" style="font-size:22px">${esc(st?.name || '')} 선생님을 명단에서 뺄까요?</div><div class="sub">구글 계정이 연결되어 있었다면 로그인도 막혀요.</div><div class="btns"><button class="pri" data-act="delStaff">네, 뺄게요</button><button class="sec" data-act="sheetClose">아니요</button></div>`); },
  delStaff,
  runImport, importYes: () => { S.importOk = true; closeSheet(); runImport(); },
  csv: d => downloadCsv(d.id),
  wtab: d => { W.tab = d.id; paint(); }, wweek: async d => { W.date = addDays(W.date, Number(d.n)); paint(); await loadSongs(W.date); paint(); },
  wgo: async d => { W.date = d.id; W.tab = 'sermon'; paint(); await loadSongs(W.date); paint(); },
  schedEdit: () => schedSheet(W.date), schedSave,
  sermonNew: () => sermonSheet(null), sermonEdit: d => sermonSheet(d.id), sermonSave, sermonDel, sermonStatus,
  cmAdd: d => addComment(d.id, d.t), cmDel: d => delComment(d.id, d.p),
  slSave, songNew: () => songSheet(null), songEdit: d => songSheet(d.id), songSave, songDel, songPlay: d => songPlay(d.id), songMove: d => songMove(d.id, Number(d.n)),
  dutyEdit: d => dutySheet(d.id), dutySave, dutyDel,
  rtab: d => { if (d.id === 'stats') return go('stats'); R.tab = d.id; if (S.route === 'room') paint(); else go('room'); },
  noticeNew: () => noticeSheet(null), noticeOpen: d => go('notice/' + d.id), noticeEdit: d => noticeSheet(d.id), noticeSave, noticeDel,
  calMonth: d => { const [y, m] = R.month.split('-').map(Number); const n = new Date(y, m - 1 + Number(d.n), 1); R.month = `${n.getFullYear()}-${pad(n.getMonth() + 1)}`; paint(); },
  calDay: d => calDayPick(d.id), rangeCancel: () => { R.range = null; paint(); },
  turnYear: d => { R.turnYear = d.id; paint(); },
  turnAdd: turnAddSheet, turnAddGo: () => { const d = val('ta_date'); if (!d) return toast('날짜를 골라 주세요'); closeSheet(); schedSheet(d); },
  turnFill: d => fillSundays(sundaysOfYear(d.id)), turnFillM: d => { const [y, m] = d.id.split('-'); fillSundays(sundaysOfYear(y, Number(m))); },
  quickTime: d => { const t = $('#e2_time'), e = $('#e2_etime'); if (t) t.value = d.id; if (e) e.value = plusHour(d.id); },
  calGo: d => { R.tab = 'cal'; R.day = d.id; R.month = d.id.slice(0, 7); go('room'); },
  eventNew: () => eventSheet(null), eventEdit: d => eventSheet(d.id), eventSave, eventDel,
  dutyView: d => { R.dutyView = d.id; paint(); },
  changelog: changelogSheet,
  pkMove: d => pkMove(d.id, Number(d.i), Number(d.n)), pkDel: d => pkDel(d.id, Number(d.i)),
  galOpen: d => openViewer(Array.from({ length: Number(d.n) }, (_, i) => ({ coll: d.c, key: `${d.b}_${i}`, label: d.t, sub: '' })), Number(d.i)),
  eventOpen: d => go('event/' + d.id), calBack: () => { R.tab = 'cal'; go('room'); },
  wgoWeek: async d => { W.date = d.id; W.tab = 'week'; go('worship'); await loadSongs(W.date); paint(); },
  staffOpen: d => go('staff/' + d.id), staffEdit: d => staffEditSheet(d.id), staffEditSave,
  awayNew: d => { const st = S.staff.find(x => x.id === d.id); eventSheet(null, { title: `${st.name} 부재`, kind: '부재', staffId: st.id, date: nextSunday() }); },
  snAdd: d => snAdd(d.id), snDel: d => snDel(d.id, d.s),
  dutyOpen: d => { R.open[d.id] = !R.open[d.id]; paint(); },
  spTog: d => spTog(d.id, d.n), spNew: d => spNew(d.id, false), spText: d => spNew(d.id, true),
  schedEditDate: d => schedSheet(d.id), turnCat: d => { R.turnCat = d.id; paint(); }, turnRange: d => { R.turnRange = d.id; paint(); },
  usageDays: d => { R.us.days = Number(d.id); R.us.rows = null; paint(); }, usageReload: () => { R.us.rows = null; paint(); },
  backup: d => runBackup(d.id === '1'),
  promoTog: d => { PROMO.keep[d.id] = PROMO.keep[d.id] === false; paint(); },
  promoAsk: () => sheet(`<div class="ttl" style="font-size:22px">${PROMO.year}년 반 올리기를 할까요?</div><div class="sub">빨간 테두리 친구들이 한 학년씩 올라가고, 7세반은 졸업으로 바뀌어요. 백업을 먼저 받아 두셨나요?</div><div class="btns"><button class="pri" data-act="promoRun">네, 올릴게요</button><button class="sec" data-act="sheetClose">아니요</button></div>`),
  promoRun,
  helpGo: d => go('help/' + d.id), helpHome: () => go('help'), helpDev: d => { S.helpDev = d.id; paint(); },
  installNow: async () => { if (!S.bip) return; S.bip.prompt(); try { await S.bip.userChoice; } catch { /* 없음 */ } S.bip = null; paint(); },
  welcomeOff: () => { lsSet('jc_welcome_off', '1'); paint(); },
  back2: () => { if (history.length > 1) history.back(); else go('room'); },
  noteKind: d => { S.noteKind = S.noteKind === d.id ? '' : d.id; document.querySelectorAll('.kindbtn').forEach(b => b.classList.toggle('on', b.dataset.id === S.noteKind)); }
};
appEl.addEventListener('click', e => {
  if (S.skipClick) { S.skipClick = false; return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  const fn = ACT[t.dataset.act]; if (fn) { if (ACT_NAME[t.dataset.act]) usageAct(t.dataset.act); fn(t.dataset, t); }
});
appEl.addEventListener('toggle', e => {
  const d = e.target; if (!d.dataset || !d.dataset.dr) return;
  if (d.dataset.dr === 'count') R.openCount = d.open; else { R.openM = R.openM || {}; R.openM[d.dataset.dr] = d.open; }
}, true);
appEl.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.pk) { pkAdd(t.dataset.pk, t.files); t.value = ''; }
  if (t.id === 'impFile') { const n = document.getElementById('impName'); if (n) n.textContent = t.files[0] ? t.files[0].name : '파일 고르기'; }
});
appEl.addEventListener('input', e => {
  if (e.target.id === 'hq') { const q = e.target.value.trim(); document.querySelectorAll('#htiles .htile').forEach(b => b.classList.toggle('hide', !!q && !b.dataset.k.includes(q))); return; }
  if (e.target.id !== 'q') return;
  const q = e.target.value.trim();
  document.querySelectorAll('#klist .row').forEach(r => r.classList.toggle('hide', !!q && !r.dataset.name.includes(q)));
});

/* ---------- 시작 ---------- */
async function start(user) {
  S.user = user;
  if (!user) { S.phase = 'login'; return route(); }
  S.phase = 'boot'; paint();
  const email = user.email.toLowerCase();
  try {
    let snap = await getDoc(doc(db, 'teachers', email));
    if (!snap.exists() && email === OWNER_EMAIL.toLowerCase()) {
      await setDoc(doc(db, 'teachers', email), { name: user.displayName || '', role: 'admin', classes: [] });
      snap = await getDoc(doc(db, 'teachers', email));
    }
    if (!snap.exists()) { S.phase = 'pending'; return route(); }
    S.me = { email, ...snap.data() };
    if (S.me.role === 'director') { S.me.director = true; S.me.role = 'admin'; }
    if (email === OWNER_EMAIL.toLowerCase()) { S.me.role = 'admin'; S.me.owner = true; }
    await loadAll();
    S.phase = 'ready'; route(); checkVersion();
  } catch (e) {
    S.phase = 'pending'; route(); toast('불러오지 못했어요: ' + (e.code || e.message));
  }
}
if (!configured) { S.phase = 'setup'; paint(); }
else onAuthStateChanged(auth, start);
