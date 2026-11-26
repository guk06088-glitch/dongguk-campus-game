export const majors = [
    { name: '고전문학', ability: '고전 해독', desc: '옛 문장 속에서 오늘의 지혜를 발견합니다.', area: 2, quest: '춘향전의 작자와 전승을 탐구해요', question: '판소리계 소설의 특징은 무엇일까요?', answers: ['입에서 입으로 전승되며 다양한 판본이 생깁니다.', '모든 작품의 작자가 같습니다.', '오직 한문으로만 쓰였습니다.'], correct: 0 },
    { name: '국어학', ability: '언어 분석', desc: '우리말의 소리와 문법, 의미를 연구합니다.', area: 1, quest: '우리말의 높임 표현을 분석해요', question: '교수님께 드리는 적절한 표현은?', answers: ['교수님이 밥 먹어.', '교수님께서 식사하십니다.', '교수가 먹는다.'], correct: 1 },
    { name: '문예창작', ability: '창작', desc: '상상력을 이야기와 시로 빚어냅니다.', area: 2, quest: '봄을 담은 한 문장을 창작해요', question: '봄을 의인화한 문장은 무엇일까요?', answers: ['봄은 세 번째 계절이다.', '기온은 18도다.', '봄이 살며시 창문을 두드렸다.'], correct: 2 },
    { name: '현대문학', ability: '비평', desc: '문학을 통해 시대와 삶의 의미를 읽습니다.', area: 2, quest: '시의 화자와 작가를 구별해요', question: '시의 화자는 누구일까요?', answers: ['시 속에서 말하는 목소리입니다.', '언제나 실제 작가입니다.', '시를 출판하는 사람입니다.'], correct: 0 },
    { name: '한국어교육', ability: '교수', desc: '언어와 문화를 잇는 한국어 선생님으로 성장합니다.', area: 1, quest: '한국어 인사 표현 가르치기', question: '처음 만난 교수님께 정중하게 인사하려면?', answers: ['안녕! 잘 지내?', '처음 뵙겠습니다. 만나 뵙게 되어 반갑습니다.', '밥 먹었어?'], correct: 1 },
    { name: '국제다문화학', ability: '문화 소통', desc: '다양성을 존중하며 함께 살아갈 방법을 찾습니다.', area: 3, quest: '서로 다른 문화의 대화법을 배워요', question: '문화 차이를 만났을 때 적절한 태도는?', answers: ['내 문화만 옳다고 주장합니다.', '차이를 무시합니다.', '상대의 맥락을 묻고 경청합니다.'], correct: 2 },
    { name: '한국·아시아문화학', ability: '문화 탐구', desc: '한국과 아시아의 연결된 문화유산을 탐험합니다.', area: 3, quest: '아시아 문화유산의 가치를 탐구해요', question: '문화유산을 탐구하는 좋은 방법은?', answers: ['지역의 역사와 사람들의 이야기를 함께 살핍니다.', '외형만 비교합니다.', '모든 문화를 하나로 단정합니다.'], correct: 0 }
];
export const regions = [
    { name: '전공 선택 마을', sub: '당신의 배움이 시작되는 곳', quest: '나의 연구 여정', npcs: ['대학원 행정관', '김서연 교수', '신입생 하린'], buildings: ['고전문학', '국어학', '문예창작', '현대문학', '한국어교육', '국제다문화학', '한국·아시아문화학'] },
    { name: '한국어교육 실습 광장', sub: '언어를 배우고, 마음을 잇다', quest: '한국어 인사 표현 가르치기', npcs: ['한국어교육 교수', '가브리엘 · 브라질', '소피아 · 영국'], buildings: ['한국어교육학관', '한국어 학습 카페', '수업 준비실', '한국어교육 실습실', '교수 연구실'] },
    { name: '한양 문예시장', sub: '책장을 넘기면 이야기가 시작된다', quest: '사라진 필사본', npcs: ['이선생 · 문학 연구자', '서책전 주인', '이야기꾼'], buildings: ['규장각', '서책전', '문학회관', '이야기 마당', '필사·서화원'] },
    { name: '국제다문화 교류 광장', sub: '서로 다른 우리가 만나는 봄', quest: '문화의 다리, 하나의 축제', npcs: ['라니 · 문화교류 담당자', '루카 · 이탈리아', '아야카 · 일본'], buildings: ['문화교류관', '다문화 체험관', '한국·아시아문화관', '문화유산 탐사소', '축제 운영 본부'] }
];
export const fresh = () => ({ name: '동국대 대학원생', major: -1, xp: 0, level: 1, region: 0, completed: [], items: ['새내기 연구 수첩'], visited: [], research: [0, 0, 0, 0, 0, 0, 0], festival: -1, accepted: [], day: '' });
export function load() { try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem('dongguk-rpg-v1') || '{}') };
}
catch {
    return fresh();
} }
// 저장공간이 차단된 브라우저(개인정보 보호 모드 등)에서도 게임이 중단되지 않게 합니다.
export function persist(s) {
    try {
        localStorage.setItem('dongguk-rpg-v1', JSON.stringify(s));
        return true;
    } catch (error) {
        console.warn('RPG save unavailable in current browser', error);
        return false;
    }
}
