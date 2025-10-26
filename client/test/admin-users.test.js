import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAdminUser } from '@/lib/queries/admin-users';

describe('admin user normalization', () => {
  it('keeps planId as the identifier while surfacing a separate planSlug', () => {
    const normalized = normalizeAdminUser({
      id: 'user-123',
      username: 'demo-user',
      email: 'demo@example.com',
      planId: '65f1c1edc25a5e3d12345678',
      planSlug: 'growth-plan',
      plan: { name: 'Growth', slug: 'growth-plan' },
    });

    assert.equal(normalized.planId, '65f1c1edc25a5e3d12345678');
    assert.equal(normalized.planSlug, 'growth-plan');
    assert.notEqual(normalized.planId, normalized.planSlug);
  });
});
