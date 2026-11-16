import {Children,useRef,useState,type ReactNode} from 'react';
import './favourite-wheel.css';
export function FavouriteWheel({children}:{children:ReactNode}){
 const cards=Children.toArray(children),start=useRef<{x:number;y:number}|null>(null),swiped=useRef(false);
 const [turn,setTurn]=useState(0),[drag,setDrag]=useState(0);
 const count=cards.length,step=360/Math.max(1,count);
 if(!count)return null;
 const active=((turn%count)+count)%count;
 return <div className="ae-favourite-wheel" role="region" aria-label="Favourite shops carousel" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setTurn(t=>t+(e.key==='ArrowRight'?1:-1));}}}>
 <div className="ae-favourite-wheel-stage" onPointerDown={e=>{start.current={x:e.clientX,y:e.clientY};swiped.current=false;}} onPointerMove={e=>{if(!start.current)return;const dx=e.clientX-start.current.x,dy=e.clientY-start.current.y;if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8){swiped.current=true;setDrag(Math.max(-60,Math.min(60,dx)));}}} onPointerUp={e=>{if(start.current&&swiped.current){const dx=e.clientX-start.current.x;if(Math.abs(dx)>35)setTurn(t=>t+(dx<0?1:-1));}start.current=null;setDrag(0);}} onPointerCancel={()=>{start.current=null;setDrag(0);}} onPointerLeave={()=>{start.current=null;setDrag(0);}} onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false;}}}>
 {cards.map((card,i)=>{const angle=(i-turn)*step+drag*.45;return <div key={i} className="ae-favourite-wheel-panel" inert={i!==active} aria-hidden={i!==active} style={{transform:count===1?'translateX(-50%)':`translateX(-50%) translateZ(-180px) rotateY(${angle}deg) translateZ(180px)`,zIndex:i===active?10:1,opacity:i===active?1:.45}}>{card}</div>;})}
 </div>
 {count>1&&<div className="ae-favourite-wheel-navigation"><button type="button" aria-label="Previous favourite shop" onClick={()=>setTurn(t=>t-1)}>‹</button><span aria-live="polite">{active+1} / {count}</span><button type="button" aria-label="Next favourite shop" onClick={()=>setTurn(t=>t+1)}>›</button></div>}
 </div>;
}
