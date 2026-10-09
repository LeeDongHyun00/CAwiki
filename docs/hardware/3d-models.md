# 하드웨어 3D 모델의 참고 자료와 범위

확인일: 2026-10-07. 공개 제품 사양과 외형 자료를 바탕으로 직접 작성한 절차적 메시입니다.
제조사 원본 CAD나 사진 텍스처를 배포하지 않습니다. 모델의 작은 구조와 조립 내부는 교육용
근사치이며, 분해 슬라이더는 실제 정비·분해 순서를 뜻하지 않습니다.

| 모델 | 참고 자료 | 반영한 기준 |
| --- | --- | --- |
| CPU | [Intel Core i9-14900K 사양](https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html), [앞·뒷면 사진](https://tinhte.vn/thread/thu-nghiem-intel-core-i9-14900k-raptor-lake-refresh-danh-cho-ai.3727850/) | 37.5 × 45 mm 패키지, 덮개 윤곽, 접점 영역. 접점 수와 다이 구조는 근사 |
| GPU | [NVIDIA RTX 4090 FE](https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/) | 304 × 137 × 61 mm 외형 기준, 반대 면 팬, 금속 프레임, 방열핀. I/O와 핀 배열은 근사 |
| RAM | [Kingston DDR5 데이터시트 도면](https://www.kingston.com/datasheets/KF556C40BW-32.pdf) | 133.35 × 31.25 mm 표준 기판 기준. 방열판 없는 일반 UDIMM으로 모델링하며 해당 Kingston 제품 복제품은 아님 |
| SSD | [Samsung 990 PRO](https://www.samsung.com/uk/memory-storage/nvme-ssd/990-pro-1tb-nvme-pcie-gen-4-mz-v9p1t0bw/) | 80 × 22 × 2.3 mm 기준, M.2 접점과 라벨·칩 배치. 용량·생산 리비전별 배치 차이는 반영하지 않음 |
| 메인보드 | [ASUS PRIME Z790-P](https://www.asus.com/es/motherboards-components/motherboards/prime/prime-z790-p/techspec/) | 234 × 305 mm, DIMM 4개, LGA 소켓과 주요 슬롯. 회로·I/O·전원부 세부는 근사 |
| 팬 | [Noctua NF-A12x25 PWM](https://www.noctua.at/en/products/nf-a12x25-pwm/specifications) | 120 × 120 × 25 mm, 9엽 팬과 색상, 프레임. 공력 형상은 근사 |
| HDD | [Seagate BarraCuda Pro 데이터시트](https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/datasheets/pdfs/barracuda-pro-14-tb-DS1901-10-2006GB-en_EM.pdf) | 101.85 × 146.99 mm 기준. 커버·단일 플래터·액추에이터는 일반 구조 예시 |

PSU, NPU, SRAM, VRAM, SPI 플래시, 버스 슬롯, 모니터, 키보드, 오디오, 카메라, NIC,
라우터, 서버 랙, MCU, VRM, 마우스는 특정 SKU를 복제하지 않은 대표 구조 모델입니다.
NPU/SRAM/VRAM/MCU는 유사한 BGA 패키지를 사용하며 제품별 다이 구조를 나타내지 않습니다.

## 구현과 배포

- 실제 `BufferGeometry` / `InstancedMesh` / PBR 재질을 Three.js WebGL로 렌더링합니다.
- 작은 접점은 인스턴싱하여 그리기 호출 수를 줄입니다. 재질은 모델 내에서 공유합니다.
- 모델 전환 시 이전 메시·텍스처·재질을 해제합니다. 탭이 숨겨지면 렌더링을 중지합니다.
- 애니메이션 감소 설정에서는 관성 효과를 끄고, 자동 회전은 명시적으로 켠 경우만 동작합니다.
- 지도용 PNG는 `tools/render-models.py`로 동일 메시에서 재생성합니다. 별도 WebGL 컨텍스트를
  각 아이콘에 만들지 않습니다. 이미지 로딩 실패 시 기존 SVG 도형으로 돌아갑니다.
- GLB 내보내기는 조립 상태 모델을 새로 생성하며 mm에서 m로 스케일을 변환합니다.
- 외부 이미지·폰트·CDN을 런타임에 요청하지 않습니다.

Three.js 0.170.0: [공식 소스](https://github.com/mrdoob/three.js/tree/r170),
MIT 라이선스는 `lib/vendor/three/LICENSE`에 포함되어 있습니다.
