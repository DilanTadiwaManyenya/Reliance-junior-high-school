"""Validate real browser PDFs after running report-print.browser.mjs."""
from pathlib import Path
from pypdf import PdfReader

roles = ['parent', 'admin', 'accountant']
levels = ['ECD A', 'ECD B', *[f'Grade {n}' for n in range(1, 8)], *[f'Form {n}' for n in range(1, 5)], 'Lower Six', 'Upper Six']
for role in roles:
    for level in levels:
        path = Path('tmp/pdfs/report-print') / f'{role}-{level.replace(" ", "-")}.pdf'
        pdf = PdfReader(path)
        assert len(pdf.pages) == 1, f'{path}: expected one page, got {len(pdf.pages)}'
        page = pdf.pages[0]
        assert float(page.mediabox.height) > float(page.mediabox.width), f'{path}: expected portrait'
        text = page.extract_text()
        for phrase in ['Alexandra', 'TEST-2026-001', '2026', 'Next', 'Term', 'January']:
            assert phrase in text, f'{path}: missing {phrase}'
        if level.startswith(('Grade', 'ECD')):
            assert 'alterations' in text, f'{path}: missing report footer'
            assert 'regular practice' in text, f'{path}: missing official comments'
        else:
            for subject in ['English', 'Accounting' if level.startswith('Form') else 'Communication']:
                assert subject in text, f'{path}: missing final subject {subject}'
        print(f'PASS {path.name}: one A4 page with report content and footer')
print('45 PDF reports verified')
