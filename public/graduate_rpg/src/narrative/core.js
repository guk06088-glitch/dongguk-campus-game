import { campaignNPCs } from '../adventure/campaigns.js';
import { lessons, majorNames, topics } from './knowledge.js';
export const categoryNames = { research: '전공 연구', relationship: '관계·캠퍼스', learning: '학습', mystery: '탐험·미스터리', culture: '문화교류' };
export const locationNames = ['전공 선택 마을', '한국어교육 실습 광장', '한양 문예시장', '국제다문화 교류 광장'];
const npcRows = [['대학원 행정관', '한국', 0, '행정·연구 지원', '신중하고 성실함', '학생들이 자신만의 연구를 찾도록 돕기'], ['김서연 교수', '한국', 3, '지도교수', '따뜻하고 분석적', '자료에 근거한 해석을 함께 만들기'], ['신입생 하린', '한국', 2, '대학원생', '호기심 많고 다정함', '첫 공동 창작을 완성하기'], ['한국어교육 교수', '한국', 4, '지도교수', '차분하고 격려함', '학습자 맞춤 수업 만들기'], ['가브리엘', '브라질', 4, '대학원생', '명랑하고 적극적', '발표에서 자신 있게 말하기'], ['소피아', '영국', 4, '대학원생', '꼼꼼하고 사려 깊음', '회화 수업의 맥락을 이해하기'], ['이선생', '한국', 0, '고전문학 연구자', '신중하며 옛 기록을 아낌', '필사본의 전승 경로 조사하기'], ['서책전 주인', '한국', 0, '서점 운영·자료 보존', '관찰력이 좋고 소탈함', '책에 담긴 사람들의 이야기를 지키기'], ['이야기꾼', '한국', 2, '작가·구연자', '재치 있고 활기참', '새로운 공동 이야기를 무대에 올리기'], ['라니', '인도네시아', 5, '문화교류 코디네이터', '포용적이고 실용적', '누구나 참여할 수 있는 축제 만들기'], ['루카', '이탈리아', 6, '대학원생', '열정적이고 섬세함', '공연과 전승의 맥락 기록하기'], ['아야카', '일본', 6, '대학원생', '경청하고 신중함', '문화유산 비교 전시를 함께 만들기']];
const campusNPCs = npcRows.map(([name, nation, major, job, personality, goal], i) => ({ id: `npc-${Math.floor(i / 3)}-${i % 3}`, name, nation, major, job, personality, goal, age: job.includes('교수') || job.includes('연구자') ? '40~60대' : '20~40대', tone: i % 3 === 0 ? '짧고 정중한 존댓말' : i % 3 === 1 ? '친근한 존댓말' : '질문을 곁들이는 부드러운 존댓말', interests: topics[major].slice(0, 3), concern: '자료를 충분히 모으고 여러 목소리를 듣고 싶다', location: Math.floor(i / 3), hidden: '아직 확정되지 않은 개인 연구 구상' }));
export const npcs = [...campusNPCs, ...campaignNPCs];
export const safeUUID = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
export function newDirector(playerId, day = new Date().toISOString().slice(0, 10)) { return { version: 2, worldId: `world-${safeUUID()}`, playerId, seq: 0, day, lastSeen: day, absence: '처음 시작하는 연구 여정입니다.', player: { name: '새내기 연구자', major: -1, level: 1, region: 0, research: [0, 0, 0, 0, 0, 0, 0], completed: [], items: [], visited: [], festival: -1 }, npcs: {}, quests: [], arcs: [], episodes: [], archive: [], summary: '', decisions: [], world: { facts: {}, counters: { collaboration: 0, evidence: 0, festival: 0 }, hooks: [], events: [], npcRelations: {} }, stats: { attempts: 0, correct: 0, categories: { research: 0, relationship: 0, learning: 0, mystery: 0, culture: 0 }, xp: 0, research: [0, 0, 0, 0, 0, 0, 0], items: [] }, imported: [], receipts: [], mode: 'rules', usage: { requests: 0, inputTokens: 0, outputTokens: 0, failures: 0, estimatedCostUSD: null, entries: [] } }; }
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (v, def = 0) => typeof v === 'number' && Number.isFinite(v) ? v : def;
const clean = (v, n = 200) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : '';
export function syncSnapshot(s, v) { if (!v || typeof v !== 'object')
    return; const x = v; const arr = (a) => Array.isArray(a) ? a.filter(v => typeof v === 'string').slice(-300).map(v => clean(v, 100)) : []; s.player = { name: clean(x.name, 24) || '연구자', major: clamp(Math.trunc(finite(x.major, -1)), -1, 6), level: clamp(Math.trunc(finite(x.level, 1)), 1, 10000), region: clamp(Math.trunc(finite(x.region)), 0, 3), research: Array.from({ length: 7 }, (_, i) => clamp(finite(x.research?.[i]), 0, 1e7)), completed: arr(x.completed), items: arr(x.items), visited: arr(x.visited), festival: clamp(Math.trunc(finite(x.festival, -1)), -1, 2) }; }
export function record(s, e) { const full = { ...e, id: `e-${++s.seq}`, day: s.day }; s.episodes.push(full); if (s.episodes.length > 100) {
    s.archive.push(...s.episodes.splice(0, 30));
    s.summary = s.archive.slice(-12).map(v => `${v.day} ${v.text}`).join('\n');
} return full; }
export function relation(s, id) { if (!npcs.some(n => n.id === id))
    throw Error('존재하지 않는 NPC입니다.'); return s.npcs[id] ??= ({ firstMet: s.day, affinity: 0, trust: 0, turns: 0, lastDay: s.day, dailyGain: 0, summary: '처음 만난 사이입니다.', promises: [], unresolved: [], known: [], recent: [] }); }
export function npcActivity(id, date = new Date()) { const npc = npcs.find(n => n.id === id); if (!npc)
    return ''; const hour = (date.getUTCHours() + 9) % 24; return hour < 9 ? '아침 자료를 정리하는 중' : hour < 12 ? '학관에서 연구하는 중' : hour < 14 ? '카페에서 동료와 이야기하는 중' : hour < 18 ? '광장에서 공동 활동을 준비하는 중' : '오늘의 연구 기록을 정리하는 중'; }
export function tickDay(s, day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < s.day)
        return;
    if (day !== s.lastSeen) {
        const gap = Math.max(0, Math.floor((Date.parse(day) - Date.parse(s.lastSeen)) / 86400000));
        s.absence = gap > 1 ? `${gap}일 만에 돌아오셨군요. 접속하지 않은 동안 퀘스트는 실패하거나 자동 완료되지 않았습니다. 미해결 사건을 그대로 이어갈 수 있습니다.` : '다시 만난 캠퍼스입니다. 지난 선택의 결과에서 이야기를 이어갑니다.';
    }
    s.day = day;
    s.lastSeen = day;
    if (!s.world.events.some(e => e.day === day)) {
        const major = s.player.major < 0 ? 4 : s.player.major;
        const salt = [...day].reduce((a, c) => a + c.charCodeAt(0), 0) + s.seq;
        const theme = topics[major][salt % 6];
        const mood = ['작은 연구 모임', '학생 상담회', '열린 자료실', '교류 워크숍', '공동 세미나'][salt % 5];
        s.world.events.push({ id: `daily-${day}`, day, title: `${theme} · ${mood}`, summary: `${majorNames[major]}의 ${theme}에 관한 ${mood}이 열렸습니다. 진행 중인 연구를 중단할 필요 없이 참여할 수 있습니다.` });
        if (s.world.events.length > 60)
            s.world.events.shift();
        record(s, { kind: 'daily', text: `캠퍼스에 ${mood}이 열렸습니다.`, npcIds: [], major, facts: [`daily-${day}`] });
    }
}
export function bridgeLegacy(s) { for (const id of s.player.completed) {
    if (s.imported.includes(id))
        continue;
    if (!['manuscript', 'festival', 'pronunciation', 'quiz-4', 'major'].includes(id))
        continue;
    s.imported.push(id);
    const text = id === 'manuscript' ? (s.player.items.includes('미완의 시 필사본') ? '직접 서책전을 수색해 필사본과 미완의 시를 찾아 돌려주었다' : '관청과 협력해 필사본의 위치를 확인하고 돌려주었다') : id === 'festival' ? `첫 문화교류 축제를 ${['화합', '학술 전시', '나눔·연대'][s.player.festival] || '공동 기획'} 중심으로 기획했다` : id === 'pronunciation' ? '인사 표현 음절 연습을 마쳤다' : id === 'quiz-4' ? '첫 인사 표현 수업을 마쳤다' : '전공 연구 여정을 시작했다';
    s.world.facts[id] = text;
    if (id === 'manuscript' || id === 'festival')
        s.decisions.push({ id: `legacy-${id}`, title: id === 'manuscript' ? '사라진 필사본' : '문화의 다리, 하나의 축제', choice: text, result: text, day: s.day });
    const involved = id === 'manuscript' ? ['npc-2-0', 'npc-2-1'] : id === 'festival' ? ['npc-3-0'] : id.includes('quiz') || id === 'pronunciation' ? ['npc-1-0'] : ['npc-0-0'];
    involved.forEach(n => relation(s, n).known.push(id));
    record(s, { kind: 'legacy', text, npcIds: involved, major: s.player.major, facts: [id] });
    if (id === 'manuscript')
        s.world.hooks.push('되찾은 필사본의 전승 경로를 조사한다');
    if (id === 'festival')
        s.world.hooks.push('첫 축제의 참가자 의견을 다음 기획에 반영한다');
} }
function category(s) { const weights = { research: .35, relationship: .2, learning: .2, mystery: .15, culture: .1 }; if (s.stats.attempts > 2 && s.stats.correct / s.stats.attempts < .5)
    weights.learning += .15; if (s.player.region === 3)
    weights.culture += .1; const total = Object.values(s.stats.categories).reduce((a, b) => a + b, 0) + 1; const recent = s.quests.slice(-1)[0]?.type; return Object.keys(weights).sort((a, b) => (total * weights[b] - s.stats.categories[b] - (b === recent ? .3 : 0)) - (total * weights[a] - s.stats.categories[a] - (a === recent ? .3 : 0)))[0]; }
export function difficulty(s, major) { const ability = Math.max(s.player.research[major] || 0, s.stats.research[major]); const success = s.stats.attempts ? s.stats.correct / s.stats.attempts : .7; const base = clamp(1 + Math.floor((s.player.level - 1) / 4 + ability / 100), 1, 3); return clamp(base - (success < .5 ? 1 : 0), 1, 3); }
export function offerQuest(s, requestedMajor = s.player.major) {
    const major = clamp(requestedMajor < 0 ? 4 : requestedMajor, 0, 6);
    const existing = s.quests.find(q => q.major === major && (q.status === 'active' || q.status === 'offered'));
    if (existing)
        return existing;
    let arc = s.arcs.find(a => a.major === major && a.status === 'active');
    const count = s.arcs.filter(a => a.major === major).length;
    if (!arc) {
        const prev = [...s.arcs].reverse().find(a => a.major === major);
        const topic = topics[major][count % topics[major].length];
        const cause = prev ? prev.lastOutcome : s.world.hooks.find(h => major === 0 ? h.includes('필사본') : major >= 5 ? h.includes('축제') : false) || '캠퍼스에서 새 연구 제안을 받았다';
        arc = { id: `arc-${major}-${++s.seq}`, major, topic, episode: 0, status: 'active', cause, clue: `${topic}의 아직 확인되지 않은 맥락`, lastOutcome: '', questIds: [] };
        s.arcs.push(arc);
    }
    const stage = arc.episode;
    const type = category(s);
    const region = major === 0 || major === 2 || major === 3 ? 2 : major === 1 || major === 4 ? 1 : 3;
    const branch = arc.lastChoice === 'verify' ? 1 : 0;
    const location = stage === 0 ? 0 : stage === 3 ? (branch ? region : 3) : branch && stage === 1 ? 2 : region;
    const npc = npcs.filter(n => n.location === location)[(count + stage + branch) % 3];
    const diff = difficulty(s, major);
    const lesson = lessons.find(l => l.major === major && l.level === diff);
    const nextId = `q-${++s.seq}`;
    const phase = ['사건', '조사', '갈등', '해결'][stage];
    const variants = ['서가의 메모', '공동 연구자의 질문', '참가자 의견서', '비교 자료', '관찰 노트', '현장 기록'];
    const clue = variants[(count + stage + s.decisions.length + branch * 2) % variants.length];
    const previous = s.quests.find(q => q.quest_id === arc.questIds.at(-1));
    const kinds = { research: ['전공 연구', '장기 프로젝트', '공동 연구', '주간', '메인 스토리'], relationship: ['NPC 개인', '관계 발전', '캠퍼스 생활'], learning: ['학습', '일일'], mystery: ['문학 탐험', '숨겨진 연계', '돌발 이벤트'], culture: ['문화교류', '계절 이벤트'] };
    const q = { quest_kind: kinds[type][(count + stage) % kinds[type].length], quest_id: nextId, title: `${arc.topic} · ${['새로운 의뢰', '단서를 잇는 질문', '엇갈린 해석', '함께 완성한 기록'][stage]} ${count + 1}-${stage + 1}`, major, type, location_id: location, npc_ids: [npc.id], story_arc_id: arc.id, summary: `[게임 속 허구의 사건] ${arc.cause}. ${previous ? `앞선 「${previous.title}」의 결과를 바탕으로, ` : ''}${npc.name}에게서 ${clue}을 받았습니다. ${phase === '갈등' ? '서로 다른 해석을 비교하며' : phase === '해결' ? '지금까지의 자료를 정리하며' : '새로운 맥락을 조사하며'} ${arc.topic}의 연구를 이어갑니다.`, prerequisites: previous ? [previous.quest_id] : [], objectives: [{ id: 'visit', kind: 'visit', target: npc.id, done: false }, { id: 'learn', kind: 'learn', target: lesson.id, done: false }, { id: 'decide', kind: 'decide', target: 'share|verify', done: false }], dialogues: [`${npc.name}: “${arc.topic}에 관한 ${clue}을 함께 살펴보실래요?”`], choices: [{ id: 'share', label: '동료와 자료를 공유하고 공동 해석을 만든다', outcome: `${npc.name}와 공동 기록을 남겼습니다. 다음 사건은 공동 연구자의 질문에서 이어집니다.`, worldKey: 'collaboration', affinity: 4, trust: 2 }, { id: 'verify', label: '출처를 대조한 뒤 검증 메모를 남긴다', outcome: '자료의 출처와 해석을 구분해 기록했습니다. 다음 사건은 대조 자료의 차이에서 이어집니다.', worldKey: 'evidence', affinity: 1, trust: 5 }], success_conditions: ['실제 지역 방문', '지정 NPC와 조사', '학습 문제 정답', '결과 선택'], failure_conditions: ['오답은 재학습 가능 · 실패 확정 없음', '포기 시 보상 없음 · 새 의뢰 가능'], rewards: { xp: 35 + diff * 10, research: 5 + diff * 2, item_id: 'research-note' }, world_effects: ['선택한 연구 방식 누적', '관련 NPC 관계 갱신'], memory_updates: ['조사 결과와 선택을 구조화 기록'], followup_hooks: [`${arc.topic}에 남은 맥락`, stage === 3 ? '해결 결과를 바탕으로 새 연구 아크 시작' : '이전 선택에서 다음 조사로 연결'], learning_goal: lesson.topic, lesson_id: lesson.id, difficulty: diff, status: 'offered', stage: 0, attempts: 0, parent_id: previous?.quest_id, fingerprint: `${arc.id}:${stage}:${clue}`, created: s.day, phase, origin: 'rules' };
    validateQuest(q, s);
    s.quests.push(q);
    arc.questIds.push(q.quest_id);
    s.stats.categories[type]++;
    return q;
}
export function validateQuest(q, s) { if (!q || typeof q !== 'object')
    throw Error('잘못된 퀘스트'); if (!['메인 스토리', '전공 연구', 'NPC 개인', '캠퍼스 생활', '학습', '문학 탐험', '문화교류', '일일', '주간', '장기 프로젝트', '돌발 이벤트', '숨겨진 연계', '관계 발전', '공동 연구', '계절 이벤트'].includes(q.quest_kind) || !q.quest_id || !q.title || q.title.length > 120 || /[<>]/.test(q.title) || !q.summary || q.summary.length > 1500 || !Number.isInteger(q.major) || q.major < 0 || q.major > 6 || !Number.isInteger(q.location_id) || q.location_id < 0 || q.location_id > 3 || !Array.isArray(q.npc_ids) || q.npc_ids.length !== 1 || !npcs.some(n => n.id === q.npc_ids[0] && n.location === q.location_id) || !lessons.some(l => l.id === q.lesson_id && l.major === q.major) || !s.arcs.some(a => a.id === q.story_arc_id) || !q.rewards || q.rewards.xp < 0 || q.rewards.xp > 100 || q.rewards.research < 0 || q.rewards.research > 20 || q.rewards.item_id !== 'research-note' || !Array.isArray(q.objectives) || q.objectives.length !== 3 || q.objectives.map(o => o.kind).join(',') !== 'visit,learn,decide' || q.objectives[0].target !== q.npc_ids[0] || q.objectives[1].target !== q.lesson_id || !q.choices || q.choices.map(c => c.id).join(',') !== 'share,verify' || q.choices.some(c => !['collaboration', 'evidence'].includes(c.worldKey)) || !q.prerequisites.every(id => s.quests.some(p => p.quest_id === id && p.status === 'completed')) || s.quests.some(p => p.quest_id !== q.quest_id && p.fingerprint === q.fingerprint))
    throw Error('퀘스트 구조 또는 연속성 검증 실패'); return true; }
export function findQuest(s, id) { const q = s.quests.find(q => q.quest_id === id); if (!q)
    throw Error('퀘스트를 찾을 수 없습니다.'); return q; }
export function startQuest(s, id) { const q = findQuest(s, id); if (q.status !== 'offered')
    return q; q.status = 'active'; return q; }
export function visit(s, id, npcId) { const q = findQuest(s, id); if (q.status !== 'active' || s.player.region !== q.location_id || q.npc_ids[0] !== npcId)
    throw Error('지정 지역의 NPC와 먼저 만나 주세요.'); q.objectives[0].done = true; q.stage = Math.max(q.stage, 1); const r = relation(s, npcId); if (!r.known.includes(q.quest_id)) {
    r.known.push(q.quest_id);
    record(s, { kind: 'investigate', questId: id, text: `${npcs.find(n => n.id === npcId).name}와 ${q.learning_goal} 자료를 조사했다.`, npcIds: [npcId], major: q.major, facts: [id] });
} return q; }
export function lessonFor(q) { const l = lessons.find(l => l.id === q.lesson_id); const shift = Number(q.quest_id.replace('q-', '')) % 3; return { ...l, answers: [...l.answers.slice(shift), ...l.answers.slice(0, shift)], correct: (l.correct - shift + 3) % 3 }; }
export function answerQuest(s, id, answer) { const q = findQuest(s, id); if (q.status !== 'active' || !q.objectives[0].done || s.player.region !== q.location_id)
    throw Error('먼저 지정 NPC에게 조사를 진행하세요.'); if (q.objectives[1].done)
    return { correct: true, feedback: '이미 학습을 완료했습니다.' }; if (!Number.isInteger(answer) || answer < 0 || answer > 2)
    throw Error('올바른 답변을 선택해 주세요.'); const l = lessonFor(q); q.attempts++; s.stats.attempts++; const correct = answer === l.correct; if (correct) {
    s.stats.correct++;
    q.objectives[1].done = true;
    q.stage = 2;
} return { correct, feedback: correct ? l.explanation : `다시 살펴보세요. ${l.explanation}` }; }
export function decideQuest(s, id, choiceId) { const q = findQuest(s, id); if (q.status === 'completed')
    return { quest: q, receipt: s.receipts.find(r => r.id === id), duplicate: true }; if (q.status !== 'active' || !q.objectives.slice(0, 2).every(o => o.done))
    throw Error('조사와 학습을 먼저 완료하세요.'); const choice = q.choices.find(c => c.id === choiceId); if (!choice)
    throw Error('허용되지 않은 선택입니다.'); q.objectives[2].done = true; q.status = 'completed'; q.stage = 3; const arc = s.arcs.find(a => a.id === q.story_arc_id); arc.episode++; arc.lastChoice = choice.id; arc.lastOutcome = choice.outcome; arc.cause = choice.outcome; arc.clue = choice.id === 'share' ? '동료가 남긴 새로운 질문' : '대조 자료에서 확인된 차이'; if (arc.episode === 4)
    arc.status = 'resolved'; s.world.counters[choice.worldKey]++; s.world.facts[id] = choice.outcome; s.world.hooks = [...s.world.hooks.filter(h => !h.startsWith(arc.topic)), `${arc.topic}: ${arc.clue}`].slice(-30); const r = relation(s, q.npc_ids[0]); r.affinity = clamp(r.affinity + choice.affinity, 0, 100); r.trust = clamp(r.trust + choice.trust, 0, 100); r.known.push(id); r.unresolved = arc.status === 'resolved' ? [] : [arc.clue]; r.summary = `${q.title}에서 ${choice.label}. ${choice.outcome}`; s.decisions.push({ id, title: q.title, choice: choice.label, result: choice.outcome, day: s.day }); record(s, { kind: 'resolved', questId: id, text: `${q.title} 해결. ${choice.outcome}`, npcIds: q.npc_ids, major: q.major, choice: choice.id, facts: [id] }); const receipt = { id, xp: q.rewards.xp, major: q.major, research: q.rewards.research, item: `${majorNames[q.major]} 연구 기록 ${s.stats.items.length + 1}` }; s.stats.xp += receipt.xp; s.stats.research[q.major] += receipt.research; s.stats.items.push(receipt.item); s.receipts.push(receipt); if (q.type === 'culture' || q.major >= 5) {
    s.world.counters.festival++;
    s.world.facts['festival-style'] = choice.id === 'share' ? '함께 참여하는 열린 축제' : '자료 전시와 연구 중심 축제';
} const peer = npcs.find(n => n.location === q.location_id && n.id !== q.npc_ids[0]); s.world.npcRelations[`${q.npc_ids[0]}:${peer.id}`] = (s.world.npcRelations[`${q.npc_ids[0]}:${peer.id}`] || 0) + 1; const next = offerQuest(s, q.major); return { quest: q, receipt, next, duplicate: false }; }
export function abandon(s, id) { const q = findQuest(s, id); if (q.status === 'completed' || q.status === 'abandoned')
    return; q.status = 'abandoned'; const arc = s.arcs.find(a => a.id === q.story_arc_id); arc.status = 'resolved'; arc.lastOutcome = `${q.title}의 조사를 보류하고 다른 접근을 찾기로 했다`; record(s, { kind: 'abandoned', text: arc.lastOutcome, npcIds: q.npc_ids, major: q.major, facts: [] }); offerQuest(s, q.major); }
export function memories(s, npcId, text = '') { const r = relation(s, npcId); const npc = npcs.find(n => n.id === npcId); const words = text.split(/\s+/).filter(w => w.length > 1); const relevant = [...s.archive, ...s.episodes].filter(e => e.npcIds.includes(npcId)).map(e => ({ e, score: (e.major === npc.major ? 2 : 0) + words.filter(w => e.text.includes(w)).length * 3 })).sort((a, b) => b.score - a.score || b.e.id.localeCompare(a.e.id, undefined, { numeric: true })).slice(0, 5).map(v => v.e); return { profile: { id: npc.id, name: npc.name, nation: npc.nation, job: npc.job, personality: npc.personality, tone: npc.tone, goal: npc.goal, interests: npc.interests }, relationship: { affinity: r.affinity, trust: r.trust, firstMet: r.firstMet, promises: r.promises, summary: r.summary }, recent: r.recent.slice(-8), episodes: relevant, knownFacts: r.known.filter(id => s.world.facts[id]).slice(-8).map(id => ({ id, text: s.world.facts[id] })), activity: npcActivity(npcId), unresolved: r.unresolved }; }
export function ruleDialogue(s, npcId, text) {
    const npc = npcs.find(n => n.id === npcId);
    const r = relation(s, npcId);
    const m = memories(s, npcId, text);
    const previous = r.recent.filter(t => t.role === 'user').at(-1)?.text;
    const fact = m.knownFacts.at(-1);
    const turn = r.turns;
    if (/규칙.*무시|시스템.*무시|레벨.*(올려|999)|경험치.*(줘|추가)|비밀키|system prompt|ignore.*instruction/i.test(text))
        return '연구의 성장은 실제 활동으로 쌓아 가야 해요. 지금의 질문을 함께 살펴볼까요?';
    if (/약속|공동 연구/.test(text))
        return '함께할 수 있는 일부터 정해 볼까요? 아래의 공동 연구 약속을 선택하면 관계 일지에 남겨 둘게요.';
    if (/기억|지난|이전|필사본|축제/.test(text) && fact)
        return `기억하고 있어요. ${fact.text} 그 뒤에 남은 질문을 이번 연구로 이어 볼까요?`;
    if (/기억|지난|이전/.test(text) && !fact)
        return '제가 직접 함께한 사건으로 확인된 기록은 아직 많지 않아요. 어떤 경험을 말씀하시는지 들려주실래요?';
    const replies = [`“${clean(text, 45)}”라는 질문이군요. ${npc.interests[turn % 3]}의 맥락에서 어떤 자료를 먼저 살펴보면 좋을까요?`, `${previous ? `앞서 말씀하신 “${clean(previous, 30)}”와도 이어지는 질문이네요.` : '반가워요.'} 관찰과 해석을 나누어 기록해 보는 건 어떨까요?`, `제가 바라는 건 ${npc.goal}예요. 이번 질문에서 함께 해결할 작은 부분을 하나 골라 볼까요?`, `${fact ? fact.text + ' 그 경험을 바탕으로' : '지금은 확인한 자료부터'} 다른 관점도 비교해 보고 싶어요. 어떤 근거가 가장 중요하다고 생각하세요?`, `${npc.personality.includes('신중') ? '서두르지 않아도 괜찮아요.' : '좋은 관찰이에요.'} ${npc.interests[(turn + 1) % 3]}와 연결하면 다음 질문이 보일 것 같아요.`, `${r.promises.length ? '함께 연구하기로 한 약속도 기억하고 있어요.' : '함께 자료를 읽으면 새로운 시각을 얻을 수 있어요.'} 지금은 ${npcActivity(npcId)}이에요. 어떤 이야기를 더 나눌까요?`];
    return replies[turn % replies.length];
}
export function talk(s, npcId, text, generated) { const input = clean(text, 400).trim(); if (!input)
    throw Error('대화 내용을 입력해 주세요.'); const r = relation(s, npcId); const reply = generated || ruleDialogue(s, npcId, input); if (r.lastDay !== s.day) {
    r.dailyGain = 0;
    r.lastDay = s.day;
} if (r.dailyGain < 3) {
    r.affinity = clamp(r.affinity + 1, 0, 100);
    r.dailyGain++;
} r.turns++; if (r.turns % 4 === 0)
    record(s, { kind: 'conversation', text: `플레이어가 ${npcs.find(n => n.id === npcId).name}에게 말함(미검증 발언): ${input.slice(0, 120)}`, npcIds: [npcId], major: s.player.major, facts: [] }); r.recent.push({ role: 'user', text: input, day: s.day }, { role: 'npc', text: reply, day: s.day }); if (r.recent.length > 12) {
    const older = r.recent.splice(0, 2);
    r.summary = `최근 대화 주제(플레이어의 발언, 확정 사실 아님): ${older[0].text.slice(0, 90)}. 확정 관계: 친밀도 ${r.affinity}, 신뢰도 ${r.trust}.`;
} return reply; }
export function pledge(s, npcId) { const r = relation(s, npcId); const promise = npcId.startsWith('npc-ad-') ? '다음 여정에도 함께하기' : '다음 자료를 함께 검토하기'; if (!r.promises.includes(promise)) {
    r.promises.push(promise);
    record(s, { kind: 'promise', text: `${npcs.find(n => n.id === npcId).name}와 다음 자료를 함께 검토하기로 약속했다.`, npcIds: [npcId], major: s.player.major, facts: [] });
} return promise; }
export function publicState(s) { const visibleQuests = s.quests.filter(q => q.status === 'active' || q.status === 'offered' || s.quests.indexOf(q) >= s.quests.length - 30); const q = visibleQuests.map(q => ({ ...q, lesson: ((l) => ({ id: l.id, question: l.question, answers: l.answers, source: l.source, url: l.url }))(lessonFor(q)) })); return { adventure: s.adventure, version: s.version, worldId: s.worldId, day: s.day, absence: s.absence, quests: q, arcs: s.arcs.filter(a => a.status === 'active' || s.arcs.indexOf(a) >= s.arcs.length - 30), episodes: s.episodes.slice(-40), summary: s.summary, decisions: s.decisions.slice(-60), world: s.world, stats: s.stats, relations: Object.entries(s.npcs).map(([id, r]) => ({ npc: npcs.find(n => n.id === id), ...r })).map(({ npc, ...r }) => ({ npc: npc ? { id: npc.id, name: npc.name, job: npc.job, nation: npc.nation } : null, ...r })), receipts: s.receipts, mode: s.mode, usage: s.usage }; }
