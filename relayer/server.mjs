import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

// Very simple in-memory job store
const jobStore = new Map();

const RequestSchema = z.object({
	from: z.string().default("Moonbeam"),
	to: z.string().default("Hydration"),
	txHash: z.string(),
	recipient: z.string(), // Hydra SS58
	amount: z.string(), // smallest units
	swap: z.object({
		in: z.string().default("GLMR"),
		out: z.string().default("DOT"),
		slippageBps: z.number().int().min(1).max(1000).default(50),
	}).default({ in: "GLMR", out: "DOT", slippageBps: 50 }),
	returnAddress: z.string(), // EVM address on Moonbeam
});

app.get("/healthz", (_req, res) => {
	res.json({ ok: true });
});

app.post("/remote-swap", async (req, res) => {
	try {
		const payload = RequestSchema.parse(req.body);
		const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		jobStore.set(jobId, {
			status: "received",
			createdAt: Date.now(),
			payload,
			logs: ["received request"],
		});
		// Start background workflow (fire-and-forget)
		void processJob(jobId).catch((e) => {
			const job = jobStore.get(jobId);
			if (job) {
				job.status = "error";
				job.logs.push(`error: ${e?.message || String(e)}`);
				jobStore.set(jobId, job);
			}
		});
		res.status(202).json({ jobId, status: "received" });
	} catch (e) {
		res.status(400).json({ error: e?.message || String(e) });
	}
});

app.get("/remote-swap/:jobId", (req, res) => {
	const job = jobStore.get(req.params.jobId);
	if (!job) {
		res.status(404).json({ error: "job not found" });
		return;
	}
	res.json({ jobId: req.params.jobId, status: job.status, logs: job.logs });
});

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Relayer listening on http://localhost:${PORT}`);
});

async function processJob(jobId) {
	const job = jobStore.get(jobId);
	if (!job) return;

	update(jobId, "waiting_moonbeam_finality", "waiting for origin tx to finalize");
	// NOTE: In a production relayer, confirm delivery to Hydra via indexer/WebSocket.
	await sleep(3000);

	update(jobId, "swapping_on_hydra", "executing GLMR->DOT swap on Hydra via GC SDK");
	// TODO: integrate @galacticcouncil/sdk router + polkadot signer here
	await sleep(3000);

	update(jobId, "returning_to_moonbeam", "sending DOT back to Moonbeam via XCM");
	// TODO: construct XCM send back to Moonbeam (DOT/xcDOT) and submit
	await sleep(3000);

	update(jobId, "completed", "swap complete and return sent");
}

function update(jobId, status, log) {
	const job = jobStore.get(jobId);
	if (!job) return;
	job.status = status;
	if (log) job.logs.push(log);
	jobStore.set(jobId, job);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}


