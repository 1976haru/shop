import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DiagnosisReport } from "../../../packages/core/src/types.ts";

export class RunStore {
  db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      filename TEXT NOT NULL,
      input_csv TEXT NOT NULL,
      report_json TEXT NOT NULL
    )`);
  }
  save(report: DiagnosisReport, csv: string): void {
    this.db.prepare(`INSERT OR REPLACE INTO runs(id,created_at,filename,input_csv,report_json) VALUES(?,?,?,?,?)`)
      .run(report.run.id, report.generatedAt, report.run.inputFilename, csv, JSON.stringify(report));
  }
  list(): Array<{ id: string; createdAt: string; filename: string; summary: DiagnosisReport["summary"] }> {
    return this.db.prepare(`SELECT id,created_at,filename,report_json FROM runs ORDER BY created_at DESC LIMIT 100`).all()
      .map((row: any) => ({ id: row.id, createdAt: row.created_at, filename: row.filename,
        summary: (JSON.parse(row.report_json) as DiagnosisReport).summary }));
  }
  get(id: string): { report: DiagnosisReport; csv: string } | undefined {
    const row: any = this.db.prepare(`SELECT input_csv,report_json FROM runs WHERE id=?`).get(id);
    return row ? { csv: row.input_csv, report: JSON.parse(row.report_json) } : undefined;
  }
  delete(id: string): boolean {
    return Number(this.db.prepare(`DELETE FROM runs WHERE id=?`).run(id).changes) > 0;
  }
}
