# 광산골프 스탬프

광주 광산골프(실잔디 어프로치 연습장) 손님 스탬프입니다. 10회를 채우면 어프로치 연습 1시간(약 1만 5천 원)이 무료입니다. 1차는 연습장 스탬프만 다룹니다.

손님은 자기 스탬프 조회와 비밀번호 변경만 합니다. 적립과 10회 사용은 직원만 합니다.

정적 파일은 GitHub Pages, 데이터는 Firebase Spark(Firestore + 이메일/비밀번호 로그인)입니다. SMS 인증과 Cloud Functions는 쓰지 않습니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 손님 화면 |
| `admin.html` | 직원 화면. 손님 안내문이나 QR에 넣지 않습니다. |
| `css/styles.css` | 화면 |
| `js/customer.js` | 손님 로그인, 첫 입장, 비밀번호 변경 |
| `js/admin.js` | 대기 등록, 조회, 적립, 10회 사용 |
| `js/phone.js` | 번호 정규화, 초기 비밀번호 |
| `js/firebase-app.js` | Firebase 불러오기 |
| `js/firebase-config.example.js` | 설정 예시. 이 파일만 저장소에 있습니다. |
| `firestore.rules` | 보안 규칙 |
| `firebase.json` | 규칙을 CLI로 올릴 때 쓰는 경로 |

## GitHub Pages

이 저장소는 https://github.com/kong3573/gsgolf-stamp 이고, 손님 주소는 https://kong3573.github.io/gsgolf-stamp/ 입니다. 직원 주소는 그 뒤에 `admin.html` 을 붙입니다.

손님은 로그인한 뒤 제목 오른쪽 **앱 저장**으로 스마트폰 바탕화면에 아이콘을 둘 수 있습니다. 아이콘은 스탬프 첫 화면을 엽니다. 아이폰은 Safari의 홈 화면에 추가로 저장합니다.

1. 저장소 이름은 `gsgolf-stamp`, 공개(Public), 브랜치는 `main` 입니다. Pages는 `main` 의 `/` 에서 배포됩니다.
2. 저장소 Settings → Pages → Build and deployment → Deploy from a branch.
3. Branch는 `main`, 폴더는 `/ (root)`, Save.
4. 손님 주소는 `https://<USER>.github.io/gsgolf-stamp/` 입니다. QR은 이 주소만 사용합니다.
5. 직원 주소는 `https://<USER>.github.io/gsgolf-stamp/admin.html` 입니다. 카운터 PC 북마크용입니다.

`<USER>`는 GitHub 사용자 이름입니다.

## Firebase

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다. 요금제는 Spark로 둡니다.
2. Authentication → Sign-in method에서 **이메일/비밀번호**를 켭니다. 전화번호(SMS)는 켜지 않습니다.
3. Authentication → Settings → Password policy는 **최소 6자**만 둡니다. 대문자, 특수문자 필수는 끄세요. 켜면 초기 비밀번호가 거절됩니다.
4. Authentication → Settings → Authorized domains에 `<USER>.github.io`를 추가합니다. 컴퓨터에서 확인할 때는 `localhost`도 남깁니다.
5. Firestore Database를 만듭니다. 리전은 **asia-northeast3 (서울)**, 시작 모드는 프로덕션입니다.
6. Firestore → 규칙에 `firestore.rules` 내용 전체를 붙여넣고 게시합니다. `allow read, write: if true` 로 바꾸지 마세요.
7. 프로젝트 설정 → 일반 → 내 앱에서 웹 앱을 추가하고 `firebaseConfig`를 복사합니다.

규칙은 콘솔에 붙여넣는 대신, 로그인된 Firebase CLI에서 `npx firebase-tools deploy --only firestore:rules`로 올려도 됩니다.

## firebase-config.js

PowerShell:

```powershell
Copy-Item js\firebase-config.example.js js\firebase-config.js
```

콘솔은 `const firebaseConfig = { ... }` 형태입니다. 파일은 아래처럼 `export`를 붙입니다.

```javascript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

`js/firebase-config.js`는 `.gitignore`에 있어서 `git add .`에 들어가지 않습니다. GitHub Pages는 저장소 파일만 배포하므로, 사이트를 열려면 이 웹 설정만 강제로 올립니다.

```powershell
git add -f js/firebase-config.js
git commit -m "chore: publish firebase web config"
git push
```

웹 API 키는 브라우저 앱에 들어가는 공개 값입니다. 회원 데이터는 Firestore 규칙으로 막습니다. 서비스 계정 JSON, 회원 명단, 비밀번호는 커밋하지 마세요.

## 첫 직원 계정

직원은 손님 번호와 다른 **실제 이메일**로 만듭니다. 직원 비밀번호를 잊으면 그 메일로 재설정할 수 있습니다. 코드에 직원 비밀번호를 넣지 않습니다.

1. Authentication → Users → 사용자 추가. 이메일과 긴 비밀번호를 넣습니다.
2. 생성된 사용자의 UID를 복사합니다.
3. Firestore에서 컬렉션 `admins`를 만들고, 문서 ID를 그 UID로 저장합니다. 필드는 비워도 됩니다. 문서가 있으면 직원입니다.
4. `admin.html`에서 그 이메일로 로그인합니다.

## 손님 계정

처음 온 손님은 카운터 등록 없이 손님 화면에서 시작할 수 있습니다. 로그인할 때 이름과 휴대폰 번호를 넣고 뒷자리 4자리를 누르면 계정이 만들어지고 스탬프는 0개입니다. 직원이 미리 대기 등록한 경우에는 그 대기 이름과 번호로 입장합니다.

- 화면에는 휴대폰 번호만 보입니다.
- 내부 이메일은 `01012345678@stamp.gsgolf.local` 입니다. 이 주소로는 메일이 가지 않습니다.
- 첫 비밀번호는 번호 뒷자리 4자리이거나, 손님이 정한 6자 이상입니다. 뒷자리만 쓰면 `010-1234-5678`이면 `5678`입니다.
- Firebase는 6자 미만 비밀번호를 받지 않습니다. 손님은 4자리만 입력하고, 프로그램이 Firebase에는 그 4자리를 두 번 붙여 보냅니다. `5678`은 `56785678`로 저장됩니다. 손님에게는 “첫 비밀번호는 뒷자리 4자리”만 말합니다.
- 입장하면 `mustChangePassword`가 켜져 있고, 변경 안내가 위에 나옵니다. 새 비밀번호는 6자 이상이며 뒷자리 4자리는 다시 쓸 수 없습니다.

## 하루 운영

1. 손님 화면에서 이름, 번호, 뒷자리 4자리로 로그인하면 바로 등록됩니다. 스탬프는 0개입니다. 카운터에서 미리 대기 등록할 수도 있습니다.
2. 손님에게 말로 안내합니다. “아이디는 휴대폰 번호, 첫 비밀번호는 뒷자리 4자리, 들어가서 바꾸세요.”
3. 그 자리에서 손님 폰으로 입장하고 비밀번호를 바꾸게 합니다. 번호를 아는 사람은 뒷자리를 맞출 수 있습니다.
4. 다음 방문부터는 번호 전체 또는 뒷자리 4자리로 조회한 뒤 **적립 +1**을 누릅니다. 같은 뒷자리가 여러 명이면 이름과 전체 번호를 보고 고릅니다. 잘못 눌렀으면 **1회 차감**으로 현재 스탬프와 누적 적립을 하나 되돌립니다. 0개면 차감되지 않습니다.
5. 10개가 되면 **10회 사용**으로 무료 이용 1회를 처리합니다. 10개 미만은 거절되고, 10개인 동안은 더 적립되지 않습니다.

개인정보 안내 문구는 직원 등록 화면과 손님 첫 입장 화면에 있습니다.

- 수집 항목: 이름, 휴대폰 번호
- 목적: 스탬프 적립과 무료 이용 확인
- 보유: 마지막 이용일로부터 1년
- 제3자 제공: 없음
- 마케팅 동의: 받지 않음

`totalEarned`는 지금까지 적립한 스탬프 수이고, `totalRedeemed`는 무료 이용을 쓴 횟수입니다.

## 비밀번호를 잊으면

1차 직원 화면에는 초기화 버튼이 없습니다. 브라우저 SDK로는 다른 손님의 비밀번호를 바꿀 수 없고, `@stamp.gsgolf.local`로는 재설정 메일이 도착하지 않습니다.

카운터에서 뒷자리로 되돌리는 기능은 나중에 Blaze 요금제의 Cloud Functions(Admin SDK)로 붙일 수 있습니다. 이번 범위는 아닙니다.

스탬프를 남기는 응급 절차는 Firebase 콘솔에서 합니다.

1. 기존 `users/{uid}`의 이름, 번호, `stamps`, `totalEarned`, `totalRedeemed`를 메모합니다.
2. Authentication에서 `번호@stamp.gsgolf.local` 사용자를 삭제합니다.
3. Firestore에서 그 `users` 문서와, 남아 있으면 `pending/{번호}`도 삭제합니다.
4. 손님이 이름, 번호, 뒷자리 4자리로 다시 입장합니다. 카운터에서 다시 대기 등록한 뒤 입장해도 됩니다.
5. 계정이 새로 만들어지므로 스탬프는 0입니다.
6. Firestore 콘솔에서 새 `users` 문서의 `stamps`, `totalEarned`, `totalRedeemed`를 메모한 값으로 고칩니다.

직원 본인 비밀번호는 Authentication의 비밀번호 재설정 메일을 사용합니다.

## 번호 형식

`^01[016789]-?[0-9]{3,4}-?[0-9]{4}$`

저장은 숫자만이며 10자리 또는 11자리입니다. 010은 11자리입니다. 뒷자리 4자리는 그 숫자의 끝 4글자입니다.

## Windows에서 올리는 명령

저장소 폴더에서:

```powershell
git add .
git commit -m "feat: gsgolf stamp pages"
git branch -M main
git remote add origin https://github.com/<USER>/gsgolf-stamp.git
git push -u origin main
```

GitHub CLI가 로그인되어 있으면:

```powershell
gh repo create gsgolf-stamp --public --source=. --remote=origin --push
```

## 올리지 않는 것

닷홈, SMS 인증, 공개된 Firestore 규칙, 자바스크립트 안의 직원 비밀번호, 서비스 계정 JSON, 회원 명단, 마케팅 동의.
