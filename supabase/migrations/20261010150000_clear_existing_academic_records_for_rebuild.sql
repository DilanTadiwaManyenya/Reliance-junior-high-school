-- User-authorized reset for the new subject-teacher reporting workflow.
-- This removes only previously saved subject academic records (marks, grades,
-- exam marks and teacher comments). Learners, classes, allocations, attendance,
-- coursework, fees and staff accounts are intentionally preserved.

delete from public.academic_records;
