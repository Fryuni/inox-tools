import * as matchers from 'jest-extended';
import { expect } from 'vitest';

process.setSourceMapsEnabled(true);

expect.extend(matchers);
