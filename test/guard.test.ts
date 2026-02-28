import assert from 'node:assert';
import test from 'node:test';
import { Cordon } from '../lib/guard.js';

test('Cordon.has', async (t) => {
  await t.test('returns true when permission model is not active', () => {
    // Without --permission flag, process.permission is undefined — should allow all
    const original = (process as any).permission;
    (process as any).permission = undefined;

    assert.strictEqual(Cordon.has('fs.read', '/tmp'), true);

    (process as any).permission = original;
  });

  await t.test('returns false when permission engine denies access', () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => false };

    assert.strictEqual(Cordon.has('net', 'external.com'), false);

    (process as any).permission = original;
  });

  await t.test('returns true when permission engine grants access', () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => true };

    assert.strictEqual(Cordon.has('fs.write', '/tmp'), true);

    (process as any).permission = original;
  });
});

test('Cordon.shield', async (t) => {
  await t.test('executes action and returns result when permitted', async () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => true };

    const result = await Cordon.shield('fs.read', '/allowed', () => 'success', 'blocked');
    assert.strictEqual(result, 'success');

    (process as any).permission = original;
  });

  await t.test('returns fallback when permission is denied', async () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => false };

    const result = await Cordon.shield('net', 'external.com', () => 'success', 'blocked');
    assert.strictEqual(result, 'blocked');

    (process as any).permission = original;
  });

  await t.test('supports async actions', async () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => true };

    const result = await Cordon.shield(
      'fs.read',
      '/allowed',
      async () => Promise.resolve(42),
      0
    );
    assert.strictEqual(result, 42);

    (process as any).permission = original;
  });

  await t.test('propagates errors thrown by the action', async () => {
    const original = (process as any).permission;
    (process as any).permission = { has: () => true };

    await assert.rejects(
      () => Cordon.shield('fs.read', '/allowed', () => { throw new Error('action failed'); }, 'blocked'),
      /action failed/
    );

    (process as any).permission = original;
  });
});