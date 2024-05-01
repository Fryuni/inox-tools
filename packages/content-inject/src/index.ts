import { defineIntegration } from 'astro-integration-kit';
import { z } from 'astro/zod';



export default defineIntegration({
  name: '@demo/content-inject',
  optionsSchema: z.never().optional(),
  setup() {
    // TODO: Implement this
  },
});
