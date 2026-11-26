export function installMobileShell(game, hooks) {
    let ready = false;
    let installPrompt = null;
    const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    const tools = document.createElement('nav');
    tools.className = 'device-tools';
    tools.setAttribute('aria-label', '모바일 실행 도구');
    tools.innerHTML = '<button id="device-ui" aria-label="화면 UI 간략/전체 전환" aria-pressed="false" title="간단 화면 / 전체 UI">☷</button><button id="device-fullscreen" aria-label="전체 화면">⛶</button><button id="device-install" aria-label="홈 화면에 추가">＋</button>';
    document.body.append(tools);
    // Compact view hides only the decorative HUD panels; map, actions and quests remain available via this toggle.
    let compactUI = touch && (window.innerWidth < 1024 || window.innerHeight < 500);
    const uiToggle = tools.querySelector('#device-ui');
    const syncUI=()=>{document.body.classList.toggle('rpg-compact',compactUI);uiToggle.setAttribute('aria-pressed',String(compactUI));uiToggle.setAttribute('title',compactUI?'전체 UI 보기':'화면 간단히 보기');uiToggle.textContent=compactUI?'▤':'☷';};
    uiToggle.addEventListener('click',()=>{compactUI=!compactUI;syncUI()});
    syncUI();
    async function fullscreen() { try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen)
            await document.documentElement.requestFullscreen();
        const orientation = screen.orientation;
        if (orientation?.lock)
            await orientation.lock('landscape').catch(() => { });
    }
    catch { /* iOS Safari uses its normal browser or home-screen mode. */ } }
    tools.querySelector('#device-fullscreen').addEventListener('click', () => { if (document.fullscreenElement)
        void document.exitFullscreen();
    else
        void fullscreen(); });
    tools.querySelector('#device-install').addEventListener('click', () => { if (installPrompt) {
        void installPrompt.prompt();
        installPrompt = null;
    }
    else
        hooks.help(); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
    let launch = null;
    if (touch) {
        hooks.pause(true);
        launch = document.createElement('section');
        launch.id = 'mobile-launch';
        launch.setAttribute('aria-label', '모바일 게임 시작');
        launch.innerHTML = `<div class="launch-art"><img src="./assets/gate.png" alt="벚꽃 캠퍼스의 전통 대문"><img class="launch-scholar" src="./assets/player.png" alt="대학원생 학자"></div><div class="launch-copy"><div class="launch-kicker">DONGGUK UNIVERSITY · CAMPUS RPG</div><h1>동국대학교 대학원<br><em>전공 탐험 RPG</em></h1><p>동료를 만나고, 사건을 풀고, 나만의 결말을 선택하세요</p><div class="rotate-tip">휴대전화를 가로로 돌리면 더 넓게 탐험할 수 있어요.</div><button id="launch-play" disabled>캠퍼스를 준비하고 있어요…</button><small>조이스틱으로 이동 · 흔적 수집 · 전공 기술로 턴제 전투<br>이 기기의 브라우저에 진행 상황이 자동 저장됩니다.</small><button id="launch-install">홈 화면에서 앱처럼 즐기기</button></div>`;
        document.body.append(launch);
        launch.querySelector('#launch-play').addEventListener('click', () => { if (!ready)
            return; launch.remove(); launch = null; hooks.pause(false); void fullscreen(); });
        launch.querySelector('#launch-install').addEventListener('click', hooks.help);
    }
    const preventContext = (e) => e.preventDefault();
    game.addEventListener('contextmenu', preventContext);
    canvasTouchGuard(game);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden')
        window.dispatchEvent(new Event('blur')); });
    const online = () => { document.body.classList.toggle('network-offline', !navigator.onLine); if (!navigator.onLine)
        hooks.toast('오프라인 탐험 중 · 진행은 이 기기에 저장됩니다.'); };
    window.addEventListener('offline', online);
    window.addEventListener('online', online);
    if ('serviceWorker' in navigator && window.isSecureContext && false) {
        void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { });
    }
    return { ready() { ready = true; const button = launch?.querySelector('#launch-play'); if (button) {
            button.disabled = false;
            button.textContent = '탐험 시작';
        } }, isOpen: () => !!launch };
}
function canvasTouchGuard(game) { game.addEventListener('touchmove', e => { if (e.target.closest('canvas,.joystick,.skill'))
    e.preventDefault(); }, { passive: false }); }
