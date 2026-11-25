'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const TARGET_BYTES = 90_000_000;
const HARD_BYTES = 95_000_000;
const MARKER = 'archiveManifestSha256';
const ledger = {
  file: 'state/UPSTREAM_LEDGER.json', dir: 'state/upstream-ledger-archive', field: 'entries',
  schema: 'forge.upstream-ledger',
  stub: ['key', 'status', 'company', 'title', 'location', 'url', 'sourceUrl', 'firstSeen', 'createdAt',
    'sources', 'primaryId', 'groups', 'evidenceStatus'],
  settled(entry, activePrimaryIds) {
    if (entry.fence || activePrimaryIds?.has(entry.primaryId)) return false;
    // A worksheet tombstone ends discovery work. Its old evidence status is
    // retained for restore, and active Writer reconciliation lives in the drain.
    const deleted = entry.worksheetDeletion;
    if (entry.status === 'EXCLUDED' && deleted?.schema === 'forge.worksheet-deletion.v1' &&
        deleted.key === entry.key && /^[a-f0-9]{64}$/.test(deleted.receiptId || '')) return true;
    if (/HOLD|HELD|UNKNOWN|SUBMITTED|IN_FLIGHT|TO_SUBMIT|PENDING/.test(entry.evidenceStatus || '')) return false;
    return entry.status === 'EXCLUDED' || (entry.status === 'PRESENT' && Boolean(entry.primaryId));
  }
};
const drain = {
  file: 'state/INTAKE_DRAIN.json', dir: 'state/intake-drain-archive', field: 'items',
  schema: 'forge.intake-drain',
  stub: ['key', 'status', 'aliases', 'firstSeen', 'createdAt', 'sources', 'sourceReferences', 'upstreamStatus',
    'primaryId', 'sourceVersion', 'action', 'taskKey', 'owner'],
  settled(item) { return item.status === 'ACCOUNTED_UPSTREAM' && !item.fence; }
};
const shardName = /^\d{4}-\d{2}-\d{2}(?:-(?:0[2-9]|[1-9]\d+))?\.json$/;
const sha256 = raw => createHash('sha256').update(raw).digest('hex');
const json = value => JSON.stringify(value) + '\n';
const bytes = raw => Buffer.byteLength(raw);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const select = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
const fsReader = root => file => fs.readFileSync(path.join(root, file), 'utf8');
const manifestPath = spec => spec.dir + '/manifest.json';

function archiveError(file, reason, cause) {
  return Object.assign(new Error(`${file}: ${reason}`, {cause}), {code: 'ERR_LEDGER_ARCHIVE'});
}

function archivedJson(read, file, digest) {
  let raw;
  try { raw = read(file); } catch (error) { throw archiveError(file, 'archive file unavailable', error); }
  if (typeof raw !== 'string') throw archiveError(file, 'archive file unavailable');
  if (bytes(raw) >= HARD_BYTES || sha256(raw) !== digest) throw archiveError(file, 'archive size or sha256 mismatch');
  try { return {value: JSON.parse(raw), size: bytes(raw)}; } catch (error) { throw archiveError(file, 'invalid archive JSON', error); }
}

function hydrate(spec, read, value) {
  const shards = [];
  const ids = new Set();
  if (!value || !Object.hasOwn(value, MARKER)) return {value, shards, ids};

  const manifestFile = manifestPath(spec);
  const {value: manifest} = archivedJson(read, manifestFile, value[MARKER]);
  if (manifest?.schema !== spec.schema + '-archive-manifest.v1' || !Array.isArray(manifest.shards) ||
      !manifest.shards.length || !isRecord(value[spec.field])) throw archiveError(manifestFile, 'invalid manifest');

  const records = {...value[spec.field]};
  const names = new Set();
  for (const shard of manifest.shards) {
    if (!shardName.test(shard?.name || '') || names.has(shard.name) || !Number.isSafeInteger(shard.count) || shard.count < 1) {
      throw archiveError(manifestFile, 'invalid shard listing');
    }
    names.add(shard.name);
    const file = spec.dir + '/' + shard.name;
    const {value: body, size} = archivedJson(read, file, shard.sha256);
    if (body?.schema !== spec.schema + '-archive.v1' || !isRecord(body[spec.field]) ||
        Object.keys(body[spec.field]).length !== shard.count) throw archiveError(file, 'invalid shard or count');
    for (const [id, record] of Object.entries(body[spec.field])) {
      if (ids.has(id) || !Object.hasOwn(records, id) || !isRecord(records[id]) ||
          !Array.isArray(record?.fields) || !isRecord(record.detail)) throw archiveError(file, 'invalid archived identity');
      const fields = {...records[id], ...record.detail};
      if (record.fields.length !== Object.keys(fields).length || new Set(record.fields).size !== record.fields.length ||
          !record.fields.every(field => typeof field === 'string' && Object.hasOwn(fields, field))) {
        throw archiveError(file, 'archive fields do not match live stub');
      }
      records[id] = Object.fromEntries(record.fields.map(field => [field, fields[field]]));
      ids.add(id);
    }
    shards.push({...shard, file, bytes: size});
  }
  if (ids.size !== manifest.count) throw archiveError(manifestFile, 'archive identity count mismatch');
  const full = {...value, [spec.field]: records};
  delete full[MARKER];
  return {value: full, shards, ids};
}

function load(spec, read) {
  const raw = read(spec.file);
  return hydrate(spec, read, JSON.parse(raw));
}

function readLocal(spec, root, fallback, proof = false) {
  const read = fsReader(root);
  let raw;
  try { raw = read(spec.file); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) {
      if (fs.existsSync(path.join(root, manifestPath(spec)))) throw archiveError(spec.file, 'archive exists without live file', error);
      return {value: structuredClone(fallback), sha256: null};
    }
    throw error;
  }
  const snapshot = hydrate(spec, read, JSON.parse(raw));
  if (proof) snapshot.sha256 = sha256(raw);
  return snapshot;
}

function day(entry) {
  for (const date of [entry.firstSeen, entry.createdAt]) {
    if (typeof date === 'string' && Number.isFinite(Date.parse(date))) {
      const utc = new Date(date).toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(utc)) return utc;
    }
  }
  // Some legacy ledger captures have no first observation date. The sentinel
  // keeps them in a stable shard without inventing a date in the full record.
  return '1970-01-01';
}

function split(spec, value, {activePrimaryIds, targetBytes = TARGET_BYTES} = {}) {
  if (!isRecord(value) || (Object.hasOwn(value, spec.field) && !isRecord(value[spec.field])) || Object.hasOwn(value, MARKER)) {
    throw Error(`${spec.file}: expected a full inventory`);
  }
  if (!Number.isSafeInteger(targetBytes) || targetBytes < 1 || targetBytes > TARGET_BYTES) throw Error('Invalid archive shard target');

  const files = new Map();
  const byDay = new Map();
  const live = [];
  for (const [id, entry] of Object.entries(value[spec.field] || {})) {
    if (!isRecord(entry) || !spec.settled(entry, activePrimaryIds)) {
      live.push([id, entry]);
      continue;
    }
    const stub = select(entry, spec.stub);
    // Match the legacy JSON writer's omission of transient properties that
    // have no JSON representation. In particular, never index an undefined field.
    const fields = Object.entries(entry).filter(([, value]) =>
      value !== undefined && typeof value !== 'function' && typeof value !== 'symbol');
    const detail = Object.fromEntries(fields.filter(([field]) => !Object.hasOwn(stub, field)));
    if (spec === drain && isRecord(entry.card)) stub.card = select(entry.card, ['company', 'title', 'location', 'url', 'sourceUrl']);
    if (!Object.keys(detail).length) {
      live.push([id, entry]);
      continue;
    }
    const date = day(entry);
    if (!byDay.has(date)) byDay.set(date, new Map());
    byDay.get(date).set(id, {fields: fields.map(([field]) => field), detail});
    live.push([id, stub]);
  }

  const shards = [];
  let count = 0;
  const prefix = `{"schema":"${spec.schema}-archive.v1","${spec.field}":{`;
  const suffix = '}}\n';
  const overhead = bytes(prefix) + bytes(suffix);
  for (const date of [...byDay.keys()].sort()) {
    const records = byDay.get(date);
    let parts = [], size = overhead, part = 1;
    const flush = () => {
      const name = date + (part === 1 ? '' : '-' + String(part).padStart(2, '0')) + '.json';
      const raw = prefix + parts.join(',') + suffix;
      files.set(spec.dir + '/' + name, raw);
      shards.push({name, count: parts.length, sha256: sha256(raw)});
      count += parts.length;
      part++;
      parts = [];
      size = overhead;
    };
    for (const id of [...records.keys()].sort()) {
      const row = JSON.stringify(id) + ':' + JSON.stringify(records.get(id));
      const length = bytes(row);
      if (length + overhead >= HARD_BYTES) throw Error(`${spec.dir}/${date}: a single record exceeds the archive limit`);
      if (parts.length && size + length + 1 > targetBytes) flush();
      size += length + Number(parts.length > 0);
      parts.push(row);
    }
    flush();
  }
  // Preserve input order in the live map and restore per-entry field order. Some
  // consumers select the first match or hash JSON objects from the hydrated data.
  const body = {...value};
  if (Object.hasOwn(value, spec.field)) body[spec.field] = Object.fromEntries(live);
  if (shards.length) {
    const manifest = json({schema: spec.schema + '-archive-manifest.v1', count, shards});
    if (bytes(manifest) >= HARD_BYTES) throw Error(`${manifestPath(spec)}: manifest exceeds the archive limit`);
    files.set(manifestPath(spec), manifest);
    body[MARKER] = sha256(manifest);
  }
  const raw = json(body);
  if (bytes(raw) >= HARD_BYTES) throw Error(`${spec.file}: live inventory exceeds the storage limit`);
  files.set(spec.file, raw);
  return files;
}

function write(spec, root, value, options) {
  const state = path.join(root, 'state');
  fs.mkdirSync(state, {recursive: true});
  const transaction = path.join(state, '.' + path.basename(spec.dir) + '-write');
  fs.mkdirSync(transaction); // One writer per inventory in a worktree.
  let clean = true;
  try {
    const files = split(spec, value, options);
    const dir = path.join(root, spec.dir);
    if (files.has(manifestPath(spec))) fs.mkdirSync(dir, {recursive: true});
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const file = spec.dir + '/' + name;
        if ((name === 'manifest.json' || shardName.test(name)) && !files.has(file)) files.set(file, null);
      }
    }
    const changes = [];
    for (const [file, raw] of files) {
      const dest = path.join(root, file);
      const exists = fs.existsSync(dest);
      if (exists && raw !== null && fs.readFileSync(dest, 'utf8') === raw) continue;
      const staged = path.join(transaction, changes.length + '.new');
      const backup = path.join(transaction, changes.length + '.old');
      if (exists) fs.linkSync(dest, backup);
      if (raw !== null) fs.writeFileSync(staged, raw, {flush: true});
      changes.push({file, dest, staged, backup, exists, remove: raw === null});
    }
    fs.writeFileSync(path.join(transaction, 'files.json'), json(changes.map(({file, exists, remove}) => ({file, exists, remove}))), {flush: true});
    const applied = [];
    try {
      for (const change of changes) {
        if (change.remove) fs.unlinkSync(change.dest);
        else fs.renameSync(change.staged, change.dest);
        applied.push(change);
      }
    } catch (error) {
      clean = false;
      for (const change of applied.reverse()) {
        if (change.exists) fs.renameSync(change.backup, change.dest);
        else fs.unlinkSync(change.dest);
      }
      clean = true;
      throw error;
    }
  } finally {
    if (clean) fs.rmSync(transaction, {recursive: true, force: true});
  }
}

function activeIds(index) {
  return new Set([...(index?.ids?.enrichment || []), ...(index?.ids?.decision || [])]);
}

function writeLedger(root, value, options = {}) {
  if (options.activePrimaryIds === undefined) {
    const file = path.join(root, 'state/PIPELINE_WAITING_QUEUES.json');
    let index;
    try { index = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    options = {...options, activePrimaryIds: activeIds(index)};
  }
  write(ledger, root, value, options);
}

module.exports = {
  LEDGER_PATH: ledger.file, LEDGER_ARCHIVE: ledger.dir, DRAIN_PATH: drain.file, DRAIN_ARCHIVE: drain.dir, HARD_BYTES,
  readLedger: (root, fallback) => readLocal(ledger, root, fallback).value,
  readDrain: (root, fallback) => readLocal(drain, root, fallback).value,
  readLedgerSource: (root, fallback) => readLocal(ledger, root, fallback, true),
  loadLedger: read => load(ledger, read),
  loadDrain: read => load(drain, read),
  hydrateDrain: (read, value) => hydrate(drain, read, value).value,
  splitLedger: (value, options) => split(ledger, value, options),
  splitDrain: (value, options) => split(drain, value, options),
  writeLedger,
  writeDrain: (root, value, options) => write(drain, root, value, options),
  activeIds
};
