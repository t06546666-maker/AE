import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import QRCode from 'qrcode';
import {counterApi} from '../counterApi';
import {uiText} from '../uiText';
export function CounterShopQr({staffId}:{staffId:string}){
 const [image,setImage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const qr=useQuery({queryKey:['counter','shop-qr',staffId],queryFn:()=>counterApi<{payload:string;merchantName:string}>('/api/counter/shop-qr'),retry:false});
 useEffect(()=>{let active=true;setImage('');setError('');if(qr.data?.payload)void QRCode.toDataURL(qr.data.payload,{width:600,margin:3,errorCorrectionLevel:'H'}).then(value=>{if(active)setImage(value);}).catch(()=>{if(active)setError('Unable to generate shop QR. Please retry.');});return()=>{active=false;};},[qr.data?.payload,retry]);
 return <section className="panel ae-counter-shop-qr"><h2>{uiText('Shop QR')}</h2><h3>{qr.data?.merchantName}</h3><p>{uiText('Let customers scan your shop QR')}</p>{image?<img className="ae-counter-shop-qr-image" src={image} alt={uiText('AE shop QR')}/>:!(error||qr.error)&&<p role="status">{uiText('Loading shop QR…')}</p>}{(error||qr.error)&&<><p role="alert" className="form-error">{uiText(error||qr.error?.message)}</p><button className="button secondary" onClick={()=>{setError('');setRetry(value=>value+1);void qr.refetch();}}>{uiText('Try again')}</button></>}<p>{uiText('This is your shop’s QR. Customers can scan it to request points or redemption.')}</p></section>;
}
