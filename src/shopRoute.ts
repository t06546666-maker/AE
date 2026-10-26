export type ShopRouteStop = { id: string; name: string; latitude?: number | null; longitude?: number | null };

export function hasShopLocation(stop: ShopRouteStop) {
  return stop.latitude != null && stop.longitude != null
    && String(stop.latitude).trim() !== '' && String(stop.longitude).trim() !== ''
    && Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude))
    && Math.abs(Number(stop.latitude)) <= 90 && Math.abs(Number(stop.longitude)) <= 180;
}

export function selectedShopRoute(chosen: string[], shops: ShopRouteStop[]) {
  if (chosen.length < 2 || new Set(chosen).size !== chosen.length) throw new Error('Choose at least two shops to open directions.');
  const stops = chosen.map(id => shops.find(shop => shop.id === id));
  if (stops.some(stop => !stop || !hasShopLocation(stop))) throw new Error('A selected shop no longer has a valid saved location. Refresh and select your stops again.');
  return stops as ShopRouteStop[];
}

export function shopRouteLinks(chosen: string[], shops: ShopRouteStop[]) {
  const stops = selectedShopRoute(chosen, shops);
  const position = (stop: ShopRouteStop) => `${Number(stop.latitude)},${Number(stop.longitude)}`;
  const sections: { url: string; from: number; to: number }[] = [];
  // Google Maps mobile URLs support only three intermediate waypoints.
  // Overlap section endpoints so no chosen shop is silently dropped.
  for (let offset = 0; offset < stops.length - 1; offset += 4) {
    const section = stops.slice(offset, offset + 5);
    const query = new URLSearchParams({ api: '1', origin: position(section[0]), destination: position(section[section.length - 1]), travelmode: 'driving' });
    if (section.length > 2) query.set('waypoints', section.slice(1, -1).map(position).join('|'));
    sections.push({ url: `https://www.google.com/maps/dir/?${query}`, from: offset + 1, to: offset + section.length });
  }
  return sections;
}
