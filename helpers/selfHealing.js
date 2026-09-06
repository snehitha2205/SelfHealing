const dotenv = require('dotenv');
const { google } = require('@ai-sdk/google');
const { generateObject } = require('ai');

const { healingSchema } = require('./healingSchema.js');
const { collectFailureEvidence } = require('./playwrightMcpClient.js');

dotenv.config();

const allowedActions = new Set([
    'click',
    'fill',
    'select'
]);

function sanitizeLocator(locator) {
    if (typeof locator !== 'string') {
        return '';
    }

    return locator.trim();
}

function escapeCssAttributeValue(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

/**
 * Converts supported Playwright-style selectors into
 * CodeceptJS-compatible CSS selectors.
 */
function normalizeLocator(locator) {
    const sanitizedLocator = sanitizeLocator(locator);

    if (!sanitizedLocator) {
        return '';
    }

    if (/^role\s*=\s*button\b/i.test(sanitizedLocator)) {
        return 'button';
    }

    // Convert unsupported text-based button syntax to valid CSS.
    const buttonTextMatch = sanitizedLocator.match(
        /^button:has-text\(["'](.+?)["']\)$/i
    );

    if (buttonTextMatch) {
        return 'button';
    }

    // Convert role button syntax to valid CSS.
    const roleButtonMatch = sanitizedLocator.match(
        /^role=button\[name\s*=\s*["'](.+?)["']\]$/i
    );

    if (roleButtonMatch) {
        return 'button';
    }

    // Convert text syntax to valid CSS.
    const textMatch = sanitizedLocator.match(
        /^text\s*=\s*["']?(.+?)["']?$/i
    );

    if (textMatch) {
        return 'button';
    }

    return sanitizedLocator;
}

function validateHealingDecision(decision) {
    if (!decision || typeof decision !== 'object') {
        throw new Error(
            'Healing decision is missing or invalid.'
        );
    }

    const locator = normalizeLocator(decision.newLocator);

    if (!locator) {
        throw new Error(
            'Healing decision did not include a valid locator.'
        );
    }

    if (!allowedActions.has(decision.action)) {
        throw new Error(
            `Unsupported healing action: ${decision.action}`
        );
    }

    const blockedPatterns = [
        /javascript:/i,
        /\beval\s*\(/i,
        /\bdocument\s*\./i,
        /\bwindow\s*\./i,
        /\bFunction\s*\(/i
    ];

    if (
        blockedPatterns.some((pattern) =>
            pattern.test(locator)
        )
    ) {
        throw new Error(
            'Locator contains unsupported executable code patterns.'
        );
    }

    if (
        typeof decision.confidence !== 'number' ||
        decision.confidence < 0.5
    ) {
        throw new Error(
            `Healing confidence too low: ${decision.confidence}`
        );
    }

    if (decision.shouldHeal !== true) {
        throw new Error(
            'Gemini did not authorize a healing action.'
        );
    }

    /*
     * CSS-only locator validation.
     *
     * Examples accepted:
     * #add-todo-btn
     * .add-button
     * [data-testid="add-task"]
     * button[aria-label="Add"]
     * input[name="username"]
     * textarea[name="description"]
     * select[name="status"]
     * a[href="/tasks"]
     */
    const allowedLocatorPrefixes = [
        '#',
        '.',
        '[',
        'button',
        'input',
        'textarea',
        'select',
        'a',
        'form',
        'data-testid'
    ];

    const isAllowedPrefix = allowedLocatorPrefixes.some(
        (prefix) => locator.startsWith(prefix)
    );

    if (!isAllowedPrefix) {
        throw new Error(
            `Unsupported locator format: ${locator}`
        );
    }

    /*
     * Do not allow XPath or Playwright-only locator syntax.
     */
    const unsupportedPatterns = [
        /^\/\//,
        /^role=/i,
        /^text=/i,
        /getByRole\s*\(/i,
        /getByText\s*\(/i,
        /locator\s*\(/i,
        /:has-text\s*\(/i
    ];

    if (
        unsupportedPatterns.some((pattern) =>
            pattern.test(locator)
        )
    ) {
        throw new Error(
            `Unsupported Playwright-only locator format: ${locator}`
        );
    }

    return locator;
}

async function askGeminiForHealing(evidence) {
    const apiKey = "";

    if (!apiKey) {
        throw new Error(
            'Missing GOOGLE_GENERATIVE_AI_API_KEY. ' +
            'Add it to the .env file before running the test.'
        );
    }

    const model = google('gemini-2.5-flash', {
        apiKey
    });

    const prompt = `
The CodeceptJS + Playwright test failed while performing:

Action:
${evidence.action}

Old locator:
${evidence.oldLocator}

Analyze the current page evidence collected through Playwright MCP.

Find the most likely replacement locator.

STRICT LOCATOR REQUIREMENTS:

- Return exactly one CSS locator in newLocator.
- The locator must be passed directly to CodeceptJS like this:
  await I.click(newLocator)
- Use CSS selectors only.
- Do not return XPath.
- Do not return Playwright-only locator syntax.
- Do not return JavaScript.
- Do not return CodeceptJS code.
- Do not return backticks.
- Do not return Markdown.
- Do not return explanations inside newLocator.
- Do not invent an id, class, attribute, or element.
- Use only selectors supported by the evidence.

Prefer selectors in this order:

1. Stable id:
    #add-todo-btn

2. Test id:
   [data-testid="add-task"]

3. Existing attribute from the DOM:
    Use only an attribute that is actually present in the evidence.

4. Aria label:
   button[aria-label="Add"]

5. Stable class:
   .add-button


VALID EXAMPLES:

#add-todo-btn
[data-testid="add-task"]
button[aria-label="Add"]
.add-button
button

INVALID EXAMPLES:

button[name="Add"]
button:has-text("Add")
text=Add
role=button[name="Add"]
getByRole(...)
getByText(...)
locator(...)
page.locator(...)

If a specific selector is available, do not return a generic selector such as button.
The captured page contains id="add-todo-btn" on the Add button. When that id is present, return #add-todo-btn.

Return only a structured healing decision.

Evidence:
${JSON.stringify(evidence, null, 2)}
`;

    console.log('[AI] Sending evidence to Gemini...');

    try {
        const result = await generateObject({
            model,
            schema: healingSchema,
            prompt
        });

        if (!result || !result.object) {
            throw new Error(
                'Gemini returned an empty structured response.'
            );
        }

        console.log(
            '[AI] Suggested locator:',
            result.object.newLocator
        );

        console.log(
            '[AI] Reason:',
            result.object.reason
        );

        return result.object;
    } catch (error) {
        console.error('[AI] Gemini request failed.');
        console.error(
            '[AI] Error message:',
            error?.message || error
        );

        throw error;
    }
}

async function selfHealingClick(I, oldLocator) {
    try {
        await I.click(oldLocator);
        return;
    } catch (originalError) {
        console.log('[FAIL] Original locator failed');

        console.log(
            '[FAIL] Error:',
            originalError?.message || originalError
        );

        let evidence;

        try {
            const currentUrl = await I
                .grabCurrentUrl()
                .catch(() => '');

            const evidenceUrl =
                currentUrl || 'http://localhost:3000';

            console.log(
                '[MCP] Evidence URL:',
                evidenceUrl
            );

            evidence = await collectFailureEvidence({
                oldLocator,
                action: 'click',
                error:
                    originalError?.message ||
                    'Element not found',
                url: evidenceUrl
            });

            console.log(
                '[MCP] Failure evidence collected'
            );
        } catch (mcpError) {
            console.error(
                '[MCP] Evidence collection failed'
            );

            console.error(
                '[MCP] Error:',
                mcpError?.message || mcpError
            );

            throw originalError;
        }

        let decision;

        try {
            decision = await askGeminiForHealing(evidence);
        } catch (aiError) {
            console.error(
                '[AI] Self-healing could not continue'
            );

            console.error(
                '[AI] Error:',
                aiError?.message || aiError
            );

            throw originalError;
        }

        let safeLocator;

        try {
            safeLocator = validateHealingDecision(
                decision
            );
        } catch (validationError) {
            console.error(
                '[HEAL] Invalid Gemini decision'
            );

            console.error(
                '[HEAL] Error:',
                validationError?.message ||
                    validationError
            );

            throw originalError;
        }

        console.log(
            '[HEAL] Validated replacement locator:',
            safeLocator
        );

        console.log('[HEAL] Retrying click...');

        try {
            /*
             * Important:
             *
             * Pass the CSS selector directly.
             *
             * Correct:
             * await I.click('button[name="Add"]');
             *
             * Avoid:
             * await I.click({ css: safeLocator });
             */
            await I.click(safeLocator);

            console.log(
                '[PASS] Self-healing retry succeeded.'
            );
        } catch (retryError) {
            console.error(
                '[HEAL] Retry with healed locator failed'
            );

            console.error(
                '[HEAL] Healed locator used:',
                safeLocator
            );

            console.error(
                '[HEAL] Error:',
                retryError?.message || retryError
            );

            throw retryError;
        }
    }
}

module.exports = {
    selfHealingClick,
    askGeminiForHealing,
    validateHealingDecision,
    normalizeLocator,
    sanitizeLocator
};