// Explicit output whitelist: tolerate older visit schemas without exposing new columns.
const fields = ['id','merchant_id','status','check_in_at','check_out_at','accuracy_m','distance_m','check_in_latitude','check_in_longitude','check_out_latitude','check_out_longitude','admin_closed_by','admin_closed_at','admin_close_reason','notes','reason','challenge_status','report_image','outcome','follow_up_date','problems','feedback','photos'];
function fieldVisitRecord(row) {
  const result=Object.fromEntries(fields.map(key=>[key,row[key]??null]));
  result.merchants=row.merchants?{name:row.merchants.name,merchant_code:row.merchants.merchant_code}:null;
  return result;
}
module.exports={fieldVisitRecord};
