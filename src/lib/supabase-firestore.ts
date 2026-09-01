import { randomBytes } from "crypto";
import { FieldPath } from "firebase-admin/firestore";
import { getSupabaseAdmin } from "./supabase-admin";

type DocData = Record<string, unknown>;

export class SupabaseDocumentAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`Document ${path} already exists.`);
    this.name = "SupabaseDocumentAlreadyExistsError";
  }
}

function isFieldDeleteSentinel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const method = String((value as { _methodName?: unknown })._methodName || "");
  if (method === "FieldValue.delete" || method === "DeleteFieldValue") return true;
  return Object.keys(value as object).length === 0;
}

/** Strip Firestore delete sentinels and apply deletions on merge payloads. */
function sanitizeFirestorePayload(data: DocData): { payload: DocData; deleteKeys: string[] } {
  const payload: DocData = {};
  const deleteKeys: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (isFieldDeleteSentinel(value)) {
      deleteKeys.push(key);
      continue;
    }
    payload[key] = value;
  }
  return { payload, deleteKeys };
}

function generateDocId() {
  return randomBytes(12).toString("hex");
}

function deepMerge(target: DocData, source: DocData): DocData {
  const out: DocData = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key] as DocData, value as DocData);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isDocumentIdField(field: unknown) {
  if (field instanceof FieldPath) {
    try {
      return field.isEqual(FieldPath.documentId());
    } catch {
      return false;
    }
  }
  return false;
}

function fieldValue(data: DocData, field: string, docId: string) {
  if (field === "__doc_id__") return docId;
  return data[field];
}

type WhereClause = { field: string; op: string; value: unknown };
type OrderClause = { field: string; direction: "asc" | "desc" };

class SupabaseDocumentReference {
  constructor(
    readonly db: SupabaseFirestore,
    readonly collectionPath: string,
    readonly id: string,
  ) {}

  get path() {
    return `${this.collectionPath}/${this.id}`;
  }

  collection(name: string) {
    return new SupabaseCollectionReference(this.db, `${this.collectionPath}/${this.id}/${name}`);
  }

  async get() {
    return this.db.getDoc(this.path, this.collectionPath, this.id);
  }

  async set(data: DocData, options?: { merge?: boolean }) {
    await this.db.setDoc(this.path, this.collectionPath, this.id, data, options?.merge === true);
  }

  async update(data: DocData) {
    await this.db.updateDoc(this.path, this.collectionPath, this.id, data);
  }

  async delete() {
    await this.db.deleteDoc(this.path);
  }
}

class SupabaseQuery {
  private wheres: WhereClause[] = [];
  private orders: OrderClause[] = [];
  private limitCount: number | null = null;
  private startAtValue: unknown = undefined;
  private endAtValue: unknown = undefined;
  private startAfterValue: unknown = undefined;

  constructor(
    readonly db: SupabaseFirestore,
    readonly collectionPath: string,
  ) {}

  where(field: string, op: string, value: unknown) {
    this.wheres.push({ field, op, value });
    return this;
  }

  orderBy(field: string | FieldPath, direction: "asc" | "desc" = "asc") {
    const fieldName = isDocumentIdField(field) ? "__doc_id__" : String(field);
    this.orders.push({ field: fieldName, direction });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  startAt(value: unknown) {
    this.startAtValue = value;
    return this;
  }

  endAt(value: unknown) {
    this.endAtValue = value;
    return this;
  }

  startAfter(value: unknown) {
    this.startAfterValue = value;
    return this;
  }

  async get() {
    return this.db.runQuery(this.collectionPath, this);
  }

  exportState() {
    return {
      wheres: this.wheres,
      orders: this.orders,
      limitCount: this.limitCount,
      startAtValue: this.startAtValue,
      endAtValue: this.endAtValue,
      startAfterValue: this.startAfterValue,
    };
  }
}

class SupabaseCollectionReference extends SupabaseQuery {
  constructor(db: SupabaseFirestore, collectionPath: string) {
    super(db, collectionPath);
  }

  doc(id?: string) {
    const docId = String(id || "").trim() || generateDocId();
    return new SupabaseDocumentReference(this.db, this.collectionPath, docId);
  }

  async add(data: DocData) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class SupabaseDocumentSnapshot {
  constructor(
    readonly id: string,
    readonly exists: boolean,
    private readonly payload: DocData | null,
    readonly ref: SupabaseDocumentReference,
  ) {}

  data() {
    return this.payload ? { ...this.payload } : undefined;
  }
}

export class SupabaseQuerySnapshot {
  constructor(readonly docs: SupabaseDocumentSnapshot[]) {}

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }
}

class SupabaseTransaction {
  private writes: Array<
    | { type: "set"; ref: SupabaseDocumentReference; data: DocData; merge: boolean }
    | { type: "delete"; ref: SupabaseDocumentReference }
  > = [];

  constructor(private readonly db: SupabaseFirestore) {}

  async get(ref: SupabaseDocumentReference) {
    return ref.get();
  }

  set(ref: SupabaseDocumentReference, data: DocData, options?: { merge?: boolean }) {
    this.writes.push({ type: "set", ref, data, merge: options?.merge === true });
  }

  update(ref: SupabaseDocumentReference, data: DocData) {
    this.writes.push({ type: "set", ref, data, merge: true });
  }

  delete(ref: SupabaseDocumentReference) {
    this.writes.push({ type: "delete", ref });
  }

  async commit() {
    for (const write of this.writes) {
      if (write.type === "delete") {
        await write.ref.delete();
        continue;
      }
      await write.ref.set(write.data, { merge: write.merge });
    }
  }
}

class SupabaseWriteBatch {
  private ops: Array<
    | { type: "set"; path: string; collectionPath: string; id: string; data: DocData; merge: boolean }
    | { type: "update"; path: string; collectionPath: string; id: string; data: DocData }
    | { type: "delete"; path: string }
  > = [];

  constructor(private readonly db: SupabaseFirestore) {}

  set(ref: SupabaseDocumentReference, data: DocData, options?: { merge?: boolean }) {
    this.ops.push({
      type: "set",
      path: ref.path,
      collectionPath: ref.collectionPath,
      id: ref.id,
      data,
      merge: options?.merge === true,
    });
    return this;
  }

  update(ref: SupabaseDocumentReference, data: DocData) {
    this.ops.push({
      type: "update",
      path: ref.path,
      collectionPath: ref.collectionPath,
      id: ref.id,
      data,
    });
    return this;
  }

  delete(ref: SupabaseDocumentReference) {
    this.ops.push({ type: "delete", path: ref.path });
    return this;
  }

  async commit() {
    for (const op of this.ops) {
      if (op.type === "set") {
        await this.db.setDoc(op.path, op.collectionPath, op.id, op.data, op.merge);
      } else if (op.type === "update") {
        await this.db.updateDoc(op.path, op.collectionPath, op.id, op.data);
      } else {
        await this.db.deleteDoc(op.path);
      }
    }
  }
}

export class SupabaseFirestore {
  collection(name: string) {
    return new SupabaseCollectionReference(this, name);
  }

  batch() {
    return new SupabaseWriteBatch(this);
  }

  async getAll(...refs: SupabaseDocumentReference[]) {
    const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
    return Promise.all(unique.map((ref) => ref.get()));
  }

  async getDoc(path: string, collectionPath: string, id: string) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase not configured.");

    const { data, error } = await client
      .from("app_documents")
      .select("data")
      .eq("path", path)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const ref = new SupabaseDocumentReference(this, collectionPath, id);
    if (!data) return new SupabaseDocumentSnapshot(id, false, null, ref);
    return new SupabaseDocumentSnapshot(id, true, (data.data || {}) as DocData, ref);
  }

  async setDoc(
    path: string,
    collectionPath: string,
    id: string,
    data: DocData,
    merge: boolean,
  ) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase not configured.");
    if (!id.trim()) throw new Error("Document id is required.");

    const { payload: sanitized, deleteKeys } = sanitizeFirestorePayload(data);
    let payload = sanitized;
    if (merge) {
      const existing = await this.getDoc(path, collectionPath, id);
      payload = deepMerge((existing.data() || {}) as DocData, sanitized);
      for (const key of deleteKeys) {
        delete payload[key];
      }
    }

    const row = {
      path,
      collection_path: collectionPath,
      doc_id: id,
      data: payload,
      updated_at: new Date().toISOString(),
    };

    if (!merge) {
      const { error } = await client.from("app_documents").insert(row);
      if (error?.code === "23505") {
        throw new SupabaseDocumentAlreadyExistsError(path);
      }
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await client.from("app_documents").upsert(row);
    if (error) throw new Error(error.message);
  }

  async updateDoc(path: string, collectionPath: string, id: string, data: DocData) {
    const existing = await this.getDoc(path, collectionPath, id);
    if (!existing.exists) throw new Error(`Document ${path} not found.`);
    await this.setDoc(path, collectionPath, id, data, true);
  }

  async deleteDoc(path: string) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase not configured.");
    const { error } = await client.from("app_documents").delete().eq("path", path);
    if (error) throw new Error(error.message);
  }

  async runQuery(collectionPath: string, query: SupabaseQuery) {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("Supabase not configured.");

    const { data, error } = await client
      .from("app_documents")
      .select("path, doc_id, data")
      .eq("collection_path", collectionPath);

    if (error) throw new Error(error.message);

    const state = query.exportState();
    let rows = (data || []).map((row) => ({
      id: String(row.doc_id),
      path: String(row.path),
      data: (row.data || {}) as DocData,
    }));

    rows = rows.filter((row) => matchWheres(row.data, row.id, state.wheres));

    if (state.orders.length) {
      rows.sort((a, b) => compareRows(a, b, state.orders));
    } else {
      rows.sort((a, b) => a.id.localeCompare(b.id));
    }

    if (state.startAtValue !== undefined) {
      const field = state.orders[0]?.field || "__doc_id__";
      rows = rows.filter((row) => compareValue(row, field, state.startAtValue) >= 0);
    }
    if (state.endAtValue !== undefined) {
      const field = state.orders[0]?.field || "__doc_id__";
      rows = rows.filter((row) => compareValue(row, field, state.endAtValue) <= 0);
    }
    if (state.startAfterValue !== undefined) {
      const field = state.orders[0]?.field || "__doc_id__";
      rows = rows.filter((row) => compareValue(row, field, state.startAfterValue) > 0);
    }

    if (state.limitCount != null) {
      rows = rows.slice(0, state.limitCount);
    }

    const docs = rows.map((row) => {
      const ref = new SupabaseDocumentReference(this, collectionPath, row.id);
      return new SupabaseDocumentSnapshot(row.id, true, row.data, ref);
    });

    return new SupabaseQuerySnapshot(docs);
  }

  async runTransaction<T>(updateFunction: (tx: SupabaseTransaction) => Promise<T>): Promise<T> {
    const tx = new SupabaseTransaction(this);
    const result = await updateFunction(tx);
    await tx.commit();
    return result;
  }
}

function matchWheres(data: DocData, docId: string, wheres: WhereClause[]) {
  for (const clause of wheres) {
    const value = fieldValue(data, clause.field, docId);
    if (clause.op === "==") {
      if (value !== clause.value) return false;
    } else if (clause.op === "in") {
      if (!Array.isArray(clause.value) || !clause.value.includes(value)) return false;
    } else if (clause.op === ">=") {
      if (String(value ?? "") < String(clause.value ?? "")) return false;
    } else if (clause.op === "<=") {
      if (String(value ?? "") > String(clause.value ?? "")) return false;
    } else if (clause.op === "<") {
      if (String(value ?? "") >= String(clause.value ?? "")) return false;
    } else if (clause.op === ">") {
      if (String(value ?? "") <= String(clause.value ?? "")) return false;
    }
  }
  return true;
}

function compareValue(row: { data: DocData; id: string }, field: string, target: unknown) {
  const left = field === "__doc_id__" ? row.id : row.data[field];
  return String(left ?? "").localeCompare(String(target ?? ""));
}

function compareRows(
  a: { data: DocData; id: string },
  b: { data: DocData; id: string },
  orders: OrderClause[],
) {
  for (const order of orders) {
    const left =
      order.field === "__doc_id__"
        ? a.id.localeCompare(b.id)
        : String(fieldValue(a.data, order.field, a.id) ?? "").localeCompare(
            String(fieldValue(b.data, order.field, b.id) ?? ""),
          );
    if (left !== 0) return order.direction === "desc" ? -left : left;
  }
  return 0;
}

let supabaseFirestore: SupabaseFirestore | null = null;

export function getSupabaseFirestore() {
  if (!supabaseFirestore) supabaseFirestore = new SupabaseFirestore();
  return supabaseFirestore;
}
