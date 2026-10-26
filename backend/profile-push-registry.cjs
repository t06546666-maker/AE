// Server-only FCM registry. The caller supplies an authenticated profile,
// never an email or profile ID from the browser request body.
function createProfilePushRegistry(database) {
 async function document(id) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('Invalid profile ID');
  return (await database()).collection('ae_profile_push_registrations').doc(id);
 }
 return {
  async get(id,legacy={}) {
   const snapshot=await(await document(id)).get();
   // Existing installations continue working until their next registration.
   return snapshot.exists ? {...legacy,...snapshot.data()} : legacy;
  },
  async save(profile,email,updates) {
   const data={profile_id:profile.id,role:profile.role,merchant_id:profile.merchant_id||null,email:typeof email==='string'?email:null,updated_at:new Date().toISOString()};
   if(updates.push_token!==undefined){if(typeof updates.push_token!=='string'||!updates.push_token.trim()||updates.push_token.length>4096)throw Error('Invalid phone token');data.push_token=updates.push_token.trim();}
   if(updates.push_enabled!==undefined){if(typeof updates.push_enabled!=='boolean')throw Error('Invalid notification preference');data.push_enabled=updates.push_enabled;}
   await(await document(profile.id)).set(data,{merge:true});
  },
  async syncLegacy(profile) {
   const ref=await document(profile.id),db=await database();
   return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),existing=snapshot.exists?snapshot.data():{};
    const data={};
    // Backfill missing token/preferences only. Never overwrite newer device data.
    if(!Object.hasOwn(existing,'push_token')&&typeof profile.push_token==='string'&&profile.push_token.trim()&&profile.push_token.length<=4096)data.push_token=profile.push_token.trim();
    if(!Object.hasOwn(existing,'push_enabled')&&typeof profile.push_enabled==='boolean')data.push_enabled=profile.push_enabled;
    if(Object.keys(data).length)tx.set(ref,data,{merge:true});
    const result={...existing,...data};
    return {registered:!!result.push_token,enabled:result.push_enabled!==false};
   });
  }
 };
}
module.exports={createProfilePushRegistry};
