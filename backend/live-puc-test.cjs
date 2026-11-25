// This one explicitly requested live test merchant is private in discovery only.
// Its confirmed purchases and rewards use the ordinary production ledger.
const LIVE_PUC_TEST_ID='7e174a2a-4966-4ab8-9d14-5704e426a100';
const isHiddenLiveMerchant=id=>id===LIVE_PUC_TEST_ID;
const excludeHiddenLiveMerchant=(query,column='id')=>query.neq(column,LIVE_PUC_TEST_ID);
module.exports={LIVE_PUC_TEST_ID,isHiddenLiveMerchant,excludeHiddenLiveMerchant};
