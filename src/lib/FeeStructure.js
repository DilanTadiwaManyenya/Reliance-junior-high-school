/**
 * The authoritative term-fee schedule for Reliance Portal.
 * Amounts are stored as numbers (not formatted currency strings) so they can
 * safely be compared with values returned from the database.
 */
const FEE_LEVELS = Object.freeze([
  {
    key: 'ecd-a-b',
    aliases: ['ecd a', 'ecd b', 'ecd a-b', 'ecd a b', 'ecd-a', 'ecd-b'],
    amount: 120,
    category: 'junior',
    label: 'Junior ECD A-B',
  },
  {
    key: 'grade-1-7',
    aliases: ['grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7', 'grade 1-7'],
    amount: 120,
    category: 'junior',
    label: 'Junior Grade 1-7',
  },
  {
    key: 'form-1-2',
    aliases: ['form 1', 'form 2', 'form 1-2'],
    amount: 170,
    category: 'senior',
    label: 'Senior Form 1-2',
  },
  {
    key: 'form-3-4',
    aliases: ['form 3', 'form 4', 'form 3-4'],
    amount: 180,
    category: 'senior',
    label: 'Senior Form 3-4',
  },
  {
    key: 'form-5-6',
    aliases: ['form 5', 'form 6', 'form 5-6'],
    amount: 210,
    category: 'senior',
    label: 'Senior Form 5-6',
  },
]);

const normalise = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_–—-]+/g, ' ')
  .replace(/\s+/g, ' ');

const findFeeLevel = (classLevel) => {
  const level = normalise(classLevel);
  return FEE_LEVELS.find((feeLevel) =>
    feeLevel.aliases.some((alias) => normalise(alias) === level)
  );
};

/** Returns the prescribed fee for a class level, or null when it is unknown. */
export const getFeeAmount = (classLevel) => findFeeLevel(classLevel)?.amount ?? null;

/** Returns true only when an amount is the prescribed fee for the class level. */
export const isValidFeeAmount = (classLevel, amount) => {
  const expectedAmount = getFeeAmount(classLevel);
  const numericAmount = Number(amount);
  return expectedAmount !== null && Number.isFinite(numericAmount) && numericAmount === expectedAmount;
};

/** Returns a copy of the schedule, grouped by school category. */
export const getFeesByCategory = () => FEE_LEVELS.reduce((categories, feeLevel) => {
  const { aliases, ...fee } = feeLevel;
  categories[fee.category].push({ ...fee });
  return categories;
}, { junior: [], senior: [] });

/** Returns the display label for a class level, or null when it is unknown. */
export const getFeeLevelLabel = (classLevel) => findFeeLevel(classLevel)?.label ?? null;

export default FEE_LEVELS;
