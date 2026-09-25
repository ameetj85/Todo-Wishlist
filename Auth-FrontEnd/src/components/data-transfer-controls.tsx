"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import {
  type DataKind,
  type ImportMode,
  exportDataAction,
  importDataAction,
} from "@/app/actions/data-transfer";
import { Button } from "@/components/ui/button";

const EXPORT_FORMAT = "todo-wishlist-export";
const EXPORT_VERSION = 1;

// Server actions accept up to 8MB; keep each import request comfortably below that.
const MAX_BATCH_BYTES = 5 * 1024 * 1024;

const FLASH_STORAGE_KEY = "data-transfer-flash";

const KIND_CONFIG: Record<
  DataKind,
  { singular: string; plural: string; fields: string[] }
> = {
  todos: {
    singular: "todo",
    plural: "todos",
    fields: [
      "name",
      "description",
      "category",
      "due_date",
      "completed",
      "remind_me",
      "reminder_date",
      "reminder_sent",
      "created_date",
    ],
  },
  wishlist: {
    singular: "wishlist item",
    plural: "wishlist items",
    fields: [
      "title",
      "description",
      "url",
      "item_image",
      "price",
      "priority",
      "quantity",
      "purchased",
    ],
  },
};

type ExportFile = {
  format: string;
  version: number;
  type: DataKind;
  exported_at: string;
  records: Record<string, unknown>[];
};

type Status = { kind: "success" | "error"; message: string } | null;

type PendingImport = {
  fileName: string;
  records: Record<string, unknown>[];
};

type DataTransferControlsProps = {
  kind: DataKind;
};

function pickFields(record: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(
    fields.filter((field) => field in record).map((field) => [field, record[field]]),
  );
}

function countLabel(kind: DataKind, count: number) {
  const { singular, plural } = KIND_CONFIG[kind];
  return `${count} ${count === 1 ? singular : plural}`;
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseExportFile(kind: DataKind, text: string): PendingImport["records"] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  const file = parsed as Partial<ExportFile> | null;

  if (!file || file.format !== EXPORT_FORMAT || !Array.isArray(file.records)) {
    throw new Error("The selected file is not a Todo/Wishlist export.");
  }

  if (file.type !== kind) {
    const otherLabel = file.type === "todos" ? "Todo" : "Wishlist";
    throw new Error(
      `This file contains ${otherLabel.toLowerCase()} data. Import it from the ${otherLabel} page.`,
    );
  }

  return file.records;
}

// Splits records into batches that each stay under the request size limit.
function toBatches(records: Record<string, unknown>[]) {
  const batches: Record<string, unknown>[][] = [];
  let current: Record<string, unknown>[] = [];
  let currentBytes = 0;

  for (const record of records) {
    const recordBytes = new Blob([JSON.stringify(record)]).size;

    if (recordBytes > MAX_BATCH_BYTES) {
      throw new Error("One of the records in this file is too large to import.");
    }

    if (current.length > 0 && currentBytes + recordBytes > MAX_BATCH_BYTES) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(record);
    currentBytes += recordBytes;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export function DataTransferControls({ kind }: DataTransferControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Show the result of an import that triggered a page reload.
  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(FLASH_STORAGE_KEY);
      if (flash) {
        window.sessionStorage.removeItem(FLASH_STORAGE_KEY);
        setStatus({ kind: "success", message: flash });
      }
    } catch {
      // Session storage unavailable; nothing to show.
    }
  }, []);

  async function handleExport() {
    setStatus(null);
    setIsBusy(true);

    try {
      const result = await exportDataAction(kind);

      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      const exportFile: ExportFile = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        type: kind,
        exported_at: new Date().toISOString(),
        records: result.records.map((record) => pickFields(record, KIND_CONFIG[kind].fields)),
      };

      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`${kind}-export-${date}.json`, exportFile);
      setStatus({
        kind: "success",
        message: `Exported ${countLabel(kind, exportFile.records.length)}.`,
      });
    } catch {
      setStatus({ kind: "error", message: "Unable to export data right now." });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still triggers a change event.
    event.target.value = "";
    if (!file) return;

    setStatus(null);

    try {
      const records = parseExportFile(kind, await file.text());

      if (records.length === 0) {
        setStatus({ kind: "error", message: "The selected file has nothing to import." });
        return;
      }

      setPendingImport({ fileName: file.name, records });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to read the selected file.",
      });
    }
  }

  async function handleImport(mode: ImportMode) {
    if (!pendingImport) return;

    setStatus(null);
    setIsBusy(true);

    let imported = 0;
    let removed = 0;

    try {
      const batches = toBatches(pendingImport.records);

      for (const [index, batch] of batches.entries()) {
        // Only the first batch replaces; the rest append to what was just imported.
        const batchMode: ImportMode = index === 0 ? mode : "append";
        const result = await importDataAction(kind, batchMode, batch);

        if (!result.ok) {
          const prefix = imported > 0 ? `Imported ${countLabel(kind, imported)}, then stopped: ` : "";
          setStatus({ kind: "error", message: `${prefix}${result.error}` });
          if (imported > 0) setPendingImport(null);
          return;
        }

        imported += result.imported;
        removed += result.removed;
      }

      const replacedNote = mode === "replace" ? ` Replaced ${countLabel(kind, removed)}.` : "";
      const message = `Imported ${countLabel(kind, imported)} from ${pendingImport.fileName}.${replacedNote}`;

      try {
        window.sessionStorage.setItem(FLASH_STORAGE_KEY, message);
      } catch {
        // Session storage unavailable; the reload still shows the imported data.
      }

      window.location.reload();
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to import data right now.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  const { plural } = KIND_CONFIG[kind];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={isBusy}
          title={`Download all ${plural} as a JSON file`}
        >
          <Download className="mr-1" />
          Export
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          title={`Import ${plural} from a JSON export file`}
        >
          <Upload className="mr-1" />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      {pendingImport ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="text-foreground">
            Import {countLabel(kind, pendingImport.records.length)} from{" "}
            <span className="font-medium">{pendingImport.fileName}</span>?
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Add</span> keeps your current {plural} and adds these.{" "}
            <span className="font-semibold">Replace</span> deletes all your current {plural} first.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleImport("append")} disabled={isBusy}>
              {isBusy ? "Importing..." : "Add"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleImport("replace")}
              disabled={isBusy}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingImport(null)}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {status ? (
        <p
          role="status"
          className={`text-sm ${status.kind === "success" ? "text-emerald-600" : "text-destructive"}`}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
