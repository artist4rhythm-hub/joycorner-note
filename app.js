// 조이코너 노트 — 교사 전용 아이 돌봄 앱 (GitHub Pages + Firebase)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
  query, where, onSnapshot, writeBatch, serverTimestamp
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
  kidFor: null, kidData: null, staff: [], editStaff: null, importOk: false, showArchived: false, lastKey: ''
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
const roleLabel = st => st.role === 'director' ? '디렉터' : st.role === 'admin' ? '관리자' : '교사';
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
  if (k.thumb) return `<img class="ph" src="${k.thumb}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
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
function nav(active) {
  const t = (k, ic, label) => `<button class="tab ${active === k ? 'on' : ''}" data-act="go" data-to="${k}">${svg(ICON[ic])}${label}</button>`;
  return `<nav class="nav" aria-label="메뉴">${t('home', 'home', '홈')}${t('attend', 'att', '출석')}${t('friends', 'kids', '친구들')}${t('worship', 'music', '예배')}${t('stats', 'stats', '통계')}</nav>`;
}
const noClass = () => `<div class="center"><div class="big">아직 반이 없어요</div><div class="sub">${S.me.role === 'admin' ? '설정에서 시트 데이터를 가져오거나 교사를 등록해 주세요.' : '관리자에게 맡을 반을 정해 달라고 말해 주세요.'}</div>${S.me.role === 'admin' ? `<button class="cta" style="max-width:280px" data-act="go" data-to="settings">설정 열기</button>` : ''}</div>`;

/* ---------- 로그인/대기 ---------- */
function vLogin() {
  return `<div class="center"><img src="icon.svg" alt="" width="96" height="96" style="border-radius:28px"><div class="hello">조이코너 노트</div><div class="sub">우리 친구들을 기억하고 돌보는<br>선생님 전용 앱이에요</div><button class="cta" style="max-width:300px" data-act="login">구글로 로그인</button></div>`;
}
const vSetup = () => `<div class="center"><div class="big">설정이 아직 안 끝났어요</div><div class="sub">firebase-config.js 파일에 파이어베이스 설정 값을 붙여넣어 주세요.<br>(안내서 2단계)</div></div>`;
const vPending = () => `<div class="center"><div class="big">아직 등록되지 않았어요</div><div class="sub">${esc(S.user.email)}<br>이 이메일을 관리자에게 알려 주세요.<br>등록되면 바로 들어올 수 있어요.</div><button class="sec" data-act="logout">다른 계정으로 로그인</button><button class="ghost" data-act="reload">다시 확인하기</button></div>`;

/* ---------- 홈 ---------- */
function vHome() {
  const c = S.cur; const name = S.me.name || S.user.displayName || '';
  const header = `<header class="hd"><div><div class="hello">안녕하세요, ${esc(name)} 선생님!</div><div class="sub">${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${DOW[new Date().getDay()]}요일</div></div><button class="iconbtn" data-act="go" data-to="settings" aria-label="설정">${svg(ICON.gear)}</button></header>`;
  if (!c) return `<div class="scroll">${header}${noClass()}</div>`;
  const cl = S.classes[c], kids = activeKids(c), faces = kids.slice(0, 3);
  const todayStr = ymd(new Date());
  const nextS = S.schedule.find(x => x.date >= todayStr && !x.noService) || S.schedule[S.schedule.length - 1];
  const diff = nextS ? Math.round((parseD(nextS.date) - parseD(todayStr)) / 86400000) : 99;
  const care = careList(c).slice(0, 6), bdays = upcomingBirthdays(c).slice(0, 4);
  return `<div class="scroll">${header}${classChips()}
<section class="card"><div class="rowtop"><div style="display:flex;padding-left:10px">${faces.map(k => `<span style="margin-left:-10px;border:3px solid #fff;border-radius:50%;display:block;line-height:0">${avatar(k, 46)}</span>`).join('')}</div><div><div class="big">${esc(cl.name)}</div><div class="sub">친구 ${kids.length}명</div></div></div>
<div class="chips">${(() => { const cs = classStaff(c); const h = cs.homeroom.map(n => `<span class="chip">담임 ${esc(n)}</span>`).join('') + cs.assistants.map(n => `<span class="chip">${esc(n)}</span>`).join(''); return h || (S.me.role === 'admin' ? `<button class="chip dashed" data-act="go" data-to="settings">+ 교사 명단에서 정해 주세요</button>` : '<span class="chip">담임 미정</span>'); })()}</div>
<button class="cta" data-act="go" data-to="attend">${svg(ICON.checkc, 28, 2.4)}출석 시작하기</button></section>
${nextS ? `<section class="card"><div class="lbl"><span>${diff <= 7 ? '이번 주일' : '다음 주일'} · ${fmtMD(nextS.date)}</span></div><div class="big">${esc(nextS.story || (nextS.noService ? '조이코너 예배 없음' : '이야기 준비 중'))}</div><div class="meta">${nextS.preacher ? `<span>설교 ${esc(nextS.preacher)}</span>` : ''}${nextS.offering ? `<span>헌금기도 ${esc(nextS.offering)} 가정</span>` : ''}${nextS.pray ? `<span>중보기도 ${esc(nextS.pray)}</span>` : ''}</div></section>` : ''}
${(() => { const me = S.me.name || ''; if (!me || !nextS) return ''; const L = { preacher: '성경이야기 설교', pray: '중보기도 인도', nation: '성전건축·나라 기도', chant: '챈트', dance: '율동', guitar: '기타·메트로놈' }; const m = Object.entries(L).filter(([k]) => hasName(nextS[k], me)).map(([, l]) => l); return m.length ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>${fmtMD(nextS.date)} 내 담당</span></div><div class="chips">${m.map(x => `<span class="chip">${x}</span>`).join('')}</div><button class="ghost" data-act="go" data-to="worship">주일 예배 보기</button></section>` : ''; })()}
<section class="card"><div class="lbl"><span>돌봄이 필요해요</span></div>${care.length ? `<div class="carerow">${care.map(x => `<button class="carekid" data-act="kid" data-id="${x.k.id}">${avatar(x.k, 56)}<b>${esc(x.k.name)}</b><span class="tag">${x.n >= 2 ? x.n + '주 결석' : '장기결석'}</span></button>`).join('')}</div>` : `<div class="sub">지금은 걱정되는 친구가 없어요. 감사해요!</div>`}</section>
<section class="card"><div class="lbl"><span>곧 생일이에요</span></div>${bdays.length ? bdays.map(x => `<div class="bday"><span class="d">${x.label}</span><span>${esc(x.k.name)}${x.days === 0 ? ' · 오늘!' : ''}</span></div>`).join('') : `<div class="sub">45일 안에 생일인 친구가 없어요.</div>`}</section>
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
<button class="addkid" data-act="addKid">+ 새로 온 친구 등록</button></div>${nav('attend')}`;
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
<div class="list" id="klist">${kids.map(row).join('')}</div>
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
  return `<div class="scroll"><div class="hd"><button class="back" data-act="back">← 친구들</button><button class="sec" data-act="editKid" style="min-height:44px">고치기</button></div>
<div class="rowtop"><div><div class="ttl">${esc(k.name)}</div><div class="sub">${esc(S.classes[c]?.name || '')} · ${k.birth ? k.birth.replace(/-/g, '.') + ' 생' : '생일 모름'}</div></div></div>
<div class="chips">${n >= 2 ? `<span class="tag">${n}주째 결석</span>` : ''}${(k.flags || []).map(f => `<span class="tag g">${esc(f)}</span>`).join('')}${k.remark ? `<span class="chip sm">${esc(k.remark)}</span>` : ''}</div>
${k.note ? `<div class="note">${esc(k.note)}</div>` : ''}
<div class="photos">${slot('main', 'main', '대표')}${slot('1', '', '추가1')}${slot('2', '', '추가2')}</div>
<section class="card"><div class="lbl"><span>최근 출석</span></div>${ds.length ? `<div class="dots">${ds.map(d => { const v = S.att[c][d][k.id] === 'p' ? 'p' : 'a'; const dd = parseD(d); return `<div class="dot"><i class="${(k.since && d < k.since) ? '' : v}"></i>${dd.getMonth() + 1}/${dd.getDate()}</div>`; }).join('')}</div><div class="sub">초록은 왔어요, 분홍은 못 왔어요</div>` : `<div class="sub">아직 출석 기록이 없어요.</div>`}</section>
<section class="card"><div class="lbl"><span>가정</span></div>${fam ? `${p('f', fam.father, fam.fatherCell, fam.fatherTel, '아버지')}${p('m', fam.mother, fam.motherCell, fam.motherTel, '어머니')}${(fam.siblings || []).length ? `<div class="chips">${fam.siblings.map(s => `<span class="chip sm">${esc(s.name)}${s.org ? ' · ' + esc(s.org) : ''}</span>`).join('')}</div>` : ''}${(!fam.father && !fam.mother) ? '<div class="sub">부모님 정보가 아직 없어요. 고치기에서 적어 주세요.</div>' : ''}` : `<div class="sub">불러오는 중…</div>`}</section>
<section class="card"><div class="lbl"><span>돌봄 기록</span></div>
<textarea id="noteText" placeholder="심방, 통화, 기도제목, 아이의 변화 등을 적어 주세요"></textarea>
<button class="sec" data-act="noteAdd">기록 남기기</button>
${(kd?.notes || []).map(x => `<div class="note"><span style="white-space:pre-wrap">${esc(x.text)}</span><small><span>${esc(x.date || '')} · ${esc(x.byName || '')}</span>${(x.by === S.me.email || S.me.role === 'admin') ? `<button data-act="noteDel" data-id="${x.id}">지우기</button>` : ''}</small></div>`).join('')}</section></div>${nav('friends')}`;
}

/* ---------- 통계 ---------- */
function classAvg(c, w = 4) {
  const kids = activeKids(c).length, ds = recorded(c).slice(-w);
  if (!kids || !ds.length) return null;
  return ds.reduce((s, d) => s + presentCount(c, d), 0) / ds.length / kids;
}
function vStats() {
  const c = S.cur; if (!c) return `<div class="scroll">${noClass()}</div>${nav('stats')}`;
  const kids = activeKids(c), total = kids.length, ds = recorded(c).slice(-8);
  const counts = ds.map(d => presentCount(c, d));
  const now = new Date(), mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const mds = recorded(c).filter(d => d.startsWith(mk));
  const useDs = mds.length ? mds : recorded(c).slice(-4);
  const avgN = useDs.length ? useDs.reduce((s, d) => s + presentCount(c, d), 0) / useDs.length : 0;
  const avgP = total && useDs.length ? Math.round(avgN / total * 100) : null;
  const care = careList(c).filter(x => x.n >= 2);
  const low = kids.map(k => ({ k, r: kidRate(c, k) })).filter(x => x.r !== null).sort((a, b) => a.r - b.r).slice(0, 5);
  return `<div class="scroll"><div class="ttl">출석 통계</div>${classChips()}
<section class="card"><div class="lbl"><span>${esc(S.classes[c].name)} 최근 ${ds.length}주 출석</span></div>${ds.length ? `<div class="chart">${counts.map((n, i) => `<div class="col"><b>${n}</b><i class="${i === counts.length - 1 ? 'cur' : ''}" style="height:${Math.max(4, Math.round(n / Math.max(total, 1) * 100))}px"></i></div>`).join('')}</div><div class="axis">${ds.map(d => { const x = parseD(d); return `<span>${x.getMonth() + 1}/${x.getDate()}</span>`; }).join('')}</div>` : `<div class="sub">출석을 기록하면 여기에 그래프가 나와요.</div>`}</section>
<div class="twoc"><section class="card"><div class="lbl"><span>${mds.length ? '이번 달 평균' : '최근 4주 평균'}</span></div><div class="bigp">${avgP ?? '-'}<small>%</small></div><div class="s2">${total}명 중 평균 ${Math.round(avgN)}명</div></section>
<section class="card"><div class="lbl"><span>돌봄 신호</span></div><div class="bigp">${care.length}<small>명</small></div><div class="s2">2주 이상 연속 결석</div></section></div>
${low.length ? `<section class="card"><div class="lbl"><span>출석이 적은 친구 (최근 8주)</span></div>${low.map(x => `<button class="hb" style="border:0;background:none;padding:6px 0;cursor:pointer;min-height:44px" data-act="kid" data-id="${x.k.id}"><span class="nm w">${esc(x.k.name)}</span><div class="tr"><i style="width:${Math.round(x.r * 100)}%"></i></div><span class="pc">${Math.round(x.r * 100)}%</span></button>`).join('')}</section>` : ''}
${S.myClasses.length > 1 ? `<section class="card"><div class="lbl"><span>반별 비교 (최근 4주 평균)</span></div>${S.myClasses.map(k => { const a = classAvg(k); return `<div class="hb"><span class="nm">${esc(S.classes[k].name)}</span><div class="tr"><i style="width:${a === null ? 0 : Math.round(a * 100)}%"></i></div><span class="pc">${a === null ? '-' : Math.round(a * 100) + '%'}</span></div>`; }).join('')}</section>` : ''}
<div class="s2">* 비율은 지금 함께하는 친구 수를 기준으로 계산해요.</div></div>${nav('stats')}`;
}

/* ---------- 설정 ---------- */
function vSettings() {
  const admin = S.me.role === 'admin';
  return `<div class="scroll"><div class="hd"><button class="back" data-act="back">← 홈</button></div><div class="ttl">설정</div>
<section class="card"><div class="lbl"><span>내 정보</span></div><div class="big" style="font-size:22px">${esc(S.me.name || S.user.displayName || '')}</div><div class="sub">${esc(S.user.email)} · ${S.me.owner ? '수퍼관리자' : S.me.director ? '디렉터' : admin ? '관리자' : '교사'}</div><button class="sec" data-act="logout">로그아웃</button></section>
${admin ? `
${vStaffList()}
<section class="card"><div class="lbl"><span>시트 데이터 가져오기</span></div><div class="sub">처음에는 joycorner-import.json(전체), 업무 분담·설교 참고만 더할 때는 joycorner-extra.json을 골라 주세요. extra 파일은 아이 정보를 건드리지 않아요.</div><input type="file" id="impFile" accept="application/json,.json" class="in"><div class="pbar hide" id="impBar"><i></i></div><div class="sub" id="impMsg"></div><button class="sec" data-act="runImport">가져오기 시작</button></section>
<section class="card"><div class="lbl"><span>출석 기록 내려받기</span></div><div class="sub">엑셀로 열 수 있는 파일(CSV)이에요. 백업용으로 좋아요.</div><div class="btns" style="flex-wrap:wrap">${S.myClasses.map(c => `<button class="ghost" data-act="csv" data-id="${c}">${esc(S.classes[c].name)}</button>`).join('')}</div></section>` : ''}
<div class="s2" style="text-align:center">조이코너 노트 · 아이들의 얼굴과 정보는 로그인한 선생님에게만 보여요</div></div>${nav('home')}`;
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
  const free = S.staff.filter(x => !(x.classes || []).length && x.role !== 'director');
  return `<section class="card"><div class="lbl"><span>교사 명단</span><span class="s2">구글 연결 ${linked}/${total}</span></div>
<div class="sub">명단을 먼저 만들어 두고, 구글 계정은 나중에 연결하면 돼요. 연결 전에는 수퍼관리자·디렉터·관리자가 모든 내용을 고쳐요. 디렉터는 수퍼관리자가, 관리자는 수퍼관리자와 디렉터가 정해요.</div>
${dirs.length ? `<div class="lbl" style="margin-top:6px">디렉터 (조이코너 전체 관리)</div><div class="list">${dirs.map(x => row(x)).join('')}</div>` : ''}${groups}${free.length ? `<div class="lbl" style="margin-top:6px">반 없음</div><div class="list">${free.map(x => row(x)).join('')}</div>` : ''}
${total ? '' : '<div class="sub">아직 명단이 없어요. 시트 데이터를 가져오면 15명이 들어와요.</div>'}
<button class="sec" data-act="staff">+ 교사 추가</button></section>`;
}

/* ---------- 그리기 ---------- */
const VIEWS = { home: vHome, attend: vAttend, friends: vFriends, kid: vKid, stats: vStats, settings: vSettings, worship: vWorship };
function paint() {
  if (S.phase === 'setup') { appEl.innerHTML = vSetup(); return; }
  if (S.phase === 'boot') { appEl.innerHTML = '<div class="center"><div class="sub">불러오는 중…</div></div>'; return; }
  if (S.phase === 'login') { appEl.innerHTML = vLogin(); return; }
  if (S.phase === 'pending') { appEl.innerHTML = vPending(); return; }
  const sc = $('.scroll'), top = sc ? sc.scrollTop : 0, key = S.route + (S.arg || '') + S.cur;
  const sheetEl = $('#sheet');
  appEl.innerHTML = (VIEWS[S.route] || vHome)();
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
  if (S.route === 'worship') loadWorship().then(() => { if (S.route === 'worship') paint(); });
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
  const n = { childId: k.id, classId: k.classId, text, date: ymd(new Date()), by: S.me.email, byName: S.me.name || S.user.displayName || '' };
  try { await setDoc(ref, { ...n, createdAt: serverTimestamp() }); S.kidData.notes.unshift({ id: ref.id, ...n }); paint(); toast('기록을 남겼어요'); } catch (e) { toast('저장하지 못했어요'); }
}

/* ---------- 관리자 기능 ---------- */
function staffSheet(id) {
  const st = id ? S.staff.find(x => x.id === id) : { name: '', role: 'teacher', classes: [], classRole: {}, duties: [], email: '' };
  if (!st) return;
  if (id && !canEditStaff(st)) return toast(st.role === 'director' ? '디렉터 정보는 수퍼관리자만 고칠 수 있어요' : '관리자 정보는 수퍼관리자와 디렉터만 고칠 수 있어요');
  S.editStaff = id || null;
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  sheet(`<div class="ttl" style="font-size:24px">${id ? esc(st.name) + ' 선생님' : '교사 추가'}</div>
<label class="fld">이름<input class="in" id="s_name" value="${esc(st.name)}"></label>
<label class="fld">권한<select class="in" id="s_role" ${canManageRoles() ? '' : 'disabled'}><option value="teacher" ${!['admin', 'director'].includes(st.role) ? 'selected' : ''}>교사 (맡은 반만)</option><option value="admin" ${st.role === 'admin' ? 'selected' : ''}>관리자 (전체 내용 수정)</option>${S.me.owner || st.role === 'director' ? `<option value="director" ${st.role === 'director' ? 'selected' : ''}>디렉터 (조이코너 전체 관리 장)</option>` : ''}</select></label>
<div class="s2">${S.me.owner ? '디렉터는 조이코너 전체를 맡고, 관리자도 지정할 수 있어요.' : canManageRoles() ? '관리자까지 정할 수 있어요. 디렉터는 수퍼관리자가 정해요.' : '권한은 수퍼관리자와 디렉터가 정해요.'}</div>
<div class="fld">맡은 반</div>${cls.map(c => `<div class="two" style="align-items:center"><span style="font-family:Jua,sans-serif;font-size:18px">${esc(c.name)}</span><select class="in" id="s_cr_${c.id}"><option value="">맡지 않음</option><option value="담임" ${(st.classRole || {})[c.id] === '담임' ? 'selected' : ''}>담임</option><option value="보조" ${(st.classRole || {})[c.id] === '보조' ? 'selected' : ''}>보조</option></select></div>`).join('') || '<div class="s2">반은 데이터를 가져오면 생겨요.</div>'}
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
  const data = { name, role, classes, classRole, duties, email, order: old.order ?? (Math.max(0, ...S.staff.map(x => x.order || 0)) + 1) };
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
  if (!data.children && !data.duties && !data.staff) return toast('조이코너 가져오기 파일이 아니에요');
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
  const tabs = [['week', '이번 주'], ['sermon', '설교'], ['songs', '악보'], ['duty', '업무 분담']];
  const ready = Array.isArray(W.sermons) && Array.isArray(W.duties) && Array.isArray(W.stories) && W.songs[d];
  const head = `<div class="ttl">주일 예배</div>
<div class="seg">${tabs.map(([k, l]) => `<button class="${W.tab === k ? 'on' : ''}" data-act="wtab" data-id="${k}">${l}</button>`).join('')}</div>
${W.tab === 'duty' ? '' : `<div class="weekbar"><button data-act="wweek" data-n="-7" aria-label="지난 주">◀</button><b>${dd.getFullYear() !== new Date().getFullYear() ? dd.getFullYear() + '년 ' : ''}${dd.getMonth() + 1}월 ${dd.getDate()}일 주일${d === nextSunday() ? ' · 이번 주' : ''}</b><button data-act="wweek" data-n="7" aria-label="다음 주">▶</button></div>`}`;
  let body = '<div class="sub">불러오는 중…</div>';
  if (ready) body = W.tab === 'week' ? wWeek(d) : W.tab === 'sermon' ? wSermon(d) : W.tab === 'songs' ? wSongs(d) : wDuty();
  return `<div class="scroll">${head}${body}</div>${nav('worship')}`;
}

/* 이번 주 */
function wWeek(d) {
  const s = schedFor(d) || {}, me = myName();
  const rows = [['성경이야기', s.story], ['설교', s.preacher], ['중보기도 인도', s.pray], ['성전건축·나라 기도', s.nation], ['챈트', [s.chant, s.verse].filter(Boolean).join(' · ')], ['율동', s.dance], ['기타·메트로놈', s.guitar], ['헌금기도', s.offering ? s.offering + ' 가정' : '']];
  const sermons = W.sermons.filter(x => x.date === d), songs = W.songs[d] || [];
  return `${s.noService ? '<div class="note">이 주일은 조이코너 예배가 없어요</div>' : ''}
<section class="card"><div class="lbl"><span>이번 주 담당</span>${isAdminMe() ? '<button class="linkbtn" data-act="schedEdit">고치기</button>' : ''}</div>
${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b class="${hasName(v, me) ? 'mine' : ''}">${esc(v || '-')}</b></div>`).join('')}</section>
<div class="twoc"><button class="card tapcard" data-act="wtab" data-id="sermon"><div class="lbl"><span>설교</span></div><div class="big" style="font-size:20px">${sermons.length ? statusLabel(sermons[0].status) : '아직 없음'}</div><div class="s2">${sermons.length ? esc(sermons[0].authorName || '') + ' 선생님' : '올리기 →'}</div></button>
<button class="card tapcard" data-act="wtab" data-id="songs"><div class="lbl"><span>악보</span></div><div class="big" style="font-size:20px">${songs.length}곡</div><div class="s2">${songs.length ? '보기 →' : '올리기 →'}</div></button></div>`;
}
function schedSheet() {
  const d = W.date, s = schedFor(d) || {};
  const f = (id, label, v, ph = '') => `<label class="fld">${label}<input class="in" id="sc_${id}" value="${esc(v || '')}" placeholder="${ph}"></label>`;
  sheet(`<div class="ttl" style="font-size:24px">${fmtMD(d)} 담당 고치기</div>
${f('story', '성경이야기 제목', s.story)}${f('preacher', '설교', s.preacher)}
<div class="two">${f('pray', '중보기도 인도', s.pray)}${f('nation', '성전건축·나라 기도', s.nation)}</div>
<div class="two">${f('chant', '챈트 담당', s.chant, '쉼표로 구분')}${f('verse', '챈트 말씀', s.verse, '예: 시 84:11')}</div>
<div class="two">${f('dance', '율동', s.dance)}${f('guitar', '기타·메트로놈', s.guitar)}</div>
${f('offering', '헌금기도 (아이 이름)', s.offering)}
<label class="chk"><input type="checkbox" id="sc_no" ${s.noService ? 'checked' : ''}>이 주일은 조이코너 예배 없음</label>
<div class="btns"><button class="pri" data-act="schedSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
async function schedSave() {
  const d = W.date; const data = { date: d, noService: $('#sc_no').checked };
  ['story', 'preacher', 'pray', 'nation', 'chant', 'verse', 'dance', 'guitar', 'offering'].forEach(k => { data[k] = val('sc_' + k); });
  try {
    await setDoc(doc(db, 'schedule', d), data, { merge: true });
    const i = S.schedule.findIndex(x => x.date === d);
    if (i >= 0) Object.assign(S.schedule[i], data); else { S.schedule.push({ id: d, ...data }); S.schedule.sort((a, b) => ko(a.date, b.date)); }
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}

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
async function addComment(postId) {
  const el = document.getElementById('cm_' + postId), text = (el?.value || '').trim(); if (!text) return toast('댓글을 적어 주세요');
  const ref = doc(collection(db, 'comments'));
  const role = S.me.owner ? '' : S.me.director ? '디렉터' : '';
  const c = { postId, postType: 'sermon', text, by: S.me.email, byName: myName(), role, at: new Date().toISOString() };
  try { await setDoc(ref, c); (W.comments[postId] ||= []).push({ id: ref.id, ...c }); paint(); } catch (e) { toast('댓글을 달지 못했어요: ' + errMsg(e)); }
}
async function delComment(id, postId) {
  try { await deleteDoc(doc(db, 'comments', id)); W.comments[postId] = (W.comments[postId] || []).filter(x => x.id !== id); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* 악보 */
function wSongs(d) {
  const list = W.songs[d] || [], sl = W.setlist[d] || {};
  return `<section class="card"><div class="lbl"><span>이번 주 악보 ${list.length}곡</span></div>
${list.length ? `<div class="list">${list.map((g, i) => `<div class="songrow"><button class="row" data-act="songView" data-id="${g.id}"><span class="num2">${i + 1}</span><span class="grow"><span class="nm" style="font-size:18px">${esc(g.title)}</span><span class="sub">${[g.key ? '키 ' + g.key : '', g.pages ? `악보 ${g.pages}장` : '사진 없음', g.memo ? g.memo.split('\n')[0] : ''].filter(Boolean).map(esc).join(' · ')}</span></span></button><div class="mv"><button data-act="songMove" data-id="${g.id}" data-n="-1" aria-label="위로" ${i === 0 ? 'disabled' : ''}>▲</button><button data-act="songMove" data-id="${g.id}" data-n="1" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></div></div>`).join('')}</div>` : '<div class="sub">아직 올라온 악보가 없어요. 보통 6~10곡을 올려요.</div>'}
<button class="cta" data-act="songNew">+ 곡 추가</button></section>
<section class="card"><div class="lbl"><span>예배 순서 · 기록</span></div><textarea id="sl_memo" style="min-height:120px" placeholder="예: 여는 찬양 → 기도 → 챈트 → 율동 찬양 → 성경이야기 → 헌금 → 광고">${esc(sl.memo || '')}</textarea><button class="sec" data-act="slSave">기록 저장</button>${sl.byName ? `<div class="s2">마지막 저장 · ${esc(sl.byName)}</div>` : ''}</section>`;
}
async function slSave() {
  const d = W.date, memo = $('#sl_memo').value;
  try { const data = { date: d, memo, by: S.me.email, byName: myName(), at: new Date().toISOString() }; await setDoc(doc(db, 'setlists', d), data); W.setlist[d] = data; toast('기록을 저장했어요'); paint(); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
function songSheet(id) {
  const list = W.songs[W.date] || [], sg = id ? list.find(x => x.id === id) : { title: '', key: '', memo: '', link: '' };
  if (!sg) return;
  W.editSong = id || null;
  sheet(`<div class="ttl" style="font-size:24px">${id ? '곡 고치기' : '곡 추가'} · ${fmtMD(W.date)}</div>
<label class="fld">곡 제목<input class="in" id="g_title" value="${esc(sg.title)}"></label>
<div class="two"><label class="fld">키<input class="in" id="g_key" value="${esc(sg.key || '')}" placeholder="예: G"></label><label class="fld">링크 (영상·PDF)<input class="in" id="g_link" value="${esc(sg.link || '')}" placeholder="https://"></label></div>
<label class="fld">메모 (반복, 율동, 엔딩 등)<textarea id="g_memo" style="min-height:60px">${esc(sg.memo || '')}</textarea></label>
<label class="fld">악보 사진 ${id && sg.pages ? `(지금 ${sg.pages}장 · 새로 고르면 바뀌어요)` : '(여러 장 고를 수 있어요)'}<input class="in" type="file" id="g_files" accept="image/*" multiple></label>
<div class="sub" id="g_msg"></div>
<div class="btns"><button class="pri" data-act="songSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="songDel">곡 지우기</button>' : ''}`);
}
async function compressScore(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let max = 1600, q = 0.8, url = '';
  for (let i = 0; i < 7; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q);
    if (url.length < 900000) return url;
    max = Math.round(max * 0.85); q = Math.max(0.5, q - 0.06);
  }
  return url;
}
async function songSave() {
  const id = W.editSong, d = W.date, list = W.songs[d] || (W.songs[d] = []);
  const title = val('g_title'); if (!title) return toast('곡 제목을 적어 주세요');
  const files = [...($('#g_files')?.files || [])].slice(0, 6);
  const ref = id ? doc(db, 'songs', id) : doc(collection(db, 'songs'));
  const old = id ? list.find(x => x.id === id) : null;
  const data = { date: d, title, key: val('g_key'), link: val('g_link'), memo: $('#g_memo').value.trim(), order: old ? old.order : (list.length ? Math.max(...list.map(x => x.order || 0)) + 1 : 1), pages: old ? (old.pages || 0) : 0, by: old?.by || S.me.email, byName: old?.byName || myName() };
  const msg = $('#g_msg');
  try {
    if (files.length) {
      for (let i = 0; i < files.length; i++) {
        msg.textContent = `악보 올리는 중… ${i + 1}/${files.length}`;
        const url = await compressScore(files[i]);
        await setDoc(doc(db, 'scorePages', `${ref.id}_${i}`), { songId: ref.id, date: d, n: i, data: url });
        W.pages[`${ref.id}_${i}`] = url;
      }
      for (let i = files.length; i < (old?.pages || 0); i++) { await deleteDoc(doc(db, 'scorePages', `${ref.id}_${i}`)).catch(() => { }); delete W.pages[`${ref.id}_${i}`]; }
      data.pages = files.length;
    }
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
async function songMove(id, dir) {
  const list = W.songs[W.date] || [], i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const changed = [];
  list.forEach((g, k) => { if (g.order !== k + 1) { g.order = k + 1; changed.push(g); } });
  paint();
  try { const b = writeBatch(db); changed.forEach(g => b.update(doc(db, 'songs', g.id), { order: g.order })); await b.commit(); } catch (e) { toast('순서를 저장하지 못했어요: ' + errMsg(e)); }
}
async function songView(id) {
  const sg = (W.songs[W.date] || []).find(x => x.id === id); if (!sg) return;
  const n = sg.pages || 0, idx = (W.songs[W.date] || []).indexOf(sg) + 1;
  sheet(`<div class="hd"><div class="ttl" style="font-size:24px">${idx}. ${esc(sg.title)}</div><button class="sec" data-act="sheetClose" style="min-height:44px">닫기</button></div>
${sg.key ? `<div class="chips"><span class="chip">키 ${esc(sg.key)}</span></div>` : ''}${sg.memo ? `<div class="note" style="white-space:pre-wrap">${linkify(sg.memo)}</div>` : ''}${sg.link ? `<div class="post">${linkify(sg.link)}</div>` : ''}
${n ? Array.from({ length: n }, (_, i) => `<img class="score" id="pg_${i}" alt="${esc(sg.title)} 악보 ${i + 1}쪽" ${W.pages[id + '_' + i] ? `src="${W.pages[id + '_' + i]}"` : ''}>`).join('') : '<div class="sub">악보 사진이 없어요.</div>'}
<div class="s2">두 손가락으로 벌리면 크게 볼 수 있어요.</div>
<button class="ghost" data-act="songEdit" data-id="${id}">고치기</button>`);
  for (let i = 0; i < n; i++) {
    const k = id + '_' + i;
    if (!W.pages[k]) { try { const s = await getDoc(doc(db, 'scorePages', k)); if (s.exists()) W.pages[k] = s.data().data; } catch { /* 없음 */ } }
    const el = document.getElementById('pg_' + i); if (el && W.pages[k]) el.src = W.pages[k];
  }
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
function dutySheet(id) {
  if (!isAdminMe()) return;
  const x = id ? W.duties.find(y => y.id === id) : { section: '예배 시', area: '', role: '', desc: '', people: [], note: '' };
  if (!x) return;
  W.editDuty = id || null;
  sheet(`<div class="ttl" style="font-size:24px">${id ? '역할 고치기' : '역할 추가'}</div>
<div class="two"><label class="fld">언제<select class="in" id="u_sec">${['예배 전', '예배 시', '예배 후'].map(s => `<option ${x.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fld">구분<input class="in" id="u_area" value="${esc(x.area)}" placeholder="예: 환영"></label></div>
<label class="fld">역할<input class="in" id="u_role" value="${esc(x.role)}" placeholder="예: 입장 (이름표)"></label>
<label class="fld">하는 일<textarea id="u_desc">${esc(x.desc || '')}</textarea></label>
<label class="fld">담당 (쉼표로 구분)<input class="in" id="u_people" value="${esc((x.people || []).join(', '))}"></label>
<label class="fld">비고<textarea id="u_note" style="min-height:60px">${esc(x.note || '')}</textarea></label>
<div class="btns"><button class="pri" data-act="dutySave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="dutyDel">역할 지우기</button>' : ''}`);
}
async function dutySave() {
  const id = W.editDuty, old = id ? W.duties.find(y => y.id === id) : null;
  const role = val('u_role'); if (!role) return toast('역할을 적어 주세요');
  const data = { section: val('u_sec'), area: val('u_area') || role, role, desc: $('#u_desc').value.trim(), people: val('u_people').split(',').map(x => x.trim()).filter(Boolean), note: $('#u_note').value.trim(), order: old ? old.order : Math.max(0, ...W.duties.map(y => y.order || 0)) + 1 };
  const ref = id ? doc(db, 'duties', id) : doc(collection(db, 'duties'));
  try { await setDoc(ref, data); if (old) Object.assign(old, data); else W.duties.push({ id: ref.id, ...data }); W.duties.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); closeSheet(); toast('저장했어요'); paint(); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
async function dutyDel() {
  const id = W.editDuty;
  try { await deleteDoc(doc(db, 'duties', id)); W.duties = W.duties.filter(y => y.id !== id); closeSheet(); toast('지웠어요'); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
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
  schedEdit: schedSheet, schedSave,
  sermonNew: () => sermonSheet(null), sermonEdit: d => sermonSheet(d.id), sermonSave, sermonDel, sermonStatus,
  cmAdd: d => addComment(d.id), cmDel: d => delComment(d.id, d.p),
  slSave, songNew: () => songSheet(null), songEdit: d => songSheet(d.id), songSave, songDel, songView: d => songView(d.id), songMove: d => songMove(d.id, Number(d.n)),
  dutyEdit: d => dutySheet(d.id), dutySave, dutyDel
};
appEl.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const fn = ACT[t.dataset.act]; if (fn) fn(t.dataset, t);
});
appEl.addEventListener('input', e => {
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
    S.phase = 'ready'; route();
  } catch (e) {
    S.phase = 'pending'; route(); toast('불러오지 못했어요: ' + (e.code || e.message));
  }
}
if (!configured) { S.phase = 'setup'; paint(); }
else onAuthStateChanged(auth, start);
