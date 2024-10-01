import { defineIntegration } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { debug } from './internal/debug.js';

export default defineIntegration({
  name: '@inox-tools/portal-gun',
  optionsSchema: z.never().optional(),
  setup() {
    // TODO: Implement this
  },
});
