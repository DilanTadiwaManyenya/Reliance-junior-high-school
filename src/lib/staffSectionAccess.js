export const staffSectionAccess = {
  admin: { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'learner-edit', 'entry', 'settings', 'bulk-import', 'report-settings', 'grade-bands', 'progress-reports', 'fees', 'expenses', 'inventory', 'staff', 'parent-accounts', 'newsletters', 'library-support', 'classes', 'year-planning', 'year-rollover', 'reporting-periods', 'historical-reports', 'activity'] },
  principal: { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'settings', 'fees', 'expenses', 'staff', 'historical-reports', 'activity'] },
  teacher: { defaultSection: 'dashboard', allowed: ['dashboard', 'subject-allocations', 'roster', 'entry', 'coursework', 'library', 'settings'] },
  accountant: { defaultSection: 'fees', allowed: ['fees', 'learner-profiles', 'expenses', 'inventory', 'progress-reports', 'historical-reports', 'library-support', 'parent-accounts'] },
}
