# STORE OS — F&B STORE DIAGNOSIS SYSTEM

**배포 환경: GitHub + Vercel**

이 프로젝트는 GitHub 저장소에 코드를 두고, **Vercel**이 그 저장소를 읽어
서버리스 함수(Node.js)와 정적 파일(`index.html`)을 함께 배포하는 구조입니다.
GitHub Pages처럼 정적 파일만 서빙하는 방식으로는 `/api/*` 가 동작하지 않습니다
(서버 코드를 실행할 수 없기 때문). Vercel은 `/api` 폴더의 파일을 자동으로
서버리스 함수로 인식해 배포합니다.

**현재 기능 구성**

```
NAVER MAP 연결 → 주소 검색 → Marker/Panorama 표시
→ STORE CONDITION 입력 (역 접근성 자동계산 + AI 로드뷰 평가 + 수동 슬라이더)
→ STORE HEALTH SCORE (가중치 산출 + S/A/B/C/D 등급)
→ STORE DIAGNOSIS (규칙 기반 강점/이슈/개선 우선순위)
```

CSV/Excel 업로드, KPI, 매출 Chart(기획서 MVP2 범위)는 이번 버전에 포함되지
않았으며, 관련 코드는 아직 작성하지 않았습니다.

---

## 1. Vercel 환경 변수 설정 (필수)

`.env` 파일은 GitHub에 올라가지 않으므로, Vercel에 배포된 서비스가 키를
읽으려면 **Vercel 대시보드에 직접 등록**해야 합니다.

Vercel 프로젝트 → **Settings → Environment Variables** 에서 아래 값을 추가합니다.
(Production / Preview / Development 각 환경에 동일하게 추가 권장)

| Key | 설명 |
|---|---|
| `NAVER_MAP_CLIENT_ID` | NCP Maps(Web Dynamic Map) Client ID |
| `OPENAI_API_KEY` | OpenAI API 키 (로드뷰 이미지 AI 평가용) |
| `OPENAI_VISION_MODEL` | 선택. 미설정시 기본값 `gpt-4o` 사용 |

값을 추가/수정한 뒤에는 **재배포(Redeploy)** 해야 반영됩니다.
(Vercel 대시보드 → Deployments → 최신 배포 옆 `...` → Redeploy)

> **NAVER Maps Client ID 도메인 등록**: NCP 콘솔의 Maps 서비스 > Web 서비스 URL에
> Vercel이 부여한 도메인(예: `your-project.vercel.app`)과, 커스텀 도메인을 쓴다면
> 그 도메인도 등록해야 지도가 정상 로드됩니다.

## 2. 로컬에서 테스트하기

**방법 A — Vercel CLI (배포 환경과 동일하게 테스트, 권장)**

```bash
npm i -g vercel
cd store-os
vercel dev
```

`vercel dev`는 `/api` 폴더를 실제 배포와 동일한 방식(서버리스 함수)으로 로컬에서
실행해준다. 최초 실행 시 로그인 및 프로젝트 연결 절차를 따라가면 된다.
로컬 `.env` 파일을 만들어두면 `vercel dev`가 자동으로 읽는다 (`.env.example` 참고).

**방법 B — 기존 Express 서버 (참고용)**

```bash
cd store-os
npm install
cp .env.example .env   # 값 채우기
npm start
```

`server/server.js`는 로컬 개발/디버깅용으로 남겨둔 Express 서버다. `/api` 폴더의
Vercel 함수와 같은 로직(`server/vision.js`, `server/naver.js`)을 공유하므로 둘 중
편한 쪽으로 테스트하면 된다. **실제 배포는 Vercel 쪽 `/api` 함수가 담당한다.**

## 3. GitHub → Vercel 배포 흐름

1. 코드를 GitHub 저장소에 push.
2. Vercel 프로젝트가 해당 저장소에 연결되어 있으면 push할 때마다 자동 배포됨.
3. 배포 후 `https://<프로젝트명>.vercel.app` 접속해 확인.
4. 환경 변수를 새로 추가/변경했다면 1번 없이도 **수동 Redeploy**가 필요함
   (환경 변수는 배포 시점에 함수에 주입되기 때문).

## 4. 사용 흐름

1. 접속 → 프론트엔드가 `/api/map-config` 호출 → Vercel 함수가 환경변수의
   `NAVER_MAP_CLIENT_ID`를 반환 → 지도 SDK 로드.
2. 주소 검색 → 지도 이동 + Marker, 동일 좌표로 Panorama(거리뷰) 표시.
3. **STORE CONDITION**
   - 역 접근성: 지하철역명 입력 → `거리 계산` → 매장 좌표와의 직선거리 자동 계산 → 점수 산출
   - **AI ROADVIEW ASSESSMENT**: STREET VIEW 화면을 캡처/저장한 이미지를 업로드 →
     `AI 평가 실행` → 가시성/보행 접근성/배달 접근성 점수와 판단 근거가 자동으로 채워짐 →
     필요시 슬라이더를 직접 조정(오버라이드) 가능
   - 주차: 대수 입력 → 자동 환산
   - `진단 실행`
4. **STORE HEALTH SCORE**: 가중치 반영 점수 + 등급 + 항목별 breakdown
5. **STORE DIAGNOSIS**: 강점/이슈 + 개선 우선순위(규칙 기반)

## 5. API 아키텍처 (Secret Key 보호)

```
Browser
  ├─ GET  /api/map-config          → api/map-config.js          (NAVER Client ID 반환, 공개 식별자)
  ├─ GET  /api/store-search        → api/store-search.js         (NAVER Local Search, 현재 프론트 미사용)
  └─ POST /api/ai-visual-diagnosis → api/ai-visual-diagnosis.js  → server/vision.js → OpenAI Vision API
```

- `OPENAI_API_KEY`는 Vercel 환경변수에만 존재하며, 업로드된 로드뷰 이미지는
  요청 처리 후 저장하지 않는다 (요청 스코프 내에서만 사용).
- 역 접근성은 Local Search가 아니라 **NAVER Geocoder(클라이언트) + Haversine 직선거리**로
  계산한다 (도보 실거리 아님, 참고값).

## 6. Vercel 요청 용량 제한과 이미지 처리

Vercel 서버리스 함수는 요청 본문 크기 제한이 있다(무료/Hobby 플랜 기준 약 4.5MB,
플랜에 따라 다를 수 있음 — **정확한 현재 한도는 Vercel 공식 문서에서 확인 필요**).
로드뷰 사진 원본을 그대로 base64 인코딩하면 용량이 약 33% 불어나 제한에 걸릴 수 있어,
업로드 시점에 브라우저에서 **가로 최대 1280px로 축소 + JPEG 80% 압축**한 뒤 전송하도록
`index.html`에 구현해두었다 (`resizeImageForUpload()`). 그래도 매우 큰 원본(수십 MB)이나
저사양 기기에서는 여유를 두고 테스트가 필요하다.

## 7. AI 로드뷰 평가 — 반드시 확인해야 할 사항

- **평가 항목 한정**: AI는 이미지에서 관찰 가능한 **가시성 / 보행 접근성 / 배달 접근성** 3개만
  평가한다. 역 접근성(자동 거리계산)과 주차(대수 입력)는 이미지만으로 신뢰성 있게
  판단하기 어려워 AI 평가 대상에서 제외했다.
- **AI는 규칙이 아니라 모델 추론**이다. 같은 이미지도 촬영 각도·화질에 따라 점수가
  달라질 수 있어, 사람이 최종 확인 후 슬라이더로 조정하는 것을 전제로 설계했다.
- **약관 확인 필요**: 로드뷰(네이버 파노라마) 화면 캡처 이미지를 OpenAI 등 외부 AI 서비스로
  전송하는 것이 NAVER Cloud Platform 이용약관상 문제가 없는지는 이 프로젝트에서 판단할 수
  없다. 사내 실사용 전 법무/약관 검토가 필요하다.
- **비용**: Vision 모델 호출은 유료 API 호출이다. 사용량에 따라 비용이 발생한다.

## 8. STORE HEALTH SCORE 기준 (예시 · 확인 필요)

담당자 확인 결과 "일단 원안 그대로 사용"으로 결정되어 기획서 원안 값을 그대로
적용했다. 화면에도 동일 문구로 표시된다.

- 가중치: 접근성 25% · 가시성 25% · 주차 15% · 보행 20% · 배달 15%
- 등급 컷라인: S 90+ / A 80+ / B 70+ / C 60+ / D 60미만
- 주차 환산: 0대=0점, 10대 이상=100점, 비례

추후 원앤원 내부 확정 기준이 나오면 `index.html` 내 `HEALTH_WEIGHTS`,
`GRADE_CUTLINES`, `parkingScoreFromCount()` 3곳만 교체하면 된다.

## 9. 파일 구조

```
store-os/
├── index.html                  # 정적 프론트엔드 (CSS/JS 인라인 통합), Vercel이 그대로 서빙
├── api/                        # Vercel 서버리스 함수 (실제 배포에서 사용)
│   ├── map-config.js
│   ├── ai-visual-diagnosis.js
│   └── store-search.js         # 현재 프론트 미사용, 확장용
├── server/                     # 공유 로직 + 로컬 Express 개발 서버
│   ├── server.js               # 로컬 테스트용 (방법 B)
│   ├── naver.js                # NAVER Local Search 프록시 로직
│   └── vision.js                # OpenAI Vision 호출 로직 (api/와 server/ 공유)
├── package.json
├── .env.example                 # 로컬 개발용 (vercel dev / npm start)
├── .gitignore
└── README.md
```

MVP2 이후 추가될 예정인 `sales.js`, `chart.js`, `data/sample-sales.xlsx` 등은
설계 문서(STORE OS 기획서)에는 명시되어 있으나 **아직 생성하지 않았다.**

## 10. 알려진 제약

- KPI, 매출 업로드/차트는 미구현 (MVP2 범위).
- 매장명 검색(NAVER Local Search 후보 매칭)은 현재 프론트엔드에 연결되어 있지 않다
  (`api/store-search.js`는 존재하나 미사용).
- 역 접근성 거리는 직선거리이며 실제 도보 경로거리와 다를 수 있다.
- STORE HEALTH 가중치/등급/주차 환산 기준은 예시값이며 확정 필요 (섹션 8 참고).
- Vercel 요청 용량 제한의 정확한 수치는 플랜/시점에 따라 달라질 수 있어 배포 전
  Vercel 공식 문서 확인이 필요하다 (섹션 6 참고).
