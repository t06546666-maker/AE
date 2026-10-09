import { uiText } from '../uiText';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X } from 'lucide-react';
import { apiFetch } from '../api';

export function MerchantFeedback({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('App experience');
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const client = useQueryClient();
  const save = useMutation({ mutationFn: () => apiFetch('/api/merchant/feedback', { method: 'POST', body: JSON.stringify({ category, rating: rating ? Number(rating) : null, message: message.trim(), requestId }) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['merchant-feedback'] }); } });
  function edited() { setRequestId(crypto.randomUUID()); save.reset(); }
  return <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="merchant-feedback-title" onSubmit={event => { event.preventDefault(); if (!save.isPending && message.trim().length >= 2) save.mutate(); }}>
    <button className="icon-button modal-close" type="button" aria-label={uiText("Close feedback")} disabled={save.isPending} onClick={onClose}><X/></button>
    <h2 id="merchant-feedback-title"><MessageSquare size={22}/>{uiText(" Feedback to AE")}</h2>
    {save.isSuccess ? <><p role="status">{uiText("Thank you! Your feedback has been sent to the AE team.")}</p><button type="button" className="button primary" onClick={onClose}>{uiText("Done")}</button></> : <>
      <p>{uiText("Help us improve Affiliate AE. Share your experience, suggest a feature, or tell us about an issue.")}</p>
      <div className="settings-fields">
        <label>{uiText("Feedback about")}<select value={category} disabled={save.isPending} onChange={event => { setCategory(event.target.value); edited(); }}>{['App experience','Points & redemption','QR scanning','Product lists','Support','Suggestion','Other'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>{uiText("Your rating (optional)")}<select value={rating} disabled={save.isPending} onChange={event => { setRating(event.target.value); edited(); }}><option value="">{uiText("Select a rating")}</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
        <label>{uiText("Your feedback")}<textarea rows={5} required minLength={2} maxLength={2000} value={message} disabled={save.isPending} onChange={event => { setMessage(event.target.value); edited(); }} placeholder={uiText("Tell the AE team what works well or what we can improve…")}/></label>
        <small>{uiText("Please do not include passwords, OTPs, or customer personal information.")}</small>
        {save.isError && <p className="form-error" role="alert">{save.error.message}</p>}
        <button className="button primary" disabled={save.isPending || message.trim().length < 2}>{save.isPending ? uiText("Sending…") : uiText("Send feedback")}</button>
      </div>
    </>}
  </form></div>;
}
