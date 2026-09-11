"""Observe indexes, real parent deletion plans, and FK enforcement in memory."""
import json
from pathlib import Path
import sqlite3
import sys

SCHEMA = '''
PRAGMA foreign_keys = ON;
CREATE TABLE parent (id INTEGER PRIMARY KEY);
CREATE TABLE child (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES parent(id)
);
'''
ADD_INDEX = 'CREATE INDEX child_parent_idx ON child(parent_id)'
records = []
for indexed in [False, True]:
    db = sqlite3.connect(':memory:', autocommit=True)
    db.executescript(SCHEMA)
    if indexed:
        db.execute(ADD_INDEX)
    db.executemany('INSERT INTO parent VALUES (?)', [(x,) for x in range(1, 102)])
    db.executemany('INSERT INTO child VALUES (?, ?)', [(x, x % 100 + 1) for x in range(10000)])
    foreign_keys = db.execute('PRAGMA foreign_keys').fetchone()[0]
    parent_indexes = db.execute('PRAGMA index_list(parent)').fetchall()
    child_indexes = db.execute('PRAGMA index_list(child)').fetchall()
    select_plan = db.execute('EXPLAIN QUERY PLAN SELECT rowid FROM child WHERE parent_id = 1').fetchall()
    delete_plan = db.execute('EXPLAIN QUERY PLAN DELETE FROM parent WHERE id = 101').fetchall()
    assert foreign_keys == 1 and not parent_indexes
    assert len(child_indexes) == int(indexed)
    expected = 'USING COVERING INDEX child_parent_idx' if indexed else 'SCAN child'
    assert any(expected in row[3] for row in select_plan)
    assert any(expected in row[3] for row in delete_plan)
    errors = {}
    for name, sql in [('delete-referenced-parent', 'DELETE FROM parent WHERE id = 1'), ('insert-missing-parent', 'INSERT INTO child VALUES (10001, 999)')]:
        try: db.execute(sql)
        except sqlite3.IntegrityError as error: errors[name] = str(error)
        else: raise AssertionError(name)
    assert all(message == 'FOREIGN KEY constraint failed' for message in errors.values())
    assert db.execute('DELETE FROM parent WHERE id = 101').rowcount == 1
    assert db.execute('SELECT count(*) FROM child WHERE parent_id = 1').fetchone()[0] == 100
    records.append({'name': 'indexed' if indexed else 'foreign-key-only', 'foreignKeys': foreign_keys,
                    'parentIndexes': parent_indexes, 'childIndexes': child_indexes, 'selectPlan': select_plan,
                    'deletePlan': delete_plan, 'errors': errors, 'unreferencedParentDeleted': True, 'matchingChildren': 100})
    db.close()

db = sqlite3.connect(':memory:', autocommit=True)
db.executescript('PRAGMA foreign_keys=ON; CREATE TABLE parent(code TEXT UNIQUE); CREATE TABLE child(code TEXT REFERENCES parent(code));')
parent = db.execute('PRAGMA index_list(parent)').fetchall()
child = db.execute('PRAGMA index_list(child)').fetchall()
assert len(parent) == 1 and parent[0][3] == 'u' and child == []
records.append({'name': 'unique-parent', 'parentIndexes': parent, 'childIndexes': child})
db.close()

db = sqlite3.connect(':memory:', autocommit=True)
db.executescript(SCHEMA + ADD_INDEX + '; PRAGMA foreign_keys=OFF;')
db.execute('INSERT INTO child VALUES (1, 999)')
assert db.execute('PRAGMA foreign_keys').fetchone()[0] == 0
assert db.execute('SELECT count(*) FROM child').fetchone()[0] == 1
violations = db.execute('PRAGMA foreign_key_check').fetchall()
assert len(violations) == 1
records.append({'name': 'index-with-enforcement-off', 'foreignKeys': 0, 'orphanInserted': True, 'foreignKeyCheck': violations})
db.close()

result = {'environment': {'python': sys.version.split()[0], 'sqlite': sqlite3.sqlite_version},
          'parents': 101, 'children': 10000, 'records': records}
out = Path(__file__).resolve().parents[2] / 'production/2026-09/batch-10/sqlite-results.json'
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
