import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { decryptSecret } from "./secrets.js";
import { appendAssets, deleteAssetById, getDbStatus, readDb, writeDb } from "./db.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "dist");

app.use(cors());
app.use(express.json());

const textAi = new OpenAI({
  apiKey: decryptSecret(process.env.TEXT_API_KEY),
  baseURL: process.env.TEXT_BASE_URL || "https://api.deepseek.com",
});

const videoAi = new GoogleGenAI({
  apiKey: decryptSecret(process.env.GEMINI_API_KEY),
});

const ASSET_TYPES = [
  "Pattern",
  "Chunk",
  "Native Expression",
  "Question Pattern",
  "Framework",
  "Useful Sentence",
  "Poetic Expression",
  "Local Expression",
];

const PRACTICE_GOAL_GUIDE = `
Practice goal guide:
- explain-opinion: explain one view with a point, reason, example, contrast, and takeaway.
- job-search-interview: general job search and interview language for fit, motivation, experience, availability, and next steps.
- daily-questions: reusable everyday questions about time, plans, needs, locations, follow-ups, and clarification.
- part-time-service-job: practical language for bar, restaurant, cafe, retail, and clothing-store part-time work.
- daily-small-talk: tell small everyday moments with setup, detail, feeling, reaction, and follow-up.
- workplace-communication: meetings, collaboration, support, sales, suggestions, updates, and clarifying work.
- personal-reflection: change, realization, feeling, memory, growth, and personal decisions.
`;

async function generateTextContent(prompt) {
  const response = await textAi.chat.completions.create({
    model: process.env.TEXT_MODEL || "deepseek-v4-flash",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices?.[0]?.message?.content || "";
}

async function generateVideoContent(prompt, config = {}) {
  const response = await videoAi.models.generateContent({
    model: process.env.VIDEO_MODEL || "gemini-2.5-flash-lite",
    contents: prompt,
    config,
  });

  return response.text || "";
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    if (value.name && value.description) return `${value.name}: ${value.description}`;
    if (value.name) return String(value.name);
    if (value.description) return String(value.description);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function toTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean);
}

function cleanAsset(asset) {
  const safeAsset = asset && typeof asset === "object" ? asset : {};

  return {
    type: toText(safeAsset.type) || "Asset",
    text: toText(safeAsset.text),
    sourceSentence: toText(safeAsset.sourceSentence),
    functionName: toText(safeAsset.functionName),
    expressionFunction: toText(safeAsset.expressionFunction),
    comboRole: toText(safeAsset.comboRole),
    rootPattern: toText(safeAsset.rootPattern),
    scenarios: toTextArray(safeAsset.scenarios),
    examples: toTextArray(safeAsset.examples),
    tags: toTextArray(safeAsset.tags),
    difficulty: toText(safeAsset.difficulty),
    theme: toText(safeAsset.theme),
    notes: toText(safeAsset.notes),
  };
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeGeneratedAssets(value, sourceUrl) {
  const list = Array.isArray(value) ? value : [];

  return list
    .map((item) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const rawType = toText(safeItem.recommendedType || safeItem.type);
      const recommendedType = ASSET_TYPES.includes(rawType) ? rawType : "Chunk";
      const assetText = toText(safeItem.assetText || safeItem.text || safeItem.sourceSentence);

      return {
        sourceSentence: toText(safeItem.sourceSentence) || assetText,
        recommendedType,
        assetText,
        meaning: toText(safeItem.meaning),
        functionName: toText(safeItem.functionName) || "Video expression asset",
        expressionFunction: toText(safeItem.expressionFunction) || toText(safeItem.functionName),
        comboRole: toText(safeItem.comboRole),
        rootPattern: toText(safeItem.rootPattern) || assetText,
        slots: toTextArray(safeItem.slots),
        scenarios: toTextArray(safeItem.scenarios),
        examples: toTextArray(safeItem.examples),
        tags: toTextArray(safeItem.tags),
        difficulty: toText(safeItem.difficulty) || "B1-B2",
        theme: toText(safeItem.theme),
        notes: toText(safeItem.notes) || "Extracted for review.",
        sourceUrl,
      };
    })
    .filter((asset) => asset.assetText);
}

function getClientError(err, fallback) {
  const message = toText(err?.message || err);

  if (
    err?.status === 429 ||
    err?.code === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota exceeded")
  ) {
    return {
      status: 429,
      detail:
        "The model API quota has been used up for now. Please wait for the quota reset, upgrade billing, or switch to another API key.",
    };
  }

  return {
    status: 500,
    detail: fallback,
  };
}

function sendAiError(res, err, error, fallback) {
  const clientError = getClientError(err, fallback);

  return res.status(clientError.status).json({
    error,
    detail: clientError.detail,
  });
}

function safeParseJson(text) {
  const rawText = toText(text);

  try {
    return JSON.parse(rawText);
  } catch {
    const cleaned = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      return JSON.parse(match[0]);
    }
  }
}

app.get("/api/assets", async (req, res) => {
  try {
    const db = await readDb();

    res.json({
      assets: db.assets,
      updatedAt: db.updatedAt,
    });
  } catch (err) {
    console.error("Read assets error:", err);
    res.status(500).json({
      error: "Assets read failed",
      detail: "Could not read saved assets from the database.",
    });
  }
});

app.post("/api/assets", async (req, res) => {
  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const nextDb = await appendAssets(assets);

    res.json({
      added: assets.length,
      assetCount: nextDb.assets.length,
      updatedAt: nextDb.updatedAt,
    });
  } catch (err) {
    console.error("Append assets error:", err);
    res.status(500).json({
      error: "Assets append failed",
      detail: "Could not save new assets to the database.",
    });
  }
});

app.put("/api/assets", async (req, res) => {
  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const db = await readDb();
    const nextDb = await writeDb({
      ...db,
      assets,
    });

    res.json({
      assets: nextDb.assets,
      updatedAt: nextDb.updatedAt,
    });
  } catch (err) {
    console.error("Save assets error:", err);
    res.status(500).json({
      error: "Assets save failed",
      detail: "Could not save assets to the database.",
    });
  }
});

app.delete("/api/assets/:id", async (req, res) => {
  try {
    const id = toText(req.params?.id);
    const nextDb = await deleteAssetById(id);

    res.json({
      deletedId: id,
      assetCount: nextDb.assets.length,
      updatedAt: nextDb.updatedAt,
    });
  } catch (err) {
    console.error("Delete asset error:", err);
    res.status(500).json({
      error: "Asset delete failed",
      detail: "Could not delete the asset from the database.",
    });
  }
});

app.get("/api/db-status", async (req, res) => {
  try {
    res.json(await getDbStatus());
  } catch (err) {
    console.error("DB status error:", err);
    res.status(500).json({
      ok: false,
      provider: "unknown",
      error: "Could not read database status.",
    });
  }
});

app.post("/api/conversation", async (req, res) => {
  try {
    const message = toText(req.body?.message);
    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .slice(-10)
          .map((item) => ({
            role: toText(item?.role),
            content: toText(item?.content),
          }))
          .filter((item) => item.content)
      : [];

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
        detail: "Please send a non-empty message.",
      });
    }

    const reply = await generateTextContent(`
You are SpeakFrame.

SpeakFrame is a personal expression growth system for Chinese learners.
It turns "I have an idea but cannot express it" into reusable English expression assets.

The user may write Chinese.
Your task is stable expression coaching, not one-off direct translation.

Recent conversation:
${JSON.stringify(history)}

If the user gives a simple idea, expand it into a natural B1-B2 English speaking answer.
If the user continues the same topic, remember the recent conversation and continue naturally.
If the user asks a follow-up question, answer it and keep the same learning context.

Rules:
1. Return English only.
2. Give 4-6 short, reusable sentences.
3. Use clear logic: main idea -> reason -> detail -> example -> value/result.
4. Each sentence must stand alone and be useful when clicked as an expression asset.
5. Avoid grammar explanation, labels, numbering, bullet points, markdown, and Chinese.
6. Prefer natural phrases a learner can reuse in interviews, workplace talks, daily communication, sales, or technical support.
7. Do not reset the conversation unless the user changes topic clearly.

User:
${message}
`);

    res.json({ reply });
  } catch (err) {
    console.error("Conversation error:", err);
    sendAiError(
      res,
      err,
      "Conversation failed",
      "Conversation failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/text-assets", async (req, res) => {
  try {
    const text = toText(req.body?.text);

    if (!text) {
      return res.status(400).json({
        error: "Text is required",
        detail: "Please send non-empty text to extract assets.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's text asset extractor.

The user pasted English text, transcript lines, or learning notes.
Your task is to extract reusable English expression assets for a Chinese learner.

Text:
${text}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:

{
  "assets": [
    {
      "sourceSentence": "",
      "recommendedType": "Chunk",
      "assetText": "",
      "meaning": "",
      "functionName": "",
      "expressionFunction": "",
      "comboRole": "",
      "rootPattern": "",
      "slots": [],
      "scenarios": [],
      "examples": [],
      "tags": [],
      "difficulty": "B1-B2",
      "theme": "",
      "notes": ""
    }
  ],
  "summary": ""
}

Rules:
1. Extract 8-12 high-value assets from the pasted text.
2. Include useful chunks, native expressions, reusable sentences, and sentence patterns.
3. recommendedType must be exactly one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
4. assetText should be concise and reusable.
5. sourceSentence should preserve the original sentence or phrase from the pasted text.
6. rootPattern should use [brackets] for replaceable parts when useful.
7. meaning should be concise Chinese.
8. functionName should include Chinese + English communication function.
9. expressionFunction should be a short functional label, such as "Explain reason" or "Describe change".
10. comboRole should be one of: "opener", "reason", "detail", "example", "closing", "question", "framework", "support".
11. tags should include 2-5 practical tags.
12. difficulty should be "B1", "B2", or "C1".
13. theme should describe the topic, such as "personal growth" or "workplace communication".
14. examples should include 2-3 B1-B2 reusable examples.
15. Do not invent content unrelated to the pasted text.
`);

    const data = safeParseJson(rawText);
    const generatedAssets = normalizeGeneratedAssets(data.assets, "");

    if (generatedAssets.length === 0) {
      return res.status(422).json({
        error: "No text assets found",
        detail: "I could not find reusable expression assets in this text.",
      });
    }

    res.json({
      assets: generatedAssets,
      summary: toText(data.summary) || `Extracted ${generatedAssets.length} reusable assets.`,
    });
  } catch (err) {
    console.error("Text asset error:", err);
    sendAiError(
      res,
      err,
      "Text asset extraction failed",
      "Text asset extraction failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/video-assets", async (req, res) => {
  try {
    const url = toText(req.body?.url);

    if (!url || !isHttpUrl(url)) {
      return res.status(400).json({
        error: "Valid video URL is required",
        detail: "Please send a public http or https video URL.",
      });
    }

    const rawText = await generateVideoContent(
      `
You are SpeakFrame's video expression asset extractor.

Video URL:
${url}

Use the URL context tool to inspect the public page, transcript, captions, description, or any accessible text from this URL.

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:

{
  "sourceTitle": "",
  "assets": [
    {
      "sourceSentence": "",
      "recommendedType": "Chunk",
      "assetText": "",
      "meaning": "",
      "functionName": "",
      "expressionFunction": "",
      "comboRole": "",
      "rootPattern": "",
      "slots": [],
      "scenarios": [],
      "examples": [],
      "tags": [],
      "difficulty": "B1-B2",
      "theme": "",
      "notes": ""
    }
  ],
  "message": ""
}

Rules:
1. Extract 6-8 high-value learning assets only from content you can access from the URL.
2. Do not invent quotes, sentences, or transcript content.
3. If you cannot access meaningful video text, return "assets": [] and explain briefly in "message".
4. Assets should include good phrases, chunks, valuable sentences, and reusable sentence patterns.
5. recommendedType must be exactly one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
6. assetText should be short and reusable.
7. rootPattern should use [brackets] for replaceable parts when useful.
8. meaning should be concise Chinese.
9. functionName should include Chinese + English communication function.
10. expressionFunction should be a short functional label.
11. comboRole should be one of: "opener", "reason", "detail", "example", "closing", "question", "framework", "support".
12. tags should include 2-5 practical tags.
13. difficulty should be "B1", "B2", or "C1".
14. theme should describe the topic.
15. examples should include 2-3 B1-B2 reusable examples.
16. scenarios should include practical use cases.
`,
      {
        tools: [{ urlContext: {} }],
      }
    );

    const data = safeParseJson(rawText);
    const generatedAssets = normalizeGeneratedAssets(data.assets, url);

    if (generatedAssets.length === 0) {
      return res.status(422).json({
        error: "No video assets found",
        detail:
          toText(data.message) ||
          "I could not access enough transcript or page text from this video link.",
      });
    }

    res.json({
      sourceTitle: toText(data.sourceTitle),
      sourceUrl: url,
      assets: generatedAssets,
      message: toText(data.message),
    });
  } catch (err) {
    console.error("Video asset error:", err);
    sendAiError(
      res,
      err,
      "Video asset extraction failed",
      "Video parsing failed. The video may not expose transcript text, or the server/API key may need attention."
    );
  }
});

app.post("/api/insight", async (req, res) => {
  try {
    const sentence = toText(req.body?.sentence);

    if (!sentence) {
      return res.status(400).json({
        error: "Sentence is required",
        detail: "Please send a non-empty sentence.",
      });
    }

    console.log("Insight sentence:", sentence);

    const rawText = await generateTextContent(`
Analyze this English sentence as a reusable SpeakFrame expression asset.

Sentence:
${sentence}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:

{
  "sourceSentence": "${sentence}",
  "recommendedType": "Pattern",
  "assetText": "",
  "meaning": "",
  "functionName": "",
  "expressionFunction": "",
  "comboRole": "",
  "rootPattern": "",
  "slots": [],
  "scenarios": [],
  "examples": [],
  "tags": [],
  "difficulty": "B1-B2",
  "theme": "",
  "notes": ""
}

Rules:
1. recommendedType must be exactly one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
2. Use "Pattern" for a reusable sentence structure.
3. Use "Chunk" for a short phrase that can be inserted into many sentences.
4. Use "Local Expression" for a natural native-like wording.
5. Use "Framework" for a multi-step communication structure.
6. assetText should be the shortest useful reusable part.
7. rootPattern should show fixed wording plus replaceable parts in [brackets].
8. slots should list replaceable parts, such as "[reason]" or "[result]".
9. scenarios should include 3-5 likely usage scenarios.
10. examples should give 3 B1-B2 reusable examples using the asset.
11. meaning should be in concise Chinese.
12. functionName should explain the communication function in Chinese + English.
13. expressionFunction should be a short functional label.
14. comboRole should be one of: "opener", "reason", "detail", "example", "closing", "question", "framework", "support".
15. tags should include 2-5 practical tags.
16. difficulty should be "B1", "B2", or "C1".
17. theme should describe the topic.
18. Focus on reuse and output, not academic grammar.
`);

    console.log("Insight raw:", rawText);

    const data = safeParseJson(rawText);

    const recommendedType = ASSET_TYPES.includes(toText(data.recommendedType))
      ? toText(data.recommendedType)
      : "Pattern";

    res.json({
      sourceSentence: toText(data.sourceSentence) || sentence,
      recommendedType,
      assetText: toText(data.assetText) || toText(data.rootPattern) || sentence,
      meaning: toText(data.meaning),
      functionName: toText(data.functionName) || "Reusable expression",
      expressionFunction: toText(data.expressionFunction) || toText(data.functionName),
      comboRole: toText(data.comboRole),
      rootPattern: toText(data.rootPattern) || "Reusable sentence pattern",
      slots: toTextArray(data.slots),
      scenarios: toTextArray(data.scenarios),
      examples: toTextArray(data.examples),
      tags: toTextArray(data.tags),
      difficulty: toText(data.difficulty) || "B1-B2",
      theme: toText(data.theme),
      notes: toText(data.notes) || "This expression can be saved and reused.",
    });
  } catch (err) {
    console.error("Insight error:", err);
    sendAiError(
      res,
      err,
      "Insight failed",
      "Insight failed. Please check the server connection and try this sentence again."
    );
  }
});

app.post("/api/daily-recommendations", async (req, res) => {
  try {
    const existingAssets = Array.isArray(req.body?.assets) ? req.body.assets.map(cleanAsset) : [];
    const practiceGoal = toText(req.body?.practiceGoal) || "explain-opinion";
    const assetContext = existingAssets.slice(0, 20);

    const rawText = await generateTextContent(`
You are SpeakFrame's daily expression recommendation engine.

SpeakFrame helps Chinese learners build reusable expression assets and combine them into real output.

Practice goal:
${practiceGoal}

${PRACTICE_GOAL_GUIDE}

Existing assets, if any:
${JSON.stringify(assetContext)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:

{
  "theme": "",
  "assets": [
    {
      "sourceSentence": "",
      "recommendedType": "Chunk",
      "assetText": "",
      "meaning": "",
      "functionName": "",
      "expressionFunction": "",
      "comboRole": "",
      "rootPattern": "",
      "slots": [],
      "scenarios": [],
      "examples": [],
      "tags": [],
      "difficulty": "B1-B2",
      "theme": "",
      "notes": ""
    }
  ],
  "message": ""
}

Rules:
1. Recommend exactly 4 assets that can be used together in one short answer or one real interaction.
2. Use a practical theme that fits the practice goal and the learner's current assets.
3. Include a balanced flow: opener, reason, detail/example, closing or question.
4. recommendedType must be exactly one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
5. assetText must be concise, natural, and reusable.
6. meaning must be concise Chinese.
7. functionName should include Chinese + English communication function.
8. expressionFunction should be a short functional label.
9. comboRole must be one of: "opener", "reason", "detail", "example", "closing", "question", "framework", "support".
10. tags should include 2-5 practical tags.
11. difficulty should be "B1", "B2", or "C1".
12. examples should include 2-3 B1-B2 reusable examples.
13. Avoid duplicating existing assetText when existing assets are provided.
`);

    const data = safeParseJson(rawText);
    const generatedAssets = normalizeGeneratedAssets(data.assets, "");

    if (generatedAssets.length === 0) {
      return res.status(422).json({
        error: "No daily recommendations found",
        detail: "I could not generate daily recommendations yet.",
      });
    }

    res.json({
      theme: toText(data.theme),
      assets: generatedAssets.slice(0, 4),
      message: toText(data.message),
    });
  } catch (err) {
    console.error("Daily recommendation error:", err);
    sendAiError(
      res,
      err,
      "Daily recommendation failed",
      "Daily recommendation failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/structure-practice", async (req, res) => {
  try {
    const topic = toText(req.body?.topic);
    const practiceGoal = toText(req.body?.practiceGoal) || "explain-opinion";
    const assets = Array.isArray(req.body?.assets) ? req.body.assets.map(cleanAsset) : [];
    const assetContext = assets.slice(0, 20);

    if (!topic) {
      return res.status(400).json({
        error: "Topic is required",
        detail: "Please send a topic or idea to build a structure.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's expression structure coach.

The learner needs two abilities:
1. Reusable expression architecture: build a stable paragraph frame the learner can reuse by swapping words, chunks, or examples.
2. Big-to-small expression: explain one idea, daily moment, opinion, or small story through concrete details and a takeaway.

User topic or rough idea:
${topic}

Practice goal:
${practiceGoal}

${PRACTICE_GOAL_GUIDE}

Saved expression assets that can be reused:
${JSON.stringify(assetContext)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:

{
  "title": "",
  "goal": "",
  "bigToSmallPath": [],
  "layers": [
    {
      "name": "",
      "purpose": "",
      "sentence": "",
      "smallerMove": "",
      "recommendedAssets": []
    }
  ],
  "sampleAnswer": "",
  "practicePrompt": ""
}

Rules:
1. Create 5 layers: Core Frame, Setup, Development, Specific Detail, Result / Next Step.
2. Each layer must contain one native compressed sentence framework: longer than a tiny sentence, natural, and reusable by swapping words.
3. Prefer high-value frames like: "I've been thinking about...", "Even though..., I still think...", "At first..., but after..., I started to...", "One thing I find challenging is..., not because..., but because...", "It started as..., but it turned into...", "So my next step is..., even if..., because...".
4. The layers must help the learner describe a more complex thing clearly, moving from big idea to smaller detail, then to result or next step.
5. recommendedAssets should include exact saved asset texts when useful, otherwise useful new chunks or slot swaps.
6. sampleAnswer must combine all layers into one natural spoken paragraph that explains one thing clearly.
7. practicePrompt should tell the learner how to reuse the frame by changing scene, nouns, verbs, details, and ending.
8. For job-search-interview and part-time-service-job, include practical language for availability, fit, service attitude, learning, and asking about opportunities.
9. Keep the style natural, practical, and reusable for Chinese learners. Do not give grammar explanation.
10. If the user writes Chinese, still return English sentences, with concise structure labels.
`);

    const data = safeParseJson(rawText);
    const layers = Array.isArray(data.layers)
      ? data.layers
          .map((layer) => {
            const safeLayer = layer && typeof layer === "object" ? layer : {};

            return {
              name: toText(safeLayer.name),
              purpose: toText(safeLayer.purpose),
              sentence: toText(safeLayer.sentence),
              smallerMove: toText(safeLayer.smallerMove),
              recommendedAssets: toTextArray(safeLayer.recommendedAssets),
            };
          })
          .filter((layer) => layer.sentence)
      : [];

    if (layers.length === 0) {
      return res.status(422).json({
        error: "No structure generated",
        detail: "I could not generate a usable expression structure yet.",
      });
    }

    res.json({
      title: toText(data.title) || topic,
      goal: toText(data.goal) || practiceGoal,
      bigToSmallPath: toTextArray(data.bigToSmallPath),
      layers,
      sampleAnswer: toText(data.sampleAnswer),
      practicePrompt: toText(data.practicePrompt),
    });
  } catch (err) {
    console.error("Structure practice error:", err);
    sendAiError(
      res,
      err,
      "Structure practice failed",
      "Structure practice failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/live-practice", async (req, res) => {
  try {
    const scenario = toText(req.body?.scenario) || "daily-conversation";
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
          .slice(-16)
          .map((item) => ({
            role: toText(item?.role),
            content: toText(item?.content),
          }))
          .filter((item) => item.content)
      : [];

    if (messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required",
        detail: "Please send at least one live practice message.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's live voice-call English coach.

This is a real-time voice practice, like a phone call.
The learner may speak English, or ask in Chinese when stuck.

Scenario:
${scenario}

Conversation:
${JSON.stringify(messages)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:
{
  "reply": "",
  "isRescue": false,
  "rescue": {
    "naturalExpression": "",
    "pattern": "",
    "tryAgainPrompt": ""
  }
}

Rules:
1. reply must be spoken English only, natural and short enough for voice.
2. If the learner uses Chinese to ask how to say something, treat it as expression rescue.
3. For expression rescue, give the natural English sentence, a reusable pattern, then ask them to try again.
4. If the learner answers in English, respond like a supportive conversation partner and ask one clear follow-up question.
5. Do not give long explanations.
6. Keep the conversation moving.
`);

    const data = safeParseJson(rawText);

    res.json({
      reply: toText(data.reply) || "Good. Can you say a little more about that?",
      isRescue: Boolean(data.isRescue),
      rescue: data.rescue && typeof data.rescue === "object"
        ? {
            naturalExpression: toText(data.rescue.naturalExpression),
            pattern: toText(data.rescue.pattern),
            tryAgainPrompt: toText(data.rescue.tryAgainPrompt),
          }
        : null,
    });
  } catch (err) {
    console.error("Live practice error:", err);
    sendAiError(
      res,
      err,
      "Live practice failed",
      "Live practice failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/live-summary", async (req, res) => {
  try {
    const scenario = toText(req.body?.scenario) || "daily-conversation";
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
          .map((item) => ({
            role: toText(item?.role),
            content: toText(item?.content),
          }))
          .filter((item) => item.content)
      : [];

    if (messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required",
        detail: "Please send live session messages to summarize.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's live practice summarizer.

Summarize the learner's voice-call practice and extract reusable expression assets.

Scenario:
${scenario}

Transcript:
${JSON.stringify(messages)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:
{
  "feedback": "",
  "assets": [
    {
      "sourceSentence": "",
      "recommendedType": "Chunk",
      "assetText": "",
      "meaning": "",
      "functionName": "",
      "expressionFunction": "",
      "comboRole": "",
      "rootPattern": "",
      "slots": [],
      "scenarios": [],
      "examples": [],
      "tags": [],
      "difficulty": "B1-B2",
      "theme": "",
      "notes": ""
    }
  ]
}

Rules:
1. Extract 4-8 assets from things the learner asked, struggled with, or said unnaturally.
2. Include rescued expressions, corrected native expressions, useful chunks, and patterns.
3. recommendedType must be exactly one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
4. meaning must be concise Chinese.
5. examples should include 2 practical spoken examples.
6. feedback should be concise Chinese, focused on what to practice next.
`);

    const data = safeParseJson(rawText);
    const generatedAssets = normalizeGeneratedAssets(data.assets, "");

    res.json({
      feedback: toText(data.feedback),
      assets: generatedAssets,
    });
  } catch (err) {
    console.error("Live summary error:", err);
    sendAiError(
      res,
      err,
      "Live summary failed",
      "Live summary failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/recombine", async (req, res) => {
  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets.map(cleanAsset) : [];
    const practiceGoal = toText(req.body?.practiceGoal) || "focused speaking practice";
    const usableAssets = assets.filter((asset) => asset.text);

    if (usableAssets.length === 0) {
      return res.status(400).json({
        error: "Assets are required",
        detail: "Please send at least one saved asset with text.",
      });
    }

    const rawText = await generateTextContent(`
Create a speaking practice for SpeakFrame.

Practice goal:
${practiceGoal}

${PRACTICE_GOAL_GUIDE}

Assets:
${JSON.stringify(usableAssets)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:

{
  "scenario": "",
  "question": "",
  "mustUse": [],
  "sampleAnswer": ""
}

Rules:
1. Create one realistic speaking or writing task for the practice goal.
2. The scenario must fit the selected practice goal, especially job search, daily questions, part-time service jobs, workplace communication, daily small talk, opinion, or reflection.
3. If any selected asset has type "Framework" or comboRole "framework", treat it as the speaking route. The task should ask the learner to reuse that route in a new but related situation.
4. The question should make the learner use the selected assets naturally.
5. mustUse must include the exact selected asset texts, but Framework assets can be listed as "Frame: [text]" if the exact title is not a sentence.
6. sampleAnswer should use B1-B2 English.
7. sampleAnswer should follow the Framework route if provided; otherwise use setup/main idea -> reason/feeling -> concrete detail/example -> result/takeaway.
8. Keep the task practical, not like a school essay.
9. Explain the goal through scenario and question, not with meta commentary.
`);

    const data = safeParseJson(rawText);

    res.json({
      scenario: toText(data.scenario) || "Practice",
      question: toText(data.question) || "Use the selected assets to answer a practice question.",
      mustUse: toTextArray(data.mustUse).length > 0 ? toTextArray(data.mustUse) : usableAssets.map((a) => a.text),
      sampleAnswer: toText(data.sampleAnswer),
    });
  } catch (err) {
    console.error("Recombination error:", err);
    sendAiError(
      res,
      err,
      "Recombination failed",
      "Practice generation failed. Please check the server connection and try again."
    );
  }
});

app.use(express.static(distPath));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  app.listen(process.env.PORT || 3001, () => {
    console.log("Server running on port", process.env.PORT || 3001);
  });
}

export default app;



