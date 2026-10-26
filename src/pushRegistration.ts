// Receiving a Firebase token is not enough: persist it before reporting success.
export async function savePushRegistration(save:()=>Promise<unknown>, active:()=>boolean, wait:(ms:number)=>Promise<void> = ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
 for(let attempt=1;attempt<=3 && active();attempt++) {
  try { await save(); return active(); }
  catch(error) {
   const status=(error as {status?:number})?.status;
   if(attempt===3 || (status && status<500 && status!==408 && status!==429))throw error;
   await wait(attempt*1000);
  }
 }
 return false;
}
