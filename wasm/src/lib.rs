//! CAwiki 애니메이션 커널 (WebAssembly)
//!
//! 매 프레임 도는 애니메이션 수학 전부를 WASM에서 처리한다.
//!   - SVG path(`d` 문자열) 파싱 + 3차 베지어 평탄화 + 호길이 균등 재샘플링
//!   - 펄스(데이터 흐름 점) 전진 및 좌표 계산
//!   - 카메라 트윈 (이징 + 보간 + 최종 transform 값 산출)
//!
//! JS 쪽에 남는 일: DOM 속성 쓰기, CSS 상태 전환, 텍스트/접근성.
//! 즉 SVG의 강점(벡터 선명도·한글 텍스트·접근성 트리)은 그대로 두고
//! 계산만 네이티브로 내린다.
//!
//! 좌표계: 월드 1280×800 (viewBox와 동일).

#![allow(static_mut_refs)]

// ───────────────────────────── 자료구조 ─────────────────────────────

/// 호길이로 균등 재샘플링된 경로. 매 프레임 조회가 O(1)이 되도록
/// 파라미터 t(0..1)가 곧 배열 인덱스에 선형 대응한다.
struct Path {
    xs: Vec<f32>,
    ys: Vec<f32>,
    len: f32,
}

struct Pulse {
    path: u32,
    t: f32,
    speed: f32,
    reverse: bool,
}

struct Tween {
    x0: f64, y0: f64, s0: f64,
    x1: f64, y1: f64, s1: f64,
    t0: f64,
    ms: f64,
}

struct State {
    paths: Vec<Path>,
    pulses: Vec<Pulse>,
    out: Vec<f32>,      // 펄스당 [x, y]
    input: Vec<u8>,     // d 문자열 수신 스크래치
    cam: [f64; 3],      // x, y, scale
    tw: Option<Tween>,
    cam_out: [f32; 5],  // tx, ty, scale, camx, camy
    vw: f64,
    vh: f64,
}

static mut ST: Option<State> = None;

#[inline]
fn st() -> &'static mut State {
    unsafe {
        if ST.is_none() {
            ST = Some(State {
                paths: Vec::new(),
                pulses: Vec::new(),
                out: Vec::new(),
                input: Vec::new(),
                cam: [640.0, 400.0, 1.0],
                tw: None,
                cam_out: [0.0; 5],
                vw: 1280.0,
                vh: 800.0,
            });
        }
        ST.as_mut().unwrap()
    }
}

// ───────────────────────────── path 파서 ─────────────────────────────

struct Lexer<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Lexer<'a> {
    fn new(b: &'a [u8]) -> Self { Lexer { b, i: 0 } }

    fn skip_sep(&mut self) {
        while self.i < self.b.len() {
            let c = self.b[self.i];
            if c == b' ' || c == b',' || c == b'\t' || c == b'\n' || c == b'\r' {
                self.i += 1;
            } else {
                break;
            }
        }
    }

    fn peek_cmd(&mut self) -> Option<u8> {
        self.skip_sep();
        if self.i >= self.b.len() { return None; }
        let c = self.b[self.i];
        if c.is_ascii_alphabetic() { Some(c) } else { None }
    }

    fn take_cmd(&mut self) -> Option<u8> {
        let c = self.peek_cmd()?;
        self.i += 1;
        Some(c)
    }

    /// 숫자 하나를 읽는다. 지수 표기(1e-3)와 선행 부호를 지원한다.
    fn num(&mut self) -> Option<f64> {
        self.skip_sep();
        let start = self.i;
        if self.i < self.b.len() && (self.b[self.i] == b'-' || self.b[self.i] == b'+') {
            self.i += 1;
        }
        let mut seen_digit = false;
        while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
            self.i += 1; seen_digit = true;
        }
        if self.i < self.b.len() && self.b[self.i] == b'.' {
            self.i += 1;
            while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                self.i += 1; seen_digit = true;
            }
        }
        if !seen_digit { self.i = start; return None; }
        // 지수부
        if self.i < self.b.len() && (self.b[self.i] == b'e' || self.b[self.i] == b'E') {
            let save = self.i;
            self.i += 1;
            if self.i < self.b.len() && (self.b[self.i] == b'-' || self.b[self.i] == b'+') {
                self.i += 1;
            }
            let mut ed = false;
            while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                self.i += 1; ed = true;
            }
            if !ed { self.i = save; }
        }
        core::str::from_utf8(&self.b[start..self.i]).ok()?.parse::<f64>().ok()
    }
}

/// 3차 베지어를 선분들로 평탄화해 out에 push한다 (시작점은 이미 들어있다고 가정).
fn flatten_cubic(out: &mut Vec<(f64, f64)>, p0: (f64, f64), p1: (f64, f64), p2: (f64, f64), p3: (f64, f64)) {
    // 제어 다각형 길이를 기준으로 분할 수를 정한다 — 곡률이 큰 구간에 자동으로 더 촘촘해진다.
    let poly = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
    let n = ((poly / 0.4).ceil() as usize).clamp(8, 512);
    for k in 1..=n {
        let t = k as f64 / n as f64;
        let mt = 1.0 - t;
        let a = mt * mt * mt;
        let b = 3.0 * mt * mt * t;
        let c = 3.0 * mt * t * t;
        let d = t * t * t;
        out.push((
            a * p0.0 + b * p1.0 + c * p2.0 + d * p3.0,
            a * p0.1 + b * p1.1 + c * p2.1 + d * p3.1,
        ));
    }
}

#[inline]
fn dist(a: (f64, f64), b: (f64, f64)) -> f64 {
    let dx = b.0 - a.0;
    let dy = b.1 - a.1;
    (dx * dx + dy * dy).sqrt()
}

/// `d` 문자열 → 폴리라인 정점 목록.
/// 지원: M/m L/l H/h V/v C/c S/s Z/z (이 프로젝트의 트레이스는 M/H/V/C/L만 사용).
fn parse_path(d: &[u8]) -> Vec<(f64, f64)> {
    let mut lx = Lexer::new(d);
    let mut pts: Vec<(f64, f64)> = Vec::new();
    let mut cur = (0.0f64, 0.0f64);
    let mut start = (0.0f64, 0.0f64);
    let mut prev_ctrl: Option<(f64, f64)> = None;
    let mut cmd: u8 = 0;

    loop {
        // 명령 문자가 오면 갱신하고, 없으면 직전 명령을 반복 적용한다(SVG 규칙).
        if let Some(c) = lx.peek_cmd() {
            cmd = c;
            lx.take_cmd();
        } else if cmd == 0 {
            break;
        }

        let rel = cmd.is_ascii_lowercase();
        let up = cmd.to_ascii_uppercase();

        match up {
            b'M' => {
                let Some(x) = lx.num() else { break };
                let Some(y) = lx.num() else { break };
                cur = if rel { (cur.0 + x, cur.1 + y) } else { (x, y) };
                start = cur;
                pts.push(cur);
                prev_ctrl = None;
                // 이어지는 좌표쌍은 L로 취급
                cmd = if rel { b'l' } else { b'L' };
            }
            b'L' => {
                let Some(x) = lx.num() else { break };
                let Some(y) = lx.num() else { break };
                cur = if rel { (cur.0 + x, cur.1 + y) } else { (x, y) };
                pts.push(cur);
                prev_ctrl = None;
            }
            b'H' => {
                let Some(x) = lx.num() else { break };
                cur = if rel { (cur.0 + x, cur.1) } else { (x, cur.1) };
                pts.push(cur);
                prev_ctrl = None;
            }
            b'V' => {
                let Some(y) = lx.num() else { break };
                cur = if rel { (cur.0, cur.1 + y) } else { (cur.0, y) };
                pts.push(cur);
                prev_ctrl = None;
            }
            b'C' => {
                let Some(x1) = lx.num() else { break };
                let Some(y1) = lx.num() else { break };
                let Some(x2) = lx.num() else { break };
                let Some(y2) = lx.num() else { break };
                let Some(x3) = lx.num() else { break };
                let Some(y3) = lx.num() else { break };
                let (c1, c2, p3) = if rel {
                    ((cur.0 + x1, cur.1 + y1), (cur.0 + x2, cur.1 + y2), (cur.0 + x3, cur.1 + y3))
                } else {
                    ((x1, y1), (x2, y2), (x3, y3))
                };
                if pts.is_empty() { pts.push(cur); }
                flatten_cubic(&mut pts, cur, c1, c2, p3);
                prev_ctrl = Some(c2);
                cur = p3;
            }
            b'S' => {
                let Some(x2) = lx.num() else { break };
                let Some(y2) = lx.num() else { break };
                let Some(x3) = lx.num() else { break };
                let Some(y3) = lx.num() else { break };
                let (c2, p3) = if rel {
                    ((cur.0 + x2, cur.1 + y2), (cur.0 + x3, cur.1 + y3))
                } else {
                    ((x2, y2), (x3, y3))
                };
                // 첫 제어점은 직전 제어점의 반사
                let c1 = match prev_ctrl {
                    Some(pc) => (2.0 * cur.0 - pc.0, 2.0 * cur.1 - pc.1),
                    None => cur,
                };
                if pts.is_empty() { pts.push(cur); }
                flatten_cubic(&mut pts, cur, c1, c2, p3);
                prev_ctrl = Some(c2);
                cur = p3;
            }
            b'Z' => {
                if cur != start {
                    cur = start;
                    pts.push(cur);
                }
                prev_ctrl = None;
                // Z 뒤에 숫자가 오는 경우는 없으므로 다음 명령 문자를 기다린다
                if lx.peek_cmd().is_none() { break; }
            }
            _ => break, // 미지원 명령 (A/Q/T) — 트레이스에는 등장하지 않는다
        }

        if lx.peek_cmd().is_none() {
            lx.skip_sep();
            if lx.i >= lx.b.len() { break; }
            // 숫자가 더 있으면 직전 명령 반복
            let save = lx.i;
            if lx.num().is_none() { break; }
            lx.i = save;
        }
    }
    pts
}

// ───────────────────────────── 익스포트: 경로 ─────────────────────────────

/// d 문자열을 써 넣을 버퍼를 확보하고 포인터를 돌려준다.
/// (Vec 재할당으로 주소가 바뀔 수 있으므로 호출 직후 바로 사용할 것)
#[no_mangle]
pub extern "C" fn input_ptr(len: usize) -> *mut u8 {
    let s = st();
    s.input.clear();
    s.input.resize(len, 0);
    s.input.as_mut_ptr()
}

/// input 버퍼의 d 문자열을 파싱·평탄화·재샘플링해 등록한다.
/// `spacing`(px) 간격으로 호길이 균등 샘플을 만든다 — 값이 작을수록 코너 오차가 작다.
/// 반환: path_id (실패 시 -1)
#[no_mangle]
pub extern "C" fn path_register(len: usize, spacing: f32) -> i32 {
    let s = st();
    let bytes: Vec<u8> = s.input[..len.min(s.input.len())].to_vec();
    let pts = parse_path(&bytes);
    if pts.len() < 2 { return -1; }

    // 누적 호길이
    let mut cum: Vec<f64> = Vec::with_capacity(pts.len());
    cum.push(0.0);
    let mut total = 0.0f64;
    for w in pts.windows(2) {
        total += dist(w[0], w[1]);
        cum.push(total);
    }
    if total <= 0.0 { return -1; }

    // 균등 재샘플링
    let sp = if spacing > 0.01 { spacing as f64 } else { 0.5 };
    let n = ((total / sp).ceil() as usize + 1).clamp(2, 1 << 20);
    let mut xs = Vec::with_capacity(n);
    let mut ys = Vec::with_capacity(n);
    let mut seg = 0usize;
    for i in 0..n {
        let d = total * (i as f64) / ((n - 1) as f64);
        while seg + 2 < pts.len() && cum[seg + 1] < d { seg += 1; }
        let d0 = cum[seg];
        let d1 = cum[seg + 1];
        let f = if d1 > d0 { (d - d0) / (d1 - d0) } else { 0.0 };
        let p0 = pts[seg];
        let p1 = pts[seg + 1];
        xs.push((p0.0 + (p1.0 - p0.0) * f) as f32);
        ys.push((p0.1 + (p1.1 - p0.1) * f) as f32);
    }

    s.paths.push(Path { xs, ys, len: total as f32 });
    (s.paths.len() - 1) as i32
}

#[no_mangle]
pub extern "C" fn path_length(id: u32) -> f32 {
    let s = st();
    s.paths.get(id as usize).map(|p| p.len).unwrap_or(0.0)
}

#[no_mangle]
pub extern "C" fn path_sample_count(id: u32) -> u32 {
    let s = st();
    s.paths.get(id as usize).map(|p| p.xs.len() as u32).unwrap_or(0)
}

/// 경로 위 t(0..1) 지점의 좌표를 out_ptr에 [x, y]로 쓴다.
#[no_mangle]
pub extern "C" fn path_point(id: u32, t: f32, out: *mut f32) {
    let s = st();
    if let Some(p) = s.paths.get(id as usize) {
        let (x, y) = sample(p, t);
        unsafe {
            *out = x;
            *out.add(1) = y;
        }
    }
}

#[inline]
fn sample(p: &Path, t: f32) -> (f32, f32) {
    let n = p.xs.len();
    if n == 0 { return (0.0, 0.0); }
    if n == 1 { return (p.xs[0], p.ys[0]); }
    let tt = t.clamp(0.0, 1.0);
    let f = tt * (n - 1) as f32;
    let i = f as usize;
    if i >= n - 1 { return (p.xs[n - 1], p.ys[n - 1]); }
    let fr = f - i as f32;
    (
        p.xs[i] + (p.xs[i + 1] - p.xs[i]) * fr,
        p.ys[i] + (p.ys[i + 1] - p.ys[i]) * fr,
    )
}

#[no_mangle]
pub extern "C" fn paths_clear() {
    let s = st();
    s.paths.clear();
    s.pulses.clear();
    s.out.clear();
}

// ───────────────────────────── 익스포트: 펄스 ─────────────────────────────

#[no_mangle]
pub extern "C" fn pulses_clear() {
    let s = st();
    s.pulses.clear();
    s.out.clear();
}

#[no_mangle]
pub extern "C" fn pulse_add(path: u32, t0: f32, speed: f32, reverse: u32) -> i32 {
    let s = st();
    if path as usize >= s.paths.len() { return -1; }
    s.pulses.push(Pulse { path, t: t0.rem_euclid(1.0), speed, reverse: reverse != 0 });
    s.out.resize(s.pulses.len() * 2, 0.0);
    (s.pulses.len() - 1) as i32
}

#[no_mangle]
pub extern "C" fn pulse_count() -> u32 {
    st().pulses.len() as u32
}

/// 모든 펄스를 dt(초)만큼 전진시키고 좌표를 계산한다.
/// 반환: [x0,y0, x1,y1, …] f32 배열의 포인터.
///
/// 이 함수가 프레임당 하는 일 전부다 — JS는 결과를 읽어 DOM에 쓰기만 한다.
#[no_mangle]
pub extern "C" fn pulses_advance(dt: f32) -> *const f32 {
    let s = st();
    for (i, pu) in s.pulses.iter_mut().enumerate() {
        pu.t = (pu.t + dt * pu.speed).rem_euclid(1.0);
        let at = if pu.reverse { 1.0 - pu.t } else { pu.t };
        if let Some(p) = s.paths.get(pu.path as usize) {
            let (x, y) = sample(p, at);
            s.out[i * 2] = x;
            s.out[i * 2 + 1] = y;
        }
    }
    s.out.as_ptr()
}

// ───────────────────────────── 익스포트: 카메라 ─────────────────────────────

#[no_mangle]
pub extern "C" fn cam_config(vw: f32, vh: f32) {
    let s = st();
    s.vw = vw as f64;
    s.vh = vh as f64;
}

#[no_mangle]
pub extern "C" fn cam_set(x: f32, y: f32, scale: f32) {
    let s = st();
    s.cam = [x as f64, y as f64, scale as f64];
    s.tw = None;
}

/// 트윈 시작. ms=0이면 즉시 이동.
#[no_mangle]
pub extern "C" fn cam_tween(fx: f32, fy: f32, fs: f32, ms: f32, now: f64) {
    let s = st();
    if ms <= 0.0 {
        s.cam = [fx as f64, fy as f64, fs as f64];
        s.tw = None;
        return;
    }
    s.tw = Some(Tween {
        x0: s.cam[0], y0: s.cam[1], s0: s.cam[2],
        x1: fx as f64, y1: fy as f64, s1: fs as f64,
        t0: now, ms: ms as f64,
    });
}

#[no_mangle]
pub extern "C" fn cam_is_tweening() -> u32 {
    if st().tw.is_some() { 1 } else { 0 }
}

/// 기존 JS 구현과 동일한 대칭 cubic in-out 이징 (충실 이식 — 거동을 바꾸지 않는다).
#[inline]
fn ease_in_out(t: f64) -> f64 {
    if t < 0.5 { 4.0 * t * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(3) / 2.0 }
}

/// 카메라를 한 프레임 전진시키고 결과를 반환한다.
/// out에 [tx, ty, scale, camx, camy]를 쓴다.
/// 반환: 이번 프레임에 트윈이 끝났으면 1, 아니면 0.
#[no_mangle]
pub extern "C" fn cam_step(now: f64, out: *mut f32) -> u32 {
    let s = st();
    let mut finished = 0u32;
    if let Some(tw) = &s.tw {
        let p = (((now - tw.t0) / tw.ms).min(1.0)).max(0.0);
        let e = ease_in_out(p);
        s.cam[0] = tw.x0 + (tw.x1 - tw.x0) * e;
        s.cam[1] = tw.y0 + (tw.y1 - tw.y0) * e;
        s.cam[2] = tw.s0 + (tw.s1 - tw.s0) * e;
        if p >= 1.0 {
            s.tw = None;
            finished = 1;
        }
    }
    let sc = s.cam[2];
    let tx = s.vw / 2.0 - sc * s.cam[0];
    let ty = s.vh / 2.0 - sc * s.cam[1];
    s.cam_out = [tx as f32, ty as f32, sc as f32, s.cam[0] as f32, s.cam[1] as f32];
    unsafe {
        for k in 0..5 {
            *out.add(k) = s.cam_out[k];
        }
    }
    finished
}

/// 컴포넌트 바운딩박스들로 카메라 목표를 계산한다 (기존 fit()의 수학을 그대로 이식).
/// boxes: [x, y, w, h] × count 의 f32 배열 포인터.
/// out에 [fx, fy, scale]을 쓴다.
#[no_mangle]
pub extern "C" fn cam_fit(boxes: *const f32, count: u32, pad: f32, max_s: f32, out: *mut f32) {
    let s = st();
    let (mut x0, mut y0) = (f32::INFINITY, f32::INFINITY);
    let (mut x1, mut y1) = (f32::NEG_INFINITY, f32::NEG_INFINITY);
    unsafe {
        for i in 0..count as usize {
            let bx = *boxes.add(i * 4);
            let by = *boxes.add(i * 4 + 1);
            let bw = *boxes.add(i * 4 + 2);
            let bh = *boxes.add(i * 4 + 3);
            if bx < x0 { x0 = bx; }
            if by < y0 { y0 = by; }
            if bx + bw > x1 { x1 = bx + bw; }
            if by + bh > y1 { y1 = by + bh; }
        }
    }
    let (fx, fy, sc) = if !x0.is_finite() || count == 0 {
        ((s.vw / 2.0) as f32, (s.vh / 2.0) as f32, 1.0f32)
    } else {
        let bw = x1 - x0 + pad * 2.0;
        let bh = y1 - y0 + pad * 2.0;
        let sc = (s.vw as f32 / bw).min(s.vh as f32 / bh).min(max_s).max(1.0);
        ((x0 + x1) / 2.0, (y0 + y1) / 2.0, sc)
    };
    unsafe {
        *out = fx;
        *out.add(1) = fy;
        *out.add(2) = sc;
    }
}

/// 범용 스크래치 버퍼 (cam_step / cam_fit 출력용). 16 f32.
static mut SCRATCH: [f32; 16] = [0.0; 16];

#[no_mangle]
pub extern "C" fn scratch_ptr() -> *mut f32 {
    unsafe { SCRATCH.as_mut_ptr() }
}

/// 빌드 확인용 버전 스탬프.
#[no_mangle]
pub extern "C" fn version() -> u32 { 1 }

// ─────────────────── 익스포트: 스크럽 (메인 페이지 리빌) ───────────────────

/// 스크롤 양에 실시간 연동되는 리빌용. 목표값을 향해 프레임레이트 독립적으로 감쇠시킨다.
static mut SCRUB: f32 = 0.0;

#[no_mangle]
pub extern "C" fn scrub_set(v: f32) {
    unsafe { SCRUB = v.clamp(0.0, 1.0); }
}

#[no_mangle]
pub extern "C" fn scrub_get() -> f32 {
    unsafe { SCRUB }
}

/// 목표 스크럽으로 감쇠 이동. rate가 클수록 손가락에 빨리 붙는다.
/// 지수 감쇠라 프레임레이트가 흔들려도 속도가 일정하다 (60/120Hz 동일 체감).
#[no_mangle]
pub extern "C" fn scrub_step(target: f32, dt: f32, rate: f32) -> f32 {
    unsafe {
        let k = 1.0 - (-rate * dt).exp();
        SCRUB += (target.clamp(0.0, 1.0) - SCRUB) * k;
        if (SCRUB - target).abs() < 0.0002 { SCRUB = target.clamp(0.0, 1.0); }
        SCRUB
    }
}

/// 스크럽 t(0..1)로 두 카메라 상태를 보간한다.
///
/// 배율은 **로그 공간**에서 보간한다 — 사람의 배율 지각이 로그 스케일이라,
/// 7.8배→1배 같은 큰 줌아웃에서 선형 보간은 초반이 확 튀고 후반이 늘어진다.
/// 이 리빌 애니메이션의 '애플 감각'은 대부분 이 한 줄에서 나온다.
///
/// out에 [tx, ty, scale, camx, camy]를 쓴다.
#[no_mangle]
pub extern "C" fn cam_scrub(
    t: f32,
    x0: f32, y0: f32, s0: f32,
    x1: f32, y1: f32, s1: f32,
    out: *mut f32,
) {
    let s = st();
    let tt = (t as f64).clamp(0.0, 1.0);
    // 스크럽에서는 스크롤 자체가 타임라인이므로 이징을 거의 넣지 않는다.
    // 양 끝만 아주 약하게 다듬어(smoothstep 15% 혼합) 시작·정지가 툭 끊기지 않게 한다.
    let ss = tt * tt * (3.0 - 2.0 * tt);
    let e = tt * 0.85 + ss * 0.15;

    let (a, b) = (s0 as f64, s1 as f64);
    let sc = if a > 0.0 && b > 0.0 {
        a * (b / a).powf(e)          // 로그 공간 보간 — 배율 지각은 로그 스케일이다
    } else {
        a + (b - a) * e
    };

    // 위치는 '역배율 공간'에서 보간한다.
    // 로그로 줄어드는 배율과 선형으로 움직이는 위치를 그냥 섞으면
    // 모니터가 초반에 확 밀렸다가 후반에 멈춘 것처럼 보인다.
    // 화면상 확장 속도에 위치를 맞추면 초점이 매끄럽게 따라온다.
    let (inv0, inv1, invs) = (1.0 / a, 1.0 / b, 1.0 / sc);
    let u = if (inv1 - inv0).abs() > 1e-9 { (invs - inv0) / (inv1 - inv0) } else { e };
    let cx = x0 as f64 + (x1 as f64 - x0 as f64) * u;
    let cy = y0 as f64 + (y1 as f64 - y0 as f64) * u;

    s.cam = [cx, cy, sc];
    s.tw = None;                     // 스크럽이 잡으면 진행 중 트윈은 무효

    let tx = s.vw / 2.0 - sc * cx;
    let ty = s.vh / 2.0 - sc * cy;
    unsafe {
        *out = tx as f32;
        *out.add(1) = ty as f32;
        *out.add(2) = sc as f32;
        *out.add(3) = cx as f32;
        *out.add(4) = cy as f32;
    }
}

/// 현재 카메라 상태를 읽는다. out에 [camx, camy, scale].
#[no_mangle]
pub extern "C" fn cam_get(out: *mut f32) {
    let s = st();
    unsafe {
        *out = s.cam[0] as f32;
        *out.add(1) = s.cam[1] as f32;
        *out.add(2) = s.cam[2] as f32;
    }
}

/// 어떤 사각형이 뷰포트를 꽉 채우려면(cover) 필요한 배율.
/// 리빌 시작점 — 모니터 화면이 화면 전체가 되는 지점 — 을 구할 때 쓴다.
#[no_mangle]
pub extern "C" fn cam_cover_scale(w: f32, h: f32) -> f32 {
    let s = st();
    let sx = s.vw as f32 / w.max(0.001);
    let sy = s.vh as f32 / h.max(0.001);
    if sx > sy { sx } else { sy }
}
