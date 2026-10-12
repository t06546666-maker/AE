function validFieldLocation(body,now=Date.now()) {
 return typeof body.latitude==='number'&&Number.isFinite(body.latitude)&&Math.abs(body.latitude)<=90&&typeof body.longitude==='number'&&Number.isFinite(body.longitude)&&Math.abs(body.longitude)<=180&&typeof body.accuracy_m==='number'&&Number.isFinite(body.accuracy_m)&&body.accuracy_m>=0&&body.accuracy_m<=100000&&typeof body.captured_at==='string'&&Number.isFinite(Date.parse(body.captured_at))&&Math.abs(now-Date.parse(body.captured_at))<=120000;
}
module.exports={validFieldLocation};
