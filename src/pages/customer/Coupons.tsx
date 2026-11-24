import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery,useMutation} from '@tanstack/react-query';
import {apiFetch} from '../../api';
type Coupon={value:number;merchantName?:string;status:string;code?:string;revealed:boolean;expiresAt:string};
export function CustomerCoupons(){
 const q=useQuery({queryKey:['my-shop-coupon'],queryFn:()=>apiFetch<{coupon:Coupon|null}>('/api/customer/shop-coupon'),refetchInterval:15000});
 const [selected,setSelected]=useState(false);const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),strokes=useRef(0);
 const reveal=useMutation({mutationFn:()=>apiFetch('/api/customer/shop-coupon/reveal',{method:'POST'}),onSuccess:()=>void q.refetch()});const c=q.data?.coupon;
 useEffect(()=>{if(!selected||c?.revealed)return;const ctx=canvas.current?.getContext('2d');if(!ctx)return;ctx.fillStyle='#1669d9';ctx.fillRect(0,0,320,180);ctx.fillStyle='#ffffff';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.fillText('Scratch to reveal',160,90);ctx.font='16px sans-serif';ctx.fillText('Your ₹100 shop coupon',160,122);},[selected,c?.revealed]);
 function scratch(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current||reveal.isPending||reveal.isSuccess)return;const el=e.currentTarget,rect=el.getBoundingClientRect(),ctx=el.getContext('2d');if(!ctx)return;ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc((e.clientX-rect.left)*320/rect.width,(e.clientY-rect.top)*180/rect.height,24,0,Math.PI*2);ctx.fill();if(++strokes.current%8===0){const pixels=ctx.getImageData(0,0,320,180).data;let erased=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]===0)erased++;if(erased/(320*180)>.35){drawing.current=false;reveal.mutate();}}}
 return <main className="customer-modern-page min-h-screen pb-[100px] text-gray-900">
  <header className="px-5 py-4"><Link to="/customer/profile">← Profile</Link><h1 className="text-2xl font-bold">My Coupons</h1></header>
  {q.isPending?<p className="px-5">Loading…</p>:q.error?<p className="px-5" role="alert">{q.error.message}</p>:!c?<div role="status" style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}><h2 style={{fontSize:'clamp(28px,7vw,40px)',fontWeight:800,color:'#172c50'}}>No coupons yet</h2></div>:<section className="mx-5 rounded-3xl bg-white p-5 shadow-sm">
   <button className="button primary" onClick={()=>setSelected(true)}>₹100 coupon · {c.status==='available'&&!c.revealed?'Scratch & reveal':c.status}</button>
   <p>Expires: {new Date(c.expiresAt).toLocaleString('en-IN')}</p>
   {selected&&<div style={{marginTop:20}}>{c.status==='available'&&!c.revealed?<>
    <div style={{maxWidth:320,background:'#eaf2ff',borderRadius:20,overflow:'hidden'}}><canvas ref={canvas} width={320} height={180} style={{width:'100%',touchAction:'none',display:'block'}} aria-label="Scratch your coupon" onPointerDown={e=>{drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);scratch(e);}} onPointerMove={scratch} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/></div>
    <button className="button secondary" disabled={reveal.isPending} onClick={()=>reveal.mutate()}>Reveal coupon</button>
   </>:<><strong className="text-3xl">₹100 OFF</strong><h2 className="text-xl font-bold">{c.merchantName||'Coupon expired'}</h2><p>{c.status==='available'?'Show this code at the selected shop for a bill of at least ₹100.':`Coupon ${c.status}.`}</p>{c.status==='available'&&<code style={{overflowWrap:'anywhere',userSelect:'all'}}>{c.code}</code>}</>}{reveal.error&&<p role="alert">{reveal.error.message}</p>}</div>}
  </section>}
 </main>;
}
