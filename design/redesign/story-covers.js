// Original vector scenes: a still before the action, then one finite CSS sequence.
// Every instance has its own paint-server IDs, including the Wiki and dialog copies.
export const STORY_ORDER=['boot','game','search','storage'];
const descriptions={
 boot:'길고 얇은 막대로 본체의 전원 버튼을 누르면 전원 표시등과 팬이 켜지는 장면',
 game:'게임 화면 앞의 마우스를 길고 얇은 막대로 클릭하면 표적과 게임 화면이 반응하는 장면',
 search:'검색어를 입력한 브라우저 — 검색 버튼을 누르면 결과가 나타납니다',
 storage:'컴퓨터 바탕화면의 이미지 파일 — 두 번 클릭하면 파일 창이 열립니다',
};
const cursor=(x,y,extra='')=>`<g class="cover-cursor ${extra}" style="--cursor-x:${x}px;--cursor-y:${y}px" transform="translate(${x} ${y})"><path d="M0 0 0 29 7 22 13 35 19 32 13 20 25 20Z" fill="#eff7f3" stroke="#18272b" stroke-width="2" stroke-linejoin="round"/></g>`;
const click=(x,y)=>`<circle class="cover-click" cx="${x}" cy="${y}" r="15" fill="none" stroke="#c2e6d8" stroke-width="2"/><circle class="cover-click second-click" cx="${x}" cy="${y}" r="15" fill="none" stroke="#c2e6d8" stroke-width="2"/>`;
const rod=(id,x1,y1,x2,y2)=>`<path d="M${x1} ${y1} ${x2} ${y2}" fill="none" stroke="#16272d" stroke-width="10" stroke-linecap="round"/><path d="M${x1} ${y1} ${x2} ${y2}" fill="none" stroke="url(#${id}-rod)" stroke-width="7" stroke-linecap="round"/><path d="M${x1-1} ${y1} ${x2-1} ${y2}" fill="none" stroke="#d5e4dc" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/>`;
const mountain=(id)=>`<rect width="540" height="278" fill="url(#${id}-sky)"/><circle cx="407" cy="78" r="28" fill="#ddd8ba"/><path d="m0 242 151-168 141 150 110-106 138 113v47H0Z" fill="#52756e"/><path d="m0 259 151-185 70 80-74-37-43 78Z" fill="#93aaa0"/><path d="M0 231q112-62 256 8t284-37v76H0Z" fill="#264c49"/><path d="M0 258q136-42 270-6t270-24v50H0Z" fill="#183a3c"/>`;
function power(id){
 const slots=Array.from({length:22},(_,i)=>`<path d="m${283+i*4.25} ${244+i*1.5}v107"/>`).join('');
 return `<ellipse cx="437" cy="418" rx="244" ry="23" fill="#03080a" opacity=".7" filter="url(#${id}-blur)"/>
 <path d="m242 181 195-63 203 69-193 66Z" fill="url(#${id}-caseTop)" stroke="#5d6969" stroke-width="1.1"/>
 <path d="m242 181 205 72v177l-205-71Z" fill="url(#${id}-caseFront)" stroke="#404c50"/>
 <path d="m447 253 193-66v181l-193 62Z" fill="url(#${id}-caseSide)" stroke="#39484c"/>
 <path d="m459 263 168-57v150l-168 54Z" fill="#0c171c" stroke="#2b3b40"/>
 <path d="m479 284 128-44v92l-128 43Z" fill="#17262c" stroke="#3d4b4e"/>
 <g transform="matrix(1 -.34 0 1 0 0)"><g class="case-fan" style="transform-origin:540px 491px"><circle cx="540" cy="491" r="39" fill="#101b20" stroke="#415555" stroke-width="2"/><g fill="#2c4044">${Array.from({length:7},(_,i)=>`<path transform="rotate(${i*360/7} 540 491)" d="M540 485q-11-29 14-27l-5 31Z"/>`).join('')}</g><circle cx="540" cy="491" r="10" fill="#526b6a"/></g><circle class="case-light cover-after" cx="540" cy="491" r="39" fill="none" stroke="#a8d5c0" stroke-width="3"/></g>
 <path d="m253 191 182 63" stroke="#717c7a" opacity=".3"/>
 <g stroke="#101b20" stroke-width="2.7">${slots}</g>
 <path d="m266 348 152 53" stroke="#314247"/>
 <path d="m311 219 23 8v5l-23-8Z" fill="#090f12"/><path d="m345 231 23 8v5l-23-8Z" fill="#090f12"/>
 <ellipse cx="380" cy="189" rx="29" ry="13" fill="#121e23" stroke="#667b7a"/>
 <g class="power-cap"><ellipse cx="380" cy="185" rx="26" ry="11.5" fill="#394d50" stroke="#81928b"/><path d="M380 178v7m-7-5c-12 7 10 15 15 6 1-3-1-5-3-6" fill="none" stroke="#a7b7ae" stroke-width="1.5" stroke-linecap="round"/></g>
 <ellipse class="power-glow cover-after" cx="380" cy="190" rx="31" ry="14" fill="none" stroke="#bcf1d5" stroke-width="2.5"/>
 <g class="power-rod">${rod(id,415,-40,380,168)}</g>
 <path class="power-reflection cover-after" d="m261 375 180 62 160-47" fill="none" stroke="#8ab9a5" stroke-width="2" opacity=".55"/>
 <g class="cover-status"><circle cx="56" cy="422" r="3" fill="#a7bbaf"/><text x="70" y="426" class="cover-before">STANDBY</text><text x="70" y="426" class="cover-after">POWER ON</text></g>`;
}
function game(id){
 return `<ellipse cx="430" cy="421" rx="306" ry="18" fill="#02090d" opacity=".8" filter="url(#${id}-blur)"/>
 <path d="M285 346h54l10 49 68 12v9H210v-9l65-12Z" fill="url(#${id}-caseFront)" stroke="#314850"/>
 <rect x="61" y="49" width="543" height="310" rx="7" fill="#0a141b" stroke="#657778"/>
 <g clip-path="url(#${id}-gameScreen)"><rect x="73" y="61" width="519" height="283" fill="url(#${id}-gameSky)"/>
 <circle cx="347" cy="133" r="62" fill="#b6beb2" opacity=".12"/>
 <path d="m73 241 73-127 61 78 54-91 86 140 82-144 72 74 91-52v225H73Z" fill="#263d48"/>
 <path d="m73 265 114-81 112 80 107-77 98 93 88-78v142H73Z" fill="#142c36"/>
 <path d="M73 296h519M73 321h519M332 223 111 344m221-121L224 344m108-121 23 121m-23-121 140 121m-140-121 260 121" stroke="#8baeb6" stroke-opacity=".14"/>
 <g class="game-target"><path d="m384 178 26 16v43l-26 16-26-16v-43Z" fill="#3d6570" stroke="#aac8c5"/><path d="m384 178 26 16-26 15-26-15Z" fill="#a0b7b3"/><path d="M384 209v44" stroke="#779d9c"/><circle cx="384" cy="214" r="10" fill="#bbcdbc"/></g>
 <g class="game-reticle" stroke="#cfe9da" fill="none" stroke-width="1.4"><circle cx="369" cy="222" r="23" stroke-opacity=".55"/><path d="M369 189v13m0 40v13m-33-33h13m40 0h13"/></g>
 <path d="m309 344 23-49 12 12 11-19 18 7 2 49Z" fill="#405966" stroke="#6d8a8e"/>
 <path class="game-beam" d="m351 303 33-88" stroke="#d4f6dc" stroke-width="4"/>
 <g class="game-hit cover-after" fill="none" stroke="#d3f0d3"><circle cx="384" cy="214" r="37"/><path d="m384 164v-8m0 108v8m-50-58h-8m108 0h8m-22-36 6-6m-76 76-6 6m0-76-6-6m76 76 6 6" stroke-width="2"/></g>
 <g fill="#b2c6c7" font-size="9" letter-spacing="2"><text x="95" y="86">SECTOR 01</text><text x="531" y="86">01:24</text><text x="94" y="321">HP</text><rect x="118" y="314" width="62" height="4" rx="2"/><text class="cover-before" x="481" y="321">AIM / 00</text><text class="cover-after" x="481" y="321">HIT / 01</text></g></g>
 <path d="M625 249c43 5 68 41 80 86l13 53c5 26-18 40-64 42-53 1-89-12-86-35l9-89c3-38 18-58 48-57Z" fill="url(#${id}-mouse)" stroke="#4a5b60"/>
 <path d="M572 362q64 27 137-4M633 305l8 69" fill="none" stroke="#192a31"/>
 <g class="game-button"><path d="m578 307-6 55q36 14 69 12l-8-69q-29-8-55 2Z" fill="url(#${id}-mouseButton)" stroke="#24363d"/><path d="m633 308 6 52" stroke="#121e23"/></g>
 <rect x="628" y="322" width="10" height="23" rx="5" fill="#121c20" transform="rotate(-7 633 333)"/>
 <g class="game-rod">${rod(id,824,138,619,353)}</g>
 ${click(610,368)}<g class="cover-status"><circle cx="56" cy="438" r="3" fill="#a7bbaf"/><text x="70" y="442" class="cover-before">READY TO CLICK</text><text x="70" y="442" class="cover-after">A NEW FRAME</text></g>`;
}
function browser(id){
 return `<rect x="74" y="69" width="652" height="349" rx="15" fill="#000" opacity=".5" filter="url(#${id}-blur)"/>
 <rect x="60" y="51" width="680" height="360" rx="12" fill="#18272e" stroke="#4e6062"/>
 <path d="M72 51h656q12 0 12 12v33H60V63q0-12 12-12Z" fill="#25363c"/>
 <g fill="#7b8c8a"><circle cx="82" cy="73" r="3"/><circle cx="94" cy="73" r="3"/><circle cx="106" cy="73" r="3"/></g>
 <rect x="149" y="62" width="450" height="24" rx="7" fill="#17282e"/><path d="m161 75 3-5 3 5Z" fill="#8ea39c"/><text x="181" y="78" fill="#91a4a1" font-size="10">Search</text>
 <text class="search-wordmark cover-before" x="400" y="187" fill="#d6e1d6" font-size="42" text-anchor="middle" letter-spacing="-2">무엇이 궁금한가요</text>
 <g class="search-bar"><rect x="155" y="213" width="490" height="53" rx="26.5" fill="#30474b" stroke="#6c8881"/><circle cx="182" cy="238" r="6" stroke="#9fb8ad" fill="none"/><path d="m187 243 5 5" stroke="#9fb8ad"/><text x="213" y="245" fill="#e3ece2" font-size="17">컴퓨터 작동 원리</text><path class="search-caret" d="M357 228v22" stroke="#b7cfbb"/><circle cx="615" cy="239" r="19" fill="#b7cec0"/><path d="M608 239h14m-6-6 6 6-6 6" fill="none" stroke="#253e3e" stroke-width="1.5" stroke-linecap="round"/></g>
 <g class="search-suggestions cover-before" fill="#78938d" font-size="10"><text x="267" y="301">하드웨어</text><text x="374" y="301">컴퓨터의 구조</text><text x="502" y="301">일상의 원리</text></g>
 <g class="search-results cover-after"><text x="164" y="196" fill="#89a199" font-size="10">검색 결과</text>
 ${['컴퓨터는 어떻게 작동할까요','클릭이 화면에 닿기까지','부품에서 시작하는 컴퓨터 이야기'].map((label,i)=>`<g class="search-result" style="--result-delay:${.45+i*.10}s"><circle cx="170" cy="222" r="7" fill="#4a6b64" transform="translate(0 ${i*63})"/><text x="191" y="227" fill="#c1d7c8" font-size="14" transform="translate(0 ${i*63})">${label}</text><rect x="191" y="239" width="${348-i*43}" height="4" rx="2" fill="#405b5d" transform="translate(0 ${i*63})"/><rect x="191" y="249" width="${283-i*36}" height="3" rx="1.5" fill="#30474d" transform="translate(0 ${i*63})"/></g>`).join('')}</g>
 ${cursor(642,284,'search-pointer')}${click(617,239)}
 <g class="cover-status"><text x="60" y="448" class="cover-before">A QUESTION</text><text x="60" y="448" class="cover-after">AN ANSWER</text></g>`;
}
function desktop(id){
 return `<rect x="64" y="46" width="672" height="365" rx="10" fill="url(#${id}-desktop)" stroke="#455a5c"/>
 <g clip-path="url(#${id}-desktopClip)"><path d="M245 411C489 471 744 255 654 99 575-42 250 100 298 211c36 82 242 2 208-46-21-29-117 6-117 35" fill="none" stroke="#7a9b87" stroke-opacity=".2" stroke-width="57"/>
 <path d="M270 414C485 441 728 248 642 109 568-12 274 110 312 203c30 74 221 5 181-41" fill="none" stroke="#bfd3b2" stroke-opacity=".15" stroke-width="2"/>
 <path d="M64 46h672v22H64Z" fill="#1a3135" fill-opacity=".8"/><text x="84" y="61" fill="#adbbb1" font-size="9">Desktop</text><text x="669" y="61" fill="#adbbb1" font-size="9">09:41</text>
 <g fill="#637f76" stroke="#8fa996" stroke-width=".6"><path d="M99 101h17l6 5h20v28H99Z"/><path d="M99 169h17l6 5h20v28H99Z"/></g><g fill="#acbcb2" font-size="9" text-anchor="middle"><text x="121" y="148">문서</text><text x="121" y="217">프로젝트</text></g>
 <g class="desktop-file"><rect x="313" y="156" width="86" height="101" rx="9" fill="#c2dac0" fill-opacity=".12" stroke="#92bba5" stroke-opacity=".45"/><path d="M336 167h27l17 17v42h-44Z" fill="#c2d0b6"/><path d="M363 167v17h17" fill="#8ba78f"/><rect x="342" y="188" width="32" height="28" rx="2" fill="#5d8680"/><circle cx="365" cy="195" r="4" fill="#ced6ae"/><path d="m342 212 11-16 11 11 10-5v14h-32Z" fill="#244b4d"/><text x="356" y="244" fill="#dbe4d5" font-size="10" text-anchor="middle">풍경.png</text></g>
 <g class="desktop-dock" fill="#36534f" stroke="#719183" stroke-width=".5"><rect x="273" y="368" width="254" height="33" rx="12" fill="#172e33"/>${Array.from({length:6},(_,i)=>`<rect x="${287+i*39}" y="375" width="20" height="19" rx="5" fill="${['#74958b','#a8bbaa','#456c71','#bcbaa2','#648b7a','#9db4a3'][i]}"/>`).join('')}</g>
 <g class="file-window cover-after"><rect x="163" y="91" width="486" height="289" rx="9" fill="#000" opacity=".5" filter="url(#${id}-blur)"/><rect x="155" y="83" width="486" height="289" rx="9" fill="#203a3e" stroke="#77968c"/><path d="M164 83h468q9 0 9 9v24H155V92q0-9 9-9Z" fill="#304a4c"/><g fill="#9caf9f"><circle cx="172" cy="100" r="3"/><circle cx="184" cy="100" r="3"/><circle cx="196" cy="100" r="3"/></g><text x="398" y="104" text-anchor="middle" font-size="10" fill="#d0dbca">풍경.png</text><g transform="translate(169 123) scale(.85)">${mountain(id)}</g></g></g>
 ${cursor(398,271,'file-pointer')}${click(361,206)}
 <g class="cover-status"><text x="64" y="446" class="cover-before">READY TO OPEN</text><text x="64" y="446" class="cover-after">FILE OPENED</text></g>`;
}
export function storyCover(story,scope){
 const id=`cover-${scope}-${story}`;
 const scene={boot:power,game,search:browser,storage:desktop}[story](id);
 return `<figure class="story-cover cover-${story}" role="img" aria-label="${descriptions[story]}"><svg viewBox="0 0 800 480" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs>
 <radialGradient id="${id}-bg" cx="58%" cy="30%" r="85%"><stop stop-color="#314447"/><stop offset=".62" stop-color="#182a30"/><stop offset="1" stop-color="#0e1a21"/></radialGradient>
 <linearGradient id="${id}-caseTop" x2=".8" y2="1"><stop stop-color="#586664"/><stop offset=".55" stop-color="#314348"/><stop offset="1" stop-color="#23373f"/></linearGradient>
 <linearGradient id="${id}-caseFront" x2="1" y2=".7"><stop stop-color="#34454a"/><stop offset=".55" stop-color="#1c2a32"/><stop offset="1" stop-color="#101e27"/></linearGradient>
 <linearGradient id="${id}-caseSide" x2="1" y2="1"><stop stop-color="#526466"/><stop offset=".4" stop-color="#263941"/><stop offset="1" stop-color="#15242c"/></linearGradient>
 <linearGradient id="${id}-rod" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#688084"/><stop offset=".45" stop-color="#c1d3ca"/><stop offset="1" stop-color="#819b98"/></linearGradient>
 <radialGradient id="${id}-mouse" cx="40%" cy="15%" r="90%"><stop stop-color="#82908a"/><stop offset=".35" stop-color="#44585b"/><stop offset="1" stop-color="#142630"/></radialGradient>
 <linearGradient id="${id}-mouseButton" x2=".5" y2="1"><stop stop-color="#425959"/><stop offset="1" stop-color="#23363f"/></linearGradient>
 <linearGradient id="${id}-gameSky" x2="0" y2="1"><stop stop-color="#66888b"/><stop offset="1" stop-color="#1e3b48"/></linearGradient>
 <linearGradient id="${id}-desktop" x2="1" y2="1"><stop stop-color="#142e39"/><stop offset=".6" stop-color="#42675f"/><stop offset="1" stop-color="#76927d"/></linearGradient>
 <linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#7b9b96"/><stop offset="1" stop-color="#c0c4a9"/></linearGradient>
 <filter id="${id}-blur" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>
 <clipPath id="${id}-gameScreen"><rect x="73" y="61" width="519" height="283" rx="2"/></clipPath>
 <clipPath id="${id}-desktopClip"><rect x="64" y="46" width="672" height="365" rx="10"/></clipPath>
 </defs><rect width="800" height="480" fill="url(#${id}-bg)"/><g class="cover-scene">${scene}</g></svg></figure>`;
}
