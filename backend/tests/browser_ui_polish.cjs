/* Local UI audit only: built frontend + isolated test API, never real student data.
 * node backend/tests/browser_ui_polish.cjs <playwright-module> [--verify]
 * Optional BTM_BROWSER_PATH, BTM_UI_OUTPUT. Run the Riddle 3 browser test app on :8017.
 */
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:8017';
const verify = process.argv.includes('--verify');

async function api(path, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert(response.ok, `${path}: ${response.status}`);
  return response.json();
}

(async () => {
  const cls = await api('/classes', 'POST', { name: 'Design review class' });
  const teacherAuth = { 'X-Teacher-Token': cls.teacher_token };
  const quiz = await api(`/classes/${cls.class_id}/quiz`, 'PUT', {
    topic: 'Fractions', title: 'Understanding the method', questions: [{
      prompt: 'What is 1/2 + 1/4?', correct_answer: '3/4', answer_type: 'number',
      key_idea: 'Use a common denominator.', misconceptions: [],
    }],
  }, teacherAuth);
  const learner = await api('/join', 'POST', { join_code: cls.join_code, nickname: 'Test learner' });
  const response = await api('/responses', 'POST', {
    question_id: quiz.questions[0].question_id, answer: '3/4', explanation: 'it looked right', self_confidence: 'sure',
  }, { 'X-Student-Token': learner.student_token });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BTM_BROWSER_PATH });
  const errors = [];
  try {
    for (const width of [1440, 360]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.addInitScript(({ cls, learner }) => {
        localStorage.setItem(`btm.teacher.${cls.class_id}`, cls.teacher_token);
        localStorage.setItem('btm.student', learner.student_token);
      }, { cls, learner });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      const routes = [
        ['landing', '/'], ['create', '/teacher/new'], ['join', '/join'],
        ['class', `/teacher/${cls.class_id}#${cls.teacher_token}`],
        ['builder', `/teacher/${cls.class_id}/quiz#${cls.teacher_token}`],
        ['results', `/teacher/${cls.class_id}/results#${cls.teacher_token}`],
        ['response', `/teacher/${cls.class_id}/responses/${response.response_id}#${cls.teacher_token}`],
      ];
      for (const [name, path] of routes) {
        await page.goto(`${base}${path}`);
        await page.locator('main').waitFor();
        await page.waitForFunction(() => !/Connecting to your class|Loading your class|Loading results|Loading response/.test(document.body.innerText));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll('main h1, main h2, main h3')].every(heading => {
          for (let node = heading; node && node.tagName !== 'MAIN'; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) < 0.99) return false;
          }
          return true;
        }));
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          duplicateIds: [...document.querySelectorAll('[id]')].map(el => el.id).filter((id, i, ids) => ids.indexOf(id) !== i),
        }));
        assert(!metrics.overflow, `${name} ${width}px: document overflow`);
        if (verify) assert.deepEqual(metrics.duplicateIds, [], `${name}: duplicate element IDs`);
        if (process.env.BTM_UI_OUTPUT) await page.screenshot({ animations: 'disabled', path: `${process.env.BTM_UI_OUTPUT}/${name}-${width}.png` });
        console.log(`${verify ? 'PASS' : 'AUDIT'}: ${name} ${width}px, duplicate IDs: ${metrics.duplicateIds.length}`);
      }
      if (verify) {
        await page.goto(`${base}/`);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator(':focus').getAttribute('id'), 'main-content');
        if (width === 360) {
          await page.getByRole('button', { name: 'Open navigation' }).click();
          await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Join a class', exact: true }).click();
          await page.waitForURL('**/join');
          assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
        }
        await page.goto(`${base}/teacher/${cls.class_id}#${cls.teacher_token}`);
        const teacherHash = await page.evaluate(() => location.hash);
        await page.keyboard.press('Tab');
        if (await page.getByText('Skip to content', { exact: true }).evaluate(el => el === document.activeElement)) await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => location.hash), teacherHash, 'Skip link must not replace the teacher credential hash');
        const projector = page.getByRole('button', { name: /projector view/i }).first();
        assert(await projector.isVisible(), 'Projector control must be available on mobile and desktop');
        {
          await projector.first().click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          assert(await dialog.evaluate(el => el.contains(document.activeElement)));
          await page.keyboard.press('Shift+Tab');
          assert(await dialog.evaluate(el => el.contains(document.activeElement)));
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.equal(await page.locator('[inert]').count(), 0);
          assert(await projector.evaluate(el => el === document.activeElement), 'Restore focus to the dialog trigger');
        }
      }
      await context.close();
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
