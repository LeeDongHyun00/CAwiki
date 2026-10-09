# CAwiki 배포

- 주소: https://cawiki-silicon-atlas.hp27654.chatgpt.site
- 공개 범위: 생성 계정 본인만 접근하는 비공개 사이트
- 호스팅 프로젝트: `appgprj_6ac58c4bf8e48191aaf97163c7d959a8`
- 배포용 체크아웃: `/workspace/cawiki-site`
- 설정 파일: `/workspace/cawiki-site/.openai/hosting.json`
- 정적 파일 위치: `dist`
- 루트: `map-design.html`을 `dist/index.html`에 복사한 디자인 시안
- 이전 홈: `dist/silicon.html`
- 2026-10-07 배포 성공, 소스 커밋: `e4dc72d58caa1f8edd610555c40eb5da1658844a`

후속 배포는 같은 프로젝트를 재사용합니다. 런타임 CDN이나 로컬 개발 서버가 필요하지 않습니다.
원본 개발 프로젝트는 `/workspace/CAwiki`에 유지합니다. 변경 시 필요한 정적 파일을 배포용
체크아웃에 반영하고, 푸시된 소스와 같은 상태를 저장·배포합니다. 인증 토큰은 파일에 보관하지 않습니다.
