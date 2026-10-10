const groups={under100:[0,100],'100to300':[100,300],'300to500':[300,500], '500plus':[500,null]};
function purchaseSegment(input) {
 const limits=groups[input?.group];const from=Date.parse(input?.from),to=Date.parse(input?.to);
 if(!limits||!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>366*86400000)throw new Error('Choose a valid purchase group and date range.');
 return {group:input.group,min:limits[0],max:limits[1],from:new Date(from).toISOString(),to:new Date(to).toISOString()};
}
module.exports={purchaseSegment};
