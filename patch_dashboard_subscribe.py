import re

with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Imports
code = code.replace(
    "import MerchantWallet from '../components/MerchantWallet';",
    "import { SubscriptionModal } from '../components/SubscriptionModal';"
)

# 2. Add state
code = code.replace(
    "const [scannerMode, setScannerMode] = useState<'earn' | 'redeem' | null>(null);",
    "const [scannerMode, setScannerMode] = useState<'earn' | 'redeem' | null>(null);\n  const [subscribeOpen, setSubscribeOpen] = useState(false);"
)

# 3. Add Subscribe button to Quick Actions
quick_actions_end = "{user.role === 'merchant' ? <button type=\"button\" className=\"button primary\" onClick={() => setScannerMode('redeem')}><Gift size={16}/> Redeem Points</button> : null}\n        </div>"

new_subscribe_action = """{user.role === 'merchant' ? <button type="button" className="button primary" onClick={() => setScannerMode('redeem')}><Gift size={16}/> Redeem Points</button> : null}
          {user.role === 'merchant' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{merchantQuery.data?.data?.point_balance || 0}</strong> points
              </span>
              <button type="button" className="button primary" style={{ background: '#F59E0B', color: 'white', border: 'none' }} onClick={() => setSubscribeOpen(true)}>
                Subscribe
              </button>
            </div>
          ) : null}
        </div>"""

code = code.replace(quick_actions_end, new_subscribe_action)

# 4. Remove MerchantWallet block and add SubscriptionModal
merchant_wallet_block = """{user.role === 'merchant' && merchantQuery.isPending && <LoadingState label="Loading wallet..." />}
      {user.role === 'merchant' && merchantQuery.isError && <ErrorState error={merchantQuery.error} retry={() => merchantQuery.refetch()} />}
      {user.role === 'merchant' && merchantQuery.data?.data && (
        <MerchantWallet 
          merchant={merchantQuery.data.data} 
          onUpdate={() => merchantQuery.refetch()} 
        />
      )}"""

subscription_modal = """{subscribeOpen && user.role === 'merchant' && merchantQuery.data?.data && (
        <SubscriptionModal merchant={merchantQuery.data.data} onClose={() => setSubscribeOpen(false)} onUpdate={() => merchantQuery.refetch()} />
      )}"""

code = code.replace(merchant_wallet_block, subscription_modal)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
