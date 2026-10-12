const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function compile(file,requireFn){const out={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',js)(out,requireFn);return out;}
const utils=compile('src/utils.ts',()=>{}),{adminReportRange}=compile('src/adminReportRange.ts',()=>utils);
assert.deepEqual(adminReportRange('custom','','2026-10-01','2026-10-10'),{from:'2026-10-01T00:00:00+05:30',to:'2026-10-11T00:00:00+05:30'});
assert.equal(adminReportRange('custom','','2026-10-10','2026-10-01'),null);
assert.equal(adminReportRange('date','','2026-02-30',''),null);
assert.equal(adminReportRange('date','','',''),null);
assert.equal(adminReportRange('selected-month','2024-02','','').to,'2024-03-01T00:00:00+05:30');
assert.equal(adminReportRange('date','','2026-12-31','').to,'2027-01-01T00:00:00+05:30');
const server=fs.readFileSync('server.js','utf8');
for(const route of ['/api/admin/report-areas','/api/admin/report-summary']){const index=server.indexOf(`('${route}'`);assert.ok(index>=0);assert.ok(server.slice(index,index+150).includes("requireRole('admin')"));}
assert.ok(server.includes("eq('route_name',area)"));assert.ok(server.includes("gte(selection[2],new Date(from).toISOString())"));assert.ok(server.includes("filename=\"${filename}.xlsx\""));
console.log('PASS: inclusive IST custom ranges, invalid dates, month rollover, admin guards and export source checks');
