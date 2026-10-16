/* LOCAL TEST ONLY: real HTTP API + built UI; the companion app uses a scripted model.
 * node backend/tests/browser_riddle4.cjs <path-to-playwright-module>
 * Optional BTM_BROWSER_PATH / BTM_SCREENSHOT_DIR. No tokens are printed or saved.
 */
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:8018';

async function api(path, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BTM_BROWSER_PATH });
  const errors = [];
  try {
    for (const width of [360, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());

      const cls = await api('/classes', 'POST', { name: 'Synthetic transfer check' });
      const teacherHeaders = { 'X-Teacher-Token': cls.teacher_token };
      const quiz = await api(`/classes/${cls.class_id}/quiz`, 'PUT', {
        topic: 'Fractions', title: 'Does it travel?', questions: [{
          prompt: 'What is 1/2 + 1/4?', correct_answer: '3/4', answer_type: 'number',
          key_idea: 'Use a common denominator.', misconceptions: [],
          transfer_items: [{ prompt: 'What is 2/5 + 3/10?', correct_answer: '7/10', answer_type: 'number', change: 'different numbers' }],
        }],
      }, teacherHeaders);
      const questionId = quiz.questions[0].question_id;
      const learner = await api('/join', 'POST', { join_code: cls.join_code, nickname: 'Test learner' });
      await api('/responses', 'POST', {
        question_id: questionId, answer: '3/4', explanation: '1/2 is 2/4 so 2/4 + 1/4', self_confidence: 'sure',
      }, { 'X-Student-Token': learner.student_token });

      // Teacher schedules a check-in through the UI ("Now" so the demo can continue).
      await page.goto(`${base}/teacher/${cls.class_id}/results#${cls.teacher_token}`);
      const panel = page.getByText('Did it travel? Better marks vs better understanding', { exact: true });
      await panel.waitFor();
      await page.locator('select').first().selectOption('0');
      await page.getByRole('button', { name: 'Schedule re-check for everyone who answered' }).click();
      await page.getByText('Scheduled 1.', { exact: false }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'teacher panel overflow');

      // Student answers the check-in: no hints, no follow-up, no result shown.
      const studentPage = await context.newPage();
      studentPage.on('pageerror', error => errors.push(error.message));
      await studentPage.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      await studentPage.addInitScript(token => localStorage.setItem('btm.student', token), learner.student_token);
      await studentPage.goto(`${base}/student`);
      await studentPage.getByText('What is 2/5 + 3/10?', { exact: true }).waitFor();
      assert(await studentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'check-in overflow');
      if (process.env.BTM_SCREENSHOT_DIR) {
        await studentPage.screenshot({ path: `${process.env.BTM_SCREENSHOT_DIR}/riddle4-student-${width}.png` });
      }
      await studentPage.getByLabel('Your answer').fill('7/10');
      await studentPage.getByLabel('How did you work it out?').fill('I made them both tenths: 4/10 + 3/10');
      await studentPage.getByRole('button', { name: 'Sure', exact: true }).click();
      await studentPage.getByRole('button', { name: 'Send answer' }).click();
      await studentPage.getByRole('heading', { name: /All done/ }).waitFor();
      assert.equal(await studentPage.getByText(/Travelled|Lasted|Didn't travel/).count(), 0, 'student must not see a verdict');

      // Teacher sees the verdict and what to change.
      await page.reload();
      await page.getByText('Travelled — check again later', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: /Test learner.*different numbers/ }).click();
      await page.getByText(/Check again once 7 days have passed/).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'verdict overflow');
      if (process.env.BTM_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.BTM_SCREENSHOT_DIR}/riddle4-teacher-${width}.png`, fullPage: true });
      }
      const report = await api(`/classes/${cls.class_id}/transfer`, 'GET', undefined, teacherHeaders);
      assert.equal(report.questions[0].rechecks[0].verdict, 'travelled');
      console.log(`PASS: schedule via UI, unaided check-in, verdict + change plan, ${width}px, no horizontal overflow`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
