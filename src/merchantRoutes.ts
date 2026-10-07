export const MERCHANT_ROUTES = ['Chittur 1', 'Chittur 2', 'Chittur 3', 'Thathamangalam 1', 'Thathamangalam 2', 'Thathamangalam 3'] as const;

// Reference coverage supplied by the AE weekly route plan. Not GPS geofences.
export const ROUTE_REFERENCE = [
  { route: 'Chittur 1', day: 'Monday', from: 'Chittur Hospital', via: 'Chittur Court', to: 'Post Office Junction', remarks: '' },
  { route: 'Chittur 2', day: 'Tuesday', from: 'Post Office Junction', via: 'Vadakathara Junction', to: 'Anikode Junction', remarks: '' },
  { route: 'Chittur 3', day: 'Wednesday', from: 'Anikode Junction', via: 'Thekkagramam', to: 'Mettupalayam', remarks: '' },
  { route: 'Thathamangalam 1', day: 'Thursday', from: 'Mettupalayam', via: 'Thathamangalam', to: 'Thathamangalam Taxi Stand', remarks: '' },
  { route: 'Thathamangalam 2', day: 'Friday', from: 'Taxi Stand', via: '', to: 'Koshakada', remarks: '' },
  { route: 'Thathamangalam 3', day: 'Saturday', from: 'Palimokku', via: 'Kammanthara', to: 'Taxi Stand', remarks: 'Admin-related work / meetings' },
] as const;

export function routeLabel(route: string) {
  const reference = ROUTE_REFERENCE.find(item => item.route === route);
  return reference ? `${route} (${[reference.from, reference.via, reference.to].filter(Boolean).join(' → ')})` : route;
}
