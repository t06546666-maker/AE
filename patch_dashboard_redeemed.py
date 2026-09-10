import re

with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    tsx = f.read()

old_tags = """              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{data.summary.rewardPointsIssued || 0}</strong> Points Given
              </span>"""

new_tags = """              <span className="tag" style={{ background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                <strong>{(merchantQuery.data?.data as any)?.total_points_redeemed || 0}</strong> Points Redeemed
              </span>"""

tsx = tsx.replace(old_tags, new_tags)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx)
