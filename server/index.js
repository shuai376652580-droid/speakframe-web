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
app.use(express.json({ limit: "15mb" }));

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

function htmlToReadableText(html) {
  return toText(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUsefulEnglishText(text) {
  const cleaned = toText(text);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => /[a-zA-Z]{3,}/.test(line))
    .filter((line) => line.length >= 12 && line.length <= 260);

  return [...new Set(sentences)].join("\n").slice(0, 12000);
}

async function fetchPublicPageText(url) {
  if (!url || !isHttpUrl(url)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
      signal: controller.signal,
    });

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const text = contentType.includes("html") ? htmlToReadableText(raw) : raw;

    return extractUsefulEnglishText(text);
  } catch (err) {
    console.warn("fetchPublicPageText failed:", toText(err?.message || err));
    return "";
  } finally {
    clearTimeout(timeout);
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

function normalizeListeningSentence(item, index) {
  const safeItem = item && typeof item === "object" ? item : {};
  const original = toText(safeItem.original || safeItem.sentence || safeItem.text);
  const chunks = Array.isArray(safeItem.chunks)
    ? safeItem.chunks.map((chunk) => {
        if (typeof chunk === "string") {
          return { text: toText(chunk), whyHard: "This chunk can be hard to catch in fast speech." };
        }

        const safeChunk = chunk && typeof chunk === "object" ? chunk : {};
        return {
          text: toText(safeChunk.text || safeChunk.chunk),
          whyHard: toText(safeChunk.whyHard || safeChunk.reason),
        };
      }).filter((chunk) => chunk.text)
    : [];

  return {
    id: toText(safeItem.id) || `line-${index + 1}`,
    original,
    naturalSpeech: toText(safeItem.naturalSpeech || safeItem.spokenForm) || original,
    meaningZh: toText(safeItem.meaningZh || safeItem.meaning),
    listeningProblem: toText(safeItem.listeningProblem || safeItem.whyHard),
    functionName: toText(safeItem.functionName || safeItem.function),
    pattern: toText(safeItem.pattern || safeItem.rootPattern),
    whyUse: toText(safeItem.whyUse || safeItem.whyThisSentence),
    slots: toTextArray(safeItem.slots),
    chunks,
    extensionExamples: toTextArray(safeItem.extensionExamples || safeItem.examples).slice(0, 10),
    replacementDrills: toTextArray(safeItem.replacementDrills || safeItem.swapPractice).slice(0, 10),
    saveSuggestions: normalizeGeneratedAssets(safeItem.saveSuggestions || safeItem.assets, ""),
  };
}

function normalizeListeningPack(data, sourceUrl) {
  const safeData = data && typeof data === "object" ? data : {};
  const sentences = Array.isArray(safeData.sentences)
    ? safeData.sentences.map(normalizeListeningSentence).filter((item) => item.original)
    : [];

  return {
    sourceTitle: toText(safeData.sourceTitle || safeData.title) || "Video Listening Pack",
    sourceUrl: toText(safeData.sourceUrl) || sourceUrl,
    sourceSummary: toText(safeData.sourceSummary || safeData.summary),
    listeningGoal: toText(safeData.listeningGoal) || "Understand natural daily English and reuse the best expressions.",
    beforeListening: toTextArray(safeData.beforeListening || safeData.predictionPrompts),
    sentences: sentences.slice(0, 12),
    finalTask: {
      prompt:
        toText(safeData.finalTask?.prompt) ||
        "Describe what this video is mainly about in your own English.",
      checklist: toTextArray(safeData.finalTask?.checklist),
    },
    recommendedAssets: normalizeGeneratedAssets(safeData.recommendedAssets || safeData.assets, sourceUrl),
  };
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
All user-facing values in this JSON must be English, including title, goal, situationType, useWhen, learningExplanation, practicePrompt, transferPractice, and fullSpokenVersion.

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

app.post("/api/listening-pack", async (req, res) => {
  try {
    const sourceUrl = toText(req.body?.sourceUrl);
    const sourceText = toText(req.body?.sourceText);

    if (!sourceUrl && !sourceText) {
      return res.status(400).json({
        error: "Listening source is required",
        detail: "Paste a video/blog link or transcript text before generating a listening pack.",
      });
    }

    if (sourceUrl && !isHttpUrl(sourceUrl)) {
      return res.status(400).json({
        error: "Valid source URL is required",
        detail: "The source link must start with http or https.",
      });
    }

    const fetchedText = sourceText ? "" : await fetchPublicPageText(sourceUrl);
    const availableText = sourceText || fetchedText;
    const sourceHint = availableText
      ? availableText
      : "No pasted transcript or readable page text was found. If URL context is available, inspect public captions, transcript, page text, description, or visible text.";

    const prompt = `
You are SpeakFrame's Video Intensive Listening Lab builder.

The learner is a Chinese speaker who wants to understand real daily spoken English, not memorize random words.
Build a full listening study pack from the source. The video/blog itself should remain the main media, but transcript sentences become the training units.

Source URL:
${sourceUrl || "No URL provided"}

Transcript or pasted text:
${sourceHint}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.
Do not add explanation outside JSON.

JSON format:
{
  "sourceTitle": "",
  "sourceUrl": "",
  "sourceSummary": "",
  "listeningGoal": "",
  "beforeListening": [],
  "sentences": [
    {
      "original": "",
      "naturalSpeech": "",
      "meaningZh": "",
      "listeningProblem": "",
      "functionName": "",
      "pattern": "",
      "whyUse": "",
      "slots": [],
      "chunks": [
        { "text": "", "whyHard": "" }
      ],
      "extensionExamples": [],
      "replacementDrills": [],
      "saveSuggestions": [
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
  ],
  "finalTask": {
    "prompt": "",
    "checklist": []
  },
  "recommendedAssets": []
}

Rules:
1. Prefer daily-life, general conversation, plans, feelings, reactions, asking for help, explaining what happened, and small talk.
2. Extract 6-10 high-value sentences from the source. If the source has more text, choose the most useful lines for real listening and speaking.
3. Do not invent direct quotes if the source/transcript is not accessible. If only a topic is accessible, create a clearly adapted natural practice pack and say that in sourceSummary.
4. original is the clean transcript sentence.
5. naturalSpeech shows how it may sound in spoken English: gonna, wanna, weak forms, linking, reduced words. Keep it readable.
6. listeningProblem must explain why a learner may miss it: weak form, linking, speed, chunk boundary, unfamiliar pattern, or meaning prediction.
7. chunks must be short listenable units, not isolated vocabulary only.
8. pattern must be reusable with [slots].
9. whyUse explains the communication function, not grammar theory.
10. extensionExamples must include 4-6 natural variations.
11. replacementDrills must include exactly 10 fill-in or swap prompts when possible.
12. saveSuggestions should include 1-3 assets for each strong sentence.
13. recommendedAssets should include 4-8 best assets from the full pack.
14. All explanation fields except meaningZh can be English. meaningZh must be concise Chinese.
15. Asset recommendedType must be one of: "Pattern", "Chunk", "Native Expression", "Question Pattern", "Framework", "Useful Sentence", "Poetic Expression".
`;

    let rawText = "";

    if (availableText.length >= 250 || !sourceUrl) {
      rawText = await generateTextContent(prompt);
    } else {
      rawText = await generateVideoContent(prompt, { tools: [{ urlContext: {} }] });
    }

    const data = safeParseJson(rawText);
    const pack = normalizeListeningPack(data, sourceUrl);

    if (pack.sentences.length === 0) {
      return res.status(422).json({
        error: "No listening pack generated",
        detail: "I could not build a usable listening pack from this source. Paste transcript text if the page does not expose captions.",
      });
    }

    res.json(pack);
  } catch (err) {
    console.error("Listening pack error:", err);
    sendAiError(
      res,
      err,
      "Listening pack generation failed",
      "Listening pack generation failed. Please check the source, server connection, and API key."
    );
  }
});

app.post("/api/listening-review", async (req, res) => {
  try {
    const sourceTitle = toText(req.body?.sourceTitle);
    const sourceSummary = toText(req.body?.sourceSummary);
    const userSummary = toText(req.body?.userSummary);
    const sentenceNotes = Array.isArray(req.body?.sentenceNotes) ? req.body.sentenceNotes : [];

    if (!userSummary) {
      return res.status(400).json({
        error: "Summary is required",
        detail: "Write your understanding of the video before asking for a review.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's listening review coach.

Evaluate the learner's final output after a video intensive listening session.

Video title:
${sourceTitle}

Source summary:
${sourceSummary}

Learner sentence notes:
${JSON.stringify(sentenceNotes.slice(0, 12))}

Learner final summary:
${userSummary}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:
{
  "score": 0,
  "understanding": "",
  "mainProblems": [],
  "optimizedEnglish": "",
  "nextPractice": [],
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
1. score is 0-100 for listening understanding plus spoken summary quality.
2. understanding should be concise Chinese feedback.
3. mainProblems should diagnose concrete issues: missed chunks, unclear logic, weak detail, unnatural wording, or misunderstanding.
4. optimizedEnglish should rewrite the learner's summary naturally at B1-B2 level.
5. nextPractice gives 3 concrete listening actions.
6. Extract 3-6 reusable assets from the learner's weak points or optimized version.
`);

    const data = safeParseJson(rawText);

    res.json({
      score: Number(data.score) || 0,
      understanding: toText(data.understanding),
      mainProblems: toTextArray(data.mainProblems),
      optimizedEnglish: toText(data.optimizedEnglish),
      nextPractice: toTextArray(data.nextPractice),
      assets: normalizeGeneratedAssets(data.assets, ""),
    });
  } catch (err) {
    console.error("Listening review error:", err);
    sendAiError(
      res,
      err,
      "Listening review failed",
      "Listening review failed. Please check the server connection and API key."
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
  "situationType": {
    "name": "",
    "whyThisFrame": "",
    "useWhen": []
  },
  "coreFrame": {
    "name": "",
    "route": [],
    "plainExplanation": ""
  },
  "learningExplanation": {
    "whyThisFrameZh": "",
    "howToUseZh": "",
    "reuseSteps": [],
    "commonMistakeZh": ""
  },
  "highValueSentences": [
    {
      "sentence": "",
      "functionName": "",
      "whyUseful": "",
      "slots": [
        {
          "label": "",
          "current": "",
          "swaps": []
        }
      ],
      "scenarios": [],
      "chunks": []
    }
  ],
  "fullSpokenVersion": "",
  "transferPractice": [
    {
      "scenario": "",
      "swapFocus": "",
      "prompt": "",
      "sampleLine": ""
    }
  ],
  "practicePrompt": ""
}

Rules:
1. First diagnose the expression task. Do not just write an answer. Choose a reusable situation type such as Explain fit and motivation, Describe a complex situation, Tell a small story, Reflect on a change, Ask for an opportunity, Explain a problem, or Describe a process.
2. coreFrame.route must show the speaking route in 4-6 short move names, for example: Intention -> Limitation -> Strength -> Specific example -> Next step.
3. highValueSentences must contain 4-6 native compressed sentence frameworks. They should be longer than tiny sentences, natural, and reusable by swapping words.
4. Prefer high-value frames like: "I've been thinking about...", "Even though..., I still think...", "At first..., but after..., I started to...", "One thing I find challenging is..., not because..., but because...", "It started as..., but it turned into...", "So my next step is..., even if..., because...".
5. learningExplanation must be in clear English. It should explain why this frame fits the situation, how to study it, how to swap it, and one common mistake to avoid. This is learning guidance, not grammar lecture.
6. Each highValueSentences item must explain the function, why it is useful, replaceable slots, scenarios, and useful chunks. Make the learner understand when to use the sentence.
7. fullSpokenVersion must combine these sentences into one natural spoken paragraph that can describe a complex thing clearly.
8. transferPractice must give 3 scene swaps so the same frame can move to another situation.
9. For job-search-interview, include practical language for fit, motivation, experience, availability, and asking about opportunities.
10. Keep the style natural, practical, and reusable for Chinese learners. No grammar lecture.
11. If the user writes Chinese, infer the meaning but return the whole Structure result in English. Chinese should only appear in /api/translate-selection, not in this Structure result.
`);

    const data = safeParseJson(rawText);
    const situationType = data.situationType && typeof data.situationType === "object" ? data.situationType : {};
    const coreFrame = data.coreFrame && typeof data.coreFrame === "object" ? data.coreFrame : {};
    const learningExplanation =
      data.learningExplanation && typeof data.learningExplanation === "object" ? data.learningExplanation : {};
    const highValueSentences = Array.isArray(data.highValueSentences)
      ? data.highValueSentences
          .map((item) => {
            const safeItem = item && typeof item === "object" ? item : {};
            const slots = Array.isArray(safeItem.slots)
              ? safeItem.slots.map((slot) => {
                  const safeSlot = slot && typeof slot === "object" ? slot : {};
                  return {
                    label: toText(safeSlot.label),
                    current: toText(safeSlot.current),
                    swaps: toTextArray(safeSlot.swaps),
                  };
                })
              : [];

            return {
              sentence: toText(safeItem.sentence),
              functionName: toText(safeItem.functionName),
              whyUseful: toText(safeItem.whyUseful),
              slots,
              scenarios: toTextArray(safeItem.scenarios),
              chunks: toTextArray(safeItem.chunks),
            };
          })
          .filter((item) => item.sentence)
      : [];

    if (highValueSentences.length === 0) {
      return res.status(422).json({
        error: "No structure generated",
        detail: "I could not generate a usable expression structure yet.",
      });
    }

    const transferPractice = Array.isArray(data.transferPractice)
      ? data.transferPractice.map((item) => {
          const safeItem = item && typeof item === "object" ? item : {};
          return {
            scenario: toText(safeItem.scenario),
            swapFocus: toText(safeItem.swapFocus),
            prompt: toText(safeItem.prompt),
            sampleLine: toText(safeItem.sampleLine),
          };
        })
      : [];

    const layers = highValueSentences.map((item, index) => ({
      name: item.functionName || `Move ${index + 1}`,
      purpose: item.whyUseful,
      sentence: item.sentence,
      smallerMove: item.slots
        .map((slot) => [slot.current, ...slot.swaps.slice(0, 2)].filter(Boolean).join(" -> "))
        .filter(Boolean)
        .join("; "),
      recommendedAssets: item.chunks,
    }));

    res.json({
      title: toText(data.title) || topic,
      goal: toText(data.goal) || practiceGoal,
      situationType: {
        name: toText(situationType.name),
        whyThisFrame: toText(situationType.whyThisFrame),
        useWhen: toTextArray(situationType.useWhen),
      },
      coreFrame: {
        name: toText(coreFrame.name),
        route: toTextArray(coreFrame.route),
        plainExplanation: toText(coreFrame.plainExplanation),
      },
      learningExplanation: {
        whyThisFrameZh: toText(learningExplanation.whyThisFrameZh),
        howToUseZh: toText(learningExplanation.howToUseZh),
        reuseSteps: toTextArray(learningExplanation.reuseSteps),
        commonMistakeZh: toText(learningExplanation.commonMistakeZh),
      },
      highValueSentences,
      transferPractice,
      bigToSmallPath: toTextArray(coreFrame.route),
      layers,
      sampleAnswer: toText(data.fullSpokenVersion),
      fullSpokenVersion: toText(data.fullSpokenVersion),
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

app.post("/api/translate-selection", async (req, res) => {
  try {
    const text = toText(req.body?.text);
    const context = toText(req.body?.context);

    if (!text) {
      return res.status(400).json({
        error: "Text is required",
        detail: "Please send a word, phrase, or sentence to explain.",
      });
    }

    const rawText = await generateTextContent(`
You are SpeakFrame's concise bilingual expression explainer.

Selected English:
${text}

Context:
${context}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:
{
  "meaningZh": "",
  "usageZh": "",
  "naturalAlternatives": [],
  "example": ""
}

Rules:
1. Explain in Chinese.
2. Keep it short and practical for a Chinese learner.
3. If selected text is a single word, explain the meaning in this sentence and one natural collocation.
4. If selected text is a phrase or sentence, explain what expression function it performs.
5. naturalAlternatives should contain 2-4 useful English alternatives.
`);

    const data = safeParseJson(rawText);

    res.json({
      meaningZh: toText(data.meaningZh),
      usageZh: toText(data.usageZh),
      naturalAlternatives: toTextArray(data.naturalAlternatives),
      example: toText(data.example),
    });
  } catch (err) {
    console.error("Translate selection error:", err);
    sendAiError(
      res,
      err,
      "Selection explanation failed",
      "Selection explanation failed. Please check the server connection and API key."
    );
  }
});

app.post("/api/live-transcribe", async (req, res) => {
  try {
    const audioBase64 = toText(req.body?.audioBase64);
    const mimeType = (toText(req.body?.mimeType) || "audio/webm").split(";")[0];

    if (!audioBase64) {
      return res.status(400).json({
        error: "Audio is required",
        detail: "Please send an audio recording to transcribe.",
      });
    }

    const response = await videoAi.models.generateContent({
      model: process.env.VIDEO_MODEL || "gemini-2.5-flash-lite",
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
        {
          text: `
Transcribe this learner audio for an English practice call.

Rules:
1. Return ONLY raw JSON.
2. Do not use markdown or code blocks.
3. Keep the transcript in the language actually spoken.
4. If the learner mixes Chinese and English, keep both.
5. If the audio is empty or unclear, return an empty transcript.

JSON format:
{
  "transcript": "",
  "language": ""
}
`,
        },
      ],
    });

    const data = safeParseJson(response.text || "");

    res.json({
      transcript: toText(data.transcript),
      language: toText(data.language),
    });
  } catch (err) {
    console.error("Live transcription error:", err);
    sendAiError(
      res,
      err,
      "Live transcription failed",
      "Live transcription failed. Please check the audio model key or try again."
    );
  }
});

app.post("/api/live-practice", async (req, res) => {
  try {
    const scenario = toText(req.body?.scenario) || "daily-conversation";
    const focus = toText(req.body?.focus) || "question-understanding";
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
You are SpeakFrame's Scenario Drill English coach.

This is a stable speaking-output drill, not a live phone call.
The learner reads/listens to a realistic question, types an answer, and may ask in Chinese when stuck.

Scenario:
${scenario}

Focus:
${focus}

Conversation:
${JSON.stringify(messages)}

Return ONLY raw JSON.
Do not use markdown.
Do not use code block.

JSON format:
{
  "reply": "",
  "naturalVersion": "",
  "feedback": "",
  "usefulChunks": [],
  "scores": {
    "clarity": "",
    "naturalness": "",
    "chunkUse": ""
  },
  "isRescue": false,
  "rescue": {
    "naturalExpression": "",
    "pattern": "",
    "tryAgainPrompt": ""
  },
  "assets": []
}

Rules:
1. reply is the next coach line: one short realistic follow-up question or retry prompt.
2. naturalVersion rewrites the learner's answer into natural spoken English. Keep it 1-3 sentences.
3. feedback explains briefly what improved and what expression function it serves.
4. usefulChunks contains 2-5 reusable chunks or patterns from the natural version.
5. scores should be short labels like "Clear", "Needs detail", "Natural", "Use one saved chunk".
6. If the learner uses Chinese to ask how to say something, treat it as expression rescue.
7. For expression rescue, give the natural English sentence, a reusable pattern, then ask them to try again.
8. Adapt to focus:
   - question-understanding: ask realistic questions and keep them short.
   - natural-response: help the learner answer more naturally.
   - chunk-practice: include one useful chunk and ask the learner to reuse it.
   - shadowing: give one short line and ask the learner to repeat or adapt it.
   - rescue-in-chinese: be ready to rescue Chinese questions with natural English.
9. Adapt to scenario:
   - part-time-service-job: bar, restaurant, cafe, retail, service work, availability, customers, shifts.
   - job-search-interview: fit, motivation, experience, availability, strengths.
   - daily-small-talk: everyday moments, follow-up questions, natural reactions.
   - workplace-communication: updates, problems, clarification, suggestions.
   - personal-reflection: feelings, changes, decisions, lessons.
10. assets should include 1-3 saveable expression assets extracted from the learner's weak point or natural version.
11. Each asset must use this shape:
{
  "type": "Chunk | Pattern | Native Expression | Question Pattern | Useful Sentence",
  "text": "",
  "sourceSentence": "",
  "functionName": "",
  "expressionFunction": "",
  "rootPattern": "",
  "scenarios": [],
  "examples": [],
  "tags": [],
  "notes": ""
}
12. Keep explanations concise. This is a drill screen.
`);

    const data = safeParseJson(rawText);

    res.json({
      reply: toText(data.reply) || "Good. Can you say a little more about that?",
      naturalVersion: toText(data.naturalVersion),
      feedback: toText(data.feedback),
      usefulChunks: toTextArray(data.usefulChunks),
      scores: data.scores && typeof data.scores === "object"
        ? {
            clarity: toText(data.scores.clarity),
            naturalness: toText(data.scores.naturalness),
            chunkUse: toText(data.scores.chunkUse),
          }
        : null,
      isRescue: Boolean(data.isRescue),
      rescue: data.rescue && typeof data.rescue === "object"
        ? {
            naturalExpression: toText(data.rescue.naturalExpression),
            pattern: toText(data.rescue.pattern),
            tryAgainPrompt: toText(data.rescue.tryAgainPrompt),
          }
        : null,
      assets: normalizeGeneratedAssets(data.assets, "scenario-drill").map((asset) => ({
        type: asset.recommendedType,
        text: asset.assetText,
        sourceSentence: asset.sourceSentence,
        functionName: asset.functionName,
        expressionFunction: asset.expressionFunction,
        rootPattern: asset.rootPattern,
        scenarios: asset.scenarios,
        examples: asset.examples,
        tags: asset.tags,
        notes: asset.notes,
      })),
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
    const focus = toText(req.body?.focus) || "question-understanding";
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
You are SpeakFrame's scenario drill summarizer.

Summarize the learner's scenario output drill and extract reusable expression assets.

Scenario:
${scenario}

Focus:
${focus}

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



