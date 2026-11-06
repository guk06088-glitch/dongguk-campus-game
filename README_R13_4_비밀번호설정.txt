동국대학교 3D 힐링 캠퍼스 R13.4 — Cloudflare 비공개 입장 기능
==========================================================

[핵심]
- 기존 R13.3 3D 게임, 채팅, 수계법회, 방석 착석 등은 유지합니다.
- 게임과 모든 정적 파일 및 멀티플레이 WebSocket /ws를 Worker에서 인증합니다.
- 공통 비밀번호는 Cloudflare Secret CAMPUS_PASSWORD에 저장합니다.
- 로그인 쿠키 위조 방지용 별도 Secret CAMPUS_SESSION_SECRET도 필요합니다.
- 두 값 모두 비어 있거나 규칙에 맞지 않으면 게임을 공개하지 않습니다(503 오류).
- 로그인 후 12시간 동안 세션 유지. 비밀번호를 바꾸면 기존 세션은 무효화됩니다.
- 잘못된 암호 8회 입력 시 해당 IP에 약 15분 접속 제한을 적용합니다.
- 로그인 후 게임 메뉴의 '🔒 로그아웃 · 입장 잠금'으로 현재 브라우저의 쿠키를 지울 수 있습니다.

[반드시 먼저 설정할 것 — Cloudflare 관리자만]
1. GitHub 저장소에 이 ZIP의 전체 프로젝트 파일을 업로드합니다.
   기존 .github/workflows/deploy.yml, src/index.js, public/index.html을 덮어쓰고,
   새 파일 src/auth.js를 추가합니다. wrangler.toml도 교체해야 합니다.
   Cloudflare Worker 이름은 현재 Cloudflare 화면에 맞춘 'dongguk-campus-game' 입니다.
2. Cloudflare 대시보드 → Workers & Pages → 해당 Worker(dongguk-campus-game) → Settings →
   Variables and Secrets → Add 항목에서 유형을 'Secret'으로 설정합니다.
3. 첫 번째 Secret:
   Name  = CAMPUS_PASSWORD
   Value = 자신이 정한 숫자 4자리(앞자리에 0도 허용). 사진에 공개된 기존 값은 사용 금지
4. 두 번째 Secret:
   Name  = CAMPUS_SESSION_SECRET
   Value = 예측 불가능한 영문·숫자 조합 10자 이상
   컴퓨터에서 다음 명령으로 만들 수 있습니다:
   node -e "console.log(require('node:crypto').randomBytes(10).toString('base64url'))"
   주의: 10자 비밀키는 32자 이상에 비해 추측·유출에 취약합니다. 반복 숫자나 쉬운 단어는 피하세요.
5. Save/Deploy를 눌러 적용합니다. 두 Secret 값은 서로 달라야 합니다.
6. Cloudflare가 배포한 HTTPS 주소에서 입장 화면을 확인하고 비밀번호로 로그인합니다.
   로그인 전 주소 뒤에 /index.html, /diagnostics.html 또는 /ws를 붙여도
   인증 없이는 게임이나 실시간 연결을 열 수 없어야 합니다.

[GitHub Actions를 사용한다면]
- 기존의 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID GitHub 시크릿은 그대로 유지합니다.
- CAMPUS_PASSWORD와 CAMPUS_SESSION_SECRET은 GitHub에 넣지 말고
  반드시 Cloudflare Worker의 Variables and Secrets에서 설정해 주세요.
- GitHub Action으로 다시 배포해도 Cloudflare에 이미 설정된 Secret은 유지됩니다.
- Worker의 이름 또는 배포 환경을 바꾸면 해당 Worker에 두 Secret을 다시 설정해야 합니다.

[보안 유의사항]
- 비밀번호는 공개 HTML, 자바스크립트, wrangler.toml의 [vars]에 넣지 마세요.
- Cloudflare와 별도로 공개된 GitHub 저장소나 Pages 사이트에서는
  코드 및 정적 파일을 볼 수 있습니다. 게임 원본까지 비공개가 목적이면
  저장소를 비공개로 변경하고 우회 공개 배포 주소도 종료해야 합니다.
- Cloudflare Worker가 아닌 'HTML 파일 직접 열기'는 서버 인증을 거치지 않습니다.
- 입장 암호를 아는 사람끼리는 서로 동일한 권한으로 접근합니다.
  개인별 권한/강제 차단/개인별 접속 기록이 필요하면 별도 계정 인증이 필요합니다.
- 로그아웃은 현재 브라우저 쿠키를 지우는 방식입니다. 탈취된 쿠키는
  세션 만료 전까지 유지될 수 있습니다. 긴급 회수는 SESSION_SECRET을 교체하세요.
- 기존 로그인 세션은 12시간 후 자동 만료되며, WebSocket도 만료 시 차단됩니다.
- 숫자 4자리 비밀번호는 가능한 조합이 10,000개에 불과하므로 강한 보안 수단이 아닙니다. 공개된 값, 생일, 1234, 0000 등 쉽게 유추되는 숫자는 피하세요. 필요하면 Cloudflare Access를 사용하세요.
- 브라우저 게임 전체 플레이 및 Cloudflare 실배포 테스트는 사용자 환경 확인이 필요합니다.

[로컬 개발]
- 프로젝트 루트에서 wrangler dev를 실행하기 전에 .dev.vars 파일에
  CAMPUS_PASSWORD=5678  (이 값은 예시이며 실제 입장 암호로 사용하지 마세요)
  CAMPUS_SESSION_SECRET=별도로_생성한_10자_이상_랜덤문자열
  을 넣어 로컬에서 테스트할 수 있습니다. (.dev.vars는 Git에 올리지 않습니다.)
- 샘플 암호는 이 ZIP에 포함하지 않았습니다.
