# Academic report printing

Report buttons and Ctrl+P use the same beforeprint/afterprint isolation hook. Only the mounted, authorised report is printed; cancelling printing restores the portal. Bulk exports retain their own page layout.

Reports use portrait A4 with 6mm margins. The full rendered report is measured at a physical page width and reduced only when needed to fit one page. Comments, subject rows, stamps and reopening information remain in the document. Screen breakpoints do not determine the printed table width.

## Regression checks

1. Set PLAYWRIGHT_MODULE and optionally PLAYWRIGHT_CHANNEL for the local browser installation.
2. Run `npm run test:report-print`. This exports 45 actual PDFs under `tmp/pdfs/report-print`: parent, admin and accountant copies for ECD A/B, Grades 1–7, Forms 1–4 and Lower/Upper Six. Fixtures include all component marks, long comments and all Senior subjects.
3. Run `python tests/report-print.verify.py` with pypdf installed. It checks one portrait page, learner identity, final subjects, official comments and footer text.
4. Render representative PDFs with pdftoppm and inspect the images for legibility, clipping and overlap.

The browser fixtures use local mocked records and do not write to the school database.
