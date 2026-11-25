/**
 * Official AE Rich Push Notification Templates
 * Reference: AE notification templates (RICH PUSH NOTIFICATIONS 01-06)
 * Pure push notifications (pushOnly: true, never saved into customer in-app inbox)
 */

export interface RichPushTemplate {
  id: string;
  number: string;
  bannerText: string;
  color: string;
  gradient: string;
  icon: string;
  title: string;
  body: string;
  defaultTarget: 'customers' | 'all';
  targetLabel: string;
  url: string;
  pushOnly: boolean;
  defaultImageUrl?: string;
  categoryMatch?: string[];
}

export const RICH_PUSH_TEMPLATES: RichPushTemplate[] = [
  {
    id: '01_offer_alert',
    defaultImageUrl: '/banners/01_offer_alert.png',
    number: '01 / OFFER ALERT',
    bannerText: 'AE OFFERS',
    color: '#ea580c',
    gradient: 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f97316 100%)',
    icon: 'local_offer',
    title: 'ഓഫറുകൾ കണ്ടോ?',
    body: 'നമ്മുടെ നാട്ടിലെ കിടിലൻ ഓഫറുകൾ അറിയാൻ ഇപ്പോൾ തന്നെ AE തുറക്കൂ.',
    defaultTarget: 'customers',
    targetLabel: 'Offer Browsers & Shoppers',
    url: '/offers',
    pushOnly: true,
  },
  {
    id: '02_shopping_reminder',
    number: '02 / SHOPPING REMINDER',
    bannerText: 'AE SHOP & SAVE',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #8b5cf6 100%)',
    icon: 'shopping_cart',
    title: 'ഇന്ന് പർച്ചേസ് ഉണ്ടോ?',
    body: 'കടയിൽ പോകുന്നതിന് മുമ്പ് AE തുറക്കാൻ മറക്കല്ലേ. ഡിസ്കൗണ്ടുകളും ഓഫറുകളും അറിയാം!',
    defaultTarget: 'customers',
    targetLabel: 'Active Retail Shoppers',
    url: '/merchants',
    pushOnly: true,
  },
  {
    id: '03_points_reminder',
    number: '03 / POINTS REMINDER',
    bannerText: 'AE POINTS',
    color: '#0284c7',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #38bdf8 100%)',
    icon: 'token',
    title: 'പർച്ചേസ് ചെയ്യുമ്പോൾ പോയിന്റുകൾ നേടാം!',
    body: 'AE സ്ഥാപനങ്ങളിൽ പർച്ചേസ് ചെയ്യുമ്പോൾ QR സ്കാൻ ചെയ്യാൻ മറക്കല്ലേ.',
    defaultTarget: 'customers',
    targetLabel: 'All Reward Members',
    url: '/scan',
    pushOnly: true,
  },
  {
    id: '04_food_alert',
    number: '04 / FOOD ALERT',
    bannerText: 'AE FOOD OFFERS',
    color: '#b45309',
    gradient: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
    icon: 'restaurant',
    title: 'എന്തെങ്കിലും സ്പെഷ്യൽ കഴിച്ചാലോ?',
    body: 'നമ്മുടെ നാട്ടിലെ ഭക്ഷണശാലകളിലെ ഓഫറുകൾ AE വഴി അറിയാം.',
    defaultTarget: 'customers',
    targetLabel: 'Food & Dining Category',
    url: '/offers?category=Food%20%26%20Dining',
    pushOnly: true,
    categoryMatch: ['food', 'dining', 'restaurant', 'cafe', 'bakery', 'sweets', 'hotel', 'biryani', 'shawarma'],
  },
  {
    id: '05_re_engagement',
    number: '05 / RE-ENGAGEMENT',
    bannerText: 'AE WHAT\'S NEW',
    color: '#0f766e',
    gradient: 'linear-gradient(135deg, #115e59 0%, #0f766e 50%, #14b8a6 100%)',
    icon: 'notifications_active',
    title: 'എന്താ, AE മറന്നോ?',
    body: 'പുതിയ ഓഫറുകളും ഡിസ്കൗണ്ടുകളും നിങ്ങളെ കാത്തിരിക്കുന്നു. ഒന്ന് തുറന്നു നോക്കൂ!',
    defaultTarget: 'customers',
    targetLabel: 'Inactive / Dormant Users (14+ days)',
    url: '/home',
    pushOnly: true,
  },
  {
    id: '06_local_merchant_promotion',
    number: '06 / LOCAL MERCHANT PROMOTION',
    bannerText: 'AE SHOP LOCAL',
    color: '#15803d',
    gradient: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #22c55e 100%)',
    icon: 'storefront',
    title: 'നമ്മുടെ നാട്ടിൽ തന്നെ ലാഭം നേടാം!',
    body: 'നമ്മുടെ നാട്, നമ്മുടെ സ്ഥാപനങ്ങൾ, നമ്മുടെ സന്തോഷം. AE കൂടെയുണ്ട്.',
    defaultTarget: 'all',
    targetLabel: 'Local Community & Shoppers',
    url: '/merchants',
    pushOnly: true,
  },
];

export function getTemplateForCategory(category?: string | null): RichPushTemplate {
  const cat = String(category || '').toLowerCase();
  if (
    cat.includes('food') ||
    cat.includes('dining') ||
    cat.includes('restaurant') ||
    cat.includes('cafe') ||
    cat.includes('bakery') ||
    cat.includes('sweets') ||
    cat.includes('hotel')
  ) {
    return RICH_PUSH_TEMPLATES.find((t) => t.id === '04_food_alert') || RICH_PUSH_TEMPLATES[3];
  }
  return RICH_PUSH_TEMPLATES.find((t) => t.id === '01_offer_alert') || RICH_PUSH_TEMPLATES[0];
}
