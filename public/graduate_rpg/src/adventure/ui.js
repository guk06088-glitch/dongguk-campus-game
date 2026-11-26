import { majorNames } from '../narrative/knowledge.js';
import { campaigns, campaignNPCs } from './campaigns.js';
import { chapterReady, currentChapter, enemyIntent, equipped, fieldObjects, maxHp, skillCosts } from './engine.js';
import { locationNames } from '../narrative/core.js';
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class AdventureUI {
    hooks;
    busy = false;
    constructor(hooks) {
        this.hooks = hooks;
    }
    hero() { return this.hooks.state()?.adventure?.heroes[this.hooks.major()]; }
    async open() { try {
        await this.hooks.request({ action: 'bootstrap' });
        if (this.hooks.major() < 0) {
            this.select();
            return;
        }
        this.chapter();
    }
    catch (e) {
        this.error(e);
    } }
    select() { const root = this.hooks.open('일곱 전공, 일곱 개의 모험', '이번에는 어떤 이야기의 주인공이 될까요?', `<p>한 세계 안에서 서로 다른 인물과 사건을 만납니다. 다른 전공을 골라도 이전 모험과 장비는 남습니다.</p><div class="campaign-grid"></div>`); const grid = root.querySelector('.campaign-grid'); campaigns.forEach(c => { const button = this.hooks.button(`<img src="./assets/${c.enemyArt}.png" alt=""><span class="campaign-genre">${c.genre}</span><b>${c.title}</b><small>${majorNames[c.major]} · ${c.role}</small><span>${esc(c.hook)}</span>`, () => void (async () => { this.hooks.select(c.major); await this.open(); })(), 'campaign-card'); button.style.setProperty('--campaign-color', c.color); grid.append(button); }); }
    header(h) { const c = campaigns[h.major]; return `<div class="adventure-status"><img src="./assets/player.png" alt="모험가"><div><b>${c.role} · Lv.${h.level}</b><div class="adventure-hp"><i style="width:${h.hp / maxHp(h) * 100}%"></i><span>HP ${h.hp}/${maxHp(h)}</span></div><div class="adventure-sp"><i style="width:${h.sp / 30 * 100}%"></i><span>SP ${h.sp}/30</span></div></div><small>금화 ${h.gold}<br>회복약 ${h.potions}<br>${esc(equipped(h).name)}</small></div>`; }
    chapter() {
        const h = this.hero();
        if (!h) {
            void this.open();
            return;
        }
        const c = campaigns[h.major], ch = currentChapter(h);
        if (h.finished) {
            this.ending();
            return;
        }
        const root = this.hooks.open(ch.title, `${c.title} · 제${h.chapter + 1}장 / 4 · ${c.genre}`, `${this.header(h)}<div class="adventure-scene"><div class="chapter-art"><img src="./assets/${c.enemyArt}.png" alt="${c.enemy}"></div><div><p>${esc(ch.intro)}</p><div class="story-quote">${ch.lines.map(esc).join('<br>')}</div></div></div><ul class="adventure-goals"><li class="${h.contact ? 'done' : ''}">${h.contact ? '✓' : '◇'} ${c.npcNames[ch.contact]}와 이야기하기 · ${locationNames[ch.region]}</li>${ch.fields.map(f => `<li class="${h.found.includes(f.id) ? 'done' : ''}">${h.found.includes(f.id) ? '✓' : '◇'} ${f.label}</li>`).join('')}${ch.challenge ? `<li class="${h.puzzleSolved ? 'done' : ''}">${h.puzzleSolved ? '✓' : '◇'} ${ch.challenge.title}</li>` : ''}${ch.boss ? `<li class="${h.bossWon ? 'done' : ''}">${h.bossWon ? '✓' : '◇'} ${c.enemy} 대면</li>` : ''}</ul><div class="reward">전리품 · ${ch.reward}　|　경험치 ${65 + h.chapter * 15} · 금화 25<br>모든 인물과 사건은 게임 속 허구입니다.</div>`);
        if (!h.accepted)
            root.append(this.hooks.button('이 모험을 시작한다', () => void this.action({ command: 'accept' }), 'option primary'));
        else if (!chapterReady(h)) {
            root.append(this.hooks.button(`현장으로 이동 · ${locationNames[ch.region]}`, () => { this.hooks.travel(ch.region); this.hooks.toast(`${c.npcNames[ch.contact]}와 빛나는 흔적을 찾아보세요.`); }, 'option primary'));
            if (ch.challenge && h.contact && !h.puzzleSolved)
                root.append(this.hooks.button(ch.challenge.title + ' 시작', () => this.challenge()));
            if (ch.boss && !h.bossWon)
                root.append(this.hooks.button('적의 상태와 전투 준비 보기', () => this.battle()));
        }
        if (chapterReady(h)) {
            root.insertAdjacentHTML('beforeend', '<h3>이제 당신이 이야기를 결정합니다.</h3>');
            if (ch.choices.length)
                ch.choices.forEach(v => root.append(this.hooks.button(esc(v.label), () => void this.action({ command: 'choose', target: v.id }), 'option primary')));
            else
                root.append(this.hooks.button('동료와 다음 장으로', () => void this.action({ command: 'complete' }), 'option primary'));
        }
        root.append(this.hooks.button('장비 · 회복 · 보급', () => this.gear()));
        root.append(this.hooks.button('다른 전공의 모험 선택', () => this.select()));
        root.append(this.hooks.button('선택 기록과 이전 연구 일지', this.hooks.journal));
    }
    async action(a, returnTo = 'chapter') { if (this.busy)
        return; this.busy = true; try {
        const res = await this.hooks.request({ action: 'adventure', adventure: { ...a, ...(a.command === 'field' ? { position: this.hooks.position() } : {}) } });
        if (res.message)
            this.hooks.toast(res.message);
        if (returnTo === 'chapter')
            this.chapter();
        if (returnTo === 'challenge')
            this.challenge();
        if (returnTo === 'battle')
            this.battle();
        if (returnTo === 'gear')
            this.gear();
    }
    catch (e) {
        this.error(e);
    }
    finally {
        this.busy = false;
    } }
    error(e) { this.hooks.toast(e instanceof Error ? e.message : '이야기를 이어가지 못했습니다. 다시 시도해 주세요.'); }
    challenge() {
        const h = this.hero();
        if (!h)
            return;
        const ch = currentChapter(h), p = ch.challenge;
        if (!p) {
            this.chapter();
            return;
        }
        if (!h.contact) {
            this.hooks.toast('먼저 현장의 동료에게 상황을 들으세요.');
            this.chapter();
            return;
        }
        if (h.puzzleSolved) {
            this.chapter();
            return;
        }
        const root = this.hooks.open(p.title, `${campaigns[h.major].title} · 직접 풀어 가는 모험`, `<p>${esc(p.prompt)}</p><div class="activity-progress"></div><div class="activity-board"></div><div class="activity-feedback" aria-live="polite"></div>`);
        const board = root.querySelector('.activity-board'), progress = root.querySelector('.activity-progress');
        const pick = (value) => void this.action({ command: 'puzzle', value }, 'challenge');
        if (p.kind === 'negotiate') {
            progress.textContent = `남은 상자 ${8 - h.allocation.reduce((a, b) => a + b, 0)} / 8`;
            p.pieces.forEach((v, i) => { const row = document.createElement('div'); row.className = 'allocation-row'; row.innerHTML = `<b>${v}</b><strong>${h.allocation[i]}</strong>`; row.append(this.hooks.button('−', () => pick(i + '-'), 'allocation-button'), this.hooks.button('+', () => pick(i + '+'), 'allocation-button')); board.append(row); });
            root.append(this.hooks.button('세 진영에 배분안을 제시한다', () => pick('submit'), 'option primary'));
        }
        else if (p.kind === 'pillars') {
            progress.textContent = '문에 새겨진 방향 · 동 →　서 ←　남 ↓';
            board.classList.add('pillar-board');
            p.pieces.forEach((v, i) => board.append(this.hooks.button(`<small>${v}</small><strong>${['↑', '→', '↓', '←'][h.pillars[i]]}</strong>`, () => pick(i), 'pillar-button')));
            root.append(this.hooks.button('연꽃문을 연다', () => pick('submit'), 'option primary'));
        }
        else if (p.kind === 'evidence') {
            progress.textContent = `연결한 증거 ${h.matched.length / 2} / 3`;
            board.classList.add('evidence-board');
            p.pieces.forEach((v, i) => { const b = this.hooks.button(`${h.matched.includes(i) ? '✓ ' : ''}${esc(v)}`, () => pick(i), 'evidence-card' + (h.input.includes(i) ? ' selected' : '') + (h.matched.includes(i) ? ' matched' : '')); b.disabled = h.matched.includes(i); board.append(b); });
        }
        else if (['compose', 'dialogue', 'route'].includes(p.kind)) {
            const step = h.input.length;
            progress.textContent = `장면 ${step + 1} / 3${p.kind === 'route' ? ' · 동료 HP ' + h.partyHp : ''}`;
            if (p.kind === 'dialogue')
                root.querySelector('.activity-feedback').textContent = p.extra?.[step] || '';
            p.pieces.slice(step * 2, step * 2 + 2).forEach((v, i) => board.append(this.hooks.button(`${esc(v)}${p.kind === 'route' ? `<small>${esc(p.extra?.[step * 2 + i] || '')}</small>` : ''}`, () => pick(step * 2 + i), 'scene-choice')));
            if (h.input.length)
                progress.insertAdjacentHTML('beforeend', `<p>${h.input.map(i => esc(p.pieces[i])).join(' → ')}</p>`);
        }
        else {
            progress.textContent = `${h.input.length} / ${p.solution.length} · ${h.input.map(i => p.pieces[i]).join(' → ')}`;
            board.classList.add(p.kind === 'order' ? 'wood-board' : 'sound-board');
            p.pieces.forEach((v, i) => { const b = this.hooks.button(esc(v), () => { if (navigator.vibrate)
                navigator.vibrate(20); this.note(i); pick(i); }, p.kind === 'order' ? 'wood-piece' : 'sound-pad'); if (p.kind === 'order' && h.input.includes(i))
                b.disabled = true; board.append(b); });
            if (p.kind === 'echo' || p.kind === 'rhythm')
                root.append(this.hooks.button('봉인 신호 들어보기', () => { p.solution.forEach((v, i) => setTimeout(() => { if (root.isConnected)
                    this.note(v); }, i * 440)); }));
        }
        root.append(this.hooks.button('나중에 이어서 하기', () => this.chapter()));
    }
    note(i) { try {
        const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
        o.connect(g);
        g.connect(a.destination);
        o.type = 'sine';
        o.frequency.value = [523, 392, 261][i % 3];
        g.gain.setValueAtTime(.045, a.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .18);
        o.start();
        o.stop(a.currentTime + .2);
        o.onended = () => a.close();
    }
    catch { /* Visual input is always available. */ } }
    npc(id) { const n = campaignNPCs.find(n => n.id === id); if (!n)
        return; const h = this.hero(); if (!h)
        return; const c = campaigns[h.major], ch = currentChapter(h), slot = Number(id.split('-').at(-1)); const own = id === `npc-ad-${h.major}-${ch.contact}` && !h.finished; const voiced = h.finished ? h.ending : own ? ch.lines.join(' ') : c.npcVoices[slot][Math.min(2, Math.floor(h.chapter / 2))]; const root = this.hooks.open(n.name, n.job, `<div class="npc-head"><img src="./assets/${slot % 2 ? 'professor' : 'player'}.png" alt="${n.name}"><div><b>${n.name}</b><small>${n.personality}</small></div></div><p class="story-quote">${esc(voiced)}</p>${h.flags.includes('moon_scene') && h.major === 2 ? '<p>이안은 당신이 써 준 달빛 서가의 문장을 소중히 기억하고 있습니다.</p>' : ''}`); if (own && h.accepted && !h.contact)
        root.append(this.hooks.button('사정을 듣고 함께 길을 찾는다', () => void this.action({ command: 'npc', target: id }), 'option primary')); root.append(this.hooks.button('현재 모험과 남은 목표', () => this.chapter())); root.append(this.hooks.button('직접 말을 건다', () => this.hooks.chat(id))); }
    battle() {
        const h = this.hero();
        if (!h)
            return;
        const c = campaigns[h.major];
        const b = h.battle;
        const expedition = h.finished && h.expedition?.accepted;
        const enemyName = expedition ? `${c.enemy}의 잔향 ${h.expedition.id}` : c.enemy;
        const root = this.hooks.open(enemyName, '턴제 대결 · 적의 다음 행동을 보고 선택하세요', `${this.header(h)}<div class="battle-scene"><img class="battle-hero" src="./assets/player.png" alt="플레이어"><div class="versus">VS</div><img class="battle-enemy" src="./assets/${c.enemyArt}.png" alt="${c.enemy}"></div>${b ? `<div class="enemy-health"><i style="width:${b.enemyHp / b.maxEnemyHp * 100}%"></i><span>${enemyName} · HP ${b.enemyHp}/${b.maxEnemyHp}</span></div><p class="enemy-intent">${b.result === 'won' ? '대결을 마쳤습니다.' : b.result === 'lost' ? '동료가 안전한 곳으로 옮겼습니다.' : enemyIntent(h)}</p><div class="battle-log">${b.log.slice(-5).map(v => `<div>${esc(v)}</div>`).join('')}</div>` : `<p>${c.skillNote} 일반 공격은 SP +2, 방어는 SP +6입니다. 힘을 모으는 적을 방어하면 다음 공격이 강해집니다.</p>`}<div class="battle-actions"></div>`);
        root.closest('.modal').classList.add('battle-dialog');
        const actions = root.querySelector('.battle-actions');
        if (!b) {
            const region = expedition ? h.expedition.region : currentChapter(h).region;
            if (this.hooks.position().region !== region) {
                actions.append(this.hooks.button('적이 있는 지역으로 이동', () => this.hooks.travel(region), 'option primary'));
                return;
            }
            actions.append(this.hooks.button('대면한다', () => void this.action({ command: 'battle', value: 'begin' }, 'battle'), 'option primary'));
        }
        else if (!b.result) {
            [['attack', '일반 공격', 'SP +2'], ['skill', c.skill, `SP -${skillCosts[h.major]}`], ['guard', '방어', '피해 감소 · SP +6'], ['potion', '회복약', `HP +55 · ${h.potions}개`]].forEach(([id, title, sub]) => { const button = this.hooks.button(`<b>${title}</b><small>${sub}</small>`, () => void this.action({ command: 'battle', value: id }, 'battle'), 'battle-action'); button.disabled = id === 'skill' && h.sp < skillCosts[h.major] || id === 'potion' && h.potions === 0; actions.append(button); });
            if (h.major === 5 && h.flags.includes('peace') && h.flags.includes('inclusive'))
                root.append(this.hooks.button('세 진영의 공동 서약을 읽어 매듭을 푼다', () => void this.action({ command: 'battle', value: 'peace' }, 'battle'), 'option primary'));
            root.append(this.hooks.button('후퇴한다', () => void this.action({ command: 'battle', value: 'flee' })));
        }
        else if (b.result === 'won')
            root.append(this.hooks.button('동료와 마지막 선택을 나눈다', () => this.chapter(), 'option primary'));
        else
            root.append(this.hooks.button('여관에서 회복하고 다시 준비한다', () => void this.action({ command: 'rest' }, 'gear'), 'option primary'));
    }
    gear() { const h = this.hero(); if (!h) {
        void this.open();
        return;
    } const root = this.hooks.open('모험가의 장비와 보급', '공격력과 방어력은 실제 전투에 반영됩니다.', `${this.header(h)}<div class="gear-list">${h.gear.map(g => `<div class="gear-card"><b>${esc(g.name)}</b><span>공격 +${g.attack} · 방어 +${g.defense}</span><button data-equip="${g.id}">${h.equipped === g.id ? '장착 중' : '장착'}</button></div>`).join('')}</div>`); root.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => void this.action({ command: 'equip', target: b.dataset.equip }, 'gear')); root.append(this.hooks.button('여관에서 휴식 · 금화 10 / HP·SP 회복', () => void this.action({ command: 'rest' }, 'gear'))); root.append(this.hooks.button('회복약 구입 · 금화 15', () => void this.action({ command: 'buy' }, 'gear'))); root.append(this.hooks.button('모험으로 돌아가기', () => this.chapter(), 'option primary')); }
    ending() {
        const h = this.hero();
        if (!h)
            return;
        const c = campaigns[h.major], e = h.expedition;
        const objects = fieldObjects(h);
        const root = this.hooks.open(c.title + ' · 그 후', '당신의 선택으로 끝난 이야기, 다시 이어지는 인연', `${this.header(h)}<div class="ending-art"><img src="./assets/${c.enemyArt}.png" alt=""></div><p class="ending-text">${esc(h.ending)}</p><div class="adventure-history">${h.log.map(v => `<details><summary>${esc(v.chapter)} · ${esc(v.choice)}</summary><p>${esc(v.result)}</p></details>`).join('')}</div>${e?.accepted ? `<h3>후일담 ${e.id} · ${locationNames[e.region]}</h3><p>본편의 결말 이후 생긴 새 흔적 둘을 조사하고, 새롭게 나타난 잔향을 잠재우세요. 원래 사건은 다시 시작되지 않습니다.</p><p>흔적 ${e.found.length}/2 · 잔향 ${e.won ? '해결' : '미해결'}</p>` : ''}`);
        if (e?.accepted) {
            root.append(this.hooks.button('후일담 현장으로 이동', () => this.hooks.travel(objects.region), 'option primary'));
            if (e.found.length >= 2 && !e.won)
                root.append(this.hooks.button('새로운 잔향과 대면', () => this.battle()));
            if (e.won)
                root.append(this.hooks.button('후일담 해결과 전리품 받기', () => void this.action({ command: 'complete' }), 'option primary'));
        }
        else
            root.append(this.hooks.button('새로운 후일담 의뢰 받기', () => void this.action({ command: 'expedition' }), 'option primary'));
        root.append(this.hooks.button('다른 전공의 모험 만나기', () => this.select()));
        root.append(this.hooks.button('장비와 보급', () => this.gear()));
    }
    async field(id) { await this.action({ command: 'field', target: id }, 'none'); }
    async enemy() { await this.action({ command: 'battle', value: 'begin' }, 'battle'); }
}
