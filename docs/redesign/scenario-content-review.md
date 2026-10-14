# 시나리오 설명 검토 및 재작성

2026-10-08 · 05–16의 12편 · 94개 장면

[실제 시나리오 목록](https://leedonghyun00.github.io/CAwiki/#stories) · [장면 원본](../../design/redesign/expansion/storyboards.json)

## 문장 기준

화면에는 보이는 변화와 그 원인을 한 문장으로 적었다
새 용어는 필요한 곳에서 쉬운 뜻을 먼저 말하고 상세 설명에서 이름을 소개한다
예를 들어 `DMA 전송`만 적는 대신 `장치가 RAM에서 기록할 데이터를 가져옵니다`라고 쓰고, DMA와 CPU의 역할은 상세 설명에 구분했다

특정 앱·운영체제·장치의 동작을 모든 컴퓨터의 유일한 처리 순서로 단정하지 않는다
드래그는 이해를 위한 순서를 펼치며 실제 작업들은 겹쳐 실행될 수 있다
조립된 모델 옆의 주소·버퍼·문서·파형은 논리적인 상태 표현이다
물리 칩, 실제 배선, 실제 시간 축척으로 설명하지 않는다

## 사실성 검토

| 주제 | 검토 후 반영한 내용 | 근거 |
|---|---|---|
| 타이핑 | 키 정보와 문자를 구별하고, 포커스를 가진 앱과 입력기가 해석하는 단계 추가 / ㄱ이 조합 중인 문서에서 K 키로 ㅏ를 입력하는 예시로 연출과 설명을 맞춤 | [Microsoft 키보드 입력](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input) |
| 프로그램 실행 | 프로세스와 스레드, 가상 주소 공간과 실제 RAM 사용을 구별 / 필요한 페이지가 없을 때 가져오는 단계 추가 | [Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set) |
| 저장 | 앱의 쓰기 요청·RAM 대기·장치 명령·데이터 전송·NAND 기록·동기화 완료를 구별 / 저장 표시만으로 보존을 보장하지 않음 | [파일 캐시](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching), [버퍼 동기화](https://learn.microsoft.com/en-us/windows/win32/fileio/flushing-system-buffered-i-o-data-to-disk) |
| 음악 | 압축된 파일·PCM 샘플·버퍼·DAC·증폭기·스피커 진동을 구별 / 자동 음성 재생 없이 시각적으로 표현 | [오디오 버퍼와 WASAPI](https://learn.microsoft.com/en-us/windows/win32/coreaudio/wasapi) |
| 스트리밍 | 네트워크 공급과 재생 소비를 구별 / 버퍼 부족과 회복을 별도 장면으로 구현 / GPU 디코더는 지원되는 경우의 경로 | [NVDEC](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvdec-application-note/index.html) |
| 화상통화 | 카메라와 마이크 입력, 압축, 인터넷 전송, 상대방의 지터 버퍼·복원·동기화를 구별 / 릴레이 가능성을 설명 | [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API), [미디어 캡처](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API) |
| 멀티태스킹 | 실행 가능한 스레드·I/O 대기·멀티코어 병렬 실행·문맥 전환을 구별 / 문맥 전환이 프로그램 전체를 디스크에 쓰는 과정이라고 표현하지 않음 | [문맥 전환](https://learn.microsoft.com/en-us/windows/win32/procthread/context-switches) |
| USB | 연결 감지·열거·주소·디스크립터·드라이버·구성을 구별 / 저장장치 예시이며 모든 USB가 드라이브는 아님 / 기존 드라이버를 바로 사용할 수 있음 | [USB 디스크립터](https://learn.microsoft.com/en-us/windows-hardware/drivers/usbcon/standard-usb-descriptors) |
| 절전 | 대표적인 S3에서 RAM 유지 전원이 필요함을 표시 / Modern Standby·최대 절전과 구별 | [Modern Standby와 S3](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/modern-standby-vs-s3) |
| AI | 클라우드 서버의 계산과 내 컴퓨터의 표시를 구별 / 토큰은 한 글자나 한 단어와 항상 같지 않음 / 모델 가중치와 중간 상태를 사용해 다음 토큰을 계산 | [텍스트 생성](https://huggingface.co/docs/transformers/llm_tutorial) |
| 게임 로딩 | 자산 읽기·압축 해제·그래픽 자원 준비·렌더링·추가 스트리밍을 구별 / GPU 압축 해제는 지원되는 경우이며 모든 게임의 필수 경로가 아님 | [DirectStorage의 CPU·GPU 압축 해제](https://devblogs.microsoft.com/directx/directstorage-1-1-now-available/) |
| 화면 녹화 | 이미 그려진 프레임의 캡처·인코딩·오디오 시간·컨테이너·쓰기·종료 마무리를 구별 / 캡처를 압축 해제처럼 그리던 개념 표현 수정 | [화면 캡처](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API), [전용 인코더](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-video-encoder-api-prog-guide/) |

위 문서는 운영체제나 API의 대표 구현을 확인하기 위한 근거다
제조사 한 곳의 하드웨어 기능을 모든 제품에 일반화하지 않았다
상세 설명의 `참고 자료 ↗`에서 관련 문서를 열 수 있다

## 저장 시나리오의 새 설명

1. **수정을 남기기로 하다** — Ctrl과 S를 누르면 앱이 변경 내용을 저장하기 시작합니다
2. **기록을 준비하다** — 앱이 파일에 쓸 내용을 운영체제에 전달합니다
3. **메모리에 잠시 머물다** — 변경 내용이 RAM의 쓰기 대기 공간에 모입니다
4. **장치에 쓰기를 지시하다** — 드라이버가 SSD에 기록할 위치와 데이터 위치를 알려줍니다
5. **SSD로 옮기다** — 장치가 RAM에서 기록할 데이터를 가져옵니다
6. **플래시에 기록하다** — SSD 안의 컨트롤러가 데이터를 플래시 메모리에 기록합니다
7. **대기 중인 기록을 끝내다** — 앱이 기록을 마무리해 달라고 요청하고 완료를 기다립니다
8. **완료를 확인하다** — 기록 완료를 확인한 앱이 저장됨을 표시합니다

이 흐름은 동기화 완료를 기다리는 앱의 예시다
실제 앱은 완료 표시 시점과 쓰기 전략이 다를 수 있으며, 전원 손실 보호와 장치 캐시 등도 보존 수준에 영향을 준다

## 장면 수

| 05 타이핑 | 06 실행 | 07 저장 | 08 음악 | 09 스트리밍 | 10 통화 |
|---|---|---|---|---|---|
| 7 | 8 | 8 | 7 | 8 | 9 |

| 11 멀티태스킹 | 12 USB | 13 절전 | 14 AI | 15 로딩 | 16 녹화 |
|---|---|---|---|---|---|
| 8 | 8 | 7 | 8 | 8 | 8 |

기존 네 편은 각 6개 기본 장면을 유지한다
추가 94개와 합해 기본 경로 총 118개 장면이며 파일 읽기의 캐시 비교 경로는 별도다
