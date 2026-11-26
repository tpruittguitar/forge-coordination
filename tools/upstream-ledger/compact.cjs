'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {parseArgs, isDeepStrictEqual} = require('node:util');
const Store = require('./store.cjs');

function compact(root, check) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const inventories = [
    [Store.LEDGER_PATH, 'entries', Store.loadLedger, Store.writeLedger, Store.splitLedger],
    [Store.DRAIN_PATH, 'items', Store.loadDrain, Store.writeDrain, Store.splitDrain],
    [Store.RECOVERY_PATH, 'jobs', Store.loadRecovery, Store.writeRecovery, Store.splitRecovery]
  ];
  let index;
  try { index = JSON.parse(read('state/PIPELINE_WAITING_QUEUES.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const options = {activePrimaryIds: Store.activeIds(index)};

  for (const [file, field, load, write, split] of inventories) {
    if (file === Store.RECOVERY_PATH && !fs.existsSync(path.join(root, file))) continue;
    const original = load(read).value;
    if (!original?.[field] || Array.isArray(original[field])) throw Error(file + ': inventory is missing');
    if (check) {
      const expected = split(original, options);
      const comparison = load(name => expected.get(name));
      if (!isDeepStrictEqual(original, comparison.value)) throw Error(file + ': round-trip check failed');
    } else {
      write(root, original, options);
    }
    const {value, ids, shards} = load(read);
    const live = read(file);
    const liveIds = Object.keys(JSON.parse(live)[field]);
    if (!isDeepStrictEqual(original, value) ||
        !isDeepStrictEqual(Object.keys(original[field]), liveIds) ||
        [...ids].some(id => !Object.hasOwn(original[field], id)) ||
        shards.reduce((sum, shard) => sum + shard.count, 0) !== ids.size ||
        Buffer.byteLength(live) >= Store.HARD_BYTES) throw Error(file + ': round-trip or size check failed');
    console.log(`${file} ${Buffer.byteLength(live)} bytes, ${liveIds.length} ${field}, ${ids.size} archived`);
    if (value.groups) console.log(`  ${Object.keys(value.groups).length} groups`);
    for (const shard of shards) console.log(`  ${shard.name} ${shard.bytes} bytes, ${shard.count} ${field}`);
  }
}

if (require.main === module) {
  try {
    const {values} = parseArgs({options: {root: {type: 'string'}, check: {type: 'boolean'}}});
    compact(path.resolve(values.root || process.cwd()), values.check);
  } catch (error) {
    // A JSON syntax error can include excerpts from the input. Keep those out of logs.
    console.error(error instanceof SyntaxError ? 'Invalid inventory JSON' : error.message);
    process.exitCode = 1;
  }
}
