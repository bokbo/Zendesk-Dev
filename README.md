# Zendesk-app 배포 가이드

## 1단계: GitHub 레포 생성 & 업로드

1. GitHub에서 새 레포 생성 (예: `zendesk-app`)
2. 아래 파일 업로드:
   - `index.html`
   - `.github/workflows/deploy.yml`

## 2단계: Azure Static Web Apps 생성

1. Azure Portal → "Static Web Apps" 검색 → 만들기
2. 설정:
   - **구독**: 회사 구독 선택
   - **리소스 그룹**: 새로 만들거나 기존 선택
   - **이름**: `zendesk-app` (또는 원하는 이름)
   - **플랜**: Free
   - **배포 세부 정보**: GitHub 연결
   - **조직**: 본인 계정
   - **리포지토리**: zendesk-app
   - **분기**: main
   - **빌드 사전 설정**: Custom
   - **앱 위치**: `/`
   - **출력 위치**: (비워두기)
3. 검토 + 만들기

→ 배포 완료 후 URL 확인 (예: `https://icy-pond-012345.azurestaticapps.net`)

## 3단계: manifest.json URL 교체

`teams-package/manifest.json` 에서 `YOUR-APP` 부분을 실제 URL로 교체:
```
https://YOUR-APP.azurestaticapps.net
           ↓
https://icy-pond-012345.azurestaticapps.net
```

## 4단계: Teams 앱 등록

1. `zendesk-app-teams.zip` 파일 사용 (manifest.json + 아이콘 2개)
2. Microsoft Teams → 앱 → 앱 관리 → 앱 업로드
3. 또는 Teams 관리 센터(admin.teams.microsoft.com)에서 업로드

## 파일 구조
```
zendesk-app/
├── index.html                    ← 웹앱 본체
├── README.md
├── .github/workflows/deploy.yml  ← GitHub Actions 자동배포
└── teams-package/
    ├── manifest.json             ← Teams 앱 설정
    ├── color.png                 ← 앱 아이콘 (192x192)
    └── outline.png               ← 앱 아이콘 (32x32)

zendesk-app-teams.zip             ← Teams에 업로드할 패키지
```