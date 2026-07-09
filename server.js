require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 규칙 기반으로 이미 계산된 추천(rules)과 사용자 프로필, 오늘의 날씨를
 * Claude에게 전달해서 더 자연스러운 문장의 맞춤 코멘트를 받아오는 엔드포인트.
 *
 * - ANTHROPIC_API_KEY가 없으면 앱의 핵심 기능(규칙 기반 추천)에는 영향이 없고,
 *   이 엔드포인트만 안내 메시지를 반환합니다.
 */
app.post('/api/recommend', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.includes('여기에-발급받은-키')) {
    return res.status(400).json({
      error:
        'ANTHROPIC_API_KEY가 설정되지 않았어요. 프로젝트 루트에 .env 파일을 만들고 API 키를 추가한 뒤 서버를 다시 시작해주세요.',
    });
  }

  const { profile, weather, rules } = req.body || {};
  if (!profile || !weather || !rules) {
    return res.status(400).json({ error: 'profile, weather, rules 정보가 모두 필요해요.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildUserMessage(profile, weather, rules) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API 오류:', response.status, errText);
      return res.status(502).json({
        error: 'AI 추천을 가져오는 중 문제가 발생했어요. API 키와 모델명을 확인해주세요.',
      });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ comment: text || '아직 답변을 만들지 못했어요. 잠시 후 다시 시도해주세요.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버에서 예상치 못한 오류가 발생했어요.' });
  }
});

function buildSystemPrompt() {
  return `당신은 "날씨 기반 맞춤 코디 & 헬스케어 스타일리스트"입니다.
사용자의 프로필(성별, 모발 타입, 피부 타입, 보유 제품, 메이크업 선호 여부)과 오늘의 날씨 데이터,
그리고 이미 규칙 기반으로 계산된 추천 결과(rules)를 함께 전달받습니다.

당신의 역할:
- rules에 담긴 규칙 기반 추천을 그대로 반복하지 말고, 하나의 자연스럽고 따뜻한 대화체 코멘트로 재구성하세요.
- 오늘 날씨에서 가장 신경 써야 할 1~2가지 포인트를 짚어주고, 사용자가 실제로 가지고 있는 제품 이름을 활용해 구체적으로 조언하세요.
- 보유 제품 중 적절한 것이 없다면, 어떤 "종류"의 제품을 쓰면 좋을지 제안하되 실존 여부가 불확실한 특정 브랜드명을 지어내지 마세요.
- 의학적 효과를 보장하는 표현(예: "완전히 막아준다", "무조건 낫는다")은 사용하지 마세요.
- 민감성 피부나 피부 질환이 언급된 경우, 필요하다면 전문가 상담을 가볍게 권해도 좋습니다.
- 결과는 마크다운 헤더나 목록 없이, 이어지는 3~5문장의 자연스러운 한국어 문단으로 작성하세요.`;
}

function buildUserMessage(profile, weather, rules) {
  return [
    '아래 정보를 참고해서 오늘의 맞춤 코멘트를 작성해주세요.',
    '',
    '[사용자 프로필]',
    JSON.stringify(profile, null, 2),
    '',
    '[오늘의 날씨]',
    JSON.stringify(weather, null, 2),
    '',
    '[규칙 기반 추천 결과]',
    JSON.stringify(rules, null, 2),
  ].join('\n');
}

app.listen(PORT, () => {
  console.log(`✅ 서버가 실행되었어요: http://localhost:${PORT}`);
});
