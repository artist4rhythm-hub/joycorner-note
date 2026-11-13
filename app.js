// 조이코너 노트 — 교사 전용 아이 돌봄 앱 (GitHub Pages + Firebase)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocs, getDocFromCache, getDocsFromCache, setDoc, updateDoc, deleteDoc, deleteField,
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
  .filter(x => x.n >= 2)
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
  let downOnBg = false;
  bg.addEventListener('pointerdown', e => { downOnBg = e.target === bg; });
  bg.addEventListener('input', () => { bg.dataset.dirty = '1'; });
  bg.addEventListener('click', e => {
    if (e.target !== bg || !downOnBg) return;            // 글을 끌어 고르다 밖에서 손을 뗀 경우는 닫지 않아요
    if (bg.dataset.dirty) { const sh = bg.querySelector('.sheet'); sh.classList.remove('nudge'); void sh.offsetWidth; sh.classList.add('nudge'); toast('쓰던 내용이 있어요 · 닫으려면 [취소]를 눌러 주세요'); return; }
    closeSheet();
  });
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
  return `<nav class="nav" aria-label="메뉴"><div class="brand"><img src="icons/icon-192.png" alt="조이코너" width="52" height="52"><small class="railv">${APP_VERSION}</small></div>${t('home', 'home', '홈')}${t('attend', 'att', '출석')}${t('friends', 'kids', '친구들')}${t('worship', 'music', '예배')}${t('room', 'room', '교사실')}<button class="tab deskonly ${active === 'help' ? 'on' : ''}" data-act="go" data-to="help">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>')}<span>도우미</span></button></nav>`;
}
const noClass = () => `<div class="center"><div class="big">아직 반이 없어요</div><div class="sub">${S.me.role === 'admin' ? '설정에서 시트 데이터를 가져오거나 교사를 등록해 주세요.' : '관리자에게 맡을 반을 정해 달라고 말해 주세요.'}</div>${S.me.role === 'admin' ? `<button class="cta" style="max-width:280px" data-act="go" data-to="settings">설정 열기</button>` : ''}</div>`;

/* ---------- 로그인/대기 ---------- */
function vLogin() {
  return `<div class="center"><img src="logo-dark.png" alt="JOY 조이코너" class="loginlogo"><div class="hello" style="font-size:22px">교사 노트</div><div class="sub">우리 친구들을 기억하고 돌보는<br>선생님 전용 앱이에요</div><button class="cta" style="max-width:300px" data-act="login">구글로 로그인</button></div>`;
}
const vSetup = () => `<div class="center"><div class="big">설정이 아직 안 끝났어요</div><div class="sub">firebase-config.js 파일에 파이어베이스 설정 값을 붙여넣어 주세요.<br>(안내서 2단계)</div></div>`;
const vPending = () => `<div class="center"><div class="big">아직 등록되지 않았어요</div><div class="sub">${esc(S.user.email)}<br>이 이메일을 관리자에게 알려 주세요.<br>등록되면 바로 들어올 수 있어요.</div><button class="sec" data-act="logout">다른 계정으로 로그인</button><button class="ghost" data-act="reload">다시 확인하기</button></div>`;

/* ---------- 홈 ---------- */
function homeHeader() {
  const name = S.me.name || S.user.displayName || '';
  return `<header class="hd"><div><div class="hello">안녕하세요, ${esc(name)} 선생님!</div><div class="sub">${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${DOW[new Date().getDay()]}요일 <button class="vpill" data-act="changelog" aria-label="업데이트 기록">${APP_VERSION}</button></div></div><div class="btns"><button class="iconbtn" data-act="go" data-to="help" aria-label="도우미">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>')}</button><button class="iconbtn" data-act="go" data-to="settings" aria-label="설정">${svg(ICON.gear)}</button></div></header>${welcomeLine()}`;
}
function vHomeClass() {
  const c = S.cur;
  const header = homeHeader();
  if (!c) return `<div class="scroll">${header}${noClass()}${versionCard()}</div>`;
  const cl = S.classes[c], kids = activeKids(c), faces = kids.slice(0, 3);
  const todayStr = ymd(new Date());
  const nextS = S.schedule.find(x => x.date >= todayStr && !x.noService) || S.schedule[S.schedule.length - 1];
  const diff = nextS ? Math.round((parseD(nextS.date) - parseD(todayStr)) / 86400000) : 99;
  const care = careList(c).slice(0, 6), bdays = upcomingBirthdays(c).slice(0, 4);
  return `<div class="scroll cols">${header}${homeModeSeg()}${iosOtherNote()}${holBanner()}${gcalBanner()}${classChips()}
<section class="card"><div class="rowtop"><div style="display:flex;padding-left:10px">${faces.map(k => `<span style="margin-left:-10px;border:3px solid #fff;border-radius:50%;display:block;line-height:0">${avatar(k, 46)}</span>`).join('')}</div><div><div class="big">${esc(cl.name)}</div><div class="sub">친구 ${kids.length}명</div></div></div>
<div class="chips">${(() => { const cs = classStaff(c); const h = cs.homeroom.map(n => `<span class="chip">담임 ${esc(n)}</span>`).join('') + cs.assistants.map(n => `<span class="chip">${esc(n)}</span>`).join(''); return h || (S.me.role === 'admin' ? `<button class="chip dashed" data-act="go" data-to="settings">+ 교사 명단에서 정해 주세요</button>` : '<span class="chip">담임 미정</span>'); })()}</div>
<button class="cta" data-act="go" data-to="attend">${svg(ICON.checkc, 28, 2.4)}출석 시작하기</button></section>
${nextS ? `<section class="card"><div class="lbl"><span>${diff <= 7 ? '이번 주일' : '다음 주일'} · ${fmtMD(nextS.date)}</span></div><div class="big">${esc(nextS.story || (nextS.noService ? '조이코너 예배 없음' : '이야기 준비 중'))}</div><div class="meta">${nextS.preacher ? `<span>설교 ${esc(nextS.preacher)}</span>` : ''}${nextS.offering ? `<span>헌금기도 ${esc(nextS.offering)} 가정</span>` : ''}${nextS.pray ? `<span>중보기도 ${esc(nextS.pray)}</span>` : ''}</div></section>` : ''}
${(() => { const me = S.me.name || ''; if (!me || !nextS) return ''; const L = { preacher: '성경이야기 설교', pray: '중보기도 인도', nation: '성전건축·나라 기도', chant: '챈트', dance: '율동', guitar: '기타·메트로놈' }; const m = Object.entries(L).filter(([k]) => hasName(nextS[k], me)).map(([, l]) => l); return m.length ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>${fmtMD(nextS.date)} 내 담당</span></div><div class="chips">${m.map(x => `<span class="chip">${x}</span>`).join('')}</div><button class="ghost" data-act="go" data-to="worship">주일 예배 보기</button></section>` : ''; })()}
<section class="card"><div class="lbl"><span>돌봄이 필요해요</span></div>${care.length ? `<div class="carerow">${care.map(x => `<button class="carekid" data-act="kid" data-id="${x.k.id}">${avatar(x.k, 56)}<b>${esc(x.k.name)}</b>${absTag(x.n)}</button>`).join('')}</div>` : `<div class="sub">지금은 걱정되는 친구가 없어요. 감사해요!</div>`}</section>
<section class="card"><div class="lbl"><span>곧 생일이에요</span></div>${bdays.length ? bdays.map(x => `<div class="bday"><span class="d">${x.label}</span><span>${esc(x.k.name)}${x.days === 0 ? ' · 오늘!' : ''}</span></div>`).join('') : `<div class="sub">45일 안에 생일인 친구가 없어요.</div>`}</section>

${homeNoticeCard()}${homeEventsCard()}<section class="card homedock"><div class="lbl"><span>교사실 바로 가기</span></div>${roomDock('')}</section>${versionCard()}
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
<div class="row2"><div class="bar"><div class="fill" style="width:${pct}%"></div></div><span class="save ${S.pending ? 'wait' : ''}">${S.pending ? '대기 중' : '저장됨'}</span>${attLocked() ? `<button class="lockpill" data-act="attLockInfo">${svg(LOCK_IC, 18, 2.2)}마감됨</button>` : `<button class="pri sm" data-act="allIn">${svg(ICON.checkc, 20, 2.4)}전원 출석</button>`}</div></div>
<div class="scroll" style="padding-top:8px">${classChips()}
<div class="story">${sch ? (sch.noService ? '이 주일은 조이코너 예배가 없어요' : '오늘의 이야기 · ' + esc(sch.story || '')) : ''}${S.pending ? ' · 인터넷이 연결되면 저절로 올라가요' : ''}</div>
${attLockBar(n, kids.length)}
<div class="grid ${attLocked() ? 'locked' : ''}">${kids.map(k => { const on = marks[k.id] === 'p'; return `<button class="kid ${on ? 'on' : ''} ${k.gender ? 'g-' + k.gender : ''}" data-act="toggle" data-id="${k.id}" aria-pressed="${on}"><span class="stamp">${svg(ICON.check, 18, 3)}</span><span class="kav">${avatar(k, 84)}</span><b class="nm">${esc(k.name)}${genderMark(k)}</b><span class="st">${on ? '왔어요' : '아직'}</span></button>`; }).join('')}</div>
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
    if (snap.exists()) { const x = snap.data(); (S.att[c] ||= {})[d] = x.marks || {}; ATTL.meta[want] = { locked: x.locked, lockedBy: x.lockedBy || '', lockedByName: x.lockedByName || '', lockedAt: x.lockedAt || '' }; }
    else ATTL.meta[want] = {};
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
  if (attLocked()) return attLockedToast();
  const c = S.cur, d = S.attDate; const marks = ((S.att[c] ||= {})[d] ||= {});
  const on = marks[id] === 'p'; if (on) delete marks[id]; else marks[id] = 'p';
  paint(); writeMarks({ [id]: on ? deleteField() : 'p' });
  const k = findKid(id); attLog(on ? 'off' : 'on', { kid: id, kidName: k ? k.name : '' });
  if (on) undoBar(`${k ? k.name : ''} 출석을 취소했어요`, () => { if (attLocked()) return; marks[id] = 'p'; paint(); writeMarks({ [id]: 'p' }); attLog('on', { kid: id, kidName: k ? k.name : '', undo: true }); });
}

/* ---------- 친구들 ---------- */
function vFriends() {
  const c = S.cur; if (!c) return `<div class="scroll">${noClass()}</div>${nav('friends')}`;
  const kids = activeKids(c), arch = (S.kids[c] || []).filter(k => (k.status || 'active') !== 'active').sort((a, b) => ko(a.name, b.name));
  const row = k => {
    const n = streak(c, k);
    return `<button class="row" data-act="kid" data-id="${k.id}" data-name="${esc(k.name)}">${avatar(k, 48)}<span class="grow"><span class="nm">${esc(k.name)}</span><span class="sub">${k.birth ? k.birth.replace(/-/g, '.') + ' 생' : '생일 모름'}</span></span><span class="tagbox">${absTag(n)}${kidTags(k)}</span></button>`;
  };
  const noG = activeKids(c).filter(k => !k.gender).length;
  return `<div class="scroll"><div class="ttl">친구들</div>${classChips()}${noG ? `<button class="gnote" data-act="gBulk">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 18, 1.9)}<span>남자 · 여자 아직 모르는 친구 <b>${noG}명</b></span><span class="chev">정하기 ›</span></button>` : ''}
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
    return src ? `<div class="slot has ${cls}"><button class="sview" data-act="kidZoom" data-slot="${s}" aria-label="${label} 사진 크게 보기" style="--bg:url('${src}')"><img src="${src}" alt="${esc(k.name)} ${label}"></button><button class="plus" data-act="photo" data-slot="${s}" aria-label="${label} 사진 바꾸기">+</button></div>` : `<button class="slot ${cls}" data-act="photo" data-slot="${s}" aria-label="${label} 사진 넣기">사진 넣기<span class="plus">+</span></button>`;
  };
  const ds = recorded(c).slice(-8);
  const p = (who, nm, cell, tel, role) => nm ? `<div class="person"><div><b>${esc(nm)}</b> <span class="sub">${role}</span>${cell ? `<div class="cell">${esc(/^\d?[A-Za-z]?\d+$/.test(cell) ? '셀 ' + cell : cell)}</div>` : ''}</div>${tel ? `<div class="contact"><a href="tel:${esc(tel)}">전화</a><a href="sms:${esc(tel)}">문자</a></div>` : ''}</div>` : '';
  const n = streak(c, k);
  return `<div class="scroll cols"><div class="hd"><button class="back" data-act="back">← 친구들</button><button class="sec" data-act="editKid" style="min-height:44px">고치기</button></div>
<div class="rowtop"><div><div class="ttl">${esc(k.name)}</div><div class="sub">${esc(S.classes[c]?.name || '')} · ${k.birth ? k.birth.replace(/-/g, '.') + ' 생' : '생일 모름'}</div></div></div>
<div class="chips gchips">${genderChip(k)}${absTag(n, true)}${kidTags(k)}<button class="tagedit" data-act="tagSheet">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 14, 2)}표시 고치기</button></div>
${k.remark && !TAG_AUTO.includes(k.remark) && !(k.flags || []).includes(k.remark) ? `<div class="note sm">메모 · ${esc(k.remark)}</div>` : ''}
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
function vStatsOld() {
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
  return `<div class="scroll cols"><div class="ttl">교사실</div>${roomTabs('stats')}${countsCard()}${classChips()}
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
<section class="card"><div class="lbl"><span>자료 내려받기</span><span class="s2">PDF · 엑셀</span></div><div class="sub">아이 명단 · 출석부 · 교사 명단 · 업무 분담 · 순서표 · 일정 · 주일 인원 · 찬양을 종류별로 받아요.${S.me.role === 'admin' ? ' 연간 일정 엑셀 일괄 입력도 여기서 해요.' : ''}</div><button class="sec" data-act="go" data-to="export">자료 내려받기 열기</button></section>
${gcalCard()}
${admin ? `
${gcalSettingsCard()}
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
  const row = (st, c) => `<button class="row" data-act="staff" data-id="${st.id}"><span class="grow"><span class="nm">${esc(st.name)}${c ? ` <span class="tag ${(st.classRole || {})[c] === '담임' ? '' : 'g'}">${esc((st.classRole || {})[c] || '보조')}</span>` : ''}${st.role === 'admin' || st.role === 'director' ? ` <span class="tag">${roleLabel(st)}</span>` : ''}</span><span class="sub">${esc((Array.isArray(W.duties) ? dutiesOf(st.name).map(x => x.role) : (st.duties || [])).join(' · ') || '맡은 역할 없음')}</span></span><span class="chip sm" style="${st.email ? 'background:#DDF1E3;color:#1E6B3E' : ''}">${st.email ? '구글 연결됨' : '연결 전'}</span></button>`;
  const cls = Object.values(S.classes).sort((a, b) => a.age - b.age);
  const groups = cls.map(cl => {
    const l = S.staff.filter(x => (x.classes || []).includes(cl.id)).sort((a, b) => ((a.classRole || {})[cl.id] === '담임' ? 0 : 1) - ((b.classRole || {})[cl.id] === '담임' ? 0 : 1));
    return l.length ? `<div class="lbl" style="margin-top:6px">${esc(cl.name)}</div><div class="list">${l.map(x => row(x, cl.id)).join('')}</div>` : '';
  }).join('');
  const dirs = S.staff.filter(x => x.role === 'director');
  const helpers = S.staff.filter(x => x.kind === 'helper');
  const free = S.staff.filter(x => !(x.classes || []).length && x.role !== 'director' && x.kind !== 'helper');
  if (!Array.isArray(W.duties)) loadDuties().then(() => softPaint());
  return `<section class="card"><div class="lbl"><span>교사 명단</span><span class="s2">구글 연결 ${linked}/${total}</span></div>
<div class="sub">명단을 먼저 만들어 두고, 구글 계정은 나중에 연결하면 돼요. 연결 전에는 수퍼관리자·디렉터·시스템 관리자가 내용을 고쳐요. 디렉터는 수퍼관리자가, 시스템 관리자는 디렉터가 정해요.</div>
${dirs.length ? `<div class="lbl" style="margin-top:6px">디렉터 (조이코너 전체 관리)</div><div class="list">${dirs.map(x => row(x)).join('')}</div>` : ''}${groups}${free.length ? `<div class="lbl" style="margin-top:6px">반 없음</div><div class="list">${free.map(x => row(x)).join('')}</div>` : ''}${helpers.length ? `<div class="lbl" style="margin-top:6px">헬퍼 선생님 풀 · 필요할 때 요청 (일일 · 외부)</div><div class="list">${helpers.map(x => row(x)).join('')}</div>` : ''}
${total ? '' : '<div class="sub">아직 명단이 없어요. 시트 데이터를 가져오면 15명이 들어와요.</div>'}
${leftDrawer()}<button class="sec" data-act="staff">+ 교사 추가</button></section>`;
}

/* ---------- 그리기 ---------- */
const VIEWS = { home: vHome, attend: vAttend, friends: vFriends, kid: vKid, stats: vStats, settings: vSettings, worship: vWorship, room: vRoom, notice: vNotice, event: vEvent, staff: vStaff, help: vHelp, usage: vUsage, promote: vPromote };
function paint() {
  if (S.phase === 'setup') { appEl.innerHTML = vSetup(); return; }
  if (S.phase === 'boot') { appEl.innerHTML = '<div class="center boot"><img src="logo-dark.png" alt="" width="96" height="96"><div class="sub">조이코너 노트를 여는 중…</div></div>'; return; }
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
  emAfter(key);
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
  if (['home', 'attend', 'friends', 'stats'].includes(S.route) && S.cur) ensureAtt(S.cur);
  if (S.route === 'home' && HM.mode === 'all') S.myClasses.forEach(c => ensureAtt(c));
  if (S.route === 'kid') { const k = findKid(S.arg); if (k) ensureAtt(k.classId); }
  if (['room', 'notice', 'home', 'event', 'staff'].includes(S.route)) { const was = Array.isArray(R.events) && Array.isArray(R.notices); loadRoom().then(() => { if (!was && ['room', 'notice', 'home', 'event', 'staff'].includes(S.route)) softPaint(); }); }
  if (S.route === 'settings' || S.route === 'room') loadCfg().then(c => { if (c.gcalClientId) loadGIS().catch(() => { }); });
  if (S.route === 'room' || S.route === 'settings') gcalLoad().then(() => softPaint());
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
<div class="fld">성별</div><div class="seg gseg">${[['m', '남자 아이'], ['f', '여자 아이'], ['', '모름']].map(([v, l]) => `<button type="button" class="${(k.gender || '') === v ? 'on' : ''}" data-act="gsel" data-id="${v}">${l}</button>`).join('')}</div><input type="hidden" id="e_gender" value="${esc(k.gender || '')}">
<label class="fld">메모<input class="in" id="e_remark" value="${esc(k.remark || '')}" placeholder="예: 알레르기, 좋아하는 것"></label>

<div class="two"><label class="fld">아버지<input class="in" id="e_fn" value="${esc(f.father || '')}"></label><label class="fld">아버지 연락처<input class="in" id="e_ft" type="tel" value="${esc(f.fatherTel || '')}"></label></div>
<div class="two"><label class="fld">어머니<input class="in" id="e_mn" value="${esc(f.mother || '')}"></label><label class="fld">어머니 연락처<input class="in" id="e_mt" type="tel" value="${esc(f.motherTel || '')}"></label></div>
<div class="two"><label class="fld">아버지 셀<input class="in" id="e_fc" value="${esc(f.fatherCell || '')}"></label><label class="fld">어머니 셀<input class="in" id="e_mc" value="${esc(f.motherCell || '')}"></label></div>
${admin ? `<div class="two"><label class="fld">반<select class="in" id="e_cls">${Object.values(S.classes).sort((a, b) => a.age - b.age).map(c => `<option value="${c.id}" ${c.id === k.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="fld">상태<select class="in" id="e_status">${[['active', '함께해요'], ['graduated', '졸업했어요'], ['moved', '이사/이동했어요'], ['paused', '쉬고 있어요']].map(([v, l]) => `<option value="${v}" ${(k.status || 'active') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>` : ''}
<div class="btns"><button class="pri" data-act="saveKid">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
}
async function saveKid() {
  const k = findKid(S.arg), name = val('e_name'); if (!name) return toast('이름을 적어 주세요');
  const flags = (k.flags || []).filter(x => !TAG_AUTO.includes(x));
  const patch = { name, birth: val('e_birth'), remark: val('e_remark'), flags, gender: val('e_gender') };
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
${id ? '<button class="ghost danger" data-act="staffLeaveAsk">그만두신 선생님으로 옮기기</button>' : ''}`);
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
  if (data.kind === 'kakao') return runKakaoImport(data);
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
  return `<div class="scroll cols">${head}${body}</div>${nav('worship')}`;
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
${matCard(d)}
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
${secs.map(sec => { const l = list.filter(x => (x.section || '예배 시') === sec); if (!l.length) return ''; return `<div class="ttl" style="font-size:20px;margin-top:4px">${sec}</div>${l.map(x => `<div class="card duty"><div class="lbl"><span>${esc(x.area)}${x.area !== x.role ? ' · ' + esc(x.role) : ''}</span><span class="lr">${(x.people || []).length ? '' : '<span class="tag">담당 필요</span>'}${admin ? `<button class="editbtn" data-act="dutyEdit" data-id="${x.id}" aria-label="${esc(x.role)} 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18, 1.8)}</button>` : ''}</span></div><div style="font-size:14px">${esc(x.desc || '')}</div>${(x.people || []).length ? `<div class="chips">${x.people.map(n => `<span class="chip sm ${n === me ? 'mine' : ''}">${esc(n)}</span>`).join('')}</div>` : ''}${x.note ? `<div class="s2" style="white-space:pre-wrap">※ ${esc(x.note)}</div>` : ''}</div>`).join('')}`; }).join('')}
${admin ? '<button class="sec" data-act="dutyEdit">+ 역할 추가</button>' : ''}
${list.length ? '' : '<div class="sub">업무 분담이 아직 없어요. 설정에서 joycorner-extra.json을 가져와 주세요.</div>'}`;
}
async function dutyDel() {
  const id = W.editDuty;
  try { await deleteDoc(doc(db, 'duties', id)); W.duties = W.duties.filter(y => y.id !== id); closeSheet(); toast('지웠어요'); paint(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 교사실 (공지 · 캘린더 · 업무 분담 · 조직도 · 통계) ---------- */
const APP_VERSION = 'v27';
const APP_DATE = '2026-11-12';
const CHANGELOG = [
  { v: 'v27', date: '11월 13일', items: ['캘린더 화면의 달력이 작은 상자로 줄어들던 문제 고침 (v26 홈의 날짜 칸 이름이 달력과 겹쳤어요)'] },
  { v: 'v26', date: '11월 13일', items: ['홈 [전체 한눈에]를 그림으로 — 출석률 링 · 최근 8주 반별 막대 · 파스텔 숫자 칸 · 반 카드 링과 흐름선 · 돌봄 결석 막대 · 생일 달력', '교사실 [통계]도 그림으로 — 평균 출석 링 · 흐름선 · 돌봄 게이지 · 친구별 출석 링 · 반별 비교 링', '고치기는 한 단계 더 — 연필 · 순서 버튼은 [고치기]를 눌러야 보여요 · 주일 인원 막대는 먼저 자세히 보기 · 예배 업무 카드 · 교사 사진 · 아이 성별도 바로 바뀌지 않게', '지우기는 두 번 눌러야 지워져요 (4초 안에 한 번 더)'] },
  { v: 'v25', date: '11월 13일', items: ['홈 화면 아이콘: 앱 시작 주소 · 이름표(id) · 아이콘 파일 이름을 새로 — 패드가 예전에 기억한 "조" 글자와 상관없이 처음부터 다시 받게', '아이콘 시험 페이지 3개(icontest-a/b/c.html) — 어디서 막히는지 1분 만에 가려내기'] },
  { v: 'v24', date: '11월 13일', items: ['홈 화면 아이콘이 "조" 글자로 나오던 문제 — 잘 되는 다른 앱(말씀선포)과 같은 구조로 맞춤: 앱 보관 도우미(서비스 워커) · icons 폴더 · 아이콘 연결 한 줄 · 화면 꾸밈 파일(app.css) 분리'] },
  { v: 'v23', date: '11월 13일', items: ['아이패드 · 아이폰 홈 화면 아이콘 파일 이름을 새로 바꿔서, 예전에 실패한 아이콘 기억을 피해 가게', '아이패드 크롬(데스크톱 모드)도 알아보고 "사파리에서 추가해 주세요" 안내를 띄워요'] },
  { v: 'v22', date: '11월 12일', items: ['홈에 [전체 한눈에 / 반별 보기] — 전체 홈에서 모든 반의 친구 수 · 출석 · 돌봄 · 생일을 한 화면에, 반 카드를 누르면 그 반으로', '교사실에 [선생님] 탭 — 모든 선생님 카드(전화 · 생일 · 소속 진/셀 · 주소)를 한눈에, 반별 · 헬퍼 고르기와 찾기', '선생님 카드에 진 · 셀 · 주소 칸 (주소는 디렉터 · 관리자와 본인만 봐요)'] },
  { v: 'v21', date: '11월 12일', items: ['조직도: 반 상자를 고른 폭으로, "반 없이 함께 섬기는 선생님"을 이름표 카드로 정돈', '설정의 구글 캘린더 연결 설정: 무엇인지 · 설정됨 여부를 한눈에, 순서 안내'] },
  { v: 'v20', date: '11월 12일', items: ['글을 끌어 고르다 창 밖에서 손을 떼도 창이 닫히지 않아요 · 쓰던 내용이 있으면 바깥을 눌러도 안 닫혀요', '공지 임시 저장: 나만 보이는 임시 저장 · 쓰는 동안 기기에도 저절로 보관', '공지 양식: 행사 안내 · 주일 공지 · 기도 제목 + 직접 만든 양식', '넓은 화면 교사실 탭에도 색깔 아이콘'] },
  { v: 'v19', date: '11월 12일', items: ['출석 마감: 다 체크하면 [출석 마감]으로 잠가요 — 잠긴 출석부는 누구도 실수로 바꿀 수 없어요', '지난 주일 출석은 수요일부터 저절로 잠겨요 (디렉터 · 관리자는 풀 수 있어요)', '출석 기록: 누가 언제 누구를 체크 · 취소 · 마감했는지 모두 남아요', '체크를 취소하면 5초 동안 [되돌리기]'] },
  { v: 'v18', date: '11월 12일', items: ['아이폰 · 아이패드에서 크롬 · 카톡 브라우저로 열면 "사파리로 열어 홈 화면에 추가하세요" 안내 (아이콘이 "조" 글자로 나오지 않게)', '크롬이 큰 아이콘을 고르도록 아이콘 크기 표시'] },
  { v: 'v17', date: '11월 12일', items: ['폰 교사실 아이콘 6칸: 화면 폭에 맞춰 간격 · 크기가 저절로 맞춰져요', '아래로 내릴 때 아이콘 줄이 화면 맨 위에 딱 붙고, 뒤 글이 비치지 않게'] },
  { v: 'v16', date: '11월 12일', items: ['폰 교사실: 공지 · 캘린더 · 순서표 · 업무 · 조직도 · 통계를 색깔 아이콘 6칸으로 늘 위에 (내려도 따라와요)', '홈에 "교사실 바로 가기" 6칸', '패드 · 아이폰 홈 화면 아이콘이 "조" 글자로 나오던 것 고침 (크기별 아이콘 · 이름 설정)'] },
  { v: 'v15', date: '11월 11일', items: ['아이 표시(선교사 가정 · VIP · 새친구 · 돌봄 필요 등) 누구나 고치기 — 아이 카드 → 표시 고치기', '결석 표시는 출석부로 자동: 2~3주 결석 · 4~7주 장기 결석 · 8주 넘으면 오래 못 봄 (주마다 바뀌어요)', '폰에서 교사실 메뉴를 그림 타일 서랍으로', '폰에서 순서표 분류 아이콘을 4칸 두 줄로 한눈에', '순서표 주일 카드가 상자 밖으로 나가던 것 정리'] },
  { v: 'v14', date: '11월 11일', items: ['순서표에서 "기타" 빼기 (찬양팀이 맡아요)', '출석 카드: 사진을 크게, 이름과 가운데 정렬', '남자 · 여자 표시: 아이 카드에서 한 번 누르거나, 친구들 → "아직 모르는 친구 정하기"로 한꺼번에', '아이 카드 사진이 잘리지 않게 원본 비율로, 누르면 크게 보기'] },
  { v: 'v13', date: '11월 11일', items: ['"지금 새로고침"이 눌리지 않던 것 고침 (새 파일을 확실히 받아서 다시 열어요)', '모든 선생님이 모든 반 아이를 보고, 누구나 어느 반이든 출석 체크', '주일 자료 링크: 설교 슬라이드 · OX 퀴즈 · 활동지 · BGM · 영상 (파일은 공용 구글 드라이브, 앱에는 링크만)', '업무 분담을 구역별 역할 카드 보드로 · 역할에서 빼면 메모와 교사 카드의 맡은 일에서도 빠져요', '교사 카드 빼기 → "그만두신 선생님" 보관함 (디렉터 · 관리자만, 되돌리기 가능)', '조직도에 모든 선생님 (헬퍼 선생님은 따로 풀로)', '예배 · 교사실 화면 폭과 위쪽 탭을 모두 같게, 캘린더 "다가오는 3주" 목록 정리'] },
  { v: 'v12', date: '11월 11일', items: ['자료 내려받기: 아이 명단 · 출석부 · 생일 달력 · 교사 명단 · 업무 분담 · 순서표 · 일정 · 주일 인원 · 찬양을 PDF나 엑셀로', '전체 자료를 엑셀 한 파일로 (관리자)', '연간 일정 한 번에 넣기: 엑셀 양식 내려받기 → 채워서 올리기 → 바뀌는 것 확인 → 적용', '홈 위쪽에 앱 버전 (누르면 업데이트 기록)', '일정에 "내용" 칸 (제목 바로 아래, 캘린더 목록에도 첫 줄이 보여요)'] },
  { v: 'v11', date: '11월 11일', items: ['카톡 교사방 기록 가져오기: 주일 찬양 5년치 · 주일 인원 · 올해 행사 (있는 값은 그대로, 빈칸만)', '교사실 → 통계: 주일 인원 막대 그래프 · 해마다 비교 · 이번 주 넣기', '예배 → 악보: 지난 찬양 찾기 (언제 · 몇 번 · 키 · 빠르기)', '곡마다 악기 · 빠르기(♩) 칸'] },
  { v: 'v10', date: '11월 11일', items: ['처음 여는 속도: 휴대폰에 남은 것으로 먼저 보여 주고 새 것은 뒤에서 받아요', '화면마다 필요한 것만 받아요 (출석 기록은 그 반만, 순서표는 연 달만)', '일정 넣기 창을 세로 화면에 맞게 정리 (시작 · 끝 한 줄씩)', '공휴일: 해마다 불러오기 · 대체·임시공휴일이 바뀌면 관리자에게 알림', '바깥 캘린더 가져오기 (관리자): .ics 파일 또는 구글 캘린더에서 바로 · 묶음째 지우기', '내 구글 캘린더 연결: 교사실 일정과 내 주일 순서가 "조이코너" 캘린더로'] },
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
const roomTabs = active => `<div class="seg roomseg">${ROOM_TABS.map(([k, l]) => `<button class="${active === k ? 'on' : ''}" data-act="rtab" data-id="${k}" style="--c:${(ROOM_INFO[k] || [])[3] || '#C62828'}"><span class="rti">${svg((ROOM_INFO[k] || [])[2] || '', 17, 2)}</span><span>${l}</span></button>`).join('')}</div>${roomDock(active)}`;
const NOTE_KINDS = ['통화', '문자', '심방', '기도제목', '특이사항'];

async function loadDuties() {
  if (Array.isArray(W.duties)) return;
  try { const s = await getDocs(collection(db, 'duties')); W.duties = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); } catch { W.duties = []; }
}
async function loadRoom() {
  const jobs = [];
  if (R.notices === null) { R.notices = undefined; jobs.push(loadNotices()); }
  if (R.events === null) { R.events = undefined; jobs.push(loadEvents()); }
  if (W.duties === null) { W.duties = undefined; jobs.push((async () => { W.duties = null; await loadDuties(); })()); }
  const y = new Date().getFullYear(); [y, y + 1].forEach(x => { if (!(String(x) in HOL.y)) jobs.push(loadHol(x)); });
  await Promise.all(jobs);
}
const sortedNotices = () => (R.notices || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || ko(b.at || '', a.at || ''));

function vRoom() {
  const ready = Array.isArray(R.notices) && Array.isArray(R.events) && Array.isArray(W.duties);
  const body = !ready ? '<div class="sub full">불러오는 중…</div>' : R.tab === 'cal' ? rCal() : R.tab === 'turns' ? rTurns() : R.tab === 'duty' ? rDuty() : R.tab === 'org' ? rOrg() : R.tab === 'tch' ? rTeachers() : rNotices();
  const cols = R.tab === 'notice' ? 'cols' : '';
  return `<div class="scroll ${cols}"><div class="ttl">교사실</div>${roomTabs(R.tab)}${body}</div>${nav('room')}`;
}

/* 공지 */
function rNotices() {
  const list = sortedNotices(), admin = isAdminMe();
  if (admin && DR.list === null) loadDrafts();
  return `${admin ? '<button class="cta full" data-act="noticeNew">+ 공지 올리기</button>' : ''}${admin ? draftList() : ''}
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
  for (let i = 0; i < 14; i++) { const d = addDays(today, i); itemsOn(d).filter(x => x.kind === 'evt' || x.kind === 'meet' || x.kind === 'hol').forEach(x => out.push({ d, ...x })); }
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
${list.length ? `<div class="list">${list.map((g, i) => `<div class="songrow"><button class="row" data-act="songPlay" data-id="${g.id}"><span class="num2">${i + 1}</span><span class="grow"><span class="nm" style="font-size:18px">${esc(g.title)}</span><span class="sub">${[g.inst || '', g.key ? '키 ' + g.key : '', g.bpm ? '♩' + g.bpm : '', g.pages ? `${g.pages}장` : '사진 없음', g.memo || ''].filter(Boolean).map(esc).join(' · ')}</span></span></button><div class="mv"><button data-act="songMove" data-id="${g.id}" data-n="-1" aria-label="위로" ${i === 0 ? 'disabled' : ''}>▲</button><button data-act="songMove" data-id="${g.id}" data-n="1" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></div><button class="editbtn" data-act="songEdit" data-id="${g.id}" aria-label="${esc(g.title)} 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18, 1.8)}</button></div>`).join('')}</div>` : '<div class="sub">아직 올라온 악보가 없어요. 보통 6~10곡을 올려요.</div>'}
<button class="sec" data-act="songNew">+ 곡 추가</button></section>
<section class="card"><div class="lbl"><span>예배 순서 · 기록</span></div><textarea id="sl_memo" style="min-height:120px" placeholder="예: 여는 찬양 → 기도 → 챈트 → 율동 찬양 → 성경이야기 → 헌금 → 광고">${esc(sl.memo || '')}</textarea><button class="sec" data-act="slSave">기록 저장</button>${sl.byName ? `<div class="s2">마지막 저장 · ${esc(sl.byName)}</div>` : ''}</section>${histCard()}`;
}
async function songSheet(id) {
  const list = W.songs[W.date] || [], sg = id ? list.find(x => x.id === id) : { title: '', key: '', memo: '', link: '', pages: 0 };
  if (!sg) return;
  W.editSong = id || null;
  pkInit('song', id ? await loadImgs('scorePages', id, sg.pages) : [], 'score');
  sheet(`<div class="ttl" style="font-size:24px">${id ? '곡 고치기' : '곡 추가'} · ${fmtMD(W.date)}</div>
<label class="fld">곡 제목<input class="in" id="g_title" value="${esc(sg.title)}"></label>
<div class="three"><label class="fld">악기<select class="in" id="g_inst">${['', '신디', '기타', '드럼'].map(x => `<option value="${x}" ${(sg.inst || '') === x ? 'selected' : ''}>${x || '-'}</option>`).join('')}</select></label><label class="fld">키<input class="in" id="g_key" value="${esc(sg.key || '')}" placeholder="예: G"></label><label class="fld">빠르기 ♩<input class="in" id="g_bpm" inputmode="numeric" value="${esc(sg.bpm || '')}" placeholder="120"></label></div>
<label class="fld">링크 (영상·PDF)<input class="in" id="g_link" value="${esc(sg.link || '')}" placeholder="https://"></label>
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
  const data = { date: d, title, key: val('g_key'), inst: val('g_inst'), bpm: val('g_bpm'), link: val('g_link'), memo: $('#g_memo').value.trim(), order: old ? old.order : (list.length ? Math.max(...list.map(x => x.order || 0)) + 1 : 1), pages: 0, by: (old && old.by) || S.me.email, byName: (old && old.byName) || myName() };
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
async function noticeSheet(id, fromDraft) {
  const base = id ? R.notices.find(x => x.id === id) : { category: '공지', title: '', body: '', links: '', eventDate: '', eventTime: '', pinned: false, imgCount: 0 };
  if (!base) return;
  const n = fromDraft ? { ...base, ...fromDraft } : base;
  R.editNotice = id || null; R.draftId = fromDraft ? fromDraft.id || null : null;
  pkInit('notice', id ? await loadImgs('noticeImages', id, n.imgCount) : [], 'photo');
  loadTpls();
  sheet(`<div class="ttl" style="font-size:24px">${id ? '공지 고치기' : '공지 올리기'}${R.draftId ? ' <span class="tag g">임시 저장한 글</span>' : ''}</div>
${localDraftNote(id)}
<div class="tplbar" id="tplbar">${tplBar()}</div>
<div class="two"><label class="fld">종류<select class="in" id="n_cat">${['공지', '행사', '자료', '기도'].map(c => `<option ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="chk" style="align-self:end"><input type="checkbox" id="n_pin" ${n.pinned ? 'checked' : ''}>맨 위에 고정</label></div>
<label class="fld">제목<input class="in" id="n_title" value="${esc(n.title)}"></label>
<label class="fld">내용<textarea id="n_body" style="min-height:180px">${esc(n.body || '')}</textarea></label>
<label class="fld">링크 (한 줄에 하나씩)<textarea id="n_links" style="min-height:60px" placeholder="https://">${esc(n.links || '')}</textarea></label>
<div class="two"><label class="fld">행사 날짜 (있으면)<input class="in" type="date" id="n_date" value="${esc(n.eventDate || '')}"></label><label class="fld">시간<input class="in" id="n_time" value="${esc(n.eventTime || '')}" placeholder="예: 13:30"></label></div>
<div class="fld">사진 (최대 10장)</div>${pkHtml('notice')}
<div class="sub" id="n_msg"></div>
<div class="btns"><button class="pri" data-act="noticeSave">${id ? '고친 내용 게시' : '게시하기'}</button><button class="sec" data-act="draftSave">임시 저장</button><button class="sec" data-act="noticeCancel">취소</button></div>
<div class="s2">임시 저장한 글은 나만 보여요 (사진은 게시할 때 넣어 주세요) · 쓰는 동안 이 기기에도 저절로 보관돼요 · <button class="linkbtn" data-act="tplSaveAsk">이 글을 양식으로 저장</button></div>
${id ? '<button class="ghost danger" data-act="noticeDel">공지 지우기</button>' : ''}`);
  const box = $('#sheet'); box.addEventListener('input', () => { clearTimeout(R.adT); R.adT = setTimeout(() => autoDraft(id), 800); });
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
    if (R.draftId) { deleteDoc(doc(db, 'drafts', R.draftId)).catch(() => { }); DR.list = (DR.list || []).filter(x => x.id !== R.draftId); R.draftId = null; }
    lsDel(adKey(id)); closeSheet(); toast('게시했어요'); if (S.route === 'notice' && S.arg === ref.id) paint(); else go('notice/' + ref.id);
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
const itemAct = x => x.hol ? `data-act="calDay" data-id="${x.d}"` : x.notice ? `data-act="noticeOpen" data-id="${x.notice}"` : x.kid ? `data-act="kid" data-id="${x.kid}"` : x.staff ? `data-act="staffOpen" data-id="${x.staff}"` : x.event ? `data-act="eventOpen" data-id="${x.event}"` : `data-act="wgoWeek" data-id="${x.d}"`;
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
<section class="card hero full">${big ? `<button class="heroph" data-act="staffZoom" aria-label="사진 크게 보기"><img src="${big}" alt="${esc(st.name)} 선생님"></button>` : `<div class="heroph">${big ? `<img src="${big}" alt="${esc(st.name)} 선생님">` : staffAv(st, 132)}</div>`}
<div class="herotx"><div class="eyebrow">교사 영혼 카드</div><h1 class="atitle" style="margin:2px 0 6px">${esc(st.name)} 선생님</h1>
<div class="chips">${st.role === 'director' || st.role === 'admin' ? `<span class="tag">${roleLabel(st)}</span>` : ''}${cls.map(c => `<span class="chip sm rose">${esc(c)}</span>`).join('')}${st.email ? '' : (admin ? '<span class="chip sm">구글 연결 전</span>' : '')}</div>
${st.intro ? `<p class="intro">${esc(st.intro)}</p>` : ''}
<div class="btns" style="flex-wrap:wrap">${st.phone ? `<a class="ghost alink sm2" href="tel:${esc(st.phone)}">전화</a><a class="ghost alink sm2" href="sms:${esc(st.phone)}">문자</a>` : ''}${admin || mine ? `<button class="ghost sm2" data-act="awayNew" data-id="${st.id}">부재 알리기</button>` : ''}</div>
${st.birth ? `<div class="s2">생일 ${esc(st.birth.slice(5).replace('-', '/'))}</div>` : ''}${staffMoreLine(st)}</div></section>
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
  const addr0 = canSeeAddr(st) ? await addrOf(id) : '';
  sheet(`<div class="ttl" style="font-size:24px">${esc(st.name)} 선생님 카드</div>
<div class="fld">사진</div>${pkHtml('face')}
<div class="two"><label class="fld">휴대폰<input class="in" type="tel" id="sf_phone" value="${esc(st.phone || '')}" placeholder="010-0000-0000"></label><label class="fld">생일<input class="in" type="date" id="sf_birth" value="${esc(st.birth || '')}"></label></div>
<div class="two"><label class="fld">진<input class="in" id="sf_jin" value="${esc(st.jin || '')}" placeholder="예: 3진"></label><label class="fld">셀<input class="in" id="sf_cell" value="${esc(st.cell || '')}" placeholder="예: 기쁨셀"></label></div>
${canSeeAddr(st) ? `<label class="fld">주소 <small class="s2">디렉터 · 관리자와 본인만 봐요</small><input class="in" id="sf_addr" value="${esc(addr0)}" placeholder="예: 서울시 ○○구 ○○로 12"></label>` : ''}
<label class="fld">한 줄 소개<input class="in" id="sf_intro" value="${esc(st.intro || '')}" placeholder="예: 율동으로 아이들과 함께 찬양해요"></label>
<div class="sub" id="sf_msg"></div>
<div class="btns"><button class="pri" data-act="staffEditSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${isAdminMe() ? `<button class="ghost" data-act="staff" data-id="${st.id}">권한 · 반 · 구글 계정 고치기</button>` : ''}`);
}
async function staffEditSave() {
  if (PK.face && PK.face.busy) return toast('사진을 준비하고 있어요');
  const id = S.editStaff2, st = S.staff.find(x => x.id === id); if (!st) return;
  const addrNew = $('#sf_addr') ? val('sf_addr') : null;
  const patch = { phone: val('sf_phone'), birth: val('sf_birth'), intro: val('sf_intro'), jin: val('sf_jin'), cell: val('sf_cell'), photo: PK.face.items.length > 0, thumb: '' };
  const msg = $('#sf_msg'); msg.textContent = '저장 중…';
  try {
    if (patch.photo) {
      const url = PK.face.items[0].url;
      await setDoc(doc(db, 'staffPhotos', id), { staffId: id, data: url }); IMG['staffPhotos/' + id] = url;
      patch.thumb = await thumbFrom(url, 160);
    } else if (st.photo) { await deleteDoc(doc(db, 'staffPhotos', id)).catch(() => { }); delete IMG['staffPhotos/' + id]; }
    await updateDoc(doc(db, 'staff', id), patch);
    if (addrNew !== null) await addrSave(id, addrNew);
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
  if (true) return toggle + top + rDutyBoard() + (admin ? '<button class="sec full" data-act="dutyEdit">+ 역할 추가</button>' : '') + (list.length ? '' : '<div class="sub full">업무 분담이 아직 없어요. 설정에서 joycorner-extra.json을 가져와 주세요.</div>');
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
  const removed = old ? [...(old.people || []), ...(old.backup || [])].filter(n => !SP.du_people.includes(n) && !SP.du_backup.includes(n)) : [];
  let note0 = $('#u_note').value.trim(); removed.forEach(n => { note0 = stripName(note0, n); });
  const data = { section: val('u_sec'), area: val('u_area') || role, role, desc: $('#u_desc').value.trim(), people: [...SP.du_people], backup: [...SP.du_backup], note: note0, order: old ? old.order : Math.max(0, ...W.duties.map(y => y.order || 0)) + 1 };
  const ref = id ? doc(db, 'duties', id) : doc(collection(db, 'duties'));
  try { await setDoc(ref, data); if (old) Object.assign(old, data); else W.duties.push({ id: ref.id, ...data }); W.duties.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); closeSheet(); toast('저장했어요'); paint(); syncStaffDuties([...removed, ...data.people, ...(old ? old.people || [] : [])]).then(() => softPaint()); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
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
  return `<section class="card full org"><div class="otop"><div class="obox root"><img src="logo-white.png" alt="조이코너" class="ologo"><span>교사 ${S.staff.filter(x => x.kind !== 'helper').length}명 · 아이 ${allKids().filter(k => (k.status || 'active') === 'active').length}명</span></div></div>
<div class="oline"></div><div class="otop"><div class="obox dir"><div class="ohead"><b>디렉터</b></div>${chips(dirs.map(x => x.name))}</div></div>
${admins.length ? `<div class="oline"></div><div class="otop"><div class="obox adm"><div class="ohead"><b>관리자</b></div>${chips(admins.map(x => x.name))}</div></div>` : ''}
<div class="oline"></div><div class="orow ogrid">${classBoxes}</div>
${orgRest(dirs, admins, cls)}</section>
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
  return `${iosOtherNote(true)}${isStandalone() ? '<div class="note">지금 홈 화면 앱으로 열려 있어요. 따로 할 일이 없어요!</div>' : ''}
${S.bip && !isStandalone() ? '<button class="cta" data-act="installNow">지금 설치</button>' : ''}
<div class="seg">${tabs.map(([k, l]) => `<button class="${dev === k ? 'on' : ''}" data-act="helpDev" data-id="${k}">${l}</button>`).join('')}</div>
<div class="installwrap"><ol class="steps">${steps.map(([a, b], i) => `<li><span class="sn">${i + 1}</span><div><b>${esc(a)}</b><p>${esc(b)}</p></div></li>`).join('')}</ol>
<div class="phone ${dev}"><div class="pscreen">${Array.from({ length: 11 }, (_, i) => `<i style="background:${['#A8D0F0', '#FFD66B', '#B9DDB0', '#F4A9A0', '#D9BFF2', '#F6C28B'][i % 6]}"></i>`).join('')}<img src="icons/icon-192.png" alt="조이코너 아이콘" class="pnew"><span class="plabel">조이코너</span></div></div></div>`;
}
function welcomeLine() {
  let off = false; try { off = localStorage.getItem('jc_welcome_off') === '1'; } catch { /* 없음 */ }
  if (off) return '';
  const sa = isStandalone();
  return `<div class="welcome full"><img src="icons/icon-192.png" alt="" width="40" height="40"><span class="t"><b>처음이세요?</b><span>${sa ? '도우미에서 기능을 차근차근 볼 수 있어요.' : '홈 화면에 바로가기를 만들면 앱처럼 열려요.'}</span></span>${sa ? '' : '<button class="ghost sm2" data-act="helpGo" data-id="install">바로가기</button>'}<button class="ghost sm2" data-act="go" data-to="help">도우미</button><button class="x" data-act="welcomeOff" aria-label="닫기">×</button></div>`;
}

/* ---------- 새 버전 알림 ---------- */
async function checkVersion() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json();
    if (j.v && j.v !== APP_VERSION && !document.getElementById('newver')) {
      const b = document.createElement('div'); b.id = 'newver'; b.className = 'newver';
      b.innerHTML = `<span>새 버전 <b>${esc(j.v)}</b>이 나왔어요</span><button data-act="reload" data-v="${esc(j.v)}">지금 새로고침</button>`;
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
const TURN_KEYS = [['preacher', '설교'], ['pray', '중보기도 인도'], ['nation', '성전건축·나라 기도'], ['chant', '챈트'], ['dance', '율동']];  // v14 — 기타는 찬양팀이 맡아서 순서표에서 뺐어요
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
  const keys = ['preacher', 'pray', 'nation', 'chant', 'dance', 'offering'];
  return `<article class="sunday ${now ? 'now' : ''} ${s.noService ? 'off' : ''}"><header><span class="sd"><b>${d.getMonth() + 1}/${d.getDate()}</b><small>주일</small></span><span class="st">${esc(s.story || (s.noService ? '조이코너 예배 없음' : '이야기 미정'))}</span>${holName(s.date) ? `<span class="tag hol">${esc(holName(s.date))}</span>` : ''}${now ? '<span class="tag">이번 주</span>' : ''}${checkBadge(s)}${isAdminMe() && !opts.noEdit ? `<button class="editbtn" data-act="schedEditDate" data-id="${s.date}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 담당 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 16, 1.8)}</button>` : ''}</header>
${sundayEventsHtml(s.date)}${s.noService ? `<div class="offnote">${esc(s.noServiceNote || '이 주일은 조이코너 예배가 없어요')}</div>` : `<div class="rrows">${sundayRows(s, keys)}</div>`}</article>`;
}
function wWeek(d) {
  const s = schedFor(d) || { date: d };
  const sermons = W.sermons.filter(x => x.date === d), songs = W.songs[d] || [];
  const away = awayOn(d);
  return `<div class="full">${sundayCard(s)}</div>
${away.length ? `<section class="card"><div class="lbl"><span>이번 주 부재</span></div>${away.map(st => `<div class="hrow">${staffChip(st.name)}${awayHandover(st)}</div>`).join('')}</section>` : ''}
<div class="statgrid full"><button class="stat" data-act="wtab" data-id="sermon">${ico('preacher', 22)}<span><b>${sermons.length ? statusLabel(sermons[0].status) : '아직 없음'}</b><small>설교${sermons.length ? ' · ' + esc(sermons[0].authorName || '') : ''}</small></span></button>
<button class="stat" data-act="wtab" data-id="songs">${svg(ICON.music, 22, 1.8)}<span><b>${songs.length}곡</b><small>악보${songs.length ? ' · 넘겨 보기' : ''}</small></span></button></div>${matCard(d)}`;
}
function dayTurnsHtml(d) {
  const s = schedFor(d);
  if (!s || s.noService) return '';
  return `<div class="dayturns"><div class="splbl">주일 담당</div><div class="rrows">${sundayRows(s, ['preacher', 'pray', 'nation', 'chant', 'dance', 'offering'])}</div></div>`;
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
  const cats = [['all', '전체'], ['preacher', '설교'], ['pray', '중보기도'], ['nation', '나라 기도'], ['chant', '챈트'], ['dance', '율동'], ['offering', '헌금기도'], ['mine', '내 순서']];
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
  const drawerM = m => { const miss = isAdminMe() ? sundaysOfYear(Y, m).filter(d => !schedFor(d)).length : 0; return `<details class="drawer full" data-dr="${Y}-${m}" ${isOpen(m) ? 'open' : ''}><summary><span class="mname">${MONTHS[m - 1]}</span><span class="s2">주일 ${byMonth[m].length}번${m === curM ? ' · 이번 달' : ''}</span><span class="minis">${mini(byMonth[m])}</span></summary>${isOpen(m) ? `${miss ? `<button class="addrow" data-act="turnFillM" data-id="${Y}-${m}">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.2)} 이 달 빈 주일 ${miss}번 더하기</button>` : ''}${monthBody(m, byMonth[m])}` : ''}</details>`; };
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
  const tools = isAdminMe() ? `<div class="caltools full"><button class="tool" data-act="holSheet">${svg('<path d="M4 21V4m0 0h12l-2 4 2 4H4"/>', 18, 1.9)}<span>공휴일</span></button><button class="tool" data-act="impSheet">${svg('<path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 20h16"/>', 18, 1.9)}<span>바깥 캘린더 가져오기</span></button></div>` : '';
  return `${holBanner()}${gcalBanner()}${tools}<div class="calwrap full"><section class="card cal"><div class="calhead"><button data-act="calMonth" data-n="-1" aria-label="지난 달">‹</button><b>${y}년 ${m}월</b><button data-act="calMonth" data-n="1" aria-label="다음 달">›</button></div>
${R.range ? `<div class="rangebar">${svg('<path d="M4 7h16M4 12h16M4 17h10"/>', 16, 2)}<span>${R.range.end ? `${fmtShort(rng[0])} – ${fmtShort(rng[1])}` : `${fmtShort(R.range.start)}부터 — 끝 날짜를 눌러 주세요`}</span><button class="linkbtn" data-act="rangeCancel">취소</button></div>` : ''}
<div class="cgrid" id="cgrid">${'일월화수목금토'.split('').map((w, i) => `<span class="cw ${i === 0 ? 'sun' : ''}">${w}</span>`).join('')}
${cells.slice(0, weeks * 7).map(d => { const it = itemsOn(d); const out = d.slice(0, 7) !== R.month; const inR = rng && d >= rng[0] && d <= rng[1]; const s = schedFor(d); const mine = s && TURN_KEYS.some(([k]) => hasName(s[k], myName())); return `<button class="cday ${holName(d) ? 'hol' : ''} ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${d === R.day ? 'sel' : ''} ${parseD(d).getDay() === 0 ? 'sun' : ''} ${inR ? 'inrange' : ''}" data-act="calDay" data-id="${d}"><span class="dn">${parseD(d).getDate()}${mine ? '<i class="mydot" title="내 순서"></i>' : ''}</span><span class="dots">${it.slice(0, 4).map(x => `<i class="cdot ${x.kind}"></i>`).join('')}</span><span class="clab">${it.slice(0, 3).map(x => `<em class="${x.kind} ${x.span ? 'span' : ''}">${x.span && !x.first && parseD(d).getDay() !== 0 ? '&nbsp;' : esc(x.label)}</em>`).join('')}</span></button>`; }).join('')}</div>
<div class="legend"><span><i class="cdot hol"></i>공휴일</span><span><i class="cdot sun"></i>주일</span><span><i class="cdot evt"></i>행사</span><span><i class="cdot meet"></i>회의·교육</span><span><i class="cdot away"></i>부재</span><span><i class="cdot bday"></i>생일</span><span><i class="mydot"></i>내 순서</span></div>
<div class="s2">${matchMedia('(pointer:fine)').matches ? '날짜를 끌어서 고르면 기간 일정을 바로 넣어요.' : '날짜를 길게 누른 뒤 끝 날짜를 누르면 기간 일정을 넣어요.'}</div></section>
<div class="calside"><section class="card"><div class="lbl"><span>${dd.getMonth() + 1}월 ${dd.getDate()}일 ${DOW[dd.getDay()]}요일</span><button class="linkbtn" data-act="eventNew">+ 일정</button></div>${day.filter(x => x.kind !== 'sun').length ? day.filter(x => x.kind !== 'sun').map(x => agendaRow(x)).join('') : (schedFor(R.day) ? '' : '<div class="sub">일정이 없어요.</div>')}${schedFor(R.day) ? `<div class="mtop">${sundayCard(schedFor(R.day))}</div>` : ''}</section>
<section class="card"><div class="lbl"><span>다가오는 3주</span></div>${upcoming.length ? `<div class="agenda">${upcoming.slice(0, 12).map(x => agendaRow(x, true)).join('')}</div>` : '<div class="sub">다가오는 행사·생일이 없어요.</div>'}</section>${gcalCard()}</div></div>`;
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
  const hn = holName(d); if (hn) out.push({ d, kind: 'hol', label: hn, sub: '공휴일', hol: true });
  const s = schedFor(d);
  if (s && !(s.noService && s.noServiceBy && (R.events || []).some(e => e.id === s.noServiceBy))) out.push({ d, kind: s.noService ? 'off' : 'sun', label: s.noService ? (s.noServiceNote || '조이코너 예배 없음') : (s.story || '주일 예배'), sub: s.noService ? '' : (s.preacher ? '설교 ' + s.preacher : '') });
  (R.notices || []).filter(n => n.eventDate === d).forEach(n => out.push({ d, kind: 'evt', label: n.title, sub: n.eventTime || '', notice: n.id }));
  (R.events || []).filter(e => { const [a, b] = evSpan(e); return a <= d && d <= b; }).forEach(e => { const [a, b] = evSpan(e); out.push({ d, kind: e.kind === '예배 없음' ? 'off' : (KIND_CLASS[e.kind] || 'evt'), label: e.title, sub: [a !== b ? `${fmtShort(a)}–${fmtShort(b)}` : '', timeText(e), e.place, (e.memo || '').split('\n')[0].slice(0, 40)].filter(Boolean).join(' · '), event: e.id, span: a !== b, first: d === a }); });
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
<label class="fld">내용 <span class="s2">(준비물 · 순서 · 링크 등, 줄을 바꿔 써도 돼요)</span><textarea id="e2_memo" style="min-height:96px" placeholder="예: 13시 교회 앞 출발 · 회비 5,000원 · 개인 컵 챙기기">${esc(e.memo || '')}</textarea></label>
<div class="fld">종류</div><div class="kindgrid">${kinds.map(k => `<label class="kindopt ${e.kind === k ? 'on' : ''}"><input type="radio" name="e2_kind" value="${k}" ${e.kind === k ? 'checked' : ''}><i class="cdot ${k === '예배 없음' ? 'off' : (KIND_CLASS[k] || 'evt')}"></i>${k}</label>`).join('')}</div>
<div class="s2" id="e2_offnote" ${e.kind === '예배 없음' ? '' : 'hidden'}>이 기간의 주일은 순서표와 예배 탭에 "조이코너 예배 없음"으로 함께 바뀌어요.</div>
<div class="timebox ${allDay ? 'allday' : ''}" id="e2_box">
<label class="switch tbhead"><b>언제</b><span class="grow"></span><span class="s2">종일</span><input type="checkbox" id="e2_allday" ${allDay ? 'checked' : ''}><span class="sw"></span></label>
<div class="evrow"><span class="tl">시작</span><input class="in" type="date" id="e2_date" value="${esc(e.date)}" aria-label="시작 날짜"><input class="in tm" type="time" id="e2_time" value="${esc(e.time || '')}" step="300" aria-label="시작 시간"></div>
<div class="evrow"><span class="tl">끝</span><input class="in" type="date" id="e2_end" value="${esc(e.endDate || e.date)}" aria-label="끝 날짜"><input class="in tm" type="time" id="e2_etime" value="${esc(e.endTime || '')}" step="300" aria-label="끝 시간"></div>
<div class="quickt tm" id="e2_quick">${['09:00', '11:00', '12:00', '13:30', '15:00', '19:30'].map(t => `<button type="button" class="chip sm" data-act="quickTime" data-id="${t}">${t}</button>`).join('')}</div>
<div class="s2 tbnote">${allDay ? '하루 일정이면 끝 날짜를 그대로 두세요.' : '시작 시간을 고르면 끝 시간은 1시간 뒤로 맞춰져요.'}</div>
</div>
<label class="fld">장소<input class="in" id="e2_place" value="${esc(e.place || '')}"></label>
<div class="fld">사진 (최대 10장)</div>${pkHtml('event')}
<div class="sub" id="e2_msg"></div>
<div class="btns"><button class="pri" data-act="eventSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>
${id ? '<button class="ghost danger" data-act="eventDel">일정 지우기</button>' : ''}`);
  const box = $('#sheet');
  $('#e2_date').dataset.old = e.date;
  box.addEventListener('change', ev => {
    if (ev.target.id === 'e2_allday') { const on = ev.target.checked; $('#e2_box').classList.toggle('allday', on); box.querySelector('.tbnote').textContent = on ? '하루 일정이면 끝 날짜를 그대로 두세요.' : '시작 시간을 고르면 끝 시간은 1시간 뒤로 맞춰져요.'; }
    if (ev.target.id === 'e2_date' && ev.target.value) { const en = $('#e2_end'), old = ev.target.dataset.old || ''; if (!en.value || en.value < ev.target.value || en.value === old) en.value = ev.target.value; ev.target.dataset.old = ev.target.value; }
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
    closeSheet(); toast(linked ? `저장했어요 · 주일 ${linked}번을 "예배 없음"으로 바꿨어요` : '저장했어요'); gcalSoon();
    if (S.route === 'event' && S.arg === ref.id) paint(); else if (S.route === 'staff' || (S.route === 'room' && R.tab === 'cal')) paint(); else go('event/' + ref.id);
  } catch (err) { msg.textContent = ''; toast('저장하지 못했어요: ' + errMsg(err)); }
}
async function eventDel() {
  const id = R.editEvent, e = R.events.find(x => x.id === id); if (!e) return;
  try {
    for (let i = 0; i < (e.imgCount || 0); i++) await deleteDoc(doc(db, 'eventImages', `${id}_${i}`)).catch(() => { });
    if (e.kind === '예배 없음' && isAdminMe()) await linkNoService(id, e, null);
    await deleteDoc(doc(db, 'events', id)); R.events = R.events.filter(x => x.id !== id); closeSheet(); toast('지웠어요'); gcalSoon();
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
  allIn: () => { if (attLocked()) return attLockedToast(); const c = S.cur, d = S.attDate; const m = ((S.att[c] ||= {})[d] ||= {}); const patch = {}; activeKids(c).forEach(k => { if (m[k.id] !== 'p') { m[k.id] = 'p'; patch[k.id] = 'p'; } }); paint(); if (Object.keys(patch).length) { writeMarks(patch); attLog('all', { n: Object.keys(patch).length }); } },
  clearAsk: () => sheet(`<div class="ttl" style="font-size:22px">출석을 모두 지울까요?</div><div class="sub">이 주일의 체크가 전부 사라져요. 누가 언제 지웠는지 기록에 남아요.</div><div class="btns"><button class="pri" data-act="clearYes">네, 지울게요</button><button class="sec" data-act="sheetClose">아니요</button></div>`),
  clearYes: () => { if (attLocked()) { closeSheet(); return attLockedToast(); } const c = S.cur, d = S.attDate; const m = (S.att[c] ||= {}); const patch = {}; const before = Object.keys(m[d] || {}).length; Object.keys(m[d] || {}).forEach(id => { patch[id] = deleteField(); }); m[d] = {}; closeSheet(); paint(); if (Object.keys(patch).length) { writeMarks(patch); attLog('clear', { n: before }); } },
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
  const was = d.dataset.dr === 'count' ? R.openCount : (R.openM || {})[d.dataset.dr];
  if (d.dataset.dr === 'count') R.openCount = d.open; else { R.openM = R.openM || {}; R.openM[d.dataset.dr] = d.open; }
  if (d.open && !was && /^\d{4}-\d{1,2}$/.test(d.dataset.dr) && !d.querySelector('.sunday,.addrow')) paint();
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
    let snap = null;
    try { snap = await getDocFromCache(doc(db, 'teachers', email)); if (!snap.exists()) snap = null; } catch { snap = null; }
    const fromCache = !!snap;
    if (!snap) snap = await getDoc(doc(db, 'teachers', email));
    if (!snap.exists() && email === OWNER_EMAIL.toLowerCase()) {
      await setDoc(doc(db, 'teachers', email), { name: user.displayName || '', role: 'admin', classes: [] });
      snap = await getDoc(doc(db, 'teachers', email));
    }
    if (!snap.exists()) { S.phase = 'pending'; return route(); }
    const setMe = d => {
      S.me = { email, ...d, name: S.me && S.me.email === email ? S.me.name : d.name };
      if (S.me.role === 'director') { S.me.director = true; S.me.role = 'admin'; }
      if (email === OWNER_EMAIL.toLowerCase()) { S.me.role = 'admin'; S.me.owner = true; }
    };
    setMe(snap.data());
    await loadAll();
    S.phase = 'ready'; route(); setTimeout(checkVersion, 1500);
    // 권한이 바뀌었는지 서버에서 한 번 더 확인해요
    if (fromCache) getDoc(doc(db, 'teachers', email)).then(n => {
      if (!n.exists()) { if (email !== OWNER_EMAIL.toLowerCase()) { S.phase = 'pending'; route(); } return; }
      const d = n.data(), old = snap.data();
      if (d.role !== old.role || JSON.stringify(d.classes || []) !== JSON.stringify(old.classes || [])) { setMe(d); Object.keys(ATT).forEach(k => delete ATT[k]); loadAll().then(() => softPaint()); }
    }).catch(() => { });
    // 잠깐 쉬는 틈에 나머지를 미리 받아 둬요
    const idle = window.requestIdleCallback || (f => setTimeout(f, 2500));
    idle(() => { loadRoom().then(() => { holAutoCheck(); }); gcalLoad().then(() => { if (gcalOn()) { gPrep(); softPaint(); } }); });
  } catch (e) {
    S.phase = 'pending'; route(); toast('불러오지 못했어요: ' + (e.code || e.message));
  }
}
if (!configured) { S.phase = 'setup'; paint(); }
else onAuthStateChanged(auth, start);

/* ================= v10 · 빠르게 열기 · 공휴일 · 구글 캘린더 가져오기 · 내 구글 캘린더 ================= */

/* ---------- 빠르게 열기: 휴대폰에 남아 있는 것(캐시)으로 먼저 그리고, 서버 것은 뒤에서 받아 바꿔요 ---------- */
const qDocs = async (ref, cache) => { try { const s = await (cache ? getDocsFromCache(ref) : getDocs(ref)); return s.docs.map(d => ({ id: d.id, ...d.data() })); } catch { return null; } };
const ATT = {};
function kidRefs() { return [collection(db, 'children')]; }  // v13 — 모든 선생님이 모든 반 아이들을 봐요
async function fetchCore(cache) {
  const [cs, ks, sc, st] = await Promise.all([
    qDocs(collection(db, 'classes'), cache),
    Promise.all(kidRefs().map(r => qDocs(r, cache))).then(a => a.some(x => x === null) ? null : a.flat()),
    qDocs(collection(db, 'schedule'), cache),
    qDocs(collection(db, 'staff'), cache)
  ]);
  return { cs, ks, sc, st };
}
function applyCore({ cs, ks, sc, st }) {
  if (cs) { S.classes = {}; cs.forEach(x => { S.classes[x.id] = x; }); }
  S.myClasses = Object.keys(S.classes).sort();
  if (!S.myClasses.includes(S.cur)) { const saved = lsGet('jc_cur'), own = (S.me.classes || []).find(c => S.classes[c]); S.cur = S.myClasses.includes(saved) ? saved : own || S.myClasses[0] || null; }
  if (ks) { const by = {}; S.myClasses.forEach(c => { by[c] = []; }); ks.forEach(k => { if (by[k.classId]) by[k.classId].push(k); }); S.kids = by; }
  if (sc) S.schedule = sc.sort((a, b) => ko(a.date, b.date));
  if (st) { const all = st.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || ko(a.name, b.name)); S.staff = all.filter(x => x.status !== 'left'); S.staffLeft = all.filter(x => x.status === 'left'); }
  const mine = S.staff.find(x => x.email && x.email === S.me.email); if (mine) S.me.name = mine.name;
}
async function loadAtt(c, cache) {
  const a = await qDocs(query(collection(db, 'attendance'), where('classId', '==', c)), cache);
  if (a === null || (cache && !a.length)) return false;
  const m = {}; a.forEach(x => { m[x.date] = x.marks || {}; });
  const old = S.att[c] || {};
  if (S.watchKey === `${c}_${S.attDate}` && old[S.attDate]) m[S.attDate] = old[S.attDate];
  S.att[c] = m; return true;
}
// 반 하나의 출석 기록은 그 반을 볼 때 받아요
function ensureAtt(c) {
  if (!c) return Promise.resolve();
  if (!ATT[c]) ATT[c] = (async () => { if (await loadAtt(c, true)) softPaint(); await loadAtt(c, false); softPaint(); })();
  return ATT[c];
}
function softPaint() {
  if (S.phase !== 'ready') return;
  clearTimeout(S.spT);
  S.spT = setTimeout(() => {
    const a = document.activeElement;
    if (a && a.closest && a.closest('main') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    if (CD.on || CD.t || document.querySelector('.viewer')) return;
    paint();
  }, 40);
}
async function loadAll() {
  const guess = lsGet('jc_cur');
  const c0 = await fetchCore(true);
  if (c0.cs && c0.cs.length && c0.ks && c0.ks.length) {
    applyCore(c0);
    ensureAtt(S.cur);
    fetchCore(false).then(n => { applyCore(n); softPaint(); if (S.cur) ensureAtt(S.cur); });
    return;
  }
  if (guess) ensureAtt(guess);
  applyCore(await fetchCore(false));
  await ensureAtt(S.cur);
}
// 캐시가 있으면 먼저 쓰고, 서버 것이 오면 다시 그려요
function twoStep(ref, put) {
  return new Promise(res => {
    let done = false, net = false;
    const fin = () => { if (!done) { done = true; res(); } };
    qDocs(ref, true).then(c => { if (!net && c && c.length) { put(c); fin(); } });
    qDocs(ref, false).then(n => { net = true; if (n) put(n); else if (!done) put([]); if (done) softPaint(); fin(); });
  });
}
async function loadNotices() { await twoStep(collection(db, 'notices'), a => { R.notices = a; }); }
async function loadEvents() { await twoStep(collection(db, 'events'), a => { R.events = a; }); }

/* ---------- 공휴일 ---------- */
// 자료: @hyunbinseo/holidays-kr (MIT) — 우주항공청 월력요항 · 대체·임시공휴일 포함
const HOL = { y: {}, chk: null };
const HOL_PKG = '@hyunbinseo/holidays-kr';
const HOL_BUILTIN = {
  2026: { '2026-01-01': '1월 1일', '2026-02-16': '설날 전날', '2026-02-17': '설날', '2026-02-18': '설날 다음 날', '2026-03-01': '3ㆍ1절', '2026-03-02': '대체공휴일(3ㆍ1절)', '2026-05-01': '노동절', '2026-05-05': '어린이날', '2026-05-24': '부처님 오신 날', '2026-05-25': '대체공휴일(부처님 오신 날)', '2026-06-03': '전국동시지방선거', '2026-06-06': '현충일', '2026-07-17': '제헌절', '2026-08-15': '광복절', '2026-08-17': '대체공휴일(광복절)', '2026-09-24': '추석 전날', '2026-09-25': '추석', '2026-09-26': '추석 다음 날', '2026-10-03': '개천절', '2026-10-05': '대체공휴일(개천절)', '2026-10-09': '한글날', '2026-12-25': '기독탄신일' },
  2027: { '2027-01-01': '1월 1일', '2027-02-06': '설날 전날', '2027-02-07': '설날', '2027-02-08': '설날 다음 날', '2027-02-09': '대체공휴일(설날)', '2027-03-01': '3ㆍ1절', '2027-05-01': '노동절', '2027-05-03': '대체공휴일(노동절)', '2027-05-05': '어린이날', '2027-05-13': '부처님 오신 날', '2027-06-06': '현충일', '2027-07-17': '제헌절', '2027-07-19': '대체공휴일(제헌절)', '2027-08-15': '광복절', '2027-08-16': '대체공휴일(광복절)', '2027-09-14': '추석 전날', '2027-09-15': '추석', '2027-09-16': '추석 다음 날', '2027-10-03': '개천절', '2027-10-04': '대체공휴일(개천절)', '2027-10-09': '한글날', '2027-10-11': '대체공휴일(한글날)', '2027-12-25': '기독탄신일', '2027-12-27': '대체공휴일(기독탄신일)' }
};
function loadHol(y) {
  y = String(y);
  if (y in HOL.y) return Promise.resolve(HOL.y[y]);
  HOL.y[y] = undefined;
  return getDoc(doc(db, 'holidays', y)).then(s => { HOL.y[y] = s.exists() ? s.data() : null; }).catch(() => { HOL.y[y] = null; }).then(() => HOL.y[y]);
}
const holName = d => { const h = HOL.y[d.slice(0, 4)]; if (h === undefined) loadHol(d.slice(0, 4)).then(() => softPaint()); return (h && h.days && h.days[d]) || ''; };
// 최신판을 받아 와요 (없으면 앱에 들어 있는 표)
async function fetchHolidays(y) {
  const tries = [];
  try { const r = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${HOL_PKG}/resolved?specifier=latest`); if (r.ok) { const v = (await r.json()).version; if (v) tries.push(v); } } catch { /* 넘어가요 */ }
  tries.push('latest', '5');
  for (const v of tries) {
    try {
      const m = await import(`https://cdn.jsdelivr.net/npm/${HOL_PKG}@${v}/dist/all.js`);
      const p = m['y' + y];
      if (p) return { days: Object.fromEntries(Object.entries(p).map(([d, n]) => [d, [].concat(n).join(' · ')])), src: `${HOL_PKG}@${v}` };
    } catch { /* 다음 것 */ }
  }
  return HOL_BUILTIN[y] ? { days: { ...HOL_BUILTIN[y] }, src: 'builtin' } : null;
}
function holDiff(oldDays, newDays) {
  const o = oldDays || {}, n = newDays || {}, add = [], chg = [], del = [];
  Object.keys(n).sort().forEach(d => { if (!(d in o)) add.push(d); else if (o[d] !== n[d]) chg.push(d); });
  Object.keys(o).sort().forEach(d => { if (!(d in n)) del.push(d); });
  return { add, chg, del, n: add.length + chg.length + del.length };
}
async function holSave(y, got) {
  const data = { year: Number(y), days: got.days, src: got.src, at: new Date().toISOString(), by: S.me.email, byName: myName() };
  await setDoc(doc(db, 'holidays', String(y)), data);
  HOL.y[String(y)] = data;
}
// 관리자: 일주일에 한 번 나라 공휴일이 바뀌었는지 살펴봐요 (바뀌면 알림, 한 번 눌러 반영)
async function holAutoCheck() {
  if (!isAdminMe() || HOL.chk) return;
  const last = Number(lsGet('jc_holchk') || 0);
  const now = new Date(), y = now.getFullYear(), years = [y, y + 1];
  await Promise.all(years.map(loadHol));
  const missing = years.filter(x => !HOL.y[x] && (x === y || now.getMonth() >= 9));
  if (Date.now() - last < 7 * 864e5 && !missing.length) { HOL.chk = { list: [] }; return; }
  HOL.chk = { list: [] };
  for (const x of years) {
    const got = await fetchHolidays(x); if (!got) continue;
    const cur = HOL.y[x];
    if (!cur) { if (x === y || now.getMonth() >= 9) HOL.chk.list.push({ y: x, got, diff: holDiff({}, got.days), isNew: true }); continue; }
    const diff = holDiff(cur.days, got.days);
    if (diff.n && got.src !== 'builtin') HOL.chk.list.push({ y: x, got, diff });
  }
  lsSet('jc_holchk', String(Date.now()));
  if (HOL.chk.list.length) softPaint();
}
function holBanner() {
  if (!isAdminMe() || !HOL.chk || !HOL.chk.list.length) return '';
  const L = HOL.chk.list, allNew = L.every(x => x.isNew);
  const line = L.map(x => x.isNew ? `${x.y}년 ${Object.keys(x.got.days).length}일` : `${x.y}년 ` + [x.diff.add.length ? `새로 ${x.diff.add.length}` : '', x.diff.chg.length ? `바뀜 ${x.diff.chg.length}` : '', x.diff.del.length ? `빠짐 ${x.diff.del.length}` : ''].filter(Boolean).join(' · ') + ([...x.diff.add, ...x.diff.chg][0] ? ` (${fmtShort([...x.diff.add, ...x.diff.chg][0])} ${x.got.days[[...x.diff.add, ...x.diff.chg][0]]})` : '')).join(' · ');
  return `<section class="card banner full"><div class="bnrow">${svg('<path d="M4 21V4m0 0h12l-2 4 2 4H4"/>', 22, 1.9)}<span class="grow"><b>${allNew ? '공휴일을 캘린더에 넣을 때예요' : '나라 공휴일이 바뀌었어요'}</b><span class="s2">${esc(line)} · 대체·임시공휴일 포함</span></span><button class="pri sm" data-act="holApply" data-id="${L.map(x => x.y).join(',')}">${allNew ? '넣기' : '반영'}</button></div></section>`;
}
async function holSheet() {
  const y = new Date().getFullYear(), years = [y - 1, y, y + 1, y + 2];
  await Promise.all(years.map(loadHol));
  sheet(`<div class="ttl" style="font-size:24px">공휴일</div>
<div class="sub">나라에서 정한 공휴일(대체공휴일·선거일 같은 임시공휴일 포함)을 해마다 불러와 캘린더에 빨간 날로 보여 줘요. 관리자에게는 일주일에 한 번 바뀐 게 있는지 살펴서 알려 드려요.</div>
<div class="holyears">${years.map(x => { const h = HOL.y[x]; return `<div class="holy"><b>${x}년</b><span class="s2">${h ? `${Object.keys(h.days || {}).length}일 · ${esc((h.at || '').slice(5, 10).replace('-', '/'))} 넣음` : '아직 없어요'}</span><span class="holbtns">${h ? `<button class="ghost sm danger" data-act="holDel" data-id="${x}">지우기</button>` : ''}<button class="ghost sm" data-act="holLoad" data-id="${x}">${h ? '다시 확인' : '불러오기'}</button></span></div>`; }).join('')}</div>
<div id="holPrev"></div>
<div class="btns"><button class="sec" data-act="sheetClose">닫기</button></div>`);
}
async function holLoad(y) {
  const box = $('#holPrev'); if (box) box.innerHTML = '<div class="sub">최신 공휴일을 받아 오는 중…</div>';
  const got = await fetchHolidays(y);
  if (!got) { if (box) box.innerHTML = `<div class="sub">${y}년 공휴일 자료가 아직 나오지 않았어요. 보통 전년도 여름에 발표돼요.</div>`; return; }
  const cur = HOL.y[y], diff = holDiff(cur ? cur.days : {}, got.days);
  HOL.pending = { y, got };
  const mark = d => diff.add.includes(d) ? '<span class="tag">새로</span>' : diff.chg.includes(d) ? '<span class="tag g">바뀜</span>' : '';
  if (box) box.innerHTML = `<section class="card"><div class="lbl"><span>${y}년 · ${Object.keys(got.days).length}일</span><span class="s2">${got.src === 'builtin' ? '앱에 들어 있는 표' : '최신 자료'}</span></div>
${cur && !diff.n ? '<div class="sub">지금 넣어 둔 것과 같아요.</div>' : ''}
<div class="hollist">${Object.keys(got.days).sort().map(d => `<div class="holrow"><span class="d">${fmtShort(d)} ${DOW[parseD(d).getDay()]}</span><span class="grow">${esc(got.days[d])}</span>${mark(d)}</div>`).join('')}${diff.del.map(d => `<div class="holrow del"><span class="d">${fmtShort(d)}</span><span class="grow">${esc(cur.days[d])}</span><span class="tag g">빠짐</span></div>`).join('')}</div>
${!cur || diff.n ? `<button class="pri" data-act="holApply" data-id="${y}">${cur ? '바뀐 것 반영하기' : '캘린더에 넣기'}</button>` : ''}</section>`;
}

/* ---------- 구글 연결 공통 (클라이언트 ID · 토큰) ---------- */
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const GREAD_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GAPI = 'https://www.googleapis.com/calendar/v3';
const CFG = { loaded: false, gcalClientId: '' };
async function loadCfg() {
  if (CFG.loaded) return CFG;
  try { const s = await getDoc(doc(db, 'config', 'app')); if (s.exists()) Object.assign(CFG, s.data()); } catch { /* 없음 */ }
  CFG.loaded = true; return CFG;
}
let gisP = null;
function loadGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisP = null; rej(new Error('구글 연결 도구를 불러오지 못했어요')); };
    document.head.appendChild(s);
  }));
}
const GTOK = {};
function gTokGet(scope) {
  const t = GTOK[scope]; if (t && Date.now() < t.exp - 60000) return t.t;
  try { const o = JSON.parse(sessionStorage.getItem('jc_gtok_' + scope.split('/').pop()) || 'null'); if (o && o.e === S.me.email && Date.now() < o.exp - 60000) { GTOK[scope] = o; return o.t; } } catch { /* 없음 */ }
  return '';
}
function gTokSet(scope, t, sec) {
  const o = { t, exp: Date.now() + Math.min(3500, Number(sec) || 3500) * 1000, e: S.me.email }; GTOK[scope] = o;
  try { sessionStorage.setItem('jc_gtok_' + scope.split('/').pop(), JSON.stringify(o)); } catch { /* 괜찮아요 */ }
}
function gTokDrop(scope) { delete GTOK[scope]; try { sessionStorage.removeItem('jc_gtok_' + scope.split('/').pop()); } catch { /* 괜찮아요 */ } }
// 반드시 버튼을 누른 그 순간에 불러야 구글 창이 막히지 않아요
function gAsk(scope) {
  return new Promise((res, rej) => {
    if (!CFG.gcalClientId) return rej(new Error('관리자가 설정에서 "구글 연결 설정(클라이언트 ID)"을 먼저 넣어야 해요'));
    if (!(window.google && google.accounts && google.accounts.oauth2)) { loadGIS().catch(() => { }); return rej(new Error('구글 연결을 준비하는 중이에요. 한 번 더 눌러 주세요')); }
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: CFG.gcalClientId, scope, login_hint: S.me.email, prompt: '',
      callback: r => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        if (google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes(r, scope)) return rej(new Error('구글 창에서 캘린더 칸에 체크해 주세요'));
        gTokSet(scope, r.access_token, r.expires_in); res(r.access_token);
      },
      error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? '구글 창이 닫혔어요' : e && e.type === 'popup_failed_to_open' ? '구글 창이 막혔어요. 팝업을 허용해 주세요' : (e && (e.message || e.type)) || '구글 연결 오류'))
    });
    tc.requestAccessToken();
  });
}
async function gReq(tok, path, opt = {}) {
  const r = await fetch(GAPI + path, { method: opt.method || 'GET', headers: { Authorization: 'Bearer ' + tok, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || ('구글 오류 ' + r.status)); e.status = r.status; throw e; }
  return j;
}
const gPrep = () => { loadCfg().then(c => { if (c.gcalClientId) loadGIS().catch(() => { }); }); };

/* ---------- 바깥 캘린더 가져오기 (관리자 이상) ---------- */
const IMP = { step: 'pick', list: null, items: null, name: '', src: '', from: '', to: '', kind: '행사', cals: null, batches: null };
const kstParts = ms => { const d = new Date(ms + 9 * 3600e3); return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; };
function tzOffsetMs(tz, ms) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  } catch { return 9 * 3600e3; }
}
// 20261121 / 20261121T133000 / 20261121T043000Z → 한국 시간
function icsTime(v, P = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v).trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || P.VALUE === 'DATE') return { allDay: true, date, time: '' };
  const local = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let utc;
  if (m[7]) utc = local;
  else if (P.TZID && !/seoul/i.test(P.TZID)) utc = local - tzOffsetMs(P.TZID.replace(/^"|"$/g, ''), local);
  else return { allDay: false, date, time: `${m[4]}:${m[5]}` };
  return { allDay: false, ...kstParts(utc) };
}
const icsUnesc = s => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
function parseICS(txt) {
  const lines = String(txt).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const evs = []; let cur = null, calName = '';
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (ln === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; continue; }
    const i = ln.indexOf(':'); if (i < 0) continue;
    const head = ln.slice(0, i), v = ln.slice(i + 1), [nm, ...ps] = head.split(';'), P = {};
    ps.forEach(p => { const j = p.indexOf('='); if (j > 0) P[p.slice(0, j).toUpperCase()] = p.slice(j + 1); });
    const N = nm.toUpperCase();
    if (!cur) { if (N === 'X-WR-CALNAME') calName = icsUnesc(v); continue; }
    if (N === 'SUMMARY') cur.title = icsUnesc(v);
    else if (N === 'LOCATION') cur.place = icsUnesc(v);
    else if (N === 'DESCRIPTION') cur.memo = icsUnesc(v).replace(/<[^>]+>/g, ' ').slice(0, 1000);
    else if (N === 'DTSTART') cur.s = icsTime(v, P);
    else if (N === 'DTEND') cur.e = icsTime(v, P);
    else if (N === 'DURATION') cur.dur = v;
    else if (N === 'UID') cur.uid = v.trim();
    else if (N === 'RRULE') cur.rrule = v.trim();
    else if (N === 'EXDATE') v.split(',').forEach(x => { const t = icsTime(x, P); if (t) cur.ex.push(t.date); });
    else if (N === 'RECURRENCE-ID') cur.rid = icsTime(v, P);
    else if (N === 'STATUS') cur.status = v.trim().toUpperCase();
  }
  return { calName, evs };
}
const dayDiff = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
function durMin(s) { const m = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(s || ''); return m ? ((+m[1] || 0) * 7 * 1440 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0)) : 0; }
function addMin(date, time, min) { const [h, mi] = time.split(':').map(Number); const t = Date.UTC(...date.split('-').map((x, i) => i === 1 ? x - 1 : +x), h, mi) + min * 6e4; const d = new Date(t); return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; }
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
// 반복 일정 펼치기 (매일 · 매주 · 매달 · 매년, 간격 · 횟수 · 끝 날짜 · 요일)
function expandRule(start, rule, from, to) {
  const R0 = Object.fromEntries(rule.split(';').map(x => x.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  const F = R0.FREQ, iv = Math.max(1, +R0.INTERVAL || 1), cnt = +R0.COUNT || 0;
  const until = R0.UNTIL ? (icsTime(R0.UNTIL) || {}).date : '';
  const by = (R0.BYDAY || '').split(',').filter(Boolean).map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, d: WD[m[2]] } : null; }).filter(Boolean);
  const bmd = (R0.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
  const out = []; let n = 0, guard = 0;
  const push = d => { if (d < start) return true; if (until && d > until) return false; if (cnt && n >= cnt) return false; n++; if (d >= from && d <= to) out.push(d); return d <= to || cnt; };
  const sd = parseD(start);
  const nth = (y, m, w, k) => { if (k > 0) { const f = new Date(y, m, 1); const off = (w - f.getDay() + 7) % 7; const d = new Date(y, m, 1 + off + (k - 1) * 7); return d.getMonth() === m ? ymd(d) : ''; } const l = new Date(y, m + 1, 0); const off = (l.getDay() - w + 7) % 7; const d = new Date(y, m + 1, 0 - off + (k + 1) * 7); return d.getMonth() === m ? ymd(d) : ''; };
  if (F === 'DAILY') { for (let d = start; guard++ < 3000; d = addDays(d, iv)) { if (d > to && !cnt) break; if (!push(d)) break; } }
  else if (F === 'WEEKLY') {
    const days = by.length ? by.map(x => x.d).sort() : [sd.getDay()];
    for (let w = ymd(sundayOnOrBefore(sd)); guard++ < 800; w = addDays(w, 7 * iv)) { let go = true; for (const dw of days) { if (!push(addDays(w, dw))) { go = false; break; } } if (!go || (w > to && !cnt)) break; }
  } else if (F === 'MONTHLY') {
    for (let k = 0; guard++ < 400; k += iv) {
      const y = sd.getFullYear() + Math.floor((sd.getMonth() + k) / 12), m = (sd.getMonth() + k) % 12;
      let ds = by.length ? by.map(b => b.n ? nth(y, m, b.d, b.n) : '').filter(Boolean) : bmd.length ? bmd.map(x => { const L = new Date(y, m + 1, 0).getDate(); const dd = x < 0 ? L + 1 + x : x; return dd >= 1 && dd <= L ? ymd(new Date(y, m, dd)) : ''; }).filter(Boolean) : [new Date(y, m, sd.getDate()).getMonth() === m ? ymd(new Date(y, m, sd.getDate())) : ''].filter(Boolean);
      ds = ds.sort(); let go = true; for (const d of ds) if (!push(d)) { go = false; break; }
      if (!go || (`${y}-${pad(m + 1)}-01` > to && !cnt)) break;
    }
  } else if (F === 'YEARLY') {
    const bm = R0.BYMONTH ? +R0.BYMONTH - 1 : sd.getMonth();
    for (let k = 0; guard++ < 120; k += iv) {
      const y = sd.getFullYear() + k;
      const d = by.length && by[0].n ? nth(y, bm, by[0].d, by[0].n) : (new Date(y, bm, sd.getDate()).getMonth() === bm ? ymd(new Date(y, bm, sd.getDate())) : '');
      if (d && !push(d)) break; if (`${y}-01-01` > to && !cnt) break;
    }
  } else out.push(start);
  return out;
}
// .ics → 앱 일정 목록 (기간 안의 것만)
function icsToItems(parsed, from, to) {
  const items = [], overrides = new Set();
  parsed.evs.filter(e => e.rid && e.uid).forEach(e => overrides.add(e.uid + '|' + e.rid.date));
  for (const e of parsed.evs) {
    if (!e.s || e.status === 'CANCELLED') continue;
    let spanD = 0, endT = '';
    if (e.s.allDay) { const ed = e.e ? addDays(e.e.date, -1) : e.dur ? addDays(e.s.date, Math.max(0, Math.round(durMin(e.dur) / 1440) - 1)) : e.s.date; spanD = Math.max(0, dayDiff(e.s.date, ed)); }
    else { const en = e.e ? e.e : e.dur ? addMin(e.s.date, e.s.time, durMin(e.dur)) : addMin(e.s.date, e.s.time, 60); spanD = Math.max(0, dayDiff(e.s.date, en.date)); endT = en.time; }
    const dates = e.rrule && !e.rid ? expandRule(e.s.date, e.rrule, from, to).filter(d => !e.ex.includes(d) && !overrides.has(e.uid + '|' + d)) : (e.s.date >= from && e.s.date <= to ? [e.s.date] : []);
    dates.forEach(d => items.push({ title: e.title || '(제목 없음)', date: d, endDate: spanD ? addDays(d, spanD) : '', allDay: !!e.s.allDay, time: e.s.allDay ? '' : e.s.time, endTime: e.s.allDay ? '' : endT, place: e.place || '', memo: e.memo || '', gid: (e.uid || e.title + e.s.date) + '|' + d }));
  }
  return items.sort((a, b) => ko(a.date + a.time, b.date + b.time));
}
// 구글 캘린더 API 일정 → 앱 일정
function gToItem(g) {
  if (!g.start || g.status === 'cancelled') return null;
  let date, endDate = '', time = '', endTime = '', allDay = false;
  if (g.start.date) { allDay = true; date = g.start.date; const ed = g.end && g.end.date ? addDays(g.end.date, -1) : date; endDate = ed > date ? ed : ''; }
  else { const s = kstParts(Date.parse(g.start.dateTime)), e = g.end && g.end.dateTime ? kstParts(Date.parse(g.end.dateTime)) : addMin(s.date, s.time, 60); date = s.date; time = s.time; endTime = e.time; endDate = e.date > date ? e.date : ''; }
  return { title: g.summary || '(제목 없음)', date, endDate, allDay, time, endTime, place: g.location || '', memo: String(g.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1000), gid: (g.iCalUID || g.id) + '|' + date };
}
async function impSheet() {
  if (!isAdminMe()) return;
  if (IMP.batches === null) { IMP.batches = []; try { const s = await getDocs(collection(db, 'imports')); IMP.batches = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ko(b.at || '', a.at || '')); } catch { IMP.batches = []; } }
  const y = new Date().getFullYear();
  if (!IMP.from) { IMP.from = `${y}-01-01`; IMP.to = `${y + 1}-12-31`; }
  loadCfg().then(() => { if (CFG.gcalClientId) loadGIS().catch(() => { }); });
  const items = IMP.items;
  const have = new Set((R.events || []).map(e => e.gid).filter(Boolean));
  const body = IMP.step === 'preview' && items ? `
<section class="card"><div class="lbl"><span>${esc(IMP.name)}</span><span class="s2">${items.length}개 찾음</span></div>
<div class="two"><label class="fld">이 날부터<input class="in" type="date" id="im_from" value="${IMP.from}"></label><label class="fld">이 날까지<input class="in" type="date" id="im_to" value="${IMP.to}"></label></div>
<label class="fld">묶음 이름 <span class="s2">(나중에 한 번에 지울 때 보여요)</span><input class="in" id="im_name" value="${esc(IMP.name)}"></label>
<div class="fld">종류</div><div class="kindgrid k4">${['행사', '회의', '교육', '기타'].map(k => `<label class="kindopt ${IMP.kind === k ? 'on' : ''}"><input type="radio" name="im_kind" value="${k}" ${IMP.kind === k ? 'checked' : ''}><i class="cdot ${KIND_CLASS[k] || 'evt'}"></i>${k}</label>`).join('')}</div>
<div class="imtools"><button class="ghost sm" data-act="impAll" data-id="1">모두 고르기</button><button class="ghost sm" data-act="impAll" data-id="0">모두 빼기</button><span class="s2" id="im_cnt"></span></div>
<div class="imlist">${items.map((x, i) => { const dup = have.has(x.gid); return `<label class="imrow ${dup ? 'dup' : ''}"><input type="checkbox" data-im="${i}" ${dup ? '' : 'checked'}><span class="d">${fmtShort(x.date)}${x.endDate ? '–' + fmtShort(x.endDate) : ''}</span><span class="grow"><b>${esc(x.title)}</b><small>${esc([timeText(x), x.place].filter(Boolean).join(' · '))}${dup ? ' · 이미 있어요' : ''}</small></span></label>`; }).join('') || '<div class="sub">이 기간에는 일정이 없어요.</div>'}</div>
<div class="btns"><button class="pri" data-act="impRun">고른 일정 가져오기</button><button class="sec" data-act="impBack">다시 고르기</button></div><div class="sub" id="im_msg"></div></section>` : `
<div class="impick">
<label class="imopt">${svg('<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>', 26, 1.8)}<b>.ics 파일로</b><small>구글 캘린더 → 설정 → 가져오기/내보내기 → 내보내기 (컴퓨터)</small><input type="file" id="im_file" accept=".ics,text/calendar" hidden></label>
<button class="imopt" data-act="impGoogle">${svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', 26, 1.8)}<b>구글 캘린더에서 바로</b><small>${CFG.gcalClientId ? '내 구글 계정의 캘린더 목록에서 골라요 (보기 권한만)' : '설정 → 구글 연결 설정을 먼저 해 주세요'}</small></button>
</div>
${IMP.cals ? `<section class="card"><div class="lbl"><span>어느 캘린더를 가져올까요?</span></div><div class="list">${IMP.cals.map(c => `<button class="row" data-act="impCal" data-id="${esc(c.id)}"><i class="cdot" style="background:${esc(c.backgroundColor || '#C62828')}"></i><span class="grow"><span class="nm">${esc(c.summaryOverride || c.summary || c.id)}</span><span class="sub">${c.primary ? '내 기본 캘린더' : esc(c.accessRole === 'owner' ? '내가 만든 캘린더' : '구독 · 공유')}</span></span><span class="chev">›</span></button>`).join('')}</div></section>` : ''}
<div class="sub" id="im_msg"></div>`;
  const hist = IMP.batches.length ? `<section class="card"><div class="lbl"><span>가져온 기록</span><span class="s2">잘못 가져왔으면 묶음째 지워요</span></div>${IMP.batches.map(b => { const left = (R.events || []).filter(e => e.importBatch === b.id).length; return `<div class="hrow imb"><span class="grow"><b>${esc(b.name || '가져온 일정')}</b><span class="s2">${esc((b.at || '').slice(0, 10))} · ${esc(b.byName || '')} · 일정 ${left}개${b.songs ? ` · 찬양 ${b.songs}곡` : ''}${b.counts ? ` · 인원 ${b.counts}주` : ''}</span></span><button class="ghost sm danger" data-act="impDelAsk" data-id="${b.id}">묶음 지우기</button></div>`; }).join('')}</section>` : '';
  sheet(`<div class="ttl" style="font-size:24px">바깥 캘린더 가져오기</div><div class="sub">교회 · 부서 구글 캘린더의 일정을 한 번에 교사실 캘린더로 옮겨요. 가져온 일정은 묶음으로 기억해서, 잘못 가져왔으면 한 번에 지울 수 있어요.</div>${body}${hist}<div class="btns"><button class="sec" data-act="sheetClose">닫기</button></div>`);
  const box = $('#sheet');
  const cnt = () => { const c = $('#im_cnt'); if (c) c.textContent = `${box.querySelectorAll('[data-im]:checked').length}개 고름`; };
  cnt();
  box.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.dataset.im !== undefined) cnt();
    if (t.name === 'im_kind') { IMP.kind = t.value; box.querySelectorAll('.kindopt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); }
    if (t.id === 'im_file' && t.files[0]) {
      const f = t.files[0]; const txt = await f.text();
      IMP.parsed = parseICS(txt); IMP.src = 'ics'; IMP.name = IMP.parsed.calName || f.name.replace(/\.ics$/i, '');
      IMP.items = icsToItems(IMP.parsed, IMP.from, IMP.to); IMP.step = 'preview'; impSheet();
    }
    if ((t.id === 'im_from' || t.id === 'im_to') && t.value) {
      IMP.from = val('im_from'); IMP.to = val('im_to'); IMP.name = val('im_name') || IMP.name;
      if (IMP.src === 'ics') { IMP.items = icsToItems(IMP.parsed, IMP.from, IMP.to); impSheet(); } else if (IMP.calId) impFetchGoogle(IMP.calId, IMP.name);
    }
  });
}
async function impFetchGoogle(calId, name) {
  const msg = $('#im_msg'); if (msg) msg.textContent = '구글 캘린더에서 받아 오는 중…';
  try {
    let tok = gTokGet(GREAD_SCOPE); if (!tok) throw new Error('구글 허락이 끝났어요. 다시 눌러 주세요');
    const all = []; let pt = '';
    do {
      const p = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeMin: `${IMP.from}T00:00:00+09:00`, timeMax: `${addDays(IMP.to, 1)}T00:00:00+09:00`, timeZone: 'Asia/Seoul' }); if (pt) p.set('pageToken', pt);
      const j = await gReq(tok, `/calendars/${encodeURIComponent(calId)}/events?${p}`); (j.items || []).forEach(g => all.push(g)); pt = j.nextPageToken || '';
    } while (pt && all.length < 5000);
    IMP.calId = calId; IMP.src = 'google'; IMP.name = name; IMP.items = all.map(gToItem).filter(Boolean).filter(x => x.date >= IMP.from && x.date <= IMP.to); IMP.step = 'preview'; impSheet();
  } catch (e) { if (msg) msg.textContent = ''; toast('가져오지 못했어요: ' + e.message); }
}
async function impRun() {
  const box = $('#sheet'); const pick = [...box.querySelectorAll('[data-im]:checked')].map(x => IMP.items[+x.dataset.im]);
  if (!pick.length) return toast('가져올 일정을 골라 주세요');
  const name = val('im_name') || IMP.name || '가져온 일정', kind = IMP.kind;
  const msg = $('#im_msg'); msg.textContent = `${pick.length}개 넣는 중…`;
  const bref = doc(collection(db, 'imports')), bid = bref.id;
  const rows = pick.map(x => ({ ref: doc(collection(db, 'events')), data: { ...x, kind, memo: x.memo || '', staffId: '', imgCount: 0, by: S.me.email, byName: myName(), importBatch: bid, source: IMP.src } }));
  try {
    for (let i = 0; i < rows.length; i += 400) { const b = writeBatch(db); rows.slice(i, i + 400).forEach(r => b.set(r.ref, r.data)); await b.commit(); msg.textContent = `${Math.min(rows.length, i + 400)} / ${rows.length}`; }
    const meta = { name, count: rows.length, src: IMP.src, from: IMP.from, to: IMP.to, at: new Date().toISOString(), by: S.me.email, byName: myName() };
    await setDoc(bref, meta);
    rows.forEach(r => R.events.push({ id: r.ref.id, ...r.data }));
    (IMP.batches || (IMP.batches = [])).unshift({ id: bid, ...meta });
    IMP.step = 'pick'; IMP.items = null; IMP.cals = null;
    closeSheet(); toast(`${rows.length}개를 가져왔어요 · 캘린더 → 가져오기에서 묶음째 지울 수 있어요`); gcalSoon(); paint();
  } catch (e) { msg.textContent = ''; toast('가져오지 못했어요: ' + errMsg(e)); }
}
async function impDel(bid) {
  try {
    let ids = (R.events || []).filter(e => e.importBatch === bid).map(e => e.id);
    try { const s = await getDocs(query(collection(db, 'events'), where('importBatch', '==', bid))); ids = [...new Set([...ids, ...s.docs.map(d => d.id)])]; } catch { /* 가진 것만 */ }
    for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(doc(db, 'events', id))); await b.commit(); }
    let more = 0;
    for (const col of ['songs', 'setlists', 'counts']) {
      try { const s = await getDocs(query(collection(db, col), where('importBatch', '==', bid))); for (let i = 0; i < s.docs.length; i += 400) { const b = writeBatch(db); s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); } more += s.docs.length; } catch { /* 없음 */ }
    }
    if (more) { W.songs = {}; W.setlist = {}; CNT.rows = null; HIST.rows = null; }
    await deleteDoc(doc(db, 'imports', bid));
    R.events = (R.events || []).filter(e => e.importBatch !== bid);
    IMP.batches = (IMP.batches || []).filter(b => b.id !== bid);
    toast(`${ids.length}개를 지웠어요`); gcalSoon(); IMP.step = 'pick'; impSheet(); softPaint();
  } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}

/* ---------- 내 구글 캘린더에 넣기 (선생님마다) ----------
   목자의 삶에서 쓴 방식: 내 구글 캘린더에 '조이코너' 캘린더를 따로 하나 만들고 그곳에만 써요.
   권한은 '앱이 만든 캘린더만' (calendar.app.created) — 다른 캘린더는 못 보고 못 건드려요.
   제목 · 시간 · 장소만 넣어요. 서버가 없어서 구글 허락은 1시간 — 그 뒤 바뀐 게 있으면 [맞추기]. */
const GC = { doc: undefined, busy: false, again: false, t: null, msg: '' };
async function gcalLoad() {
  if (GC.doc !== undefined) return GC.doc;
  GC.doc = null;
  try { const s = await getDoc(doc(db, 'gcal', S.me.email)); GC.doc = s.exists() ? s.data() : null; } catch { GC.doc = null; }
  return GC.doc;
}
const gcalOn = () => !!(GC.doc && GC.doc.on);
const gcalOpts = () => Object.assign({ events: true, turns: true }, (GC.doc && GC.doc.opts) || {});
function gEvBody(e) {
  const allDay = e.allDay !== undefined ? e.allDay : !e.time, end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
  const r = { summary: e.title || '일정', location: e.place || '', description: '조이코너 노트에서 넣은 일정이에요', transparency: allDay ? 'transparent' : 'opaque' };
  if (allDay || !e.time) { r.start = { date: e.date }; r.end = { date: addDays(end, 1) }; }
  else {
    let et = e.endTime || (end > e.date ? e.time : plusHour(e.time));
    if (end === e.date && et <= e.time) et = e.time;
    r.start = { dateTime: `${e.date}T${e.time}:00`, timeZone: 'Asia/Seoul' }; r.end = { dateTime: `${end}T${et}:00`, timeZone: 'Asia/Seoul' };
  }
  return r;
}
function myTurnsOn(s) {
  const me = myName(); if (!me || !s || s.noService) return [];
  const L = TURN_KEYS.filter(([k]) => hasName(s[k], me)).map(([, l]) => l);
  if (s.offering && hasName(s.offering, me)) L.push('헌금기도');
  return L;
}
function gcalWant() {
  const o = gcalOpts(), today = ymd(new Date()), from = addDays(today, -31), to = addDays(today, 400), out = {};
  const mineStaff = (S.staff.find(x => x.email === S.me.email) || {}).id;
  if (o.events) (R.events || []).forEach(e => {
    const end = e.endDate || e.date; if (end < from || e.date > to) return;
    if (e.kind === '부재' && e.by !== S.me.email && e.staffId !== mineStaff) return;
    out['e' + e.id] = gEvBody(e);
  });
  if (o.turns) S.schedule.forEach(s => {
    if (s.date < from || s.date > to) return;
    const m = myTurnsOn(s); if (!m.length) return;
    out['t' + s.date] = { summary: `조이코너 · ${m.join(' · ')}`, location: '', description: `${s.story ? '성경이야기: ' + s.story + '\n' : ''}조이코너 노트의 내 주일 순서예요`, start: { date: s.date }, end: { date: addDays(s.date, 1) }, transparency: 'transparent' };
  });
  return out;
}
const gHash = o => String(hash(JSON.stringify(o)));
function gcalPlan() {
  const want = gcalWant(), have = (GC.doc && GC.doc.items) || {}, ops = [];
  Object.keys(want).forEach(k => { const h = gHash(want[k]); if (!have[k]) ops.push({ k, op: 'add', body: want[k], h }); else if (have[k].h !== h) ops.push({ k, op: 'put', body: want[k], h, gid: have[k].id }); });
  Object.keys(have).forEach(k => { if (!want[k]) ops.push({ k, op: 'del', gid: have[k].id }); });
  return ops;
}
const gcalPending = () => gcalOn() && Array.isArray(R.events) ? gcalPlan().length : 0;
// 일정이 바뀌면 조금 뒤에 구글에도 보내요 (허락이 남아 있을 때만 — 없으면 [맞추기]가 떠요)
function gcalSoon() {
  if (!gcalOn()) return;
  clearTimeout(GC.t);
  GC.t = setTimeout(() => { if (gTokGet(GCAL_SCOPE)) gcalSync(); else softPaint(); }, 1200);
}
async function gcalSync() {
  if (!gcalOn()) return;
  if (GC.busy) { GC.again = true; return; }
  const tok = gTokGet(GCAL_SCOPE); if (!tok) { softPaint(); return; }
  GC.busy = true; GC.msg = '구글 캘린더와 맞추는 중…'; softPaint();
  const d = GC.doc, items = { ...(d.items || {}) };
  let done = 0, fail = 0;
  try {
    if (!GC.checked && d.calId) { try { await gReq(tok, `/calendars/${encodeURIComponent(d.calId)}`); } catch (e) { if (e.status === 404 || e.status === 410) { d.calId = ''; Object.keys(items).forEach(k => delete items[k]); } else throw e; } GC.checked = true; }
    if (!d.calId) {
      const c = await gReq(tok, '/calendars', { method: 'POST', body: { summary: '조이코너', description: '조이코너 노트 앱이 넣는 일정이에요. 앱에서 고치면 여기도 따라 바뀌어요.', timeZone: 'Asia/Seoul' } });
      d.calId = c.id; GC.checked = true;
      gReq(tok, `/users/me/calendarList/${encodeURIComponent(c.id)}?colorRgbFormat=true`, { method: 'PATCH', body: { backgroundColor: '#C62828', foregroundColor: '#FFFFFF' } }).catch(() => { });
    }
    d.items = items;
    const ops = gcalPlan(), cal = `/calendars/${encodeURIComponent(d.calId)}/events`;
    const run = async o => {
      try {
        if (o.op === 'add') { const r = await gReq(tok, cal, { method: 'POST', body: o.body }); items[o.k] = { id: r.id, h: o.h }; }
        else if (o.op === 'put') { try { await gReq(tok, `${cal}/${encodeURIComponent(o.gid)}`, { method: 'PUT', body: o.body }); items[o.k] = { id: o.gid, h: o.h }; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; const r = await gReq(tok, cal, { method: 'POST', body: o.body }); items[o.k] = { id: r.id, h: o.h }; } }
        else { try { await gReq(tok, `${cal}/${encodeURIComponent(o.gid)}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; } delete items[o.k]; }
        done++;
      } catch (e) { if (e.status === 401) throw e; fail++; }
    };
    for (let i = 0; i < ops.length; i += 4) { await Promise.all(ops.slice(i, i + 4).map(run)); if (ops.length > 8) { GC.msg = `구글 캘린더와 맞추는 중… ${Math.min(ops.length, i + 4)}/${ops.length}`; softPaint(); } }
    d.on = true; d.at = new Date().toISOString(); d.items = items;
    await setDoc(doc(db, 'gcal', S.me.email), { on: true, calId: d.calId, items, opts: gcalOpts(), at: d.at });
    GC.msg = fail ? `${fail}개는 보내지 못했어요 — 다시 맞추기를 눌러 주세요` : '';
    if (done && GC.loud) toast(`구글 캘린더에 ${done}개를 맞췄어요`);
  } catch (e) {
    if (e.status === 401) { gTokDrop(GCAL_SCOPE); GC.msg = ''; }
    else { GC.msg = '구글 캘린더와 맞추지 못했어요: ' + e.message; }
    d.items = items;
    setDoc(doc(db, 'gcal', S.me.email), { on: true, calId: d.calId || '', items, opts: gcalOpts(), at: d.at || '' }).catch(() => { });
  } finally {
    GC.busy = false; GC.loud = false; softPaint();
    if (GC.again) { GC.again = false; gcalSync(); }
  }
}
async function gcalConnect() {
  try {
    await gAsk(GCAL_SCOPE);
    await gcalLoad();
    GC.doc = Object.assign({ items: {}, calId: '' }, GC.doc || {}, { on: true });
    GC.loud = true; GC.checked = false;
    await gcalSync();
    if (!GC.msg) toast('연결했어요 · 구글 캘린더에 "조이코너" 캘린더가 생겼어요');
    paint();
  } catch (e) { toast(e.message); }
}
async function gcalFix() {
  try { if (!gTokGet(GCAL_SCOPE)) await gAsk(GCAL_SCOPE); GC.loud = true; await gcalSync(); paint(); } catch (e) { toast(e.message); }
}
async function gcalOff() {
  try {
    let tok = gTokGet(GCAL_SCOPE); if (!tok) tok = await gAsk(GCAL_SCOPE);
    if (GC.doc && GC.doc.calId) { try { await gReq(tok, `/calendars/${encodeURIComponent(GC.doc.calId)}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; } }
    try { google.accounts.oauth2.revoke(tok, () => { }); } catch { /* 괜찮아요 */ }
    gTokDrop(GCAL_SCOPE);
    await setDoc(doc(db, 'gcal', S.me.email), { on: false, calId: '', items: {}, opts: gcalOpts(), at: new Date().toISOString() });
    GC.doc = { on: false, calId: '', items: {}, opts: gcalOpts() };
    closeSheet(); toast('연결을 끊고 구글의 "조이코너" 캘린더도 지웠어요'); paint();
  } catch (e) { toast('끊지 못했어요: ' + e.message); }
}
function gcalBanner() {
  if (!gcalOn()) return '';
  if (GC.busy || GC.msg) return `<section class="card banner soft full"><div class="bnrow">${svg('<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>', 20, 1.9)}<span class="grow">${esc(GC.msg || '구글 캘린더와 맞추는 중…')}</span>${GC.busy ? '' : '<button class="ghost sm" data-act="gcalFix">다시 맞추기</button>'}</div></section>`;
  const n = gcalPending(); if (!n) return '';
  return `<section class="card banner soft full"><div class="bnrow">${svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', 20, 1.9)}<span class="grow"><b>구글 캘린더에 아직 안 보낸 변경 ${n}개</b><span class="s2">한 번 누르면 맞춰져요</span></span><button class="pri sm" data-act="gcalFix">맞추기</button></div></section>`;
}
function gcalCard() {
  const on = gcalOn(), o = gcalOpts(), n = Object.keys((GC.doc && GC.doc.items) || {}).length;
  return `<section class="card gccard"><div class="lbl"><span>내 구글 캘린더</span>${on ? `<span class="chip sm" style="background:#DDF1E3;color:#1E6B3E">연결됨</span>` : ''}</div>
${on ? `<div class="sub">구글 캘린더의 <b>조이코너</b> 캘린더에 ${n}개가 들어 있어요.${GC.doc.at ? ` 마지막 맞춤 ${esc(GC.doc.at.slice(5, 16).replace('T', ' ').replace('-', '/'))}` : ''}</div>
<div class="gcopts"><label class="switch"><input type="checkbox" data-gopt="events" ${o.events ? 'checked' : ''}><span class="sw"></span><b>교사실 일정</b></label><label class="switch"><input type="checkbox" data-gopt="turns" ${o.turns ? 'checked' : ''}><span class="sw"></span><b>내 주일 순서</b></label></div>
<div class="btns"><button class="sec" data-act="gcalFix">지금 맞추기</button><button class="ghost danger" data-act="gcalOffAsk">연결 끊기</button></div>`
      : `<div class="sub">교사실 일정과 내 주일 순서를 내 구글 캘린더에 자동으로 넣어요. 앱에서 고치면 구글도 따라 바뀌고, 알림은 구글 캘린더가 울려 줘요. 제목 · 시간 · 장소만 들어가요.</div><button class="sec" data-act="gcalConnect">구글 캘린더 연결하기</button>`}</section>`;
}
function gcalSettingsCard() {
  if (!isAdminMe()) return '';
  const set = !!CFG.gcalClientId;
  return `<section class="card gset"><div class="lbl"><span>구글 캘린더 연결 설정</span><span class="s2">관리자 · 처음 한 번</span></div>
<div class="gstate ${set ? 'ok' : ''}">${svg(set ? '<path d="M5 12l5 5 9-10"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>', 20, 2.2)}<span class="grow"><b>${set ? '설정됨 · 구글 캘린더 기능이 켜져 있어요' : '아직 설정 전이에요'}</b><small>${set ? '선생님들이 "내 구글 캘린더 연결"을, 관리자가 "구글 캘린더에서 바로 가져오기"를 쓸 수 있어요.' : '이걸 넣어야 ① 선생님마다 "내 구글 캘린더에 조이코너 일정 넣기"와 ② 관리자의 "구글 캘린더에서 바로 가져오기"가 켜져요. 쓰지 않으면 비워 둬도 앱은 그대로 잘 돼요.'}</small></span></div>
<details class="drawer gsetd" ${set ? '' : 'open'}><summary><b>${set ? '클라이언트 ID 바꾸기' : '클라이언트 ID 넣기'}</b><span class="s2">구글 클라우드에서 만든 값 · 공개돼도 괜찮아요</span></summary>
<ol class="gsteps"><li>구글 클라우드(joycorner-note) → Calendar API [사용] <span class="s2">— 해 두셨어요</span></li><li>OAuth 동의 화면 → 범위 두 줄 추가 → 앱 게시</li><li>사용자 인증 정보 → 웹 OAuth 클라이언트 → 원본 https://artist4rhythm-hub.github.io</li><li>나온 클라이언트 ID를 아래에 붙여넣고 저장</li></ol>
<label class="fld">OAuth 클라이언트 ID<input class="in" id="cfg_cid" value="${esc(CFG.gcalClientId || '')}" placeholder="940459044878-xxxx.apps.googleusercontent.com"></label><button class="sec" data-act="cfgSave">저장</button>
<div class="s2">자세한 순서: 압축 파일 3_참고/구글캘린더-설정-안내.txt (프로젝트 문서에도 있어요)</div></details></section>`;
}

/* ---------- 버튼 ---------- */
Object.assign(ACT, {
  holSheet: () => holSheet(),
  holLoad: d => holLoad(d.id),
  holApply: async d => {
    if (String(d.id).includes(',')) { for (const y of String(d.id).split(',')) await ACT.holApply({ id: y, quiet: 1 }); return; }
    const y = d.id; let got = HOL.pending && String(HOL.pending.y) === String(y) ? HOL.pending.got : (HOL.chk && (HOL.chk.list.find(x => String(x.y) === String(y)) || {}).got);
    if (!got) got = await fetchHolidays(y);
    if (!got) return toast('공휴일 자료를 받지 못했어요');
    try { await holSave(y, got); if (HOL.chk) HOL.chk.list = HOL.chk.list.filter(x => String(x.y) !== String(y)); HOL.pending = null; toast(`${y}년 공휴일 ${Object.keys(got.days).length}일을 넣었어요`); if ($('#sheet') && $('#holPrev')) holSheet(); paint(); } catch (e) { toast('넣지 못했어요: ' + errMsg(e)); }
  },
  holDel: async d => { try { await deleteDoc(doc(db, 'holidays', String(d.id))); HOL.y[String(d.id)] = null; holSheet(); paint(); toast('지웠어요'); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); } },
  impSheet: () => { IMP.step = 'pick'; IMP.items = null; impSheet(); },
  impBack: () => { IMP.step = 'pick'; IMP.items = null; impSheet(); },
  impAll: d => { document.querySelectorAll('#sheet [data-im]').forEach(x => { x.checked = d.id === '1'; }); const c = $('#im_cnt'); if (c) c.textContent = `${document.querySelectorAll('#sheet [data-im]:checked').length}개 고름`; },
  impGoogle: async () => {
    try {
      await loadCfg();
      let tok = gTokGet(GREAD_SCOPE); if (!tok) tok = await gAsk(GREAD_SCOPE);
      const j = await gReq(tok, '/users/me/calendarList?minAccessRole=reader&maxResults=250');
      IMP.cals = (j.items || []).sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || ko(a.summary || '', b.summary || '')); impSheet();
    } catch (e) { toast(e.message); }
  },
  impCal: d => { const c = (IMP.cals || []).find(x => x.id === d.id) || {}; impFetchGoogle(d.id, c.summaryOverride || c.summary || '구글 캘린더'); },
  impRun: () => impRun(),
  impDelAsk: d => { const b = (IMP.batches || []).find(x => x.id === d.id) || {}; const n = (R.events || []).filter(e => e.importBatch === d.id).length; sheet(`<div class="ttl" style="font-size:22px">묶음 지우기</div><div class="sub">"${esc(b.name || '가져온 일정')}"으로 가져온 일정 ${n}개${b.songs ? `, 찬양 ${b.songs}곡, 주일 인원 ${b.counts || 0}주` : ''}를 모두 지울까요? 가져온 뒤 사진을 붙인 일정도 함께 지워져요.</div><div class="btns"><button class="pri danger" data-act="impDel" data-id="${d.id}">${n}개 지우기</button><button class="sec" data-act="impSheet">돌아가기</button></div>`); },
  impDel: d => impDel(d.id),
  gcalConnect: () => gcalConnect(),
  gcalFix: () => gcalFix(),
  gcalOffAsk: () => sheet(`<div class="ttl" style="font-size:22px">구글 캘린더 연결 끊기</div><div class="sub">내 구글 캘린더의 "조이코너" 캘린더와 그 안의 일정이 지워져요. 앱의 일정은 그대로예요.</div><div class="btns"><button class="pri danger" data-act="gcalOff">끊기</button><button class="sec" data-act="sheetClose">취소</button></div>`),
  gcalOff: () => gcalOff(),
  cfgSave: async () => { const v = val('cfg_cid'); if (v && !/\.apps\.googleusercontent\.com$/.test(v)) return toast('클라이언트 ID는 .apps.googleusercontent.com 으로 끝나요'); try { await setDoc(doc(db, 'config', 'app'), { gcalClientId: v }, { merge: true }); CFG.gcalClientId = v; if (v) loadGIS().catch(() => { }); toast('저장했어요'); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); } }
});
appEl.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.gopt; if (!k || !GC.doc) return;
  GC.doc.opts = { ...gcalOpts(), [k]: e.target.checked };
  setDoc(doc(db, 'gcal', S.me.email), { opts: GC.doc.opts }, { merge: true }).catch(() => { });
  if (gTokGet(GCAL_SCOPE)) gcalSync(); else paint();
});

/* ================= v11 · 카톡 기록 가져오기 · 주일 인원 · 지난 찬양 ================= */

/* ---------- 카톡 교사방 기록 가져오기 (있는 값은 건드리지 않고 빈칸만) ---------- */
async function runKakaoImport(data) {
  const bar = $('#impBar'), fillEl = bar.firstElementChild, msg = $('#impMsg'); bar.classList.remove('hide');
  const say = (t, p) => { msg.textContent = t; if (p !== undefined) fillEl.style.width = Math.round(p * 100) + '%'; };
  try {
    say('지금 앱에 있는 것을 확인하는 중…', 0.05);
    const [songsNow, countsNow, slNow] = await Promise.all([getDocs(collection(db, 'songs')), getDocs(collection(db, 'counts')).catch(() => ({ docs: [] })), getDocs(collection(db, 'setlists'))]);
    const songDates = new Set(songsNow.docs.map(d => d.data().date));
    const countDates = new Set(countsNow.docs.map(d => d.id));
    const slDates = new Set(slNow.docs.map(d => d.id));
    if (!Array.isArray(R.events)) await loadEvents();
    const haveGid = new Set((R.events || []).map(e => e.gid).filter(Boolean));
    const bref = doc(collection(db, 'imports')), bid = bref.id, who = { by: S.me.email, byName: myName() };
    const ops = [], n = { songs: 0, weeks: 0, counts: 0, events: 0, fill: 0, staff: 0, skipSongs: 0, skipCounts: 0, skipEvents: 0, skipFill: 0 };
    for (const s of data.setlists || []) {
      if (songDates.has(s.date)) { n.skipSongs++; continue; }
      n.weeks++;
      s.songs.forEach((g, i) => { ops.push([doc(collection(db, 'songs')), { date: s.date, title: g.title, key: g.key || '', inst: g.inst || '', bpm: g.bpm || '', memo: g.memo || '', link: '', order: i + 1, pages: 0, ...who, importBatch: bid, src: 'kakao' }]); n.songs++; });
      if (!slDates.has(s.date) && (s.leaders || []).length) ops.push([doc(db, 'setlists', s.date), { date: s.date, memo: `찬양 인도: ${s.leaders.join(' · ')}`, ...who, at: new Date().toISOString(), importBatch: bid, src: 'kakao' }]);
    }
    for (const c of data.counts || []) {
      if (countDates.has(c.date)) { n.skipCounts++; continue; }
      ops.push([doc(db, 'counts', c.date), { ...c, ...who, importBatch: bid, src: 'kakao' }]); n.counts++;
    }
    const newEv = [];
    for (const e of data.events || []) {
      if (haveGid.has(e.gid)) { n.skipEvents++; continue; }
      const ref = doc(collection(db, 'events')), d2 = { ...e, staffId: '', imgCount: 0, ...who, importBatch: bid, source: 'kakao' };
      ops.push([ref, d2]); newEv.push({ id: ref.id, ...d2 }); n.events++;
    }
    const fills = [];
    for (const f of data.scheduleFill || []) {
      const s = schedFor(f.date);
      if (!s || String(s[f.field] || '').trim()) { n.skipFill++; continue; }
      ops.push([doc(db, 'schedule', f.date), { [f.field]: f.value }, true]); fills.push(f); n.fill++;
    }
    for (const st of data.newStaff || []) {
      if (S.staff.some(x => x.name === st.name)) continue;
      ops.push([doc(collection(db, 'staff')), { name: st.name, classes: [], classRole: {}, role: 'teacher', kind: '', duties: [], order: 900 + n.staff, since: st.since || '', note: st.note || '', email: '' }]); n.staff++;
    }
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db); ops.slice(i, i + 400).forEach(([r, d, m]) => (m ? b.set(r, d, { merge: true }) : b.set(r, d))); await b.commit();
      say(`올리는 중… ${Math.min(ops.length, i + 400)} / ${ops.length}`, 0.1 + 0.85 * Math.min(1, (i + 400) / ops.length));
    }
    const meta = { name: data.batchName || '카톡 교사방', count: n.events, songs: n.songs, counts: n.counts, src: 'kakao', at: new Date().toISOString(), ...who };
    if (n.events + n.songs + n.counts + n.fill + n.staff) await setDoc(bref, meta);
    if (Array.isArray(R.events)) newEv.forEach(e => R.events.push(e));
    fills.forEach(f => { const s = schedFor(f.date); if (s) s[f.field] = f.value; });
    if (IMP.batches && n.events + n.songs + n.counts) IMP.batches.unshift({ id: bid, ...meta });
    W.songs = {}; W.setlist = {}; CNT.rows = null; HIST.rows = null;
    say('끝났어요', 1);
    if (n.staff) await loadAll();
    const skip = n.skipSongs + n.skipCounts + n.skipEvents + n.skipFill;
    sheet(`<div class="ttl" style="font-size:24px">${n.events + n.songs + n.counts + n.fill + n.staff ? '카톡 기록을 가져왔어요' : '새로 넣을 것이 없어요'}</div>
<div class="kres"><div><b>${n.weeks}주</b><small>주일 찬양 · ${n.songs}곡</small></div><div><b>${n.counts}주</b><small>주일 인원</small></div><div><b>${n.events}개</b><small>일정</small></div><div><b>${n.fill}칸</b><small>순서표 빈칸</small></div><div><b>${n.staff}명</b><small>새 선생님</small></div></div>
${skip ? `<div class="sub">이미 앱에 있어서 건너뛴 것: 찬양 ${n.skipSongs}주 · 인원 ${n.skipCounts}주 · 일정 ${n.skipEvents}개 · 순서표 ${n.skipFill}칸 — 있는 값은 바꾸지 않았어요.</div>` : ''}
${n.events + n.songs + n.counts ? '<div class="s2">잘못 들어갔으면 교사실 → 캘린더 → 바깥 캘린더 가져오기 → 가져온 기록에서 묶음째 지울 수 있어요.</div>' : ''}
<div class="btns"><button class="pri" data-act="sheetClose">확인</button></div>`);
    gcalSoon(); softPaint();
  } catch (e) { say('중간에 멈췄어요: ' + (e.code === 'permission-denied' ? '권한 문제예요. 보안 규칙을 새로 게시했는지 확인해 주세요' : e.message)); }
}

/* ---------- 주일 인원 (교사실 → 통계) ---------- */
const CNT = { rows: null, year: null };
async function loadCounts() {
  if (CNT.rows) return CNT.rows;
  CNT.rows = [];
  await twoStep(collection(db, 'counts'), a => { CNT.rows = a.sort((x, y) => ko(x.date, y.date)); });
  return CNT.rows;
}
function countsCard() {
  if (CNT.rows === null) { loadCounts().then(() => softPaint()); return '<section class="card full"><div class="lbl"><span>주일 인원</span></div><div class="s2">불러오는 중…</div></section>'; }
  const years = [...new Set(CNT.rows.map(r => r.date.slice(0, 4)))].sort();
  const thisY = String(new Date().getFullYear());
  if (!CNT.year) CNT.year = years.includes(thisY) ? thisY : years[years.length - 1] || thisY;
  const rows = CNT.rows.filter(r => r.date.startsWith(CNT.year));
  const tot = r => r.total || ((r.family || 0) + (r.teachers || 0));
  const max = Math.max(1, ...rows.map(tot)), lo = rows.length ? Math.max(0, Math.floor(Math.min(...rows.map(tot)) * 0.8 / 10) * 10) : 0, sc = t => Math.max(6, Math.round((t - lo) / Math.max(1, max - lo) * 100)), avg = rows.length ? Math.round(rows.reduce((s, r) => s + tot(r), 0) / rows.length) : 0;
  const last = CNT.rows[CNT.rows.length - 1];
  const prevY = String(Number(CNT.year) - 1), prev = CNT.rows.filter(r => r.date.startsWith(prevY));
  const prevAvg = prev.length ? Math.round(prev.reduce((s, r) => s + tot(r), 0) / prev.length) : 0;
  const best = rows.slice().sort((a, b) => tot(b) - tot(a))[0];
  return `<section class="card full cntcard"><div class="lbl"><span>주일 인원 · 부모님 + 아이들 + 교사</span><button class="linkbtn" data-act="cntNew">+ 이번 주 넣기</button></div>
${years.length > 1 ? `<div class="yrseg">${years.map(y => `<button class="${y === CNT.year ? 'on' : ''}" data-act="cntYear" data-id="${y}">${y}</button>`).join('')}</div>` : ''}
${rows.length ? `<div class="cntstat"><div><b>${avg}</b><small>${CNT.year}년 평균${prevAvg ? ` · 작년 ${prevAvg}` : ''}</small></div><div><b>${best ? tot(best) : '-'}</b><small>가장 많은 날${best ? ' · ' + fmtShort(best.date) : ''}</small></div><div><b>${last ? tot(last) : '-'}</b><small>최근 · ${last ? fmtShort(last.date) : ''}</small></div><div><b>${rows.length}</b><small>기록한 주일</small></div></div>
<div class="cntchart" role="img" aria-label="${CNT.year}년 주일 인원 막대">${rows.map(r => { const t = tot(r), f = r.family || 0; return `<button class="cb" data-act="cntEdit" data-id="${r.date}" title="${fmtShort(r.date)} · 총 ${t} (부모님·아이들 ${f}${r.kids ? ' / 아이들 ' + r.kids : ''} · 교사 ${r.teachers || 0})${r.place ? ' · ' + r.place : ''}"><b>${t}</b><span class="bw"><i style="height:${sc(t)}%"><em style="height:${t ? Math.min(100, Math.round((r.teachers || 0) / Math.max(1, t - lo) * 100)) : 0}%"></em></i></span><span class="lb">${parseD(r.date).getMonth() + 1}/${parseD(r.date).getDate()}</span></button>`; }).join('')}</div>
<div class="legend"><span><i class="cdot" style="background:#E8A39C"></i>부모님 · 아이들</span><span><i class="cdot sun"></i>교사</span><span class="s2">${lo ? `막대는 ${lo}명부터 그렸어요 · ` : ''}누르면 자세히 보고 고칠 수 있어요</span></div>` : `<div class="s2">${CNT.year}년 기록이 없어요.</div>`}</section>`;
}
function cntSheet(date) {
  const r = (CNT.rows || []).find(x => x.date === date) || { date: date || nextSunday() };
  if (!date && parseD(r.date) > new Date()) r.date = ymd(sundayOnOrBefore(new Date()));
  sheet(`<div class="ttl" style="font-size:24px">주일 인원</div>
<label class="fld">주일<input class="in" type="date" id="cn_date" value="${esc(r.date)}"></label>
<div class="cntin"><label class="fld">부모님 · 아이들<input class="in" type="number" inputmode="numeric" id="cn_f" value="${r.family ?? ''}"></label><label class="fld">그중 아이들<input class="in" type="number" inputmode="numeric" id="cn_k" value="${r.kids ?? ''}"></label><label class="fld">교사<input class="in" type="number" inputmode="numeric" id="cn_t" value="${r.teachers ?? ''}"></label></div>
<label class="fld">메모 <span class="s2">(야외예배, 분단별 등)</span><input class="in" id="cn_m" value="${esc(r.place || r.memo || '')}"></label>
<div class="sub" id="cn_sum"></div>
<div class="btns"><button class="pri" data-act="cntSave">저장</button><button class="sec" data-act="sheetClose">닫기</button></div>`);
  const upd = () => { const f = +val('cn_f') || 0, t = +val('cn_t') || 0; $('#cn_sum').textContent = f || t ? `총 ${f + t}명` : ''; };
  $('#sheet').addEventListener('input', upd); upd();
}
async function cntSave() {
  const date = val('cn_date'); if (!date) return toast('주일을 골라 주세요');
  const family = val('cn_f') === '' ? null : +val('cn_f'), kids = val('cn_k') === '' ? null : +val('cn_k'), teachers = val('cn_t') === '' ? null : +val('cn_t');
  if (family === null && teachers === null) return toast('숫자를 넣어 주세요');
  const old = (CNT.rows || []).find(x => x.date === date) || {};
  const d = { date, family, kids, teachers, total: (family || 0) + (teachers || 0), place: val('cn_m'), by: S.me.email, byName: myName(), at: new Date().toISOString() };
  if (old.importBatch) d.importBatch = old.importBatch;
  try {
    await setDoc(doc(db, 'counts', date), d);
    CNT.rows = (CNT.rows || []).filter(x => x.date !== date).concat({ id: date, ...d }).sort((a, b) => ko(a.date, b.date)); CNT.year = date.slice(0, 4);
    closeSheet(); toast('저장했어요'); paint();
  } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}

/* ---------- 지난 찬양 찾기 (예배 → 악보) ---------- */
const HIST = { rows: null, q: '' };
const songKey = t => String(t || '').toLowerCase().replace(/\(.*?\)|<.*?>|\[.*?\]|new|예비|\s|[~·,.!?'"]/g, '');
async function loadHist() {
  if (HIST.rows) return;
  let rows = [];
  try { const s = await getDocs(collection(db, 'songs')); rows = s.docs.map(d => d.data()).map(x => ({ date: x.date, title: x.title, key: x.key || '', inst: x.inst || '', bpm: x.bpm || '' })); } catch { rows = []; }
  HIST.rows = rows;
}
function histCard() {
  if (HIST.rows === null) return `<section class="card"><div class="lbl"><span>지난 찬양 찾기</span></div><div class="sub">곡 이름으로 언제 불렀는지, 키 · 빠르기는 어땠는지 찾아요.</div><button class="sec" data-act="histOpen">지난 찬양 열기</button></section>`;
  const g = {};
  HIST.rows.forEach(r => { const k = songKey(r.title); if (!k) return; (g[k] ||= { title: r.title, list: [] }).list.push(r); });
  let groups = Object.values(g).map(x => ({ ...x, list: x.list.sort((a, b) => ko(b.date, a.date)) }));
  const q = songKey(HIST.q);
  groups = q ? groups.filter(x => songKey(x.title).includes(q)) : groups;
  groups.sort((a, b) => b.list.length - a.list.length || ko(b.list[0].date, a.list[0].date));
  const show = groups.slice(0, q ? 30 : 12);
  return `<section class="card histcard"><div class="lbl"><span>지난 찬양 찾기</span><span class="s2">${Object.keys(g).length}곡 · ${new Set(HIST.rows.map(r => r.date)).size}주</span></div>
<input class="in" id="histq" value="${esc(HIST.q)}" placeholder="곡 이름 (예: 예예예)" autocomplete="off">
<div class="s2">${q ? `${groups.length}곡 찾음` : '많이 부른 곡'}</div>
<div class="histlist">${show.map(x => { const l = x.list[0]; return `<details class="hist"><summary><span class="grow"><b>${esc(x.title)}</b><small>${x.list.length}번 · 마지막 ${esc(l.date.replace(/-/g, '.'))}${l.key ? ' · ' + esc(l.key) : ''}${l.bpm ? ' · ♩' + esc(l.bpm) : ''}</small></span></summary><div class="histdates">${x.list.slice(0, 40).map(r => `<button class="chip sm" data-act="histGo" data-id="${r.date}">${esc(r.date.slice(2).replace(/-/g, '.'))}${r.key ? ' ' + esc(r.key) : ''}</button>`).join('')}</div></details>`; }).join('') || '<div class="sub">찾는 곡이 없어요.</div>'}</div></section>`;
}
appEl.addEventListener('input', e => {
  if (e.target.id !== 'histq') return;
  HIST.q = e.target.value; clearTimeout(HIST.t);
  HIST.t = setTimeout(() => { const pos = e.target.selectionStart; const box = document.querySelector('.histcard'); if (!box) return; const tmp = document.createElement('div'); tmp.innerHTML = histCard(); box.replaceWith(tmp.firstElementChild); const inp = $('#histq'); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch { /* 괜찮아요 */ } } }, 160);
});

Object.assign(ACT, {
  cntYear: d => { CNT.year = d.id; paint(); },
  cntNew: () => cntSheet(''),
  cntEdit: d => cntSheet(d.id),
  cntSave: () => cntSave(),
  histOpen: async () => { toast('지난 찬양을 불러오는 중…'); await loadHist(); paint(); },
  histGo: d => { W.date = d.id; W.tab = 'songs'; loadSongs(d.id).then(() => { paint(); const sc = $('.scroll'); if (sc) sc.scrollTop = 0; }); }
});

/* ================= v12 · 자료 내려받기 (PDF · 엑셀) · 연간 일정 엑셀 일괄 입력 ================= */
let xlP = null;
function loadXLSX() {
  return xlP || (xlP = (async () => {
    for (const u of ['https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs']) { try { return await import(u); } catch { /* 다음 것 */ } }
    xlP = null; throw new Error('엑셀 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
  })());
}
const EX = { year: new Date().getFullYear(), cls: 'all', busy: '' };
const todayDot = () => ymd(new Date()).replace(/-/g, '.');
const exClasses = () => EX.cls === 'all' ? S.myClasses : [EX.cls];
const clsName = c => (S.classes[c] || {}).name || c;
const SONGS_ALL = { rows: null };
async function loadSongsAll() {
  if (SONGS_ALL.rows) return SONGS_ALL.rows;
  try { const s = await getDocs(collection(db, 'songs')); SONGS_ALL.rows = s.docs.map(d => d.data()); } catch { SONGS_ALL.rows = []; }
  return SONGS_ALL.rows;
}
async function loadFamsAll() {
  if (isAdminMe()) { try { const s = await getDocs(collection(db, 'families')); s.docs.forEach(d => { S.fam[d.id] = { id: d.id, ...d.data() }; }); return; } catch { /* 하나씩 */ } }
  await Promise.all(exClasses().flatMap(c => (S.kids[c] || []).map(k => k.familyId ? loadFam(k.familyId) : null)));
}
const famOf = k => S.fam[k.familyId] || {};
const phonesOf = f => Object.values(f.phones || {}).concat([f.fatherTel, f.motherTel]).filter(Boolean).join(' / ');
const sibOf = f => (f.siblings || []).map(x => x.name + (x.org ? `(${x.org})` : '')).join(', ');
const yesNo = v => v ? 'O' : '';

/* 종류마다: 무엇을 받아 와서(need) 어떤 표(tables)를 만들지 */
const EXP = [
  { k: 'kids', t: '아이 명단', d: '반별 이름 · 생일 · 부모님 · 셀 · 형제', ic: 'kids', who: 'all', orient: 'portrait',
    need: () => loadFamsAll(),
    tables: () => exClasses().map(c => ({ title: clsName(c), cols: [['번호', 5], ['이름', 10], ['생일', 12], ['아빠', 9], ['엄마', 9], ['셀', 10], ['형제', 18], ['연락처', 20], ['함께한 날', 11], ['메모', 22]],
      rows: activeKids(c).map((k, i) => { const f = famOf(k); return [i + 1, k.name, k.birth || (k.birthYear ? k.birthYear + '년' : ''), f.father || '', f.mother || '', [f.fatherCell, f.motherCell].filter(Boolean).join(' · '), sibOf(f), phonesOf(f), k.since || '', [(k.flags || []).join(' '), k.remark || '', k.note || ''].filter(Boolean).join(' · ')]; }) })) },
  { k: 'att', t: '출석부', d: '반별 · 주일마다 O, 출석률', ic: 'att', who: 'all', orient: 'landscape', year: true,
    need: () => Promise.all(exClasses().map(ensureAtt)),
    tables: () => exClasses().map(c => {
      const ds = recorded(c).filter(d => d.startsWith(String(EX.year)));
      const kids = activeKids(c);
      const rows = kids.map((k, i) => { const own = ds.filter(d => !k.since || d >= k.since); const n = own.filter(d => (S.att[c][d] || {})[k.id] === 'p').length; return [i + 1, k.name, ...ds.map(d => (k.since && d < k.since) ? '·' : ((S.att[c][d] || {})[k.id] === 'p' ? 'O' : '')), n, own.length ? Math.round(n / own.length * 100) + '%' : '']; });
      rows.push(['', '출석', ...ds.map(d => presentCount(c, d)), '', '']);
      return { title: `${clsName(c)} · ${EX.year}년 ${ds.length}주`, cols: [['번호', 5], ['이름', 9], ...ds.map(d => [fmtShort(d), 5]), ['출석', 6], ['출석률', 7]], rows, dense: ds.length > 14, foot: true };
    }) },
  { k: 'bday', t: '생일 달력', d: '달마다 아이 · 선생님 생일 (한 장)', ic: 'kids', who: 'all', orient: 'portrait',
    need: () => Promise.resolve(),
    tables: () => [{ title: '달마다 생일', cols: [['달', 6], ['아이 (반)', 60], ['선생님', 24]],
      rows: MONTHS.map((mn, i) => { const m = pad(i + 1); const kid = exClasses().flatMap(c => activeKids(c)).filter(k => (k.birth || '').slice(5, 7) === m).sort((a, b) => ko(a.birth.slice(8), b.birth.slice(8))); const st = S.staff.filter(x => (x.birth || '').slice(5, 7) === m); return [mn, kid.map(k => `${Number(k.birth.slice(8))}일 ${k.name}(${clsName(k.classId).replace('반', '')})`).join(', '), st.map(x => `${Number(x.birth.slice(8))}일 ${x.name}`).join(', ')]; }) }] },
  { k: 'staff', t: '교사 명단', d: '반 · 담임/보조 · 맡은 일 · 연락처', ic: 'kids', who: 'all', orient: 'landscape',
    need: () => Promise.resolve(),
    tables: () => [{ title: `교사 ${S.staff.length}명`, cols: [['번호', 5], ['이름', 9], ['구분', 10], ['반', 14], ['맡은 일', 40], ['생일', 11], ['연락처', 14], ['구글 연결', 9]],
      rows: S.staff.map((st, i) => [i + 1, st.name, roleLabel(st), (st.classes || []).map(c => `${clsName(c)} ${(st.classRole || {})[c] || '보조'}`).join(', '), (st.duties || []).join(', '), st.birth || '', st.phone || '', st.email ? 'O' : '']) }] },
  { k: 'duty', t: '업무 분담', d: '역할 · 담당 · 부재 시 대신할 분', ic: 'room', who: 'all', orient: 'landscape',
    need: () => loadDuties(),
    tables: () => [{ title: '업무 분담', cols: [['구역', 10], ['영역', 10], ['역할', 16], ['담당', 26], ['부재 시', 16], ['설명', 44]],
      rows: (W.duties || []).map(d => [d.section || '', d.area || '', d.role || '', (d.people || []).join(', '), (d.backup || []).join ? (d.backup || []).join(', ') : (d.backup || ''), [d.desc, d.note].filter(Boolean).join(' / ')]) }] },
  { k: 'sched', t: '순서표', d: '주일마다 이야기 · 설교 · 기도 · 챈트 · 율동 · 헌금기도', ic: 'room', who: 'all', orient: 'landscape', year: true,
    need: () => Promise.resolve(),
    tables: () => [{ title: `${EX.year}년 순서표`, cols: SCH_COLS.map(c => [c[1], c[2]]),
      rows: S.schedule.filter(s => s.date.startsWith(String(EX.year))).map(s => SCH_COLS.map(([k]) => k === 'date' ? s.date.slice(5).replace('-', '/') : k === 'dow' ? DOW[parseD(s.date).getDay()] : k === 'noService' ? yesNo(s.noService) : (s[k] || ''))), dense: true }] },
  { k: 'events', t: '일정', d: '교사실 캘린더 일정 · 공휴일 · 내용', ic: 'room', who: 'all', orient: 'landscape', year: true,
    need: () => Promise.all([loadEvents(), loadHol(EX.year)]),
    tables: () => {
      const Y = String(EX.year), hol = (HOL.y[Y] && HOL.y[Y].days) || {};
      const rows = (R.events || []).filter(e => (e.date || '').startsWith(Y) || (e.endDate || '').startsWith(Y)).map(e => ({ d: e.date, r: [fmtShort(e.date) + ' ' + DOW[parseD(e.date).getDay()] + (e.endDate && e.endDate > e.date ? ' – ' + fmtShort(e.endDate) : ''), timeText(e), e.kind || '행사', e.title || '', e.memo || '', e.place || '', e.byName || ''] }))
        .concat(Object.entries(hol).map(([d, n]) => ({ d, r: [fmtShort(d) + ' ' + DOW[parseD(d).getDay()], '종일', '공휴일', n, '', '', ''] })))
        .sort((a, b) => ko(a.d, b.d)).map(x => x.r);
      return [{ title: `${Y}년 일정 ${rows.length}개`, cols: [['날짜', 15], ['시간', 12], ['종류', 8], ['제목', 28], ['내용', 44], ['장소', 18], ['올린 사람', 9]], rows }];
    } },
  { k: 'counts', t: '주일 인원', d: '부모님·아이들 · 교사 · 총 (해마다)', ic: 'stats', who: 'all', orient: 'portrait', year: true,
    need: () => { CNT.rows = null; return loadCounts(); },
    tables: () => { const rs = (CNT.rows || []).filter(r => r.date.startsWith(String(EX.year))); const t = r => r.total || ((r.family || 0) + (r.teachers || 0)); const avg = k => rs.length ? Math.round(rs.reduce((s, r) => s + (k === 'total' ? t(r) : (r[k] || 0)), 0) / rs.length) : ''; return [{ title: `${EX.year}년 주일 인원 ${rs.length}주`, cols: [['주일', 10], ['부모님·아이들', 13], ['아이들', 8], ['교사', 7], ['총', 7], ['메모', 30]], rows: rs.map(r => [r.date.slice(5).replace('-', '/'), r.family ?? '', r.kids ?? '', r.teachers ?? '', t(r), r.place || r.memo || '']).concat(rs.length ? [['평균', avg('family'), '', avg('teachers'), avg('total'), '']] : []), foot: !!rs.length }]; } },
  { k: 'songs', t: '주일 찬양', d: '주일마다 곡 순서 · 악기 · 키 · 빠르기', ic: 'music', who: 'all', orient: 'portrait', year: true,
    need: () => { SONGS_ALL.rows = null; return loadSongsAll(); },
    tables: () => { const by = {}; (SONGS_ALL.rows || []).filter(s => (s.date || '').startsWith(String(EX.year))).forEach(s => (by[s.date] ||= []).push(s)); const ds = Object.keys(by).sort(); return [{ title: `${EX.year}년 주일 찬양 ${ds.length}주`, cols: [['주일', 8], ['순서', 5], ['곡', 30], ['악기', 7], ['키', 6], ['빠르기', 7], ['메모', 24]], rows: ds.flatMap(d => by[d].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s, i) => [i ? '' : d.slice(5).replace('-', '/'), i + 1, s.title || '', s.inst || '', s.key || '', s.bpm ? '♩' + s.bpm : '', s.memo || ''])), compact: true }]; } }
];
const SCH_COLS = [['date', '날짜', 8], ['dow', '요일', 5], ['story', '성경이야기', 24], ['preacher', '설교', 12], ['pray', '중보기도 인도', 12], ['nation', '나라 기도', 12], ['chant', '챈트', 14], ['verse', '챈트 말씀', 12], ['dance', '율동', 14], ['offering', '헌금기도 가정', 12], ['noService', '예배 없음', 8], ['noServiceNote', '예배 없음 사유', 16]];

/* ---------- PDF (인쇄 → PDF로 저장) ---------- */
function pdfHtml(title, sub, tables, orient) {
  const css = `@font-face{font-family:'Dongdong';src:url('fonts/Cafe24DongdongRegular.woff2') format('woff2')}
@page{size:A4 ${orient};margin:10mm}
*{box-sizing:border-box}body{margin:0;font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:#2B2018;-webkit-print-color-adjust:exact;print-color-adjust:exact;word-break:keep-all}
.bar{position:sticky;top:0;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;background:#FFF6E5;border-bottom:1px solid #EBD9B8;font-size:14px}
.bar button{font:inherit;font-size:15px;border:0;border-radius:22px;background:#C62828;color:#fff;padding:10px 18px;cursor:pointer}
.page{padding:16px}
header{display:flex;align-items:center;gap:10px;border-bottom:2px solid #C62828;padding-bottom:6px;margin-bottom:8px}
header img{width:30px;height:30px;border-radius:8px}header h1{font-family:'Dongdong',sans-serif;font-weight:400;font-size:20px;margin:0;flex:1}header span{font-size:10px;color:#7A6656}
h2{font-size:12px;margin:10px 0 4px;color:#8E1B1B}
table{border-collapse:collapse;width:100%;table-layout:auto;margin-bottom:6px;page-break-inside:auto}
th,td{border:0.5px solid #D9C7A8;padding:2.5px 4px;font-size:9.5px;line-height:1.35;vertical-align:top;text-align:left}
th{background:#FBEFD8;font-weight:600;white-space:nowrap}tr{page-break-inside:avoid}
tbody tr:nth-child(even) td{background:#FFFBF4}
table.dense th,table.dense td{font-size:7.5px;padding:1.5px 2px}
table.dense td{text-align:center}table.dense td:nth-child(2){text-align:left;white-space:nowrap}
table.foot tbody tr:last-child td{background:#FDE3E1;font-weight:600}
td.o{color:#C62828;font-weight:700}
.empty{font-size:11px;color:#7A6656;padding:8px 0}
footer{font-size:8px;color:#9A8676;margin-top:6px}
@media print{.bar{display:none}.page{padding:0}}`;
  const tbl = t => !t.rows.length ? `<h2>${esc(t.title)}</h2><div class="empty">기록이 없어요.</div>` : `<h2>${esc(t.title)}</h2><table class="${t.dense ? 'dense' : ''} ${t.foot ? 'foot' : ''}"><thead><tr>${t.cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(v => `<td class="${v === 'O' ? 'o' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${esc(location.href.split('#')[0])}"><title>${esc(title)}</title><style>${css}</style></head><body>
<div class="bar"><span>인쇄 창에서 <b>대상: PDF로 저장</b>을 고르면 PDF 파일이 돼요. (A4 ${orient === 'landscape' ? '가로' : '세로'} · 여백 10mm)</span><button onclick="print()">PDF로 저장 · 인쇄</button></div>
<div class="page"><header><img src="icons/icon-192.png" alt=""><h1>${esc(title)}</h1><span>${esc(sub)}</span></header>${tables.map(tbl).join('')}<footer>조이코너 노트 ${APP_VERSION} · ${todayDot()} 내려받음 · ${esc(myName())} · 아이들 정보가 들어 있어요. 보관에 주의해 주세요.</footer></div>
<script>window.addEventListener('load',()=>setTimeout(()=>{try{print()}catch(e){}},500))<\/script></body></html>`;
}
async function exRun(k, fmt) {
  const T = EXP.find(x => x.k === k); if (!T) return;
  let w = null;
  if (fmt === 'pdf') { w = window.open('', '_blank'); if (!w) return toast('새 창이 막혔어요. 팝업을 허용해 주세요'); w.document.write('<p style="font-family:sans-serif;padding:24px">자료를 모으는 중…</p>'); }
  EX.busy = k + fmt; paint();
  try {
    await T.need();
    const tables = T.tables();
    const sub = `${T.year ? EX.year + '년 · ' : ''}${EX.cls === 'all' ? (S.myClasses.length > 1 ? '모든 반' : clsName(S.myClasses[0] || '')) : clsName(EX.cls)} · ${todayDot()}`;
    const name = `조이코너_${T.t.replace(/\s/g, '')}${T.year ? '_' + EX.year : ''}_${ymd(new Date())}`;
    if (fmt === 'pdf') { const url = URL.createObjectURL(new Blob([pdfHtml(`조이코너 ${T.t}`, sub, tables, T.orient)], { type: 'text/html;charset=utf-8' })); w.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000); }
    else {
      const multi = tables.length > 1;
      const cols = (multi ? [['반', 8]] : []).concat(tables[0] ? tables[0].cols : []);
      const aoa = [cols.map(c => c[0])].concat(tables.flatMap(t => t.rows.map(r => (multi ? [t.title] : []).concat(r))));
      if (k === 'att') await xlsxDownload(name + '.xlsx', tables.map(t => ({ name: t.title.split(' · ')[0], aoa: [t.cols.map(c => c[0])].concat(t.rows), cols: t.cols.map(c => c[1]) })));
      else await xlsxDownload(name + '.xlsx', [{ name: T.t, aoa, cols: cols.map(c => c[1]) }]);
      toast('엑셀 파일을 내려받았어요');
    }
  } catch (e) { if (w) w.close(); toast('만들지 못했어요: ' + (e.message || e)); }
  EX.busy = ''; paint();
}
async function xlsxDownload(fname, sheets) {
  const X = await loadXLSX(), wb = X.utils.book_new();
  const used = new Set();
  sheets.forEach(s => {
    const ws = X.utils.aoa_to_sheet(s.aoa);
    if (s.cols) ws['!cols'] = s.cols.map(w => ({ wch: w }));
    let n = String(s.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31); while (used.has(n)) n = n.slice(0, 28) + '_' + used.size; used.add(n);
    X.utils.book_append_sheet(wb, ws, n);
  });
  X.writeFile(wb, fname);
}
async function exAll() {
  EX.busy = 'all'; paint();
  try {
    const sheets = [];
    for (const T of EXP) {
      await T.need();
      const tables = T.tables(), multi = tables.length > 1;
      if (T.k === 'att') { tables.forEach(t => sheets.push({ name: '출석 ' + t.title.split(' · ')[0], aoa: [t.cols.map(c => c[0])].concat(t.rows), cols: t.cols.map(c => c[1]) })); continue; }
      const cols = (multi ? [['반', 8]] : []).concat(tables[0] ? tables[0].cols : []);
      sheets.push({ name: T.t, aoa: [cols.map(c => c[0])].concat(tables.flatMap(t => t.rows.map(r => (multi ? [t.title] : []).concat(r)))), cols: cols.map(c => c[1]) });
    }
    await xlsxDownload(`조이코너_전체자료_${EX.year}_${ymd(new Date())}.xlsx`, sheets);
    toast(`엑셀 한 파일에 ${sheets.length}개 시트를 담았어요`);
  } catch (e) { toast('만들지 못했어요: ' + (e.message || e)); }
  EX.busy = ''; paint();
}

/* ---------- 화면: 자료 내려받기 ---------- */
function vExport() {
  const y0 = new Date().getFullYear(), years = [y0 - 2, y0 - 1, y0, y0 + 1];
  const btn = (k, f, l) => `<button class="${f === 'pdf' ? 'sec' : 'ghost'} sm" data-act="exRun" data-id="${k}" data-f="${f}" ${EX.busy ? 'disabled' : ''}>${EX.busy === k + f ? '만드는 중…' : l}</button>`;
  return `<div class="scroll"><div class="hd"><button class="back" data-act="back">← 홈</button></div><div class="ttl">자료 내려받기</div>
<div class="sub">종류마다 <b>PDF</b>(한 장으로 바로 인쇄 · 공유)나 <b>엑셀</b>(고치고 정리하기)로 받아요. 아이들 정보가 들어 있으니 보관에 주의해 주세요.</div>
<section class="card exbar"><div class="exrow"><span class="lbl">연도</span><div class="yrseg">${years.map(y => `<button class="${y === EX.year ? 'on' : ''}" data-act="exYear" data-id="${y}">${y}</button>`).join('')}</div></div>
${S.myClasses.length > 1 ? `<div class="exrow"><span class="lbl">반</span><div class="yrseg"><button class="${EX.cls === 'all' ? 'on' : ''}" data-act="exCls" data-id="all">모든 반</button>${S.myClasses.map(c => `<button class="${EX.cls === c ? 'on' : ''}" data-act="exCls" data-id="${c}">${esc(clsName(c))}</button>`).join('')}</div></div>` : ''}</section>
<div class="exgrid">${EXP.map(T => `<section class="extile"><div class="exhead">${svg(ICON[T.ic] || ICON.room, 22, 1.8)}<b>${esc(T.t)}</b>${T.year ? `<span class="tag g">${EX.year}</span>` : ''}</div><div class="s2">${esc(T.d)}</div><div class="exbtns">${btn(T.k, 'pdf', 'PDF')}${btn(T.k, 'xlsx', '엑셀')}</div></section>`).join('')}</div>
${isAdminMe() ? `<button class="cta" data-act="exAll" ${EX.busy ? 'disabled' : ''}>${svg('<path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 20h16"/>', 24, 2)}${EX.busy === 'all' ? '만드는 중…' : `전체 자료를 엑셀 한 파일로 (${EX.year}년)`}</button>` : ''}
${isAdminMe() ? bulkCard() : ''}</div>${nav('home')}`;
}

/* ---------- 연간 일정 한 번에 넣기 (엑셀 양식 → 올리기) ---------- */
const BULK = { year: new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0), plan: null };
const EV_COLS = [['id', '앱 번호 (고치지 마세요)', 14], ['date', '시작 날짜', 12], ['endDate', '끝 날짜', 12], ['time', '시작 시간', 9], ['endTime', '끝 시간', 9], ['title', '제목', 28], ['memo', '내용', 40], ['place', '장소', 18], ['kind', '종류', 9]];
function bulkCard() {
  const y0 = new Date().getFullYear();
  return `<section class="card bulk"><div class="lbl"><span>연간 일정 한 번에 넣기 (엑셀)</span><span class="s2">디렉터 · 관리자</span></div>
<div class="sub">새해 순서표와 캘린더 일정을 엑셀로 한꺼번에 넣어요. 디렉터 혼자 해도 되고, 관리자를 정해 나눠 맡겨도 돼요.</div>
<div class="exrow"><span class="lbl">연도</span><div class="yrseg">${[y0, y0 + 1].map(y => `<button class="${y === BULK.year ? 'on' : ''}" data-act="bulkYear" data-id="${y}">${y}</button>`).join('')}</div></div>
<ol class="steps"><li><b>양식 내려받기</b> — ${BULK.year}년 주일이 모두 들어 있고, 이미 있는 내용은 채워져 있어요.<br><button class="sec sm" data-act="bulkTpl">${BULK.year}년 양식 내려받기</button></li>
<li><b>엑셀에서 채우기</b> — '순서표' 시트는 주일마다, '일정' 시트는 한 줄에 일정 하나. 빈칸은 그대로 두고, 지우려면 <b>-</b> 를 적어요.</li>
<li><b>올리기</b> — 바뀌는 것을 먼저 보여 드리고, [적용하기]를 눌러야 들어가요.<br><label class="filebtn sm">${svg('<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>', 18, 1.8)}<span>작성한 엑셀 올리기</span><input type="file" id="bulkFile" accept=".xlsx,.xls,.csv" hidden></label></li></ol></section>`;
}
async function bulkTpl() {
  try {
    const Y = String(BULK.year);
    const sch = sundaysOfYear(Y).map(d => { const s = schedFor(d) || {}; return SCH_COLS.map(([k]) => k === 'date' ? d : k === 'dow' ? DOW[parseD(d).getDay()] : k === 'noService' ? yesNo(s.noService) : (s[k] || '')); });
    if (!Array.isArray(R.events)) await loadEvents();
    const ev = (R.events || []).filter(e => (e.date || '').startsWith(Y)).sort((a, b) => ko(a.date, b.date)).map(e => [e.id, e.date, e.endDate || '', e.allDay ? '' : (e.time || ''), e.allDay ? '' : (e.endTime || ''), e.title || '', e.memo || '', e.place || '', e.kind || '행사']);
    const guide = [['조이코너 연간 일정 양식 — ' + Y + '년'], [''], ['1. 순서표 시트: 주일마다 한 줄이에요. 날짜 칸은 바꾸지 마세요. 특별 예배가 있으면 맨 아래에 날짜를 더해도 돼요.'], ['2. 이름이 여럿이면 쉼표로: 김혜원, 황지솔'], ['3. 예배 없음 칸에 O 를 적으면 그 주일은 "조이코너 예배 없음"이 돼요. 사유 칸에 이유를 적어요.'], ['4. 일정 시트: 한 줄에 일정 하나. 시작 날짜 · 제목은 꼭 적어요. 시간을 비우면 종일 일정이에요.'], ['   날짜는 2027-03-01 또는 2027.3.1, 시간은 13:30 또는 오후 1:30 처럼 적어요.'], ['   종류: 행사 · 회의 · 교육 · 부재 · 기타'], ['5. 빈칸은 앱에 있는 내용을 그대로 둬요. 앱의 내용을 지우려면 칸에 - 를 적어요.'], ['6. 앱 번호 칸은 이미 있는 일정이에요. 지우지 말고 그대로 두면 그 일정이 고쳐져요. 새 일정은 앱 번호를 비워 두세요.'], ['7. 올리면 바뀌는 것을 먼저 보여 드려요. 확인 뒤 [적용하기]를 눌러야 들어가요.'], ['8. 새로 들어간 일정은 묶음으로 남아서, 잘못 넣었으면 캘린더 → 바깥 캘린더 가져오기 → 가져온 기록에서 한 번에 지울 수 있어요.']];
    await xlsxDownload(`조이코너_연간일정양식_${Y}.xlsx`, [
      { name: '안내', aoa: guide, cols: [110] },
      { name: '순서표', aoa: [SCH_COLS.map(c => c[1])].concat(sch), cols: SCH_COLS.map(c => c[2]) },
      { name: '일정', aoa: [EV_COLS.map(c => c[1])].concat(ev).concat(ev.length ? [] : [['', `${Y}-01-01`, '', '', '', '(예) 신년 교사 모임', '올해 순서표 나눔', '교육관', '회의']]), cols: EV_COLS.map(c => c[2]) }
    ]);
    toast('양식을 내려받았어요');
  } catch (e) { toast('양식을 만들지 못했어요: ' + e.message); }
}
function xDate(v, Y) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  if (v instanceof Date) return ymd(v);
  const s = String(v).trim();
  let m = /^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(s); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(s); if (m) return `${Y}-${pad(m[1])}-${pad(m[2])}`;
  return null;
}
function xTime(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') { const f = v % 1, mins = Math.round(f * 1440); return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`; }
  const s = String(v).trim(); const pm = /오후|pm/i.test(s), am = /오전|am/i.test(s);
  const m = /(\d{1,2})\s*[:시]\s*(\d{1,2})?/.exec(s); if (!m) return null;
  let h = +m[1]; if (pm && h < 12) h += 12; if (am && h === 12) h = 0;
  return `${pad(h)}:${pad(+(m[2] || 0))}`;
}
const xStr = v => String(v ?? '').trim();
const xYes = v => /^(o|ㅇ|○|●|y|yes|예|네|1|v|✓|✔|없음|true)$/i.test(xStr(v));
async function bulkRead(file) {
  try {
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    const Y = String(BULK.year);
    const sheetBy = name => { const n = wb.SheetNames.find(s => s.replace(/\s/g, '').includes(name)); return n ? X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) : null; };
    const plan = { sch: [], schNew: 0, schChg: 0, cells: 0, evNew: [], evChg: [], bad: [], year: Y };
    const sch = sheetBy('순서표');
    if (sch && sch.length > 1) {
      const head = sch[0].map(xStr), idx = {};
      SCH_COLS.forEach(([k, h]) => { const i = head.findIndex(x => x.replace(/\s/g, '') === h.replace(/\s/g, '')); if (i >= 0) idx[k] = i; });
      if (idx.date === undefined) plan.bad.push('순서표: "날짜" 칸을 찾지 못했어요');
      else sch.slice(1).forEach((row, ri) => {
        const raw = row[idx.date]; if (raw === '' || raw === undefined) return;
        const date = xDate(raw, Y); if (!date) return plan.bad.push(`순서표 ${ri + 2}줄: 날짜 "${xStr(raw)}"를 읽지 못했어요`);
        const cur = schedFor(date) || null, patch = {}, diff = [];
        SCH_COLS.forEach(([k, h]) => {
          if (k === 'date' || k === 'dow' || idx[k] === undefined) return;
          const v = row[idx[k]]; if (xStr(v) === '') return;
          let nv = xStr(v) === '-' ? '' : xStr(v);
          if (k === 'noService') nv = xStr(v) === '-' ? false : xYes(v);
          const ov = cur ? (k === 'noService' ? !!cur.noService : (cur[k] || '')) : (k === 'noService' ? false : '');
          if (nv !== ov) { patch[k] = nv; diff.push([h, ov === true ? 'O' : ov === false ? '' : ov, nv === true ? 'O' : nv === false ? '' : nv]); }
        });
        if (diff.length) { plan.sch.push({ date, isNew: !cur, patch, diff }); cur ? plan.schChg++ : plan.schNew++; plan.cells += diff.length; }
      });
    }
    const ev = sheetBy('일정');
    if (ev && ev.length > 1) {
      if (!Array.isArray(R.events)) await loadEvents();
      const head = ev[0].map(xStr), idx = {};
      EV_COLS.forEach(([k, h]) => { const i = head.findIndex(x => x.replace(/\s/g, '').startsWith(h.replace(/\s|\(.*\)/g, ''))); if (i >= 0) idx[k] = i; });
      ev.slice(1).forEach((row, ri) => {
        const g = k => idx[k] === undefined ? '' : row[idx[k]];
        const title = xStr(g('title')); if (!title || title.startsWith('(예)')) return;
        const date = xDate(g('date'), Y); if (!date) return plan.bad.push(`일정 ${ri + 2}줄 "${title}": 시작 날짜를 읽지 못했어요`);
        const endDate = xDate(g('endDate'), Y), time = xTime(g('time')), endTime = xTime(g('endTime'));
        if (endDate === null || time === null || endTime === null) return plan.bad.push(`일정 ${ri + 2}줄 "${title}": 끝 날짜나 시간을 읽지 못했어요`);
        const kindRaw = xStr(g('kind')), kind = ['행사', '회의', '교육', '부재', '기타'].includes(kindRaw) ? kindRaw : (kindRaw ? '기타' : '');
        const id = xStr(g('id'));
        const cur = (id && R.events.find(e => e.id === id)) || R.events.find(e => e.date === date && (e.title || '') === title);
        const val2 = (v, keep) => xStr(v) === '' ? keep : (xStr(v) === '-' ? '' : xStr(v));
        if (cur) {
          const nxt = { title, date, endDate: xStr(g('endDate')) === '' ? (cur.endDate || '') : (xStr(g('endDate')) === '-' ? '' : (endDate > date ? endDate : '')), time: time === '' ? (cur.time || '') : time, endTime: endTime === '' ? (cur.endTime || '') : endTime, memo: val2(g('memo'), cur.memo || ''), place: val2(g('place'), cur.place || ''), kind: kind || cur.kind || '행사' };
          if (xStr(g('time')) === '-') { nxt.time = ''; nxt.endTime = ''; }
          nxt.allDay = !nxt.time;
          const ch = Object.keys(nxt).filter(k => (nxt[k] ?? '') !== (cur[k] ?? (k === 'allDay' ? !cur.time : '')));
          if (ch.length) plan.evChg.push({ id: cur.id, patch: nxt, ch, title });
        } else plan.evNew.push({ title, date, endDate: endDate && endDate > date ? endDate : '', time, endTime, allDay: !time, memo: val2(g('memo'), ''), place: val2(g('place'), ''), kind: kind || '행사' });
      });
    }
    if (!sch && !ev) plan.bad.push('"순서표"나 "일정" 시트를 찾지 못했어요. 앱에서 내려받은 양식을 써 주세요');
    BULK.plan = plan; bulkPreview();
  } catch (e) { toast('엑셀을 읽지 못했어요: ' + e.message); }
}
function bulkPreview() {
  const p = BULK.plan; if (!p) return;
  const nothing = !p.sch.length && !p.evNew.length && !p.evChg.length;
  sheet(`<div class="ttl" style="font-size:24px">엑셀에서 읽은 것 · ${p.year}년</div>
<div class="kres"><div><b>${p.schNew}주</b><small>순서표 새로</small></div><div><b>${p.schChg}주</b><small>순서표 바뀜 (${p.cells}칸)</small></div><div><b>${p.evNew.length}개</b><small>새 일정</small></div><div><b>${p.evChg.length}개</b><small>고칠 일정</small></div></div>
${p.bad.length ? `<section class="card warnbox"><div class="lbl"><span>읽지 못한 줄 ${p.bad.length}개 (넣지 않아요)</span></div>${p.bad.slice(0, 12).map(b => `<div class="s2">· ${esc(b)}</div>`).join('')}</section>` : ''}
${p.sch.length ? `<section class="card"><div class="lbl"><span>순서표에서 바뀌는 칸</span></div><div class="imlist">${p.sch.slice(0, 60).map(x => `<div class="bkrow"><span class="d">${fmtShort(x.date)}${x.isNew ? ' <span class="tag">새로</span>' : ''}</span><span class="grow">${x.diff.map(([h, a, b]) => `<span class="bkc"><small>${esc(h)}</small>${a ? `<s>${esc(a)}</s> → ` : ''}<b>${esc(b || '(지움)')}</b></span>`).join('')}</span></div>`).join('')}${p.sch.length > 60 ? `<div class="s2" style="padding:8px 12px">… ${p.sch.length - 60}주 더</div>` : ''}</div></section>` : ''}
${p.evNew.length || p.evChg.length ? `<section class="card"><div class="lbl"><span>일정</span></div><div class="imlist">${p.evNew.map(e => `<div class="bkrow"><span class="d">${fmtShort(e.date)} <span class="tag">새로</span></span><span class="grow"><b>${esc(e.title)}</b><small>${esc([timeText(e), e.place, e.memo].filter(Boolean).join(' · '))}</small></span></div>`).join('')}${p.evChg.map(e => `<div class="bkrow"><span class="d">${fmtShort(e.patch.date)} <span class="tag g">고침</span></span><span class="grow"><b>${esc(e.title)}</b><small>바뀌는 칸: ${esc(e.ch.map(k => ({ title: '제목', date: '날짜', endDate: '끝 날짜', time: '시간', endTime: '끝 시간', memo: '내용', place: '장소', kind: '종류', allDay: '종일' })[k] || k).join(', '))}</small></span></div>`).join('')}</div></section>` : ''}
${nothing ? '<div class="sub">앱과 같아서 바꿀 것이 없어요.</div>' : ''}
<div class="btns">${nothing ? '' : '<button class="pri" data-act="bulkApply">적용하기</button>'}<button class="sec" data-act="sheetClose">${nothing ? '닫기' : '취소'}</button></div>`);
}
async function bulkApply() {
  const p = BULK.plan; if (!p) return;
  const ops = [], who = { by: S.me.email, byName: myName() };
  p.sch.forEach(x => ops.push([doc(db, 'schedule', x.date), x.isNew ? { date: x.date, ...x.patch } : x.patch, true]));
  const bref = doc(collection(db, 'imports')), bid = bref.id, newEv = [];
  p.evNew.forEach(e => { const r = doc(collection(db, 'events')); const d = { ...e, staffId: '', imgCount: 0, ...who, importBatch: bid, source: 'excel', gid: `excel|${e.date}|${e.title}` }; ops.push([r, d]); newEv.push({ id: r.id, ...d }); });
  p.evChg.forEach(e => ops.push([doc(db, 'events', e.id), e.patch, true]));
  try {
    for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(([r, d, m]) => (m ? b.set(r, d, { merge: true }) : b.set(r, d))); await b.commit(); }
    if (p.evNew.length) { const meta = { name: `엑셀 일괄 입력 ${p.year}`, count: p.evNew.length, src: 'excel', at: new Date().toISOString(), ...who }; await setDoc(bref, meta); if (IMP.batches) IMP.batches.unshift({ id: bid, ...meta }); }
    p.sch.forEach(x => { const s = schedFor(x.date); if (s) Object.assign(s, x.patch); else S.schedule.push({ id: x.date, date: x.date, ...x.patch }); });
    S.schedule.sort((a, b) => ko(a.date, b.date));
    if (Array.isArray(R.events)) { newEv.forEach(e => R.events.push(e)); p.evChg.forEach(e => { const c = R.events.find(x => x.id === e.id); if (c) Object.assign(c, e.patch); }); }
    BULK.plan = null; closeSheet();
    toast(`넣었어요 · 순서표 ${p.sch.length}주 · 새 일정 ${p.evNew.length}개 · 고친 일정 ${p.evChg.length}개`); gcalSoon(); paint();
  } catch (e) { toast('넣지 못했어요: ' + errMsg(e)); }
}

Object.assign(ACT, {
  exYear: d => { EX.year = Number(d.id); paint(); },
  exCls: d => { EX.cls = d.id; paint(); },
  exRun: d => exRun(d.id, d.f),
  exAll: () => exAll(),
  bulkYear: d => { BULK.year = Number(d.id); paint(); },
  bulkTpl: () => bulkTpl(),
  bulkApply: () => bulkApply()
});
appEl.addEventListener('change', e => { if (e.target.id === 'bulkFile' && e.target.files[0]) { bulkRead(e.target.files[0]); e.target.value = ''; } });

VIEWS.export = vExport;

/* ================= v13 · 새로고침 고침 · 모든 반 열람 · 자료 링크 · 업무 분담 보드 · 그만두신 선생님 ================= */

/* ---------- 새 버전: 캐시까지 새로 받아서 다시 열기 ---------- */
async function hardReload(v) {
  const b = document.querySelector('#newver button'); if (b) { b.disabled = true; b.textContent = '받는 중…'; }
  try { await Promise.all(['index.html', 'app.js?v=' + (v || Date.now()), 'app.js', 'app.css?v=' + (v || Date.now()), 'app.css', 'version.json'].map(u => fetch(u, { cache: 'reload' }).catch(() => { }))); } catch { /* 괜찮아요 */ }
  try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch { /* 없음 */ }
  location.replace(location.pathname + '?r=' + Date.now() + location.hash);
}
document.addEventListener('click', e => { const b = e.target.closest('#newver button'); if (b) { e.preventDefault(); hardReload(b.dataset.v); } });

/* ---------- 업무 분담: 보드 (구역마다 역할 카드) ---------- */
function rDutyBoard() {
  const me = myName(), list = W.duties || [], admin = isAdminMe();
  const sun = nextSunday(), away = awayOn(sun).map(s => s.name);
  const secs = ['예배 전', '예배 시', '예배 후'];
  const pc = (n, cls = '') => staffChip(n, `${cls} ${n === me ? 'mine' : ''} ${away.includes(n) ? 'away' : ''}`);
  const tile = x => {
    const ppl = x.people || [], bk = x.backup || [], open = R.open && R.open[x.id];
    return `<article class="dtile ${ppl.length ? '' : 'need'} ${ppl.includes(me) ? 'mine' : ''}">
<header data-act="dutyOpen" data-id="${x.id}"><span class="tt">${x.area && x.area !== x.role ? `<small>${esc(x.area)}</small>` : ''}<b>${esc(x.role)}</b></span>${admin ? `<button class="editbtn" data-act="dutyEdit" data-id="${x.id}" aria-label="${esc(x.role)} 고치기">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 15, 1.8)}</button>` : ''}</header>
<div class="dppl">${ppl.length ? ppl.map(n => pc(n)).join('') : '<span class="needtag">담당 필요</span>'}</div>
${bk.length ? `<div class="dbk"><span>부재 시</span>${bk.map(n => pc(n, 'sm2')).join('')}</div>` : ''}
${open && (x.desc || x.note) ? `<div class="ddesc">${esc(x.desc || '')}${x.note ? `<br>※ ${esc(x.note)}` : ''}</div>` : ''}</article>`;
  };
  return `<div class="dboard full">${secs.map(sec => { const l = list.filter(x => (x.section || '예배 시') === sec); if (!l.length) return ''; return `<section class="dsec"><div class="dsechead"><b>${sec}</b><span class="s2">역할 ${l.length} · 비어 있음 ${l.filter(x => !(x.people || []).length).length}</span></div><div class="dgrid">${l.map(tile).join('')}</div></section>`; }).join('')}</div>
<div class="s2 full">역할 이름을 누르면 하는 일이 펼쳐져요${admin ? ' · 연필을 누르면 고쳐요' : ''} · 내 이름은 빨간 테두리</div>`;
}

/* ---------- 역할에서 뺀 사람은 메모 글과 교사 카드의 '맡은 일'에서도 빼요 ---------- */
function stripName(text, n) {
  if (!text || !n) return text || '';
  const esc2 = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let t = String(text).replace(new RegExp(`(^|[\\s,·/:(])${esc2}(?=$|[\\s,·/)])`, 'g'), '$1');
  t = t.replace(/\(\s*\)/g, '').replace(/\s*[,·/]\s*(?=[,·/)]|$)/g, '').replace(/([:(])\s*[,·/]\s*/g, '$1 ').replace(/[^.\n:]*:\s*(?=$|\n|\.)/g, '').replace(/\s{2,}/g, ' ').trim();
  return t.replace(/[,·/:]\s*$/, '').replace(/^\s*[,·/:]\s*/, '').trim();
}
async function syncStaffDuties(names) {
  const b = writeBatch(db); let n = 0;
  [...new Set(names)].forEach(name => {
    const st = S.staff.find(x => x.name === name); if (!st) return;
    const roles = dutiesOf(name).map(x => x.role);
    if (JSON.stringify(roles) !== JSON.stringify(st.duties || [])) { st.duties = roles; b.update(doc(db, 'staff', st.id), { duties: roles }); n++; }
  });
  if (n) await b.commit().catch(() => { });
}

/* ---------- 그만두신 선생님 (보관함) ---------- */
async function staffLeave(id) {
  const st = S.staff.find(x => x.id === id); if (!st) return;
  try {
    const patch = { status: 'left', leftAt: ymd(new Date()), prevClasses: st.classes || [], prevClassRole: st.classRole || {}, classes: [], classRole: {} };
    const b = writeBatch(db);
    b.set(doc(db, 'staff', id), patch, { merge: true });
    if (!Array.isArray(W.duties)) await loadDuties();
    (W.duties || []).forEach(x => {
      const p = (x.people || []).filter(n => n !== st.name), k = (x.backup || []).filter(n => n !== st.name);
      if (p.length !== (x.people || []).length || k.length !== (x.backup || []).length) { const note = stripName(x.note, st.name); b.update(doc(db, 'duties', x.id), { people: p, backup: k, note }); Object.assign(x, { people: p, backup: k, note }); }
    });
    await b.commit();
    if (st.email && st.email !== OWNER_EMAIL.toLowerCase()) await deleteDoc(doc(db, 'teachers', st.email)).catch(() => { });
    Object.assign(st, patch);
    S.staffLeft = [st, ...(S.staffLeft || [])]; S.staff = S.staff.filter(x => x.id !== id);
    closeSheet(); toast(`${st.name} 선생님을 '그만두신 선생님'으로 옮겼어요 · 업무 분담에서도 뺐어요`); paint();
  } catch (e) { toast('옮기지 못했어요: ' + errMsg(e)); }
}
async function staffBack(id) {
  const st = (S.staffLeft || []).find(x => x.id === id); if (!st) return;
  try {
    const patch = { status: 'active', leftAt: '', classes: st.prevClasses || [], classRole: st.prevClassRole || {} };
    await setDoc(doc(db, 'staff', id), patch, { merge: true });
    if (st.email) await setDoc(doc(db, 'teachers', st.email), { name: st.name, role: st.role === 'director' || st.role === 'admin' ? st.role : 'teacher', classes: patch.classes }, { merge: true }).catch(() => { });
    Object.assign(st, patch); S.staffLeft = S.staffLeft.filter(x => x.id !== id); S.staff.push(st); S.staff.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || ko(a.name, b.name));
    toast(`${st.name} 선생님이 다시 명단에 들어왔어요 · 업무 분담은 새로 정해 주세요`); paint();
  } catch (e) { toast('되돌리지 못했어요: ' + errMsg(e)); }
}
async function staffPurge(id) {
  const st = (S.staffLeft || []).find(x => x.id === id); if (!st) return;
  try { await deleteDoc(doc(db, 'staff', id)); await deleteDoc(doc(db, 'staffPhotos', id)).catch(() => { }); S.staffLeft = S.staffLeft.filter(x => x.id !== id); closeSheet(); toast('완전히 지웠어요'); paint(); }
  catch (e) { toast('지우지 못했어요: ' + errMsg(e)); }
}
function leftDrawer() {
  if (!isAdminMe() || !(S.staffLeft || []).length) return '';
  return `<details class="drawer"><summary><b>그만두신 선생님</b><span class="s2">${S.staffLeft.length}명 · 디렉터 · 관리자만 보여요</span></summary><div class="list">${S.staffLeft.map(st => `<div class="row leftrow"><span class="grow"><span class="nm">${esc(st.name)}</span><span class="sub">${st.leftAt ? esc(st.leftAt.replace(/-/g, '.')) + ' 보관' : ''}${(st.prevClasses || []).length ? ' · 전에 ' + st.prevClasses.map(c => clsName(c)).join(', ') : ''}</span></span><button class="ghost sm" data-act="staffBack" data-id="${st.id}">다시 명단에</button><button class="ghost sm danger" data-act="staffPurgeAsk" data-id="${st.id}">완전히 지우기</button></div>`).join('')}</div></details>`;
}

/* ---------- 주일 자료 링크 (슬라이드 · OX 퀴즈 · 활동지 · BGM · 영상) ---------- */
const MAT = { by: {}, all: null };
const MAT_KINDS = [['slide', '설교 슬라이드', '#C62828'], ['quiz', 'OX 퀴즈', '#7B4FB8'], ['doc', '활동지 · 문서', '#3A6EA5'], ['bgm', 'BGM', '#2E9D8F'], ['video', '영상', '#E08A00'], ['etc', '기타', '#6B5646']];
const MAT_IC = { slide: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', quiz: '<circle cx="8" cy="12" r="4"/><path d="M15 8l6 8M21 8l-6 8"/>', doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>', bgm: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>', etc: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>' };
const matSite = u => { try { const h = new URL(u).hostname; return /docs\.google\.com/.test(h) ? (/presentation/.test(u) ? '구글 슬라이드' : /document/.test(u) ? '구글 문서' : /spreadsheets/.test(u) ? '구글 시트' : '구글 문서') : /drive\.google\.com/.test(h) ? '구글 드라이브' : /youtu/.test(h) ? '유튜브' : /canva/.test(h) ? '캔바' : /notion/.test(h) ? '노션' : /dropbox/.test(h) ? '드롭박스' : /onedrive|sharepoint|1drv/.test(h) ? '원드라이브' : h.replace(/^www\./, ''); } catch { return ''; } };
async function loadMat(d) {
  if (MAT.by[d]) return MAT.by[d];
  MAT.by[d] = [];
  try { const s = await getDocs(query(collection(db, 'materials'), where('date', '==', d))); MAT.by[d] = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (MAT_KINDS.findIndex(k => k[0] === a.kind) - MAT_KINDS.findIndex(k => k[0] === b.kind)) || ko(a.at || '', b.at || '')); } catch { MAT.by[d] = []; }
  return MAT.by[d];
}
function matCard(d) {
  if (!MAT.by[d]) { loadMat(d).then(() => softPaint()); }
  const l = MAT.by[d] || [];
  return `<section class="card matcard"><div class="lbl"><span>이번 주 자료</span><button class="linkbtn" data-act="matNew">+ 자료 링크</button></div>
${l.length ? `<div class="matlist">${l.map(m => { const k = MAT_KINDS.find(x => x[0] === m.kind) || MAT_KINDS[5]; return `<div class="matrow"><a class="matlink" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="matic" style="background:${k[2]}">${svg(MAT_IC[k[0]], 18, 1.9)}</span><span class="grow"><b>${esc(m.title || k[1])}</b><small>${esc(k[1])} · ${esc(matSite(m.url))} · ${esc(m.byName || '')}</small></span><span class="chev">↗</span></a>${m.by === S.me.email || isAdminMe() ? `<button class="editbtn" data-act="matDel" data-id="${m.id}" data-d="${d}" aria-label="지우기">${svg('<path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15, 1.8)}</button>` : ''}</div>`; }).join('')}</div>` : '<div class="sub">설교 슬라이드 · OX 퀴즈 · 활동지 · BGM 링크를 모아 두는 곳이에요. 파일은 공용 구글 드라이브에 두고 링크만 넣어요.</div>'}</section>`;
}
function matSheet() {
  sheet(`<div class="ttl" style="font-size:24px">자료 링크 넣기 · ${fmtMD(W.date)}</div>
<div class="fld">종류</div><div class="kindgrid">${MAT_KINDS.map(([k, l], i) => `<label class="kindopt ${i === 0 ? 'on' : ''}"><input type="radio" name="m_kind" value="${k}" ${i === 0 ? 'checked' : ''}>${l}</label>`).join('')}</div>
<label class="fld">링크<input class="in" id="m_url" inputmode="url" placeholder="https://docs.google.com/presentation/…"></label>
<label class="fld">이름 <span class="s2">(비우면 종류 이름으로)</span><input class="in" id="m_title" placeholder="예: 다윗과 골리앗 슬라이드"></label>
<div class="s2">구글 드라이브에서 파일 → 공유 → '링크가 있는 모든 사용자' 또는 조이코너 선생님들께 공유한 뒤 링크를 복사해 붙여넣어요.</div>
<div class="btns"><button class="pri" data-act="matSave">넣기</button><button class="sec" data-act="sheetClose">취소</button></div>`);
  const box = $('#sheet'); box.addEventListener('change', ev => { if (ev.target.name === 'm_kind') box.querySelectorAll('.kindopt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); });
}
async function matSave() {
  const url = val('m_url'); if (!/^https?:\/\/\S+$/.test(url)) return toast('https:// 로 시작하는 링크를 넣어 주세요');
  const kind = (document.querySelector('input[name=m_kind]:checked') || {}).value || 'etc';
  const d = W.date, data = { date: d, kind, url, title: val('m_title'), by: S.me.email, byName: myName(), at: new Date().toISOString() };
  try { const r = doc(collection(db, 'materials')); await setDoc(r, data); (MAT.by[d] ||= []).push({ id: r.id, ...data }); closeSheet(); toast('넣었어요'); paint(); } catch (e) { toast('넣지 못했어요: ' + errMsg(e)); }
}

/* ---------- 캘린더 목록: 날짜 + 내용 한 줄 (다가오는 3주 · 그날) ---------- */
const agendaRow = (x, showDate) => { const dd = parseD(x.d); return `<button class="arow" ${itemAct(x)}>${showDate ? `<span class="adate ${dd.getDay() === 0 || x.kind === 'hol' ? 'red' : ''}"><b>${dd.getMonth() + 1}/${dd.getDate()}</b><small>${DOW[dd.getDay()]}</small></span>` : ''}<i class="cdot ${x.kind}"></i><span class="grow"><b>${esc(x.label)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span><span class="chev">›</span></button>`; };

Object.assign(ACT, {
  staffLeaveAsk: () => { const st = S.staff.find(x => x.id === S.editStaff); if (!st) return; sheet(`<div class="ttl" style="font-size:22px">${esc(st.name)} 선생님을 '그만두신 선생님'으로 옮길까요?</div><div class="sub">교사 명단 · 조직도 · 업무 분담에서 빠지고, 구글 로그인도 막혀요. 기록은 남아 있어서 디렉터 · 관리자가 설정 → 교사 명단 아래 '그만두신 선생님'에서 언제든 되돌릴 수 있어요.</div><div class="btns"><button class="pri" data-act="staffLeave" data-id="${st.id}">옮기기</button><button class="sec" data-act="sheetClose">취소</button></div>`); },
  staffLeave: d => staffLeave(d.id),
  staffBack: d => staffBack(d.id),
  staffPurgeAsk: d => { const st = (S.staffLeft || []).find(x => x.id === d.id); sheet(`<div class="ttl" style="font-size:22px">${esc(st ? st.name : '')} 선생님 카드를 완전히 지울까요?</div><div class="sub">사진과 카드가 지워지고 되돌릴 수 없어요. 그동안 쓴 공지 · 설교 · 기록은 남아요.</div><div class="btns"><button class="pri danger" data-act="staffPurge" data-id="${d.id}">완전히 지우기</button><button class="sec" data-act="sheetClose">취소</button></div>`); },
  staffPurge: d => staffPurge(d.id),
  matNew: () => matSheet(),
  matSave: () => matSave(),
  matDel: async d => { try { await deleteDoc(doc(db, 'materials', d.id)); MAT.by[d.d] = (MAT.by[d.d] || []).filter(x => x.id !== d.id); paint(); toast('지웠어요'); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); } }
});

/* ================= v14 · 성별 · 아이 사진 크게 보기 ================= */
const genderMark = k => k.gender === 'm' ? '<i class="gm m" title="남자 아이">남</i>' : k.gender === 'f' ? '<i class="gm f" title="여자 아이">여</i>' : '';
const genderPick = k => `<span class="gpick">${[['m', '남자'], ['f', '여자']].map(([v, l]) => `<button class="gbtn ${v} ${k.gender === v ? 'on' : ''}" data-act="gSet" data-id="${k.id}" data-g="${v}">${l}</button>`).join('')}</span>`;
async function gSet(id, g) {
  const k = findKid(id); if (!k) return;
  const v = k.gender === g ? '' : g;
  try { await updateDoc(doc(db, 'children', id), { gender: v }); k.gender = v; softPaint(); if (document.getElementById('gbulk')) gBulkSheet(); }
  catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
function gBulkSheet() {
  const c = S.cur, l = activeKids(c).filter(k => !k.gender || GB.done.has(k.id));
  sheet(`<div id="gbulk"><div class="ttl" style="font-size:24px">${esc(clsName(c))} · 남자 · 여자 정하기</div><div class="sub">사진을 보고 눌러 주세요. 누르는 순간 저장돼요. 헷갈리면 비워 두셔도 돼요.</div>
<div class="glist">${l.map(k => `<div class="grow2">${avatar(k, 52)}<b>${esc(k.name)}</b>${genderPick(k)}</div>`).join('') || '<div class="sub">모두 정했어요.</div>'}</div>
<div class="btns"><button class="pri" data-act="sheetClose">다 했어요</button></div></div>`);
}
const GB = { done: new Set() };
function kidZoom(slot) {
  const k = findKid(S.arg), kd = S.kidData && S.kidFor === k.id ? S.kidData : null;
  const src = kd?.photos?.[slot] || (slot === 'main' ? k.thumb : null); if (!src) return;
  const el = document.createElement('div'); el.className = 'lbox'; el.innerHTML = `<img src="${src}" alt=""><button class="lbx" aria-label="닫기">×</button>`;
  el.addEventListener('click', () => { el.remove(); history.state && history.state.lbox && history.back(); });
  document.body.appendChild(el); history.pushState({ lbox: 1 }, '');
  const pop = () => { el.remove(); window.removeEventListener('popstate', pop); }; window.addEventListener('popstate', pop);
}
Object.assign(ACT, {
  gSet: d => { GB.done.add(d.id); gSet(d.id, d.g); },
  gBulk: () => { GB.done = new Set(); gBulkSheet(); },
  gsel: d => { $('#e_gender').value = d.id; document.querySelectorAll('.gseg button').forEach(b => b.classList.toggle('on', b.dataset.id === d.id)); },
  kidZoom: d => kidZoom(d.slot)
});

/* ================= v15 · 아이 표시 · 결석 단계 · 교사실 서랍 ================= */
const TAG_AUTO = ['장기결석', '장기 결석'];
const TAG_PRESET = [['선교사 가정', 'mis'], ['VIP', 'vip'], ['새친구', 'new'], ['돌봄 필요', 'care'], ['알레르기', 'alg'], ['형제 함께', 'sib'], ['다문화 가정', 'mul'], ['특별한 도움', 'help']];
const tagCls = t => (TAG_PRESET.find(x => x[0] === t) || [0, 'etc'])[1];
const kidTags = k => (k.flags || []).filter(f => !TAG_AUTO.includes(f)).map(f => `<span class="ktag ${tagCls(f)}">${esc(f)}</span>`).join('');
// 출석부에서 계산 — 주일이 지나 출석을 기록할 때마다 자동으로 바뀌어요
function absTag(n, long) {
  if (n < 2) return '';
  const [cls, txt] = n >= 8 ? ['abs3', long ? `${n}주째 못 봤어요 · 연락해 볼까요?` : `${n}주 못 봄`] : n >= 4 ? ['abs2', long ? `장기 결석 · ${n}주째` : `장기 ${n}주`] : ['abs1', `${n}주째 결석`];
  return `<span class="atag ${cls}" title="출석부로 자동 계산">${txt}</span>`;
}
function tagSheet() {
  const k = findKid(S.arg); if (!k) return;
  TS.sel = new Set((k.flags || []).filter(f => !TAG_AUTO.includes(f)));
  const draw = () => {
    const custom = [...TS.sel].filter(t => !TAG_PRESET.some(p => p[0] === t));
    $('#tagbox').innerHTML = TAG_PRESET.map(([t, c]) => `<button type="button" class="ktag pick ${c} ${TS.sel.has(t) ? 'on' : ''}" data-act="tagTog" data-id="${esc(t)}">${TS.sel.has(t) ? '✓ ' : ''}${esc(t)}</button>`).join('') + custom.map(t => `<button type="button" class="ktag pick etc on" data-act="tagTog" data-id="${esc(t)}">✓ ${esc(t)} ×</button>`).join('');
  };
  TS.draw = draw;
  sheet(`<div class="ttl" style="font-size:24px">${esc(k.name)} · 표시</div>
<div class="sub">누르면 켜지고 다시 누르면 꺼져요. 결석 표시는 출석부로 자동 계산돼서 여기서 고치지 않아요.</div>
<div class="tagpick" id="tagbox"></div>
<div class="addtag"><input class="in" id="tag_new" placeholder="새 표시 (예: 우유 알레르기)" maxlength="16"><button class="sec sm" data-act="tagAdd">더하기</button></div>
<label class="fld">메모 <span class="s2">(표시로 쓰기 긴 이야기)</span><input class="in" id="tag_remark" value="${esc(TAG_AUTO.includes(k.remark || '') ? '' : (k.remark || ''))}"></label>
<div class="btns"><button class="pri" data-act="tagSave">저장</button><button class="sec" data-act="sheetClose">취소</button></div>`);
  draw();
}
const TS = { sel: new Set(), draw: null };
async function tagSave() {
  const k = findKid(S.arg); if (!k) return;
  const flags = [...TS.sel], remark = val('tag_remark');
  try { await updateDoc(doc(db, 'children', k.id), { flags, remark }); k.flags = flags; k.remark = remark; closeSheet(); toast('저장했어요'); paint(); }
  catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
}
const ROOM_INFO = { notice: ['공지', '디렉터 공지 · 링크 · 사진', '<path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>', '#C62828'], cal: ['캘린더', '행사 · 공휴일 · 생일', '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', '#E08A00'], turns: ['순서표', '주일 설교 · 기도 · 챈트 · 율동', '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/>', '#2E9D8F'], duty: ['업무 분담', '누가 무엇을 맡는지', '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11l2 2 4-4"/>', '#3A6EA5'], org: ['조직도', '반 · 담임 · 보조 선생님', '<rect x="9" y="3" width="6" height="5" rx="1.5"/><rect x="3" y="16" width="6" height="5" rx="1.5"/><rect x="15" y="16" width="6" height="5" rx="1.5"/><path d="M12 8v4M6 16v-2h12v2"/>', '#7B4FB8'], stats: ['통계', '주일 인원 · 출석', ICON.stats, '#6B5646'] };
const roomPick = active => { const r = ROOM_INFO[active] || ROOM_INFO.notice; return `<button class="roompick" data-act="roomMenu"><span class="rpic" style="background:${r[3]}">${svg(r[2], 22, 1.9)}</span><span class="grow"><b>${r[0]}</b><small>${r[1]}</small></span><span class="rpmore">다른 방 ${svg('<path d="M6 9l6 6 6-6"/>', 16, 2.2)}</span></button>`; };
function roomMenu() {
  sheet(`<div class="ttl" style="font-size:24px">교사실</div><div class="roomtiles">${ROOM_TABS.map(([k]) => { const r = ROOM_INFO[k]; return `<button class="rtile ${R.tab === k ? 'on' : ''}" data-act="rtabGo" data-id="${k}" style="--c:${r[3]}"><span class="rpic" style="background:${r[3]}">${svg(r[2], 26, 1.9)}</span><b>${r[0]}</b><small>${r[1]}</small></button>`; }).join('')}</div>`);
}
Object.assign(ACT, {
  tagSheet: () => tagSheet(),
  tagTog: d => { if (TS.sel.has(d.id)) TS.sel.delete(d.id); else TS.sel.add(d.id); TS.draw && TS.draw(); },
  tagAdd: () => { const v = val('tag_new').replace(/\s+/g, ' '); if (!v) return; if (TAG_AUTO.includes(v)) return toast('결석 표시는 출석부로 자동 계산돼요'); TS.sel.add(v); $('#tag_new').value = ''; TS.draw && TS.draw(); },
  tagSave: () => tagSave(),
  roomMenu: () => roomMenu(),
  rtabGo: d => { closeSheet(); ACT.rtab(d); }
});

/* ================= v16 · 교사실 아이콘 6칸 ================= */
const ROOM_SHORT = { notice: '공지', cal: '캘린더', turns: '순서표', duty: '업무', org: '조직도', stats: '통계' };
const roomDock = active => `<nav class="rdock" aria-label="교사실">${ROOM_TABS.map(([k]) => { const r = ROOM_INFO[k]; return `<button class="rdk ${active === k ? 'on' : ''}" data-act="rtab" data-id="${k}" style="--c:${r[3]}" aria-label="${r[0]}"><span class="rpic" style="background:${r[3]}">${svg(r[2], 22, 1.9)}</span><span>${ROOM_SHORT[k]}</span></button>`; }).join('')}</nav>`;

/* v17 — 아이콘 줄이 위에 붙으면 아래 선을 보여 줘요 */
document.addEventListener('scroll', e => { const sc = e.target; if (!sc.classList || !sc.classList.contains('scroll')) return; const d = sc.querySelector(':scope>.rdock'); if (d) d.classList.toggle('stuck', sc.scrollTop > 40); }, true);

/* ================= v18 · 아이폰 · 아이패드 다른 브라우저 안내 ================= */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const iosOther = () => { const u = navigator.userAgent; return isIOS() && (/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Whale|Instagram|FBAN|Line\//i.test(u) || !!window.__gCrWeb || !!window.__firefox__); };
function iosOtherNote(force) {
  if (!iosOther() || isStandalone()) return '';
  if (!force && lsGet('jc_iosnote2') === '1') return '';
  const app = /KAKAOTALK/i.test(navigator.userAgent) ? '카카오톡' : (/CriOS/.test(navigator.userAgent) || window.__gCrWeb) ? '크롬' : '이 브라우저';
  return `<div class="iosnote full">${svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>', 20, 2)}<span class="grow"><b>${app}에서 홈 화면에 추가하면 아이콘이 '조' 글자로 나와요.</b><br>아이폰 · 아이패드는 <b>사파리</b>에서 추가해야 조이코너 아이콘이 제대로 들어가요. 주소를 복사해서 사파리에 붙여넣은 뒤 공유 ⬆ → 홈 화면에 추가를 눌러 주세요.<span class="btns2"><button class="pri sm" data-act="copyUrl">주소 복사</button>${force ? '' : '<button class="ghost sm" data-act="iosNoteOff">다음에</button>'}</span></span></div>`;
}
Object.assign(ACT, {
  copyUrl: async () => { const u = location.origin + location.pathname; try { await navigator.clipboard.writeText(u); toast('주소를 복사했어요 · 사파리 주소창에 붙여넣어 주세요'); } catch { prompt('이 주소를 복사해 사파리에 붙여넣어 주세요', u); } },
  iosNoteOff: () => { lsSet('jc_iosnote2', '1'); paint(); }
});

/* ================= v19 · 출석 마감 · 수정 기록 ================= */
const LOCK_IC = '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
const UNLOCK_IC = '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>';
const ATTL = { meta: {}, log: {} };
const attKey = () => `${S.cur}_${S.attDate}`;
// 지난 주일은 화요일이 지나면(수요일부터) 저절로 잠겨요 — 일부러 푼 경우(locked:false)만 빼고
const attAuto = d => addDays(d, 3) <= ymd(new Date());
function attLocked() {
  const m = ATTL.meta[attKey()] || {};
  if (m.locked === true) return true;
  if (m.locked === false) return false;
  return attAuto(S.attDate);
}
function attLockedToast() { toast(isAdminMe() ? '마감된 출석부예요 · 고치려면 [잠금 풀기]를 눌러 주세요' : '마감된 출석부예요 · 고칠 게 있으면 디렉터 · 관리자에게 말씀해 주세요'); }
function attLockBar(n, total) {
  const m = ATTL.meta[attKey()] || {}, locked = attLocked(), auto = locked && m.locked !== true;
  const canUnlock = isAdminMe() || (m.locked === true && m.lockedBy === S.me.email && !attAuto(S.attDate));
  if (locked) return `<div class="lockbar on">${svg(LOCK_IC, 22, 2)}<span class="grow"><b>마감된 출석부 · ${n}명 출석</b><small>${auto ? '지난 주일이라 저절로 잠겼어요' : `${esc(m.lockedByName || '')} 선생님이 ${m.lockedAt ? (t => `${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())}`)(new Date(m.lockedAt)) : ''} 마감`}</small></span><button class="ghost sm" data-act="attLog">기록</button>${canUnlock ? `<button class="ghost sm" data-act="attUnlockAsk">${svg(UNLOCK_IC, 15, 2)}잠금 풀기</button>` : ''}</div>`;
  return `<div class="lockbar"><span class="grow"><b>한 번 누르면 출석, 다시 누르면 취소</b><small>다 체크했으면 [출석 마감]을 눌러 잠가 주세요 · 수요일엔 저절로 잠겨요</small></span><button class="ghost sm" data-act="attLog">기록</button><button class="ghost sm" data-act="clearAsk">다시 하기</button><button class="pri sm" data-act="attLockAsk" ${total ? '' : 'disabled'}>${svg(LOCK_IC, 16, 2.2)}출석 마감</button></div>`;
}
function attLog(kind, extra = {}) {
  const c = S.cur, d = S.attDate;
  const row = { key: `${c}_${d}`, classId: c, date: d, kind, at: new Date().toISOString(), by: S.me.email, name: myName(), ...extra };
  const r = doc(collection(db, 'attlog')); (ATTL.log[row.key] ||= null);
  setDoc(r, row).catch(() => { });
  if (Array.isArray(ATTL.log[row.key])) ATTL.log[row.key].unshift({ id: r.id, ...row });
}
async function attLockSet(lock) {
  const c = S.cur, d = S.attDate, key = `${c}_${d}`;
  const data = lock ? { classId: c, date: d, locked: true, lockedBy: S.me.email, lockedByName: myName(), lockedAt: new Date().toISOString() } : { classId: c, date: d, locked: false, lockedBy: '', lockedByName: '', lockedAt: '', unlockedBy: S.me.email, unlockedAt: new Date().toISOString() };
  try { await setDoc(doc(db, 'attendance', key), data, { merge: true }); ATTL.meta[key] = { ...(ATTL.meta[key] || {}), ...data }; attLog(lock ? 'lock' : 'unlock', { n: Object.keys((S.att[c] || {})[d] || {}).length }); closeSheet(); toast(lock ? '출석을 마감했어요 · 이제 실수로 바뀌지 않아요' : '잠금을 풀었어요 · 다 고치면 다시 [출석 마감]을 눌러 주세요'); paint(); }
  catch (e) { toast((lock ? '마감' : '잠금 풀기') + '하지 못했어요: ' + errMsg(e)); }
}
const LOG_TXT = { on: '출석 체크', off: '출석 취소', all: '전원 출석', clear: '모두 지움', lock: '출석 마감', unlock: '잠금 풀기' };
async function attLogSheet() {
  const key = attKey();
  sheet(`<div class="ttl" style="font-size:24px">출석 기록 · ${esc(clsName(S.cur))} ${fmtShort(S.attDate)}</div><div class="sub">불러오는 중…</div>`);
  if (!Array.isArray(ATTL.log[key])) { try { const sn = await getDocs(query(collection(db, 'attlog'), where('key', '==', key))); ATTL.log[key] = sn.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => ko(b.at, a.at)); } catch { ATTL.log[key] = []; } }
  const l = ATTL.log[key];
  sheet(`<div class="ttl" style="font-size:24px">출석 기록 · ${esc(clsName(S.cur))} ${fmtShort(S.attDate)}</div>
<div class="sub">누가 언제 무엇을 바꿨는지 남아요. 기록은 지울 수 없어요.</div>
<div class="loglist">${l.length ? l.map(x => { const t = new Date(x.at); return `<div class="logrow ${x.kind}"><span class="lt">${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())}</span><span class="lk">${LOG_TXT[x.kind] || x.kind}${x.undo ? ' (되돌리기)' : ''}</span><span class="grow">${x.kidName ? `<b>${esc(x.kidName)}</b>` : x.n ? `${x.n}명` : ''}</span><span class="lw">${esc(x.name || '')}</span></div>`; }).join('') : '<div class="sub" style="padding:12px">아직 기록이 없어요. (v19부터 기록돼요)</div>'}</div>
<div class="btns"><button class="pri" data-act="sheetClose">닫기</button></div>`);
}
let undoT = null;
function undoBar(msg, fn) {
  const old = document.querySelector('.undobar'); if (old) old.remove(); clearTimeout(undoT);
  const el = document.createElement('div'); el.className = 'undobar'; el.innerHTML = `<span>${esc(msg)}</span><button>되돌리기</button>`;
  el.querySelector('button').onclick = () => { el.remove(); clearTimeout(undoT); fn(); };
  document.body.appendChild(el); undoT = setTimeout(() => el.remove(), 5000);
}
Object.assign(ACT, {
  attLockAsk: () => { const c = S.cur, d = S.attDate, n = activeKids(c).filter(k => ((S.att[c] || {})[d] || {})[k.id] === 'p').length; sheet(`<div class="ttl" style="font-size:22px">${esc(clsName(c))} ${fmtShort(d)} 출석을 마감할까요?</div><div class="sub">${n}명 출석 · ${activeKids(c).length - n}명 결석으로 잠가요. 잠근 뒤에는 누구도 실수로 바꿀 수 없어요. 고칠 게 생기면 마감한 선생님이나 디렉터 · 관리자가 풀 수 있어요.</div><div class="btns"><button class="pri" data-act="attLock">${svg(LOCK_IC, 18, 2.2)} 마감하기</button><button class="sec" data-act="sheetClose">아직이요</button></div>`); },
  attLock: () => attLockSet(true),
  attUnlockAsk: () => sheet(`<div class="ttl" style="font-size:22px">잠금을 풀까요?</div><div class="sub">다른 선생님들도 다시 체크를 바꿀 수 있게 돼요. 누가 풀었는지 기록에 남아요. 다 고치면 다시 [출석 마감]을 눌러 주세요.</div><div class="btns"><button class="pri" data-act="attUnlock">잠금 풀기</button><button class="sec" data-act="sheetClose">취소</button></div>`),
  attUnlock: () => attLockSet(false),
  attLockInfo: () => attLockedToast(),
  attLog: () => attLogSheet()
});

/* ================= v20 · 임시 저장 · 양식 ================= */
const lsDel = k => { try { localStorage.removeItem(k); } catch { /* 괜찮아요 */ } };
const adKey = id => `jc_ad_${S.me.email}_${id || 'new'}`;
const noticeFields = () => ({ category: val('n_cat'), title: val('n_title'), body: ($('#n_body') || {}).value || '', links: (($('#n_links') || {}).value || '').trim(), eventDate: val('n_date'), eventTime: val('n_time'), pinned: !!($('#n_pin') || {}).checked });
function autoDraft(id) { if (!$('#n_title')) return; const f = noticeFields(); if (!f.title && !f.body) return; lsSet(adKey(id), JSON.stringify({ ...f, savedAt: new Date().toISOString() })); }
function localDraftNote(id) {
  let d = null; try { d = JSON.parse(lsGet(adKey(id)) || 'null'); } catch { d = null; }
  if (!d || R.draftId) return '';
  const t = new Date(d.savedAt);
  return `<div class="adnote">${svg('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>', 18, 2)}<span class="grow">쓰다 만 글이 있어요 · ${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())} <b>${esc(d.title || '(제목 없음)')}</b></span><button class="ghost sm" data-act="adUse">이어 쓰기</button><button class="ghost sm" data-act="adDrop">버리기</button></div>`;
}
function fillNotice(f) {
  if (f.category !== undefined && $('#n_cat')) $('#n_cat').value = f.category || '공지';
  if (f.title !== undefined) $('#n_title').value = f.title || '';
  if (f.body !== undefined) $('#n_body').value = f.body || '';
  if (f.links !== undefined) $('#n_links').value = f.links || '';
  if (f.eventDate !== undefined) $('#n_date').value = f.eventDate || '';
  if (f.eventTime !== undefined) $('#n_time').value = f.eventTime || '';
  if (f.pinned !== undefined) $('#n_pin').checked = !!f.pinned;
  const bg = $('#sheet'); if (bg) bg.dataset.dirty = '1';
}
/* 임시 저장 (나만 보여요) */
const DR = { list: null };
async function loadDrafts() {
  DR.list = [];
  try { const sn = await getDocs(query(collection(db, 'drafts'), where('owner', '==', S.me.email))); DR.list = sn.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => ko(b.savedAt || '', a.savedAt || '')); } catch { DR.list = []; }
  softPaint();
}
function draftList() {
  const l = DR.list || []; if (!l.length) return '';
  return `<section class="card full drafts"><div class="lbl"><span>내 임시 저장 ${l.length}개</span><span class="s2">나만 보여요</span></div>${l.map(d => { const t = new Date(d.savedAt); return `<div class="drow"><button class="grow" data-act="draftOpen" data-id="${d.id}"><b>${esc(d.title || '(제목 없음)')}</b><small>${d.noticeId ? '게시한 공지 고치는 중 · ' : ''}${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())} 저장 · ${esc((d.body || '').split('\\n')[0].slice(0, 40))}</small></button><button class="editbtn" data-act="draftDel" data-id="${d.id}" aria-label="지우기">${svg('<path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15, 1.8)}</button></div>`; }).join('')}</section>`;
}
async function draftSave() {
  const f = noticeFields(); if (!f.title && !f.body) return toast('제목이나 내용을 조금이라도 적어 주세요');
  const data = { ...f, owner: S.me.email, kind: 'notice', noticeId: R.editNotice || '', savedAt: new Date().toISOString() };
  try {
    const ref = R.draftId ? doc(db, 'drafts', R.draftId) : doc(collection(db, 'drafts'));
    await setDoc(ref, data); R.draftId = ref.id;
    DR.list = [{ id: ref.id, ...data }, ...(DR.list || []).filter(x => x.id !== ref.id)];
    lsDel(adKey(R.editNotice)); const bg = $('#sheet'); if (bg) delete bg.dataset.dirty;
    toast('임시 저장했어요 · 교사실 → 공지의 "내 임시 저장"에서 이어 쓸 수 있어요');
  } catch (e) { toast('임시 저장하지 못했어요: ' + errMsg(e)); }
}
/* 양식 */
const TPL_BUILTIN = [
  { id: 'b1', name: '행사 안내', builtin: true, category: '행사', title: '[행사] ', body: '■ 일시: \n■ 장소: \n■ 대상: \n■ 준비물: \n■ 담당: \n■ 참고: ' },
  { id: 'b2', name: '주일 공지', builtin: true, category: '공지', title: '이번 주일 조이코너 안내', body: '■ 이번 주 이야기: \n■ 설교 · 기도: \n■ 준비할 것: \n■ 함께 기도해요: ' },
  { id: 'b3', name: '기도 제목', builtin: true, category: '기도', title: '함께 기도해요', body: '1. \n2. \n3. ' },
  { id: 'b4', name: '자료 공유', builtin: true, category: '자료', title: '[자료] ', body: '무엇: \n어디에 쓰나요: \n', links: 'https://' }
];
const TPL = { list: null };
async function loadTpls() {
  if (TPL.list) return;
  TPL.list = [];
  try { const sn = await getDocs(query(collection(db, 'templates'), where('kind', '==', 'notice'))); TPL.list = sn.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => ko(a.name || '', b.name || '')); } catch { TPL.list = []; }
  const bar = $('#tplbar'); if (bar) bar.innerHTML = tplBar();
}
function tplBar() {
  const all = [...TPL_BUILTIN, ...(TPL.list || [])];
  return `<span class="tpll">${svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', 16, 2)}양식</span>${all.map(t => `<span class="tplchip ${t.builtin ? '' : 'mine'}"><button data-act="tplUse" data-id="${t.id}">${esc(t.name)}</button>${!t.builtin && (t.by === S.me.email || isAdminMe()) ? `<button class="x" data-act="tplDel" data-id="${t.id}" aria-label="${esc(t.name)} 양식 지우기">×</button>` : ''}</span>`).join('')}`;
}
function tplUse(id) {
  const t = [...TPL_BUILTIN, ...(TPL.list || [])].find(x => x.id === id); if (!t) return;
  const f = noticeFields();
  const apply = () => { fillNotice({ category: t.category || '공지', title: t.title || '', body: t.body || '', links: t.links || '' }); toast(`"${t.name}" 양식을 넣었어요`); };
  if ((f.title && f.title !== t.title) || f.body) { const ok = confirm(`지금 쓴 제목 · 내용을 "${t.name}" 양식으로 바꿀까요?`); if (!ok) return; }
  apply();
}
async function tplSave(name) {
  const f = noticeFields();
  const data = { kind: 'notice', name, category: f.category, title: f.title, body: f.body, links: f.links, by: S.me.email, byName: myName(), at: new Date().toISOString() };
  try { const r = doc(collection(db, 'templates')); await setDoc(r, data); (TPL.list ||= []).push({ id: r.id, ...data }); const bar = $('#tplbar'); if (bar) bar.innerHTML = tplBar(); toast(`"${name}" 양식을 만들었어요 · 다음에 공지를 쓸 때 위쪽에서 골라요`); }
  catch (e) { toast('양식을 저장하지 못했어요: ' + errMsg(e)); }
}
Object.assign(ACT, {
  draftSave: () => draftSave(),
  draftOpen: d => { const x = (DR.list || []).find(y => y.id === d.id); if (x) noticeSheet(x.noticeId || null, x); },
  draftDel: async d => { if (!confirm('이 임시 저장 글을 지울까요?')) return; try { await deleteDoc(doc(db, 'drafts', d.id)); DR.list = DR.list.filter(x => x.id !== d.id); paint(); toast('지웠어요'); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); } },
  noticeCancel: () => { const bg = $('#sheet'); if (bg && bg.dataset.dirty) { autoDraft(R.editNotice); toast('쓰던 내용은 이 기기에 보관했어요 · 다시 열면 이어 쓸 수 있어요'); } closeSheet(); paint(); },
  adUse: () => { let d = null; try { d = JSON.parse(lsGet(adKey(R.editNotice)) || 'null'); } catch { d = null; } if (d) fillNotice(d); const el = document.querySelector('.adnote'); if (el) el.remove(); },
  adDrop: () => { lsDel(adKey(R.editNotice)); const el = document.querySelector('.adnote'); if (el) el.remove(); },
  tplUse: d => tplUse(d.id),
  tplDel: async d => { const t = (TPL.list || []).find(x => x.id === d.id); if (!t || !confirm(`"${t.name}" 양식을 지울까요?`)) return; try { await deleteDoc(doc(db, 'templates', d.id)); TPL.list = TPL.list.filter(x => x.id !== d.id); const bar = $('#tplbar'); if (bar) bar.innerHTML = tplBar(); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); } },
  tplSaveAsk: () => { const f = noticeFields(); if (!f.title && !f.body) return toast('양식으로 만들 제목이나 내용을 먼저 적어 주세요'); const name = (prompt('양식 이름을 정해 주세요 (예: 월례 회의 안내)', f.title.replace(/^\[.*?\]\s*/, '').slice(0, 14)) || '').trim(); if (name) tplSave(name.slice(0, 20)); }
});

/* ================= v21 · 조직도 '함께 섬기는 선생님' ================= */
function orgRest(dirs, admins, cls) {
  const shown = new Set([...dirs, ...admins].map(x => x.name));
  cls.forEach(c => { const cs = classStaff(c.id); [...cs.homeroom, ...cs.assistants].forEach(n => shown.add(n)); });
  const rest = S.staff.filter(x => x.kind !== 'helper' && !shown.has(x.name));
  const helpers = S.staff.filter(x => x.kind === 'helper');
  if (!rest.length && !helpers.length) return '';
  const card = st => `<button class="ocard" data-act="staffOpen" data-id="${st.id}">${staffAv(st, 44)}<b>${esc(st.name)}</b><small>${esc(dutiesOf(st.name).map(x => x.role).slice(0, 2).join(' · ') || (st.since ? fmtShort(st.since) + ' 함께' : '반 배정 전'))}</small></button>`;
  return `<div class="orest">${rest.length ? `<div class="orhead"><span class="orpill">${svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 19"/>', 16, 2)}함께 섬기는 선생님</span><span class="s2">반 없이 섬기거나 반 배정 전 · ${rest.length}명</span></div><div class="ocards">${rest.map(card).join('')}</div>` : ''}
${helpers.length ? `<div class="orhelp">${svg('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>', 15, 2)}헬퍼 선생님 ${helpers.length}명은 조직도에 넣지 않고 설정 → 교사 명단의 '헬퍼 선생님 풀'에 있어요</div>` : ''}</div>`;
}

/* ================= v22 · 선생님 탭 · 전체 한눈에 홈 ================= */
ROOM_INFO.tch = ['선생님', '전화 · 생일 · 소속 · 주소', '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><circle cx="17.2" cy="9.2" r="2.6"/><path d="M16 14.4a5 5 0 0 1 5.6 5.1"/>', '#D0567F'];
ROOM_SHORT.tch = '선생님';
ROOM_TABS.splice(4, 0, ['tch', '선생님']);

/* 주소는 따로 보관 — 디렉터 · 관리자와 본인만 */
const TP = { addr: null, busy: false };
const myStaff = () => S.staff.find(x => x.email && x.email === S.me.email);
const canSeeAddr = st => isAdminMe() || isDirectorMe() || !!(st.email && st.email === S.me.email);
function loadAddr() {
  if (TP.addr || TP.busy) return; TP.busy = true;
  (async () => {
    const m = {};
    try {
      if (isAdminMe() || isDirectorMe()) { const ss = await getDocs(collection(db, 'staffPrivate')); ss.forEach(d => { m[d.id] = d.data().address || ''; }); }
      else { const mine = myStaff(); if (mine) { const d = await getDoc(doc(db, 'staffPrivate', mine.id)); if (d.exists()) m[mine.id] = d.data().address || ''; } }
    } catch { /* 권한/오프라인 */ }
    TP.addr = m; TP.busy = false; softPaint();
  })();
}
async function addrOf(id) {
  if (TP.addr && id in TP.addr) return TP.addr[id];
  try { const d = await getDoc(doc(db, 'staffPrivate', id)); return d.exists() ? d.data().address || '' : ''; } catch { return ''; }
}
async function addrSave(id, address) {
  const old = TP.addr && id in TP.addr ? TP.addr[id] : null;
  if (old === address || (old === null && !address)) return;
  if (address) await setDoc(doc(db, 'staffPrivate', id), { staffId: id, address, at: new Date().toISOString(), by: S.me.email });
  else await deleteDoc(doc(db, 'staffPrivate', id)).catch(() => { });
  (TP.addr ||= {})[id] = address;
}
const orgOf = st => [st.jin ? st.jin + (/진$/.test(st.jin) ? '' : ' 진') : '', st.cell ? st.cell + (/셀$/.test(st.cell) ? '' : ' 셀') : ''].filter(Boolean).join(' · ');
const bdayKo = b => { if (!b) return ''; const [, m, d] = b.split('-').map(Number); return `${m}월 ${d}일`; };
const TICO = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  cake: '<path d="M4 21h16v-8H4z"/><path d="M4 16c2 1.4 4 1.4 6 0s4-1.4 6 0 3 1 4 0"/><path d="M12 13V9"/><path d="M12 6.5c-1-1-1-2.3 0-3.5 1 1.2 1 2.5 0 3.5"/>',
  church: '<path d="M12 2v5M10 4h4"/><path d="M5 21V11l7-4 7 4v10z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v11h14V10"/>'
};
const TF = { f: 'all', q: '' };
function tchMatch(st) {
  const f = TF.f;
  return f === 'all' ? true : f === 'helper' ? st.kind === 'helper' : f === 'none' ? st.kind !== 'helper' && !(st.classes || []).length : (st.classes || []).includes(f);
}
function tchCard(st) {
  const mine = !!(st.email && st.email === S.me.email), edit = isAdminMe() || mine;
  const cls = Object.entries(st.classRole || {}).map(([c, r]) => `${clsName(c)} ${r}`).join(' · ') || (st.kind === 'helper' ? '헬퍼 선생님' : '반 배정 전');
  const tag = st.role === 'director' || st.role === 'admin' ? `<span class="tag">${roleLabel(st)}</span>` : '';
  const showAddr = canSeeAddr(st), addr = showAddr ? (TP.addr ? TP.addr[st.id] || '' : '…') : '';
  const row = (ic, label, v) => `<div class="ti"><span class="tic">${svg(ic, 15, 2)}</span><span class="tl">${label}</span><span class="tv ${v ? '' : 'empty'}">${v || '—'}</span></div>`;
  const q = [st.name, st.jin, st.cell, st.phone].join(' ').toLowerCase();
  const hide = TF.q && !q.includes(TF.q);
  return `<article class="tcard ${mine ? 'me' : ''}" data-q="${esc(q)}" ${hide ? 'hidden' : ''}>
<button class="phead" data-act="staffOpen" data-id="${st.id}">${staffAv(st, 56)}<span class="tt"><b>${esc(st.name)}</b><span>${esc(cls)}</span></span>${tag}</button>
<div class="tinfo">${row(TICO.phone, '전화', st.phone ? `<a href="tel:${esc(st.phone)}">${esc(st.phone)}</a>` : '')}${row(TICO.cake, '생일', bdayKo(st.birth))}${row(TICO.church, '소속', esc(orgOf(st)))}${showAddr ? row(TICO.home, '주소', esc(addr)) : ''}</div>
${st.phone || edit ? `<div class="tbtns">${st.phone ? `<a class="tb" href="tel:${esc(st.phone)}">${svg(TICO.phone, 15, 2)}전화</a><a class="tb" href="sms:${esc(st.phone)}">${svg('<path d="M4 5h16v11H9l-5 4z"/>', 15, 2)}문자</a>` : ''}${edit ? `<button class="tb ed" data-act="staffEdit" data-id="${st.id}">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 15, 2)}고치기</button>` : ''}</div>` : ''}
</article>`;
}
function rTeachers() {
  loadAddr();
  const cls = Object.keys(S.classes).sort((a, b) => (S.classes[a].age || 0) - (S.classes[b].age || 0));
  const all = S.staff.slice().sort((a, b) => (a.kind === 'helper') - (b.kind === 'helper') || (a.role === 'director' ? -1 : 0) - (b.role === 'director' ? -1 : 0) || (a.order ?? 999) - (b.order ?? 999) || ko(a.name, b.name));
  const cnt = k => { const o = TF.f; TF.f = k; const n = all.filter(tchMatch).length; TF.f = o; return n; };
  const chips = [['all', '전체'], ...cls.map(c => [c, clsName(c)]), ['none', '반 없음'], ['helper', '헬퍼']].map(([k, l]) => [k, l, cnt(k)]).filter(([k, , n]) => k === 'all' || n > 0);
  const l = all.filter(tchMatch), mine = myStaff();
  const noInfo = isAdminMe() ? S.staff.filter(x => x.kind !== 'helper' && !x.phone && !x.birth).length : 0;
  return `<div class="tchtop full"><input class="search" id="tq" type="search" placeholder="이름 · 진 · 셀 · 번호로 찾기" autocomplete="off" value="${esc(TF.q)}">${mine ? `<button class="pri sm" data-act="staffEdit" data-id="${mine.id}">내 카드 채우기</button>` : ''}
<div class="chips tchf">${chips.map(([k, lb, n]) => `<button class="chip ${TF.f === k ? 'on' : ''}" data-act="tchF" data-id="${k}">${esc(lb)} <small>${n}</small></button>`).join('')}</div></div>
${noInfo ? `<div class="note full soft">전화 · 생일이 비어 있는 선생님 ${noInfo}명 · 본인이 [내 카드 채우기]로 넣거나, 카드의 [고치기]로 넣어 주세요</div>` : ''}
<div class="tgrid full" id="tgrid">${l.map(tchCard).join('') || '<div class="sub">해당하는 선생님이 없어요.</div>'}</div>
<div class="s2 full">전화 · 생일 · 소속은 모든 선생님이 함께 보고, 주소는 디렉터 · 관리자와 본인만 봐요.</div>`;
}
document.addEventListener('input', e => {
  if (e.target.id !== 'tq') return;
  TF.q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('#tgrid .tcard').forEach(c => { c.hidden = !!TF.q && !c.dataset.q.includes(TF.q); });
});
function staffMoreLine(st) {
  const org = orgOf(st), show = canSeeAddr(st), addr = show && TP.addr ? TP.addr[st.id] || '' : '';
  if (show) loadAddr();
  return (org ? `<div class="s2">소속 ${esc(org)}</div>` : '') + (addr ? `<div class="s2">주소 ${esc(addr)} <span class="tag g">디렉터 · 관리자 · 본인만</span></div>` : '');
}

/* ---------- 홈: 전체 한눈에 / 반별 보기 ---------- */
var HM = { mode: lsGet('jc_homemode') || 'all' };
const CLS_COL = { 4: '#C2185B', 5: '#E08A00', 6: '#2E9D8F', 7: '#3A6EA5' };
const clsCol = c => CLS_COL[(S.classes[c] || {}).age] || '#C62828';
function homeModeSeg() {
  if (S.myClasses.length < 2) return '';
  return `<div class="seg hmode full"><button class="${HM.mode === 'all' ? 'on' : ''}" data-act="homeMode" data-id="all">${svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>', 18, 2)}전체 한눈에</button><button class="${HM.mode === 'class' ? 'on' : ''}" data-act="homeMode" data-id="class">${svg(ICON.kids, 18, 2)}반별 보기</button></div>`;
}
function vHome() { return HM.mode === 'all' && S.myClasses.length >= 2 ? vHomeDash() : vHomeClass(); }
function nextService() {
  const t = ymd(new Date());
  return S.schedule.find(x => x.date >= t && !x.noService) || S.schedule[S.schedule.length - 1];
}
function homeSundayCard() {
  const nextS = nextService(); if (!nextS) return '';
  const diff = Math.round((parseD(nextS.date) - parseD(ymd(new Date()))) / 86400000);
  return `<section class="card"><div class="lbl"><span>${diff <= 7 ? '이번 주일' : '다음 주일'} · ${fmtMD(nextS.date)}</span></div><div class="big">${esc(nextS.story || (nextS.noService ? '조이코너 예배 없음' : '이야기 준비 중'))}</div><div class="meta">${nextS.preacher ? `<span>설교 ${esc(nextS.preacher)}</span>` : ''}${nextS.offering ? `<span>헌금기도 ${esc(nextS.offering)} 가정</span>` : ''}${nextS.pray ? `<span>중보기도 ${esc(nextS.pray)}</span>` : ''}</div><button class="ghost" data-act="go" data-to="worship">주일 예배 보기</button></section>`;
}
function homeMyTurn() {
  const me = S.me.name || '', nextS = nextService(); if (!me || !nextS) return '';
  const L = { preacher: '성경이야기 설교', pray: '중보기도 인도', nation: '성전건축·나라 기도', chant: '챈트', dance: '율동', guitar: '기타·메트로놈' };
  const m = Object.entries(L).filter(([k]) => hasName(nextS[k], me)).map(([, l]) => l);
  return m.length ? `<section class="card" style="border-color:#C62828"><div class="lbl"><span>${fmtMD(nextS.date)} 내 담당</span></div><div class="chips">${m.map(x => `<span class="chip">${x}</span>`).join('')}</div></section>` : '';
}
function bdaysAll(days = 31) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nx = b => { const [, m, d] = b.split('-').map(Number); let n = new Date(today.getFullYear(), m - 1, d); if (n < today) n = new Date(today.getFullYear() + 1, m - 1, d); return { n, days: Math.round((n - today) / 86400000), label: `${m}/${d}` }; };
  const out = [];
  S.myClasses.forEach(c => activeKids(c).filter(k => k.birth).forEach(k => out.push({ ...nx(k.birth), name: k.name, sub: clsName(c), act: `data-act="kid" data-id="${k.id}"`, av: avatar(k, 36) })));
  S.staff.filter(st => st.birth).forEach(st => out.push({ ...nx(st.birth), name: st.name + ' 선생님', sub: '선생님', act: `data-act="staffOpen" data-id="${st.id}"`, av: staffAv(st, 36), t: 1 }));
  return out.filter(x => x.days <= days).sort((a, b) => a.days - b.days);
}
function vHomeAll() {
  const cls = S.myClasses.slice().sort((a, b) => (S.classes[a].age || 0) - (S.classes[b].age || 0));
  const today = ymd(new Date());
  const kidsN = cls.reduce((s, c) => s + activeKids(c).length, 0);
  const lastD = cls.flatMap(c => recorded(c)).filter(d => d <= today).sort().pop() || '';
  const pres = lastD ? cls.reduce((s, c) => s + presentCount(c, lastD), 0) : 0;
  const care = cls.flatMap(c => careList(c).map(x => ({ ...x, c }))).sort((a, b) => b.n - a.n);
  const tN = S.staff.filter(x => x.kind !== 'helper').length;
  const md = d => { const x = parseD(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
  const tile = (c, ic, num, unit, label, act) => `<${act ? 'button' : 'div'} class="hs" ${act || ''} style="--c:${c}"><span class="hsi">${svg(ic, 22, 2)}</span><span><b>${num}<small>${unit}</small></b><small>${label}</small></span></${act ? 'button' : 'div'}>`;
  const ccard = c => {
    const cl = S.classes[c], ks = activeKids(c), cs = classStaff(c), n = lastD ? presentCount(c, lastD) : 0, pct = ks.length && lastD ? Math.round(n / ks.length * 100) : 0, cn = careList(c).length;
    return `<button class="hcls" data-act="homeCls" data-id="${c}" style="--c:${clsCol(c)}">
<span class="hcl-top"><span class="hage">${cl.age || '?'}<small>세</small></span><span class="grow"><b>${esc(cl.name)}</b><small>친구 ${ks.length}명${cs.homeroom.length ? ' · 담임 ' + esc(cs.homeroom.join(', ')) : ''}</small></span></span>
<span class="faces">${ks.slice(0, 5).map(k => `<span class="fc">${avatar(k, 40)}</span>`).join('')}${ks.length > 5 ? `<span class="fc more">+${ks.length - 5}</span>` : ''}</span>
<span class="hbar"><i><em style="width:${pct}%"></em></i><span class="hfoot"><small>${lastD ? `${md(lastD)} 출석 <b>${n}</b> / ${ks.length}명` : '출석 기록 전'}${cn ? ` · <span class="hcare">돌봄 ${cn}</span>` : ''}</small><span class="go">들어가기 ›</span></span></span></button>`;
  };
  const bd = bdaysAll().slice(0, 8);
  return `<div class="scroll cols">${homeHeader()}${homeModeSeg()}${iosOtherNote()}${holBanner()}${gcalBanner()}
<section class="hsum full">${tile('#E08A00', ICON.kids, kidsN, '명', '우리 친구들')}${tile('#2F7D4F', ICON.checkc, lastD ? pres : '—', lastD ? `/${kidsN}` : '', lastD ? `${md(lastD)} 주일 출석` : '출석 기록 전', 'data-act="go" data-to="stats"')}${tile('#D0567F', ROOM_INFO.tch[2], tN, '명', '선생님', 'data-act="rtab" data-id="tch"')}${tile('#C62828', '<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z"/>', care.length, '명', '돌봄이 필요해요')}</section>
<div class="hcgrid full">${cls.map(ccard).join('')}</div>
${homeSundayCard()}${homeMyTurn()}
<section class="card"><div class="lbl"><span>돌봄이 필요해요 · 모든 반</span></div>${care.length ? `<div class="carerow">${care.slice(0, 9).map(x => `<button class="carekid" data-act="kid" data-id="${x.k.id}">${avatar(x.k, 52)}<b>${esc(x.k.name)}</b><small class="cn" style="color:${clsCol(x.c)}">${esc(clsName(x.c))}</small>${absTag(x.n)}</button>`).join('')}</div>${care.length > 9 ? `<div class="s2">그 밖에 ${care.length - 9}명 · 반별 보기에서 확인해요</div>` : ''}` : `<div class="sub">지금은 걱정되는 친구가 없어요. 감사해요!</div>`}</section>
<section class="card"><div class="lbl"><span>곧 생일이에요 (한 달)</span></div>${bd.length ? `<div class="hbd">${bd.map(x => `<button class="hbdr" ${x.act}><span class="d">${x.label}</span>${x.av}<span class="grow"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span>${x.days === 0 ? '<span class="tag">오늘!</span>' : `<small class="s2">${x.days}일 뒤</small>`}</button>`).join('')}</div>` : '<div class="sub">한 달 안에 생일인 친구 · 선생님이 없어요.</div>'}</section>
${homeNoticeCard()}${homeEventsCard()}<section class="card homedock full"><div class="lbl"><span>교사실 바로 가기</span></div>${roomDock('')}</section>${versionCard()}
</div>${nav('home')}`;
}
Object.assign(ACT, {
  tchF: d => { TF.f = d.id; paint(); },
  homeMode: d => { HM.mode = d.id; lsSet('jc_homemode', d.id); S.lastKey = ''; if (d.id === 'all') S.myClasses.forEach(c => ensureAtt(c)); paint(); },
  homeCls: d => { S.cur = d.id; lsSet('jc_cur', d.id); HM.mode = 'class'; lsSet('jc_homemode', 'class'); S.lastKey = ''; route(); }
});

/* v24 — 앱 보관 도우미(서비스 워커): 홈 화면 앱 아이콘 · 빠른 열기 */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}

/* ================= v26 · 그림으로 보는 홈 (대시보드) ================= */
const clsSorted = () => S.myClasses.slice().sort((a, b) => (S.classes[a].age || 0) - (S.classes[b].age || 0));
const fmtMDs = d => { const x = parseD(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
function ringSvg(p, col, size = 120, sw = 12, track = 'rgba(0,0,0,.07)', inner = '') {
  const r = (size - sw) / 2, C = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p || 0)), h = size / 2;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/>${v > 0 ? `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(C * v).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${h} ${h})"/>` : ''}</svg><span class="rin">${inner}</span></span>`;
}
/* 반원 게이지 — 여러 조각 (값, 색) */
function gaugeSvg(parts, total, w = 240, sw = 24, inner = '') {
  const r = (w - sw) / 2, cx = w / 2, cy = r + sw / 2, L = Math.PI * r;
  let off = 0; const segs = [];
  parts.forEach(([v, col]) => { const len = total ? L * v / total : 0; if (len > 0) segs.push(`<path d="M${sw / 2} ${cy} A${r} ${r} 0 0 1 ${w - sw / 2} ${cy}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(1)} ${L.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`); off += len; });
  return `<span class="gauge" style="width:${w}px;height:${cy + 4}px"><svg viewBox="0 0 ${w} ${cy + 4}" width="${w}" height="${cy + 4}" aria-hidden="true"><path d="M${sw / 2} ${cy} A${r} ${r} 0 0 1 ${w - sw / 2} ${cy}" fill="none" stroke="rgba(0,0,0,.07)" stroke-width="${sw}" stroke-linecap="round"/>${segs.join('')}</svg><span class="gin">${inner}</span></span>`;
}
function sparkSvg(vals, col, w = 120, h = 40) {
  if (vals.length < 2) return '';
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), sx = w / (vals.length - 1), y = v => h - 4 - (v - mn) / ((mx - mn) || 1) * (h - 10);
  const pts = vals.map((v, i) => [i * sx, y(v)]); const id = 'sp' + Math.random().toString(36).slice(2, 7);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.6" fill="#fff" stroke="${col}" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>`;
}
function weekData(n = 8) {
  const t = ymd(new Date()), cls = clsSorted();
  const ds = [...new Set(cls.flatMap(c => recorded(c)))].filter(d => d <= t).sort().slice(-n);
  return ds.map(d => { const parts = cls.map(c => ({ c, v: presentCount(c, d) })); return { d, parts, tot: parts.reduce((s, p) => s + p.v, 0) }; });
}
function dashBase() {
  const cls = clsSorted(), wk = weekData(8), last = wk[wk.length - 1], prev = wk[wk.length - 2];
  const kidsN = cls.reduce((s, c) => s + activeKids(c).length, 0);
  const care = cls.flatMap(c => careList(c).map(x => ({ ...x, c }))).sort((a, b) => b.n - a.n);
  return { cls, wk, last, prev, kidsN, care, pres: last ? last.tot : 0, delta: last && prev ? last.tot - prev.tot : null };
}
const deltaPill = (dl, light) => dl === null ? '' : `<span class="dpill ${dl > 0 ? 'up' : dl < 0 ? 'dn' : ''} ${light ? 'lt' : ''}">${dl > 0 ? '▲' : dl < 0 ? '▼' : '='} 지난주보다 ${dl === 0 ? '같아요' : Math.abs(dl) + '명'}</span>`;
function quickActs() {
  const q = [['go', 'attend', '출석 시작', ICON.att, '#2F7D4F'], ['go', 'worship', '주일 예배', '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', '#7B4FB8'], ['rtab', 'notice', '공지', ROOM_INFO.notice[2], '#C62828'], ['rtab', 'cal', '캘린더', ROOM_INFO.cal[2], '#E08A00']];
  return `<div class="qacts">${q.map(([a, id, l, ic, c]) => `<button class="qa" data-act="${a}" ${a === 'go' ? `data-to="${id}"` : `data-id="${id}"`} style="--c:${c}"><span class="qi">${svg(ic, 20, 2)}</span>${l}</button>`).join('')}</div>`;
}
function bdayList(n = 6) {
  const bd = bdaysAll().slice(0, n);
  return bd.length ? `<div class="bdl">${bd.map(x => { const [m, d] = x.label.split('/'); return `<button class="bdr" ${x.act}><span class="dcal"><small>${m}월</small><b>${d}</b></span>${x.av}<span class="grow"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span>${x.days === 0 ? '<span class="tag">오늘!</span>' : `<span class="dd">D-${x.days}</span>`}</button>`; }).join('')}</div>` : '<div class="sub">한 달 안에 생일인 친구 · 선생님이 없어요.</div>';
}
function careBars(care, n = 7) {
  if (!care.length) return '<div class="sub">지금은 걱정되는 친구가 없어요. 감사해요!</div>';
  const mx = Math.max(...care.map(x => x.n), 8);
  return `<div class="cbars">${care.slice(0, n).map(x => { const col = x.n >= 8 ? '#C62828' : x.n >= 4 ? '#E07A2E' : '#E8B13A'; return `<button class="cbr" data-act="kid" data-id="${x.k.id}">${avatar(x.k, 40)}<span class="grow"><span class="nm"><b>${esc(x.k.name)}</b><small style="color:${clsCol(x.c)}">${esc(clsName(x.c))}</small></span><i class="tr"><em style="width:${Math.round(x.n / mx * 100)}%;background:${col}"></em></i></span><span class="wk" style="color:${col}">${x.n}<small>주</small></span></button>`; }).join('')}</div>${care.length > n ? `<div class="s2">그 밖에 ${care.length - n}명 · 반별 보기에서 확인해요</div>` : ''}`;
}
function sundayMini() {
  const s = nextService(); if (!s) return '';
  const diff = Math.round((parseD(s.date) - parseD(ymd(new Date()))) / 86400000);
  return `<div class="sunm"><span class="dcal big"><small>${parseD(s.date).getMonth() + 1}월</small><b>${parseD(s.date).getDate()}</b></span><span class="grow"><small>${diff <= 7 ? '이번 주일' : '다음 주일'}${diff >= 0 ? ` · D-${diff}` : ''}</small><b>${esc(s.story || (s.noService ? '조이코너 예배 없음' : '이야기 준비 중'))}</b><span class="meta">${s.preacher ? `<span>설교 ${esc(s.preacher)}</span>` : ''}${s.pray ? `<span>중보기도 ${esc(s.pray)}</span>` : ''}</span></span></div>`;
}

/* ---------- A안 · 화사한 대시보드 ---------- */
function dashA() {
  const B = dashBase(), { cls, wk, last, kidsN, care } = B;
  const pct = last && kidsN ? last.tot / kidsN : 0;
  const hero = `<section class="dhero d5"><div class="dh-l">${ringSvg(pct, '#fff', 150, 16, 'rgba(255,255,255,.22)', `<b>${Math.round(pct * 100)}<small>%</small></b><small>출석률</small>`)}</div>
<div class="dh-r"><small class="k">${last ? fmtMDs(last.d) + ' 주일 출석' : '출석 기록 전'}</small><div class="v"><b>${B.pres}</b><small>/ ${kidsN}명</small></div>${deltaPill(B.delta, true)}</div>
<div class="dh-cls">${cls.map(c => { const p = last ? last.parts.find(x => x.c === c).v : 0, t = activeKids(c).length; return `<button class="dhc" data-act="homeCls" data-id="${c}"><span class="dot" style="background:${clsCol(c)}"></span><span class="nm">${esc(clsName(c))}</span><i><em style="width:${t ? Math.round(p / t * 100) : 0}%"></em></i><span class="n">${p}/${t}</span></button>`; }).join('')}</div></section>`;
  const mx = Math.max(kidsN, 1);
  const trend = `<section class="card d7 trend"><div class="lbl"><span>주일 출석 흐름 · 최근 ${wk.length}주</span><span class="lg">${cls.map(c => `<span><i style="background:${clsCol(c)}"></i>${esc(clsName(c))}</span>`).join('')}</span></div>
<div class="pbars">${wk.map((w, i) => `<div class="pb ${i === wk.length - 1 ? 'cur' : ''}"><span class="pv">${w.tot}</span><span class="pst" style="height:${Math.max(8, Math.round(w.tot / mx * 100))}%">${w.parts.slice().reverse().map(p => `<i style="flex:${p.v || 0.0001};background:${clsCol(p.c)}"></i>`).join('')}</span><small>${fmtMDs(w.d)}</small></div>`).join('') || '<div class="sub">출석 기록이 쌓이면 그래프가 그려져요.</div>'}</div></section>`;
  const tN = S.staff.filter(x => x.kind !== 'helper'), hr = tN.filter(x => Object.values(x.classRole || {}).includes('담임')).length, asst = tN.filter(x => (x.classes || []).length && !Object.values(x.classRole || {}).includes('담임')).length;
  const bd = bdaysAll();
  const tile = (c, ic, num, unit, label, bar, act) => `<${act ? 'button' : 'div'} class="ptile d3" ${act || ''} style="--c:${c}"><span class="pt-h"><span class="pi">${svg(ic, 20, 2)}</span><small>${label}</small></span><span class="pt-v"><b>${num}</b><small>${unit}</small></span>${bar}</${act ? 'button' : 'div'}>`;
  const seg = parts => `<span class="sbar">${parts.map(([v, col]) => `<i style="flex:${v || 0.0001};background:${col}"></i>`).join('')}</span>`;
  const tiles = tile('#E08A00', ICON.kids, kidsN, '명', '우리 친구들', `${seg(cls.map(c => [activeKids(c).length, clsCol(c)]))}<small class="pt-s">${cls.map(c => `${esc(clsName(c))} ${activeKids(c).length}`).join(' · ')}</small>`)
    + tile('#D0567F', ROOM_INFO.tch[2], tN.length, '명', '선생님', `${seg([[hr, '#D0567F'], [asst, '#F2A7C0'], [tN.length - hr - asst, '#F6D9E3']])}<small class="pt-s">담임 ${hr} · 보조 ${asst} · 그 밖에 ${tN.length - hr - asst}</small>`, 'data-act="rtab" data-id="tch"')
    + tile('#C62828', '<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z"/>', care.length, '명', '돌봄이 필요해요', `${seg([[care.filter(x => x.n >= 8).length, '#C62828'], [care.filter(x => x.n >= 4 && x.n < 8).length, '#E07A2E'], [care.filter(x => x.n < 4).length, '#E8B13A'], [Math.max(0, kidsN - care.length), 'rgba(0,0,0,.06)']])}<small class="pt-s">8주+ ${care.filter(x => x.n >= 8).length} · 4~7주 ${care.filter(x => x.n >= 4 && x.n < 8).length} · 2~3주 ${care.filter(x => x.n < 4).length}</small>`)
    + tile('#F2B705', '<path d="M4 21h16v-8H4z"/><path d="M4 16c2 1.4 4 1.4 6 0s4-1.4 6 0 3 1 4 0"/><path d="M12 13V9"/>', bd.length, '명', '한 달 안 생일', `<span class="avs">${bd.slice(0, 4).map(x => `<span class="av1">${x.av}</span>`).join('')}${bd.length > 4 ? `<span class="av1 more">+${bd.length - 4}</span>` : ''}</span>`);
  const ccard = c => {
    const cl = S.classes[c], ks = activeKids(c), cs = classStaff(c), n = last ? last.parts.find(x => x.c === c).v : 0, p = ks.length && last ? n / ks.length : 0, cn = careList(c).length;
    const vals = wk.map(w => w.parts.find(x => x.c === c).v);
    return `<button class="ccard d4" data-act="homeCls" data-id="${c}" style="--c:${clsCol(c)}"><span class="cc-top">${ringSvg(p, clsCol(c), 78, 9, 'rgba(0,0,0,.06)', `<b>${Math.round(p * 100)}<small>%</small></b>`)}<span class="grow"><span class="cc-nm"><span class="age">${cl.age || ''}세</span><b>${esc(cl.name)}</b></span><small>친구 ${ks.length}명${cs.homeroom.length ? ' · 담임 ' + esc(cs.homeroom.join(', ')) : ''}</small><small>${last ? `${fmtMDs(last.d)} 출석 ${n}명` : '출석 기록 전'}${cn ? ` · <span class="hcare">돌봄 ${cn}</span>` : ''}</small></span></span>
<span class="cc-sp">${sparkSvg(vals, clsCol(c), 220, 44)}</span><span class="cc-ft"><span class="faces">${ks.slice(0, 5).map(k => `<span class="fc">${avatar(k, 32)}</span>`).join('')}${ks.length > 5 ? `<span class="fc more">+${ks.length - 5}</span>` : ''}</span><span class="go">들어가기 ›</span></span></button>`;
  };
  return `${hero}${trend}${tiles}${cls.map(ccard).join('')}
<section class="card d4"><div class="lbl"><span>이번 주일</span><button class="linkbtn" data-act="go" data-to="worship">예배 보기</button></div>${sundayMini()}${homeMyTurn().replace('<section class="card" style="border-color:#C62828">', '<div class="myturn">').replace(/<\/section>$/, '</div>')}${quickActs()}</section>
<section class="card d4"><div class="lbl"><span>돌봄이 필요해요</span><small class="s2">연속 결석 주</small></div>${careBars(care)}</section>
<section class="card d4"><div class="lbl"><span>곧 생일이에요</span><small class="s2">한 달</small></div>${bdayList()}</section>`;
}

function vHomeDash() {
  return `<div class="scroll dashwrap">${homeHeader()}${homeModeSeg()}${iosOtherNote()}${holBanner()}${gcalBanner()}
<div class="hdash">${dashA()}</div>
<div class="dash2">${homeNoticeCard()}${homeEventsCard()}<section class="card homedock"><div class="lbl"><span>교사실 바로 가기</span></div>${roomDock('')}</section>${versionCard()}</div></div>${nav('home')}`;
}

/* ================= v26 · 고치기는 한 단계 더 (안전 장치) ================= */
const PEN = '<path d="M4 20h4L19 9l-4-4L4 16z"/>';
/* 1) 연필 · 순서 버튼은 [고치기]를 눌러야 보여요 */
var EM = { on: false, key: '' };
const EM_SEL = '.scroll .editbtn, .scroll .songrow .mv';
function emAfter(key) {
  const k = key + '|' + (R.tab || '') + '|' + (W.tab || '') + '|' + (W.date || '');
  if (k !== EM.key) { EM.key = k; EM.on = false; }
  appEl.classList.toggle('em-on', EM.on);
  document.getElementById('emfab')?.remove(); document.getElementById('embar')?.remove();
  if (!appEl.querySelector(EM_SEL)) return;
  const b = document.createElement('button'); b.id = 'emfab'; b.className = 'emfab' + (EM.on ? ' on' : ''); b.dataset.act = 'emTog';
  b.innerHTML = EM.on ? `${svg('<path d="M5 12.5l4.5 4.5L19 7"/>', 18, 2.4)}다 고쳤어요` : `${svg(PEN, 18, 2)}고치기`;
  appEl.appendChild(b);
  if (EM.on) { const t = document.createElement('div'); t.id = 'embar'; t.className = 'embar'; t.innerHTML = `${svg(PEN, 15, 2)}<span>고치기 모드 · 연필과 순서 버튼이 보여요</span>`; appEl.appendChild(t); }
}
/* 2) 지우기는 두 번 눌러야 (4초 안에 한 번 더) */
function delTwice(name) {
  const fn = ACT[name]; if (!fn || fn.__twice) return;
  const g = (d, el) => {
    if (!el) return fn(d, el);
    if (el.dataset.armed === '1') { el.dataset.armed = ''; return fn(d, el); }
    document.querySelectorAll('[data-armed="1"]').forEach(x => { x.dataset.armed = ''; x.classList.remove('armed'); if (x.dataset.lbl0) x.innerHTML = x.dataset.lbl0; });
    el.dataset.lbl0 = el.innerHTML; el.dataset.armed = '1'; el.classList.add('armed');
    el.innerHTML = el.offsetWidth >= 120 ? '한 번 더 누르면 지워요' : '정말?';
    clearTimeout(el._dt); el._dt = setTimeout(() => { if (el.dataset.armed === '1') { el.dataset.armed = ''; el.classList.remove('armed'); el.innerHTML = el.dataset.lbl0; } }, 4000);
  };
  g.__twice = true; ACT[name] = g;
}
['sermonDel', 'songDel', 'dutyDel', 'noticeDel', 'eventDel', 'snDel', 'cmDel', 'matDel', 'noteDel', 'holDel', 'delStaff'].forEach(delTwice);
/* 3) 눌러서 보기 → [고치기] */
function cntView(date) {
  const r = (CNT.rows || []).find(x => x.date === date); if (!r) return cntSheet(date);
  const t = r.total || ((r.family || 0) + (r.teachers || 0));
  sheet(`<div class="ttl" style="font-size:24px">${fmtMD(r.date)} 주일 인원</div>
<div class="cntv"><div class="cv1">${ringSvg(1, '#C62828', 118, 12, 'rgba(0,0,0,.06)', `<b>${t}</b><small>모두</small>`)}</div>
<div class="cv3"><div style="--c:#E8A39C"><b>${r.family ?? '-'}</b><small>부모님 · 아이들</small></div><div style="--c:#E08A00"><b>${r.kids ?? '-'}</b><small>그중 아이들</small></div><div style="--c:#2E9D8F"><b>${r.teachers ?? '-'}</b><small>교사</small></div></div></div>
${r.place || r.memo ? `<div class="sub">메모 · ${esc(r.place || r.memo)}</div>` : ''}
<div class="btns"><button class="sec" data-act="cntEditGo" data-id="${r.date}">${svg(PEN, 16, 2)} 고치기</button><button class="pri" data-act="sheetClose">닫기</button></div>`);
}
const genderChip = k => `<button class="chip sm gview ${k.gender || 'none'}" data-act="gEdit" data-id="${k.id}" aria-label="성별 고치기">${k.gender === 'm' ? '남자' : k.gender === 'f' ? '여자' : '성별 체크 전'}${svg(PEN, 12, 2)}</button>`;
function gEditSheet(id) {
  const k = findKid(id); if (!k) return;
  sheet(`<div class="ttl" style="font-size:24px">${esc(k.name)} · 성별</div><div class="sub">고르면 바로 저장돼요. 한 번 더 누르면 비워요.</div>
<div class="gpick big">${[['m', '남자'], ['f', '여자']].map(([v, l]) => `<button class="gbtn ${v} ${k.gender === v ? 'on' : ''}" data-act="gSet1" data-id="${k.id}" data-g="${v}">${l}</button>`).join('')}</div>
<div class="btns"><button class="sec" data-act="sheetClose">닫기</button></div>`);
}
function staffZoom() {
  const im = document.querySelector('.heroph img'); if (!im) return;
  const el = document.createElement('div'); el.className = 'lbox'; el.innerHTML = `<img src="${im.src}" alt=""><button class="lbx" aria-label="닫기">×</button>`;
  el.addEventListener('click', () => { el.remove(); history.state && history.state.lbox && history.back(); });
  document.body.appendChild(el); history.pushState({ lbox: 1 }, '');
  const pop = () => { el.remove(); window.removeEventListener('popstate', pop); }; window.addEventListener('popstate', pop);
}
Object.assign(ACT, {
  emTog: () => { EM.on = !EM.on; paint(); if (EM.on) toast('고치기 모드 · 연필을 눌러 고쳐요'); },
  cntEdit: d => cntView(d.id), cntEditGo: d => cntSheet(d.id),
  gEdit: d => gEditSheet(d.id),
  gSet1: async d => { await gSet(d.id, d.g); closeSheet(); },
  staffZoom
});

/* ================= v26 · 통계도 그림으로 ================= */
function vStats() {
  const c = S.cur; if (!c) return vStatsOld();
  const today = ymd(new Date()), rec = recorded(c).filter(d => d <= today);
  const col = clsCol(c), kids = activeKids(c), total = kids.length, ds = rec.slice(-8);
  const counts = ds.map(d => presentCount(c, d));
  const now = new Date(), mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const mds = rec.filter(d => d.startsWith(mk)), useDs = mds.length ? mds : rec.slice(-4);
  const avgN = useDs.length ? useDs.reduce((s, d) => s + presentCount(c, d), 0) / useDs.length : 0;
  const avgP = total && useDs.length ? avgN / total : null;
  const care = careList(c);
  const t3 = care.filter(x => x.n >= 8).length, t2 = care.filter(x => x.n >= 4 && x.n < 8).length, t1 = care.filter(x => x.n < 4).length;
  const low = kids.map(k => ({ k, r: kidRate(c, k) })).filter(x => x.r !== null).sort((a, b) => a.r - b.r).slice(0, 6);
  const last = counts[counts.length - 1], prev = counts[counts.length - 2];
  const bars = ds.length ? `<div class="pbars one">${ds.map((d, i) => `<div class="pb ${i === ds.length - 1 ? 'cur' : ''}"><span class="pv">${counts[i]}</span><span class="pst" style="height:${Math.max(8, Math.round(counts[i] / Math.max(total, 1) * 100))}%;background:${col}"></span><small>${fmtMDs(d)}</small></div>`).join('')}</div>` : '<div class="sub">출석 기록이 쌓이면 그래프가 그려져요.</div>';
  return `<div class="scroll cols"><div class="ttl">교사실</div>${roomTabs('stats')}${classChips()}
<section class="card full sthead" style="--c:${col}"><div class="st-ring">${ringSvg(avgP || 0, col, 132, 14, 'rgba(0,0,0,.06)', `<b>${avgP === null ? '-' : Math.round(avgP * 100)}<small>%</small></b><small>${mds.length ? '이번 달' : '최근 4주'}</small>`)}</div>
<div class="st-tx"><small>${esc(S.classes[c].name)} 평균 출석</small><div class="v"><b>${Math.round(avgN)}</b><small>/ ${total}명</small></div>${last !== undefined && prev !== undefined ? deltaPill(last - prev) : ''}<div class="st-sp">${sparkSvg(counts, col, 260, 46)}</div></div>
<div class="st-g">${gaugeSvg([[t1, '#E8B13A'], [t2, '#E07A2E'], [t3, '#C62828']], Math.max(total, 1), 200, 20, `<b>${care.length}<small>명</small></b><small>돌봄 신호</small>`)}<div class="glg"><span><i style="background:#E8B13A"></i>2~3주 <b>${t1}</b></span><span><i style="background:#E07A2E"></i>4~7주 <b>${t2}</b></span><span><i style="background:#C62828"></i>8주+ <b>${t3}</b></span></div></div></section>
<section class="card"><div class="lbl"><span>최근 ${ds.length}주 출석</span></div>${bars}</section>
<section class="card"><div class="lbl"><span>돌봄이 필요해요</span><small class="s2">연속 결석 주</small></div>${careBars(care.map(x => ({ ...x, c })), 6)}</section>
${low.length ? `<section class="card"><div class="lbl"><span>출석이 적은 친구 · 최근 8주</span></div><div class="lowl">${low.map(x => `<button class="lowr" data-act="kid" data-id="${x.k.id}">${ringSvg(x.r, x.r < .4 ? '#C62828' : x.r < .7 ? '#E07A2E' : col, 46, 6, 'rgba(0,0,0,.06)', `<b>${Math.round(x.r * 100)}</b>`)}${avatar(x.k, 36)}<b class="nm">${esc(x.k.name)}</b></button>`).join('')}</div></section>` : ''}
${S.myClasses.length > 1 ? `<section class="card"><div class="lbl"><span>반별 비교 · 최근 4주 평균</span></div><div class="cmpr">${clsSorted().map(k => { const a = classAvg(k); return `<button class="cmp1 ${k === c ? 'on' : ''}" data-act="cls" data-id="${k}" style="--c:${clsCol(k)}">${ringSvg(a || 0, clsCol(k), 84, 10, 'rgba(0,0,0,.06)', `<b>${a === null ? '-' : Math.round(a * 100)}<small>%</small></b>`)}<span>${esc(S.classes[k].name)}</span></button>`; }).join('')}</div></section>` : ''}
${countsCard()}
<div class="s2 full">* 비율은 지금 함께하는 친구 수를 기준으로 계산해요.</div></div>${nav('room')}`;
}
