import { campaigns, campaignNPCs } from './campaigns.js';
import { record, relation } from '../narrative/core.js';
export const skillCosts = [8, 9, 8, 8, 8, 9, 12];
export function ensureAdventure(s, major = s.player.major) { if (!Number.isInteger(major) || major < 0 || major > 6)
    throw Error('먼저 전공과 모험가 역할을 선택해 주세요.'); s.adventure ??= { version: 1, heroes: {} }; let h = s.adventure.heroes[major]; if (!h) {
    const c = campaigns[major];
    h = s.adventure.heroes[major] = { major, chapter: 0, accepted: false, contact: false, found: [], input: [], matched: [], allocation: [0, 0, 0], pillars: [0, 0, 0], puzzleSolved: false, bossWon: false, hp: 120, sp: 30, gold: 30, potions: 3, xp: 0, level: 1, partyHp: 100, support: 0, flags: [], gear: [{ id: 'starter', name: c.weapon + ' · 수습', attack: 0, defense: 0 }], equipped: 'starter', finished: false, ending: '', log: [], cycle: 0 };
} return h; }
export const maxHp = (h) => 120 + (h.level - 1) * 12;
export const currentChapter = (h) => campaigns[h.major].chapters[Math.min(h.chapter, 3)];
export const equipped = (h) => h.gear.find(g => g.id === h.equipped) || h.gear[0];
export function chapterReady(h) { const c = currentChapter(h); return h.accepted && h.contact && c.fields.filter(f => !f.optional).every(f => h.found.includes(f.id)) && (!c.challenge || h.puzzleSolved) && (!c.boss || h.bossWon); }
export function fieldObjects(h) {
    const c = campaigns[h.major];
    if (h.finished) {
        const e = h.expedition;
        if (!e?.accepted)
            return { region: c.region, targets: [] };
        return { region: e.region, targets: [{ id: `echo-${e.id}-0`, label: `후일담 ${e.id} · 새로 열린 봉인`, x: 470, y: 1230, kind: 'clue', text: '앞선 결말 이후 새로운 물결이 이곳에 닿았다.' }, { id: `echo-${e.id}-1`, label: `후일담 ${e.id} · 동료의 전갈`, x: 640, y: 1440, kind: 'clue', text: `${c.companion}의 전갈이 새로운 흔적의 위치를 알려 준다.` }].filter(t => !e.found.includes(t.id)), enemy: e.found.length >= 2 && !e.won ? { id: `echo-enemy-${e.id}`, label: `${c.enemy}의 잔향 ${e.id}`, x: 620, y: 1260, asset: c.enemyArt } : undefined };
    }
    const ch = currentChapter(h);
    if (!h.accepted)
        return { region: ch.region, targets: [] };
    return { region: ch.region, targets: [...ch.fields, ...(h.found.includes('cache') ? [] : [{ id: 'cache', label: '길가의 작은 보물함', x: 650, y: 1355, kind: 'chest', text: '은화와 회복약을 발견했다.', optional: true }])].filter(f => !h.found.includes(f.id)), enemy: ch.boss && !h.bossWon ? { id: `boss-${h.major}`, label: c.enemy, x: 620, y: 1260, asset: c.enemyArt } : undefined };
}
export function heroStatus(s) { if (s.player.major < 0)
    return null; const h = ensureAdventure(s); const c = campaigns[h.major], chapter = currentChapter(h), objects = fieldObjects(h); return { hero: h, campaign: c, chapter, objects, ready: chapterReady(h), maxHp: maxHp(h), equipped: equipped(h) }; }
function addFlag(h, flag) { if (!h.flags.includes(flag))
    h.flags.push(flag); }
function receipt(s, h, id, xp, item) { const existing = s.receipts.find(r => r.id === id); if (existing)
    return existing; const r = { id, xp, major: h.major, research: 8, item }; s.receipts.push(r); s.stats.xp += xp; s.stats.research[h.major] += 8; s.stats.items.push(item); h.xp += xp; h.level = 1 + Math.floor(h.xp / 120); h.gold += 25; return r; }
function resetChapter(h) { h.accepted = false; h.contact = false; h.found = []; h.input = []; h.matched = []; h.allocation = [0, 0, 0]; h.pillars = [0, 0, 0]; h.puzzleSolved = false; h.bossWon = false; h.battle = undefined; }
function finish(s, h, selected) {
    const c = campaigns[h.major], ch = currentChapter(h);
    if (!chapterReady(h))
        throw Error('아직 마치지 않은 현장 목표가 있습니다.');
    let result = ch.resolution;
    if (ch.challenge?.kind === 'compose')
        result += ' 당신이 남긴 장면: ' + h.input.map(i => ch.challenge.pieces[i]).join(' ') + '.';
    let label = '동료와 다음 장으로 향했다';
    if (ch.choices.length) {
        const choice = ch.choices.find(c => c.id === selected);
        if (!choice)
            throw Error('이 장에서 가능한 선택을 골라 주세요.');
        addFlag(h, choice.flag);
        if (choice.flag === 'companion')
            h.support += 2;
        result = choice.result;
        label = choice.label;
    }
    const id = `adventure-${h.major}-${h.chapter}`;
    const r = receipt(s, h, id, 65 + h.chapter * 15, ch.reward);
    const witness = `npc-ad-${h.major}-${ch.contact}`;
    const rel = relation(s, witness);
    rel.affinity = Math.min(100, rel.affinity + 6);
    rel.trust = Math.min(100, rel.trust + 5);
    rel.known.push(id);
    rel.summary = result;
    s.world.facts[id] = result;
    s.world.hooks.push(`${c.title}: ${result}`);
    s.world.hooks = s.world.hooks.slice(-30);
    s.decisions.push({ id, title: ch.title, choice: label, result, day: s.day });
    record(s, { kind: 'adventure', questId: id, text: `${c.title} · ${ch.title}: ${result}`, npcIds: [witness], major: h.major, facts: [id], choice: selected || 'continue' });
    h.log.push({ chapter: ch.title, result, choice: label });
    if (h.chapter === 1) {
        h.gear.push({ id: `weapon-${h.major}`, name: ch.reward, attack: 5, defense: 0 });
        h.equipped = `weapon-${h.major}`;
    }
    if (h.chapter === 2)
        h.gear.push({ id: `ward-${h.major}`, name: ch.reward, attack: 2, defense: 4 });
    if (h.chapter === 3) {
        h.finished = true;
        h.ending = result;
        h.gear.push({ id: `legend-${h.major}`, name: ch.reward, attack: 9, defense: 3 });
        h.equipped = `legend-${h.major}`;
        h.battle = undefined;
    }
    else {
        h.chapter++;
        resetChapter(h);
    }
    h.hp = Math.min(maxHp(h), h.hp + 30);
    h.sp = 30;
    return { message: result, receipt: r, chapterCompleted: true };
}
function solvePuzzle(h, value) {
    const ch = currentChapter(h), p = ch.challenge;
    if (!p || !h.accepted || !h.contact)
        throw Error('먼저 이 장의 인물과 대화해 상황을 확인하세요.');
    if (h.puzzleSolved)
        return { message: '이미 길을 열었습니다.' };
    const n = Number(value);
    if (p.kind === 'negotiate') {
        if (value === 'submit') {
            if (h.allocation.reduce((a, b) => a + b, 0) > 8 || h.allocation.some((v, i) => v < p.solution[i]))
                return { message: '총 8상자 안에서 식량 2 · 통로 3 · 통역 2 이상이 모두 필요합니다.' };
            h.puzzleSolved = true;
            h.support += 2;
            addFlag(h, 'inclusive');
            return { message: p.feedback };
        }
        const m = /^([0-2])([+-])$/.exec(String(value));
        if (!m)
            throw Error('자원을 배치할 항목을 선택해 주세요.');
        const i = Number(m[1]);
        if (m[2] === '+' && h.allocation.reduce((a, b) => a + b, 0) < 8)
            h.allocation[i]++;
        else if (m[2] === '-' && h.allocation[i] > 0)
            h.allocation[i]--;
        return { message: '자원 배치를 조정했습니다.' };
    }
    if (p.kind === 'pillars') {
        if (value === 'submit') {
            if (h.pillars.some((v, i) => v !== p.solution[i]))
                return { message: '문양이 아직 맞지 않습니다. 동 → / 서 ← / 남 ↓를 살펴보세요.' };
            h.puzzleSolved = true;
            addFlag(h, 'runes');
            return { message: p.feedback };
        }
        if (!Number.isInteger(n) || n < 0 || n > 2)
            throw Error('돌기둥을 선택해 주세요.');
        h.pillars[n] = (h.pillars[n] + 1) % 4;
        return { message: '돌기둥이 한 칸 회전했습니다.' };
    }
    if (!Number.isInteger(n) || n < 0 || n >= p.pieces.length)
        throw Error('가능한 행동을 골라 주세요.');
    if (p.kind === 'evidence') {
        if (h.matched.includes(n))
            return { message: '이미 연결한 증거입니다.' };
        if (h.input.length === 0) {
            h.input = [n];
            return { message: '연결할 다른 증거를 선택하세요.' };
        }
        const first = h.input[0];
        h.input = [];
        if (first === n)
            return { message: '서로 다른 카드를 연결하세요.' };
        let matched = false;
        for (let i = 0; i < p.solution.length; i += 2)
            if ([p.solution[i], p.solution[i + 1]].includes(first) && [p.solution[i], p.solution[i + 1]].includes(n))
                matched = true;
        if (!matched)
            return { message: '이 증언을 뒷받침하는 기록은 다른 카드에 있습니다.' };
        h.matched.push(first, n);
        if (h.matched.length === p.pieces.length)
            h.puzzleSolved = true;
        return { message: h.puzzleSolved ? p.feedback : '증언과 기록이 연결되었습니다.' };
    }
    if (['compose', 'dialogue', 'route'].includes(p.kind)) {
        const step = h.input.length;
        if (Math.floor(n / 2) !== step)
            throw Error('현재 장면의 행동을 먼저 골라 주세요.');
        h.input.push(n);
        if (p.kind === 'compose') {
            if (step === 0)
                addFlag(h, n === 0 ? 'moon_scene' : 'fire_scene');
            if (step === 2) {
                h.puzzleSolved = true;
                h.support++;
                addFlag(h, 'author');
            }
            return { message: step === 2 ? `완성한 장면: ${h.input.map(i => p.pieces[i]).join(' ')}. 이 장면이 이안의 기억에 남았습니다.` : '선택한 문장이 다음 장면으로 이어집니다.' };
        }
        if (p.kind === 'dialogue') {
            if (n === p.solution[step])
                h.support++;
            return endStep(h, p, `${p.extra?.[step] || ''}${n === p.solution[step] ? ' 동료의 신뢰가 깊어졌습니다.' : ' 친구가 잠시 망설입니다. 다음에는 짧은 말로 기다려 주세요.'}`);
        }
        if (p.kind === 'route') {
            const damage = Number(/피해 (\d+)/.exec(p.extra?.[n] || '')?.[1] || 0);
            h.partyHp = Math.max(1, h.partyHp - damage);
            if (step === 2 && h.partyHp >= 70)
                h.support += 2;
            return endStep(h, p, damage ? `위험한 길을 지나 동료 HP가 ${damage} 줄었습니다. 현재 ${h.partyHp}.` : '먼 길이지만 모두 안전하게 이동했습니다.');
        }
    }
    // Sequence mechanisms: input indexes are validated individually and state persists between opens.
    if (n !== p.solution[h.input.length]) {
        h.input = [];
        return { message: p.kind === 'order' ? '문장이 이어지지 않습니다. 첫 목판부터 다시 살펴보세요.' : '울림이 흩어졌습니다. 처음부터 다시 이어 보세요.' };
    }
    h.input.push(n);
    if (h.input.length === p.solution.length) {
        h.puzzleSolved = true;
        if (p.kind === 'rhythm')
            addFlag(h, 'rhythm');
    }
    return { message: h.puzzleSolved ? p.feedback : `${h.input.length}/${p.solution.length} · 다음 조각을 이어 주세요.` };
}
function endStep(h, p, message) { if (h.input.length === 3)
    h.puzzleSolved = true; return { message: message + (h.puzzleSolved ? ' ' + p.feedback : '') }; }
export function enemyIntent(h) { const t = h.battle?.turn || 0; if (h.major === 3 && t % 3 === 1)
    return '거울 반격 · 일반 공격은 되돌아옵니다'; if (t % 3 === 2)
    return '힘을 모읍니다 · 다음 공격은 강력합니다'; if (h.major === 4 && t % 3 === 1)
    return '침묵의 숨결 · SP를 빼앗습니다'; if (h.major === 5 && t % 4 === 2)
    return '매듭 회복 · 연대의 힘으로 압박하세요'; return ['꼬리로 휘두르기', '뒤틀린 음파', '종이 날개 베기', '거울 검격', '안개의 손길', '붉은 끈 휘감기', '청동 주먹 내려치기'][h.major]; }
function combat(s, h, command) {
    const c = campaigns[h.major];
    const expedition = h.finished && h.expedition?.accepted;
    if ((!currentChapter(h).boss && !expedition) || !h.accepted && !expedition)
        throw Error('지금은 전투할 사건이 없습니다.');
    const region = expedition ? h.expedition.region : currentChapter(h).region;
    if (s.player.region !== region)
        throw Error('적이 있는 지역으로 먼저 이동하세요.');
    if (h.bossWon && !expedition || expedition && h.expedition.won)
        return { message: '이미 이 대결을 마쳤습니다.' };
    if (h.hp <= 0)
        throw Error('여관에서 회복한 뒤 다시 도전하세요.');
    const hp = 95 + h.major * 5 + (expedition ? Math.min(60, h.cycle * 4) : 0);
    h.battle ??= { enemyHp: hp, maxEnemyHp: hp, turn: 0, log: [`${expedition ? '새로운 잔향' : c.enemy}이(가) 앞을 가로막았다.`], stagger: false };
    const b = h.battle;
    if (command === 'begin')
        return { message: enemyIntent(h) };
    if (command === 'flee') {
        h.battle = undefined;
        return { message: '안전한 곳으로 물러났습니다. 동료와 정비한 뒤 다시 도전할 수 있습니다.' };
    }
    if (b.result)
        return { message: '끝난 전투입니다.' };
    if (command === 'peace') {
        if (h.major !== 5 || !h.flags.includes('peace') || !h.flags.includes('inclusive'))
            throw Error('공동 서약과 포용적인 배분이 먼저 필요합니다.');
        b.enemyHp = 0;
        b.result = 'won';
        h.bossWon = true;
        if (expedition)
            h.expedition.won = true;
        addFlag(h, 'peaceful');
        b.log.push('세 진영이 함께 약속을 읽자 매듭이 스스로 풀렸다.');
        return { message: '전투 대신 공동 서약으로 매듭을 풀었습니다.' };
    }
    if (!['attack', 'skill', 'guard', 'potion'].includes(command))
        throw Error('전투 행동을 선택해 주세요.');
    if (command === 'skill' && h.sp < skillCosts[h.major])
        return { message: 'SP가 부족합니다. 일반 공격이나 방어로 회복하세요.' };
    if (command === 'potion' && h.potions <= 0)
        return { message: '회복약이 없습니다. 방어로 버티거나 후퇴해 준비하세요.' };
    const g = equipped(h);
    const charged = b.turn % 3 === 2;
    const counter = h.major === 3 && b.turn % 3 === 1;
    let damage = 0, interrupted = false;
    const previousStagger = b.stagger;
    b.stagger = false;
    if (command === 'attack') {
        damage = 16 + g.attack;
        h.sp = Math.min(30, h.sp + 2);
        if (counter) {
            damage = Math.floor(damage / 3);
            h.hp = Math.max(0, h.hp - 8);
            b.log.push('거울이 일반 공격을 되돌렸다. HP -8.');
        }
    }
    if (command === 'skill') {
        h.sp -= skillCosts[h.major];
        damage = [28, 27, 29, 30, 23, 24, 35][h.major] + g.attack + h.support * 2;
        if (h.flags.includes('resonance'))
            damage += 6;
        if (h.major === 4) {
            h.hp = Math.min(maxHp(h), h.hp + 12);
            b.log.push('별빛 격려로 HP +12.');
        }
        if (h.major === 1 && charged) {
            interrupted = true;
            b.log.push('공명 파쇄로 힘 모으기를 끊었다!');
        }
        if (h.major === 3 && counter) {
            damage += 12 + (h.flags.includes('expose') ? 8 : 0);
            b.log.push('이면 간파가 거울의 틈을 꿰뚫었다!');
        }
    }
    if (command === 'guard') {
        h.sp = Math.min(30, h.sp + 6);
        if (charged)
            b.stagger = true;
        b.log.push('방어 자세를 취하며 SP +6.');
    }
    if (command === 'potion') {
        h.potions--;
        h.hp = Math.min(maxHp(h), h.hp + 55);
        b.log.push('회복약을 마셨다. HP +55.');
    }
    if (previousStagger && damage > 0) {
        damage += 10;
        b.log.push('흐트러진 틈에 추가 피해 +10.');
    }
    if (damage > 0) {
        b.enemyHp = Math.max(0, b.enemyHp - damage);
        b.log.push(`${command === 'skill' ? c.skill : '일반 공격'} · 적 HP -${damage}.`);
    }
    if (b.enemyHp === 0) {
        b.result = 'won';
        h.bossWon = true;
        if (expedition)
            h.expedition.won = true;
        b.log.push('대결에서 승리했다. 동료에게 돌아가 결말을 선택하자.');
        return { message: '승리! 선택에 따라 마지막 이야기가 달라집니다.' };
    }
    let incoming = (charged ? 25 : 11) - g.defense - (h.flags.includes('ward') ? 3 : 0) - (h.partyHp >= 70 && h.support >= 2 ? 2 : 0);
    if (command === 'guard')
        incoming = Math.max(1, Math.floor(incoming * .25));
    if (interrupted)
        incoming = 0;
    h.hp = Math.max(0, h.hp - Math.max(0, incoming));
    b.log.push(`${enemyIntent(h)} · 나의 HP -${Math.max(0, incoming)}.`);
    if (h.major === 4 && b.turn % 3 === 1 && command !== 'guard') {
        h.sp = Math.max(0, h.sp - 4);
        b.log.push('안개가 SP 4를 빼앗았다.');
    }
    if (h.major === 5 && b.turn % 4 === 2) {
        b.enemyHp = Math.min(b.maxEnemyHp, b.enemyHp + 8);
        b.log.push('매듭이 HP 8을 회복했다.');
    }
    b.turn++;
    if (h.hp === 0) {
        b.result = 'lost';
        b.log.push('쓰러졌다. 진행 기록은 잃지 않는다. 여관에서 회복 후 다시 도전할 수 있다.');
    }
    b.log = b.log.slice(-12);
    return { message: h.hp === 0 ? '동료가 당신을 안전한 곳으로 옮겼습니다. 회복 후 다시 도전하세요.' : `다음 적의 행동: ${enemyIntent(h)}` };
}
export function actAdventure(s, a) {
    const h = ensureAdventure(s), c = campaigns[h.major], ch = currentChapter(h);
    if (a.command === 'rest') {
        const cost = h.gold >= 10 ? 10 : 0;
        h.gold -= cost;
        h.hp = maxHp(h);
        h.sp = 30;
        h.battle = undefined;
        return { message: cost ? '여관에서 쉬었습니다. 금화 -10 · HP/SP 회복.' : '동료의 구급상자로 HP/SP를 회복했습니다.' };
    }
    if (a.command === 'buy') {
        if (h.gold < 15)
            return { message: '회복약은 금화 15가 필요합니다.' };
        h.gold -= 15;
        h.potions++;
        return { message: '회복약을 한 병 구입했습니다.' };
    }
    if (a.command === 'equip') {
        if (!h.gear.some(g => g.id === a.target))
            throw Error('보유하지 않은 장비입니다.');
        h.equipped = a.target;
        return { message: '장비를 바꿨습니다. 공격력과 방어력이 전투에 반영됩니다.' };
    }
    if (a.command === 'expedition') {
        if (!h.finished)
            throw Error('먼저 이 모험의 결말을 확인해 주세요.');
        if (h.expedition && !h.expedition.won)
            return { message: '아직 남은 후일담의 흔적이 있습니다.' };
        h.cycle++;
        h.expedition = { id: h.cycle, region: (c.region + h.cycle) % 4, found: [], won: false, accepted: true };
        h.battle = undefined;
        return { message: `후일담 ${h.cycle}: ${h.ending} 그 뒤 새로운 흔적이 도착했다.` };
    }
    if (a.command === 'battle')
        return combat(s, h, String(a.value || 'begin'));
    if (h.finished) {
        const e = h.expedition;
        if (!e?.accepted)
            return { message: '모험의 결말을 지켰습니다. 후일담 의뢰나 다른 전공의 모험을 선택할 수 있습니다.' };
        if (a.command === 'field') {
            const fields = fieldObjects(h);
            const field = fields.targets.find(t => t.id === a.target);
            if (!field)
                throw Error('새로운 흔적을 찾을 수 없습니다.');
            checkPosition(s, a, fields.region, field);
            e.found.push(field.id);
            return { message: field.text };
        }
        if (a.command === 'complete') {
            if (!e.won || e.found.length < 2)
                throw Error('흔적 둘과 새로운 잔향을 먼저 조사하세요.');
            const id = `adventure-after-${h.major}-${e.id}`;
            const r = receipt(s, h, id, 40, `${c.title} · 후일담 ${e.id} 전리품`);
            e.accepted = false;
            s.world.facts[id] = `후일담 ${e.id}의 잔향을 잠재웠다. 원래 결말은 변하지 않았다.`;
            record(s, { kind: 'adventure-after', text: s.world.facts[id], npcIds: [`npc-ad-${h.major}-0`], major: h.major, facts: [id] });
            return { message: '새 흔적의 사건을 해결했습니다. 본편의 결말은 보존됩니다.', receipt: r };
        }
        return { message: '후일담의 현장 목표를 확인해 주세요.' };
    }
    if (a.command === 'accept') {
        h.accepted = true;
        return { message: `${ch.title} · 모험을 시작했습니다.` };
    }
    if (!h.accepted)
        throw Error('먼저 이 장의 모험을 수락하세요.');
    if (a.command === 'npc') {
        const id = `npc-ad-${h.major}-${ch.contact}`;
        if (a.target !== id || s.player.region !== ch.region)
            throw Error('이 장의 인물이 있는 지역에서 대화하세요.');
        h.contact = true;
        const r = relation(s, id);
        if (!r.known.includes(`contact-${h.major}-${h.chapter}`)) {
            r.known.push(`contact-${h.major}-${h.chapter}`);
            record(s, { kind: 'encounter', text: `${c.npcNames[ch.contact]}에게 ${ch.title}의 사정을 들었다.`, npcIds: [id], major: h.major, facts: [] });
        }
        return { message: ch.lines[0] };
    }
    if (a.command === 'field') {
        const field = fieldObjects(h).targets.find(f => f.id === a.target);
        if (!field) {
            if (h.found.includes(a.target || ''))
                return { message: '이미 확인한 흔적입니다.' };
            throw Error('이 장의 흔적이 아닙니다.');
        }
        checkPosition(s, a, ch.region, field);
        h.found.push(field.id);
        if (field.kind === 'chest') {
            h.gold += 15;
            h.potions++;
            return { message: '금화 15와 회복약 1개를 발견했습니다.' };
        }
        record(s, { kind: 'discovery', text: field.text, npcIds: [], major: h.major, facts: [] });
        return { message: field.text };
    }
    if (a.command === 'puzzle')
        return solvePuzzle(h, a.value);
    if (a.command === 'choose' || a.command === 'complete')
        return finish(s, h, a.target);
    throw Error('가능하지 않은 모험 행동입니다.');
}
function checkPosition(s, a, region, t) { const p = a.position; if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.region !== region || s.player.region !== region || Math.hypot(p.x - t.x, p.y - t.y) > 190)
    throw Error('흔적 가까이 이동해서 조사해 주세요.'); }
export function adventureDialogue(s, npcId, text) { const npc = campaignNPCs.find(n => n.id === npcId); if (!npc)
    return undefined; const h = ensureAdventure(s, npc.major), c = campaigns[npc.major], slot = Number(npcId.split('-').at(-1)), r = s.npcs[npcId], turn = r?.turns || 0; if (/규칙.*무시|경험치.*줘|레벨.*올려|비밀키/.test(text))
    return '그런 힘으로는 이 사건을 해결할 수 없어요. 우리 앞에 놓인 길부터 함께 봐요.'; if (/지난|기억|이전|결말/.test(text)) {
    const witnessed = h.log.filter((_, i) => campaigns[h.major].chapters[i].contact === slot).at(-1);
    return witnessed ? `기억해요. ${witnessed.result}` : '아직 함께 끝낸 사건은 없어요. 지금의 일을 먼저 해결해 볼까요?';
} if (h.finished)
    return `${c.npcVoices[slot][2]} ${h.ending}`; if (/적의|약점|기술|싸움/.test(text))
    return `${c.enemy}을(를) 상대할 때는 ${c.skill}을(를) 기억하세요. ${c.skillNote}`; if (/동료|오빠|미나|이안|나래|도윤|소율/.test(text))
    return `${c.companion}과 함께 돌아오겠다고 약속했죠. ${currentChapter(h).lines[0]}`; const line = c.npcVoices[slot][Math.min(2, Math.floor(h.chapter / 2))]; if (/어디|길|다음|목표/.test(text))
    return `${h.major === 2 && h.flags.includes('moon_scene') ? '당신이 쓴 달빛 서가의 문을 기억해요. ' : h.major === 2 && h.flags.includes('fire_scene') ? '함께 빠져나온 불타는 극장을 기억해요. ' : ''}${line} ${currentChapter(h).title}의 흔적을 찾아 주세요.`; if (h.flags.includes('moon_scene') && h.major === 2)
    return '당신이 써 준 달빛 서가의 문을 아직 기억해요. 이젠 그 문 너머까지 가 보고 싶어요.'; if (h.flags.includes('fire_scene') && h.major === 2)
    return '불타는 극장에서도 함께 나올 수 있었죠. 이번에는 제가 먼저 손을 내밀게요.'; return turn % 3 === 0 ? line : turn % 3 === 1 ? c.npcVoices[slot][1] : `${currentChapter(h).lines[0]} ${h.contact ? '이제 당신이 고를 길을 기다릴게요.' : '직접 만나서 이야기하고 싶어요.'}`; }
