// Retry location acquisition only. Never retry the attendance POST automatically.
export async function getAttendanceLocation(
 geolocation: Pick<Geolocation,'getCurrentPosition'> | undefined,
 onAttempt:(attempt:number)=>void=()=>{},
):Promise<GeolocationPosition>{
 if(!geolocation)throw new Error('Location is not supported on this device.');
 for(let attempt=1;attempt<=3;attempt++){
  onAttempt(attempt);
  try{
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>{
    // Some browsers fail to invoke either callback. Bound every attempt ourselves.
    const timer=setTimeout(()=>reject({code:3}),10500);
    try{geolocation.getCurrentPosition(position=>{clearTimeout(timer);resolve(position);},error=>{clearTimeout(timer);reject(error);},{enableHighAccuracy:attempt<3,timeout:10000,maximumAge:0});}
    catch(error){clearTimeout(timer);reject(error);}
   });
   const {latitude,longitude,accuracy}=position.coords;
   if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(accuracy)||accuracy<0)throw {code:2};
   return position;
  }catch(error){
   const code=(error as {code?:number})?.code;
   if(code===1)throw new Error('Allow location access in your browser settings, then try again.');
   if(code!==2&&code!==3)throw new Error('Unable to get your location. Turn on Location and try again.');
  }
 }
 throw new Error('Location could not be found after 3 attempts. Turn on Location, move outdoors and try again. Attendance has not been submitted.');
}
