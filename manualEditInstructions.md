# Manual editing fallback

Use VS Code while the sandbox issue is repaired:

1. Open `D:\reliance-high-school\reliance`.
2. Open `src/components/portal/FeesDashboard.jsx`.
3. For campus tabs, table badges, CSV export, and filtered rows, use the persisted field `student.campus`:

```js
const visibleStudents = students.filter(student =>
  campus === 'all' || student.campus === campus
)
```

4. Do not infer campus from `class_level`; Form 1 is now senior.
5. Use the existing `total_fees` and `amount_paid` fields. The current database does not use `amount_due` or `balance_due`.
6. Save, then run `npm run build` in the project terminal.

## Optional PowerShell check

```powershell
Set-Location D:\reliance-high-school\reliance
npm run build
```

Do not use `git reset --hard` or overwrite the repository from another folder. The user’s existing changes should be retained.
