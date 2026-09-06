# self-healing-todo-demo

This project is a small, runnable demo of real self-healing browser automation. It uses a plain HTML/CSS/JavaScript to-do app, CodeceptJS + Playwright for the browser test, a real Playwright MCP server for evidence collection, and the Google Gemini API for the healing decision.

## What the project does

- Starts a simple todo app on localhost:3000
- Runs a real browser test with CodeceptJS + Playwright
- Intentionally fails with an old locator: `#add-task-btn`
- Collects page evidence via Playwright MCP
- Sends that evidence to Gemini
- Validates the returned locator and retries the action
- Confirms the task is added after the healed retry

## Project structure

```text
self-healing-todo-demo/
├── app/
│   ├── server.js
│   └── public/
│       ├── index.html
│       ├── style.css
│       └── app.js
├── helpers/
│   ├── selfHealing.js
│   ├── playwrightMcpClient.js
│   └── healingSchema.js
├── mcp/
│   └── playwright.config.json
├── tests/
│   └── todo_test.js
├── codecept.conf.cjs
├── steps_file.cjs
├── package.json
├── .env.example
├── .gitignore
├── README.md
```

## Install dependencies

```bash
npm install
```

## Configure the Gemini API key

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Then set a valid Gemini API key:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
HEADLESS=true
PORT=3000
```

Do not commit or print the key.

## Start the Todo app

```bash
npm run start
```

The app is served at:

```text
http://localhost:3000
```

## Start the Playwright MCP server

```bash
npx -y @playwright/mcp@0.0.80 --port 8931 --shared-browser-context
```

This is the real MCP server used to inspect the same browser page where the test failed. The shared browser context is important for keeping the page state consistent across the evidence-collection phase.

## Run the CodeceptJS test

```bash
npx codeceptjs run --steps --config codecept.conf.cjs
```

## Why the test fails initially

The UI uses the new locator:

```html
<button id="add-todo-btn">Add</button>
```

The test intentionally starts with the old selector:

```js
I.click('#add-task-btn');
```

This triggers a real element-not-found failure, which gives the self-healing flow something to diagnose.

## How MCP collects evidence

The helper in `helpers/playwrightMcpClient.js` connects to the MCP server at `http://localhost:8931/mcp` and calls the browser tools available from the Playwright MCP server.

It gathers the current page state, including:

- error message
- old locator
- URL
- accessibility snapshot
- DOM data
- screenshot
- console messages when available

This evidence comes from the same browser page where the test failed.

## How Gemini analyzes evidence

The logic in `helpers/selfHealing.js` sends the collected evidence to Gemini using the Google provider and gets a structured object back via `generateObject` from the AI SDK.

The schema is defined in `helpers/healingSchema.js`.

## How the replacement locator is selected

Gemini is prompted to:

- infer the most likely replacement selector
- prefer stable selectors such as id or stable CSS
- avoid invented or arbitrary values
- only return what is supported by the current page evidence

The result is validated against a strict schema and safety rules before the retry is attempted.

## How the retry works

If the original click fails, the helper:

1. catches the failing step
2. gathers page evidence through MCP
3. asks Gemini for a healing decision
4. validates the returned locator
5. retries the click with the healed selector
6. stops if the locator is invalid or confidence is too low

## Where CodeceptJS executes the healed action

The actual click retry happens inside the `selfHealingClick` helper, which is called from the scenario in `tests/todo_test.js`.

## Where Gemini is called

The Gemini API is called in `helpers/selfHealing.js` inside `askGeminiForHealing()`.

## Where MCP is used

The MCP client is in `helpers/playwrightMcpClient.js` and it connects to the real Playwright MCP server for evidence collection.

## Limitations of the demo

- This is a small learning demo, not a production-grade self-healing system.
- The healing step depends on a valid Gemini API key.
- The tool only supports a safe subset of actions: `click`, `fill`, and `select`.
- The demo intentionally fails once before healing so the flow is visible and teachable.

## How to demonstrate self-healing

1. Start the app:
   ```bash
   npm run start
   ```
2. Start the MCP server in another terminal:
   ```bash
   npx -y @playwright/mcp@0.0.80 --port 8931
   ```
3. Run the failing test:
   ```bash
   npx codeceptjs run --steps --config codecept.conf.cjs
   ```
4. Observe the old locator failure.
5. Observe the MCP evidence collection.
6. Observe Gemini’s healing decision.
7. Observe the retry using the healed selector.
8. See the final passing result.

## Real self-healing flow

```text
TEST FAILURE
  ↓
PLAYWRIGHT MCP COLLECTS EVIDENCE
  ↓
GEMINI ANALYZES EVIDENCE
  ↓
GEMINI RETURNS HEALING DECISION
  ↓
CODECEPTJS + PLAYWRIGHT RETRIES
  ↓
TEST PASSES
```

The critical requirement is that the evidence comes from the same failed page and the retry is performed by the real CodeceptJS + Playwright test runner.
