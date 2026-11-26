import { campaigns, campaignNPCs } from './adventure/campaigns.js';
import { fieldObjects, maxHp, currentChapter } from './adventure/engine.js';
import { installMobileShell } from './mobile.js';
import { CampusDirector } from './narrative/client.js';
import { npcActivity } from './narrative/core.js';
import { majors, regions, load, persist } from './data.js';
const paths = { book: 'M4 5Q9 2 16 6Q23 2 28 5V26Q22 23 16 27Q10 23 4 26ZM16 6V27M7 9L12 10M20 10L25 9M7 14L12 15M20 15L25 14', scroll: 'M7 5H25V25H8Q3 25 4 21H24M7 5Q3 5 4 10H9M12 10H21M12 14H21M12 18H19', gift: 'M4 12H28V28H4ZM2 8H30V13H2ZM16 8V28M16 8Q2 7 8 2Q13 0 16 8Q19 0 24 2Q30 7 16 8', award: 'M8 3H24V12Q24 21 16 22Q8 21 8 12ZM8 6H3Q2 16 10 16M24 6H29Q30 16 22 16M16 22V28M10 29H22', mail: 'M3 7H29V26H3ZM3 7L16 18L29 7', menu: 'M5 7H27M5 16H27M5 25H27', bag: 'M7 10H25L28 28H4ZM11 10V7Q16 0 21 7V10M11 18H21', person: 'M16 16A6 6 0 1 0 16 4A6 6 0 1 0 16 16M5 29V25Q5 17 16 18Q27 17 27 25V29Z', star: 'M16 2L20 11L30 12L23 19L25 29L16 24L7 29L9 19L2 12L12 11Z', lotus: 'M16 29Q3 21 8 8Q16 14 16 29Q16 14 24 8Q29 21 16 29M16 25Q7 12 16 2Q25 12 16 25M12 29Q2 29 2 18Q9 18 12 29M20 29Q30 29 30 18Q23 18 20 29', feather: 'M5 28L24 6M10 23Q2 7 25 3Q30 19 10 23M13 19L23 18M17 14L27 12', globe: 'M16 30A14 14 0 1 0 16 2A14 14 0 1 0 16 30M2 16H30M16 2Q3 16 16 30Q29 16 16 2M5 8H27M5 24H27', chat: 'M3 4H29V24H14L6 30V24H3ZM8 12H10M15 12H17M22 12H24', calendar: 'M4 6H28V29H4ZM4 13H28M10 2V9M22 2V9M9 18H12M19 18H22M9 23H12M19 23H22', quill: 'M6 28L24 3M8 22Q3 9 24 3Q29 18 8 22M13 17H23', sound: 'M3 12H9L17 5V27L9 20H3ZM22 10Q29 16 22 22M25 5Q36 16 25 27', search: 'M14 24A10 10 0 1 0 14 4A10 10 0 1 0 14 24M22 22L30 30', flag: 'M6 30V3M6 4Q12 0 19 4Q25 8 29 3V19Q22 24 16 19Q11 16 6 20', home: 'M2 15L16 3L30 15M6 12V29H26V12M12 29V20H20V29' };
function icon(name) { return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.book}"/></svg>`; }
const app = document.querySelector('#app');
app.innerHTML = `<main id="game" aria-label="동국대학교 대학원 전공 탐험 RPG"><canvas id="world" width="1536" height="864" aria-label="이동 가능한 캠퍼스 게임 월드"></canvas><div id="hud"></div><div class="toast" role="status"></div><div id="loading"><div class="loading-title">東國<br>동국대학교 대학원<p>전공 탐험 RPG</p><p>봄날의 캠퍼스를 준비하고 있습니다…</p></div></div></main>`;
const game = document.querySelector('#game'), hud = document.querySelector('#hud'), canvas = document.querySelector('#world'), ctx = canvas.getContext('2d');
new ResizeObserver(() => { game.style.setProperty('--ui-scale', String(game.clientWidth / 1536)); }).observe(game);
// R13.43: Same-origin nickname across meditation campus and the major RPG.
const DGU_SHARED_NAME_KEY = 'dgu-campus-character-name-v1';
function dguSafeName(input) {
    return Array.from(String(input ?? '').replace(/[\x00-\x1f\x7f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('') || '방문자';
}
function dguReadSharedName() {
    try { return localStorage.getItem(DGU_SHARED_NAME_KEY); } catch { return null; }
}
function dguWriteSharedName(name) {
    try { localStorage.setItem(DGU_SHARED_NAME_KEY, dguSafeName(name)); } catch { /* Storage can be disabled. */ }
}
let state = load();
// An existing meditation nickname has precedence; otherwise migrate the RPG's prior name.
const dguExistingSharedName = dguReadSharedName();
if (dguExistingSharedName !== null) {
    state.name = dguSafeName(dguExistingSharedName);
} else {
    state.name = dguSafeName(state.name || '방문자');
    dguWriteSharedName(state.name);
}
let px = 550, py = 1080, camX = 550, camY = 1080, target = null, time = 0, last = 0, walk = false, facing = 1, zoom = 1.4, modalOpen = false, muted = true;
let adventureWorldSignature = '';
function dguRefreshSharedName() {
    const shared = dguReadSharedName();
    if (shared === null) return;
    const normalized = dguSafeName(shared);
    if (state.name !== normalized) { state.name = normalized; save(); renderHUD(); }
}
window.addEventListener('pageshow', dguRefreshSharedName);
window.addEventListener('storage', event => {
    if (event.key === DGU_SHARED_NAME_KEY) dguRefreshSharedName();
});
const dguTargetFrameMs=(matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0)?33:16;
let dguLastFramePaint=0;
const director = new CampusDirector({ position: () => ({ x: px, y: py, region: state.region }), selectMajor: i => { state.major = i; if (!state.completed.includes('major'))
        reward('major', 60, '모험가의 첫 인장');
    else
        save(); setupMap(); renderHUD(); }, onWorldUpdate: syncAdventureWorld, snapshot: () => ({ ...state, completed: [...new Set([...state.completed.filter(id => ['manuscript', 'festival', 'pronunciation', 'quiz-4', 'major'].includes(id)), ...state.completed.filter(id => !id.startsWith('director:')).slice(-100)])], items: [...new Set([...state.items.slice(0, 25), ...state.items.slice(-25)])] }), open: openModal, button, toast, travel: changeRegion, close: closeModal, receipts: (worldId, receipts) => { let changed = false; const applied = new Set(state.completed); for (const r of receipts) {
        const id = `director:${worldId}:${r.id}`;
        if (applied.has(id))
            continue;
        applied.add(id);
        state.completed.push(id);
        state.xp += r.xp;
        state.research[r.major] += r.research;
        state.items.push(r.item);
        changed = true;
    } if (changed) {
        state.level = 1 + Math.floor(state.xp / 100);
        save();
        renderHUD();
    } } });
const mobileShell = installMobileShell(game, { pause: paused => { modalOpen = paused; if (!paused && state.major < 0)
        setTimeout(() => director.adventure.select(), 80); }, toast, help: () => { const e = openModal('홈 화면에서 캠퍼스 열기', '내 휴대전화의 작은 캠퍼스', `<p><b>iPhone · Safari</b><br>공유 버튼 → 홈 화면에 추가 → 추가</p><p><b>Android · Chrome</b><br>브라우저 메뉴 → 앱 설치 또는 홈 화면에 추가</p><p>가로로 돌려 실행하면 더 넓은 캠퍼스를 탐험할 수 있어요. 진행은 이 브라우저에 저장되며, 다른 브라우저와는 별도 여정입니다.</p>`); e.append(button('확인', () => { closeModal(); if (mobileShell.isOpen())
        modalOpen = true; }, 'option primary')); } });
const images = {};
const keys = new Set();
let joy = { x: 0, y: 0 };
let nearest;
let toastTimer = 0;
let activeTab = '퀘스트';
let chatTab = '전체';
let questGuide = false;
let objects = [];
function syncAdventureWorld() { const h = director.adventure.hero(); const signature = [state.region, state.major, h?.chapter, h?.accepted, h?.found.join(','), h?.bossWon, h?.finished, h?.expedition?.id, h?.expedition?.found.join(','), h?.expedition?.won].join(':'); if (signature !== adventureWorldSignature) {
    adventureWorldSignature = signature;
    setupMap();
} if (h) {
    const hp = hud.querySelector('.bar i'), sp = hud.querySelector('.bar.blue i');
    if (hp)
        hp.style.width = (h.hp / maxHp(h) * 100) + '%';
    if (sp)
        sp.style.width = (h.sp / 30 * 100) + '%';
    const labels = hud.querySelectorAll('.bar span');
    if (labels[0])
        labels[0].textContent = `HP ${h.hp}/${maxHp(h)}`;
    if (labels[1])
        labels[1].textContent = `SP ${h.sp}/30`;
} }
function rng(n) { return Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
function save() { persist(state); }
function toast(s) { const e = document.querySelector('.toast'); e.textContent = s; e.classList.add('show'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => e.classList.remove('show'), 3200); }
function reward(id, xp, item) { if (state.completed.includes(id)) {
    toast('이미 완료한 활동입니다. 새로운 연구를 탐험해 보세요.');
    return;
} state.completed.push(id); state.xp += xp; if (item && !state.items.includes(item))
    state.items.push(item); const level = 1 + Math.floor(state.xp / 100); if (level > state.level)
    toast(`레벨 업! Lv.${level} · 새로운 배움의 시작`);
else
    toast(`퀘스트 완료 · 경험치 +${xp}${item ? ' · ' + item : ''}`); state.level = level; if (state.major >= 0)
    state.research[state.major] += 15; save(); renderHUD(); sound(); void director.onLegacy(); }
function sound() { if (muted)
    return; const a = new AudioContext(); const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.type = 'sine'; o.frequency.setValueAtTime(523, a.currentTime); o.frequency.setValueAtTime(784, a.currentTime + .12); g.gain.setValueAtTime(.06, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .5); o.start(); o.stop(a.currentTime + .5); o.onended = () => a.close(); }
function setupMap() {
    objects = [];
    const r = regions[state.region];
    objects.push({ kind: 'gate', x: 550, y: 430, w: 355, h: 260, asset: 'gate', label: state.region === 0 ? '동국대학교 대학원' : r.name, solid: true });
    const positions = [[550, 765], [225, 940], [875, 940], [205, 1200], [895, 1200], [210, 1495], [890, 1495]];
    r.buildings.forEach((name, i) => objects.push({ kind: 'building', x: positions[i][0], y: positions[i][1], w: i === 0 ? 370 : 340, h: i === 0 ? 330 : 295, asset: i % 3 === 0 ? 'library' : 'school', label: name, major: state.region === 0 ? i : undefined, id: i, solid: true }));
    objects.push({ kind: 'bridge', x: 550, y: 1615, w: 330, h: 235, asset: 'bridge' });
    if (state.region === 1)
        objects.push({ kind: 'fountain', x: 550, y: 1380, w: 260, h: 260, asset: 'fountain', solid: true });
    if (state.region === 3)
        objects.push({ kind: 'stage', x: 550, y: 650, w: 355, h: 310, asset: 'school', label: '아시아 문화공연 무대', solid: true });
    const npos = [[470, 940], [400, 1025], [730, 1290]];
    for (let i = 0; i < 3; i++)
        objects.push({ kind: 'npc', x: npos[i][0], y: npos[i][1], w: 68, h: 78, asset: i % 2 ? 'professor' : 'player', label: r.npcs[i % 3], id: i, baseX: npos[i][0], baseY: npos[i][1] });
    for (let i = 0; i < 32; i++) {
        let x, y;
        if (i < 24) {
            x = i % 2 === 0 ? 55 + rng(i) * 70 : 975 + rng(i) * 90;
            y = 280 + Math.floor(i / 2) * 145;
        }
        else {
            x = 110 + rng(i) * 880;
            y = 1950 + rng(i + 20) * 140;
        }
        objects.push({ kind: 'tree', x, y, w: 170 + rng(i + 5) * 85, h: 205 + rng(i + 5) * 85, asset: i % 3 === 0 ? 'tree' : 'cherry', solid: true });
    }
    for (const [x, y] of [[365, 1225], [735, 1225], [370, 715], [735, 720], [350, 1480], [760, 1480], [150, 520], [960, 550]])
        objects.push({ kind: 'tree', x, y, w: 140, h: 170, asset: 'cherry', solid: true });
    if (state.major >= 0) {
        const roster = campaignNPCs.filter(n => n.major === state.major && n.location === state.region);
        roster.forEach((n, i) => objects.push({ kind: 'npc', x: 470 + i * 140, y: 1010 + i * 110, w: 72, h: 84, asset: i % 2 ? 'professor' : 'player', label: n.name, id: i + 3, npcId: n.id, baseX: 470 + i * 140, baseY: 1010 + i * 110 }));
        const h = director.state?.adventure?.heroes[state.major];
        if (h) {
            const field = fieldObjects(h);
            if (field.region === state.region) {
                field.targets.forEach(t => objects.push({ kind: t.kind === 'chest' ? 'chest' : 'clue', x: t.x, y: t.y, w: t.kind === 'chest' ? 75 : 56, h: t.kind === 'chest' ? 70 : 68, asset: t.kind === 'chest' ? 'treasure' : 'quest-scroll', label: t.label, targetId: t.id }));
                if (field.enemy)
                    objects.push({ kind: 'enemy', x: field.enemy.x, y: field.enemy.y, w: 155, h: 155, asset: field.enemy.asset, label: field.enemy.label, targetId: field.enemy.id });
            }
        }
    }
    const v = r.name;
    if (!state.visited.includes(v))
        state.visited.push(v);
    save();
}
function changeRegion(n) { state.region = n; px = 550; py = 1080; camX = 550; camY = 1080; target = null; setupMap(); closeModal(); renderHUD(); toast(`${regions[n].name}에 도착했습니다`); questGuide = true; void director.onRegion(); }
function button(label, fn, cls = 'option') { const b = document.createElement('button'); b.className = cls; b.innerHTML = label; b.onclick = () => { sound(); fn(); }; return b; }
function openModal(title, sub, body) { closeModal(); modalOpen = true; target = null; const el = document.createElement('div'); el.className = 'overlay'; el.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><button class="close" aria-label="닫기">×</button><h2>${escapeHTML(title)}</h2><div class="subtitle">${escapeHTML(sub)}</div><div class="content">${body}</div></section>`; game.append(el); el.querySelector('.close').addEventListener('click', closeModal); el.addEventListener('click', e => { if (e.target === el)
    closeModal(); }); return el.querySelector('.content'); }
function closeModal() { document.querySelector('.overlay')?.remove(); modalOpen = mobileShell?.isOpen() ?? false; }
function worldMap() { const el = openModal('캠퍼스 지도', '네 개의 공간, 하나의 배움', `<p>벚꽃길을 따라 새로운 연구의 세계로 떠나세요.</p>`); regions.forEach((r, i) => el.append(button(`<b>0${i + 1}　${r.name}</b><br><small>${r.sub}${i === state.region ? ' · 현재 위치' : ''}</small>`, () => changeRegion(i)))); }
function selectMajor(i) { const m = majors[i]; const el = openModal(m.name + ' 전공', '일곱 갈래의 길, 나만의 연구', `<p>${m.desc}</p><div class="reward">전공 능력 · ${m.ability}<br>전공 연구 · ${m.quest}<br>활동 지역 · ${regions[m.area].name}</div>`); el.append(button(state.major === i ? '선택한 전공으로 탐험하기' : m.name + ' 전공 선택', () => { state.major = i; reward('major', 60, '전공 연구 안내서'); save(); closeModal(); renderHUD(); toast(m.name + ' 전공을 선택했습니다. 교수님과 이야기해 보세요.'); }, 'option primary')); el.prepend(button('이 전공의 모험 · ' + campaigns[i].title, () => { state.major = i; save(); setupMap(); renderHUD(); void director.adventure.open(); }, 'option primary')); el.append(button('학관 안으로 들어가기 · 전공 체험게임', () => interior(m.name, i))); el.append(button('전공 활동 지역으로 이동', () => changeRegion(m.area))); }
// Original seven interactive experiences from the older campus project, restored only inside the major RPG.
const DGU_EXPERIENCE_PAGES = [
    'classic_story.html', 'linguistics_story.html', 'creative_writing_story.html',
    'modern_story.html', 'korean_teaching_story.html', 'multicultural_story.html',
    'asia_culture_story.html'
];
function launchMajorExperience(major) {
    if (!Number.isInteger(major) || major < 0 || major >= DGU_EXPERIENCE_PAGES.length) {
        toast('먼저 전공을 선택한 다음 학관에 입장해 주세요.');
        majorMenu();
        return;
    }
    state.major = major;
    state.name = dguSafeName(state.name);
    dguWriteSharedName(state.name);
    save();
    // Distinct, original, fully playable story minigame for each major.
    window.location.assign('./experience/' + DGU_EXPERIENCE_PAGES[major] + '?from=rpg');
}
function interior(name, major) {
    if (Number.isInteger(major)) {
        launchMajorExperience(major);
        return;
    }
    // Generic non-major buildings retain their pre-existing study-room interaction.
    const el = openModal(name, '학관 내부 · 작은 연구실', `<div class="npc-head"><img src="./assets/professor.png" alt="지도교수"><div><b>지도교수 연구실</b><small>연구실 · 도서 자료 · 교수 상담</small></div></div><p>전공을 선택하면 해당 전공의 체험형 게임을 시작할 수 있습니다.</p>`);
    el.append(button('전공 선택하고 체험하기', majorMenu, 'option primary'));
    el.append(button('광장으로 나가기', closeModal));
}
function interact(o) { if (o.kind === 'building') {
    if (o.major !== undefined)
        selectMajor(o.major);
    else
        interior(o.label);
}
else if (o.kind === 'gate')
    worldMap();
else if (o.kind === 'npc') {
    if (o.npcId)
        director.adventure.npc(o.npcId);
    else
        dialogue(o);
}
else if (o.kind === 'clue' || o.kind === 'chest') {
    if (Math.hypot(px - o.x, py - o.y) > 185) {
        target = { x: o.x, y: o.y };
        toast('흔적 가까이 다가가 조사해 보세요.');
    }
    else
        void director.adventure.field(o.targetId);
}
else if (o.kind === 'enemy') {
    if (Math.hypot(px - o.x, py - o.y) > 190) {
        target = { x: o.x, y: o.y };
        toast('적에게 다가가 대면하세요.');
    }
    else
        void director.adventure.enemy();
}
else if (o.kind === 'fountain') {
    toast('맑은 분수 옆에서 잠시 쉬었습니다. SP가 회복되었습니다.');
}
else if (o.kind === 'stage')
    festival(); }
function dialogue(o) { if (state.major >= 0) {
    const c = campaigns[state.major], h = director.adventure.hero();
    const rumor = h?.finished ? '그 사건이 마무리되었다는 소식을 들었어요. 함께한 동료들이 당신을 기다리고 있어요.' : h?.chapter ? `${c.npcNames[currentChapter(h).contact]}에게서 소식이 왔어요. 지금은 ${currentChapter(h).title}의 행방을 살피고 있다더군요.` : `${c.npcNames[0]}에게서 급한 소식이 왔어요. ${c.hook}`;
    const e = openModal(o.label, '캠퍼스에서 만난 이웃', `<div class="npc-head"><img src="./assets/${o.asset}.png" alt=""><div><b>${o.label}</b><small>현재 모험 · ${c.title}</small></div></div><p>“${rumor}”</p>`);
    e.append(button('지금 진행 중인 모험', () => void director.adventure.open(), 'option primary'));
    e.append(button('캠퍼스의 지난 일과 자유 대화', () => { void director.attachNPC(e, `npc-${state.region}-${o.id % 3}`); }));
    e.append(button('기존 실습·필사본·축제 활동', () => legacyDialogue(o)));
    return;
} legacyDialogue(o); }
function legacyDialogue(o) {
    const r = regions[state.region];
    const el = openModal(o.label, 'NPC 대화 · ' + r.name, `<div class="npc-head"><img src="./assets/${o.asset}.png" alt="${o.label}"><div><b>${o.label}</b><small>${o.id === 0 ? '퀘스트 안내 · 연구 멘토' : '캠퍼스에서 만난 이웃'}</small></div></div><p>${state.region === 0 ? '“봄빛 가득한 캠퍼스에 오신 걸 환영해요. 일곱 학관을 둘러보고 마음이 향하는 전공을 선택해 보세요.”' : state.region === 1 ? (state.completed.includes('quiz-4') ? '“지난 인사 수업을 잘 마쳤군요. 이번에는 학습자의 반응에서 다음 수업을 생각해 볼까요?”' : '“처음 만난 분께 어떤 인사를 드리면 좋을까요? 함께 한국어를 배워요.”') : state.region === 2 ? (state.completed.includes('manuscript') ? '“필사본을 돌려주셔서 고맙습니다. 이제 그 기록이 어디에서 왔는지 함께 조사해 볼까요?”' : '“귀한 필사본이 사라졌습니다. 서책전에 남은 흔적을 함께 살펴 주시겠어요?”') : `“${state.festival >= 0 ? ['모두가 참여하는 화합', '학술 전시와 지식 교류', '지역 사회와 나눔'][state.festival] + '의 축제를 준비하고 있어요.' : '서로 다른 문화가 만나는 축제입니다. 어떤 축제를 만들고 싶으세요?'}”`}</p>`);
    void director.attachNPC(el, `npc-${state.region}-${o.id % 3}`);
    if (state.region === 0) {
        el.append(button(state.major < 0 ? '일곱 전공에 대해 알고 싶어요' : '선택한 전공의 연구를 시작할게요', () => { if (state.major < 0)
            majorMenu();
        else
            quiz(state.major); }));
        el.append(button('연구 여정 퀘스트를 수락할게요', () => accept(r.quest)));
    }
    if (state.region === 1) {
        el.append(button('인사 표현 가르치기', () => quiz(4)));
        el.append(button('발음 연습을 할게요', pronunciation));
    }
    if (state.region === 2)
        el.append(button('사라진 필사본을 찾아드릴게요', manuscript));
    if (state.region === 3)
        el.append(button('문화의 다리, 하나의 축제', festival));
    el.append(button('다른 문화에 대해 대화해요', () => { const e = openModal('서로를 알아가는 시간', o.label, `<p>“${['브라질에서는 포르투갈어를 사용해요. 사람마다 인사 방식이 다를 수 있으니 먼저 물어봐 주세요.', '일본과 한국의 설날 음식은 서로 달라도 가족의 안녕을 바라는 마음은 닮았어요.', '문화를 이해할 때는 한 사람의 경험을 나라 전체의 특징으로 일반화하지 않는 것이 중요해요.'][o.id % 3]}”</p>`); e.append(button('이야기를 연구노트에 기록하기', () => { reward('talk-' + state.region + '-' + o.id, 15, '문화 대화 기록'); closeModal(); })); }));
}
function accept(q) { if (!state.accepted.includes(q))
    state.accepted.push(q); save(); closeModal(); toast('퀘스트 수락 · ' + q); renderHUD(); }
function majorMenu() { director.adventure.select(); }
function legacyMajorMenu() { const el = openModal('나의 전공 선택', '당신의 호기심이 향하는 곳', `<p>각 학관을 방문하여 전공의 연구와 활동을 확인하세요.</p>`); majors.forEach((m, i) => el.append(button(`${state.major === i ? '✦ ' : ''}<b>${m.name}</b> · ${m.ability}`, () => selectMajor(i)))); }
function quiz(i) { const m = majors[i]; const el = openModal(m.quest, m.name + ' · 학습 미션', `<div class="npc-head"><img src="./assets/professor.png" alt="교수"><div><b>오늘의 연구 질문</b><small>${m.ability} 능력을 키워 보세요</small></div></div><p>${m.question}</p><div class="reward">학습 보상 · 경험치 70 · 전공 능력 15 · 연구 기록</div>`); m.answers.forEach((a, j) => el.append(button(`${j + 1}. ${a}`, () => { if (j === m.correct) {
    reward('quiz-' + i, 70, m.name + ' 연구 기록');
    const e = openModal('참 잘했어요!', '학습 성취도 · 100%', `<p>${m.answers[m.correct]}</p><p>지도교수의 피드백: “개념을 정확히 이해했군요. 이제 실제 상황에서도 적용해 보세요.”</p>`);
    e.append(button('배움을 이어가기', closeModal, 'option primary'));
}
else
    toast('다시 생각해 보세요. 상황과 상대방의 맥락을 살펴보면 도움이 됩니다.'); }))); }
function manuscript() { const e = openModal('사라진 필사본', '한양 문예시장 · 분기형 이야기', `<p>병약한 학자의 『홍길동전』 필사본이 사라졌습니다. 서책전 주인이 낯선 사람을 보았다고 합니다. 어떤 길을 택하시겠어요?</p>`); ['의금부에 알린다', '직접 수색한다'].forEach((v, i) => e.append(button(`<b>${v}</b><br><small>${i === 0 ? '신중한 협력 · 명성의 길' : '서책전 탐색 · 발견의 길'}</small>`, () => { const f = openModal(v, '선택이 이야기를 바꿉니다', `<p>${i === 0 ? '의금부의 관리가 서책전의 거래 기록을 조사했습니다. 필사본은 제본을 맡긴 책방에서 안전하게 발견되었습니다. 학자는 당신의 신중함에 감사했습니다.' : '서책전의 묵향을 따라 낡은 책장 뒤를 살폈습니다. 그곳에는 제본 중인 필사본과 미완의 시 한 편이 있었습니다. 학자가 환하게 웃습니다.'}</p>`); f.append(button('필사본을 돌려주고 보상 받기', () => { reward('manuscript', i === 0 ? 85 : 100, i === 0 ? '의로운 학자의 인장' : '미완의 시 필사본'); closeModal(); }, 'option primary')); }))); }
function festival() { const e = openModal('문화의 다리, 하나의 축제', '라니 · 문화교류 코디네이터', `<p>“서로 다른 문화가 만나 하나의 이야기를 만듭니다. 어떤 축제를 함께 완성하고 싶으신가요?”</p>`); ['모두가 참여하는 화합의 축제', '학술 전시 중심의 지식 교류 축제', '지역 사회와 함께하는 나눔·연대 축제'].forEach((s, i) => e.append(button(s, () => { state.festival = i; reward('festival', 100, ['화합의 꽃등', '문화 학술 도록', '나눔의 리본'][i]); save(); closeModal(); toast(s + ' · 광장의 깃발과 장식이 바뀌었습니다.'); }))); }
function pronunciation() { const e = openModal('소리 내어 인사해요', '발음 연습 · 기기 안에서 배우기', `<p style="font-size:25px;text-align:center">“안녕하세요”</p><p>안 · 녕 · 하 · 세 · 요<br>음절을 천천히 읽은 뒤 자연스럽게 이어 말해 보세요.</p><p class="help">음성 인식은 지원되는 브라우저에서 권한 허용 시 사용할 수 있습니다. 인식 결과는 발음 정확도 점수가 아닙니다.</p>`); e.append(button('표준 음성 듣기', () => { if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('안녕하세요. 처음 뵙겠습니다.');
    u.lang = 'ko-KR';
    u.rate = .8;
    speechSynthesis.speak(u);
}
else
    toast('이 환경은 음성 재생을 지원하지 않습니다. 음절을 따라 읽어 주세요.'); })); const rec = window.SpeechRecognition || window.webkitSpeechRecognition; if (rec)
    e.append(button('마이크로 연습하기', () => { const r = new rec(); r.lang = 'ko-KR'; r.onresult = (ev) => toast('인식된 표현: ' + ev.results[0][0].transcript); r.onerror = () => toast('음성 인식을 사용할 수 없습니다. 아래 음절 연습을 이용하세요.'); r.start(); })); e.append(button('음절 순서 확인: 안 → 녕 → 하 → 세 → 요', () => { reward('pronunciation', 30, '인사 표현 학습 카드'); toast('음절을 정확히 이어 읽었어요. 자기 점검 학습 완료!'); })); }
function notebook() { const m = state.major >= 0 ? majors[state.major] : null; const e = openModal('나의 연구노트', m ? m.name + ' · ' + m.ability : '아직 선택하지 않은 가능성', `<div class="reward">Lv.${state.level} · 경험치 ${state.xp}<br>완료 활동 ${state.completed.length} · 발견 지역 ${state.visited.length}/4</div>${majors.map((a, i) => `<p>${a.name} · ${a.ability} ${state.research[i]}<div class="progress"><i style="width:${Math.min(100, state.research[i])}%"></i></div></p>`).join('')}<textarea id="note" placeholder="오늘 발견한 것을 기록하세요…"></textarea>`); try { e.querySelector('#note').value = localStorage.getItem('dongguk-note') || ''; } catch { e.querySelector('#note').value = ''; } e.append(button('연구 메모 저장', () => { try { localStorage.setItem('dongguk-note', e.querySelector('#note').value); toast('연구 메모를 저장했습니다.'); } catch { toast('브라우저 저장공간이 차단되어 연구 메모를 저장하지 못했습니다.'); } })); }
function inventory() { openModal('나의 가방', '여정 속에서 모은 소중한 기록', `<div class="items">${state.items.map(i => `<div class="item">${icon('book')}${escapeHTML(i)}</div>`).join('')}</div>`); }
function achievements() { openModal('나의 업적', '작은 배움이 모여 큰 여정으로', `<div class="items">${[['첫 번째 연구자', state.major >= 0], ['캠퍼스 탐험가', state.visited.length === 4], ['학습의 달인', state.completed.filter(x => x.startsWith('quiz')).length >= 3], ['필사본의 수호자', state.completed.includes('manuscript')], ['문화의 다리', state.completed.includes('festival')], ['성장하는 연구자', state.level >= 3]].map(([n, b]) => `<div class="item">${icon('award')}${n}<br><small>${b ? '달성 완료' : '도전 중'}</small></div>`).join('')}</div>`); }
function daily() { const day = new Date().toISOString().slice(0, 10); const e = openModal('오늘의 캠퍼스', '일정 · 매일의 작은 배움', `<p>09:00　지도교수 상담<br>11:00　한국어 회화 실습<br>14:00　문예시장 답사<br>16:00　문화교류 축제</p><div class="reward">오늘의 활동 · 캠퍼스 출석하기</div>`); e.append(button(state.day === day ? '오늘 출석을 완료했습니다' : '출석하고 경험치 20 받기', () => { if (state.day !== day) {
    state.day = day;
    reward('daily-' + day, 20);
    save();
}
else
    toast('내일 다시 만나요!'); })); }
function menu() { const e = openModal('여정의 쉼표', '동국대학교 대학원 전공 탐험 RPG', `<p>이동 · WASD / 방향키 / 터치 조이스틱<br>목적지 이동 · 바닥 클릭<br>대화 · NPC 클릭 / 가까이에서 E<br>지도 · M　닫기 · Esc<br><small>진행은 이 브라우저에 자동 저장됩니다.</small></p>`); e.append(button('캐릭터 이름 바꾸기', () => { const f = openModal('나의 이름', '새로운 연구자의 이름', `<input id="playername" maxlength="12" style="width:100%;padding:12px;border:1px solid #bca47c" aria-label="캐릭터 이름"/>`); f.querySelector('input').value = state.name; f.append(button('이름 저장', () => { state.name = dguSafeName(f.querySelector('input').value); dguWriteSharedName(state.name); save(); renderHUD(); closeModal(); })); })); e.append(button(muted ? '효과음 켜기' : '효과음 끄기', () => { muted = !muted; toast(muted ? '효과음을 껐습니다' : '효과음을 켰습니다'); menu(); })); e.append(button('진행 저장', () => { if(persist(state))toast('현재 여정을 저장했습니다.'); else toast('브라우저 저장공간이 차단되어 기기에 저장하지 못했습니다.'); })); e.append(button('저장 데이터 내려받기', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = '동국대-연구여정.json'; a.click(); URL.revokeObjectURL(a.href); })); e.append(button('저장 데이터 불러오기', () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = async () => { try {
    const v = JSON.parse(await input.files[0].text());
    if (!Array.isArray(v.research) || v.research.length !== 7 || !Array.isArray(v.items) || !Number.isInteger(v.region) || v.region < 0 || v.region > 3 || !Array.isArray(v.completed) || !Array.isArray(v.visited) || !Array.isArray(v.accepted))
        throw Error();
    state = { ...state, ...v };
    save();
    changeRegion(state.region);
    toast('저장한 여정을 불러왔습니다.');
}
catch {
    toast('올바른 게임 저장 파일을 선택해 주세요.');
} }; input.click(); })); }
function skill(n) { const h = director.adventure.hero(); if (n < 4 && h?.battle && !h.battle.result) {
    void director.adventure.action({ command: 'battle', value: ['attack', 'skill', 'guard', 'potion'][n] }, 'battle');
    return;
} if (n === 0 || n === 7)
    void director.adventure.open(); if (n === 1) {
    if (h?.accepted && currentChapter(h).challenge && !h.puzzleSolved)
        director.adventure.challenge();
    else
        void director.adventure.open();
} if (n === 2 || n === 3 || n === 6)
    director.adventure.gear(); if (n === 4)
    worldMap(); if (n === 5)
    director.adventure.select(); }
function questMenu() { void director.adventure.open(); }
function legacyQuestMenu() { const e = openModal('나의 퀘스트', '연구 여정의 이정표', `<p>${regions[state.region].quest}</p><div class="reward">${state.accepted.includes(regions[state.region].quest) ? '진행 중' : '수락 가능'} · ${state.completed.length}개의 활동 완료</div>`); e.append(button('현재 지역 퀘스트 시작', () => { accept(regions[state.region].quest); if (state.region === 0)
    majorMenu(); if (state.region === 1)
    quiz(4); if (state.region === 2)
    manuscript(); if (state.region === 3)
    festival(); })); e.append(button('안내 표시 켜기', () => { questGuide = true; closeModal(); toast('빛나는 길을 따라 안내 NPC에게 이동하세요.'); })); }
function renderHUD() {
    const r = regions[state.region];
    hud.innerHTML = `<div class="status"><div class="portrait"><img src="./assets/player.png" alt="캐릭터 초상화"></div><div class="status-info"><small>Lv. ${state.level}　${state.major >= 0 ? majors[state.major].name : '새내기 연구자'}</small><br><b>${escapeHTML(state.name)}</b><div class="bar"><i></i><span>HP　2,840 / 2,840</span></div><div class="bar blue"><i></i><span>SP　890 / 890</span></div><small>연구력 ${112 + state.xp}　✦ ${state.xp} EXP</small></div></div><nav class="top-menu">${[['gift', '이벤트'], ['scroll', '공지'], ['award', '업적'], ['mail', '우편'], ['menu', '메뉴']].map(([i, l]) => `<button data-top="${l}" aria-label="${l}">${icon(i)}${l}</button>`).join('')}</nav><div class="location"><small>DONGGUK UNIVERSITY</small><h1>${r.name}</h1><p>${r.sub}</p></div><div class="minimap gold interactive"><canvas id="mini" width="180" height="150"></canvas><button id="mapbtn">✦ ${r.name}　⌕</button></div><section class="quest gold"><div class="tabs">${['퀘스트', '의뢰', '스토리'].map(t => `<button data-tab="${t}" class="${activeTab === t ? 'active' : ''}">${t}</button>`).join('')}</div><div class="quest-body">${(activeTab === '퀘스트' ? [[`[메인] ${r.quest}`, state.major < 0 ? '전공을 선택하고 지도교수와 대화하기' : '교수와 대화하고 연구 미션 완수하기'], ['[가이드] 전공 둘러보기', `일곱 전공의 학관 방문하기 (${state.visited.length}/4 지역)`], ['[일일] 대학원 생활', '오늘의 출석과 학습을 기록하기']] : activeTab === '의뢰' ? [['[학습] 오늘의 연구', state.major >= 0 ? majors[state.major].quest : '전공을 선택해 연구를 시작하세요'], ['[수집] 배움의 기록', `연구 자료 수집 (${state.items.length})`]] : [['[이야기] 사라진 필사본', '한양 문예시장의 학자를 만나세요'], ['[축제] 문화의 다리', '교류 광장의 라니와 이야기하세요']]).map(([a, b]) => `<button class="quest-item"><strong>◆ ${a}</strong><span>${b}</span></button>`).join('')}</div></section><nav class="side-menu">${[['calendar', '일정'], ['book', '도감'], ['bag', '가방'], ['person', '캐릭터'], ['star', '스킬'], ['globe', '전공'], ['quill', '연구노트']].map(([i, l]) => `<button data-side="${l}" aria-label="${l}">${icon(i)}<span>${l}</span></button>`).join('')}</nav><div class="joystick" aria-label="이동 조이스틱"><div class="stick"></div></div><div class="hint">WASD 이동 · E 대화 · M 지도</div><button class="interact" id="interact">✦ 가까운 인물과 대화하기　E</button><div class="skills">${['book', 'feather', 'lotus', 'sound', 'home', 'globe', 'quill', 'chat'].map((i, n) => `<button class="skill" data-skill="${n}" aria-label="${['모험과 공격', '전공 기술', '방어와 장비', '회복과 보급', '지역 이동', '모험 선택', '장비', '현재 모험'][n]}">${icon(i)}<small>${['공격', '기술', '방어', '회복', '지도', '전공', '장비', '모험'][n]}</small></button>`).join('')}<button class="skill main" id="main-action" aria-label="주변 상호작용">${icon('lotus')}</button></div><div class="chat gold"><div class="chat-tabs">${['전체', '학교', '그룹', '파티', '연합'].map(t => `<button data-chat="${t}" class="${chatTab === t ? 'active' : ''}">${t}</button>`).join('')}</div><div class="messages" id="messages"><div><b>[시스템]</b> ${r.name}에 오신 것을 환영해요.</div><div><b>[NPC · 하린]</b> 벚꽃길 따라 학관을 둘러볼까요?</div><div><b>[안내]</b> 로컬 채팅 · 다른 이용자에게 전송되지 않습니다.</div></div><div class="chat-entry"><input id="chatinput" aria-label="로컬 채팅 입력" placeholder="나의 캠퍼스 이야기를 남겨 보세요…"><button id="sendchat">전송</button></div></div><div class="bottom-brand">東國 · 배움으로 이어지는 세계</div><button id="story-open" class="story-ribbon gold"><span>✦ 나의 모험과 동료</span><small id="story-status">지난 선택에서 새로운 연구가 시작됩니다</small></button>`;
    hud.querySelector('#story-open').addEventListener('click', () => void director.adventure.open());
    director.updateBadge();
    syncAdventureWorld();
    hud.querySelector('#mapbtn').addEventListener('click', worldMap);
    hud.querySelector('#mini').addEventListener('click', worldMap);
    hud.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; renderHUD(); });
    hud.querySelectorAll('.quest-item').forEach(b => b.addEventListener('click', questMenu));
    hud.querySelectorAll('[data-skill]').forEach(b => b.onclick = () => skill(Number(b.dataset.skill)));
    hud.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { const l = b.dataset.side; if (l === '일정')
        daily(); if (l === '도감')
        openModal('캠퍼스 도감', '발견한 장소와 배움', `<div class="items">${regions.map(r => `<div class="item">${icon('home')}${r.name}<br>${state.visited.includes(r.name) ? '발견 완료' : '미발견'}</div>`).join('')}</div>`); if (l === '가방')
        inventory(); if (l === '캐릭터') {
        director.adventure.gear();
        return;
        const e = openModal('나의 캐릭터', escapeHTML(state.name), `<div class="npc-head"><img src="./assets/player.png" alt="플레이어"><div><b>Lv.${state.level} 연구자</b><small>${state.major >= 0 ? majors[state.major].name : '전공 탐색 중'}</small></div></div><p>학습 경험치 ${state.xp}<br>연구력 ${112 + state.xp}<br>장비 · 학자의 갓 / 봄빛 한복<br>버프 · 배움의 호기심</p>`);
        e.append(button('전공 변경하기', majorMenu));
    } if (l === '스킬')
        openModal('연구 능력', '배움을 거듭할수록 성장합니다', majors.map((m, i) => `<p>${m.ability} · ${state.research[i]}<div class="progress"><i style="width:${Math.min(100, state.research[i])}%"></i></div></p>`).join('')); if (l === '전공')
        majorMenu(); if (l === '연구노트')
        void director.hub('past'); });
    hud.querySelectorAll('[data-top]').forEach(b => b.onclick = () => { const l = b.dataset.top; if (l === '메뉴')
        menu(); if (l === '업적')
        achievements(); if (l === '이벤트')
        void director.adventure.open(); if (l === '공지')
        openModal('캠퍼스 소식', '새 학기 안내', `<p>동국대학교 대학원 전공 탐험 RPG에 오신 것을 환영합니다.</p><p>일곱 전공의 학관에서 연구 주제를 알아보고, 네 지역의 학습 미션과 분기형 이야기를 경험하세요.</p><p class="help">이 게임의 학습 콘텐츠는 탐험용 예시이며 실제 대학원 모집 요강을 대체하지 않습니다.</p>`); if (l === '우편') {
        const e = openModal('새로운 편지', '대학원 행정실에서', `<p>새내기 연구자님, 입학을 축하합니다.<br>배움의 여정에 작은 선물을 보냅니다.</p><div class="reward">입학 축하 연구 키트 · 경험치 20</div>`);
        e.append(button(state.completed.includes('mail') ? '수령 완료' : '선물 받기', () => reward('mail', 20, '입학 축하 연구 키트')));
    } });
    const act = () => nearest ? interact(nearest) : toast('NPC나 학관 입구 가까이에서 대화해 보세요.');
    hud.querySelector('#interact').addEventListener('click', act);
    hud.querySelector('#main-action').addEventListener('click', act);
    hud.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => { chatTab = b.dataset.chat; hud.querySelectorAll('[data-chat]').forEach(n => n.classList.remove('active')); b.classList.add('active'); toast(chatTab + ' 채널 · 로컬 시뮬레이션'); });
    const send = () => { const i = hud.querySelector('#chatinput'); if (!i.value.trim())
        return; const line = document.createElement('div'); line.textContent = `[나 · ${chatTab}] ${i.value.slice(0, 120)}`; hud.querySelector('#messages').append(line); i.value = ''; line.scrollIntoView({ block: 'nearest' }); };
    hud.querySelector('#sendchat').addEventListener('click', send);
    hud.querySelector('#chatinput').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter')
        send(); });
    const j = hud.querySelector('.joystick'), stick = j.querySelector('.stick');
    const update = (e) => { const r = j.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width * .35), dy = (e.clientY - r.top - r.height / 2) / (r.height * .35); const len = Math.max(1, Math.hypot(dx, dy)); joy = { x: dx / len, y: dy / len }; stick.style.transform = `translate(${joy.x * 25}px,${joy.y * 25}px)`; target = null; };
    j.onpointerdown = e => { j.setPointerCapture(e.pointerId); update(e); };
    j.onpointermove = e => { if (j.hasPointerCapture(e.pointerId))
        update(e); };
    j.onlostpointercapture = j.onpointerup = j.onpointercancel = () => { joy = { x: 0, y: 0 }; stick.style.transform = ''; };
}
function escapeHTML(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const ground = document.createElement('canvas');
ground.width = 1100;
ground.height = 2100;
const gc = ground.getContext('2d');
function buildGround() {
    gc.fillStyle = '#839266';
    gc.fillRect(0, 0, 1100, 2100);
    for (let i = 0; i < 16000; i++) {
        const x = rng(i) * 1100, y = rng(i + 400) * 2100;
        gc.fillStyle = ['#b5b883', '#6f8759', '#d0c48a', '#557447'][i % 4];
        gc.fillRect(x, y, 2 + rng(i + 5) * 3, 2);
    }
    gc.fillStyle = '#cebe9b';
    gc.beginPath();
    gc.moveTo(430, 0);
    gc.lineTo(660, 0);
    gc.lineTo(690, 650);
    gc.lineTo(1010, 850);
    gc.lineTo(1010, 1420);
    gc.lineTo(685, 1600);
    gc.lineTo(680, 2100);
    gc.lineTo(405, 2100);
    gc.lineTo(400, 1550);
    gc.lineTo(100, 1450);
    gc.lineTo(100, 800);
    gc.lineTo(410, 650);
    gc.closePath();
    gc.fill();
    for (let y = 0; y < 2100; y += 24) {
        for (let x = 0; x < 1100; x += 40) {
            const xx = x + (Math.floor(y / 24) % 2) * 20;
            const path = (Math.abs(xx - 550) < 140 || y > 640 && y < 1510 && xx > 100 && xx < 1010);
            if (!path)
                continue;
            gc.fillStyle = ['#c8b596', '#d4c3a5', '#ddcbb0', '#bfae90', '#d0bea2'][Math.floor(rng(x + y) * 5)];
            gc.strokeStyle = '#ae9c7d';
            gc.lineWidth = .7;
            gc.beginPath();
            gc.roundRect(xx + 1, y + 1, 38, 22, 3);
            gc.fill();
            gc.stroke();
        }
    }
    gc.fillStyle = '#536d50';
    gc.beginPath();
    gc.ellipse(670, 1700, 340, 183, -.08, 0, Math.PI * 2);
    gc.fill();
    gc.strokeStyle = '#9a9c7b';
    gc.lineWidth = 22;
    gc.stroke();
    const water = gc.createLinearGradient(0, 1540, 0, 1900);
    water.addColorStop(0, '#2c7c80');
    water.addColorStop(.5, '#338c91');
    water.addColorStop(1, '#174d60');
    gc.fillStyle = water;
    gc.beginPath();
    gc.ellipse(670, 1700, 323, 165, -.08, 0, Math.PI * 2);
    gc.fill();
    for (let i = 0; i < 150; i++) {
        const x = 370 + rng(i) * 590, y = 1550 + rng(i + 2) * 290;
        if (((x - 670) / 310) ** 2 + ((y - 1700) / 150) ** 2 > 1)
            continue;
        gc.strokeStyle = '#9ee6cd66';
        gc.lineWidth = 1;
        gc.beginPath();
        gc.moveTo(x, y);
        gc.lineTo(x + 6 + rng(i + 4) * 20, y);
        gc.stroke();
    }
    for (let i = 0; i < 18; i++) {
        const x = 420 + rng(i + 900) * 440, y = 1580 + rng(i + 450) * 200;
        gc.fillStyle = '#80ac4a';
        gc.beginPath();
        gc.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2);
        gc.fill();
        flower(gc, x + 2, y - 5, 5, '#f5add0');
    }
    for (let i = 0; i < 750; i++) {
        const x = rng(i + 93) * 1100, y = 250 + rng(i + 87) * 1750;
        const edge = x < 110 || x > 990 || ((x < 370 || x > 740) && y > 1500) || ((x < 110 || x > 990) && y > 600);
        if (edge) {
            gc.fillStyle = '#516f39';
            gc.beginPath();
            gc.ellipse(x, y + 5, 10, 5, 0, 0, Math.PI * 2);
            gc.fill();
            flower(gc, x, y, 3 + rng(i) * 3, ['#f5d97b', '#f2a8be', '#fff0d8'][i % 3]);
        }
    }
}
function flower(c, x, y, r, color) { c.fillStyle = color; for (let a = 0; a < 5; a++) {
    c.beginPath();
    c.ellipse(x + Math.cos(a * 1.256) * r * .6, y + Math.sin(a * 1.256) * r * .6, r * .6, r * .4, a * 1.256, 0, Math.PI * 2);
    c.fill();
} c.fillStyle = '#f4c768'; c.beginPath(); c.arc(x, y, r * .24, 0, 7); c.fill(); }
function drawImage(asset, x, y, w, h, flip = false) { const im = images[asset]; if (!im)
    return; ctx.save(); ctx.translate(x, y); if (flip)
    ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore(); }
function plaque(text, x, y, w) { ctx.save(); ctx.shadowColor = '#0009'; ctx.shadowBlur = 6; ctx.fillStyle = '#473321'; ctx.strokeStyle = '#d0ad68'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - w / 2 + 10, y); ctx.lineTo(x + w / 2 - 10, y); ctx.lineTo(x + w / 2, y + 10); ctx.lineTo(x + w / 2 - 3, y + 31); ctx.lineTo(x + w / 2 - 10, y + 39); ctx.lineTo(x - w / 2 + 10, y + 39); ctx.lineTo(x - w / 2, y + 29); ctx.lineTo(x - w / 2, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.strokeStyle = '#92713d'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#ffe7a7'; ctx.font = `700 ${text.length > 12 ? 14 : text.length > 8 ? 16 : 20}px "Noto Serif KR",serif`; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 26); ctx.fillStyle = '#d5af59'; ctx.font = '13px serif'; ctx.fillText('❖', x - w / 2 + 12, y + 25); ctx.fillText('❖', x + w / 2 - 12, y + 25); ctx.restore(); }
function portal(x, y) { ctx.save(); const g = ctx.createRadialGradient(x, y, 2, x, y, 45); g.addColorStop(0, '#fbdeffcc'); g.addColorStop(.35, '#c58cfe88'); g.addColorStop(1, '#8158f000'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 47, 16, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#d5adfcaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 32 + Math.sin(time * 2) * 4, 10, 0, 0, 7); ctx.stroke(); for (let i = 0; i < 6; i++) {
    const yy = (time * 26 + i * 13) % 80;
    ctx.globalAlpha = (1 - yy / 80) * .8;
    ctx.fillStyle = '#e5c3ff';
    ctx.fillRect(x + Math.sin(i * 23 + time) * 24, y - yy, 2, 5);
} ctx.restore(); }
function lantern(x, y) { ctx.save(); const g = ctx.createRadialGradient(x, y - 52, 0, x, y - 52, 32); g.addColorStop(0, '#ffdd7955'); g.addColorStop(1, '#ffc96200'); ctx.fillStyle = g; ctx.fillRect(x - 35, y - 87, 70, 70); ctx.fillStyle = '#55422d'; ctx.fillRect(x - 3, y - 60, 6, 61); ctx.fillStyle = '#e5cf96'; ctx.fillRect(x - 9, y - 3, 18, 5); ctx.fillStyle = '#ffdc87'; ctx.fillRect(x - 10, y - 66, 20, 26); ctx.strokeStyle = '#76542d'; ctx.lineWidth = 3; ctx.strokeRect(x - 10, y - 66, 20, 26); ctx.beginPath(); ctx.moveTo(x - 14, y - 66); ctx.lineTo(x, y - 77); ctx.lineTo(x + 14, y - 66); ctx.fillStyle = '#665138'; ctx.fill(); ctx.restore(); }
function drawObj(o) { if (['clue', 'chest', 'enemy'].includes(o.kind)) {
    ctx.save();
    ctx.fillStyle = o.kind === 'enemy' ? '#90393c55' : '#f4d36a55';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.w * .4, 12, 0, 0, 7);
    ctx.fill();
    drawImage(o.asset, o.x, o.y + Math.sin(time * 2) * 3, o.w, o.h);
    ctx.font = 'bold 12px \"Noto Sans KR\"';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2d2a24';
    ctx.fillStyle = o.kind === 'enemy' ? '#ffd4b6' : '#ffeb9e';
    ctx.strokeText(o.label, o.x, o.y - o.h - 12);
    ctx.fillText(o.label, o.x, o.y - o.h - 12);
    ctx.restore();
    return;
} if (o.kind === 'building' || o.kind === 'gate' || o.kind === 'stage') {
    ctx.fillStyle = '#403a2b33';
    ctx.beginPath();
    ctx.ellipse(o.x + 18, o.y - 8, o.w * .42, 28, 0, 0, 7);
    ctx.fill();
    drawImage(o.asset, o.x, o.y, o.w, o.h);
    if (o.kind === 'building')
        portal(o.x, o.y - 25);
    plaque(o.label, o.x, o.y - o.h * .55, Math.min(o.w * .7, Math.max(150, o.label.length * 23)));
    if (o.kind === 'building') {
        lantern(o.x - o.w * .36, o.y - 30);
        lantern(o.x + o.w * .36, o.y - 30);
    }
}
else if (o.kind === 'npc') {
    const bounce = Math.sin(time * 2 + o.id) * 1.5;
    ctx.fillStyle = '#34312a44';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, 22, 7, 0, 0, 7);
    ctx.fill();
    ctx.save();
    if (o.id > 2)
        ctx.filter = `hue-rotate(${o.id * 35}deg)`;
    drawImage(o.asset, o.x, o.y + bounce, o.w, o.h, o.id % 3 === 0);
    ctx.restore();
    ctx.font = '12px "Noto Sans KR"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff4d9';
    ctx.strokeStyle = '#322a22';
    ctx.lineWidth = 4;
    ctx.strokeText(o.label, o.x, o.y + 16);
    ctx.fillText(o.label, o.x, o.y + 16);
    if (o.id < 3) {
        ctx.font = '9px \"Noto Sans KR\"';
        ctx.fillStyle = '#f6e0a9';
        ctx.fillText(npcActivity(o.npcId || `npc-${state.region}-${o.id % 3}`), o.x, o.y + 29);
    }
    ctx.fillStyle = o.id % 2 ? '#fffae6' : '#fff2a6';
    ctx.beginPath();
    ctx.arc(o.x, o.y - o.h - 13 + Math.sin(time * 3) * 3, 13, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#bb7c32';
    ctx.font = 'bold 21px serif';
    ctx.fillText(o.id % 2 ? '···' : '!', o.x, o.y - o.h - 6 + Math.sin(time * 3) * 3);
}
else
    drawImage(o.asset, o.x, o.y, o.w, o.h); }
function drawPlayer() { const bob = walk ? Math.sin(time * 15) * 3 : Math.sin(time * 2) * .7; ctx.save(); ctx.fillStyle = '#30241f66'; ctx.beginPath(); ctx.ellipse(px, py + 1, 27, 9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#f7df91aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 1, 32, 12, 0, 0, 7); ctx.stroke(); if (keys.has('w') || keys.has('ArrowUp') || joy.y < -.2)
    ctx.filter = 'brightness(.89)'; drawImage('player', px, py + bob, 82, 96, facing < 0); ctx.restore(); ctx.font = 'bold 14px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#383329'; ctx.fillStyle = '#fff6df'; ctx.strokeText(state.name, px, py - 115); ctx.fillText(state.name, px, py - 115); ctx.font = '11px "Noto Sans KR"'; ctx.fillStyle = '#f0d58a'; ctx.fillText('❧ ' + (state.major >= 0 ? majors[state.major].name + ' 연구자' : '예비 연구자') + ' ❧', px, py - 98); }
function drawPlaza() { ctx.save(); ctx.translate(550, 1105); ctx.scale(1, .68); ctx.fillStyle = state.region === 3 ? '#698f98' : '#e5cfad'; ctx.beginPath(); ctx.arc(0, 0, 133, 0, 7); ctx.fill(); for (const [r, w, col] of [[133, 5, '#9f8c6f'], [119, 2, '#fff0d0'], [105, 3, '#b49b72'], [84, 2, '#bfaa87']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 7);
    ctx.stroke();
} for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    ctx.strokeStyle = '#b9a078';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 106, Math.sin(a) * 106);
    ctx.lineTo(Math.cos(a) * 132, Math.sin(a) * 132);
    ctx.stroke();
} ctx.fillStyle = '#d9a85c'; ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 2; for (let i = 0; i < 7; i++) {
    ctx.save();
    ctx.rotate((i - 3) * .35);
    ctx.scale(.42, 1);
    ctx.beginPath();
    ctx.moveTo(0, 38);
    ctx.bezierCurveTo(-48, 9, -26, -26, 0, -58);
    ctx.bezierCurveTo(26, -26, 48, 9, 0, 38);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
} ctx.restore(); }
function drawFlags() { for (let i = 0; i < 7; i++) {
    const x = 325 + i * 75, y = state.region === 3 ? 785 : 1910;
    ctx.strokeStyle = '#6c4930';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 140);
    ctx.stroke();
    const col = (director.state?.world.counters.evidence || 0) > (director.state?.world.counters.collaboration || 0) ? '#5a63a4' : state.festival === 1 ? '#5a63a4' : state.festival === 2 ? '#59977c' : ['#b35d82', '#d68b45', '#7970ae', '#5e9fa0'][i % 4];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 135);
    ctx.lineTo(x + 40, y - 130 + Math.sin(time + i) * 3);
    ctx.lineTo(x + 40, y - 58);
    ctx.lineTo(x + 23, y - 70);
    ctx.lineTo(x + 4, y - 60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e4c175';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f7df91';
    ctx.font = '22px serif';
    ctx.fillText('❖', x + 22, y - 95);
} }
function miniMap() { const c = hud.querySelector('#mini'); if (!c)
    return; const g = c.getContext('2d'); g.clearRect(0, 0, 180, 150); g.fillStyle = '#6f8453'; g.fillRect(0, 0, 180, 150); g.fillStyle = '#cbb78b'; g.fillRect(75, 0, 30, 150); g.fillRect(23, 56, 140, 46); g.fillStyle = '#4e9ca4'; g.beginPath(); g.ellipse(110, 122, 50, 14, 0, 0, 7); g.fill(); objects.forEach(o => { const x = o.x / 1100 * 180, y = o.y / 2100 * 150; if (o.kind === 'building' || o.kind === 'gate') {
    g.fillStyle = '#493a2b';
    g.fillRect(x - 12, y - 12, 24, 12);
    g.fillStyle = '#c1aa68';
    g.fillRect(x - 10, y - 10, 20, 3);
}
else if (['clue', 'chest', 'enemy'].includes(o.kind)) {
    g.fillStyle = o.kind === 'enemy' ? '#df6558' : '#ffe298';
    g.beginPath();
    g.arc(x, y, 3, 0, 7);
    g.fill();
}
else if (o.kind === 'npc') {
    g.fillStyle = '#e9c251';
    g.fillRect(x - 1, y - 1, 3, 3);
}
else if (o.kind === 'tree') {
    g.fillStyle = o.asset === 'cherry' ? '#e6a0bc' : '#9aaa6c';
    g.beginPath();
    g.arc(x, y - 5, 6, 0, 7);
    g.fill();
} }); g.strokeStyle = '#fbe7b466'; g.strokeRect((camX - 768 / zoom) / 1100 * 180, (camY - 432 / zoom) / 2100 * 150, 1536 / zoom / 1100 * 180, 864 / zoom / 2100 * 150); g.fillStyle = '#ffed8d'; g.strokeStyle = '#6b491e'; g.lineWidth = 2; const x = px / 1100 * 180, y = py / 2100 * 150; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill(); g.stroke(); }
function blocked(x, y) { if (x < 120 || x > 980 || y < 280 || y > 1980)
    return true; if (((x - 670) / 310) ** 2 + ((y - 1700) / 145) ** 2 < 1 && !(x > 425 && x < 675 && y < 1680))
    return true; return objects.some(o => { if (!o.solid)
    return false; if (o.kind === 'tree')
    return Math.abs(x - o.x) < o.w * .14 && Math.abs(y - o.y + 15) < 20; if (o.kind === 'gate')
    return Math.abs(x - o.x) > 85 && Math.abs(x - o.x) < o.w * .4 && y < o.y - 30 && y > o.y - 135; return Math.abs(x - o.x) < o.w * .37 && y > o.y - o.h * .38 && y < o.y - 35; }); }
function frame(now) {
    if(document.hidden){last=now;requestAnimationFrame(frame);return;}
    if(now-dguLastFramePaint<dguTargetFrameMs){requestAnimationFrame(frame);return;}
    dguLastFramePaint=now;
    const dt = Math.min(.05, (now - last) / 1000 || .016);
    last = now;
    time = now / 1000;
    walk = false;
    if (!modalOpen) {
        let dx = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
        let dy = (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) + joy.y;
        if (dx || dy)
            target = null;
        if (target && !dx && !dy) {
            const dist = Math.hypot(target.x - px, target.y - py);
            if (dist < 8)
                target = null;
            else {
                dx = (target.x - px) / dist;
                dy = (target.y - py) / dist;
            }
        }
        const len = Math.hypot(dx, dy);
        if (len > .01) {
            dx /= Math.max(1, len);
            dy /= Math.max(1, len);
            const nx = px + dx * 205 * dt, ny = py + dy * 205 * dt;
            if (!blocked(nx, py))
                px = nx;
            if (!blocked(px, ny))
                py = ny;
            walk = true;
            if (dx)
                facing = dx > 0 ? 1 : -1;
        }
    }
    camX += (Math.max(548, Math.min(552, px)) - camX) * dt * 4;
    camY += (Math.max(335, Math.min(1760, py)) - camY) * dt * 4;
    for (const o of objects) {
        if (o.kind === 'npc' && !modalOpen) {
            const nx = o.baseX + Math.sin(time * .35 + o.id) * 15, ny = o.baseY + Math.cos(time * .3 + o.id) * 10;
            if (!blocked(nx, ny)) {
                o.x = nx;
                o.y = ny;
            }
        }
    }
    ctx.clearRect(0, 0, 1536, 864);
    ctx.save();
    ctx.translate(768 - camX * zoom, 432 - camY * zoom);
    ctx.scale(zoom, zoom);
    ctx.drawImage(ground, 0, 0);
    drawPlaza();
    if (state.region === 3 || state.region === 0)
        drawFlags();
    if (questGuide) {
        ctx.strokeStyle = '#ffe29a99';
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 18]);
        ctx.lineDashOffset = -time * 20;
        ctx.beginPath();
        ctx.moveTo(px, py);
        const guide = objects.find(o => o.npcId === `npc-ad-${state.major}-${director.adventure.hero() ? currentChapter(director.adventure.hero()).contact : 0}` && !director.adventure.hero()?.contact) || objects.find(o => o.kind === 'clue') || objects.find(o => o.kind === 'enemy') || objects.find(o => o.npcId);
        ctx.lineTo(guide?.x || 470, guide?.y || 940);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    const sorted = [...objects, { kind: 'player', x: px, y: py, w: 0, h: 0, asset: '' }].sort((a, b) => a.y - b.y);
    sorted.forEach(o => o.kind === 'player' ? drawPlayer() : drawObj(o));
    if (state.region === 3 && (state.festival >= 0 || (director.state?.world.counters.festival || 0) > 0)) {
        for (let i = 0; i < 30; i++) {
            const x = 240 + rng(i) * 620, y = 570 + ((time * 25 + rng(i + 2) * 350) % 380);
            ctx.fillStyle = ['#e7bd60', '#d881a2', '#94b7c0'][i % 3];
            ctx.fillRect(x, y, 4, 7);
        }
    }
    ctx.restore();
    const light = ctx.createLinearGradient(0, 0, 1536, 864);
    light.addColorStop(0, '#ffe7ad18');
    light.addColorStop(.55, '#ffe9c300');
    light.addColorStop(1, '#102c2620');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 1536, 864);
    for (let i = 0; i < 30; i++) {
        const x = (rng(i) * 1560 + time * (10 + rng(i + 4) * 15)) % 1560 - 20, y = (rng(i + 30) * 900 + time * (20 + rng(i) * 20)) % 900 - 20;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time + i);
        ctx.fillStyle = i % 2 ? '#ffdfedaa' : '#fff1e4aa';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 6, 0, 0, 7);
        ctx.fill();
        ctx.restore();
    }
    nearest = objects.filter(o => ['building', 'gate', 'npc', 'fountain', 'stage', 'clue', 'chest', 'enemy'].includes(o.kind)).sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    if (nearest && Math.hypot(nearest.x - px, nearest.y - py) > 180)
        nearest = undefined;
    const btn = hud.querySelector('#interact');
    if (btn) {
        btn.style.display = nearest ? 'block' : 'none';
        btn.textContent = '✦ ' + (nearest?.label || '분수에서 쉬기') + '　E';
    }
    if (Math.floor(now / 120) !== Math.floor((now - dt * 1000) / 120))
        miniMap();
    requestAnimationFrame(frame);
}
canvas.addEventListener('pointerdown', e => { if (modalOpen)
    return; const r = canvas.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * 1536, sy = (e.clientY - r.top) / r.height * 864; const x = (sx - 768) / zoom + camX, y = (sy - 432) / zoom + camY; const hit = [...objects].sort((a, b) => b.y - a.y).find(o => ['building', 'gate', 'npc', 'stage', 'fountain', 'clue', 'chest', 'enemy'].includes(o.kind) && x > o.x - o.w * .45 && x < o.x + o.w * .45 && y > o.y - o.h * .85 && y < o.y + 20); if (hit) {
    interact(hit);
    return;
} target = { x, y }; });
window.addEventListener('keydown', e => { if (e.target.matches('input,textarea'))
    return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key))
    e.preventDefault(); keys.add(e.key); if (e.key.toLowerCase() === 'e' && nearest && !modalOpen)
    interact(nearest); if (e.key.toLowerCase() === 'm' && !modalOpen)
    worldMap(); if (e.key === 'Escape')
    closeModal(); });
window.addEventListener('keyup', e => keys.delete(e.key));
window.addEventListener('blur', () => { keys.clear(); joy = { x: 0, y: 0 }; });
Promise.all(['library', 'school', 'gate', 'cherry', 'tree', 'bridge', 'player', 'professor', 'fountain', 'inkfox', 'echo-spirit', 'paper-dragon', 'mirror-knight', 'silence-wisp', 'knot-guardian', 'bronze-guardian', 'quest-scroll', 'treasure'].map(key => new Promise((res, rej) => { const im = new Image(); im.onload = () => { images[key] = im; res(); }; im.onerror = () => { console.warn('RPG asset unavailable:', key); res(); }; im.src = './assets/' + key + '.png'; }))).then(() => { buildGround(); setupMap(); renderHUD(); void director.init(); document.querySelector('#loading').remove(); mobileShell.ready(); requestAnimationFrame(frame); setTimeout(() => toast('벚꽃이 핀 캠퍼스에 오신 것을 환영해요. 학관을 눌러 전공을 만나보세요.'), 800); }).catch(() => { document.querySelector('#loading').innerHTML = '<div>캠퍼스를 불러오지 못했어요.<br><button onclick="location.reload()">다시 불러오기</button></div>'; });
Object.assign(window, { __rpg: { getState: () => structuredClone(state), getPosition: () => ({ x: px, y: py }), getCamera: () => ({ x: camX, y: camY, zoom }), getObjects: () => objects, changeRegion, quiz, blocked, director, openStory: () => director.hub() } });
