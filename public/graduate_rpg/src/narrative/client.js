import { AdventureUI } from '../adventure/ui.js';
import { campaigns } from '../adventure/campaigns.js';
import { currentChapter, fieldObjects } from '../adventure/engine.js';
import { dispatch, newDirector } from './service.js';
import { locationNames, npcs, safeUUID } from './core.js';
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class CampusDirector {
    hooks;
    state = null;
    transport = 'server';
    busy = false;
    local = null;
    queue = Promise.resolve();
    revision = 0;
    adventure;
    constructor(hooks) {
        this.hooks = hooks;
        if ('true' === 'true')
            this.transport = 'local';
        this.adventure = new AdventureUI({ state: () => this.state, major: () => this.hooks.snapshot().major, request: r => this.request(r), open: hooks.open, button: hooks.button, toast: hooks.toast, travel: hooks.travel, close: hooks.close, select: hooks.selectMajor, position: hooks.position, journal: () => void this.hub('past'), chat: id => void this.conversation(id) });
    }
    request(body) { const run = () => this.perform(body); const next = this.queue.then(run, run); this.queue = next.catch(() => { }); return next; }
    async perform(body) {
        const payload = { ...body, snapshot: this.hooks.snapshot() };
        let result;
        if (this.transport === 'server') {
            try {
                const r = await fetch('/api/director', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
                if (!r.ok) {
                    if ([404, 502, 503, 504].includes(r.status))
                        throw new TypeError('server unavailable');
                    const e = await r.json();
                    throw Error(e.error || '요청에 실패했습니다.');
                }
                result = await r.json();
            }
            catch (error) {
                if (!(error instanceof TypeError) && !(error instanceof DOMException))
                    throw error;
                this.transport = 'local';
                this.hooks.toast('AI 서버 연결이 없어 로컬 규칙 생성으로 전환했습니다. 서버 여정과 별도로 저장됩니다.');
                return this.perform(body);
            }
        }
        else {
            if (!this.local) {
                try {
                    this.local = JSON.parse(localStorage.getItem('campus-director-local-v2') || 'null');
                }
                catch {
                    this.local = null;
                }
                if (!this.local || this.local.version !== 2)
                    this.local = newDirector(safeUUID());
            }
            const working = structuredClone(this.local);
            result = await dispatch(working, payload);
            this.local = working;
            try { localStorage.setItem('campus-director-local-v2', JSON.stringify(this.local)); }
            catch { /* Private browsing and storage restrictions must not stop RPG progression. */ }
        }
        this.state = result.state;
        this.hooks.receipts(this.state.worldId, this.state.receipts);
        this.updateBadge();
        this.hooks.onWorldUpdate();
        return result;
    }
    async init() { try {
        await this.request({ action: 'bootstrap' });
        this.updateBadge();
    }
    catch {
        this.hooks.toast('이야기 저장소를 불러오지 못했습니다. 이야기 메뉴에서 다시 시도하세요.');
    } }
    updateBadge() { const el = document.querySelector('#story-status'), major = this.hooks.snapshot().major, h = this.state?.adventure?.heroes[major]; if (!el)
        return; const head = document.querySelector('.quest-item strong'), body = document.querySelector('.quest-item span'); if (h) {
        const c = campaigns[major], ch = currentChapter(h), targets = fieldObjects(h);
        el.textContent = c.title + ' · ' + (h.finished ? '선택 이후의 이야기' : ch.title);
        if (head)
            head.textContent = '◆ [모험] ' + (h.finished ? '새로운 후일담' : ch.title);
        if (body)
            body.textContent = (h.finished ? locationNames[targets.region] : locationNames[ch.region]) + ' · ' + (h.finished ? '결말 이후에도 인연은 이어집니다' : h.accepted ? '동료와 흔적을 찾아 탐험하세요' : '모험을 시작해 주세요');
    }
    else {
        el.textContent = '일곱 전공, 서로 다른 모험의 시작';
        if (head)
            head.textContent = '◆ [시작] 나의 모험과 역할 선택';
        if (body)
            body.textContent = '붉은 인장 · 잃어버린 소리 · 도망친 주인공…';
    } }
    async onRegion() { if (this.state) {
        try {
            await this.request({ action: 'bootstrap' });
            this.updateBadge();
        }
        catch { /* world exploration stays playable */ }
    } }
    async onLegacy() { if (this.state) {
        try {
            await this.request({ action: 'bootstrap' });
            this.updateBadge();
        }
        catch { /* retry on next open */ }
    } }
    error(e) { this.hooks.toast(e instanceof Error ? e.message : '이야기 요청을 처리하지 못했습니다.'); }
    async hub(tab = 'today') { const revision = ++this.revision; const root = this.hooks.open('이어지는 캠퍼스 이야기', '기억이 쌓이고, 다음 이야기가 시작됩니다', `<p class="director-loading">연구 기록을 펼치는 중…</p>`); try {
        await this.request({ action: 'bootstrap' });
        if (revision !== this.revision || !root.isConnected)
            return;
        this.renderHub(root, tab);
    }
    catch (e) {
        this.error(e);
        root.innerHTML = '<p>기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
    } }
    renderHub(root, tab) {
        const s = this.state;
        const tabs = [['today', '오늘의 이야기'], ['continuing', '이어지는 이야기'], ['relations', 'NPC 관계 일지'], ['research', '대학원 연구 일지'], ['past', '지난 이야기'], ['proposals', '새 연구 제안'], ['decisions', '선택 기록'], ['unresolved', '미해결 사건'], ['preview', '다음 이야기 예고'], ['system', '생성 상태']];
        root.innerHTML = `<div class="director-layout"><nav class="director-tabs">${tabs.map(([id, label]) => `<button data-journal="${id}" class="${id === tab ? 'selected' : ''}">${label}</button>`).join('')}</nav><div class="director-page"></div></div>`;
        root.querySelectorAll('[data-journal]').forEach(b => b.onclick = () => this.renderHub(root, b.dataset.journal));
        const page = root.querySelector('.director-page');
        const add = (label, fn, cls = 'option') => page.append(this.hooks.button(label, fn, cls));
        if (tab === 'today') {
            const ev = s.world.events.at(-1);
            page.innerHTML = `<div class="journal-date">${s.day} · 봄날의 캠퍼스</div><h3>${esc(ev?.title || '새로운 이야기')}</h3><p>${esc(ev?.summary || '새로운 연구 제안을 확인하세요.')}</p><div class="reward">${esc(s.absence)}</div><p class="help">${this.transport === 'local' ? '로컬 저장 · 규칙 생성' : '서버 저장 · ' + (s.mode === 'ai' ? '최근 AI 생성 사용' : '규칙 생성 모드')} · AI 미연결 시에도 탐험과 학습이 계속됩니다.</p>`;
            add('오늘의 연구 제안 살펴보기', () => this.renderHub(root, 'proposals'), 'option primary');
        }
        if (tab === 'continuing' || tab === 'unresolved' || tab === 'proposals') {
            const current = s.quests.filter(q => ['offered', 'active'].includes(q.status));
            page.innerHTML = `<h3>${tab === 'proposals' ? '나를 위한 연구 제안' : tab === 'unresolved' ? '아직 풀리지 않은 질문' : '선택에서 이어지는 다음 장'}</h3>`;
            for (const q of current) {
                const b = this.hooks.button(`<span class="quest-tag">${q.quest_kind} · ${q.phase} · 난이도 ${q.difficulty}</span><br><b>${esc(q.title)}</b><br><small>${locationNames[q.location_id]} · ${q.status === 'active' ? '진행 중' : '수락 가능'}</small>`, () => this.showQuest(q.quest_id));
                page.append(b);
            }
            if (tab === 'unresolved') {
                page.insertAdjacentHTML('beforeend', s.arcs.filter(a => a.status === 'active').map(a => `<div class="journal-card"><b>${esc(a.topic)}</b><p>${esc(a.clue)}</p></div>`).join(''));
            }
            add('전공에 맞는 새 연구 제안 받기', () => void this.generate(), 'option primary');
        }
        if (tab === 'relations') {
            page.innerHTML = '<h3>함께 만들어 온 관계</h3>';
            for (const n of npcs) {
                const r = s.relations.find(r => r.npc?.id === n.id);
                page.append(this.hooks.button(`<b>${n.name}</b> · ${n.job}<br><small>${r ? `친밀도 ${r.affinity} · 신뢰도 ${r.trust} · 대화 ${r.turns}회` : '아직 만나지 않은 인연'}</small>`, () => this.relationPage(n.id)));
            }
        }
        if (tab === 'research') {
            page.innerHTML = `<h3>쌓여 가는 연구</h3><div class="reward">동적 연구 경험치 ${s.stats.xp}<br>학습 성취 ${s.stats.correct} / ${s.stats.attempts}회<br>완료 연구 ${s.quests.filter(q => q.status === 'completed').length} · 해결한 이야기 ${s.arcs.filter(a => a.status === 'resolved').length}</div>${s.arcs.slice(-12).reverse().map(a => `<div class="journal-card"><b>${esc(a.topic)}</b> · ${a.status === 'resolved' ? '해결' : '진행 중'}<p>${a.episode}/4장 · ${esc(a.lastOutcome || a.cause)}</p></div>`).join('')}`;
        }
        if (tab === 'past') {
            page.innerHTML = `<h3>지난 이야기</h3><p>${esc(s.absence)}</p>${s.summary ? `<details><summary>이전 기록 요약</summary><p>${esc(s.summary).replace(/\n/g, '<br>')}</p></details>` : ''}${s.episodes.slice().reverse().map(e => `<div class="journal-card"><small>${e.day}</small><p>${esc(e.text)}</p></div>`).join('')}`;
        }
        if (tab === 'decisions') {
            page.innerHTML = `<h3>내가 선택한 길</h3>${s.decisions.length ? s.decisions.slice().reverse().map(d => `<div class="journal-card"><b>${esc(d.title)}</b><p>${esc(d.choice)}</p><small>${esc(d.result)}</small></div>`).join('') : '<p>연구를 진행하고 첫 선택을 남겨 보세요.</p>'}`;
        }
        if (tab === 'preview') {
            page.innerHTML = `<h3>아직 펼쳐지지 않은 이야기</h3><p>아래 내용은 가능한 후속 이야기의 단서이며, 이미 발생한 사실은 아닙니다.</p>${s.world.hooks.map(h => `<div class="journal-card">${esc(h)}</div>`).join('') || '<p>첫 연구의 선택이 다음 이야기의 단서가 됩니다.</p>'}`;
        }
        if (tab === 'system') {
            page.innerHTML = `<h3>게임 마스터 상태</h3><div class="reward">저장 위치 · ${this.transport === 'server' ? '서버의 독립 세션 저장소' : '현재 브라우저 로컬 저장소'}<br>최근 생성 · ${s.mode === 'ai' ? 'AI + 규칙 검증' : '규칙 기반 조합 생성'}<br>AI 요청 ${s.usage.requests}회 · 대체 처리 ${s.usage.failures}회<br>입력 토큰 ${s.usage.inputTokens} · 출력 토큰 ${s.usage.outputTokens}<br>추정 비용 · ${s.usage.estimatedCostUSD === null ? '서버 요금 설정 없음' : s.usage.estimatedCostUSD.toFixed(5) + ' USD'}</div><p class="help">API 키가 설정되지 않으면 외부 AI는 호출되지 않습니다. 규칙 생성은 제한된 학습 자료와 사건 구조를 조합하며, 무한히 새로운 학술 지식을 만들지는 않습니다.</p>`;
            add('전체 이야기 기록 내려받기', () => void (async () => { const result = await this.request({ action: 'export' }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(result.archive, null, 2)], { type: 'application/json' })); a.download = '캠퍼스-이야기-기록.json'; a.click(); URL.revokeObjectURL(a.href); })());
        }
    }
    async generate() { if (this.busy)
        return; this.busy = true; const root = this.hooks.open('새로운 연구 제안', '게임 마스터가 이전 선택을 살펴봅니다', '<p class="director-loading">관련 기억을 찾아 연구를 엮는 중…</p>'); try {
        const r = await this.request({ action: 'generate' });
        if (root.isConnected) {
            const q = r.quest || r.state.quests.filter(q => ['active', 'offered'].includes(q.status)).at(-1);
            if (q)
                await this.showQuest(q.quest_id);
        }
    }
    catch (e) {
        this.error(e);
    }
    finally {
        this.busy = false;
    } }
    async showQuest(id) {
        const s = this.state;
        const q = s.quests.find(q => q.quest_id === id);
        if (!q)
            return;
        const root = this.hooks.open(q.title, `${q.quest_kind} · ${q.phase} · 난이도 ${q.difficulty}`, `<p>${esc(q.summary)}</p><div class="reward">학습 목표 · ${esc(q.learning_goal)}<br>장소 · ${locationNames[q.location_id]}<br>협력자 · ${npcs.find(n => n.id === q.npc_ids[0]).name}<br>보상 · 경험치 ${q.rewards.xp} / 전공 능력 ${q.rewards.research}</div><ol class="quest-steps">${q.objectives.map((o, i) => `<li class="${o.done ? 'done' : ''}">${o.done ? '✓' : '○'} ${['지정 지역의 NPC와 자료 조사', '검증된 학습 자료로 문제 풀기', '연구 방식 선택 및 결과 기록'][i]}</li>`).join('')}</ol>`);
        const action = async (action) => { try {
            const r = await this.request(action);
            if (r.feedback)
                this.hooks.toast(r.feedback);
            await this.showQuest(id);
        }
        catch (e) {
            this.error(e);
        } };
        if (q.status === 'offered')
            root.append(this.hooks.button('연구 의뢰 수락', () => void action({ action: 'start', questId: id }), 'option primary'));
        if (q.status === 'active' && !q.objectives[0].done)
            root.append(this.hooks.button('해당 지역으로 가서 NPC 만나기', () => { this.hooks.travel(q.location_id); this.hooks.toast(`${npcs.find(n => n.id === q.npc_ids[0]).name}를 눌러 자료 조사를 시작하세요.`); }));
        if (q.status === 'active' && q.objectives[0].done && !q.objectives[1].done) {
            root.insertAdjacentHTML('beforeend', `<h3>${esc(q.lesson.question)}</h3>`);
            q.lesson.answers.forEach((a, i) => root.append(this.hooks.button(`${i + 1}. ${esc(a)}`, () => void action({ action: 'answer', questId: id, answer: i }))));
            root.insertAdjacentHTML('beforeend', `<p class="help">학습 근거 · <a href="${q.lesson.url}" target="_blank" rel="noopener">${esc(q.lesson.source)}</a><br>기초 개념을 교육용으로 요약한 자료입니다. 허구의 사건과 구분해 읽어 주세요.</p>`);
        }
        if (q.status === 'active' && q.objectives[1].done)
            q.choices.forEach(c => root.append(this.hooks.button(esc(c.label), () => void (async () => { try {
                await this.request({ action: 'decide', questId: id, choice: c.id });
                this.hooks.toast('연구 완료! 결과에서 새로운 연구 제안이 이어졌습니다.');
                await this.hub('continuing');
            }
            catch (e) {
                this.error(e);
            } })())));
        if (q.status === 'active')
            root.append(this.hooks.button('이번 조사를 보류하고 새 접근 찾기', () => void (async () => { await this.request({ action: 'abandon', questId: id }); await this.hub('proposals'); })()));
    }
    async attachNPC(root, npcId) { const n = npcs.find(n => n.id === npcId); if (!n)
        return; const marker = document.createElement('div'); marker.className = 'dynamic-npc'; marker.innerHTML = '<div class="reward">기억 속 인연을 불러오는 중…</div>'; root.prepend(marker); try {
        await this.request({ action: 'history', npcId });
        if (!marker.isConnected)
            return;
        const r = this.state.relations.find(r => r.npc?.id === npcId);
        const greeting = r?.known.length ? `함께 살펴본 자료가 있지요. 남은 질문을 이어서 이야기해 볼까요?` : '반가워요. 오늘은 어떤 이야기를 함께 나눠 볼까요?';
        marker.innerHTML = `<div class="reward"><b>${n.name}</b> · 친밀도 ${r?.affinity || 0} / 신뢰도 ${r?.trust || 0}<br>${greeting}</div>`;
        marker.append(this.hooks.button('자유 대화 · 직접 이야기하기', () => void this.conversation(npcId), 'option primary'));
        const quests = this.state.quests.filter(q => q.status === 'active' && q.npc_ids.includes(npcId) && !q.objectives[0].done);
        quests.forEach(q => marker.append(this.hooks.button(`자료 조사 · ${esc(q.title)}`, () => void (async () => { try {
            await this.request({ action: 'visit', questId: q.quest_id, npcId });
            await this.showQuest(q.quest_id);
        }
        catch (e) {
            this.error(e);
        } })())));
        marker.append(this.hooks.button('새로운 연구 이야기', () => void this.hub('continuing')));
    }
    catch (e) {
        marker.textContent = '이야기 기록 연결을 다시 시도해 주세요.';
        this.error(e);
    } }
    async conversation(npcId) { const n = npcs.find(n => n.id === npcId); const root = this.hooks.open(n.name, '자유 대화 · 선택과 기억이 쌓이는 인연', `<div class="npc-conversation" aria-live="polite"></div><div class="talk-input"><input id="npc-input" maxlength="400" placeholder="한국어로 궁금한 것을 물어보세요…" aria-label="NPC에게 할 말"><button id="npc-send">이야기하기</button></div><div class="talk-suggestions"></div><small class="help" id="talk-source"></small>`); const list = root.querySelector('.npc-conversation'); const render = () => { const r = this.state?.relations.find(r => r.npc?.id === npcId); list.innerHTML = (r?.recent || []).map(t => `<div class="talk-bubble ${t.role}"><small>${t.role === 'user' ? '나' : n.name}</small><p>${esc(t.text)}</p></div>`).join('') || '<p>새로운 인연에게 첫 인사를 건네 보세요.</p>'; list.scrollTop = list.scrollHeight; }; render(); let sending = false; const send = async (text) => { const input = root.querySelector('#npc-input'); const value = text || input.value.trim(); if (!value || sending)
        return; sending = true; const btn = root.querySelector('#npc-send'); btn.disabled = true; btn.textContent = '생각하는 중…'; try {
        const res = await this.request({ action: 'talk', npcId, text: value });
        if (root.isConnected) {
            input.value = '';
            render();
            root.querySelector('#talk-source').textContent = res.source === 'ai' ? 'AI 대화 · 검증된 기억 참조' : '규칙 기반 대화 · AI 미연결 또는 대체 처리';
        }
    }
    catch (e) {
        this.error(e);
    }
    finally {
        sending = false;
        btn.disabled = false;
        btn.textContent = '이야기하기';
    } }; root.querySelector('#npc-send').addEventListener('click', () => void send()); root.querySelector('input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter')
        void send(); }); const suggestions = root.querySelector('.talk-suggestions'); (npcId.startsWith('npc-ad-') ? ['지난 일을 기억하나요?', '다음에는 어디로 가야 하죠?', '그 적의 약점은 무엇인가요?'] : ['지난 연구를 기억하나요?', '오늘 연구 주제를 상담하고 싶어요', '다른 관점으로 해석할 수 있을까요?']).forEach(t => suggestions.append(this.hooks.button(t, () => void send(t)))); suggestions.append(this.hooks.button(npcId.startsWith('npc-ad-') ? '다음 여정에도 함께하기로 약속' : '다음 자료를 함께 검토하기로 약속', () => void (async () => { try {
        await this.request({ action: 'pledge', npcId });
        this.hooks.toast('공동 연구 약속을 관계 일지에 남겼습니다.');
    }
    catch (e) {
        this.error(e);
    } })())); }
    relationPage(id) { const n = npcs.find(n => n.id === id); const r = this.state.relations.find(r => r.npc?.id === id); const root = this.hooks.open(n.name + ' 관계 일지', `${n.nation} · ${n.job}`, `<p>${esc(n.personality)} · ${esc(n.tone)}</p><p>개인 목표 · ${n.goal}</p><div class="reward">${r ? `첫 만남 ${r.firstMet}<br>친밀도 ${r.affinity} / 신뢰도 ${r.trust}<br>${esc(r.summary)}` : '아직 이야기를 나누지 않았습니다.'}</div><p>약속 · ${r?.promises.map(esc).join(', ') || '아직 없음'}</p><p>남은 질문 · ${r?.unresolved.map(esc).join(', ') || '아직 없음'}</p>`); root.append(this.hooks.button('NPC가 있는 지역으로 이동', () => this.hooks.travel(n.location))); }
}
