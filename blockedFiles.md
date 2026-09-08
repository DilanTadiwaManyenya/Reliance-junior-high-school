# Workspace edit-probe results

## Result

This is not a React-component or portal-folder restriction. The workspace patch service fails before it reads *any existing file*.

| File probed | Category | Result |
|---|---|---|
| `src/components/portal/FeesDashboard.jsx` | Existing portal React component | Update rejected |
| `src/components/portal/TeacherGradeEntry.jsx` | Existing portal React component | Update rejected |
| `src/pages/portal/StaffDashboard.jsx` | Existing portal React page | Update rejected |
| `src/lib/utils.js` | Existing JavaScript utility | Update rejected |
| `src/lib/campusUtils.js` | Newly created JavaScript utility | Update rejected |
| `fixFeesDashboardCampusFilter.patch` | Newly created patch file | Delete rejected |

Every rejected operation returned the same infrastructure error before patch verification:

```text
windows sandbox failed: helper_unknown_error: setup refresh had errors
```

No probed file has a `ReadOnly` attribute. File metadata reports ordinary `Archive` attributes.

## Portal React inventory

`src/components/portal/` includes `FeesDashboard.jsx`, `TeacherGradeEntry.jsx`, `FeeManager.jsx`, `LearnerRecords.jsx`, `PortalSidebar.jsx`, `StaffPortalLayout.jsx`, and supporting portal components. `src/pages/portal/` includes `StaffDashboard.jsx`, `StudentDashboard.jsx`, `RoleDashboard.jsx`, and portal auth pages. Treat all existing workspace files as blocked until the sandbox refresh issue is fixed.
