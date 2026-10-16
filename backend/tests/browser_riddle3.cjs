/* LOCAL TEST ONLY: real HTTP API + built UI; the companion app uses a scripted model.
 * node backend/tests/browser_riddle3.cjs <path-to-playwright-module>
 * Optional BTM_BROWSER_PATH / BTM_SCREENSHOT_DIR. No tokens are printed or saved.
 */
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:8017';

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
    for (const [reason, button, width] of [
      ['skip', 'Skip this check', 360],
      ['not_sure', 'I’m not sure', 1280],
      ['teacher', 'Discuss with my teacher', 360],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      // No external resources are needed for this local verification.
      await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      const cls = await api('/classes', 'POST', { name: 'Synthetic browser check' });
      const teacherHeaders = { 'X-Teacher-Token': cls.teacher_token };
      const quiz = await api(`/classes/${cls.class_id}/quiz`, 'PUT', {
        topic: 'Fractions', title: 'One useful check', questions: [{
          prompt: 'What is 1/2 + 1/4?', correct_answer: '3/4', answer_type: 'number',
          key_idea: 'Use a common denominator.', misconceptions: [],
        }],
      }, teacherHeaders);
      const learner = await api('/join', 'POST', { join_code: cls.join_code, nickname: 'Test learner' });
      const submitted = await api('/responses', 'POST', {
        question_id: quiz.questions[0].question_id, answer: '3/4', explanation: 'it looked right', self_confidence: 'sure',
      }, { 'X-Student-Token': learner.student_token });
      assert(submitted.follow_up);
      await page.addInitScript(token => localStorage.setItem('btm.student', token), learner.student_token);
      await page.goto(`${base}/student`);
      await page.getByText('One optional check — not another score', { exact: true }).waitFor();
      assert.equal(await page.locator('canvas').count(), 0, 'Diagnostic workspace has no decorative cursor overlay');
      await page.reload(); // pending check survives refresh
      await page.getByRole('button', { name: button, exact: true }).waitFor();
      if (process.env.BTM_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.BTM_SCREENSHOT_DIR}/riddle3-student-${reason}.png` });
      }
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.getByRole('heading', { name: /All done/ }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const detail = await api(`/responses/${submitted.response_id}`, 'GET', undefined, teacherHeaders);
      assert.equal(detail.follow_up.declined_reason, reason);
      assert.equal(detail.follow_up.student_reply, null);
      assert.equal(detail.diagnosis.label, 'not_sure');
      assert.equal(detail.is_correct, true);
      await page.goto(`${base}/teacher/${cls.class_id}/responses/${submitted.response_id}#${cls.teacher_token}`);
      await page.getByText('Why this check?', { exact: true }).waitFor();
      await page.getByText('What different replies might suggest', { exact: true }).waitFor();
      await page.getByText(/This is not evidence of guessing/).waitFor();
      const checkHeading = page.getByText('What different replies might suggest', { exact: true });
      await checkHeading.scrollIntoViewIfNeeded();
      const bounds = await checkHeading.boundingBox();
      assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 900, 'Teacher explanation must be reachable onscreen');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.BTM_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.BTM_SCREENSHOT_DIR}/riddle3-teacher-${reason}.png` });
      }
      console.log(`PASS: ${reason}, refresh recovery, teacher explanation, ${width}px, no horizontal overflow`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
