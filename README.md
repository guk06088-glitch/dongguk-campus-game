# 동국대학교 3D 산책 게임: 무료 실시간 멀티플레이 배포

이 프로젝트는 기존 게임 화면 `public/index.html`, 실시간 멀티플레이 서버 `src/index.js`, 서버 설정 `wrangler.toml`로 구성됩니다. 휴대폰/PC 웹브라우저 모두 사용 가능합니다.

**이 ZIP은 GitHub + Cloudflare Workers Builds(직접 연결) 방식용입니다.** 기존 ZIP의 GitHub Actions 배포는 사용하지 않아 API 토큰을 직접 만들 필요가 없습니다.

## 1. GitHub에 게임 올리기

1. https://github.com 로그인 → `New repository` 클릭. 이름은 `dongguk-campus-game` 등 원하는 이름, `Private` 권장, 기본 브랜치는 `main`.
2. ZIP을 **압축 풀기**. 압축을 풀어 나온 폴더에서 `public`, `src`, `wrangler.toml`, `package.json`, `README.md`를 선택.
3. 새 저장소 → `Add file` → `Upload files` → 위 5개 항목을 한꺼번에 끌어 놓거나 폴더·파일을 업로드 → `Commit changes`.
4. GitHub 화면에서 `public/index.html`, `src/index.js`, `wrangler.toml`, `package.json`이 정확한 위치에 보이는지 확인. **ZIP 파일 자체만 올리면 안 됩니다.**

## 2. Cloudflare에서 자동 배포하기

1. https://dash.cloudflare.com 에서 무료 계정 로그인.
2. `Workers & Pages` → `Create application` → GitHub 저장소 연결(화면에 따라 `Connect Git` 또는 `GitHub`). GitHub 접근 권한을 승인하고 저장소 선택.
3. Worker 이름은 **`dongguk-healing-multiplayer`** 로 설정(중요: `wrangler.toml`의 `name`과 일치).
4. 브랜치 `main`, Root directory `/` 또는 기본값, Build command `없음(빈 칸)`, Deploy command `npx wrangler deploy` (기본값일 수 있음).
5. `Save and Deploy` 또는 `Deploy` 클릭. 성공 시 `https://dongguk-healing-multiplayer.<내서브도메인>.workers.dev` 형식의 실제 주소가 제공됩니다. `<내서브도메인>`은 Cloudflare가 제공하는 값을 사용하세요.
6. 게임 주소를 두 기기에서 동시에 열고 캐릭터와 채팅을 시험합니다.

## 3. 수정·운영

- `public/index.html`을 GitHub에서 수정하면 Cloudflare가 새 커밋을 감지하여 다시 배포합니다.
- 친구들에게는 **실제 배포된 workers.dev 주소**만 공유하면 됩니다.
- **Cloudflare Pages에 HTML 한 개만 올리거나, 로컬 HTML 파일을 열면** 서버가 없으므로 멀티플레이 기능이 동작하지 않습니다.
- GitHub 저장소를 Private으로 하더라도, 배포된 `workers.dev` 사이트는 따로 접근 제한을 만들지 않으면 공개됩니다.
- 이 게임은 하나의 공용 방을 공유합니다. 접속 암호, 인증, 차단/신고, 개인정보 관리, 서버 측 인원 상한, 채팅 기록 보존은 구현되어 있지 않습니다.
- 무료 요금제에는 요청/CPU/사용량 제한이 있습니다. **실제 19명 동시 실사용 부하 테스트는 진행하지 못했습니다.** 게임 코드는 가급적 이동 중에만 0.25초 간격으로 위치를 전송하도록 조정했습니다.
- 실시간 채팅 UI의 기존 '개인용 채팅' 문구를 온라인 실시간 채팅 안내로 바로잡았습니다.
- 3D 엔진은 외부 Three.js CDN을 사용하므로 첫 접속 때 인터넷이 필요합니다. 게임에 포함된 사진/음원은 공개 배포 권리를 확인해야 합니다.

관련 공식 문서:
- Cloudflare Workers Git integration: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- GitHub 파일 업로드: https://docs.github.com/ko/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
