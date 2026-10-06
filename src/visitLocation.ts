export const VISIT_RADIUS_METRES = 50;
export function visitDistance(lat: number, lng: number, storeLat: number, storeLng: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(storeLat-lat)/2) ** 2 + Math.cos(radians(lat))*Math.cos(radians(storeLat))*Math.sin(radians(storeLng-lng)/2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function canVisit(distance: number | null, accuracy: number | null) {
  return distance != null && accuracy != null && Number.isFinite(distance) && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= VISIT_RADIUS_METRES && distance <= VISIT_RADIUS_METRES;
}
