// META: global=window,worker
// META: title=IndexedDB: IDBCursor continue() Exception Ordering
// META: script=resources/support.js

// Spec: https://w3c.github.io/IndexedDB/#dom-idbcursor-continue

'use strict';

indexeddb_test(
    (t, db) => {
      const s = db.createObjectStore('s');
      s.put('value', 'key');
    },
    (t, db) => {
      const s = db.transaction('s', 'readonly').objectStore('s');
      const r = s.openKeyCursor();
      r.onsuccess = t.step_func(() => {
        r.onsuccess = null;
        const cursor = r.result;
        setTimeout(
            t.step_func(() => {
              assert_throws_dom(
                  'TransactionInactiveError',
                  () => {
                    cursor.continue({not: 'a valid key'});
                  },
                  '"Transaction inactive" check (TransactionInactiveError) ' +
                      'should precede "invalid key" check (DataError)');
              t.done();
            }),
            0);
      });
    },
    'IDBCursor.continue exception order: TransactionInactiveError vs. DataError');

indexeddb_test(
    (t, db) => {
      const s = db.createObjectStore('s');
      s.put('value', 'key');
    },
    (t, db) => {
      const s = db.transaction('s', 'readonly').objectStore('s');
      const r = s.openKeyCursor();
      r.onsuccess = t.step_func(() => {
        r.onsuccess = null;
        const cursor = r.result;
        cursor.continue();
        r.onsuccess = t.step_func(() => {
          setTimeout(
              t.step_func(() => {
                assert_throws_dom(
                    'TransactionInactiveError',
                    () => {
                      cursor.continue();
                    },
                    '"Transaction inactive" check (TransactionInactiveError) ' +
                        'should precede "got value flag" check (InvalidStateError)');
                t.done();
              }),
              0);
        });
      });
    },
    'IDBCursor.continue exception order: TransactionInactiveError vs. InvalidStateError');

indexeddb_test(
    (t, db) => {
      const s = db.createObjectStore('s');
      s.put('value', 'key');
    },
    (t, db) => {
      const s = db.transaction('s', 'readonly').objectStore('s');
      const r = s.openKeyCursor();
      r.onsuccess = t.step_func(() => {
        r.onsuccess = null;
        const cursor = r.result;
        cursor.continue();
        assert_throws_dom(
            'InvalidStateError',
            () => {
              cursor.continue({not: 'a valid key'});
            },
            '"got value flag" check (InvalidStateError) should precede ' +
                '"invalid key" check (DataError)');
        t.done();
      });
    },
    'IDBCursor.continue exception order: InvalidStateError vs. DataError');
