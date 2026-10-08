const status = document.querySelector('#render-status');
const message = document.querySelector('#render-message');
let generation = 0;
let recovery = false;
const preparations = new Map();

function refresh() {
  if (recovery) return;
  const text = [...preparations.values()].at(-1);
  status.hidden = !text;
  document.querySelector('#world').toggleAttribute('aria-busy', !!text);
  if (text) {
    document.querySelector('#world').setAttribute('aria-busy', 'true');
    message.textContent = text;
    status.dataset.state = 'loading';
  }
}

// Two frames give the status a paint opportunity before synchronous model work.
// setTimeout is used for subsequent batches so preparation also completes in a
// hidden document (rAF may be suspended there).
export const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
export async function paintStatus() {
  if (document.hidden) return yieldTask();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function beginPreparation(text) {
  const token = ++generation;
  preparations.set(token, text);
  refresh();
  return () => {
    preparations.delete(token);
    refresh();
  };
}

export function showRecovery(text = '3D 화면을 표시할 수 없어 이미지로 이어갑니다') {
  recovery = true;
  ++generation;
  message.textContent = text;
  status.dataset.state = 'recovery';
  status.hidden = false;
  document.querySelector('#world').removeAttribute('aria-busy');
}

export function clearRecovery() {
  recovery = false;
  refresh();
}

export function cancelPreparation() {
  ++generation;
  preparations.clear();
  refresh();
}

const simpler = new URL(location.href);
simpler.searchParams.set('quality', 'still');
document.querySelector('#render-simpler').onclick = event => {
  event.preventDefault();
  simpler.hash = location.hash;
  location.assign(simpler.href);
};
addEventListener('inside:contextloss', () => showRecovery());
addEventListener('inside:contextrestore', clearRecovery);
