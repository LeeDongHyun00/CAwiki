// ANSI tenkeyless proportions, checked against Keychron C1's keycap layout.
// All caps and legends share one deck transform, including the modifier row.
const rows=[
 ['`','1','2','3','4','5','6','7','8','9','0','-','=', ['Backspace',2]],
 [['Tab',1.5],'Q','W','E','R','T','Y','U','I','O','P','[',']',['\\',1.5]],
 [['Caps',1.75],'A','S','D','F','G','H','J','K','L',';',"'",['Enter',2.25]],
 [['Shift',2.25],'Z','X','C','V','B','N','M',',','.','/',['Shift',2.75]],
 [['Ctrl',1.25],['Win',1.25],['Alt',1.25],['',6.25],['Alt',1.25],['Fn',1.25],['Menu',1.25],['Ctrl',1.25]],
];
const unit=26,origin={x:163,y:335},keys=[];
function add(label,x,y,width=1){keys.push({label,x:12+x*unit,y,width:width*unit-3,height:20});}
add('Esc',0,10);
for(let i=0;i<12;i++)add('F'+(i+1),2+i+Math.floor(i/4)*.5,10);
rows.forEach((row,r)=>{let x=0;for(const key of row){const [label,w]=Array.isArray(key)?key:[key,1];add(label,x,39+r*25,w);x+=w;}});
['Prt','Scr','Pause'].forEach((k,i)=>add(k,15.6+i,10));
['Ins','Home','PgUp','Del','End','PgDn'].forEach((k,i)=>add(k,15.6+i%3,39+Math.floor(i/3)*25));
add('↑',16.6,114);['←','↓','→'].forEach((k,i)=>add(k,15.6+i,139));
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export function keyboard(id,{hot=['A']}={}){
 // A shortcut uses one physical modifier, not both Ctrl keys at once.
 const highlighted=new Set(hot.map(label=>keys.find(k=>k.label===label)));
 return `<g class="story-keyboard" transform="matrix(1 0 -.12 .68 ${origin.x} ${origin.y})">
 <path d="M0 12Q0 0 12 0H493Q505 0 505 12V168H0Z" fill="url(#${id}-caseTop)" stroke="#708280" stroke-width="1.5"/>
 <path d="M0 163H505V174Q505 181 497 181H8Q0 181 0 174Z" fill="#14242c" stroke="#506263"/>
 <rect x="7" y="5" width="491" height="158" rx="6" fill="#14232a"/>
 ${keys.map(k=>{const active=highlighted.has(k),mod=k.label.length>1;
 return `<g data-key="${escape(k.label)}" class="${active?'action-key':''}">
 <rect x="${k.x}" y="${k.y+3}" width="${k.width}" height="${k.height}" rx="3" fill="#0a151d"/>
 ${active?`<rect class="key-halo" x="${k.x-2}" y="${k.y-2}" width="${k.width+4}" height="${k.height+7}" rx="5" fill="none" stroke="#ffe3a0" stroke-width="2"/>`:''}
 <g class="keycap"><rect class="key-face" x="${k.x}" y="${k.y}" width="${k.width}" height="${k.height}" rx="3" fill="${active?'#cbb477':k.label==='Esc'?'#b78b70':mod?'#354c54':'#c1cbc2'}" stroke="${active?'#e6ce91':'#718582'}" stroke-width=".65"/>
 <path d="M${k.x+3} ${k.y+3}h${k.width-6}" stroke="#eff7e6" stroke-opacity=".3"/>
 <text x="${k.x+k.width/2}" y="${k.y+13}" font-family="Arial,sans-serif" font-size="${mod?7:9}" text-anchor="middle" fill="${mod&&!active?'#cad8cf':'#253b40'}">${escape(k.label)}</text></g></g>`;}).join('')}
 <g fill="#9cbfa4">${[0,1,2].map(i=>`<circle cx="${430+i*20}" cy="97" r="2"/>`).join('')}</g>
 </g>`;
}
