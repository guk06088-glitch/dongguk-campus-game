# 동국대학교 3D 힐링 캠퍼스 — 전체 업로드 패키지 (2026-11-05)

이 프로젝트는 기존 3D 게임을 유지하고 GitHub Actions 배포 파일 및 모바일 진단 페이지를 포함합니다. **실제 스마트폰에서 3D 동작 검증을 완료한 버전은 아닙니다.**

## ZIP 압축을 풀고 저장소 최상위에 업로드할 파일
- `public/index.html`: 게임 본문
- `public/diagnostics.html`: WebGL/Three.js 연결 확인
- `src/index.js`: Cloudflare Worker + Durable Objects 실시간 채팅/이동 서버
- `wrangler.toml`: Worker 이름과 정적 파일 설정
- `package.json`: npm 설정
- `.github/workflows/deploy.yml`: GitHub Actions 자동 배포

**중요: ZIP 파일 자체를 GitHub에 올리면 배포되지 않습니다.** 압축을 풀어 `public`, `src`, `.github` 폴더가 저장소 루트에 있도록 올리세요. `.github`는 숨김 폴더입니다.

## 기존 게임 주소를 유지하려면
`wrangler.toml`의 `name`을 Cloudflare 대시보드에서 현재 사용 중인 Worker의 이름과 **정확히 동일하게** 설정하세요. 제공된 이름 `dongguk-healing-multiplayer`가 현재 Worker 이름과 다르면 새 주소에 배포될 수 있습니다.

## GitHub Actions 자동 배포
저장소 Settings → Secrets and variables → Actions → New repository secret 에서 아래 2개를 추가합니다.
- `CLOUDFLARE_API_TOKEN`: Workers 배포 권한이 있는 Cloudflare API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

이후 Actions → Deploy Dongguk Multiplayer to Cloudflare → Run workflow. 배포가 성공하면 `https://<Worker이름>.<서브도메인>.workers.dev/diagnostics.html`에서 진단합니다.

## 진단
3D 오류가 계속되면 배포된 사이트 주소 뒤에 `/diagnostics.html`을 붙여 WebGL 지원 여부와 Three.js 다운로드 성공/실패를 확인하세요. `DGU-20261105-R3` 버전이 보이지 않으면 최신 파일이 배포되지 않은 것입니다.

## 검증 한계
압축 무결성 및 JavaScript 구문 검사만 수행. 브라우저/WebGL/Cloudflare 실제 배포와 실시간 멀티플레이 통합 동작은 검증되지 않았습니다.


## 2026-11-05 코드 오류 정정 (R2)
- 현상: 목탁·염주 활동 추가 후 `3D 엔진을 연결할 수 없습니다` 화면이 나타남.
- 원인(소스 검증됨): HTML 요소 `id="beadSurface"`, `id="woodSurface"`를 JS가 잘못된 `#ritualBeadPad`, `#ritualWoodPad`로 선택하여 `null`을 생성함.
- 실제 오류 발생 지점: `ritualBeadPad.innerHTML=...` (null에 속성 대입 시 TypeError).
- 수정: JS 선택자를 실제 HTML id에 맞게 변경함. 실행 오류 상세 내용도 읽기 전용 화면 최상단에 표시함.
- 검증: DOM id/선택자 정합성 검사, JS 구문 검사, ZIP 무결성 검사 통과. **실제 기기·실제 Cloudflare 배포 검증은 수행하지 못함.**

게임에서 업데이트 버전 확인: 오류 화면의 `DGU-20261105-R3` 또는 브라우저의 페이지 소스 `meta[name=dgu-build]`.

## R3 - 염주알 하나씩 넘기기 (PC·모바일)
- 구형 원형 회전 드래그를 제거하고 가로 밀기·마우스 드래그·터치·클릭·키보드 및 별도 버튼으로 한 알씩 넘기게 개선했습니다.
- 염주알을 한 번 넘길 때마다 U자형 염주 줄을 따라 실제로 한 칸 이동하는 SVG 애니메이션이 표시됩니다.
- 개별 알 수, 108알 단위 진행도를 표시하며 기존 목탁 체험은 유지합니다.
- 설치: `public/index.html`을 서버에 배포하거나 전체 프로젝트 ZIP을 해당 디렉터리 구조 그대로 업로드합니다.
- PC에서 `file://`로 HTML을 직접 여는 경우 외부 Three.js CDN 모듈은 브라우저 보안 제한으로 동작하지 않을 수 있습니다. 배포된 `https://` 주소를 권장합니다.
- 검증: 모든 인라인 JS 구문 검사, HTML id 교차 확인, 독립 미니 브라우저 조작 테스트. 전체 게임 WebGL/Cloudflare 배포 테스트는 별도입니다.


## R4 (2026-11-05) 수정 요약
- 헤더 오른쪽 메뉴(☰) 안에서 '실제 공간 사진', '팔정도 뜻' 열기
- PC 기본 성능 우선: DPR 0.92, 그림자 비활성, 안티앨리어싱 off, 최대 약 40fps / HD 메뉴에서 고품질 선택 가능
- 채팅 버튼 화면 오른쪽 위(모바일), 가상 키보드 높이 변화에 따라 채팅 패널 재배치; 읽지 않은 메시지 배지 유지
- 캐릭터 채팅 말풍선 축소(검은 글씨/흰색 배경 유지)
- 목탁 체험: 앞서 제공된 '목탁소리.mp3' (장시간 녹음)에서 1회 타격음을 짧게 추출·음량·페이드 처리하여 HTML에 내장
  - 이는 합성음이 아니라 기존 오디오파일에서 추출한 녹음음입니다. 정각원 현장 실녹음 여부 및 외부 배포 사용권은 확인되지 않았습니다.
  - 프로젝트의 public/assets/moktak-from-user-recording.mp3 사본은 출처 확인·교체용이며, HTML은 단독 실행을 위해 음원 데이터를 내장했습니다.
  - 공개 배포에 사용권 확인이 필요하면, 공유마당 김용배 '목탁2' (CC BY) 원음을 내려받아 교체하세요: https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200020&wrtSn=13253416
- 기존 Worker URL 'ame.guk68.workers.dev' 기준으로 wrangler.toml name = 'ame' 설정; Cloudflare 실제 Worker 이름이 다르면 반드시 확인 후 변경
- 배포 후 ZIP 파일 업로드가 아닌 파일/폴더를 압축 해제하여 GitHub 저장소 루트로 업로드
- 검증: JS 구문 및 정적 구조, 채팅 UI 브라우저 테스트; 실제 Cloudflare 서버/모든 기기 하드웨어 성능까지는 미검증
