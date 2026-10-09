import { uiText } from '../uiText';
import { X, Sparkles } from 'lucide-react';
import type { Merchant } from '../types';

interface SubscriptionModalProps {
  merchant: Merchant;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubscriptionModal({ onClose }: SubscriptionModalProps) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="subscription-title">
      <button type="button" className="icon-button modal-close" aria-label={uiText("Close subscription")} onClick={onClose}><X /></button>
      <Sparkles size={36} style={{ color: '#1875eb', marginBottom: 16 }} />
      <h2 id="subscription-title">{uiText("Subscription coming soon")}</h2>
      <p><strong>{uiText("You are on a free trial.")}</strong></p>
      <p>{uiText("We are working on subscriptions. No subscription payment is required during the free pilot.")}</p>
      <p>{uiText("Plan details will be announced when subscriptions are ready.")}</p>
      <button type="button" className="button primary" onClick={onClose}>{uiText("Got it")}</button>
    </section>
  </div>;
}
