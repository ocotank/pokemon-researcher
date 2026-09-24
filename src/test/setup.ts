import 'fake-indexeddb/auto';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const urlApi = URL as typeof URL & {
    createObjectURL?: (object: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };

  urlApi.createObjectURL = vi.fn(() => 'blob:vitest');
  urlApi.revokeObjectURL = vi.fn();
  afterEach(cleanup);
}
