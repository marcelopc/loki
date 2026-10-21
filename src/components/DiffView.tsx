// Center pane (lower half): side-by-side diff renderer for the selected file.

import { useMemo } from "react";
import { useRepo } from "../state/RepoContext";
import type { DiffHunk, DiffLine, FileDiff } from "../types";

export function DiffView() {
  const { currentDiff, diffScope, repo } = useRepo();
  if (!currentDiff || !diffScope || !repo) {
    return <div className="diff-pane card">Selecione um arquivo nas mudanças para ver o diff.</div>;
  }
  return (
    <div className="diff-pane card">
      <div className="diff-header">
        {diffScope === "staged" ? "Alterações staged" : "Alterações no working tree"}
      </div>
      {currentDiff.length === 0 ? (
        <div className="diff-empty">Sem diferenças.</div>
      ) : (
        <div className="diff-files">
          {currentDiff.map((f) => (
            <FileDiffView key={f.path} diff={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileDiffView({ diff }: { diff: FileDiff }) {
  const title = diff.oldPath && diff.oldPath !== diff.path
    ? `${diff.oldPath} → ${diff.path}`
    : diff.path;
  return (
    <div className="file-diff">
      <div className="file-diff-head">
        {diff.status} · {title}
      </div>
      {diff.isBinary ? (
        <div className="binary">Arquivo binário — diff não exibido.</div>
      ) : diff.hunks.length === 0 ? (
        <div className="file-diff-empty">Conteúdo sem alteração textual.</div>
      ) : (
        diff.hunks.map((h, i) => <Hunk key={i} hunk={h} />)
      )}
    </div>
  );
}

function Hunk({ hunk }: { hunk: DiffHunk }) {
  const lines = useMemo(() => buildSideBySide(hunk.lines), [hunk]);
  return (
    <div className="hunk">
      <div className="hunk-header">{hunk.header}</div>
      <table className="sidetable">
        <tbody>
          {lines.map((row, i) => (
            <tr key={i} className={`line row-${row.kind}`}>
              <td className="ln old">{row.oldLn === null ? "" : row.oldLn}</td>
              <td className={`code old ${row.oldText ? "" : "empty"}`}>{row.oldText || ""}</td>
              <td className="ln new">{row.newLn === null ? "" : row.newLn}</td>
              <td className={`code new ${row.newText ? "" : "empty"}`}>{row.newText || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Renders a context/del/add diff into side-by-side rows. A "replacement"
// (`-` immediately followed by `+`) is shown as one row with the del on the
// left column and the add on the right; a pure add/del occupies the matching
// column alone; context spans both columns.
interface SideRow {
  kind: "context" | "add" | "del" | "replace";
  oldLn: number | null;
  oldText: string;
  newLn: number | null;
  newText: string;
}

function buildSideBySide(lines: DiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.kind === "context") {
      rows.push({
        kind: "context",
        oldLn: l.oldLn ?? null,
        oldText: l.text,
        newLn: l.newLn ?? null,
        newText: l.text,
      });
      i++;
    } else if (l.kind === "del") {
      // Peek ahead for a matching add -> replacement pair.
      if (i + 1 < lines.length && lines[i + 1].kind === "add") {
        rows.push({
          kind: "replace",
          oldLn: l.oldLn ?? null,
          oldText: l.text,
          newLn: lines[i + 1].newLn ?? null,
          newText: lines[i + 1].text,
        });
        i += 2;
      } else {
        rows.push({
          kind: "del",
          oldLn: l.oldLn ?? null,
          oldText: l.text,
          newLn: null,
          newText: "",
        });
        i++;
      }
    } else {
      // add
      rows.push({
        kind: "add",
        oldLn: null,
        oldText: "",
        newLn: l.newLn ?? null,
        newText: l.text,
      });
      i++;
    }
  }
  return rows;
}