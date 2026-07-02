# ⬡ RewardHub — Customer Reward System

A full-stack reward management system with real Email (SendGrid) and SMS (Twilio) delivery.

---

## 📁 Project Structure

```
rewardhub/
├── server.js          ← Node.js/Express backend
├── .env.example       ← Copy to .env and fill in your API keys
├── package.json
└── public/
    └── index.html     ← Frontend (served by Express)
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure API keys
```bash
cp .env.example .env
# Open .env and fill in your SendGrid and Twilio credentials
```

### 3. Start the server
```bash
node server.js
```

### 4. Open the app
Visit **http://localhost:3000**

**Login credentials:**
- Admin: `admin` / `admin123`
- Merchant: `merchant` / `merchant123`

---

## 🔑 Getting API Keys

### SendGrid (Email) — Free: 100 emails/day
1. Sign up at https://sendgrid.com
2. Go to **Settings → API Keys → Create API Key**
3. Verify a sender at **Settings → Sender Authentication**
4. Add to `.env`:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxx
   SENDGRID_FROM_EMAIL=rewards@yourdomain.com
   ```

### Twilio (SMS) — Free trial includes credits
1. Sign up at https://twilio.com
2. Get your **Account SID** and **Auth Token** from the dashboard
3. Get a phone number under **Phone Numbers → Manage**
4. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_FROM_NUMBER=+14155552671
   ```

---

## ✨ Features

| Feature | Admin | Merchant |
|---|---|---|
| Dashboard with live stats | ✅ | ✅ |
| Record purchases | ✅ | ✅ |
| Send email reward (SendGrid) | ✅ | ✅ |
| Send SMS reward (Twilio) | ✅ | ✅ |
| Manage merchants | ✅ | ❌ |
| View delivery status | ✅ | ✅ |
| API setup guide | ✅ | ✅ |

---

## 📧 Email Template

Each reward email includes:
- Customer name & purchase details
- Reward points earned (5% of purchase amount)
- Branded HTML template with dark theme
- Plain text fallback

## 📱 SMS Template

```
🎉 Hi {Name}! You earned ₹{reward} reward points for buying
"{product}" at {merchant}. Thank you! — RewardHub
```

---

## 🔌 API Endpoint

### POST /api/send-reward
```json
{
  "name": "Priya Sharma",
  "phone": "+91 98765 43210",
  "email": "priya@example.com",
  "amount": 2500,
  "product": "Blue Denim Jacket",
  "merchant": "StyleHub Store"
}
```

**Response:**
```json
{
  "success": true,
  "message": "🎉 Hi Priya Sharma! You earned ₹125 in RewardHub Points!...",
  "results": {
    "reward": 125,
    "email": { "sent": true, "to": "priya@example.com" },
    "sms":   { "sent": true, "to": "+91 98765 43210" }
  }
}
```

### GET /api/status
Returns whether SendGrid and Twilio are configured.
