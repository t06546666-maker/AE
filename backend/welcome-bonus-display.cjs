// A platform-funded welcome grant is not a store purchase or loyalty award.
// Keep merchant membership attribution in the database, never in its display name.
function customerWelcomeBonusActivity(bonus) {
  return {
    id: `welcome-${bonus.customer_id}`, created_at: bonus.created_at,
    type: 'bonus', bonus_kind: 'welcome', source: 'system',
    merchant_name: 'Welcome bonus', amount: null, points: Number(bonus.points),
  };
}
module.exports = { customerWelcomeBonusActivity };
