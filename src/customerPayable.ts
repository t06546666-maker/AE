// Historical totals must use the recorded discount, never today's shop rules.
export function customerPayable(amount:number,discount:number|null|undefined):number|null {
 if(!Number.isFinite(amount)||amount<0||discount==null||!Number.isFinite(discount)||discount<0||discount>amount)return null;
 return Math.round((amount-discount)*100)/100;
}
