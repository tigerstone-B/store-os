/**
 * STORE OS - vision.js
 * Vision AI (OpenAI) 기반 로드뷰 이미지 자동 평가.
 *
 * 입력: 업로드된 로드뷰 이미지(base64 data URL) + 매장 컨텍스트(주소/매장명)
 * 출력: 가시성(visibility) / 보행 접근성(pedestrian) / 배달 접근성(delivery)
 *       0~100 점수 + 항목별 판단 근거(reasoning) + 참고사항(notes)
 *
 * 주의:
 * - OPENAI_API_KEY는 서버 환경변수에만 존재 (섹션 5 규칙).
 * - 이 모듈이 평가하는 항목은 "이미지에서 관찰 가능한 것"으로 한정한다.
 *   역 접근성(거리 계산)과 주차(대수 입력)는 이미지만으로 신뢹성 있게
 *   판단하기 어려워 이 모듈의 평가 대상에서 제외했다 (프론트엔드에서
 *   별도 로직으로 처리).
 * - 로드뷰 이미지를 외부 AI 서비스로 전송하는 것이 NAVER 이용약관상
 *   문제가 없는지는 별도 확인이 필요하다 (법무/약관 검토 필요).
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

const SYSTEM_PROMPT = `
당신은 대한민국 F&B 프랜차이즈 매장의 외부 환경을 로드뷰(거리뷰) 이미지 한 장으로
평가하는 STORE CONSULTANT이다.

주어진 이미지에서 실제로 관찰되는 요소만 근거로 판단하고, 이미지에 없는 정보는
추정하지 않는다. 사진 각도, 촬영 시점, 화질에 따라 오차가 있을 수 있음을 전제한다.

다음 3개 항목을 각각 0~100점으로 평가한다.

1. visibility (가시성): 매장 전면/간판이 도로에서 얼마나 눈에 띄는지.
   - 간판 크기와 위치, 전면 유리 노출, 다른 간판/구조물에 가려짐 여부 등을 근거로 판단.
2. pedestrian (보행 접근성): 보행자가 매장에 접근하기 쉬운 환경인지.
   - 인도 폭, 보행 동선과의 거리, 횡단보도 인접 여부(이미지에서 보이는 경우) 등을 근거로 판단.
3. delivery (배달 접근성): 배달기사가 정차/진입하기 쉬운 환경인지.
   - 도로 폭, 정차 가능 공간, 매장 입구까지의 거리 등을 근거로 판단.

인과관계를 단정하지 않는다. "이 요인 때문에 매출이 낮다"와 같은 표현 대신
"~일 가능성을 검토할 수 있다", "~로 보인다" 와 같이 표현한다.

반드시 아래 JSON 형식으로만 응답한다. 다른 텍스트를 포함하지 않는다.

{
  "visibility": 0-100 정수,
  "pedestrian": 0-100 정수,
  "delivery": 0-100 정수,
  "reasoning": {
    "visibility": "판단 근거 (1~2문장)",
    "pedestrian": "판단 근거 (1~2문장)",
    "delivery": "판단 근거 (1~2문장)"
  },
  "notes": "이미지만으로 판단하기 어려운 부분이 있다면 명시 (없으면 빈 문자열)"
}
`.trim();

function clampScore(value) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

/**
 * @param {string} imageDataUrl - "data:image/jpeg;base64,..." 형태
 * @param {{ storeName?: string, address?: string }} context
 * @returns {Promise<{visibility:number,pedestrian:number,delivery:number,reasoning:object,notes:string}>}
 */
async function analyzeRoadviewImage(imageDataUrl, context) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image')) {
    throw new Error('INVALID_IMAGE_DATA');
  }

  const contextText =
    '매장명: ' + (context.storeName || '미상') +
    ' / 주소: ' + (context.address || '미상');

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: contextText + '\n\n첨부된 로드뷰 이미지를 평가해줘.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error('OPENAI_HTTP_' + response.status + (errText ? ' ' + errText.slice(0, 200) : ''));
  }

  const data = await response.json();
  const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

  if (!raw) {
    throw new Error('OPENAI_EMPTY_RESPONSE');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('OPENAI_RESPONSE_NOT_JSON');
  }

  return {
    visibility: clampScore(parsed.visibility),
    pedestrian: clampScore(parsed.pedestrian),
    delivery: clampScore(parsed.delivery),
    reasoning: {
      visibility: (parsed.reasoning && parsed.reasoning.visibility) || '',
      pedestrian: (parsed.reasoning && parsed.reasoning.pedestrian) || '',
      delivery: (parsed.reasoning && parsed.reasoning.delivery) || '',
    },
    notes: parsed.notes || '',
  };
}

module.exports = { analyzeRoadviewImage };
