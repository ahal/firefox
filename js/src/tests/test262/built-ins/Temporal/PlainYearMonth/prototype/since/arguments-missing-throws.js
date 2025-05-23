// |reftest| shell-option(--enable-temporal) skip-if(!this.hasOwnProperty('Temporal')||!xulRuntime.shell) -- Temporal is not enabled unconditionally, requires shell-options
// Copyright (C) 2021 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.plainyearmonth.prototype.since
description: Calls to PYM.since throw when missing required arguments.
features: [Temporal]
---*/

const jun13 = new Temporal.PlainYearMonth(2013, 6);

assert.throws(TypeError, () => jun13.since({ year: 1994 }), 'Throws when missing required month');
assert.throws(TypeError, () => jun13.since({ month: 11 }), 'Throws when missing required year');

reportCompare(0, 0);
