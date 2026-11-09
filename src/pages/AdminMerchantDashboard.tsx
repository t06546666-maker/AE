import {useQuery} from '@tanstack/react-query';
import {Link,useParams} from 'react-router-dom';
import {apiFetch} from '../api';
import {uiText} from '../uiText';
import type {UserProfile} from '../types';
import {ErrorState,LoadingState} from '../components/Common';
import {MerchantOverview} from './MerchantOverview';
export function AdminMerchantDashboard({user}:{user:UserProfile}){
 const {id=''}=useParams();
 const query=useQuery({queryKey:['admin-merchant-details',id],queryFn:({signal})=>apiFetch<{merchant:{id:string;name:string;merchant_code:string}}>(`/api/admin/merchants/${encodeURIComponent(id)}/details`,{signal})});
 if(query.isPending)return <LoadingState/>;
 if(query.isError)return <ErrorState error={query.error} retry={()=>void query.refetch()}/>;
 return <><section className="panel" style={{margin:16,padding:14}}><Link className="button secondary" to={`/merchants/${encodeURIComponent(id)}`}>{uiText('Back to merchant details')}</Link><h2>{query.data.merchant.name} · {query.data.merchant.merchant_code}</h2><p>{uiText('Merchant dashboard · read-only Admin view')}</p></section><MerchantOverview key={id} user={{...user,merchant_id:id,full_name:query.data.merchant.name}} readOnly/></>;
}
