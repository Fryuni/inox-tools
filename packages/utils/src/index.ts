import { defineIntegration } from 'astro-integration-kit';
import { z } from 'astro/zod';

export default defineIntegration({
  name: '@demo/utils',
  optionsSchema: z.never().optional(),
  setup() {
    // TODO: Implement this
  },
});
