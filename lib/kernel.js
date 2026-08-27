/* ============================================================
   CAwiki — 애니메이션 커널 추상화
   백엔드 두 가지를 같은 인터페이스로 제공한다.
     · wasm : lib/cawiki.wasm (Rust). path 파싱·샘플링·펄스·카메라를 네이티브로.
     · js   : 기존 순수 JS 구현 (getPointAtLength + rAF 트윈).
   WASM 로드에 실패하면 조용히 js로 폴백하므로, 파일을 직접 열거나
   .wasm이 없어도 페이지는 정상 동작한다.
   ============================================================ */

const WASM_URL = new URL('./cawiki.wasm', import.meta.url);

/* 재샘플링 간격(px). 작을수록 코너 오차가 작다.
   0.5px → 직각 코너 최대 편차 약 0.18px (줌 2.4배에서 0.42px, 육안 식별 불가). */
const SAMPLE_SPACING = 0.5;

export async function createKernel({ vw = 1280, vh = 800, force = null } = {}) {
  const want = force ?? new URLSearchParams(location.search).get('kernel');
  if (want !== 'js') {
    try {
      const k = await createWasmKernel(vw, vh);
      if (k) return k;
    } catch (e) {
      console.warn('[CAwiki] WASM 커널 로드 실패 — JS 커널로 폴백합니다.', e);
    }
  }
  return createJsKernel(vw, vh);
}

/* ─────────────────────────── WASM 백엔드 ─────────────────────────── */

async function createWasmKernel(vw, vh) {
  const res = await fetch(WASM_URL);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  // arrayBuffer 경유 — 서버가 application/wasm을 안 줘도 동작한다.
  const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {});
  const w = instance.exports;
  if (!w.version || w.version() !== 1) throw new Error('버전 불일치');

  const enc = new TextEncoder();
  let buf = null, f32 = null, u8 = null;
  const sync = () => {
    if (buf !== w.memory.buffer) {
      buf = w.memory.buffer;
      f32 = new Float32Array(buf);
      u8 = new Uint8Array(buf);
    }
  };
  sync();

  w.cam_config(vw, vh);
  const scratch = w.scratch_ptr() >> 2;

  return {
    backend: 'wasm',
    sampleSpacing: SAMPLE_SPACING,

    registerPath(d /* , pathEl */) {
      const bytes = enc.encode(d);
      const ptr = w.input_ptr(bytes.length);
      sync(); // input_ptr가 메모리를 키웠을 수 있다
      u8.set(bytes, ptr);
      const id = w.path_register(bytes.length, SAMPLE_SPACING);
      sync();
      if (id < 0) throw new Error(`path 파싱 실패: ${d}`);
      return { id, len: w.path_length(id), samples: w.path_sample_count(id) };
    },

    pointAt(ref, t) {
      w.path_point(ref.id, t, w.scratch_ptr());
      sync();
      return [f32[scratch], f32[scratch + 1]];
    },

    clearPaths() { w.paths_clear(); },
    clearPulses() { w.pulses_clear(); },

    addPulse(ref, t0, speed, reverse) {
      w.pulse_add(ref.id, t0, speed, reverse ? 1 : 0);
      sync();
    },

    get pulseCount() { return w.pulse_count(); },

    /** dt(초)만큼 전진 후 [x0,y0,x1,y1,…] 뷰를 돌려준다. */
    advancePulses(dt) {
      const ptr = w.pulses_advance(dt);
      sync();
      const n = w.pulse_count() * 2;
      return f32.subarray(ptr >> 2, (ptr >> 2) + n);
    },

    camConfig(vw2, vh2) { w.cam_config(vw2, vh2); },
    camSet(x, y, s) { w.cam_set(x, y, s); },
    camTween(fx, fy, fs, ms, now) { w.cam_tween(fx, fy, fs, ms, now); },
    get camTweening() { return w.cam_is_tweening() === 1; },

    camStep(now) {
      const fin = w.cam_step(now, w.scratch_ptr());
      sync();
      return { tx: f32[scratch], ty: f32[scratch + 1], s: f32[scratch + 2], finished: fin === 1 };
    },

    /* ── 스크럽 (메인 페이지 리빌) ── */
    scrubSet(v) { w.scrub_set(v); },
    get scrub() { return w.scrub_get(); },
    scrubStep(target, dt, rate) { return w.scrub_step(target, dt, rate); },

    /** 두 카메라 상태를 t(0..1)로 보간 — 배율은 로그 공간. */
    camScrub(t, a, b) {
      w.cam_scrub(t, a.x, a.y, a.s, b.x, b.y, b.s, w.scratch_ptr());
      sync();
      return { tx: f32[scratch], ty: f32[scratch + 1], s: f32[scratch + 2] };
    },

    camGet() {
      w.cam_get(w.scratch_ptr());
      sync();
      return { x: f32[scratch], y: f32[scratch + 1], s: f32[scratch + 2] };
    },

    /** 사각형이 뷰포트를 꽉 채우는(cover) 배율 */
    coverScale(wd, ht) { return w.cam_cover_scale(wd, ht); },

    /** boxes: [{x,y,w,h}, …] */
    camFit(boxes, pad, maxS) {
      const ptr = w.scratch_ptr();
      sync();
      const base = ptr >> 2;
      // scratch 앞부분에 박스를, 뒷부분(offset 16 f32 = 64B)에 결과를 쓴다.
      const need = boxes.length * 4;
      if (need > 16) {
        // 박스가 많으면 input 버퍼를 빌려 쓴다
        const ip = w.input_ptr(need * 4);
        sync();
        const ib = ip >> 2;
        boxes.forEach((b, i) => {
          f32[ib + i * 4] = b.x; f32[ib + i * 4 + 1] = b.y;
          f32[ib + i * 4 + 2] = b.w; f32[ib + i * 4 + 3] = b.h;
        });
        w.cam_fit(ip, boxes.length, pad, maxS, ptr);
      } else {
        boxes.forEach((b, i) => {
          f32[base + i * 4] = b.x; f32[base + i * 4 + 1] = b.y;
          f32[base + i * 4 + 2] = b.w; f32[base + i * 4 + 3] = b.h;
        });
        w.cam_fit(ptr, boxes.length, pad, maxS, ptr + 64);
      }
      sync();
      const o = need > 16 ? base : base + 16;
      return { fx: f32[o], fy: f32[o + 1], s: f32[o + 2] };
    },
  };
}

/* ─────────────────────────── JS 백엔드 (폴백) ─────────────────────────── */

function createJsKernel(vw0, vh0) {
  let vw = vw0, vh = vh0;
  const pulses = [];
  let out = new Float32Array(0);
  const cam = { x: vw / 2, y: vh / 2, s: 1 };
  let tw = null;
  let scrub = 0;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  return {
    backend: 'js',
    sampleSpacing: null,

    registerPath(d, pathEl) {
      if (!pathEl) throw new Error('JS 커널은 SVG path 엘리먼트가 필요합니다');
      return { el: pathEl, len: pathEl.getTotalLength() };
    },
    pointAt(ref, t) {
      const p = ref.el.getPointAtLength(t * ref.len);
      return [p.x, p.y];
    },
    clearPaths() {},
    clearPulses() { pulses.length = 0; out = new Float32Array(0); },
    addPulse(ref, t0, speed, reverse) {
      pulses.push({ ref, t: ((t0 % 1) + 1) % 1, speed, reverse });
      out = new Float32Array(pulses.length * 2);
    },
    get pulseCount() { return pulses.length; },
    advancePulses(dt) {
      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i];
        p.t = (p.t + dt * p.speed) % 1;
        const at = p.reverse ? 1 - p.t : p.t;
        const pt = p.ref.el.getPointAtLength(at * p.ref.len);
        out[i * 2] = pt.x; out[i * 2 + 1] = pt.y;
      }
      return out;
    },
    camConfig(vw2, vh2) { vw = vw2; vh = vh2; },
    camSet(x, y, s) { cam.x = x; cam.y = y; cam.s = s; tw = null; },
    camTween(fx, fy, fs, ms, now) {
      if (ms <= 0) { cam.x = fx; cam.y = fy; cam.s = fs; tw = null; return; }
      tw = { x0: cam.x, y0: cam.y, s0: cam.s, x1: fx, y1: fy, s1: fs, t0: now, ms };
    },
    get camTweening() { return tw !== null; },
    camStep(now) {
      let finished = false;
      if (tw) {
        const p = Math.min(1, Math.max(0, (now - tw.t0) / tw.ms));
        const e = easeInOut(p);
        cam.x = tw.x0 + (tw.x1 - tw.x0) * e;
        cam.y = tw.y0 + (tw.y1 - tw.y0) * e;
        cam.s = tw.s0 + (tw.s1 - tw.s0) * e;
        if (p >= 1) { tw = null; finished = true; }
      }
      return { tx: vw / 2 - cam.s * cam.x, ty: vh / 2 - cam.s * cam.y, s: cam.s, finished };
    },
    scrubSet(v) { scrub = Math.min(1, Math.max(0, v)); },
    get scrub() { return scrub; },
    scrubStep(target, dt, rate) {
      const k = 1 - Math.exp(-rate * dt);
      const tg = Math.min(1, Math.max(0, target));
      scrub += (tg - scrub) * k;
      if (Math.abs(scrub - tg) < 0.0002) scrub = tg;
      return scrub;
    },
    /* WASM의 cam_scrub과 동일한 수학이어야 한다 (wasm/src/lib.rs 참고).
       선형 우세 + 양 끝만 smoothstep 15% 혼합, 배율은 로그 공간,
       위치는 역배율 공간에서 보간. 두 백엔드가 달라지면 폴백 시 리빌이 튄다. */
    camScrub(t, a, b) {
      const tt = Math.min(1, Math.max(0, t));
      const ss = tt * tt * (3 - 2 * tt);
      const e = tt * 0.85 + ss * 0.15;
      const A = a.s, B = b.s;
      const sc = (A > 0 && B > 0) ? A * Math.pow(B / A, e) : A + (B - A) * e;
      const inv0 = 1 / A, inv1 = 1 / B, invs = 1 / sc;
      const u = Math.abs(inv1 - inv0) > 1e-9 ? (invs - inv0) / (inv1 - inv0) : e;
      cam.x = a.x + (b.x - a.x) * u;
      cam.y = a.y + (b.y - a.y) * u;
      cam.s = sc;
      tw = null;
      return { tx: vw / 2 - sc * cam.x, ty: vh / 2 - sc * cam.y, s: sc };
    },
    camGet() { return { x: cam.x, y: cam.y, s: cam.s }; },
    coverScale(wd, ht) { return Math.max(vw / Math.max(wd, 0.001), vh / Math.max(ht, 0.001)); },
    camFit(boxes, pad, maxS) {
      if (!boxes.length) return { fx: vw / 2, fy: vh / 2, s: 1 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of boxes) {
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
      }
      const bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2;
      const s = Math.max(1, Math.min(maxS, Math.min(vw / bw, vh / bh)));
      return { fx: (x0 + x1) / 2, fy: (y0 + y1) / 2, s };
    },
  };
}
