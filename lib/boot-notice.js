/* ============================================================
   CAwiki — 부팅 실패 안내
   ------------------------------------------------------------
   이 파일은 일부러 **일반 스크립트**다 (type="module" 아님).
   브라우저는 file:// 에서 ES 모듈 로딩을 CORS로 차단하지만
   일반 스크립트는 그대로 실행되므로, index.html을 그냥 더블클릭했을 때
   "백지" 대신 원인과 해결책을 보여줄 수 있다.

   앱이 정상 부팅하면 window.__cawikiBooted() 가 호출되어 이 안내를 지운다.
   ============================================================ */
(function () {
  var booted = false;
  var timer = null;

  window.__cawikiBooted = function () {
    booted = true;
    if (timer) clearTimeout(timer);
    var n = document.getElementById('cawiki-boot-notice');
    if (n) n.remove();
  };

  function show() {
    if (booted || document.getElementById('cawiki-boot-notice')) return;

    var isFile = location.protocol === 'file:';
    // file:// 로 열렸다면 실제 폴더 경로를 알 수 있으니 그대로 명령어에 넣어 준다
    var dir = '';
    try { dir = decodeURIComponent(location.pathname).replace(/\/[^/]*$/, ''); } catch (e) { dir = ''; }
    var cdLine = dir ? 'cd "' + dir + '"' : 'cd <프로젝트 폴더>';
    var box = document.createElement('div');
    box.id = 'cawiki-boot-notice';
    box.setAttribute('role', 'alert');
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:24px', 'background:#0B0D10', 'color:#F2F4F7',
      'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Pretendard,sans-serif',
      'opacity:0', 'transition:opacity .4s ease',
    ].join(';');

    var mono = 'ui-monospace,"SF Mono",Consolas,monospace';
    var card = document.createElement('div');
    card.style.cssText = 'max-width:560px;width:100%;border:1px solid #1E252E;border-radius:16px;padding:30px 32px;background:#0D1014;';

    card.innerHTML =
      '<p style="margin:0 0 10px;font-family:' + mono + ';font-size:11.5px;letter-spacing:.18em;color:#E09A5F">CAWIKI</p>' +
      '<h1 style="margin:0 0 12px;font-size:1.4rem;letter-spacing:-.01em">' +
        (isFile ? '정적 서버로 열어 주세요' : '페이지를 불러오지 못했습니다') + '</h1>' +
      '<p style="margin:0 0 20px;color:#97A0AB;font-size:.9rem;line-height:1.7">' +
        (isFile
          ? '이 페이지는 ES 모듈을 사용하는데, 브라우저는 <code style="font-family:' + mono + ';font-size:.85em;background:#161C24;border-radius:4px;padding:1px 5px">file://</code> 에서 모듈 로딩을 보안 정책(CORS)으로 막습니다. 파일을 직접 열면 스크립트가 아예 실행되지 않아 화면이 비어 보입니다.'
          : '스크립트를 불러오지 못했습니다. 파일이 모두 제자리에 있는지, 서버가 켜져 있는지 확인해 주세요.') +
      '</p>' +
      (isFile
        ? '<p style="margin:0 0 8px;color:#F2F4F7;font-size:.86rem;font-weight:600">해결 방법 두 가지</p>' +
          '<ol style="margin:0 0 18px;padding-left:20px;color:#97A0AB;font-size:.86rem;line-height:1.9">' +
            '<li>프로젝트 폴더의 <b style="color:#F2F4F7">start.command</b> 를 더블클릭 <span style="color:#5C6774">— 서버를 띄우고 브라우저를 열어 줍니다</span></li>' +
            '<li>터미널에서 아래 명령 실행</li>' +
          '</ol>' +
          '<pre style="margin:0;background:#161C24;border:1px solid #1E252E;border-radius:9px;padding:13px 15px;font-family:' + mono + ';font-size:12px;color:#B8C2CC;overflow-x:auto">' + cdLine + '\npython3 -m http.server 4173</pre>' +
          '<p style="margin:14px 0 0;font-family:' + mono + ';font-size:12px;color:#97A0AB">그다음 <a href="http://localhost:4173" style="color:#E09A5F">http://localhost:4173</a> 접속</p>'
        : '');

    box.appendChild(card);
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.style.opacity = '1'; });
  }

  // 앱이 부팅할 시간을 준 뒤에도 조용하면 안내를 띄운다.
  function arm() { timer = setTimeout(show, 1200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
})();
