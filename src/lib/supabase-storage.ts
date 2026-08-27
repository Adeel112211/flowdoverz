import { getSupabaseAdmin, STORAGE_BUCKETS } from "./supabase-admin";

export async function uploadSupabaseBlob(
  bucket: string,
  objectPath: string,
  buffer: Buffer,
  contentType: string,
) {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured.");

  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return `${bucket}/${objectPath}`;
}

export async function downloadSupabaseBlob(storagePath: string): Promise<Buffer | null> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured.");

  const slash = storagePath.indexOf("/");
  if (slash <= 0) return null;
  const bucket = storagePath.slice(0, slash);
  const objectPath = storagePath.slice(slash + 1);

  const { data, error } = await client.storage.from(bucket).download(objectPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteSupabaseBlob(storagePath: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured.");

  const slash = storagePath.indexOf("/");
  if (slash <= 0) return;
  const bucket = storagePath.slice(0, slash);
  const objectPath = storagePath.slice(slash + 1);

  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) throw new Error(error.message);
}

export { STORAGE_BUCKETS };
