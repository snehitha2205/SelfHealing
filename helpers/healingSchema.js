const { z } = require('zod');

const healingSchema = z.object({
  shouldHeal: z.boolean(),
  oldLocator: z.string(),
  newLocator: z.string(),
  action: z.enum(['click', 'fill', 'select']),
  reason: z.string(),
  confidence: z.number().min(0).max(1)
});

module.exports = { healingSchema };
