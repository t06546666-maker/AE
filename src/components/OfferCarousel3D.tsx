import {Children,useEffect,useRef,useState,type ReactNode,type RefObject,type CSSProperties} from 'react';
import {uiText} from '../uiText';
import './offer-carousel-3d.css';
type Props={children:ReactNode;enabled:boolean;variant:'coverflow'|'stack';label:string;fallbackClass:string;fallbackRef?:RefObject<HTMLDivElement|null>;onFallbackScroll?:()=>void;onInteract?:()=>void};
export function OfferCarousel3D({children,enabled,variant,label,fallbackClass,fallbackRef,onFallbackScroll,onInteract}:Props){
 const slides=Children.toArray(children),count=slides.length,root=useRef<HTMLDivElement>(null),pointer=useRef<{x:number;y:number}|null>(null),swiped=useRef(false),visible=useRef(true);
 const [active,setActive]=useState(0),[interacting,setInteracting]=useState(false);
 const index=count?active%count:0;
 const move=(step:number)=>setActive(value=>count?(value+step+count)%count:0);
 useEffect(()=>{if(!enabled||!root.current)return;const observer=new IntersectionObserver(([entry])=>{visible.current=entry.isIntersecting;},{threshold:.15});observer.observe(root.current);return()=>observer.disconnect();},[enabled]);
 useEffect(()=>{if(!enabled||count<2||interacting)return;const view=root.current?.ownerDocument.defaultView||window;if(view.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=view.setInterval(()=>{if(!root.current?.ownerDocument.hidden&&visible.current)setActive(value=>(value+1)%count);},variant==='coverflow'?2800:3200);return()=>view.clearInterval(timer);},[enabled,count,interacting,variant]);
 if(!enabled)return <div className={fallbackClass} ref={fallbackRef} onScroll={onFallbackScroll} onPointerDown={onInteract}>{children}</div>;
 if(!count)return null;
 return <div ref={root} className={`ae-3d-carousel ae-3d-${variant}`} role="region" aria-roledescription="carousel" aria-label={label} onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocusCapture={()=>setInteracting(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setInteracting(false);}}>
 <div className="ae-3d-stage" onPointerDown={event=>{pointer.current={x:event.clientX,y:event.clientY};swiped.current=false;setInteracting(true);}} onPointerUp={event=>{const start=pointer.current;if(start){const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){swiped.current=true;move(dx<0?1:-1);}}pointer.current=null;setInteracting(false);}} onPointerCancel={()=>{pointer.current=null;swiped.current=false;setInteracting(false);}} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;}}}>
 {slides.map((slide,i)=>{let distance=(i-index+count)%count;if(variant==='coverflow'&&distance>count/2)distance-=count;const shown=variant==='coverflow'?Math.abs(distance)<=2:distance<=2;return <div key={i} className={`ae-3d-slide ${i===index?'is-current':''}`} aria-hidden={i!==index} inert={i!==index} style={{'--slide-offset':distance,'--slide-depth':Math.abs(distance),visibility:shown?'visible':'hidden',zIndex:20-Math.abs(distance),pointerEvents:i===index?'auto':'none'} as CSSProperties}>{slide}</div>;})}
 </div>
 {count>1&&<div className="ae-3d-controls"><div className="ae-3d-progress" role="progressbar" aria-label={uiText('Offer')} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index+1}><span style={{width:`${100/count}%`,left:`${index*100/count}%`}}/></div></div>}
 </div>;
}
