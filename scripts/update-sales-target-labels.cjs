const fs=require('node:fs');const path='src/components/SalesTarget.tsx';
let source=fs.readFileSync(path,'utf8');
source=source.replace("uiText('Monthly target')","uiText('Target amount')").replace("uiText('No sales target set for this month.')","uiText('No sales target set for this period.')").replace('{data.isPending?<LoadingState/>','{!datesValid?null:data.isPending?<LoadingState/>');
fs.writeFileSync(path,source);
