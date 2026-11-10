import { DEFAULTS, FIELDS, MAX_MONTHS, validate, simulate, compare } from './model.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'freedom-project-v1';
const DEMO = { income: 20000, expense: 8000, assets: 300000, ...DEFAULTS, price: 12000 };
const rateNames = { inflation: '年通胀率', withdrawal: '年提取比例', returns: '年投资收益率', growth: '年收入增长率' };
const baseTags = { inflation: '历史数据计算值', withdrawal: '研究参考', returns: '基础情景 · 不计收益', growth: '基础情景 · 收入不变' };
let isDemo = false;
let view = 'real';
let chartData = null;
let baseline = null;
let after = null;
let toastTimer;

const cny = value => '¥ ' + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
const percent = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value) + '%';
const attr = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const input = () => Object.fromEntries(FIELDS.map(key => [key, $(key).value]));
const filled = () => ['income', 'expense', 'assets'].every(key => $(key).value !== '');
const scalar = value => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 });

function timeLabel(months) {
  if (months === 0) return '已达标';
  if (months < 1) return '不足 1 个月';
  const whole = Math.ceil(months - 1e-8);
  return (whole >= 12 ? Math.floor(whole / 12) + ' 年 ' : '') + (whole % 12 ? whole % 12 + ' 个月' : '');
}

function dateLabel(months) {
  const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const year = Number(dateParts.find(p => p.type === 'year').value);
  const month = Number(dateParts.find(p => p.type === 'month').value) - 1;
  const offset = Math.ceil(months - 1e-8);
  return `${year + Math.floor((month + offset) / 12)} 年 ${(month + offset) % 12 + 1} 月`;
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ values: { ...input(), price: $('price').value }, isDemo, view }));
    $('save-status').textContent = '已自动保存在此浏览器';
  } catch { $('save-status').textContent = '本次可用 · 浏览器未允许保存'; }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.values === 'object') {
      for (const key of [...FIELDS, 'price']) {
        const value = saved.values[key];
        if (typeof value === 'number' || typeof value === 'string') $(key).value = value;
      }
      isDemo = saved.isDemo === true;
      view = saved.view === 'nominal' ? 'nominal' : 'real';
    }
  } catch { /* Keep the empty state if storage is unavailable or corrupt. */ }
}

function updateMode() {
  $('mode-notice').classList.toggle('is-demo', isDemo);
  $('mode-notice').textContent = isDemo ? '演示模式 · 金额为虚构数据，可直接修改体验。' : '填写你的真实情况，计算会随输入更新。';
  $('demo-button').innerHTML = isDemo ? '填写我的数据 ↗' : '<svg><use href="#i-spark"/></svg>体验示例';
  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    $(key + '-tag').textContent = $(key).value !== '' && Number($(key).value) === defaultValue ? baseTags[key] : '自定义 · 点击 ⓘ 查看参考来源';
  }
  $('view-real').classList.toggle('selected', view === 'real');
  $('view-real').setAttribute('aria-pressed', String(view === 'real'));
  $('view-nominal').classList.toggle('selected', view === 'nominal');
  $('view-nominal').setAttribute('aria-pressed', String(view === 'nominal'));
  $('chart-unit').textContent = view === 'real' ? '单位：万元 · 已扣通胀' : '单位：万元 · 未来金额';
}

function renderHero(p, error) {
  const income = Number(p.income), expense = Number(p.expense), assets = Number(p.assets);
  $('monthly-surplus').textContent = p.income !== '' && p.expense !== '' ? cny(income - expense) : '—';
  $('monthly-surplus').style.color = income - expense < 0 ? '#ad794d' : '';
  $('target-value').textContent = '¥ —';
  $('gap-value').textContent = '¥ —';
  $('saving-rate').textContent = '— %';
  let progress = 0;
  if (error) {
    $('countdown').innerHTML = '<strong>—</strong><span>年</span><strong>—</strong><span>个月</span>';
    $('result-description').textContent = filled() ? error : '从左侧填写三个数字，看看未来的可能。';
  } else {
    const target = baseline.initialTarget;
    progress = Math.max(0, Math.min(100, assets / target * 100));
    $('target-value').textContent = cny(target);
    $('gap-value').textContent = cny(Math.max(0, target - assets));
    $('saving-rate').textContent = income > 0 ? percent((income - expense) / income * 100) : '—';
    if (Number.isFinite(baseline.months)) {
      if (baseline.months === 0) {
        $('countdown').innerHTML = '<strong class="status-word">你已到达这一站。</strong>';
        $('result-description').textContent = '按当前假设，资产已覆盖设定目标。继续看看一次消费的影响。';
      } else {
        const whole = Math.ceil(baseline.months - 1e-8);
        $('countdown').innerHTML = `<strong>${Math.floor(whole / 12)}</strong><span>年</span><strong>${whole % 12}</strong><span>个月</span>`;
        $('result-description').textContent = `预计约 ${dateLabel(baseline.months)} 达标 · 届时目标约 ${cny(baseline.target)}`;
      }
    } else {
      $('countdown').innerHTML = '<strong class="status-word">一起调整一下计划。</strong>';
      $('result-description').textContent = baseline.status === 'depleted' ? `当前假设下，约第 ${baseline.depletedAt} 个月资金不足以覆盖支出。可调整收入、开销或收益假设。` : '当前假设下，100 年模拟期内未达到目标。试着调整收支或其他参数。';
    }
  }
  $('progress-percent').innerHTML = `${scalar(progress)}<span>%</span>`;
  $('progress-ring').setAttribute('stroke-dashoffset', String(515.22 * (1 - progress / 100)));
  $('progress-ring').closest('svg').setAttribute('aria-label', `按今天购买力计算，已完成目标的 ${scalar(progress)}%`);
}

function renderPurchase(p, error) {
  const target = $('purchase-result');
  target.className = 'purchase-result';
  after = null;
  if (error) {
    target.innerHTML = '<span class="purchase-result-label">给选择，多一个视角</span><strong>先完成上方的自由规划</strong><p>这里会告诉你，购买前后的达标时间有何不同。</p>';
    return;
  }
  if ($('price').value === '') {
    target.innerHTML = '<span class="purchase-result-label">你的选择，值得被认真看见</span><strong>输入价格，看看对计划的影响</strong><p>原计划与购买后的曲线，将在上方一起显示。</p>';
    return;
  }
  const price = Number($('price').value);
  if (price > 1e12) {
    target.classList.add('is-error');
    target.innerHTML = '<span class="purchase-result-label">检查一下价格</span><strong>商品金额请控制在 1 万亿元以内。</strong><p>当前版本只模拟可用资产内的一次性购买。</p>';
    return;
  }
  const result = compare(p, price);
  if (['invalid', 'unaffordable'].includes(result.after.status)) {
    target.classList.add('is-error');
    target.innerHTML = `<span class="purchase-result-label">检查一下价格</span><strong>${attr(result.after.error)}</strong><p>当前版本只模拟可用资产内的一次性购买。</p>`;
    return;
  }
  after = result.after;
  target.classList.add('has-result');
  if (result.delay != null) {
    let delayHTML;
    if (result.delay === 0) delayHTML = baseline.months === 0 ? '购买后，你仍然达到设定目标。' : '这笔消费不会改变当前估算。';
    else if (result.delay < 0.05) delayHTML = '预计推迟 <span class="delay-number">不足 0.1</span> 个月';
    else if (result.delay < 12) delayHTML = `预计推迟 <span class="delay-number">${scalar(result.delay)}</span> 个月`;
    else {
      const rounded = Math.round(result.delay * 10) / 10;
      delayHTML = `预计推迟 <span class="delay-number">${Math.floor(rounded / 12)}</span> 年 <span class="delay-number">${scalar(rounded % 12)}</span> 个月`;
    }
    target.innerHTML = `<span class="purchase-result-label">这笔 ${cny(price)} 的消费，对计划的影响</span><strong>${delayHTML}</strong><p>购买前 <strong>${timeLabel(baseline.months)}</strong> <span aria-hidden="true">→</span> 购买后 <strong>${timeLabel(after.months)}</strong></p>`;
  } else if (Number.isFinite(baseline.months)) {
    target.innerHTML = '<span class="purchase-result-label">购买后的计划需要调整</span><strong>购买后，模拟期内未达标</strong><p>原计划约 ' + timeLabel(baseline.months) + ' 达标；购买后无法给出有限的延迟时间。</p>';
  } else {
    target.innerHTML = '<span class="purchase-result-label">暂时无法估算延迟</span><strong>先让原计划拥有一个可达的目标</strong><p>当前模拟期内原计划未达标，可先调整收支或其他参数。</p>';
  }
}

function niceTop(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude * 2) / 2 * magnitude;
}

function makeChart(p, error) {
  const svg = $('wealth-chart');
  $('chart-empty').hidden = !error;
  $('purchase-legend').hidden = !after;
  chartData = null;
  if (error) {
    svg.innerHTML = [0, 1, 2, 3].map(i => `<line class="chart-grid" x1="45" y1="${28 + i * 50}" x2="760" y2="${28 + i * 50}"/>`).join('');
    svg.setAttribute('aria-label', '填写数据后生成资产与目标曲线');
    $('chart-description').textContent = '曲线按月模拟，达标时间为估算值。';
    return;
  }
  const width = 780, height = 245, left = 49, right = 20, top = 19, bottom = 31;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const lastBase = baseline.points.at(-1).month;
  const lastAfter = after ? after.points.at(-1).month : 0;
  const maxMonth = Math.max(12, Math.ceil(Math.max(lastBase, lastAfter) / 12) * 12);
  const factor = month => view === 'real' ? (1 + Number(p.inflation) / 100) ** (month / 12) : 1;
  const series = baseline.points.map(point => ({ month: point.month, value: point.assets / factor(point.month) }));
  const secondSeries = after ? after.points.map(point => ({ month: point.month, value: point.assets / factor(point.month) })) : [];
  const targets = Array.from({ length: 61 }, (_, index) => {
    const month = maxMonth * index / 60;
    return { month, value: baseline.initialTarget * (1 + Number(p.inflation) / 100) ** (month / 12) / factor(month) };
  });
  const maxValue = niceTop(Math.max(...series.map(v => v.value), ...secondSeries.map(v => v.value), ...targets.map(v => v.value)) * 1.1);
  const x = month => left + month / maxMonth * plotWidth;
  const y = value => top + plotHeight * (1 - value / maxValue);
  const path = points => points.map((point, i) => `${i ? 'L' : 'M'}${x(point.month).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
  // Sample the visual path only; all monthly points remain available for hover.
  const sample = points => points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 160)) === 0);
  let markup = '<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8caa68" stop-opacity=".16"/><stop offset="100%" stop-color="#8caa68" stop-opacity=".015"/></linearGradient></defs>';
  for (let i = 0; i <= 4; i++) {
    const value = maxValue * i / 4;
    const label = value / 10000;
    markup += `<line class="chart-grid" x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"/><text class="chart-axis-label" text-anchor="end" x="${left - 12}" y="${y(value) + 4}">${label >= 1e7 ? label.toExponential(0) : scalar(label)}</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const month = maxMonth * i / 4;
    markup += `<text class="chart-axis-label" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" x="${x(month)}" y="${height - 6}">${i === 0 ? '现在' : scalar(month / 12) + ' 年后'}</text>`;
  }
  const basePath = path(sample(series));
  markup += `<path d="${basePath} L${x(series.at(-1).month)},${y(0)} L${left},${y(0)} Z" fill="url(#chart-fill)"/>`;
  markup += `<path class="chart-target" d="${path(targets)}"/><path class="chart-line" d="${basePath}"/>`;
  if (secondSeries.length) markup += `<path class="chart-line chart-after" d="${path(sample(secondSeries))}"/>`;
  if (Number.isFinite(baseline.months)) markup += `<circle class="chart-endpoint" cx="${x(series.at(-1).month)}" cy="${y(series.at(-1).value)}" r="4.5"/>`;
  if (after && Number.isFinite(after.months)) markup += `<circle class="chart-endpoint" style="fill:#c68d52" cx="${x(secondSeries.at(-1).month)}" cy="${y(secondSeries.at(-1).value)}" r="4.5"/>`;
  svg.innerHTML = markup;
  svg.setAttribute('aria-label', `资产积累预测，${view === 'real' ? '以今天购买力显示' : '以未来金额显示'}。原计划${Number.isFinite(baseline.months) ? '约 ' + timeLabel(baseline.months) + ' 达标' : '在模拟范围内未达标'}${after ? '；购买后' + (Number.isFinite(after.months) ? '约 ' + timeLabel(after.months) + ' 达标' : '在模拟范围内未达标') : ''}。`);
  $('chart-description').textContent = baseline.months === 0 && (!after || after.months === 0) ? '当前已达标。虚线表示接下来一年的目标参考。' : `按月推演 · 首次达标后曲线停止 · 金额${view === 'real' ? '已折算为今天购买力' : '随物价变化'}`;
  chartData = { series, secondSeries, targets, maxMonth, factor, x, y, maxValue };
}

function update(save = true) {
  const p = input();
  const error = validate(p);
  baseline = error ? null : simulate(p);
  updateMode();
  renderHero(p, error);
  renderPurchase(p, error);
  makeChart(p, error);
  $('chart-tooltip').hidden = true;
  if (save) persist();
}

const cpiRows = [
  ['2021', '0.9%', '2022-01-12', 'https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202201/t20220112_1826190.html'],
  ['2022', '2.0%', '2023-02-28', 'https://www.stats.gov.cn/sj/zxfb/202302/t20230228_1919011.html'],
  ['2023', '0.2%', '2024-01-12', 'https://www.stats.gov.cn/sj/zxfb/202401/t20240112_1946465.html'],
  ['2024', '0.2%', '2025-02-28', 'https://www.stats.gov.cn/sj/zxfb/202502/t20250228_1958817.html'],
  ['2025', '0.0%', '2026-02-28', 'https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html']
];
const researchURL = 'https://investor.vanguard.com/investor-resources-education/retirement/early-retirement';
const sources = {
  inflation: () => ({ title: '年通胀率 · 数字的来处', html: `<span class="source-badge">官方历史数据计算值</span><p>默认 <strong>0.66%</strong>，根据国家统计局发布的 2021—2025 年全国居民消费价格（CPI）全年涨幅，取算术平均值。</p><table><thead><tr><th>数据年度</th><th>全年 CPI 涨幅</th><th>原文发布日期</th></tr></thead><tbody>${cpiRows.map(([year, rate, date, url]) => `<tr><td><a href="${url}" target="_blank" rel="noopener noreferrer">${year} 年 ↗</a></td><td>${rate}</td><td>${date}</td></tr>`).join('')}</tbody></table><div class="formula">(0.9% + 2.0% + 0.2% + 0.2% + 0.0%) ÷ 5 = 0.66%</div><p>选取最近五个完整年度作为参考窗口，是本产品的计算约定。这里使用全年涨幅，未混用某个月的同比或环比。</p><p class="source-caution">历史均值并非未来通胀预测。全国 CPI 与个人的住房、医疗、教育等成本变化可能不同。你可以用更符合自己生活的通胀假设替换。</p><p>本次使用：<strong>${attr($('inflation').value || '未填写')}%</strong>${Number($('inflation').value) === DEFAULTS.inflation ? '（参考默认值）' : '（用户自定义）'}。</p>` }),
  withdrawal: () => ({ title: '年提取比例 · 理解 4% 规则', html: `<span class="source-badge">研究参考 · 非保证收益</span><p>默认 <strong>4%</strong>。提取比例用于把年度生活支出换算为所需资产，并不是银行利息，也不是投资收益率。</p><div class="formula">目标资产 = 当时年度生活支出 ÷ 年提取比例<br>若设为 4%，对应约 25 倍年支出。</div><h3>参考资料</h3><p><a href="${researchURL}" target="_blank" rel="noopener noreferrer">Vanguard：Early retirement and the 4% rule ↗</a><br>原文发布日期：2025-11-21。</p><p>其介绍的规则是退休第一年提取初始资产的 4%，以后按通胀调整提取金额；相关研究有约 30 年退休期、投资组合及美国市场等背景条件。</p><p class="source-caution">更长的退休期、投资波动、税费及个人支出都可能改变可持续性。本网站只估算达到资产门槛的时间，未验证退休后的终身资金充足性。可修改提取比例进行对比。</p><p>本次使用：<strong>${attr($('withdrawal').value || '未填写')}%</strong>。</p>` }),
  returns: () => ({ title: '年投资收益率 · 默认 0% 的含义', html: '<span class="source-badge">产品基础情景</span><p>默认 <strong>0%</strong>，表示积累期不计投资收益。这是便于理解的基础假设，无对应的市场预测或官方收益数据。</p><p>你输入的应是<strong>扣除税费后、尚未扣除通胀的年名义收益率</strong>。模型将年有效收益率换算为月收益率，按月复利，月末计入当月结余。</p><div class="formula">月收益率 = (1 + 年收益率)^(1/12) − 1</div><p class="source-caution">使用固定收益率无法反映真实市场波动、回撤及收益顺序风险。此处的预设不代表收益承诺。</p>' }),
  growth: () => ({ title: '收入增长 · 明确你的假设', html: '<span class="source-badge">产品基础情景</span><p>默认 <strong>0%</strong>，表示每月收入的名义金额保持不变。这是本产品的基础假设，没有对应的官方工资增长预测。</p><p>支出仍随通胀增长，因此在收入不变时，每月结余可能逐渐减少。你可以自行填写预计的年名义收入增长率。</p><p>若设为与通胀相同，代表收入大致维持购买力；若设得更高，代表假设实际收入增长。</p><p class="source-caution">模型不包含失业、收入中断、奖金变化等事件，也不假设每个人都会按全国收入增速涨薪。</p>' }),
  personal: () => ({ title: '你的输入 · 你自己的起点', html: '<span class="source-badge">个人输入 / 虚构演示</span><p>首次使用时，月收入、月支出和当前可投资资产均留空，由你填写。网站不连接银行或个人账户。</p><ul><li><strong>税后月收入：</strong>每月实际可支配的收入。</li><li><strong>平均月支出：</strong>生活费及平摊后的年度支出，需大于零。</li><li><strong>可投资资产：</strong>可用于这份计划的存款及投资，排除自住房、锁定或无法动用的资金。应先留出应急资金及需偿还的债务。</li></ul><p>“体验示例”使用的月收入 20,000 元、月支出 8,000 元、当前资产 300,000 元，均为<strong>产品编制的虚构金额</strong>，不代表社会平均水平或你的真实状况。</p><p>数据只保存在当前网站的浏览器本地存储中，不会由计算器上传。清除浏览器网站数据也会移除记录。</p>' }),
  purchase: () => ({ title: '消费模拟 · 一次性购买的影响', html: '<span class="source-badge">个人输入 / 对比情景</span><p>价格默认留空。“体验示例”中的 <strong>12,000 元</strong>为产品编制的虚构商品价格。</p><p>假设你现在从可投资资产中一次性付款，然后沿用原来的收入、支出、收益、通胀和提取比例，重新计算第一次达到目标的时间。</p><div class="formula">购买后的初始资产 = 当前资产 − 商品价格<br>预计延迟 = 购买后达标时间 − 原计划达标时间</div><p>若价格超过当前资产，会提示余额不足；不会自动加入借款。如果原计划或购买后在模拟期限内未达标，不展示虚假的延迟数值。</p><p class="source-caution">仅适用于日常月支出之外的额外消费。暂不包含分期、订阅、转售价值、后续维护费用或商品带来的收入。亚月差异为线性插值估算。</p>' }),
  assumptions: () => ({ title: '所有默认值 · 完整说明', html: `<span class="source-badge">默认值清单</span><table><thead><tr><th>设置</th><th>默认值</th><th>来源 / 理由</th></tr></thead><tbody><tr><td>收入 / 支出 / 资产 / 价格</td><td>留空</td><td>由用户提供</td></tr><tr><td>年通胀率</td><td>0.66%</td><td>国家统计局 2021—2025 CPI 均值</td></tr><tr><td>年提取比例</td><td>4%</td><td>Vanguard 介绍的经验规则</td></tr><tr><td>年投资收益率</td><td>0%</td><td>产品假设：不计收益</td></tr><tr><td>年收入增长率</td><td>0%</td><td>产品假设：名义收入不变</td></tr><tr><td>自由后生活水平</td><td>沿用当前</td><td>由用户月支出推导，随通胀调整</td></tr><tr><td>模拟上限</td><td>100 年</td><td>产品计算边界，非寿命假设</td></tr><tr><td>图表显示口径</td><td>今天购买力</td><td>产品展示选择，可切换</td></tr><tr><td>金额单位</td><td>人民币元</td><td>当前产品服务场景</td></tr></tbody></table><h3>一键体验数据</h3><p>月收入 20,000 元、月支出 8,000 元、资产 300,000 元、商品价格 12,000 元均为产品编制的虚构数据；其余计算设置采用上表默认值。演示模式修改后仍保留演示标记，点击“填写我的数据”可清空重填。</p><h3>资料入口</h3><p>${cpiRows.map(([year, , , url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${year} 年 CPI</a>`).join(' · ')}<br><a href="${researchURL}" target="_blank" rel="noopener noreferrer">Vanguard：4% 规则及局限 ↗</a></p>` }),
  method: () => {
    const p = input();
    const err = validate(p);
    return { title: '本次计算依据', html: `<span class="source-badge">逐月模拟 · 可复核</span><h3>当前采用的参数</h3><table><tbody><tr><td>税后月收入</td><td>${p.income === '' ? '未填写' : cny(Number(p.income))}</td></tr><tr><td>平均月支出</td><td>${p.expense === '' ? '未填写' : cny(Number(p.expense))}</td></tr><tr><td>当前资产</td><td>${p.assets === '' ? '未填写' : cny(Number(p.assets))}</td></tr>${Object.entries(rateNames).map(([key, label]) => `<tr><td>${label}</td><td>${p[key] === '' ? '未填写' : percent(Number(p[key]))}${Number(p[key]) !== DEFAULTS[key] ? ' · 自定义' : ' · 默认值'}</td></tr>`).join('')}<tr><td>当前商品价格</td><td>${$('price').value === '' ? '未填写' : cny(Number($('price').value))}</td></tr><tr><td>输入性质</td><td>${isDemo ? '虚构演示金额' : '用户填写'}</td></tr></tbody></table><h3>计算顺序</h3><p>年有效增长率换算为月增长率。第一月使用今天的收入与支出，后续逐月增长；先计算资产收益，再在月末计入当月结余。</p><div class="formula">月增长因子 = (1 + 年增长率)^(1/12)<br>第 m 月支出 = 当前月支出 × 通胀因子^(m−1)<br>第 m 月收入 = 当前月收入 × 收入增长因子^(m−1)<br>月末资产 = 上月末资产 × 收益因子 + 当月收入 − 当月支出<br>月末目标 = 当前月支出 × 通胀因子^m × 12 ÷ 提取比例</div><p>首次出现资产不低于同期目标时，认为达到目标。月内用相邻两点的资产与目标差额进行线性插值，属于近似值；主倒计时向上取整到月。两次模拟的插值时间差用于消费影响。</p><h3>今天购买力与未来金额</h3><p>图表默认把未来资产和目标同时除以同期累计物价因子，折算为今天的购买力；切换展示口径不会改变达标时间。目标金额取同期月支出年化后换算，默认维持当前生活水平。</p><h3>计算范围与局限</h3><p>最多逐月模拟 ${MAX_MONTHS / 12} 年。超过期限显示“模拟期内未达标”，不等于永远无法达标；若资金不足以覆盖支出，会报告资金耗尽，不默认借款。</p><p class="source-caution">结果是固定假设下首次达到资产门槛的时间，不是终身财务安全保证。未模拟市场波动、退休后资产提取、额外养老金、突发支出和家庭变化。未来每个月的目标会继续随通胀变化。</p>${err ? '' : `<p>本次原计划：<strong>${Number.isFinite(baseline?.months) ? '约 ' + timeLabel(baseline.months) : '模拟范围内未达标'}</strong>。</p>`}` };
  }
};

document.addEventListener('click', event => {
  const button = event.target.closest('[data-source]');
  if (button) {
    const source = sources[button.dataset.source]?.();
    if (!source) return;
    $('dialog-title').textContent = source.title;
    $('dialog-content').innerHTML = source.html;
    $('source-dialog').showModal();
    $('source-dialog').scrollTop = 0;
  }
});
$('close-dialog').addEventListener('click', () => $('source-dialog').close());
$('source-dialog').addEventListener('click', event => {
  if (event.target === $('source-dialog')) {
    const bounds = event.target.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
  }
});
$('planner-form').addEventListener('submit', event => event.preventDefault());
for (const key of [...FIELDS, 'price']) $(key).addEventListener('input', () => update());
$('demo-button').addEventListener('click', () => {
  if (isDemo) {
    for (const key of ['income', 'expense', 'assets', 'price']) $(key).value = '';
    for (const [key, value] of Object.entries(DEFAULTS)) $(key).value = value;
    isDemo = false;
    update();
    $('income').focus();
  } else {
    for (const [key, value] of Object.entries(DEMO)) $(key).value = value;
    isDemo = true;
    update();
    toast('已载入虚构演示数据，所有参数均可修改');
  }
});
$('clear-button').addEventListener('click', () => {
  for (const key of ['income', 'expense', 'assets', 'price']) $(key).value = '';
  for (const [key, value] of Object.entries(DEFAULTS)) $(key).value = value;
  isDemo = false;
  view = 'real';
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  update(false);
  $('save-status').textContent = '已清除 · 仅在此浏览器保存';
  toast('已清除本机记录，恢复初始设置');
});
$('reset-rates').addEventListener('click', () => {
  for (const [key, value] of Object.entries(DEFAULTS)) $(key).value = value;
  update();
  toast('已恢复参考设置，保留你的收支与资产');
});
for (const mode of ['real', 'nominal']) $('view-' + mode).addEventListener('click', () => { view = mode; update(); });

$('wealth-chart').addEventListener('pointermove', event => {
  if (!chartData || event.pointerType === 'touch') return;
  const bounds = $('wealth-chart').getBoundingClientRect();
  const svgX = (event.clientX - bounds.left) / bounds.width * 780;
  const month = Math.max(0, Math.min(chartData.maxMonth, (svgX - 49) / (780 - 49 - 20) * chartData.maxMonth));
  const nearest = points => points.reduce((best, point) => Math.abs(point.month - month) < Math.abs(best.month - month) ? point : best, points[0]);
  const basePoint = nearest(chartData.series);
  const secondPoint = chartData.secondSeries.length ? nearest(chartData.secondSeries) : null;
  const money = v => cny(v);
  const baseLabel = month > chartData.series.at(-1).month && baseline.months != null ? '已达标，积累模拟结束' : money(basePoint.value);
  const secondLabel = secondPoint && month > chartData.secondSeries.at(-1).month && after.months != null ? '已达标，积累模拟结束' : secondPoint ? money(secondPoint.value) : '';
  const tooltip = $('chart-tooltip');
  tooltip.innerHTML = `<strong>约 ${scalar(month / 12)} 年后</strong><br>原计划：${baseLabel}${secondPoint ? '<br>购买后：' + secondLabel : ''}<br>口径：${view === 'real' ? '今天购买力' : '未来金额'}`;
  tooltip.hidden = false;
  tooltip.style.left = Math.max(0, Math.min(bounds.width - tooltip.offsetWidth, event.clientX - bounds.left + 10)) + 'px';
  tooltip.style.top = '10px';
});
$('wealth-chart').addEventListener('pointerleave', () => { $('chart-tooltip').hidden = true; });
restore();
update(false);
