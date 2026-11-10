// 파이어베이스 콘솔 > 프로젝트 설정 > 내 앱 > 웹 앱의 firebaseConfig 값이에요.
// (이 값은 비밀번호가 아니에요. 데이터는 Firestore 보안 규칙이 지켜줘요.)
export const firebaseConfig = {
  apiKey: "AIzaSyDqKA0uLtwELsyLmiZ3nIlMntgpR89Y40g",
  authDomain: "joycorner-note.firebaseapp.com",
  projectId: "joycorner-note",
  storageBucket: "joycorner-note.firebasestorage.app",
  messagingSenderId: "940459044878",
  appId: "1:940459044878:web:c4b7737e4b804b62278c5f"
};

// 처음 로그인하면 자동으로 '관리자'가 되는 이메일 (보안 규칙의 이메일과 똑같이 맞춰야 해요)
export const OWNER_EMAIL = "artist4rhythm@gmail.com";
