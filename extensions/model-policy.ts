/**
 * Enforce the local model policy for Pi sessions.
 *
 * The policy warns when the active model is not on the allow-list. Automatic
 * fallback is opt-in so selecting another model remains possible for an
 * experiment unless the user explicitly enables it.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const MODEL_POLICY = {
	allowed: [
		"ollama/qwen3.5:9b-mlx",
		"openai-codex/gpt-5.6-luna",
		"openai-codex/gpt-5.6-sol",
	] as const,
	fallback: "openai-codex/gpt-5.6-luna",
	autoSwitch: false,
} as const;

const AUTO_SWITCH_FLAG = "model-policy-auto-switch";
const ALLOWED_MODELS = new Set<string>(MODEL_POLICY.allowed);

type ModelIdentity = {
	provider: string;
	id: string;
};

function modelRef(model: ModelIdentity | undefined): string | undefined {
	return model ? `${model.provider}/${model.id}` : undefined;
}

function splitModelRef(ref: string): ModelIdentity | undefined {
	const separator = ref.indexOf("/");
	if (separator <= 0 || separator === ref.length - 1) return undefined;

	return {
		provider: ref.slice(0, separator),
		id: ref.slice(separator + 1),
	};
}

function reportWarning(ctx: ExtensionContext, message: string): void {
	const text = `[model-policy] ${message}`;
	if (ctx.hasUI) {
		ctx.ui.notify(text, "warning");
	} else {
		console.warn(text);
	}
}

function reportInfo(ctx: ExtensionContext, message: string): void {
	if (ctx.hasUI) {
		ctx.ui.notify(`[model-policy] ${message}`, "info");
	}
}

export default function modelPolicyExtension(pi: ExtensionAPI): void {
	let lastCheckedModel: string | undefined;
	let restoring = false;

	pi.registerFlag(AUTO_SWITCH_FLAG, {
		description: "Switch disallowed models back to the model-policy fallback",
		type: "boolean",
		default: false,
	});

	async function checkModel(
		model: ModelIdentity | undefined,
		ctx: ExtensionContext,
		source: "session start" | "model switch" | "session restore",
	): Promise<void> {
		const selected = modelRef(model);
		if (!selected || selected === lastCheckedModel) return;
		lastCheckedModel = selected;

		if (ALLOWED_MODELS.has(selected)) return;

		reportWarning(
			ctx,
			`${source} selected ${selected}, which is not allowed. Allowed models: ${MODEL_POLICY.allowed.join(", ")}.`,
		);

		const autoSwitch = MODEL_POLICY.autoSwitch || pi.getFlag(AUTO_SWITCH_FLAG) === true;
		if (!autoSwitch || restoring) return;

		const fallback = splitModelRef(MODEL_POLICY.fallback);
		if (!fallback) {
			reportWarning(ctx, `Invalid fallback model reference: ${MODEL_POLICY.fallback}.`);
			return;
		}

		const fallbackModel = ctx.modelRegistry.find(fallback.provider, fallback.id);
		if (!fallbackModel) {
			reportWarning(ctx, `Fallback model ${MODEL_POLICY.fallback} is not available in Pi's model registry.`);
			return;
		}

		restoring = true;
		try {
			const switched = await pi.setModel(fallbackModel);
			if (switched) {
				lastCheckedModel = MODEL_POLICY.fallback;
				reportInfo(ctx, `Switched ${selected} back to ${MODEL_POLICY.fallback}.`);
			} else {
				reportWarning(ctx, `Could not switch to ${MODEL_POLICY.fallback}; provider authentication is unavailable.`);
			}
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			reportWarning(ctx, `Could not switch to ${MODEL_POLICY.fallback}: ${detail}`);
		} finally {
			restoring = false;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		lastCheckedModel = undefined;
		await checkModel(ctx.model, ctx, "session start");
	});

	pi.on("model_select", async (event, ctx) => {
		await checkModel(event.model, ctx, event.source === "restore" ? "session restore" : "model switch");
	});
}
