function checkinDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const from = Date.parse(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(from) || new Date(from + 330 * 60000).toISOString().slice(0, 10) !== value) return null;
  return { from: new Date(from).toISOString(), to: new Date(from + 86400000).toISOString() };
}
function checkinPins(attendance, visits) {
  const rows = [
    ...attendance.map(row => ({ id: `attendance-${row.id}`, kind: 'attendance', at: row.started_at, latitude: row.latitude, longitude: row.longitude, accuracy_m: row.accuracy_m, name: null })),
    ...attendance.filter(row => row.ended_at && row.end_latitude != null && row.end_longitude != null).map(row => ({ id: `attendance-end-${row.id}`, kind: 'attendance_end', at: row.ended_at, latitude: row.end_latitude, longitude: row.end_longitude, accuracy_m: row.end_accuracy_m, name: null })),
    ...visits.map(row => ({ id: `visit-${row.id}`, kind: 'visit', at: row.check_in_at, latitude: row.check_in_latitude, longitude: row.check_in_longitude, accuracy_m: row.accuracy_m, name: row.merchants?.name || null })),
  ];
  const pins = rows.filter(row => row.latitude != null && row.longitude != null && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) && Math.abs(Number(row.latitude)) <= 90 && Math.abs(Number(row.longitude)) <= 180 && Number.isFinite(Date.parse(row.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  return { pins: pins.map((row, index) => ({ ...row, latitude: Number(row.latitude), longitude: Number(row.longitude), number: index + 1 })), missingLocations: rows.length - pins.length };
}
module.exports = { checkinDay, checkinPins };
