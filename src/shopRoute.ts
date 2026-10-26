export type ShopRouteStop = { id: string; name: string; latitude?: number | null; longitude?: number | null };

export function hasShopLocation(stop: ShopRouteStop) {
  return stop.latitude != null && stop.longitude != null
    && String(stop.latitude).trim() !== '' && String(stop.longitude).trim() !== ''
    && Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude))
    && Math.abs(Number(stop.latitude)) <= 90 && Math.abs(Number(stop.longitude)) <= 180;
}

export function shopDrivingRoute(chosen: string[], shops: ShopRouteStop[]) {
  if (chosen.length < 2 || chosen.length > 27 || new Set(chosen).size !== chosen.length) throw new Error('Choose between 2 and 27 stops.');
  const stops = chosen.map(id => shops.find(shop => shop.id === id));
  if (stops.some(stop => !stop || !hasShopLocation(stop))) throw new Error('A selected shop no longer has a valid saved location. Refresh and select your stops again.');
  const position = (stop: ShopRouteStop | undefined) => ({ lat: Number(stop!.latitude), lng: Number(stop!.longitude) });
  return {
    origin: position(stops[0]), destination: position(stops[stops.length - 1]),
    waypoints: stops.slice(1, -1).map(stop => ({ location: position(stop), stopover: true })),
    optimizeWaypoints: false, travelMode: 'DRIVING',
  };
}
