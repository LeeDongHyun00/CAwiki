// Preparation is silent. A slow scene enters through a black exposure veil;
// operations completed within 200 ms never create a veil or an animation.
const status = document.querySelector('#render-status');
const message = document.querySelector('#render-message');
const preparations = new Set();
let recovery = false, exposure = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
export async function paintStatus() {
  if (document.hidden) return yieldTask();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
function refresh() {
  document.querySelector('#world')?.toggleAttribute('aria-busy', preparations.size > 0);
  if (preparations.size) document.querySelector('#world')?.setAttribute('aria-busy', 'true');
  if (status && !recovery) status.hidden = true;
}
export function beginPreparation() {
  const token = {}; preparations.add(token); refresh();
  return () => { preparations.delete(token); refresh(); };
}
export function beginSceneReveal() {
  exposure?.cancel();
  // Hide the previous scene synchronously, before any await can expose it.
  document.body.classList.add('scene-pending');
  const started = performance.now();
  let veil, animation, finished = false;
  const remove = () => { clearTimeout(timer); animation?.cancel(); veil?.remove(); if (exposure === controller) { document.body.classList.remove('scene-pending'); exposure = null; } };
  const show = () => {
    if (finished || veil) return;
    veil = document.createElement('div'); veil.className = 'scene-exposure';
    veil.setAttribute('aria-hidden', 'true'); document.body.append(veil);
  };
  const timer = setTimeout(show, 200);
  const controller = {
    finish() {
      if (finished) return; finished = true; clearTimeout(timer);
      const elapsed = performance.now() - started;
      document.body.classList.remove('scene-pending');
      // A blocked task may postpone the 200 ms timer: still cover its first frame.
      if (elapsed > 200 && !veil) { finished = false; show(); finished = true; }
      if (!veil || reduced.matches) { remove(); return; }
      const duration = Math.min(1200, Math.max(360, elapsed * .35));
      performance.mark('inside:exposure-start', {detail:{waitMs:elapsed,duration}});
      animation = veil.animate([{opacity:1},{opacity:0}], {duration,easing:'cubic-bezier(.22,.6,.3,1)',fill:'forwards'});
      animation.finished.then(() => { performance.mark('inside:exposure-end'); remove(); }, () => {});
    },
    cancel() { finished = true; remove(); },
  };
  exposure = controller;
  return controller;
}
export function showRecovery(text = '3D 화면을 표시할 수 없어 이미지로 이어갑니다') {
  recovery = true; exposure?.cancel();
  if (message) message.textContent = text;
  if (status) { status.dataset.state = 'recovery'; status.hidden = false; }
  document.querySelector('#world')?.removeAttribute('aria-busy');
}
export function clearRecovery() { recovery = false; refresh(); }
export function cancelPreparation() { preparations.clear(); exposure?.cancel(); refresh(); }
const simpler = new URL(location.href); simpler.searchParams.set('quality', 'still');
const link = document.querySelector('#render-simpler');
if (link) link.onclick = event => { event.preventDefault(); simpler.hash = location.hash; location.assign(simpler.href); };
addEventListener('inside:contextloss', () => showRecovery());
addEventListener('inside:contextrestore', clearRecovery);
