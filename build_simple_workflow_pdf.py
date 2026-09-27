from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

OUT = r'C:\Users\91730\Downloads\affiliate-ae-whatsapp-ordering-update\AE_Purchase_Debit_Credit_Workflow.pdf'
W,H=A4; navy=HexColor('#10243b'); purple=HexColor('#5546d9'); green=HexColor('#078b5a'); red=HexColor('#c74444'); blue=HexColor('#2369d1'); light=HexColor('#f3f6fb')
s=getSampleStyleSheet()
s.add(ParagraphStyle(name='TitleAE',parent=s['Title'],fontName='Helvetica-Bold',fontSize=23,leading=28,textColor=navy,alignment=TA_CENTER,spaceAfter=8))
s.add(ParagraphStyle(name='SubAE',parent=s['Normal'],fontSize=11,leading=15,textColor=HexColor('#5e6b7b'),alignment=TA_CENTER,spaceAfter=18))
s.add(ParagraphStyle(name='Step',parent=s['BodyText'],fontName='Helvetica-Bold',fontSize=11,leading=15,textColor=navy,alignment=TA_CENTER))
s.add(ParagraphStyle(name='Text',parent=s['BodyText'],fontSize=10,leading=15,textColor=navy,spaceAfter=5))
P=lambda x,st='Text': Paragraph(x,s[st])
steps=[('1','Customer purchases','INR 1,000 purchase is completed at the merchant.',blue),('2','Customer shows QR','Customer opens the AE QR code and shows it to the merchant.',blue),('3','Merchant scans QR','Merchant scans the QR and the customer account is verified.',blue),('4','Enter purchase amount','Merchant enters INR 1,000 and selects the points/discount options.',blue),('5','Debit existing points','If the customer redeems points, the selected points are debited from the customer balance and the discount is calculated.',red),('6','Credit new points','Points earned from this INR 1,000 purchase are credited to the customer balance.',green),('7','Save transaction','The backend saves purchase, redemption and points ledger records in Supabase.',purple),('8','Update and notify','New balance, discount and receipt are shown. Customer and merchant notifications are sent.',purple)]
story=[Spacer(1,12*mm),P('Affiliate AE','TitleAE'),P('Purchase + Redeem Points Workflow','SubAE'),P('<b>Example:</b> A customer makes an INR 1,000 purchase. During the same checkout, the merchant may redeem selected existing points and also credit the new points earned from this purchase. <b>Closing balance = opening balance - redeemed points + earned points.</b>','Text')]
rows=[]
for i,(n,title,desc,color) in enumerate(steps):
    marker = n + ('  ->' if i < len(steps)-1 else '')
    rows.append([P('<font color="%s"><b>%s</b></font>'%(color,marker),'Step'),P('<b>%s</b><br/>%s'%(title,desc))])
t=Table(rows,colWidths=[18*mm,152*mm]); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),light),('BOX',(0,0),(-1,-1),.7,HexColor('#d8e1ef')),('INNERGRID',(0,0),(-1,-1),.35,HexColor('#d8e1ef')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)])); story.append(t)
story += [Spacer(1,4),P('<b>Backend accounting rule:</b> Debit and credit are recorded as separate ledger entries under one checkout/transaction reference, so the balance and audit history remain correct.','Text')]
def footer(c,d):
    c.saveState(); c.setStrokeColor(HexColor('#d8e1ef')); c.line(18*mm,14*mm,W-18*mm,14*mm); c.setFont('Helvetica',7.5); c.setFillColor(HexColor('#5e6b7b')); c.drawString(18*mm,9*mm,'Affiliate AE - Purchase + Redeem Workflow'); c.drawRightString(W-18*mm,9*mm,'Page %d'%d.page); c.restoreState()
SimpleDocTemplate(OUT,pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=16*mm,bottomMargin=20*mm).build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
