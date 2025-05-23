// META: global=window,worker
// META: title=IDBObjectStore.openKeyCursor()
// META: script=resources/support.js

'use strict';

function store_test(func, name) {
  indexeddb_test(
      function(t, db, tx) {
        let objectStore = db.createObjectStore('store');
        for (let i = 0; i < 10; ++i) {
          objectStore.put('value: ' + i, i);
        }
      },
      function(t, db) {
        let tx = db.transaction('store', 'readonly');
        let objectStore = tx.objectStore('store');
        func(t, db, tx, objectStore);
      },
      name);
}

store_test(function(t, db, tx, objectStore) {
  let expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let actual = [];
  let request = objectStore.openKeyCursor();
  request.onsuccess = t.step_func(function() {
    let cursor = request.result;
    if (!cursor)
      return;
    assert_equals(cursor.direction, 'next');
    assert_false('value' in cursor);
    assert_equals(indexedDB.cmp(cursor.key, cursor.primaryKey), 0);
    actual.push(cursor.key);
    cursor.continue();
  });

  tx.onabort = t.unreached_func('transaction aborted');
  tx.oncomplete = t.step_func(function() {
    assert_array_equals(expected, actual, 'keys should match');
    t.done();
  });
}, 'IDBObjectStore.openKeyCursor() - forward iteration');

store_test(function(t, db, tx, objectStore) {
  let expected = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  let actual = [];
  let request = objectStore.openKeyCursor(null, 'prev');
  request.onsuccess = t.step_func(function() {
    let cursor = request.result;
    if (!cursor)
      return;
    assert_equals(cursor.direction, 'prev');
    assert_false('value' in cursor);
    assert_equals(indexedDB.cmp(cursor.key, cursor.primaryKey), 0);
    actual.push(cursor.key);
    cursor.continue();
  });

  tx.onabort = t.unreached_func('transaction aborted');
  tx.oncomplete = t.step_func(function() {
    assert_array_equals(expected, actual, 'keys should match');
    t.done();
  });
}, 'IDBObjectStore.openKeyCursor() - reverse iteration');

store_test(function(t, db, tx, objectStore) {
  let expected = [4, 5, 6];
  let actual = [];
  let request = objectStore.openKeyCursor(IDBKeyRange.bound(4, 6));
  request.onsuccess = t.step_func(function() {
    let cursor = request.result;
    if (!cursor)
      return;
    assert_equals(cursor.direction, 'next');
    assert_false('value' in cursor);
    assert_equals(indexedDB.cmp(cursor.key, cursor.primaryKey), 0);
    actual.push(cursor.key);
    cursor.continue();
  });

  tx.onabort = t.unreached_func('transaction aborted');
  tx.oncomplete = t.step_func(function() {
    assert_array_equals(expected, actual, 'keys should match');
    t.done();
  });
}, 'IDBObjectStore.openKeyCursor() - forward iteration with range');

store_test(function(t, db, tx, objectStore) {
  let expected = [6, 5, 4];
  let actual = [];
  let request = objectStore.openKeyCursor(IDBKeyRange.bound(4, 6), 'prev');
  request.onsuccess = t.step_func(function() {
    let cursor = request.result;
    if (!cursor)
      return;
    assert_equals(cursor.direction, 'prev');
    assert_false('value' in cursor);
    assert_equals(indexedDB.cmp(cursor.key, cursor.primaryKey), 0);
    actual.push(cursor.key);
    cursor.continue();
  });

  tx.onabort = t.unreached_func('transaction aborted');
  tx.oncomplete = t.step_func(function() {
    assert_array_equals(expected, actual, 'keys should match');
    t.done();
  });
}, 'IDBObjectStore.openKeyCursor() - reverse iteration with range');

store_test(function(t, db, tx, objectStore) {
  assert_throws_dom('DataError', function() {
    objectStore.openKeyCursor(NaN);
  }, 'openKeyCursor should throw on invalid number key');
  assert_throws_dom('DataError', function() {
    objectStore.openKeyCursor(new Date(NaN));
  }, 'openKeyCursor should throw on invalid date key');
  assert_throws_dom('DataError', function() {
    let cycle = [];
    cycle.push(cycle);
    objectStore.openKeyCursor(cycle);
  }, 'openKeyCursor should throw on invalid array key');
  assert_throws_dom('DataError', function() {
    objectStore.openKeyCursor({});
  }, 'openKeyCursor should throw on invalid key type');
  setTimeout(
      t.step_func(function() {
        assert_throws_dom('TransactionInactiveError', function() {
          objectStore.openKeyCursor();
        }, 'openKeyCursor should throw if transaction is inactive');
        t.done();
      }),
      0);
}, 'IDBObjectStore.openKeyCursor() - invalid inputs');
