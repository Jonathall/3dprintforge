// print-tracker-ams-null-tray.test.js — regression for the demo-mode crash
// loop: an AMS unit with empty slots reports them as `null` entries in its
// tray array (real firmware does this, and the demo H2D mirrors it). The AMS
// signature builder dereferenced every entry, so `update()` threw
// "Cannot read properties of null (reading 'id')" on every frame — in demo
// mode that fired several times a second and kept the server from settling.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDb } from '../test-helper.js';
import { PrintTracker } from '../../server/print-tracker.js';

const frame = (trays) => ({
  gcode_state: 'IDLE',
  ams: { ams: [{ id: '0', tray: trays }], tray_now: '0' },
});

describe('print-tracker — AMS trays with empty slots', () => {
  before(() => setupTestDb());

  it('does not throw when a tray slot is null', () => {
    const t = new PrintTracker('ams-null-printer');
    assert.doesNotThrow(() => t.update(frame([
      { id: '0', tray_type: 'PLA', tray_color: 'FFFFFFFF' },
      null,
      null,
      { id: '3', tray_type: 'PETG', tray_color: '000000FF' },
    ])));
  });

  it('does not throw when the whole unit has no tray array', () => {
    const t = new PrintTracker('ams-empty-printer');
    assert.doesNotThrow(() => t.update({ gcode_state: 'IDLE', ams: { ams: [{ id: '0' }] } }));
  });

  it('treats a slot going from empty to loaded as a change', () => {
    const t = new PrintTracker('ams-sig-printer');
    t.update(frame([{ id: '0', tray_type: 'PLA', tray_color: 'FFFFFFFF' }, null]));
    const first = t._lastAmsSig;
    t.update(frame([{ id: '0', tray_type: 'PLA', tray_color: 'FFFFFFFF' }, { id: '1', tray_type: 'ABS', tray_color: '00FF00FF' }]));
    assert.notEqual(t._lastAmsSig, first, 'filling an empty slot must produce a new signature');
  });
});
