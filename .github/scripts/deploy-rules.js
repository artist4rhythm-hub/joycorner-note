// 조이코너 노트 · Firestore 보안 규칙 게시 (GitHub Actions에서만 실행)
// 비밀값 FIREBASE_SA (알림 도우미와 같은 서비스 계정)로 .github/firestore.rules 를 게시하고,
// 게시된 규칙이 파일과 똑같은지 다시 읽어서 확인해요. 문법 오류가 있으면 게시되지 않아요.
const fs = require('fs');
const admin = require('firebase-admin');

(async () => {
  if (!process.env.FIREBASE_SA) throw new Error('FIREBASE_SA 비밀값이 없어요');
  const sa = JSON.parse(process.env.FIREBASE_SA);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  const src = fs.readFileSync('.github/firestore.rules', 'utf8');
  const rs = await admin.securityRules().releaseFirestoreRulesetFromSource(src);
  const live = await admin.securityRules().getFirestoreRuleset();
  const norm = s => String(s || '').replace(/\r/g, '').trim();
  const same = (live.source || []).some(f => norm(f.content) === norm(src));
  const line = `${same ? '✅ 게시 완료' : '❌ 게시된 규칙이 파일과 달라요'} · ${sa.project_id} · ${rs.name} · ${rs.createTime}`;
  console.log(`::${same ? 'notice' : 'error'} title=보안 규칙::${line}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 조이코너 보안 규칙\n${line}\n`);
  if (!same) process.exit(1);
})().catch(e => {
  console.log(`::error title=보안 규칙::❌ 게시 실패: ${String(e && (e.message || e)).replace(/\n/g, ' ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 조이코너 보안 규칙\n❌ 게시 실패: ${e && (e.message || e)}\n`);
  process.exit(1);
});
