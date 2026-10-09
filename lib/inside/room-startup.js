// Bound the actual drawing buffer, not just the offscreen fade target. DOM text
// retains its CSS resolution on high-DPI and 4K screens.
export function roomPixelRatio(width,height,dpr,compact){
 const pixels=compact?900*900:1600*900,edge=compact?1536:2048;
 return Math.min(dpr,compact?1:1.5,Math.sqrt(pixels/(width*height)),edge/Math.max(width,height));
}

// Four concurrent requests avoid a 23-image cold-cache waterfall. One startup
// deadline owns all decoders, so leaving or falling back cancels outstanding work.
export async function roomPortraits(ids,url,signal){
 const images=new Map();let next=0;
 const load=id=>new Promise((resolve,reject)=>{
  signal.throwIfAborted();const image=new Image();
  const cancel=()=>{image.removeAttribute('src');reject(signal.reason);};
  signal.addEventListener('abort',cancel,{once:true});image.src=url(id);
  image.decode().then(()=>{signal.removeEventListener('abort',cancel);if(signal.aborted){reject(signal.reason);return;}images.set(id,image);resolve();},error=>{signal.removeEventListener('abort',cancel);reject(error);});
 });
 await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{
  while(next<ids.length){signal.throwIfAborted();await load(ids[next++]);}
 }));
 return images;
}
