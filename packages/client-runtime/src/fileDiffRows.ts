import type { FileDiffMetadata } from "@pierre/diffs";

export interface DiffRow {
  readonly kind: "context" | "addition" | "deletion";
  readonly oldLine: number | null;
  readonly newLine: number | null;
  readonly oldAt: number;
  readonly newAt: number;
  readonly text: string;
  readonly hunk: number;
}

export function fileDiffRows(file: FileDiffMetadata): ReadonlyArray<DiffRow> {
  const rows: DiffRow[] = [];
  file.hunks.forEach((hunk, hunkIndex) => {
    let oldAt = hunk.deletionStart;
    let newAt = hunk.additionStart;
    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        for (let offset = 0; offset < content.lines; offset += 1) {
          rows.push({
            kind: "context",
            oldLine: oldAt,
            newLine: newAt,
            oldAt,
            newAt,
            text: file.additionLines[content.additionLineIndex + offset] ?? "",
            hunk: hunkIndex,
          });
          oldAt += 1;
          newAt += 1;
        }
        continue;
      }
      for (let offset = 0; offset < content.deletions; offset += 1) {
        rows.push({
          kind: "deletion",
          oldLine: oldAt,
          newLine: null,
          oldAt,
          newAt,
          text: file.deletionLines[content.deletionLineIndex + offset] ?? "",
          hunk: hunkIndex,
        });
        oldAt += 1;
      }
      for (let offset = 0; offset < content.additions; offset += 1) {
        rows.push({
          kind: "addition",
          oldLine: null,
          newLine: newAt,
          oldAt,
          newAt,
          text: file.additionLines[content.additionLineIndex + offset] ?? "",
          hunk: hunkIndex,
        });
        newAt += 1;
      }
    }
  });
  return rows;
}
