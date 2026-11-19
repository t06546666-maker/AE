type Policy={enabled:boolean;minimumBuild:number};
export function needsAppUpdate(build:number,value:unknown):boolean{
 if(!value||typeof value!=='object')return false;const policy=value as Policy;
 return policy.enabled===true&&Number.isSafeInteger(build)&&build>0&&Number.isSafeInteger(policy.minimumBuild)&&policy.minimumBuild>0&&policy.minimumBuild<=1000000000&&build<policy.minimumBuild;
}
