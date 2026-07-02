import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatKrw,
  type RenderPlan,
  type RenderScenePlan
} from "../../../packages/campaign/src/index.ts";

/**
 * R1 ffmpeg 렌더러 (비순수 계층).
 * RenderPlan + 대표 이미지 1장 → 720x1280 mp4.
 * 카드 텍스트는 drawtext textfile 로만 주입한다(이스케이프·한글 안전, 임의 문자열 CLI 주입 차단).
 */

export class RendererError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RendererError";
    this.code = code;
  }
}

function run(bin: string, args: string[]): string {
  try {
    return execFileSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr: unknown }).stderr)
        : String(error);
    throw new RendererError("FFMPEG_FAILED", `${bin} 실행 실패:\n${stderr.slice(-2000)}`);
  }
}

export function assertFfmpegAvailable(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  } catch {
    throw new RendererError(
      "FFMPEG_NOT_FOUND",
      "ffmpeg/ffprobe를 찾을 수 없습니다. 설치 후 다시 시도하세요.\n" +
        "  - Ubuntu/Debian: sudo apt-get install -y ffmpeg\n" +
        "  - macOS: brew install ffmpeg\n" +
        "  - Windows: winget install Gyan.FFmpeg (설치 후 새 터미널)"
    );
  }
}

export interface KoreanFont {
  file: string;
  family: string;
}

export function findKoreanFont(): KoreanFont {
  // 1) OS별 잘 알려진 한글 폰트 경로 우선 (Windows에는 fontconfig가 없음)
  const known: Array<{ file: string; family: string }> = [
    // Windows
    { file: "C:/Windows/Fonts/malgun.ttf", family: "Malgun Gothic" },
    { file: "C:/Windows/Fonts/malgunbd.ttf", family: "Malgun Gothic" },
    { file: "C:/Windows/Fonts/NanumGothic.ttf", family: "NanumGothic" },
    // macOS
    { file: "/System/Library/Fonts/AppleSDGothicNeo.ttc", family: "Apple SD Gothic Neo" },
    // Linux (fc-match 폴백 전 흔한 경로)
    { file: "/usr/share/fonts/truetype/nanum/NanumGothic.ttf", family: "NanumGothic" }
  ];
  for (const candidate of known) {
    if (existsSync(candidate.file)) return candidate;
  }
  // 2) fontconfig 폴백 (Linux 등)
  try {
    const file = execFileSync("fc-match", ["-f", "%{file}", ":lang=ko"], {
      encoding: "utf8"
    }).trim();
    const family = execFileSync("fc-match", ["-f", "%{family}", ":lang=ko"], {
      encoding: "utf8"
    })
      .trim()
      .split(",")[0];
    if (!file || !existsSync(file)) throw new Error("no font file");
    return { file, family };
  } catch {
    throw new RendererError(
      "KOREAN_FONT_NOT_FOUND",
      "한글 렌더 가능한 폰트를 찾지 못했습니다.\n" +
        "  - Windows: 보통 맑은 고딕(C:/Windows/Fonts/malgun.ttf)이 자동 감지됩니다. 없다면 나눔고딕을 설치하세요.\n" +
        "  - Ubuntu/Debian: sudo apt-get install -y fonts-nanum (또는 fonts-noto-cjk)\n" +
        "  - macOS: 기본 Apple SD Gothic Neo가 자동 감지됩니다."
    );
  }
}

/** ffmpeg 필터 인자용 경로 이스케이프 (Windows 드라이브 콜론 등) */
function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

interface SceneRenderContext {
  workdir: string;
  font: KoreanFont;
  imagePath: string;
  fps: number;
}

/** drawtext용 텍스트 파일 생성(이스케이프 불필요, 한글 안전) */
function textFile(ctx: SceneRenderContext, name: string, content: string): string {
  const path = join(ctx.workdir, `${name}.txt`);
  writeFileSync(path, content, "utf8");
  return path;
}

function drawText(opts: {
  file: string;
  fontfile: string;
  size: number;
  color: string;
  y: string;
  box?: boolean;
}): string {
  const box = opts.box ? ":box=1:boxcolor=0x000000AA:boxborderw=18" : "";
  return (
    `drawtext=textfile='${filterPath(opts.file)}':fontfile='${filterPath(opts.fontfile)}'` +
    `:fontsize=${opts.size}:fontcolor=${opts.color}` +
    `:x=(w-text_w)/2:y=${opts.y}${box}`
  );
}

function renderKenburnsSegment(
  scene: RenderScenePlan,
  ctx: SceneRenderContext,
  out: string
): void {
  const frames = Math.max(1, Math.round(scene.durationSeconds * ctx.fps));
  const vf =
    "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560," +
    `zoompan=z='min(1+0.10*on/${frames},1.15)':d=${frames}` +
    `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=720x1280:fps=${ctx.fps},` +
    "format=yuv420p";
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", ctx.imagePath,
    "-vf", vf,
    "-frames:v", String(frames),
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    out
  ]);
}

function renderCardSegment(
  scene: RenderScenePlan,
  ctx: SceneRenderContext,
  out: string
): void {
  const filters: string[] = [];
  const f = ctx.font.file;

  if (scene.sceneType === "PRICE_CARD" && scene.priceCard) {
    const p = scene.priceCard;
    filters.push(
      drawText({ file: textFile(ctx, `t${scene.order}`, p.productTitle), fontfile: f, size: 46, color: "white", y: "400" })
    );
    if (typeof p.listPriceKrw === "number" && p.listPriceKrw > p.sellPriceKrw) {
      filters.push(
        drawText({ file: textFile(ctx, `l${scene.order}`, `정가 ${formatKrw(p.listPriceKrw)}`), fontfile: f, size: 34, color: "0x94A3B8", y: "500" })
      );
    }
    filters.push(
      drawText({ file: textFile(ctx, `p${scene.order}`, formatKrw(p.sellPriceKrw)), fontfile: f, size: 96, color: "0xF2C063", y: "570" }),
      drawText({ file: textFile(ctx, `o${scene.order}`, `${p.optionSummary} · ${p.originDisplay}`), fontfile: f, size: 36, color: "white", y: "730" })
    );
  } else if (scene.sceneType === "CTA_CARD" && scene.ctaCard) {
    const c = scene.ctaCard;
    filters.push(
      drawText({ file: textFile(ctx, `c${scene.order}`, c.callToAction), fontfile: f, size: 56, color: "white", y: "540" }),
      // 표시광고 고지: 하단 고정, 박스 처리(가독성)
      drawText({ file: textFile(ctx, `d${scene.order}`, c.disclosureText), fontfile: f, size: 30, color: "white", y: "h-180", box: true })
    );
  }
  filters.push("format=yuv420p");

  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=0x0F172A:s=720x1280:d=${scene.durationSeconds}:r=${ctx.fps}`,
    "-vf", filters.join(","),
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    out
  ]);
}

export interface RenderResult {
  outputPath: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export function renderPlanToMp4(opts: {
  plan: RenderPlan;
  imagePath: string;
  outputPath: string;
  keepWorkdir?: boolean;
}): RenderResult {
  assertFfmpegAvailable();
  const font = findKoreanFont();

  if (!existsSync(opts.imagePath)) {
    throw new RendererError("IMAGE_NOT_FOUND", `대표 이미지를 찾을 수 없습니다: ${opts.imagePath}`);
  }

  const workdir = mkdtempSync(join(tmpdir(), "shorts-render-"));
  const ctx: SceneRenderContext = {
    workdir,
    font,
    imagePath: opts.imagePath,
    fps: opts.plan.fps
  };

  try {
    // 1) 씬별 세그먼트
    const segments: string[] = [];
    for (const scene of opts.plan.scenes) {
      const seg = join(workdir, `seg-${String(scene.order).padStart(2, "0")}.mp4`);
      if (scene.sceneType === "PRODUCT_KENBURNS") {
        renderKenburnsSegment(scene, ctx, seg);
      } else {
        renderCardSegment(scene, ctx, seg);
      }
      segments.push(seg);
    }

    // 2) concat
    const listPath = join(workdir, "concat.txt");
    writeFileSync(listPath, segments.map((s) => `file '${s}'`).join("\n"), "utf8");
    const merged = join(workdir, "merged.mp4");
    run("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      merged
    ]);

    // 3) SRT 자막 번인 (진단 통과값에서 생성된 자막만 — 계획의 subtitleSrt)
    const srtPath = join(workdir, "captions.srt");
    writeFileSync(srtPath, opts.plan.subtitleSrt, "utf8");
    run("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", merged,
      "-vf",
      `subtitles='${filterPath(srtPath)}':force_style='FontName=${font.family},FontSize=13,PrimaryColour=&HFFFFFF&,Outline=2,MarginV=42'`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      opts.outputPath
    ]);

    const probe = probeMp4(opts.outputPath);
    return { outputPath: opts.outputPath, ...probe };
  } finally {
    if (!opts.keepWorkdir) rmSync(workdir, { recursive: true, force: true });
  }
}

export function probeMp4(path: string): {
  durationSeconds: number;
  width: number;
  height: number;
} {
  const raw = run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    path
  ]);
  const parsed = JSON.parse(raw) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  return {
    width: stream?.width ?? 0,
    height: stream?.height ?? 0,
    durationSeconds: Number(parsed.format?.duration ?? 0)
  };
}
