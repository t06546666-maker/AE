import type {CustomerOffer} from './hooks/useCustomerData';
export type HomeSection={id:string;visible:boolean;offerIds?:string[];images?:{id:string;url:string;alt:string}[]};
export type WebBannerOverride={imageUrl?:string;title?:string;subtitle?:string};
export type HomeLayout={sections:HomeSection[];carouselHeight?:number;carouselIds?:string[];carouselWebIds?:string[];carouselWebOverrides?:Record<string,WebBannerOverride>;carouselAppIds?:string[];pageText?:Record<string,string>};
export const sectionNames:Record<string,string>={trending:'Trending Offers',best:'Best Offers',image:'Image block',nearby:'Nearby Shops & Offers',categories:'Category Offers',favourites:'Favourite Shops Offers'};
export const defaultSections:HomeSection[]=Object.keys(sectionNames).map(id=>({id,visible:id!=='image',offerIds:[],images:[]}));
export function homeSections(value?:HomeLayout){return defaultSections.map(item=>({...item,...value?.sections?.find(row=>row.id===item.id)})).sort((a,b)=>{const rank=(id:string)=>{const n=value?.sections?.findIndex(row=>row.id===id)??-1;return n<0?100+defaultSections.findIndex(row=>row.id===id):n;};return rank(a.id)-rank(b.id);});}
export function curatedOffers(offers:CustomerOffer[],section:HomeSection|undefined){return (section?.offerIds||[]).flatMap(id=>{const offer=offers.find(item=>item.id===id);return offer?[offer]:[];});}

export function carouselFor(layout:HomeLayout|undefined,platform:"web"|"app"){return (platform==='app'?layout?.carouselAppIds:layout?.carouselWebIds)??layout?.carouselIds;}
