import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DiagnosisReport } from "../../../packages/core/src/types.ts";
import { agentRunSchema, type AgentRun } from "../../../packages/agent/src/schema.ts";
import {
  hybridCampaignSchema,
  type HybridCampaign
} from "../../../packages/campaign/src/schema.ts";

interface DiagnosisRow {
  id: string;
  created_at: string;
  filename: string;
  input_csv: string;
  report_json: string;
}

interface AgentRow {
  id: string;
  created_at: string;
  theme: string;
  execution_status: string;
  approval_status: string;
  run_json: string;
}

interface CampaignRow {
  id: string;
  created_at: string;
  updated_at: string;
  approval_status: string;
  product_title: string;
  campaign_json: string;
}

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
    this.db.exec(`CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      theme TEXT NOT NULL,
      execution_status TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      run_json TEXT NOT NULL
    )`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      product_title TEXT NOT NULL,
      campaign_json TEXT NOT NULL
    )`);
  }

  save(report: DiagnosisReport, csv: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO runs(id,created_at,filename,input_csv,report_json) VALUES(?,?,?,?,?)`
      )
      .run(
        report.run.id,
        report.generatedAt,
        report.run.inputFilename,
        csv,
        JSON.stringify(report)
      );
  }

  list(): Array<{
    id: string;
    createdAt: string;
    filename: string;
    summary: DiagnosisReport["summary"];
  }> {
    return (this.db
      .prepare(
        `SELECT id,created_at,filename,input_csv,report_json FROM runs ORDER BY created_at DESC LIMIT 100`
      )
      .all() as unknown as DiagnosisRow[]).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      filename: row.filename,
      summary: (JSON.parse(row.report_json) as DiagnosisReport).summary
    }));
  }

  get(id: string): { report: DiagnosisReport; csv: string } | undefined {
    const row = this.db
      .prepare(`SELECT id,created_at,filename,input_csv,report_json FROM runs WHERE id=?`)
      .get(id) as unknown as DiagnosisRow | undefined;
    return row
      ? {
          csv: row.input_csv,
          report: JSON.parse(row.report_json) as DiagnosisReport
        }
      : undefined;
  }

  delete(id: string): boolean {
    return Number(this.db.prepare(`DELETE FROM runs WHERE id=?`).run(id).changes) > 0;
  }

  saveAgentRun(run: AgentRun): void {
    const parsed = agentRunSchema.parse(run);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO agent_runs(id,created_at,theme,execution_status,approval_status,run_json) VALUES(?,?,?,?,?,?)`
      )
      .run(
        parsed.id,
        parsed.createdAt,
        parsed.theme,
        parsed.executionStatus,
        parsed.approvalStatus,
        JSON.stringify(parsed)
      );
  }

  listAgentRuns(): Array<{
    id: string;
    createdAt: string;
    theme: AgentRun["theme"];
    executionStatus: AgentRun["executionStatus"];
    approvalStatus: AgentRun["approvalStatus"];
    summary: AgentRun["summary"];
  }> {
    return (this.db
      .prepare(
        `SELECT id,created_at,theme,execution_status,approval_status,run_json FROM agent_runs ORDER BY created_at DESC LIMIT 100`
      )
      .all() as unknown as AgentRow[]).map((row) => {
      const run = agentRunSchema.parse(JSON.parse(row.run_json));
      return {
        id: row.id,
        createdAt: row.created_at,
        theme: run.theme,
        executionStatus: run.executionStatus,
        approvalStatus: run.approvalStatus,
        summary: run.summary
      };
    });
  }

  getAgentRun(id: string): AgentRun | undefined {
    const row = this.db
      .prepare(
        `SELECT id,created_at,theme,execution_status,approval_status,run_json FROM agent_runs WHERE id=?`
      )
      .get(id) as unknown as AgentRow | undefined;
    return row ? agentRunSchema.parse(JSON.parse(row.run_json)) : undefined;
  }

  deleteAgentRun(id: string): boolean {
    return Number(this.db.prepare(`DELETE FROM agent_runs WHERE id=?`).run(id).changes) > 0;
  }

  saveCampaign(campaign: HybridCampaign): void {
    const parsed = hybridCampaignSchema.parse(campaign);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO campaigns(id,created_at,updated_at,approval_status,product_title,campaign_json) VALUES(?,?,?,?,?,?)`
      )
      .run(
        parsed.id,
        parsed.createdAt,
        parsed.updatedAt,
        parsed.approvalStatus,
        parsed.input.product.title,
        JSON.stringify(parsed)
      );
  }

  listCampaigns(): Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    approvalStatus: HybridCampaign["approvalStatus"];
    campaignName: string;
    productTitle: string;
    channels: HybridCampaign["input"]["channels"];
    creativeCount: number;
    performanceCount: number;
    insight: HybridCampaign["insight"];
  }> {
    return (this.db
      .prepare(
        `SELECT id,created_at,updated_at,approval_status,product_title,campaign_json FROM campaigns ORDER BY updated_at DESC LIMIT 100`
      )
      .all() as unknown as CampaignRow[]).map((row) => {
      const campaign = hybridCampaignSchema.parse(JSON.parse(row.campaign_json));
      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        approvalStatus: campaign.approvalStatus,
        campaignName: campaign.input.campaignName,
        productTitle: row.product_title,
        channels: campaign.input.channels,
        creativeCount: campaign.creatives.length,
        performanceCount: campaign.performanceSnapshots.length,
        insight: campaign.insight
      };
    });
  }

  getCampaign(id: string): HybridCampaign | undefined {
    const row = this.db
      .prepare(
        `SELECT id,created_at,updated_at,approval_status,product_title,campaign_json FROM campaigns WHERE id=?`
      )
      .get(id) as unknown as CampaignRow | undefined;
    return row ? hybridCampaignSchema.parse(JSON.parse(row.campaign_json)) : undefined;
  }

  deleteCampaign(id: string): boolean {
    return Number(this.db.prepare(`DELETE FROM campaigns WHERE id=?`).run(id).changes) > 0;
  }
}
