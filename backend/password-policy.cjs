// Used only when creating or changing credentials. Never validate existing login passwords here.
const PASSWORD_HELP='Use at least 8 characters with an uppercase letter.';
function validNewPassword(value){return typeof value==='string'&&value.length>=8&&value.length<=72&&/[A-Z]/.test(value);}
module.exports={validNewPassword,PASSWORD_HELP};
