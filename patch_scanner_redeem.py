import os
import re

# 1. Patch QrScanner.tsx
with open('src/components/QrScanner.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Props update
code = code.replace("export default function QrScanner({ settings, autoStart = false }: { settings: RewardSettings; autoStart?: boolean }) {",
                    "export default function QrScanner({ settings, autoStart = false, mode = 'earn', merchantId }: { settings: RewardSettings; autoStart?: boolean; mode?: 'earn' | 'redeem'; merchantId?: string; }) {")

# State update
state_stmt = "  const [pointsToRedeem, setPointsToRedeem] = useState('');\n  const [redeemResult, setRedeemResult] = useState<{discountAmount: number; newBalance: number} | null>(null);\n"
code = code.replace("const [amount, setAmount] = useState('');", "const [amount, setAmount] = useState('');\n" + state_stmt)

# Redeem Mutation
redeem_mutation = """
  const redeem = useMutation({
    mutationFn: () => apiFetch<{ discountAmount: number; newBalance: number }>(`/api/merchants/${merchantId}/redeem`, {
      method: 'POST',
      body: JSON.stringify({
        customerCode: customer?.id,
        transactionAmount: Number(amount),
        pointsToRedeem: Number(pointsToRedeem),
      })
    }),
    onSuccess(data) {
      setRedeemResult(data);
      showToast('Redemption successful!', 'success');
      setCustomer(null); setAmount(''); setPointsToRedeem(''); locked.current = false;
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });
"""
code = code.replace("const points = Math.floor((eligibleAmount / 100) * percentage);", "const points = Math.floor((eligibleAmount / 100) * percentage);\n" + redeem_mutation)

# Replace the purchase fields and checkout button
old_fields = """<div className="purchase-fields">
                <label>{t('registration.purchaseAmount')}<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label>Points per ₹100<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{(settings.earnOptions || [5, 10, 20, 30, 50]).map((option: number) => <option key={option} value={option}>{option} Pts</option>)}</select></label>
              </div>
              <div className="point-preview"><strong>{formatPoints(points)} points</strong></div>
              <p className="amount-rule">{t('registration.minimum')}</p>
              <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || checkout.isPending} onClick={() => checkout.mutate()}>{t(checkout.isPending ? 'scanner.processing' : 'scanner.complete')}</button>"""

new_fields = """{redeemResult ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ margin: '0 0 8px' }}>Redemption Successful</h3>
                  <div style={{ background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Discount:</span><strong style={{ color: 'var(--success)' }}>₹{redeemResult.discountAmount.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Remaining pts:</span><strong>{redeemResult.newBalance} pts</strong>
                    </div>
                  </div>
                  <button type="button" className="button primary full-button" onClick={() => setRedeemResult(null)}>Done</button>
                </div>
              ) : mode === 'redeem' ? (
                <>
                  <div className="purchase-fields">
                    <label>Transaction Amount (₹)<input className="amount-input" type="number" min="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <label>Points to Redeem<input className="amount-input" type="number" min="100" max="1000" value={pointsToRedeem} onChange={(event) => setPointsToRedeem(event.target.value)} /></label>
                  </div>
                  <p className="amount-rule" style={{marginBottom: 10}}>Min 100, Max 1000 Points</p>
                  <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || Number(pointsToRedeem) < 100 || redeem.isPending} onClick={() => redeem.mutate()}>{redeem.isPending ? 'Processing...' : 'Calculate & Redeem'}</button>
                </>
              ) : (
                <>
                  <div className="purchase-fields">
                    <label>{t('registration.purchaseAmount')}<input className="amount-input" type="number" min="100" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <label>Points per ₹100<select value={percentage} onChange={(event) => setPercentage(Number(event.target.value))}>{(settings.earnOptions || [5, 10, 20, 30, 50]).map((option: number) => <option key={option} value={option}>{option} Pts</option>)}</select></label>
                  </div>
                  <div className="point-preview"><strong>{formatPoints(points)} points</strong></div>
                  <p className="amount-rule">{t('registration.minimum')}</p>
                  <button type="button" className="button primary full-button" disabled={Number(amount) < 100 || checkout.isPending} onClick={() => checkout.mutate()}>{t(checkout.isPending ? 'scanner.processing' : 'scanner.complete')}</button>
                </>
              )}"""

code = code.replace(old_fields, new_fields)
code = code.replace("<h2>{t('scanner.title')}</h2>", "<h2>{mode === 'redeem' ? 'Redeem Points' : t('scanner.title')}</h2>")
code = code.replace("<p>{t('scanner.subtitle')}</p>", "<p>{mode === 'redeem' ? 'Scan customer QR to apply discount' : t('scanner.subtitle')}</p>")

with open('src/components/QrScanner.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

# 2. Patch Dashboard.tsx
with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace states
code = code.replace("const [scannerOpen, setScannerOpen] = useState(false);\n  const [redeemOpen, setRedeemOpen] = useState(false);", "const [scannerMode, setScannerMode] = useState<'earn' | 'redeem' | null>(null);")

# Replace buttons
code = code.replace("onClick={() => setScannerOpen(true)}", "onClick={() => setScannerMode('earn')}")
code = code.replace("onClick={() => setRedeemOpen(true)}", "onClick={() => setScannerMode('redeem')}")

# Replace scanner render condition
code = code.replace("scannerOpen", "Boolean(scannerMode)")
code = code.replace("setScannerOpen(false)", "setScannerMode(null)")
code = code.replace("<QrScanner settings={settings.data} autoStart />", "<QrScanner settings={settings.data} mode={scannerMode as any} merchantId={user.merchant_id} autoStart />")

# Remove old RedemptionModal render
code = re.sub(r"\{redeemOpen && <RedemptionModal.*?\/>\}", "", code)
# Remove old RedemptionModal import
code = re.sub(r"import \{ RedemptionModal \} from '\.\.\/components\/RedemptionModal';\n", "", code)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
