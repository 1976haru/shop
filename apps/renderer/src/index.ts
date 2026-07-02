import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildRenderPlan, RenderPlanError } from "../../../packages/campaign/src/index.ts";
import { renderPlanToMp4, RendererError } from "./ffmpeg.ts";

/**
 * R1 렌더 CLI.
 * 사용:
 *   npm run render -- --campaign fixtures/render/demo-campaign.json \
 *     --creative CMP-DEMO-0001-conversion \
 *     --image fixtures/render/product.png --out out/demo.mp4
 *
 * 원칙: 이 CLI는 텍스트/가격을 인자로 받지 않는다.
 * 영상 속 모든 사실은 승인된 캠페인 JSON에서만 나온다.
 */

function main(): number {
  const { values } = parseArgs({
    options: {
      campaign: { type: "string" },
      creative: { type: "string" },
      image: { type: "string" },
      out: { type: "string" },
      "keep-workdir": { type: "boolean", default: false }
    }
  });

  if (!values.campaign || !values.creative || !values.image || !values.out) {
    console.error(
      "사용법: npm run render -- --campaign <campaign.json> --creative <id> --image <대표이미지> --out <출력.mp4>"
    );
    return 2;
  }

  let campaignJson: unknown;
  try {
    campaignJson = JSON.parse(readFileSync(values.campaign, "utf8"));
  } catch (error) {
    console.error(`캠페인 JSON을 읽을 수 없습니다: ${values.campaign}`);
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  try {
    const plan = buildRenderPlan(campaignJson, values.creative);
    console.log(
      `렌더 계획: ${plan.scenes.length}씬 · ${plan.totalDurationSeconds}s · ` +
        plan.scenes.map((s) => s.sceneType).join(" → ")
    );
    const result = renderPlanToMp4({
      plan,
      imagePath: values.image,
      outputPath: values.out,
      keepWorkdir: values["keep-workdir"]
    });
    console.log(
      `완료: ${result.outputPath} (${result.width}x${result.height}, ${result.durationSeconds.toFixed(1)}s)`
    );
    console.log("주의: 게시 전 사람 검토 필수(requiresHumanReview). 자동 업로드는 지원하지 않습니다.");
    return 0;
  } catch (error) {
    if (error instanceof RenderPlanError || error instanceof RendererError) {
      console.error(`[${error.code}] ${error.message}`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main();
