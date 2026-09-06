const { selfHealingClick } = require('../helpers/selfHealing.js');

Feature('To-Do List');

Scenario('Add a task with self-healing', async ({ I }) => {
  console.log('[TEST] Opening Todo application');
  I.amOnPage('http://localhost:3000');
  I.waitForElement('#task-input', 10);
  I.fillField('#task-input', 'Learn self-healing');

  console.log('[TEST] Clicking #add-task-btn');
  await selfHealingClick(I, '#add-task-btn');

  I.see('Learn self-healing');
  console.log('[PASS] Task added successfully');
});
