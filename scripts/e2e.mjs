import { chromium } from 'playwright-core';

// 可用环境变量 CHROME_BIN 指定浏览器；默认用 Playwright 下载的 headless shell
const CHROME =
  process.env.CHROME_BIN ||
  '/home/node/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:4173/';
const errors = [];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('text=电饭煲预约跨日校时引导台');
console.log('1) 页面加载 OK');

// 保存机型
await page.fill('input[type="text"]', '测试电饭煲');
await page.click('button:has-text("保存机型资料")');
await page.waitForSelector('text=已保存到本机浏览器');
console.log('2) 机型保存 OK');

// 校时：一键取现在时间；屏显填 23:50（制造偏差），走“自动换算”
await page.click('button:has-text("一键取本机现在时间")');
const timeInputs = page.locator('input[type="time"]');
await timeInputs.first().fill('23:50');
await page.waitForSelector('text=机内钟比真实时间');
await page.click('button:has-text("偏差自动换算")');
await page.waitForSelector('h2:has-text("填写希望开饭的时间窗")');
console.log('3) 校时（偏差补偿） OK');

// 时间窗：次日 07:00 ~ 07:30，勾选两个“次日”
const winTimes = page.locator('.card input[type="time"]');
await winTimes.nth(0).fill('07:00');
await winTimes.nth(1).fill('07:30');
const crosses = page.getByText('次日（已过午夜）');
await crosses.nth(0).check();
await crosses.nth(1).check();
await page.click('button:has-text("反算可行设定")');
await page.waitForSelector('h2:has-text("选择一个可行设定")');
const candCount = await page.locator('.candidate').count();
console.log('4) 反算候选数 =', candCount);
if (candCount < 1) throw new Error('应当至少有一个候选');

// 完成时刻机默认 -> 候选 token 应为 07:xx（机内补偿后的钟点）
const firstToken = await page.locator('.candidate .digits').first().textContent();
console.log('   首个候选屏显 =', firstToken);

await page.locator('.candidate').first().locator('button:has-text("开始引导")').click();
await page.waitForSelector('h2:has-text("步：先确认电饭煲")');
console.log('5) 进入逐步引导 OK');

// 逐步确认直到完成（遇到看灯步则选第一个灯项；其余步先勾“实际一致”）
let guard = 0;
while (guard++ < 30) {
  const card = page.locator('.card', { has: page.locator('h2:has-text("步：")') }).first();
  // 若有灯项选择
  const opt = card.locator('.seg button:has-text("时刻"), .seg button:has-text("倒计时")');
  if (await opt.count()) {
    await opt.first().click();
  } else {
    const ack = card.locator('.readback input[type="checkbox"]');
    await ack.check();
  }
  const next = card.getByRole('button', { name: /一致，继续下一步/ });
  if (await next.count()) {
    await next.click();
    await page.waitForTimeout(120);
    continue;
  }
  const done = card.getByRole('button', { name: '完成本次预约' });
  if (await done.count()) {
    await done.click();
    break;
  }
  break;
}
await page.waitForSelector('text=预约流程已全部确认完成', { timeout: 5000 });
console.log('6) 逐步引导完成 OK');
await page.waitForSelector('h2:has-text("本机厨房卡")');
console.log('7) 厨房卡出现 OK');

// 刷新续做：刷新后应仍在完成态且厨房卡可读
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('h2:has-text("本机厨房卡")');
const persistedName = await page.locator('h3:has-text("预约备忘")').textContent();
console.log('8) 刷新后续做 OK ->', persistedName.trim());

// 打印（headless 下仅验证不抛错）
const before = errors.length;
await page.evaluate(() => window.print());
await page.waitForTimeout(200);
console.log('9) 调用 window.print 无新增错误:', errors.length === before);

// IndexedDB 中确有数据
const hasSession = await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  return dbs.some((d) => d.name === 'rice-cooker-guide');
});
console.log('10) IndexedDB 库存在:', hasSession);

if (errors.length) {
  console.log('\n--- 浏览器错误 ---');
  for (const e of errors) console.log(e);
  process.exit(1);
}
await browser.close();
console.log('\n全部通过 ✔');
