from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
import os

OUT = os.path.join(os.path.dirname(__file__), 'merchant-payment-options.pdf')
navy, blue, green, orange, light = HexColor('#10233F'), HexColor('#3158F5'), HexColor('#0F8A63'), HexColor('#D97706'), HexColor('#F3F6FC')
s = getSampleStyleSheet()
s.add(ParagraphStyle(name='TitleAE', parent=s['Title'], fontName='Helvetica-Bold', fontSize=25, leading=30, textColor=navy, alignment=TA_CENTER, spaceAfter=8))
s.add(ParagraphStyle(name='Sub', parent=s['Normal'], fontSize=10.5, leading=15, textColor=HexColor('#475569'), alignment=TA_CENTER, spaceAfter=16))
s.add(ParagraphStyle(name='H1AE', parent=s['Heading1'], fontSize=17, leading=21, textColor=navy, spaceBefore=8, spaceAfter=8))
s.add(ParagraphStyle(name='H2AE', parent=s['Heading2'], fontSize=12.5, leading=16, textColor=blue, spaceBefore=8, spaceAfter=5))
s.add(ParagraphStyle(name='BodyAE', parent=s['BodyText'], fontSize=9.5, leading=14, textColor=HexColor('#26364D'), spaceAfter=6))
s.add(ParagraphStyle(name='SmallAE', parent=s['BodyText'], fontSize=8.3, leading=11, textColor=HexColor('#52637A')))
s.add(ParagraphStyle(name='Flow', parent=s['BodyText'], fontSize=9.8, leading=14, textColor=colors.white, alignment=TA_CENTER))
P = lambda x, st='BodyAE': Paragraph(x, s[st])

def box(text, color):
    t = Table([[P(text, 'Flow')]], colWidths=[165*mm])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),color),('BOX',(0,0),(-1,-1),0.5,color),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    return t
def arrow(): return Paragraph('↓', s['H2AE'])
def footer(canvas, doc):
    canvas.saveState(); canvas.setFont('Helvetica', 8); canvas.setFillColor(HexColor('#64748B')); canvas.drawString(18*mm, 10*mm, 'Affiliate AE - Merchant Payment Options'); canvas.drawRightString(192*mm, 10*mm, f'Page {doc.page}'); canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=17*mm)
story = [P('Affiliate AE', 'TitleAE'), P('Merchant Payment Options: Direct UPI vs Razorpay', 'Sub'), P('Client decision guide', 'H1AE'), P('This document compares two ways a customer can pay after a merchant scans the customer QR code and applies reward-point redemption. Both options can open Google Pay, PhonePe, Paytm, BHIM, and other UPI apps. The main difference is whether payment is automatically verified.', 'BodyAE')]

table = Table([[P('<b>Option</b>','SmallAE'),P('<b>Flow</b>','SmallAE'),P('<b>Verification</b>','SmallAE'),P('<b>Best for</b>','SmallAE')],[P('<b>Direct UPI</b>','BodyAE'),P('AE opens a UPI link with merchant UPI ID and amount.','BodyAE'),P('Manual confirmation.','BodyAE'),P('Prototype or low-volume testing.','BodyAE')],[P('<b>Razorpay</b>','BodyAE'),P('AE opens Razorpay Checkout with UPI methods.','BodyAE'),P('Automatic webhook/signature verification.','BodyAE'),P('Production and client launch.','BodyAE')]], colWidths=[28*mm,57*mm,42*mm,38*mm])
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),colors.white),('BACKGROUND',(0,1),(-1,-1),light),('GRID',(0,0),(-1,-1),0.35,HexColor('#CBD5E1')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [table, Spacer(1,8), P('Option A - Direct UPI without Razorpay', 'H1AE'), P('The merchant saves a UPI ID such as <b>merchant@upi</b>. After checkout, AE creates a UPI deep link containing the final amount, merchant name, INR currency, and a unique AE order reference.', 'BodyAE')]
for text in ['Merchant scans customer QR and enters purchase amount','Points redemption is applied - example: INR 1,000 purchase - INR 30 discount = INR 970 payable','Customer receives a push notification: "Pay INR 970 to Merchant Name"','Customer taps the notification and selects a UPI app','Customer returns to AE; payment remains pending or is manually confirmed by the merchant']:
    story += [box(text, blue if text != 'Customer returns to AE; payment remains pending or is manually confirmed by the merchant' else orange), arrow()]
story += [P('Advantages', 'H2AE'), P('• No payment-gateway setup or gateway processing charge.<br/>• Fast to prototype and easy to explain.<br/>• Customer can use a preferred UPI app.<br/>• Merchant only needs a valid UPI ID.', 'BodyAE'), P('Limitations', 'H2AE'), P('• AE cannot reliably prove money was received from the UPI return result alone.<br/>• A customer could claim payment without completing it.<br/>• Merchant must confirm payment before points are finalized.<br/>• Refunds, reconciliation, reporting, and disputes are manual.', 'BodyAE'), PageBreak(), P('Option B - Razorpay with verified UPI payment', 'H1AE'), P('Razorpay handles checkout and sends a signed response/webhook to AE. AE finalizes the purchase and rewards only after payment is verified.', 'BodyAE')]
for text in ['Merchant scans customer QR and enters amount and redemption','AE calculates payable amount: purchase - redemption discount','AE creates a Razorpay payment order with the AE order reference','Customer receives a notification and opens Razorpay Checkout','Customer selects a UPI app and completes payment','Razorpay webhook/signature confirms payment to the AE backend','AE marks the order paid, deducts redeemed points, and credits earned points exactly once']:
    story += [box(text, green), arrow()]
story += [P('Advantages', 'H2AE'), P('• Automatic payment verification and safer reward issuance.<br/>• Better reconciliation, refunds, reporting, and failure handling.<br/>• Duplicate callbacks can be rejected safely.<br/>• Suitable for production and client launch.<br/>• Customer still gets familiar UPI options.', 'BodyAE'), P('Costs and responsibilities', 'H2AE'), P('• Razorpay account, KYC, business verification, and live-mode activation are required.<br/>• Processing/platform charges may apply; exact rates depend on the account and current provider terms.<br/>• AE must configure API keys, webhook URL, allowed events, and production secrets.', 'BodyAE'), PageBreak(), P('Shared AE checkout calculation', 'H1AE'), P('Both options use the same business calculation:', 'BodyAE')]
rules = Table([[P('<b>Step</b>','SmallAE'),P('<b>Example</b>','SmallAE')],[P('Purchase amount','BodyAE'),P('INR 1,000','BodyAE')],[P('Points redeemed','BodyAE'),P('100 points','BodyAE')],[P('Discount value','BodyAE'),P('INR 30','BodyAE')],[P('Final payable amount','BodyAE'),P('<b>INR 970</b>','BodyAE')],[P('Points earned','BodyAE'),P('Merchant/admin reward rule, maximum 100 points','BodyAE')]], colWidths=[65*mm,100*mm])
rules.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),colors.white),('BACKGROUND',(0,1),(-1,-1),HexColor('#F8FAFC')),('GRID',(0,0),(-1,-1),0.35,HexColor('#CBD5E1')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [rules, Spacer(1,8), P('Recommendation', 'H1AE'), P('<b>Use Razorpay for production.</b> Direct UPI is useful for a prototype or internal pilot, but it should not finalize points automatically because AE cannot independently verify that the customer paid. Razorpay adds setup and transaction costs, but provides the verification and operational safety needed for a real client deployment.', 'BodyAE'), P('Required information', 'H2AE'), P('• Merchant UPI ID or Razorpay-enabled merchant account<br/>• Merchant display name<br/>• Payment enabled/disabled status<br/>• Test/live mode<br/>• Customer notification permission<br/>• Razorpay API keys and webhook configuration for production', 'BodyAE')]
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
