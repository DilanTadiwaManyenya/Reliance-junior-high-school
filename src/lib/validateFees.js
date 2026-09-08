import { supabase } from './supabase';
import { getFeeAmount, getFeeLevelLabel, isValidFeeAmount } from './FeeStructure';

const CLASS_LEVEL_FIELDS = ['class_level', 'classLevel', 'form_level', 'formLevel', 'grade'];
const FEE_AMOUNT_FIELDS = ['amount', 'fee_amount', 'feeAmount', 'expected_amount'];

const getFirstValue = (record, fields) =>
  fields.find((field) => record?.[field] !== undefined && record[field] !== null);

const requireSupabase = () => {
  if (!supabase?.from) throw new Error('Supabase client is not configured.');
};

const getStudentClassLevel = (student) => {
  const field = getFirstValue(student, CLASS_LEVEL_FIELDS);
  return field ? student[field] : null;
};

const getFeeAmountField = (feeBalance) => getFirstValue(feeBalance, FEE_AMOUNT_FIELDS);

const fetchStudent = async (studentId) => {
  if (!studentId) throw new Error('A studentId is required.');
  const { data, error } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  if (error) throw new Error(`Unable to fetch student ${studentId}: ${error.message}`);
  if (!data) throw new Error(`Student ${studentId} was not found.`);
  return data;
};

const fetchFeeBalance = async (studentId) => {
  const { data, error } = await supabase
    .from('fee_balances')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to fetch fee balance for student ${studentId}: ${error.message}`);
  return data;
};

const validationResult = (student, feeBalance) => {
  const classLevel = getStudentClassLevel(student);
  const expectedAmount = getFeeAmount(classLevel);
  const amountField = getFeeAmountField(feeBalance);
  const actualAmount = amountField ? feeBalance[amountField] : null;

  return {
    studentId: student.id,
    classLevel,
    feeLevelLabel: getFeeLevelLabel(classLevel),
    expectedAmount,
    actualAmount: actualAmount === null ? null : Number(actualAmount),
    valid: expectedAmount !== null && actualAmount !== null && isValidFeeAmount(classLevel, actualAmount),
    reason: expectedAmount === null
      ? 'Unknown class level'
      : actualAmount === null
        ? 'No fee balance found'
        : isValidFeeAmount(classLevel, actualAmount) ? null : 'Incorrect fee amount',
  };
};

/** Checks whether a student's saved fee balance matches their class-level fee. */
export const validateStudentFee = async (studentId) => {
  requireSupabase();
  const student = await fetchStudent(studentId);
  const feeBalance = await fetchFeeBalance(studentId);
  return validationResult(student, feeBalance);
};

/** Checks every student and returns both the individual results and summary totals. */
export const validateAllFees = async () => {
  requireSupabase();
  const [{ data: students, error: studentsError }, { data: feeBalances, error: balancesError }] = await Promise.all([
    supabase.from('students').select('*'),
    supabase.from('fee_balances').select('*'),
  ]);
  if (studentsError) throw new Error(`Unable to fetch students: ${studentsError.message}`);
  if (balancesError) throw new Error(`Unable to fetch fee balances: ${balancesError.message}`);

  const balancesByStudentId = new Map((feeBalances ?? []).map((balance) => [balance.student_id, balance]));
  const results = (students ?? []).map((student) => validationResult(student, balancesByStudentId.get(student.id)));
  return {
    results,
    total: results.length,
    valid: results.filter((result) => result.valid).length,
    invalid: results.filter((result) => !result.valid).length,
  };
};

/** Sets a student's saved fee amount to the prescribed amount for their class level. */
export const fixStudentFee = async (studentId) => {
  requireSupabase();
  const student = await fetchStudent(studentId);
  const classLevel = getStudentClassLevel(student);
  const expectedAmount = getFeeAmount(classLevel);
  if (expectedAmount === null) throw new Error(`Cannot fix fee: unknown class level "${classLevel ?? ''}".`);

  const existingBalance = await fetchFeeBalance(studentId);
  const amountField = getFeeAmountField(existingBalance) ?? 'amount';
  const payload = { [amountField]: expectedAmount };
  const query = existingBalance
    ? supabase.from('fee_balances').update(payload).eq('id', existingBalance.id)
    : supabase.from('fee_balances').insert({ student_id: studentId, ...payload });
  const { data, error } = await query.select().maybeSingle();
  if (error) throw new Error(`Unable to update fee for student ${studentId}: ${error.message}`);

  return { studentId, classLevel, feeLevelLabel: getFeeLevelLabel(classLevel), expectedAmount, feeBalance: data };
};
