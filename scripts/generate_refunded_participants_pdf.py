import json
import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas

# --- Numbered Canvas for Two-Pass Page X of Y & Running Headers/Footers ---
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        
        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(28, 818, "TECHFEST '26 SLIET LONGOWAL • UNSTOP FEE REFUND & CANDIDATE TRANSITION AUDIT")
            self.setFont("Helvetica-Bold", 7.5)
            self.setFillColor(colors.HexColor("#7C3AED"))
            self.drawRightString(A4[0] - 28, 818, "REFUND AUDIT LEDGER • CONFIDENTIAL")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(28, 812, A4[0] - 28, 812)

        # Running Footer (all pages)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(28, 18, "Sant Longowal Institute of Engineering & Technology • Operations Command Desk • techfest26.in")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 28, 18, page_str)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(28, 26, A4[0] - 28, 26)
        
        self.restoreState()


def format_phone(phone_str):
    if not phone_str or phone_str == 'N/A':
        return 'N/A'
    p = str(phone_str).strip()
    digits = re.sub(r'\D', '', p)
    if digits.startswith('91') and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 10:
        return f"+91 {digits[:5]} {digits[5:]}"
    return p


def build_pdf(output_paths):
    with open('data/paid_participants.json') as f:
        participants = json.load(f)

    # Domain mapping
    event_domains = {
        'RC Boat': ('RoboZar', 'Robotics & Mechatronics', '#0284C7'),
        'Ghost Code': ('Plexus', 'Computer Science & Coding', '#2563EB'),
        'RoboSoccer': ('RoboZar', 'Robotics & Combat', '#0284C7'),
        'Soldering Speedrun': ('Electrica', 'Electronics & Hardware', '#059669'),
        'Poster and Paper Presentation': ('Chemica', 'Chemical & Applied Sciences', '#D97706'),
        'Kritrim - Model Exhibition': ('Karyarachna', 'Innovation & Prototyping', '#7C3AED'),
    }

    styles = getSampleStyleSheet()

    # Typography & Styles
    h_top = ParagraphStyle(
        'OrgHeader',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#64748B'),
        alignment=TA_LEFT
    )

    doc_title = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=2
    )

    sub_title = ParagraphStyle(
        'DocSub',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8
    )

    section_heading = ParagraphStyle(
        'SecHeading',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=7,
        spaceAfter=3
    )

    badge_style = ParagraphStyle(
        'Badge',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#7C3AED'),
        alignment=TA_RIGHT
    )

    cell_th = ParagraphStyle(
        'CellTH',
        fontName='Helvetica-Bold',
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor('#0F172A'),
        alignment=TA_LEFT
    )

    cell_th_center = ParagraphStyle(
        'CellTHCenter',
        parent=cell_th,
        alignment=TA_CENTER
    )

    cell_th_right = ParagraphStyle(
        'CellTHRight',
        parent=cell_th,
        alignment=TA_RIGHT
    )

    cell_text = ParagraphStyle(
        'CellText',
        fontName='Helvetica',
        fontSize=6.5,
        leading=8.2,
        textColor=colors.HexColor('#1E293B')
    )

    cell_bold = ParagraphStyle(
        'CellBold',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8.2,
        textColor=colors.HexColor('#0F172A')
    )

    cell_code = ParagraphStyle(
        'CellCode',
        fontName='Courier',
        fontSize=5.6,
        leading=7.0,
        textColor=colors.HexColor('#475569')
    )

    cell_right = ParagraphStyle(
        'CellRight',
        parent=cell_text,
        alignment=TA_RIGHT
    )

    cell_amount = ParagraphStyle(
        'CellAmt',
        fontName='Helvetica-Bold',
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor('#7C3AED'),
        alignment=TA_RIGHT
    )

    card_title = ParagraphStyle(
        'CardTitle',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )

    card_sub = ParagraphStyle(
        'CardSub',
        fontName='Helvetica',
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor('#64748B')
    )

    dossier_label = ParagraphStyle(
        'DossierLabel',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8.2,
        textColor=colors.HexColor('#475569')
    )

    dossier_val = ParagraphStyle(
        'DossierVal',
        fontName='Helvetica',
        fontSize=6.5,
        leading=8.2,
        textColor=colors.HexColor('#0F172A')
    )

    script_box_style = ParagraphStyle(
        'ScriptBox',
        fontName='Helvetica-Oblique',
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor('#1E293B')
    )

    story = []

    # =========================================================================
    # PAGE 1: EXECUTIVE MEMORANDUM, KPI SUMMARY & CONSOLIDATED LEDGER
    # =========================================================================

    # 1. Header Banner
    top_tbl_data = [
        [
            Paragraph("<b>SANT LONGOWAL INSTITUTE OF ENGINEERING & TECHNOLOGY (SLIET)</b><br/>"
                      "<font size='6.5' color='#64748B'>Deemed-to-be-University under Ministry of Education, Govt. of India • Longowal, Punjab</font><br/>"
                      "<b>TECHFEST '26 OPERATIONS & FINANCIAL AUDIT COMMAND DESK</b>", h_top),
            Paragraph("<b>AUDIT REF:</b> <font color='#0F172A'>TF26/REF-AUDIT/01</font><br/>"
                      "<b>DATE:</b> <font color='#0F172A'>October 8, 2026</font><br/>"
                      "<b>STATUS:</b> <font color='#7C3AED'><b>100% DISBURSED</b></font>", badge_style)
        ]
    ]
    top_tbl = Table(top_tbl_data, colWidths=[380, 163])
    top_tbl.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(top_tbl)
    story.append(Spacer(1, 4))

    # Divider
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#7C3AED'), spaceAfter=5, spaceBefore=2))

    # Title & Subtitle
    story.append(Paragraph("Unstop Registration Fee Refund Audit & Candidate Transition Report", doc_title))
    story.append(Paragraph("Consolidated dossier of participants whose Unstop gateway payments were refunded following the strategic transition to the official <b>techfest26.in</b> platform.", sub_title))

    # Operational Notice Box
    memo_text = Paragraph(
        "<b>EXECUTIVE AUDIT NOTICE:</b> Due to the migration of festival registrations to the internal centralized portal "
        "(<b>https://techfest26.in</b>), all initial payment transactions collected on Unstop were initiated for complete refund "
        "back to the respective candidates. This document serves as the official financial ledger of all <b>7 refunded registrations</b> "
        "(representing <b>16 total student participants</b> and <b>Rs. 6,988.00 in total refunded capital</b>). "
        "The Reception & Outreach Calling Desk is directed to contact each team lead listed below to confirm receipt of refund "
        "and guide them through re-completing registration directly on <b>techfest26.in</b>.",
        ParagraphStyle('MemoText', fontName='Helvetica', fontSize=7.2, leading=9.5, textColor=colors.HexColor('#1E293B'))
    )
    memo_table = Table([[memo_text]], colWidths=[543])
    memo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F5F3FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#DDD6FE')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(memo_table)
    story.append(Spacer(1, 6))

    # 4-KPI Metric Grid
    kpi_data = [
        [
            Paragraph("<b>Total Refunded Leads</b><br/><font size='12' color='#7C3AED'><b>7 Teams</b></font><br/><font size='6.5' color='#64748B'>100% Unstop Payments</font>", ParagraphStyle('K1', fontName='Helvetica', fontSize=7.5, leading=9.5)),
            Paragraph("<b>Total Students / Members</b><br/><font size='12' color='#0F172A'><b>16 Candidates</b></font><br/><font size='6.5' color='#64748B'>Rosters Documented</font>", ParagraphStyle('K2', fontName='Helvetica', fontSize=7.5, leading=9.5)),
            Paragraph("<b>Total Amount Refunded</b><br/><font size='12' color='#059669'><b>Rs. 6,988.00</b></font><br/><font size='6.5' color='#64748B'>Disbursed to Source</font>", ParagraphStyle('K3', fontName='Helvetica', fontSize=7.5, leading=9.5)),
            Paragraph("<b>Tech Domains Involved</b><br/><font size='12' color='#2563EB'><b>5 Domains</b></font><br/><font size='6.5' color='#64748B'>6 Distinct Competitions</font>", ParagraphStyle('K4', fontName='Helvetica', fontSize=7.5, leading=9.5)),
        ]
    ]
    kpi_tbl = Table(kpi_data, colWidths=[135.5, 136, 136, 135.5])
    kpi_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.7, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(kpi_tbl)
    story.append(Spacer(1, 6))

    # Master Ledger Table Section
    story.append(Paragraph("1. Master Consolidated Refund Ledger (All 7 Transactions)", section_heading))

    # Widths sum to 543: 12 + 76 + 94 + 80 + 98 + 22 + 50 + 66 + 45 = 543
    col_w = [12, 76, 94, 80, 98, 22, 50, 66, 45]
    ledger_rows = [
        [
            Paragraph("<b>#</b>", cell_th_center),
            Paragraph("<b>Lead ID</b>", cell_th),
            Paragraph("<b>Candidate / Team</b>", cell_th),
            Paragraph("<b>Event & Domain</b>", cell_th),
            Paragraph("<b>College / Institution</b>", cell_th),
            Paragraph("<b>Size</b>", cell_th_center),
            Paragraph("<b>Refund</b>", cell_th_right),
            Paragraph("<b>Unstop Ref</b>", cell_th),
            Paragraph("<b>Status</b>", cell_th_center),
        ]
    ]

    total_amount = sum(float(p.get('amount') or 0) for p in participants)
    total_members = sum(int(p.get('team_size') or 1) for p in participants)

    for idx, p in enumerate(participants, 1):
        amt = float(p.get('amount') or 0)
        ev_info = event_domains.get(p.get('event_name'), ('Inter-Domain', 'General', '#64748B'))
        college_short = p.get('college') or 'Unknown'
        if len(college_short) > 34:
            college_short = college_short[:32] + '...'
            
        team_display = p.get('name')
        if p.get('team_name') and p.get('team_name') != p.get('name'):
            team_display = f"{p.get('name')}<br/><font color='#64748B'>({p.get('team_name')})</font>"

        ledger_rows.append([
            Paragraph(str(idx), ParagraphStyle('CIdx', parent=cell_text, alignment=TA_CENTER)),
            Paragraph(p.get('id', 'N/A'), cell_code),
            Paragraph(team_display, cell_bold),
            Paragraph(f"<b>{p.get('event_name')}</b><br/><font color='{ev_info[2]}'>{ev_info[0]}</font>", cell_text),
            Paragraph(college_short, cell_text),
            Paragraph(str(p.get('team_size', 1)), ParagraphStyle('CSize', parent=cell_text, alignment=TA_CENTER)),
            Paragraph(f"Rs. {amt:,.2f}", cell_amount),
            Paragraph(p.get('payment_id', 'N/A'), cell_code),
            Paragraph("<font color='#7C3AED'><b>REFUNDED</b></font>", ParagraphStyle('CSt', fontName='Helvetica-Bold', fontSize=6.2, leading=7.8, textColor=colors.HexColor('#7C3AED'), alignment=TA_CENTER)),
        ])

    # Total Row with proper cell spanning across first 3 columns
    ledger_rows.append([
        Paragraph("<b>TOTAL: 7 Registrations Audited</b>", ParagraphStyle('Tot1', fontName='Helvetica-Bold', fontSize=6.8, leading=8.5, textColor=colors.HexColor('#0F172A'))),
        Paragraph("", cell_text),
        Paragraph("", cell_text),
        Paragraph("<b>6 Events</b>", cell_text),
        Paragraph("<b>5 Colleges / Pan-India</b>", cell_text),
        Paragraph(f"<b>{total_members}</b>", ParagraphStyle('TotSize', parent=cell_th_center)),
        Paragraph(f"<b>Rs. {total_amount:,.2f}</b>", ParagraphStyle('TotAmt', fontName='Helvetica-Bold', fontSize=6.8, leading=8.5, textColor=colors.HexColor('#7C3AED'), alignment=TA_RIGHT)),
        Paragraph("<b>100% Disbursed</b>", cell_text),
        Paragraph("<b>RESOLVED</b>", ParagraphStyle('TotRes', fontName='Helvetica-Bold', fontSize=6.2, leading=7.8, textColor=colors.HexColor('#059669'), alignment=TA_CENTER)),
    ])

    ledger_tbl = Table(ledger_rows, colWidths=col_w)
    ledger_tbl_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOTTOMPADDING', (0,0), (-1,0), 3),
        ('TOPPADDING', (0,0), (-1,0), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('TOPPADDING', (0,-1), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 3.5),
        ('SPAN', (0, -1), (2, -1)), # Span columns 0, 1, and 2 in the total row
    ]

    for i in range(1, len(ledger_rows) - 1):
        if i % 2 == 0:
            ledger_tbl_style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FAFAFA')))
        ledger_tbl_style.append(('TOPPADDING', (0, i), (-1, i), 3))
        ledger_tbl_style.append(('BOTTOMPADDING', (0, i), (-1, i), 3))

    ledger_tbl.setStyle(TableStyle(ledger_tbl_style))
    story.append(ledger_tbl)
    story.append(Spacer(1, 6))

    # Domain Breakdown & College Distribution Sub-Tables
    story.append(Paragraph("2. Financial & Institutional Distribution Summary", section_heading))

    # Domain summary table data
    dom_summary = [
        [
            Paragraph("<b>Technical Domain</b>", cell_th),
            Paragraph("<b>Events Involved</b>", cell_th),
            Paragraph("<b>Teams</b>", cell_th_center),
            Paragraph("<b>Students</b>", cell_th_center),
            Paragraph("<b>Refunded Amount</b>", cell_th_right),
            Paragraph("<b>Share (%)</b>", cell_th_right),
        ],
        [
            Paragraph("<b>RoboZar</b>", cell_bold),
            Paragraph("RC Boat, RoboSoccer", cell_text),
            Paragraph("2", ParagraphStyle('D1', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("9", ParagraphStyle('D2', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("Rs. 5,391.00", cell_amount),
            Paragraph("77.1%", cell_right),
        ],
        [
            Paragraph("<b>Karyarachna</b>", cell_bold),
            Paragraph("Kritrim - Model Exhibition", cell_text),
            Paragraph("1", ParagraphStyle('D1', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("1", ParagraphStyle('D2', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("Rs. 599.00", cell_amount),
            Paragraph("8.6%", cell_right),
        ],
        [
            Paragraph("<b>Electrica</b>", cell_bold),
            Paragraph("Soldering Speedrun", cell_text),
            Paragraph("1", ParagraphStyle('D1', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("2", ParagraphStyle('D2', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("Rs. 598.00", cell_amount),
            Paragraph("8.5%", cell_right),
        ],
        [
            Paragraph("<b>Plexus</b>", cell_bold),
            Paragraph("Ghost Code", cell_text),
            Paragraph("2", ParagraphStyle('D1', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("2", ParagraphStyle('D2', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("Rs. 200.00", cell_amount),
            Paragraph("2.9%", cell_right),
        ],
        [
            Paragraph("<b>Chemica</b>", cell_bold),
            Paragraph("Poster and Paper Presentation", cell_text),
            Paragraph("1", ParagraphStyle('D1', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("2", ParagraphStyle('D2', parent=cell_text, alignment=TA_CENTER)),
            Paragraph("Rs. 200.00", cell_amount),
            Paragraph("2.9%", cell_right),
        ],
        [
            Paragraph("<b>TOTAL</b>", cell_bold),
            Paragraph("<b>5 Domains / 6 Events</b>", cell_bold),
            Paragraph("<b>7</b>", ParagraphStyle('D3', parent=cell_bold, alignment=TA_CENTER)),
            Paragraph("<b>16</b>", ParagraphStyle('D4', parent=cell_bold, alignment=TA_CENTER)),
            Paragraph(f"<b>Rs. {total_amount:,.2f}</b>", ParagraphStyle('D5', fontName='Helvetica-Bold', fontSize=7.2, textColor=colors.HexColor('#7C3AED'), alignment=TA_RIGHT)),
            Paragraph("<b>100.0%</b>", ParagraphStyle('D6', parent=cell_bold, alignment=TA_RIGHT)),
        ]
    ]
    dom_tbl = Table(dom_summary, colWidths=[90, 163, 45, 50, 115, 80])
    dom_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(dom_tbl)

    # Page Break for Candidate Detailed Dossiers
    story.append(PageBreak())

    # =========================================================================
    # PAGES 2, 3, 4: CANDIDATE-BY-CANDIDATE DETAILED DOSSIERS
    # =========================================================================

    def render_candidate_card(p, index_num):
        ev_info = event_domains.get(p.get('event_name'), ('Inter-Domain', 'General', '#64748B'))
        amt = float(p.get('amount') or 0)
        team_size = int(p.get('team_size') or 1)
        members = p.get('team_members') or []

        card_elements = []

        # 1. Header of Card
        h_table_data = [
            [
                Paragraph(f"<b>DOSSIER #{index_num}: {p.get('name').upper()}</b> "
                          f"<font color='#64748B'>({p.get('team_name')})</font><br/>"
                          f"<font size='7' color='{ev_info[2]}'><b>{p.get('event_name')}</b></font> • "
                          f"<font size='7' color='#475569'>{ev_info[0]} Domain ({ev_info[1]})</font>", card_title),
                Paragraph(f"<b>REFUNDED: Rs. {amt:,.2f}</b><br/>"
                          f"<font size='6.5' color='#475569'>UNSTOP REFUND DISBURSED</font>", badge_style)
            ]
        ]
        h_table = Table(h_table_data, colWidths=[395, 148])
        h_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F5F3FF')),
            ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#DDD6FE')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        card_elements.append(h_table)

        # 2. Key Facts Metadata Grid
        phone_f = format_phone(p.get('phone'))
        reg_time = p.get('registered_at', 'N/A')
        college_name = p.get('college', 'N/A')
        spec = p.get('specialization', 'N/A') or 'N/A'
        pass_yr = p.get('passing_year', 'N/A') or 'N/A'
        unstop_id = str(p.get('internal_id') or 'N/A')
        pay_id = str(p.get('payment_id') or 'N/A')

        meta_rows = [
            [
                Paragraph("<b>Primary Contact:</b>", dossier_label),
                Paragraph(f"<b>{phone_f}</b> | {p.get('email')}", dossier_val),
                Paragraph("<b>Registration ID:</b>", dossier_label),
                Paragraph(f"<font face='Courier'>{p.get('id')}</font>", dossier_val),
            ],
            [
                Paragraph("<b>Institution:</b>", dossier_label),
                Paragraph(college_name, dossier_val),
                Paragraph("<b>Unstop Payment ID:</b>", dossier_label),
                Paragraph(f"<font face='Courier'>{pay_id}</font> (Int: {unstop_id})", dossier_val),
            ],
            [
                Paragraph("<b>Branch / Year:</b>", dossier_label),
                Paragraph(f"{spec} (Class of {pass_yr})", dossier_val),
                Paragraph("<b>Registered At:</b>", dossier_label),
                Paragraph(reg_time, dossier_val),
            ]
        ]
        meta_table = Table(meta_rows, colWidths=[80, 215, 88, 160])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ]))
        card_elements.append(meta_table)

        # 3. Team Roster (If team members exist)
        if members:
            roster_rows = [
                [
                    Paragraph("<b>#</b>", cell_th_center),
                    Paragraph("<b>Member Name</b>", cell_th),
                    Paragraph("<b>Role</b>", cell_th),
                    Paragraph("<b>Phone</b>", cell_th),
                    Paragraph("<b>Email</b>", cell_th),
                    Paragraph("<b>Branch / Course</b>", cell_th),
                ]
            ]
            for m_idx, m in enumerate(members, 1):
                is_lead = (m_idx == 1)
                role_label = "<font color='#7C3AED'><b>Team Leader</b></font>" if is_lead else "Team Member"
                m_phone = format_phone(m.get('phone'))
                roster_rows.append([
                    Paragraph(str(m_idx), ParagraphStyle('RMIdx', parent=cell_text, alignment=TA_CENTER)),
                    Paragraph(f"<b>{m.get('name')}</b>", cell_bold),
                    Paragraph(role_label, cell_text),
                    Paragraph(m_phone, cell_text),
                    Paragraph(m.get('email', 'N/A'), cell_text),
                    Paragraph(m.get('course', 'N/A') or 'N/A', cell_text),
                ])
            roster_tbl = Table(roster_rows, colWidths=[18, 110, 65, 80, 130, 140])
            roster_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0,0), (-1,-1), 2.5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ]))
            card_elements.append(roster_tbl)

        # 4. Calling Script / Action Guidance Box
        script_html = (
            f"<b>CALLING DESK ACTION PROTOCOL:</b> "
            f"Candidate was refunded <b>Rs. {amt:,.2f}</b>. Coordinator should inform: "
            f"<i>'Hello {p.get('name')}, calling from SLIET TechFEST '26 regarding your registration in {p.get('event_name')}. "
            f"Your initial fee of Rs. {amt:,.0f} has been processed for refund to your account. To retain your team slot, "
            f"please complete your direct spot confirmation on our official portal: <b>techfest26.in</b>.'</i>"
        )
        action_tbl = Table([[Paragraph(script_html, script_box_style)]], colWidths=[543])
        action_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FAFAFA')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        card_elements.append(action_tbl)
        card_elements.append(Spacer(1, 8))

        return KeepTogether(card_elements)

    # PAGE 2: Candidate 1 (Team of 5) and Candidate 2 (Team of 4)
    story.append(Paragraph("3. Detailed Candidate Dossiers & Team Rosters", section_heading))
    story.append(Paragraph("Full profile dossiers including contact details, course specialization, Unstop audit IDs, complete team rosters, and customized calling desk instructions.", sub_title))
    
    story.append(render_candidate_card(participants[0], 1)) # Pachalla Sannihith (5 members)
    story.append(Spacer(1, 4))
    story.append(render_candidate_card(participants[3], 2)) # Harminder Singh (4 members)

    story.append(PageBreak())

    # PAGE 3: Candidates 3, 4, 5
    story.append(render_candidate_card(participants[4], 3)) # adarsh shetty (2 members)
    story.append(Spacer(1, 4))
    story.append(render_candidate_card(participants[5], 4)) # Shivansh (2 members)
    story.append(Spacer(1, 4))
    story.append(render_candidate_card(participants[6], 5)) # Manitosh Garg (1 member)

    story.append(PageBreak())

    # PAGE 4: Candidates 6, 7 + Operational SOP & Sign-off
    story.append(render_candidate_card(participants[1], 6)) # Ishika Singh (1 member)
    story.append(Spacer(1, 4))
    story.append(render_candidate_card(participants[2], 7)) # Jiya Rana Rana (1 member)
    story.append(Spacer(1, 10))

    # SECTION 4: CALLING DESK OPERATIONAL SOP & SIGN-OFF
    sop_heading = Paragraph("4. Standard Operating Procedure (SOP) for Outreach Calling Desk", section_heading)
    story.append(sop_heading)

    sop_box_content = Paragraph(
        "<b>CALLING PROTOCOL WORKFLOW:</b><br/>"
        "<b>Step 1: Receipt Verification —</b> Inquire if the candidate has seen the refund credit in their original bank/UPI account.<br/>"
        "<b>Step 2: Transition Guidance —</b> Explain that all competitive submissions, rulebook updates, problem statements, and slot allocations are strictly hosted on <b>techfest26.in</b>.<br/>"
        "<b>Step 3: Registration Re-Confirmation —</b> Guide the student to open <b>techfest26.in</b>, navigate to their respective event, and complete the official festival check-in.<br/>"
        "<b>Step 4: CRM Logging —</b> In the techFEST Admin Tracker, click <b>'Re-Call'</b> or open candidate drawer to log call outcome (e.g., <i>Payment Promised on techfest26.in</i>, <i>Callback Requested</i>, etc.).",
        ParagraphStyle('SOPText', fontName='Helvetica', fontSize=7.2, leading=10, textColor=colors.HexColor('#1E293B'))
    )
    sop_table = Table([[sop_box_content]], colWidths=[543])
    sop_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(sop_table)
    story.append(Spacer(1, 14))

    # Official Sign-Off Block
    sign_data = [
        [
            Paragraph("<b>AUDITED BY</b><br/><br/><br/>"
                      "__________________________<br/>"
                      "<b>Finance & Accounts Desk</b><br/>"
                      "<font size='6.5' color='#64748B'>techFEST '26 Central Finance</font>", ParagraphStyle('S1', fontName='Helvetica', fontSize=7.5, leading=9.5)),
            Paragraph("<b>OPERATIONS CLEARANCE</b><br/><br/><br/>"
                      "__________________________<br/>"
                      "<b>Sagar Anmol</b><br/>"
                      "<font size='6.5' color='#64748B'>Lead Operations & Coordinator</font>", ParagraphStyle('S2', fontName='Helvetica', fontSize=7.5, leading=9.5)),
            Paragraph("<b>TECHNICAL COMMITTEE</b><br/><br/><br/>"
                      "__________________________<br/>"
                      "<b>Web & Portal Admin</b><br/>"
                      "<font size='6.5' color='#64748B'>techfest26.in Core Systems</font>", ParagraphStyle('S3', fontName='Helvetica', fontSize=7.5, leading=9.5)),
        ]
    ]
    sign_tbl = Table(sign_data, colWidths=[181, 181, 181])
    sign_tbl.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(sign_tbl)

    # Build PDF for all requested output paths
    for pth in output_paths:
        os.makedirs(os.path.dirname(pth), exist_ok=True)
        doc = SimpleDocTemplate(
            pth,
            pagesize=A4,
            leftMargin=26,
            rightMargin=26,
            topMargin=26,
            bottomMargin=28
        )
        doc.build(list(story), canvasmaker=NumberedCanvas)
        print(f"✓ PDF successfully generated at: {pth}")

if __name__ == '__main__':
    artifact_path = '/Users/rajaryan/.gemini/antigravity/brain/c39e06e0-39ba-4181-9638-42d372d7e5ba/TechFEST26_Refunded_Participants_Audit_Report.pdf'
    public_path = '/Users/rajaryan/.gemini/antigravity/scratch/unstop-paid-tracker/public/TechFEST26_Refunded_Participants_Audit_Report.pdf'
    root_path = '/Users/rajaryan/.gemini/antigravity/scratch/unstop-paid-tracker/TechFEST26_Refunded_Participants_Audit_Report.pdf'

    build_pdf([artifact_path, public_path, root_path])
