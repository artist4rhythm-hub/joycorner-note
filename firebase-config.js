// 파이어베이스 콘솔 > 프로젝트 설정 > 내 앱 > 웹 앱의 firebaseConfig 값을 아래에 붙여넣으세요.
// (이 값은 비밀번호가 아니에요. 데이터는 Firestore 보안 규칙이 지켜줘요.)
export const firebaseConfig = {
  apiKey: "여기에_붙여넣기",
  authDomain: "여기에_붙여넣기",
  projectId: "여기에_붙여넣기",
  storageBucket: "여기에_붙여넣기",
  messagingSenderId: "여기에_붙여넣기",
  appId: "여기에_붙여넣기"
};

// 처음 로그인하면 자동으로 '관리자'가 되는 이메일 (보안 규칙의 이메일과 똑같이 맞춰야 해요)
export const OWNER_EMAIL = "artist4rhythm@gmail.com";
