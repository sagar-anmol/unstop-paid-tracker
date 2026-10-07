import json, os, re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748B'))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(20, 822, "techFEST '26 — All 61 Competitions Completion, College Breakdown & Payment Audit")
            self.setStrokeColor(colors.HexColor('#E2E8F0'))
            self.setLineWidth(0.5)
            self.line(20, 816, 575, 816)

        # Footer
        self.setStrokeColor(colors.HexColor('#E2E8F0'))
        self.setLineWidth(0.5)
        self.line(20, 26, 575, 26)
        self.drawString(20, 16, "techFEST '26 Operations Command Desk • SLIET Longowal • Prepared for Sagar Anmol")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(575, 16, page_str)
        self.restoreState()

def run():
    with open('data.json') as f:
        data = json.load(f)

    with open('data/summary.json') as f:
        summary_data = json.load(f)
    
    with open('src/utils/auth.js') as f:
        auth_content = f.read()

    # Extract domain event mappings
    domain_events = {}
    matches = re.findall(r"name:\s*'([^']+)',.*?events:\s*\[(.*?)\]", auth_content, re.DOTALL)
    for d_name, ev_list in matches:
        evs = [e.strip(" '") for e in ev_list.split(',') if e.strip(" '")]
        domain_events[d_name] = evs

    def get_domain(title):
        t = title.lower().strip()
        for d_name, evs in domain_events.items():
            for e in evs:
                el = e.lower().strip()
                if el == t or el in t or t in el:
                    return d_name
        return 'Multi-Domain'

    # Filter out Logic Flow (private test event per Sagar's explicit request)
    participants = [p for p in data.get('participants', []) if 'logic flow' not in (p.get('event_name') or '').lower()]

    summary_events = {e['title'].strip().lower(): e for e in summary_data.get('events_list', []) if 'logic flow' not in e['title'].lower()}

    # Group by event
    event_data = {}
    for p in participants:
        ev = (p.get('event_name') or 'Unknown').strip()
        if ev not in event_data:
            s_ev = summary_events.get(ev.lower(), {})
            event_data[ev] = {
                'id': str(s_ev.get('id') or p.get('event_id') or p.get('opportunity_id') or ''),
                'title': ev,
                'domain': get_domain(ev),
                'total': 0,
                'sliet': 0,
                'outside': 0,
                'complete': 0,
                'pending': 0,
                'amount': 0.0
            }
        ed = event_data[ev]
        ed['total'] += 1

        col = (p.get('college') or '').lower().strip()
        if 'sliet' in col or 'sant longowal' in col:
            ed['sliet'] += 1
        else:
            ed['outside'] += 1

        amt = float(p.get('amount') or 0)
        ed['amount'] += amt

        is_incomp = (
            p.get('payment_status') in ['INCOMPLETE', 'UNPAID'] or 
            'not paid' in (p.get('status_label') or '').lower() or
            p.get('is_paid') is False
        )
        if not is_incomp and (p.get('is_paid') is True or p.get('payment_status') == 'PAID' or amt > 0):
            ed['complete'] += 1
        elif is_incomp:
            ed['pending'] += 1
        else:
            if amt > 0:
                ed['complete'] += 1
            else:
                ed['pending'] += 1

    events_sorted = sorted(event_data.values(), key=lambda x: (x['total'], x['pending']), reverse=True)

    tot_all = sum(e['total'] for e in events_sorted)
    sliet_all = sum(e['sliet'] for e in events_sorted)
    outside_all = sum(e['outside'] for e in events_sorted)
    paid_all = sum(e['complete'] for e in events_sorted)
    incomp_all = sum(e['pending'] for e in events_sorted)
    amount_all = sum(e['amount'] for e in events_sorted)
    overall_rate = (paid_all / tot_all * 100) if tot_all > 0 else 0

    local_pdf = "./TechFEST26_All_Events_Completion_Report.pdf"

    # Margins: 20 pt left/right
    # Printable width: 595.27 - 40 = 555.27 pt
    doc = SimpleDocTemplate(
        local_pdf,
        pagesize=A4,
        rightMargin=20,
        leftMargin=20,
        topMargin=22,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15.5,
        leading=18.5,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=2
    )

    subhead_style = ParagraphStyle(
        'SubHead',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor('#0284C7')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=7
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#334155')
    )

    th_style = ParagraphStyle(
        'TH',
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )

    th_center = ParagraphStyle('THCenter', parent=th_style, alignment=1)
    th_right = ParagraphStyle('THRight', parent=th_style, alignment=2)
    th_rate = ParagraphStyle('THRate', parent=th_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#DC2626'), alignment=2)

    cell_style = ParagraphStyle(
        'Cell',
        fontName='Helvetica',
        fontSize=6.8,
        leading=8.3,
        textColor=colors.HexColor('#1E293B')
    )

    cell_bold = ParagraphStyle('CellBold', parent=cell_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#0F172A'))
    cell_id = ParagraphStyle('CellId', fontName='Courier', fontSize=6.5, leading=7.8, textColor=colors.HexColor('#64748B'))
    cell_num = ParagraphStyle('CellNum', parent=cell_style, alignment=2, fontName='Helvetica')
    cell_num_complete = ParagraphStyle('CellNumComp', parent=cell_style, alignment=2, fontName='Helvetica-Bold', textColor=colors.HexColor('#15803D'))
    cell_num_pending = ParagraphStyle('CellNumPend', parent=cell_style, alignment=2, fontName='Helvetica-Bold', textColor=colors.HexColor('#B45309'))
    cell_revenue = ParagraphStyle('CellRev', parent=cell_style, alignment=2, fontName='Helvetica-Bold', textColor=colors.HexColor('#0284C7'))

    # MANDATORY: Completion rate in Bold Red Font
    cell_rate_red_bold = ParagraphStyle(
        'CellRateRedBold',
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=8.6,
        textColor=colors.HexColor('#DC2626'),
        alignment=2
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("techFEST '26 — SLIET LONGOWAL", subhead_style))
    story.append(Spacer(1, 1))
    story.append(Paragraph("All 61 Competitions: Completion Rate, College & Payment Audit", title_style))
    story.append(Paragraph("Live Unstop Operations Data • 61 Public Events • College Origin (SLIET vs Outside) • Payment Received Till Now • October 2, 2026", subtitle_style))

    # 2. Executive 2-Row 8-Metric Command Grid
    metric_r1 = [
        Paragraph("<b>Total Competitions</b><br/><font size='11' color='#0F172A'><b>61 Events</b></font><br/><font size='6' color='#64748B'>13 Technical Domains</font>", body_style),
        Paragraph("<b>Total Registrations</b><br/><font size='11' color='#0F172A'><b>3,696</b></font><br/><font size='6' color='#64748B'>Unstop Verified Leads</font>", body_style),
        Paragraph("<b>SLIET Students</b><br/><font size='11' color='#0369A1'><b>1,370</b></font><br/><font size='6' color='#0369A1'>37.1% Internal College</font>", body_style),
        Paragraph("<b>Outside Colleges</b><br/><font size='11' color='#4338CA'><b>2,326</b></font><br/><font size='6' color='#4338CA'>62.9% External / Pan-India</font>", body_style),
    ]

    metric_r2 = [
        Paragraph("<b>Complete Registrations</b><br/><font size='11' color='#15803D'><b>710</b></font><br/><font size='6' color='#15803D'>Confirmed & Paid</font>", body_style),
        Paragraph("<b>Pending Participants</b><br/><font size='11' color='#B45309'><b>2,986</b></font><br/><font size='6' color='#B45309'>Fee Unpaid Drop-Offs</font>", body_style),
        Paragraph("<b>Payment Received</b><br/><font size='11' color='#0F766E'><b>Rs. 3,793</b></font><br/><font size='6' color='#0F766E'>Direct Gateway Receipts</font>", body_style),
        Paragraph("<b>Completion Rate</b><br/><font size='11' color='#DC2626'><b>19.21%</b></font><br/><font size='6' color='#DC2626'>Average across fest</font>", body_style),
    ]

    m_table = Table([metric_r1, metric_r2], colWidths=[138, 139, 139, 139])
    m_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (3,1), (3,1), colors.HexColor('#FEF2F2')),
        ('BACKGROUND', (2,1), (2,1), colors.HexColor('#F0FDFA')),
        ('BACKGROUND', (2,0), (2,0), colors.HexColor('#F0F9FF')),
        ('BACKGROUND', (3,0), (3,0), colors.HexColor('#EEF2FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(m_table)
    story.append(Spacer(1, 6))

    # Clean non-wrapping column headers
    table_headers = [
        Paragraph("#", th_center),
        Paragraph("Event ID", th_style),
        Paragraph("Competition Name", th_style),
        Paragraph("Domain", th_style),
        Paragraph("Total", th_right),
        Paragraph("SLIET", th_right),
        Paragraph("Outside", th_right),
        Paragraph("Complete", th_right),
        Paragraph("Pending", th_right),
        Paragraph("Payment", th_right),
        Paragraph("Rate (%)", th_rate),
    ]

    # Split into Part 1 (Events 1 to 30) for Page 1, and Part 2 (Events 31 to 61) for Page 2
    table_rows_p1 = []
    table_rows_p2 = []
    domain_totals = {}

    for idx, e in enumerate(events_sorted, 1):
        eid = e['id']
        title = e['title']
        dom = e['domain']
        tot = e['total']
        sliet = e['sliet']
        outside = e['outside']
        paid = e['complete']
        incomp = e['pending']
        amt = e['amount']
        rate = (paid / tot * 100) if tot > 0 else 0

        if dom not in domain_totals:
            domain_totals[dom] = {
                'events': 0, 'total': 0, 'sliet': 0, 'outside': 0, 
                'complete': 0, 'incomplete': 0, 'amount': 0.0
            }
        domain_totals[dom]['events'] += 1
        domain_totals[dom]['total'] += tot
        domain_totals[dom]['sliet'] += sliet
        domain_totals[dom]['outside'] += outside
        domain_totals[dom]['complete'] += paid
        domain_totals[dom]['incomplete'] += incomp
        domain_totals[dom]['amount'] += amt

        amt_str = f"Rs.{int(amt):,}" if amt > 0 else "Rs.0"

        row = [
            Paragraph(f"<b>{idx}</b>", ParagraphStyle('Idx', parent=cell_style, alignment=1, textColor=colors.HexColor('#64748B'))),
            Paragraph(eid, cell_id),
            Paragraph(f"<b>{title}</b>", cell_style),
            Paragraph(dom, ParagraphStyle('Dom', parent=cell_style, fontName='Helvetica-Oblique', textColor=colors.HexColor('#475569'))),
            Paragraph(str(tot), cell_num),
            Paragraph(str(sliet), cell_num),
            Paragraph(str(outside), cell_num),
            Paragraph(str(paid), cell_num_complete),
            Paragraph(str(incomp), cell_num_pending),
            Paragraph(amt_str, cell_revenue if amt > 0 else cell_num),
            Paragraph(f"<b>{rate:.1f}%</b>", cell_rate_red_bold),  # BOLD RED FONT
        ]

        if idx <= 30:
            table_rows_p1.append(row)
        else:
            table_rows_p2.append(row)

    # Grand Total Row for Part 2
    grand_amt_str = f"Rs.{int(amount_all):,}"
    total_row = [
        Paragraph("", cell_style),
        Paragraph("<b>TOTAL</b>", cell_bold),
        Paragraph("<b>All 61 Public Competitions Combined</b>", cell_bold),
        Paragraph("<b>13 Domains</b>", cell_bold),
        Paragraph(f"<b>{tot_all:,}</b>", cell_num),
        Paragraph(f"<b>{sliet_all:,}</b>", cell_num),
        Paragraph(f"<b>{outside_all:,}</b>", cell_num),
        Paragraph(f"<b>{paid_all:,}</b>", cell_num_complete),
        Paragraph(f"<b>{incomp_all:,}</b>", cell_num_pending),
        Paragraph(f"<b>{grand_amt_str}</b>", cell_revenue),
        Paragraph(f"<b>{overall_rate:.2f}%</b>", ParagraphStyle('GrandRate', parent=cell_rate_red_bold, fontSize=7.6, leading=9.2)),
    ]
    table_rows_p2.append(total_row)

    col_widths = [20, 44, 138, 66, 32, 34, 40, 44, 42, 44, 48]

    # Table 1 for Page 1
    t1 = Table([table_headers] + table_rows_p1, colWidths=col_widths)
    t1_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (10,0), (10,0), colors.HexColor('#FEE2E2')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
    ]
    for r in range(1, len(table_rows_p1) + 1):
        if r % 2 == 0:
            t1_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#F8FAFC')))
        t1_style.append(('BACKGROUND', (10, r), (10, r), colors.HexColor('#FFF1F2')))
        t1_style.append(('BACKGROUND', (8, r), (8, r), colors.HexColor('#FEFCE8')))
    t1.setStyle(TableStyle(t1_style))
    story.append(t1)

    # Force PageBreak to start Page 2 cleanly
    story.append(PageBreak())

    # Table 2 for Page 2
    story.append(Paragraph("<b>All 61 Competitions (Continued from #31 to #61 & Grand Total)</b>", ParagraphStyle('P2Title', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 4))
    t2 = Table([table_headers] + table_rows_p2, colWidths=col_widths)
    t2_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (10,0), (10,0), colors.HexColor('#FEE2E2')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
    ]
    for r in range(1, len(table_rows_p2) + 1):
        if r == len(table_rows_p2):
            t2_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#E2E8F0')))
            t2_style.append(('LINEABOVE', (0, r), (-1, r), 1.2, colors.HexColor('#0F172A')))
            t2_style.append(('BACKGROUND', (10, r), (10, r), colors.HexColor('#FEE2E2')))
            t2_style.append(('BACKGROUND', (9, r), (9, r), colors.HexColor('#CCFBF1')))
        else:
            if r % 2 == 0:
                t2_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#F8FAFC')))
            t2_style.append(('BACKGROUND', (10, r), (10, r), colors.HexColor('#FFF1F2')))
            t2_style.append(('BACKGROUND', (8, r), (8, r), colors.HexColor('#FEFCE8')))
    t2.setStyle(TableStyle(t2_style))
    story.append(t2)

    # Force PageBreak to start Page 3 cleanly
    story.append(PageBreak())

    # 4. Domain-Wise Aggregated Summary Table (All 13 Domains) on Page 3
    story.append(Paragraph("<b>Domain-Wise Performance, College Split & Revenue Rollup (13 Domains)</b>", ParagraphStyle('DomTitle', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 3))
    story.append(Paragraph("Aggregated student counts, SLIET internal vs outside college participation, and payments collected till now across all 13 technical bays.", subtitle_style))
    story.append(Spacer(1, 6))

    domain_headers = [
        Paragraph("#", th_center),
        Paragraph("Domain Name", th_style),
        Paragraph("Events", th_right),
        Paragraph("Total", th_right),
        Paragraph("SLIET", th_right),
        Paragraph("Outside", th_right),
        Paragraph("Complete", th_right),
        Paragraph("Pending", th_right),
        Paragraph("Payment Till Now", th_right),
        Paragraph("Domain Rate", th_rate),
    ]

    sorted_domains = sorted(domain_totals.items(), key=lambda x: x[1]['total'], reverse=True)
    domain_rows = []

    for d_idx, (d_name, d_stat) in enumerate(sorted_domains, 1):
        d_tot = d_stat['total']
        d_sliet = d_stat['sliet']
        d_outside = d_stat['outside']
        d_comp = d_stat['complete']
        d_pend = d_stat['incomplete']
        d_amt = d_stat['amount']
        d_rate = (d_comp / d_tot * 100) if d_tot > 0 else 0
        d_amt_str = f"Rs. {int(d_amt):,}" if d_amt > 0 else "Rs. 0"

        d_row = [
            Paragraph(f"<b>{d_idx}</b>", ParagraphStyle('DIdx', parent=cell_style, alignment=1, textColor=colors.HexColor('#64748B'))),
            Paragraph(f"<b>{d_name}</b>", cell_style),
            Paragraph(str(d_stat['events']), cell_num),
            Paragraph(f"{d_tot:,}", cell_num),
            Paragraph(f"{d_sliet:,}", cell_num),
            Paragraph(f"{d_outside:,}", cell_num),
            Paragraph(f"{d_comp:,}", cell_num_complete),
            Paragraph(f"{d_pend:,}", cell_num_pending),
            Paragraph(d_amt_str, cell_revenue if d_amt > 0 else cell_num),
            Paragraph(f"<b>{d_rate:.1f}%</b>", cell_rate_red_bold),
        ]
        domain_rows.append(d_row)

    # Domain Grand Total Row
    d_total_row = [
        Paragraph("", cell_style),
        Paragraph("<b>Total (13 Domains)</b>", cell_bold),
        Paragraph(f"<b>61 Events</b>", cell_num),
        Paragraph(f"<b>{tot_all:,}</b>", cell_num),
        Paragraph(f"<b>{sliet_all:,}</b>", cell_num),
        Paragraph(f"<b>{outside_all:,}</b>", cell_num),
        Paragraph(f"<b>{paid_all:,}</b>", cell_num_complete),
        Paragraph(f"<b>{incomp_all:,}</b>", cell_num_pending),
        Paragraph(f"<b>{grand_amt_str}</b>", cell_revenue),
        Paragraph(f"<b>{overall_rate:.2f}%</b>", ParagraphStyle('GrandDRate', parent=cell_rate_red_bold, fontSize=8, leading=10)),
    ]
    domain_rows.append(d_total_row)

    # 20 + 100 + 36 + 46 + 46 + 48 + 48 + 48 + 85 + 58 = 535 pt
    d_col_widths = [20, 100, 36, 46, 46, 48, 48, 48, 85, 58]
    domain_table = Table([domain_headers] + domain_rows, colWidths=d_col_widths)
    dt_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (9,0), (9,0), colors.HexColor('#FEE2E2')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]

    for dr_idx in range(1, len(domain_rows) + 1):
        if dr_idx == len(domain_rows):
            dt_style.append(('BACKGROUND', (0, dr_idx), (-1, dr_idx), colors.HexColor('#E2E8F0')))
            dt_style.append(('LINEABOVE', (0, dr_idx), (-1, dr_idx), 1.5, colors.HexColor('#0F172A')))
            dt_style.append(('BACKGROUND', (9, dr_idx), (9, dr_idx), colors.HexColor('#FEE2E2')))
            dt_style.append(('BACKGROUND', (8, dr_idx), (8, dr_idx), colors.HexColor('#CCFBF1')))
        else:
            if dr_idx % 2 == 0:
                dt_style.append(('BACKGROUND', (0, dr_idx), (-1, dr_idx), colors.HexColor('#F8FAFC')))
            dt_style.append(('BACKGROUND', (9, dr_idx), (9, dr_idx), colors.HexColor('#FFF1F2')))
            dt_style.append(('BACKGROUND', (7, dr_idx), (7, dr_idx), colors.HexColor('#FEFCE8')))

    domain_table.setStyle(TableStyle(dt_style))
    story.append(domain_table)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated successfully: {local_pdf}")

run()
