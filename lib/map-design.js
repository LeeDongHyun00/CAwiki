import { CHAPTERS, OBJECTS } from './map-design-content.js';

const $ = (selector) => document.querySelector(selector);
const root = document.body;
const viewport = $('#atlas-viewport');
const labelLayer = $('#model-labels');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = () => matchMedia('(max-width: 760px)').matches;
let chapter = 0;
let graphics = null;
let inspecting = false;
let lockedUntil = 0;
let wheelAmount = 0;
let wheelTime = 0;
let wheelConsumed = false;
let transition = null;
let frame = 0;
let running = true;
let lastFrame = 0;
let copyAnimations = [];

for (const [i, item] of CHAPTERS.entries()) {
  const button = document.createElement('button');
  button.className = 'chapter-tab';
  button.innerHTML = `<i></i><small>${String(i).padStart(2, '0')}</small><b>${item.nav}</b><em>${item.tag}</em>`;
  button.dataset.chapter = item.id;
  button.addEventListener('click', () => navigate(i));
  $('#chapter-nav').appendChild(button);
}

function renderCopy(animate = true) {
  const item = CHAPTERS[chapter];
  $('#chapter-eyebrow').textContent = item.eyebrow;
  $('#chapter-title').innerHTML = item.title;
  $('#chapter-description').innerHTML = item.description;
  $('#chapter-facts').innerHTML = item.facts.map(([value, unit, label]) => `<div class="chapter-fact"><strong>${value}<small>${unit}</small></strong><span>${label}</span></div>`).join('');
  $('#chapter-action').innerHTML = `${item.action}<span>↗</span>`;
  $('#chapter-action').href = item.href;
  $('#chapter-footnote').textContent = item.footnote;
  $('#chapter-number').textContent = String(chapter).padStart(2, '0');
  $('#chapter-prev').disabled = chapter === 0;
  $('#chapter-next').disabled = chapter === CHAPTERS.length - 1;
  $('#chapter-relation').hidden = !item.related.length;
  $('#relation-items').replaceChildren(...item.related.map(([id, name, relation]) => {
    const b = document.createElement('button');
    b.innerHTML = `${name}<span>↗</span>`;
    b.title = relation;
    b.setAttribute('aria-label', `${name}: ${relation}`);
    b.addEventListener('click', () => navigate(CHAPTERS.findIndex(ch => ch.id === id)));
    return b;
  }));
  $('#scene-caption').textContent = item.caption;
  $('#scene-state').textContent = chapter === 0 ? 'EXPLODED VIEW' : `${item.tag} / IN FOCUS`;
  $('.journey-progress i').style.width = `${chapter / (CHAPTERS.length - 1) * 100}%`;
  document.querySelectorAll('.chapter-tab').forEach((button, i) => {
    if (i === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('#atlas-live').textContent = `${chapter + 1}/${CHAPTERS.length}. ${item.title.replace(/<[^>]*>/g, ' ')} ${item.description.replace(/<[^>]*>/g, ' ')}`;
  copyAnimations.forEach(animation => animation.cancel());
  copyAnimations = [];
  if (animate && !motion.matches) {
    for (const [i, element] of [...document.querySelector('.chapter-copy').children].entries()) {
      if (!element.hidden) copyAnimations.push(element.animate([
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 620, delay: Math.min(i * 35, 175), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    }
  }
}

function navigate(index, { history = true, instant = false } = {}) {
  if (index < 0 || index >= CHAPTERS.length) return;
  chapter = index;
  inspecting = false;
  root.classList.remove('inspecting');
  $('#inspect-button').setAttribute('aria-pressed', 'false');
  if (graphics) graphics.controls.enabled = false;
  renderCopy(!instant);
  if (history) window.history.replaceState(null, '', `#${CHAPTERS[chapter].id}`);
  lockedUntil = performance.now() + (instant || motion.matches ? 80 : 1050);
  wheelAmount = 0;
  if (graphics) beginTransition(instant || motion.matches);
  else updateFallback();
}

function fallback(message) {
  if (graphics) {
    graphics.controls.dispose();
    graphics.renderer.dispose();
    graphics.environment.dispose();
    graphics.models.forEach(({ model }) => graphics.disposeModel(model));
    graphics.scene.traverse(node => {
      if (node.geometry) node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) if (material) { material.map?.dispose(); material.dispose(); }
    });
  }
  graphics = null;
  transition = null;
  viewport.querySelector('canvas')?.remove();
  viewport.querySelector('.atlas-loading')?.remove();
  labelLayer.replaceChildren();
  if (!viewport.querySelector('.fallback-model')) {
    const img = document.createElement('img');
    img.className = 'fallback-model';
    viewport.prepend(img);
    const p = document.createElement('p');
    p.className = 'fallback-message';
    viewport.appendChild(p);
  }
  viewport.querySelector('.fallback-message').textContent = message;
  $('#inspect-button').disabled = true;
  $('#reset-view').disabled = true;
  $('.view-indicator').textContent = 'PREVIEW';
  updateFallback();
}
function updateFallback() {
  const image = viewport.querySelector('.fallback-model');
  if (!image) return;
  const id = chapter === 0 ? 'mainboard' : CHAPTERS[chapter].id;
  image.src = `./assets/models/${id}.png`;
  image.alt = `${CHAPTERS[chapter].nav} 3D 렌더 이미지`;
}

function poseFor(object, index) {
  if (!index) return { position: object.position, size: object.size, opacity: 1, rotation: object.rotation };
  const item = CHAPTERS[index];
  if (object.id === item.id) return { position: [0, .85, .15], size: object.id === 'gpu' ? 5.4 : 4.4, opacity: 1, rotation: object.id === 'dram' ? -.16 : object.rotation };
  if (object.id === 'mainboard') return { position: [0, -1.2, 0], size: 7.5, opacity: .055, rotation: 0 };
  const others = item.visible.filter(id => id !== item.id && id !== 'mainboard');
  const position = others.indexOf(object.id);
  if (position >= 0) return { position: position ? [3.4, -.15, -3.15] : [-3.4, .2, -2.8], size: 1.8, opacity: .38, rotation: object.rotation };
  return { position: [object.position[0] * 1.45, -1.6, object.position[2] * 1.4], size: object.size * .8, opacity: 0, rotation: object.rotation };
}

function beginTransition(instant = false) {
  const g = graphics;
  if (!g) return;
  const aspect = viewport.clientWidth / viewport.clientHeight;
  const center = new g.T.Vector3(chapter ? 0 : .2, chapter ? .45 : .15, 0);
  // A slightly higher overview keeps the exploded layers legible; close-ups sit lower.
  const direction = new g.T.Vector3(...(chapter ? [4.5, 7.6, 11] : [8.5, 12.5, 16])).normalize();
  const distance = (chapter ? 12.6 : 19.8) * Math.max(1, 1.12 / aspect);
  transition = {
    start: performance.now(), duration: instant ? 0 : 1150,
    cameraFrom: g.camera.position.clone(), cameraTo: center.clone().addScaledVector(direction, distance),
    centerFrom: g.controls.target.clone(), centerTo: center,
    objects: g.models.map(entry => ({
      entry, from: entry.model.position.clone(), scale: entry.model.scale.x,
      rotation: entry.model.rotation.y, opacity: entry.opacity,
      to: poseFor(entry.definition, chapter),
    })),
  };
  g.controls.minDistance = distance * .4;
  g.controls.maxDistance = distance * 2;
  if (instant) applyTransition(1);
  g.dirty = true;
}

function applyTransition(progress) {
  if (!transition || !graphics) return;
  const eased = 1 - Math.pow(1 - progress, 4);
  const g = graphics;
  g.camera.position.lerpVectors(transition.cameraFrom, transition.cameraTo, eased);
  g.controls.target.lerpVectors(transition.centerFrom, transition.centerTo, eased);
  g.camera.lookAt(g.controls.target);
  for (const { entry, from, scale, rotation, opacity, to } of transition.objects) {
    entry.model.position.set(
      g.T.MathUtils.lerp(from.x, to.position[0], eased),
      g.T.MathUtils.lerp(from.y, to.position[1], eased),
      g.T.MathUtils.lerp(from.z, to.position[2], eased),
    );
    entry.model.scale.setScalar(g.T.MathUtils.lerp(scale, to.size / entry.extent, eased));
    entry.model.rotation.y = g.T.MathUtils.lerp(rotation, to.rotation, eased);
    entry.opacity = g.T.MathUtils.lerp(opacity, to.opacity, eased);
    entry.model.visible = entry.opacity > .008;
    for (const material of entry.materials) {
      // Dim inactive parts without switching shader transparency modes mid-flight.
      // This avoids compilation stalls and preserves solid surface occlusion.
      if (material.color) material.color.copy(material.userData.originalColor).multiplyScalar(entry.opacity);
      material.opacity = material.userData.originalOpacity;
    }
  }
  if (progress >= 1) transition = null;
  g.dirty = true;
}

function updateLabels() {
  const g = graphics;
  const w = viewport.clientWidth, h = viewport.clientHeight;
  const occupied = [];
  // Mainboard is a backdrop in focus mode. Secondary labels remain as contextual links.
  const visible = CHAPTERS[chapter].visible;
  for (const entry of g.models) {
    const selected = CHAPTERS[chapter].id === entry.definition.id;
    const show = visible.includes(entry.definition.id) && (!chapter || entry.definition.id !== 'mainboard');
    const button = entry.label;
    button.hidden = !show || entry.opacity < .08;
    if (button.hidden) continue;
    const pin = new g.T.Vector3(...entry.definition.pin);
    if (chapter && selected) pin.set(2.1, 1.7, .2);
    pin.add(entry.model.position).project(g.camera);
    if (pin.z < -1 || pin.z > 1) { button.hidden = true; continue; }
    let x = (pin.x * .5 + .5) * w;
    let y = (-pin.y * .5 + .5) * h;
    const bw = mobile() ? 114 : 143, bh = 48;
    x = Math.max(7, Math.min(w - bw - 6, x));
    y = Math.max(43, Math.min(h - 137, y));
    for (const box of occupied) {
      if (x < box.x + bw && x + bw > box.x && y < box.y + bh && y + bh > box.y) y = Math.max(43, box.y - bh - 6);
    }
    occupied.push({ x, y });
    button.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    button.style.opacity = selected || !chapter ? '1' : '.88';
    button.classList.toggle('current', selected);
  }
}

function updateConnections(time) {
  const g = graphics;
  for (const wire of g.wires) {
    const a = g.byId.get(wire.from), b = g.byId.get(wire.to);
    const visible = a.opacity > .2 && b.opacity > .2;
    wire.line.visible = visible;
    wire.pulse.visible = visible;
    if (!visible) continue;
    const start = a.model.position.clone(), end = b.model.position.clone();
    start.y -= .25; end.y -= .2;
    const middle = start.clone().lerp(end, .5); middle.y -= .7;
    const curve = new g.T.QuadraticBezierCurve3(start, middle, end);
    const points = curve.getPoints(32);
    wire.line.geometry.setFromPoints(points);
    wire.line.material.opacity = chapter ? .35 : .22;
    wire.pulse.position.copy(curve.getPoint(motion.matches ? .5 : (time * .00013 + wire.offset) % 1));
  }
}

async function initializeGraphics() {
  try {
    const [T, { createHardware, disposeModel }, { studioScene }, { OrbitControls }] = await Promise.all([
      import('./vendor/three/three.module.js'), import('./hardware-models.js'),
      import('./hardware-scene.js'), import('./vendor/three/OrbitControls.js'),
    ]);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const context = studioScene(canvas);
    context.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    context.renderer.toneMappingExposure = 1.03;
    context.scene.environmentIntensity = .72;
    viewport.prepend(canvas);
    const controls = new OrbitControls(context.camera, canvas);
    controls.enabled = false;
    controls.enableDamping = !motion.matches;
    controls.dampingFactor = .09;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * .88;
    graphics = { ...context, T, controls, models: [], byId: new Map(), wires: [], dirty: true, disposeModel };
    controls.addEventListener('change', () => { if (graphics) graphics.dirty = true; });
    // Build one model at a time to leave the loading copy responsive.
    for (const definition of OBJECTS) {
      const model = createHardware(definition.id);
      const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(definition.size / extent);
      model.position.set(...definition.position);
      model.rotation.y = definition.rotation;
      context.scene.add(model);
      const materials = new Set();
      model.traverse(node => {
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of list) if (material) {
          materials.add(material);
          material.userData.originalOpacity = material.opacity;
          if (material.color) material.userData.originalColor = material.color.clone();
          material.userData.originalTransparent = material.transparent;
        }
      });
      const label = document.createElement('button');
      label.className = 'model-label';
      label.innerHTML = `<span><b>${definition.name}</b><small>${definition.label}</small></span>`;
      label.setAttribute('aria-label', `${definition.name} — ${definition.label}. 설명 보기`);
      label.dataset.object = definition.id;
      label.addEventListener('click', () => navigate(definition.jump));
      labelLayer.appendChild(label);
      const entry = { model, definition, extent, materials, label, opacity: 1 };
      graphics.models.push(entry);
      graphics.byId.set(definition.id, entry);
    }
    const grid = new T.GridHelper(28, 28, 0x3c5645, 0x283c30);
    grid.position.y = -1.14;
    grid.material.transparent = true;
    grid.material.opacity = .18;
    context.scene.add(grid);
    for (const [i, [from, to]] of [['cpu','dram'], ['cpu','gpu'], ['dram','ssd'], ['cpu','infra'], ['power','cpu'], ['power','cooling']].entries()) {
      const geometry = new T.BufferGeometry().setFromPoints(Array.from({ length: 33 }, () => new T.Vector3()));
      const line = new T.Line(geometry, new T.LineBasicMaterial({ color: 0xc18f60, transparent: true, opacity: .25 }));
      const pulse = new T.Mesh(new T.SphereGeometry(.027, 8, 6), new T.MeshBasicMaterial({ color: 0xedbc86 }));
      context.scene.add(line, pulse);
      graphics.wires.push({ from, to, line, pulse, offset: i * .14 });
    }
    viewport.querySelector('.atlas-loading')?.remove();
    const resize = () => {
      if (!graphics) return;
      const w = viewport.clientWidth, h = viewport.clientHeight;
      graphics.renderer.setSize(w, h, false);
      graphics.camera.aspect = w / h;
      graphics.camera.near = .01;
      graphics.camera.far = 200;
      graphics.camera.updateProjectionMatrix();
      beginTransition(true);
    };
    new ResizeObserver(resize).observe(viewport);
    resize();
    const raycaster = new T.Raycaster();
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointercancel', () => { down = null; });
    canvas.addEventListener('pointerup', e => {
      if (inspecting || !graphics || !down) return;
      const dx = e.clientX - down[0], dy = e.clientY - down[1];
      down = null;
      if (e.pointerType === 'touch' && Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx)) {
        if (performance.now() >= lockedUntil) navigate(chapter + (dy < 0 ? 1 : -1));
        return;
      }
      if (Math.hypot(dx, dy) > 8) return;
      const box = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new T.Vector2((e.clientX - box.left) / box.width * 2 - 1, -(e.clientY - box.top) / box.height * 2 + 1), graphics.camera);
      const hits = raycaster.intersectObjects(graphics.models.filter(entry => entry.opacity > .2).map(entry => entry.model), true);
      if (hits.length) {
        let object = hits[0].object;
        while (object.parent && !graphics.models.some(entry => entry.model === object)) object = object.parent;
        const entry = graphics.models.find(item => item.model === object);
        if (entry) navigate(entry.definition.jump);
      }
    });
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      fallback('3D 연결이 끊겨 미리보기로 전환했습니다. 부품 설명은 계속 탐색할 수 있습니다.');
    });
    beginTransition(true);
  } catch (error) {
    console.warn('Atlas preview fallback:', error);
    fallback('이 환경에서는 3D 미리보기로 표시합니다. 아래 단계에서 설명을 탐색하세요.');
  }
  window.__cawikiBooted?.();
}

function tick(time) {
  if (!running) return;
  frame = requestAnimationFrame(tick);
  if (!graphics || document.hidden || time - lastFrame < 32) return;
  lastFrame = time;
  if (transition) applyTransition(Math.min(1, (time - transition.start) / (transition.duration || 1)));
  if (inspecting) graphics.controls.update();
  if (!motion.matches || graphics.dirty) {
    graphics.scene.updateMatrixWorld(true);
    updateConnections(time);
    graphics.renderer.render(graphics.scene, graphics.camera);
    updateLabels();
    graphics.dirty = false;
  }
}

$('#chapter-prev').addEventListener('click', () => navigate(chapter - 1));
$('#chapter-next').addEventListener('click', () => navigate(chapter + 1));
$('#overview-button').addEventListener('click', () => navigate(0));
$('#chapter-action').addEventListener('click', e => {
  if (!chapter) { e.preventDefault(); navigate(1); }
});
$('#reset-view').addEventListener('click', () => { if (graphics) beginTransition(motion.matches); });
$('#inspect-button').addEventListener('click', () => {
  if (!graphics) return;
  inspecting = !inspecting;
  transition = null;
  graphics.controls.enabled = inspecting;
  graphics.controls.update();
  root.classList.toggle('inspecting', inspecting);
  $('#inspect-button').setAttribute('aria-pressed', String(inspecting));
  $('#scene-caption').textContent = inspecting ? '드래그로 회전 · 휠 또는 두 손가락으로 확대' : CHAPTERS[chapter].caption;
});
window.addEventListener('wheel', e => {
  if (inspecting || e.ctrlKey || e.metaKey || e.target.closest('.chapter-nav')) return;
  if (mobile() && !e.target.closest('.atlas-exhibit')) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  // Short windows can use normal page scrolling to reach the chapter controls.
  if (!mobile() && innerHeight < 730 && !e.target.closest('.atlas-exhibit')) return;
  e.preventDefault();
  const now = performance.now();
  const gap = e.timeStamp - wheelTime;
  wheelTime = e.timeStamp;
  if (now < lockedUntil || (wheelConsumed && gap < 180)) return;
  if (gap >= 180) { wheelAmount = 0; wheelConsumed = false; }
  wheelAmount += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
  if (Math.abs(wheelAmount) > 65) { navigate(chapter + Math.sign(wheelAmount)); wheelConsumed = true; }
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,select,textarea')) return;
  if (['Enter', ' '].includes(e.key) && e.target.closest('button,a')) return;
  if (e.key === 'Escape') { navigate(0); return; }
  const delta = ['ArrowDown', 'PageDown', 'ArrowRight', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
  if (delta) { e.preventDefault(); if (!e.repeat) navigate(chapter + delta); }
  if (e.key === 'Home') { e.preventDefault(); navigate(0); }
  if (e.key === 'End') { e.preventDefault(); navigate(CHAPTERS.length - 1); }
});
window.addEventListener('hashchange', () => {
  const index = CHAPTERS.findIndex(item => `#${item.id}` === location.hash);
  if (index >= 0) navigate(index, { history: false });
});
window.addEventListener('pagehide', () => { running = false; cancelAnimationFrame(frame); });
window.addEventListener('pageshow', () => { if (!running) { running = true; frame = requestAnimationFrame(tick); } });
motion.addEventListener('change', () => { if (graphics) { graphics.controls.enableDamping = !motion.matches; beginTransition(true); } });
const initial = CHAPTERS.findIndex(item => `#${item.id}` === location.hash);
navigate(Math.max(0, initial), { history: false, instant: true });
// The shell and static alternative remain navigable during or without WebGL initialization.
window.__cawikiBooted?.();
initializeGraphics();
frame = requestAnimationFrame(tick);
window.atlasDesign = { navigate, get chapter() { return CHAPTERS[chapter].id; }, get graphics() { return graphics; }, get transitioning() { return !!transition; } };
