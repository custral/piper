"use client";

import {useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {FileArchive, Upload} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {formatBytes} from "@/lib/compression";
import type {CompressionRecord} from "@/types";

interface CompressionToolProps {
  history: CompressionRecord[];
}

export function CompressionTool({history}: CompressionToolProps): React.ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleFile(file: File): Promise<void> {
    setUploading(true);
    setError(undefined);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/compress", {method: "POST", body: formData});
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {error?: string};
        throw new Error(body.error ?? `Compress failed (${res.status}).`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compression failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleFile(file);
  }

  const sorted = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Compress a file</h2>
            <p className="text-sm text-muted-foreground">
              Pick any file. We&apos;ll run it through middle-out compression and report the Weissman score.
            </p>
          </div>
          <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
          <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? "Compressing…" : "Choose file"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent compressions
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compressions yet — upload a file to get started.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((record) => (
              <Card key={record.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileArchive className="h-4 w-4 text-primary" />
                    <span className="truncate">{record.fileName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Original</span>
                    <span>{formatBytes(record.originalBytes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Compressed</span>
                    <span className="font-medium text-primary">{formatBytes(record.compressedBytes)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="secondary">Weissman {record.weissmanScore}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
