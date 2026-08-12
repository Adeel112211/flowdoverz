import { createReadStream, existsSync, statSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = {
  pc: "pc-guide.mp4",
  mobile: "mobile-guide.mp4",
} as const;

function contentTypeFor(fileName: string) {
  if (fileName.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export async function GET(request: NextRequest) {
  const device = String(request.nextUrl.searchParams.get("device") || "pc").toLowerCase();
  const fileName = ALLOWED[device as keyof typeof ALLOWED];
  if (!fileName) {
    return NextResponse.json({ success: false, error: "Unknown video." }, { status: 404 });
  }

  const filePath = join(process.cwd(), "public", "install", fileName);
  if (!existsSync(filePath)) {
    return NextResponse.json({ success: false, error: "Video not found." }, { status: 404 });
  }

  const stat = statSync(filePath);
  const size = stat.size;
  const range = request.headers.get("range");
  const type = contentTypeFor(fileName);

  const commonHeaders: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600, immutable",
    "Content-Disposition": `inline; filename="${fileName}"`,
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...commonHeaders, "Content-Range": `bytes */${size}` },
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end >= size ||
      start > end
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...commonHeaders, "Content-Range": `bytes */${size}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(size),
    },
  });
}
