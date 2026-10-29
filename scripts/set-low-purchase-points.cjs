const fs=require('node:fs');
for(const path of ['src/pages/AddCustomer.tsx','src/components/QrScanner.tsx']) {
 let s=fs.readFileSync(path,'utf8');
 s=s.replace('eligibleAmount < 10 ? 0 :','eligibleAmount < 1 ? 0 : eligibleAmount < 10 ? 1 :');
 if(path.includes('AddCustomer')) s=s.replace('Number(amount) < 10','Number(amount) < 1').replace('₹10 or more','₹1 or more').replace('min="10"','min="1"');
 s=s.replace('₹10–₹49: 2 points','₹1–₹9: 1 point · ₹10–₹49: 2 points').replace('INR 10-49: 2 pts','INR 1-9: 1 pt · INR 10-49: 2 pts');
 // Earn-only accepts small purchases; preserve redemption's minimum.
 if(path.includes('QrScanner')) s=s.replace('disabled={Number(amount) < 100 || (transactionMode', 'disabled={Number(amount) < (transactionMode === "combined" ? 100 : 1) || (transactionMode');
 fs.writeFileSync(path,s);
}
let s=fs.readFileSync('server.js','utf8');
s=s.replace('if (value < 10) return 0;', 'if (!Number.isFinite(value) || value < 1) return 0;\n  if (value < 10) return 1;');
s=s.replace('amount < 10\n  )','amount < 1\n  )').replace('a purchase amount of ₹10 or more.', 'a purchase amount of ₹1 or more.');
s=s.replace('amount < 100\n  )','amount < (pointsToRedeem > 0 ? 100 : 1)\n  )');
fs.writeFileSync('server.js',s);
let c=fs.readFileSync('src/components/ScannedCheckout.tsx','utf8');
c=c.replace('purchase<100','purchase<(combined?100:1)').replace('purchase < 100','purchase < (combined?100:1)').replace('min="100"','min={combined ? 100 : 1}');
fs.writeFileSync('src/components/ScannedCheckout.tsx',c);
