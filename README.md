# 동국대학교 3D 힐링 캠퍼스 — 스마트폰 무료 배포형 멀티플레이

기존 단일 HTML 3D 게임과 Cloudflare Workers + Durable Objects(WebSocket) 실시간 서버를 한 주소에 배포합니다. GitHub Actions를 통해 `main` 브랜치에 파일을 올릴 때마다 자동 배포합니다. **Cloudflare Pages에 ZIP만 업로드하면 멀티플레이가 동작하는 구조가 아닙니다.**

## 스마트폰만으로 최초 배포하기

1. GitHub와 Cloudflare에 각각 가입합니다. GitHub에서 **비공개(private)** 새 저장소를 만들고 기본 브랜치를 `main`으로 둡니다.
2. 스마트폰의 파일 앱에서 이 ZIP을 압축 해제합니다. 저장소에 `public/index.html`, `src/index.js`, `wrangler.toml`, `package.json`, `.github/workflows/deploy.yml`의 **폴더 경로를 유지**하여 업로드합니다. 모바일 GitHub 웹에서 폴더 업로드가 어렵다면 브라우저의 '데스크톱 사이트'를 켜거나 `github.dev` 웹 편집기를 이용하세요. 특히 숨김 폴더 `.github`가 누락되지 않도록 확인하세요.
3. Cloudflare 대시보드 → 프로필 → API Tokens에서 Workers 배포 권한이 있는 **최소 권한 API 토큰**을 생성합니다. 토큰은 절대로 소스 코드나 채팅에 붙여 넣지 마세요. Cloudflare Account ID도 확인합니다.
4. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret에서 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 각각 등록합니다.
5. GitHub 저장소 → Actions → `Deploy Dongguk Multiplayer to Cloudflare` → `Run workflow`를 누르거나 `main`에 커밋을 올립니다. Actions 로그에서 배포 성공과 `workers.dev` 주소를 확인합니다. Cloudflare 계정에서 workers.dev 서브도메인이 활성화되어 있어야 합니다.
6. 서로 다른 스마트폰에서 같은 URL에 접속해 이동·채팅을 시험합니다. 스마트폰 브라우저의 '홈 화면에 추가'를 사용하면 바로가기로 실행할 수 있습니다.

## 수정 및 재배포

GitHub의 `public/index.html` 등을 수정하여 `main`에 저장하면 Actions가 다시 배포합니다. `src/index.js`는 서버 코드, `wrangler.toml`은 서버 및 Durable Objects 설정입니다. Actions가 실패하면 GitHub Actions의 실패 단계 로그를 확인합니다.

## 기능과 주의 사항

- 같은 방에 접속한 다른 이용자 캐릭터와 닉네임, 이동, 실시간 채팅 및 접속자 수를 표시하는 **시범판**입니다.
- 닉네임 기반이며 회원 인증, 운영자 제재, 신고, 부정 이동 방지, 영구 채팅 저장, 연령 보호 기능은 아직 없습니다. 공개 커뮤니티 운영 전에 추가하세요.
- Cloudflare 및 GitHub 무료 요금제에는 사용량/실행 제한이 있으며, 무료를 무제한 보장하지 않습니다. 과금 설정과 이용량을 계정에서 확인하세요.
- 게임 HTML은 약 9MB로 휴대폰 성능과 네트워크 환경에 따라 로딩이 느릴 수 있습니다. 실제 모바일 기기 및 Cloudflare 배포 통합 테스트는 수행하지 않았습니다.
- 사진, 녹음된 독송 및 음악의 **공개 배포 권한**을 확인해야 합니다. 동국대학교 공식 서비스로 오인되지 않도록 비공식 프로젝트임을 명시하는 것도 권장합니다.
