import re

with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    tsx = f.read()

old_tags = """          {user.role === 'merchant' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{merchantQuery.data?.data?.point_balance || 0}</strong> points
              </span>
              <button type="button" className="button primary" style={{ background: '#F59E0B', color: 'white', border: 'none' }} onClick={() => setSubscribeOpen(true)}>
                Subscribe
              </button>
            </div>
          ) : null}"""

new_tags = """          {user.role === 'merchant' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{merchantQuery.data?.data?.point_balance || 0}</strong> Available Points
              </span>
              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{data.summary.rewardPointsIssued || 0}</strong> Points Given
              </span>
              <button type="button" className="button primary" style={{ background: '#F59E0B', color: 'white', border: 'none' }} onClick={() => setSubscribeOpen(true)}>
                Subscribe
              </button>
            </div>
          ) : null}"""

tsx = tsx.replace(old_tags, new_tags)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx)
