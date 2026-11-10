// All monetary inputs use nominal CNY. Rates are annual percentages.
export const DEFAULTS = Object.freeze({ inflation: 0.66, withdrawal: 4, returns: 0, growth: 0 });
export const MAX_MONTHS = 1200;
export const FIELDS = ['income', 'expense', 'assets', 'inflation', 'withdrawal', 'returns', 'growth'];

export function validate(input) {
  if (['income', 'expense', 'assets'].some(key => input[key] === '' || input[key] == null)) return '请先填写月收入、月支出和当前资产。';
  if (FIELDS.some(key => input[key] === '' || input[key] == null)) return '请完整填写通胀率、提取比例、收益率和收入增长率。';
  if (FIELDS.some(key => !Number.isFinite(Number(input[key])))) return '请输入有效数字。';
  const p = Object.fromEntries(FIELDS.map(key => [key, Number(input[key])]));
  if (p.income < 0 || p.assets < 0 || p.expense <= 0) return '收入和资产不能为负数，月支出需要大于 0。';
  if (p.withdrawal <= 0 || p.withdrawal > 100) return '年提取比例应大于 0%，且不超过 100%。';
  if ([p.inflation, p.returns, p.growth].some(rate => rate <= -100 || rate > 100)) return '年通胀、收益及收入增长率应大于 -100%，且不超过 100%。';
  if ([p.income, p.expense, p.assets].some(value => value > 1e12)) return '金额请控制在 1 万亿元以内。';
  return null;
}

export function simulate(input, purchase = 0) {
  const error = validate(input);
  if (error) return { status: 'invalid', error, points: [] };
  const p = Object.fromEntries(FIELDS.map(key => [key, Number(input[key])]));
  if (!Number.isFinite(purchase) || purchase < 0) return { status: 'invalid', error: '商品价格不能为负数。', points: [] };
  if (purchase > p.assets) return { status: 'unaffordable', error: '这笔价格超过当前可用资产，暂不模拟借款购买。', points: [] };
  const inflationFactor = (1 + p.inflation / 100) ** (1 / 12);
  const incomeFactor = (1 + p.growth / 100) ** (1 / 12);
  const returnFactor = (1 + p.returns / 100) ** (1 / 12);
  let assets = p.assets - purchase;
  const initialTarget = p.expense * 12 / (p.withdrawal / 100);
  const points = [{ month: 0, assets, target: initialTarget, expense: p.expense, income: p.income }];
  if (assets >= initialTarget) return { status: 'achieved', months: 0, points, target: initialTarget, initialTarget };
  for (let month = 1; month <= MAX_MONTHS; month++) {
    // First month's cash flow uses today's amounts; indexation starts next month.
    const expense = p.expense * inflationFactor ** (month - 1);
    const income = p.income * incomeFactor ** (month - 1);
    assets = assets * returnFactor + income - expense;
    const target = initialTarget * inflationFactor ** month;
    const next = { month, assets: Math.max(0, assets), target, expense: expense * inflationFactor, income: income * incomeFactor };
    const previous = points[points.length - 1];
    if (assets >= target) {
      const prevGap = previous.assets - previous.target;
      const nextGap = assets - target;
      const fraction = Math.max(0, Math.min(1, -prevGap / (nextGap - prevGap)));
      const months = month - 1 + fraction;
      const crossing = { ...next, month: months, assets: previous.assets + (assets - previous.assets) * fraction, target: previous.target + (target - previous.target) * fraction };
      points.push(crossing);
      return { status: 'reached', months, points, target: crossing.target, initialTarget };
    }
    points.push(next);
    if (assets < 0) return { status: 'depleted', months: null, depletedAt: month, points, initialTarget };
    if (!Number.isFinite(assets) || !Number.isFinite(target) || !Number.isFinite(income)) return { status: 'limit', months: null, points: points.slice(0, -1), initialTarget };
  }
  return { status: 'horizon', months: null, points, initialTarget };
}

export function compare(input, price) {
  const baseline = simulate(input);
  const after = simulate(input, Number(price));
  const delay = Number.isFinite(baseline.months) && Number.isFinite(after.months) ? Math.max(0, after.months - baseline.months) : null;
  return { baseline, after, delay };
}
