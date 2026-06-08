import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageSquare,
  Library,
  Shuffle,
  Send,
  Mic,
  Save,
  X,
  Search,
  Sparkles,
  Trash2,
  Plus,
  ChevronRight,
  Layers,
  Headphones,
  Play,
  Square,
  SkipForward,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react';
import './styles.css';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '');
const uid = () => Math.random().toString(36).slice(2, 10);
const MIN_RECOMBINE_ASSETS = 2;
const MAX_RECOMBINE_ASSETS = 6;
const ASSET_TYPES = [
  'All',
  'Chunk',
  'Pattern',
  'Native Expression',
  'Question Pattern',
  'Framework',
  'Useful Sentence',
  'Poetic Expression',
];
const ASSET_GOALS = [
  {
    id: 'explain-opinion',
    label: 'Explain Opinion',
    purpose: 'Explain one view clearly with a reusable point, reason, example, contrast, and takeaway.',
    keywords: ['opinion', 'reason', 'explain', 'because', 'why', 'point', 'think', 'realize'],
  },
  {
    id: 'job-search-interview',
    label: 'Job Search / Interview',
    purpose: 'Use general job-search language for fit, motivation, experience, availability, and next steps.',
    keywords: ['interview', 'job', 'fit', 'role', 'work', 'value', 'experience', 'available', 'apply'],
  },
  {
    id: 'daily-questions',
    label: 'Daily Questions',
    purpose: 'Ask common but useful daily questions naturally, including time, plans, needs, and follow-ups.',
    keywords: ['question', 'ask', 'follow', 'clarify', 'plan', 'need', 'how long', 'where', 'when'],
  },
  {
    id: 'part-time-service-job',
    label: 'Part-time Service Job',
    purpose: 'Practice practical language for bar, restaurant, cafe, retail, and clothing-store part-time work.',
    keywords: ['part-time', 'bar', 'restaurant', 'cafe', 'retail', 'clothing', 'customer', 'shift', 'service'],
  },
  {
    id: 'daily-small-talk',
    label: 'Daily Life Small Talk',
    purpose: 'Tell a small everyday moment clearly: setup, tiny detail, feeling, reaction, and follow-up.',
    keywords: ['daily', 'small talk', 'life', 'story', 'feeling', 'coffee', 'weekend', 'conversation'],
  },
  {
    id: 'workplace-communication',
    label: 'Workplace Communication',
    purpose: 'Communicate clearly in meetings, support, sales, and collaboration.',
    keywords: ['workplace', 'meeting', 'support', 'sales', 'team', 'suggest'],
  },
  {
    id: 'personal-reflection',
    label: 'Personal Reflection',
    purpose: 'Talk about change, realization, feeling, and personal growth.',
    keywords: ['growth', 'change', 'realize', 'feeling', 'reflect', 'time'],
  },
];

const PRACTICE_GOALS = ASSET_GOALS.filter((goal) =>
  ['job-search-interview', 'workplace-communication', 'daily-small-talk', 'personal-reflection'].includes(goal.id)
);

const initialMessages = [
  {
    id: uid(),
    role: 'assistant',
    content:
      'Hi, I am your expression coach. Tell me something you cannot say, ask, expand, or describe in English. Then click any sentence in my reply to save it as an expression asset.',
  },
];

function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];

  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadAssets() {
  try {
    const data = localStorage.getItem('speakframe_assets');

    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeAssetList(parsed);
  } catch (err) {
    console.error('loadAssets error:', err);
    return [];
  }
}

function saveAssets(assets) {
  localStorage.setItem('speakframe_assets', JSON.stringify(Array.isArray(assets) ? assets : []));
}

async function readApiJson(res, fallbackMessage = 'API request failed') {
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(`${fallbackMessage}. The server returned a non-JSON response${preview ? `: ${preview}` : '.'}`);
  }

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`${fallbackMessage}. The server returned invalid JSON.`);
  }
}

async function appendAssetsToDb(assets) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const chunkSize = 4;

  for (let index = 0; index < safeAssets.length; index += chunkSize) {
    const chunk = safeAssets.slice(index, index + chunkSize);
    const res = await fetch(`${API_BASE}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: chunk }),
    });
    const data = await readApiJson(res, 'Asset database append failed');

    if (!res.ok || data.error) {
      throw new Error(data.detail || data.error || 'Asset database append failed');
    }

  }

  return safeAssets;
}

async function deleteAssetFromDb(id) {
  const res = await fetch(`${API_BASE}/api/assets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await readApiJson(res, 'Asset delete failed');

  if (!res.ok || data.error) {
    throw new Error(data.detail || data.error || 'Asset delete failed');
  }

  return data.deletedId || id;
}

async function persistNewAssets(nextAssets, newAssets) {
  const safeNextAssets = Array.isArray(nextAssets) ? nextAssets : [];
  const safeNewAssets = Array.isArray(newAssets) ? newAssets : [];

  saveAssets(safeNextAssets);
  await appendAssetsToDb(safeNewAssets);
  return safeNextAssets;
}

function toText(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    if (value.name && value.description) {
      return `${value.name}: ${value.description}`;
    }

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

function normalizeAssetType(value) {
  const raw = toText(value);

  if (raw === 'Local Expression') return 'Native Expression';
  if (ASSET_TYPES.includes(raw)) return raw;
  if (raw.toLowerCase().includes('question')) return 'Question Pattern';
  if (raw.toLowerCase().includes('native')) return 'Native Expression';
  if (raw.toLowerCase().includes('poetic')) return 'Poetic Expression';
  if (raw.toLowerCase().includes('sentence')) return 'Useful Sentence';

  return raw || 'Chunk';
}

function inferComboRole(asset) {
  const haystack = `${toText(asset.comboRole)} ${toText(asset.expressionFunction)} ${toText(asset.functionName)} ${toText(asset.text)} ${toText(asset.rootPattern)}`.toLowerCase();

  if (haystack.includes('question') || haystack.includes('ask')) return 'question';
  if (haystack.includes('reason') || haystack.includes('why') || haystack.includes('because')) return 'reason';
  if (haystack.includes('example') || haystack.includes('detail')) return 'detail';
  if (haystack.includes('result') || haystack.includes('closing') || haystack.includes('summary')) return 'closing';
  if (haystack.includes('framework')) return 'framework';

  return 'support';
}

function normalizeAsset(item, defaults = {}) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const text = toText(safeItem.assetText || safeItem.text || safeItem.sourceSentence);

  return {
    id: toText(safeItem.id) || uid(),
    type: normalizeAssetType(safeItem.recommendedType || safeItem.type || defaults.type),
    text,
    sourceSentence: toText(safeItem.sourceSentence || safeItem.text || safeItem.assetText),
    meaning: toText(safeItem.meaning),
    functionName: toText(safeItem.functionName) || toText(defaults.functionName),
    expressionFunction:
      toText(safeItem.expressionFunction) ||
      toText(safeItem.functionName) ||
      toText(defaults.expressionFunction) ||
      'Reusable expression',
    rootPattern: toText(safeItem.rootPattern) || toText(defaults.rootPattern) || text,
    slots: toTextArray(safeItem.slots),
    scenarios: toTextArray(safeItem.scenarios),
    examples: toTextArray(safeItem.examples),
    tags: toTextArray(safeItem.tags || defaults.tags),
    comboRole: toText(safeItem.comboRole) || inferComboRole(safeItem),
    difficulty: toText(safeItem.difficulty) || toText(defaults.difficulty) || 'B1-B2',
    notes: toText(safeItem.notes) || toText(defaults.notes),
    sourceType: toText(safeItem.sourceType) || toText(defaults.sourceType) || 'Manual',
    sourceUrl: toText(safeItem.sourceUrl) || toText(defaults.sourceUrl),
    theme: toText(safeItem.theme) || toText(defaults.theme),
    createdAt: toText(safeItem.createdAt) || new Date().toISOString(),
  };
}

function normalizeAssetList(items, defaults = {}) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeAsset(item, defaults)).filter((asset) => asset.text);
}

function getAssetGoal(goalId) {
  return ASSET_GOALS.find((goal) => goal.id === goalId) || ASSET_GOALS[0];
}

function getPracticeGoal(goalId) {
  return PRACTICE_GOALS.find((goal) => goal.id === goalId) || PRACTICE_GOALS[0];
}

function scoreAssetForGoal(asset, goal) {
  const haystack = `${toText(asset.type)} ${toText(asset.text)} ${toText(asset.functionName)} ${toText(asset.expressionFunction)} ${toText(asset.comboRole)} ${toText(asset.theme)} ${(asset.tags || []).join(' ')} ${(asset.scenarios || []).join(' ')}`.toLowerCase();
  let score = 0;

  goal.keywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 3;
  });

  if (asset.comboRole === 'framework') score += 2;
  if (asset.comboRole === 'opener') score += 2;
  if (asset.comboRole === 'reason') score += 2;
  if (asset.comboRole === 'question' && goal.id === 'daily-questions') score += 5;
  if (asset.type === 'Framework') score += 2;
  if (asset.type === 'Framework' && toText(asset.sourceType) === 'Structure') score += 4;
  if (asset.type === 'Question Pattern' && goal.id === 'daily-questions') score += 4;

  return score;
}

function getRecommendedCombo(assets, goalId) {
  const goal = getPracticeGoal(goalId);
  const safeAssets = Array.isArray(assets) ? assets : [];
  const sorted = safeAssets
    .map((asset) => ({ asset, score: scoreAssetForGoal(asset, goal) }))
    .sort((a, b) => b.score - a.score);
  const picked = [];
  const usedRoles = new Set();

  sorted.forEach(({ asset }) => {
    if (picked.length >= MAX_RECOMBINE_ASSETS) return;

    const role = toText(asset.comboRole) || 'support';
    if (picked.length < MIN_RECOMBINE_ASSETS || !usedRoles.has(role) || role === 'support') {
      picked.push(asset);
      usedRoles.add(role);
    }
  });

  if (picked.length < MIN_RECOMBINE_ASSETS) {
    safeAssets.forEach((asset) => {
      if (picked.length < MIN_RECOMBINE_ASSETS && !picked.some((item) => item.id === asset.id)) {
        picked.push(asset);
      }
    });
  }

  return picked.slice(0, MAX_RECOMBINE_ASSETS);
}

function getAssetListenText(asset) {
  const examples = toTextArray(asset?.examples).slice(0, 2);
  const parts = [
    toText(asset?.sourceSentence),
    examples.join(' '),
    toText(asset?.rootPattern),
    toText(asset?.notes),
  ].filter(Boolean);

  const uniqueParts = [...new Set(parts)];
  return uniqueParts.join(' ') || toText(asset?.text);
}

function buildStructureAssets(structurePlan, structureDraft, practiceGoal) {
  if (!structurePlan) return [];

  const goal = getPracticeGoal(practiceGoal);
  const layers = Array.isArray(structurePlan.layers) ? structurePlan.layers : [];
  const spokenText = toText(structureDraft) || toText(structurePlan.sampleAnswer);
  const path = toTextArray(structurePlan.bigToSmallPath);
  const title = toText(structurePlan.title) || 'Reusable speaking frame';
  const sharedScenarios = [
    goal.label,
    'Recombination practice',
    'Speaking practice',
    ...toTextArray(structurePlan.scenarios),
  ];

  const framework = normalizeAsset(
    {
      type: 'Framework',
      text: title,
      sourceSentence: spokenText,
      functionName: '表达框架 - Reusable speaking frame',
      expressionFunction: 'Organize a complete answer and reuse it in new situations',
      comboRole: 'framework',
      rootPattern: path.length > 0 ? path.join(' -> ') : layers.map((layer) => toText(layer.name)).join(' -> '),
      scenarios: sharedScenarios,
      examples: [spokenText].filter(Boolean),
      tags: ['structure', 'framework', 'recombine', goal.id],
      difficulty: 'B1-B2',
      theme: toText(structurePlan.goal) || goal.label,
      notes: toText(structurePlan.practicePrompt) || 'Saved from Structure practice.',
    },
    { sourceType: 'Structure' }
  );

  const sentenceAssets = layers
    .slice(0, MAX_RECOMBINE_ASSETS - 1)
    .map((layer, index) =>
      normalizeAsset(
        {
          type: 'Pattern',
          text: toText(layer.sentence),
          sourceSentence: toText(layer.sentence),
          functionName: toText(layer.name) || `Move ${index + 1}`,
          expressionFunction: toText(layer.purpose) || 'Reusable sentence move inside a speaking frame',
          comboRole:
            index === 0
              ? 'opener'
              : index === layers.length - 1
                ? 'closing'
                : toText(layer.name).toLowerCase().includes('reason')
                  ? 'reason'
                  : 'detail',
          rootPattern: toText(layer.sentence),
          scenarios: sharedScenarios,
          examples: [toText(layer.smallerMove), ...toTextArray(layer.recommendedAssets)].filter(Boolean),
          tags: ['structure-sentence', 'native-frame', goal.id],
          difficulty: 'B1-B2',
          theme: title,
          notes: 'Sentence move generated from a Structure frame. Use it with the Framework asset in Recombination.',
        },
        { sourceType: 'Structure' }
      )
    )
    .filter((asset) => asset.text);

  return [framework, ...sentenceAssets].slice(0, MAX_RECOMBINE_ASSETS);
}

function friendlyErrorMessage(value, fallback) {
  const message = toText(value);
  const lower = message.toLowerCase();

  if (
    lower.includes('quota exceeded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('generate_content_free_tier_requests')
  ) {
    return 'Gemini quota has been used up for now. Please wait for the quota reset, upgrade billing, or switch API key.';
  }

  if (message.trim().startsWith('{') || message.length > 220) {
    return fallback;
  }

  return message || fallback;
}

function App() {
  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState('express');
  const [insight, setInsight] = useState(null);
  const [assets, setAssets] = useState(loadAssets);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [assetGoal, setAssetGoal] = useState(ASSET_GOALS[0].id);
  const [practiceGoal, setPracticeGoal] = useState(PRACTICE_GOALS[0].id);
  const [practice, setPractice] = useState(null);
  const [structureTopic, setStructureTopic] = useState('');
  const [structurePlan, setStructurePlan] = useState(null);
  const [structureDraft, setStructureDraft] = useState('');
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveScenario, setLiveScenario] = useState('technical-sales');
  const [liveActive, setLiveActive] = useState(false);
  const [liveListening, setLiveListening] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [selectedInsightSentence, setSelectedInsightSentence] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [notice, setNotice] = useState(null);
  const recognitionRef = useRef(null);
  const liveRecognitionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssetsFromDb() {
      try {
        const res = await fetch(`${API_BASE}/api/assets`);
        const data = await readApiJson(res, 'Assets load failed');

        if (!res.ok || data.error || cancelled) {
          return;
        }

        const dbAssets = normalizeAssetList(data.assets);

        if (dbAssets.length > 0) {
          setAssets(dbAssets);
          saveAssets(dbAssets);
        } else if (Array.isArray(assets) && assets.length > 0) {
          appendAssetsToDb(assets).then((savedAssets) => {
            if (!cancelled) {
              setAssets(savedAssets);
              saveAssets(savedAssets);
            }
          });
        }
      } catch (err) {
        console.error('loadAssetsFromDb error:', err);
      }
    }

    loadAssetsFromDb();

    return () => {
      cancelled = true;
    };
  }, []);

  function normalizeInsight(data, sentence) {
    const safeData = data && typeof data === 'object' ? data : {};

    return {
      sourceSentence: toText(safeData.sourceSentence) || sentence,
      recommendedType: toText(safeData.recommendedType) || 'Pattern',
      assetText: toText(safeData.assetText) || toText(safeData.rootPattern) || sentence,
      meaning: toText(safeData.meaning),
      functionName:
        toText(safeData.functionName) ||
        toText(safeData.function) ||
        'Reusable expression',
      rootPattern: toText(safeData.rootPattern) || 'Reusable sentence pattern',
      slots: toTextArray(safeData.slots),
      scenarios: toTextArray(safeData.scenarios),
      examples: toTextArray(safeData.examples),
      notes:
        toText(safeData.notes) ||
        'This expression can be saved and reused in similar situations.',
      expressionFunction: toText(safeData.expressionFunction) || toText(safeData.functionName),
      comboRole: toText(safeData.comboRole),
      tags: toTextArray(safeData.tags),
      difficulty: toText(safeData.difficulty),
      theme: toText(safeData.theme),
    };
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();

    const userMessage = {
      id: uid(),
      role: 'user',
      content: userText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setNotice(null);
    setLoading(true);

    try {
      const endpoint = chatMode === 'extract' ? '/api/text-assets' : '/api/conversation';
      const history = messages
        .slice(-10)
        .map((message) => ({
          role: message.role,
          content: toText(message.content),
        }))
        .filter((message) => message.content);
      const payload = chatMode === 'extract' ? { text: userText } : { message: userText, history };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await readApiJson(res, 'Conversation API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Conversation API failed');
      }

      if (chatMode === 'extract') {
        const generatedAssets = normalizeAssetList(data.assets, {
          sourceType: 'Text',
          functionName: 'Text expression asset',
          expressionFunction: 'Extracted reusable expression',
          rootPattern: 'Reusable expression from pasted text',
          notes: 'Captured from pasted text for later review.',
        });

        if (generatedAssets.length === 0) {
          throw new Error('No useful assets were found in this text.');
        }

        const next = [...generatedAssets, ...(Array.isArray(assets) ? assets : [])];

        const savedAssets = await persistNewAssets(next, generatedAssets);
        setAssets(savedAssets);
        setNotice({
          type: 'success',
          message: `Added ${generatedAssets.length} text assets to your library.`,
        });

        const reply = {
          id: uid(),
          role: 'assistant',
          content:
            toText(data.summary) ||
            `I extracted ${generatedAssets.length} reusable assets and saved them to your Asset Library.`,
        };

        setMessages((prev) => [...prev, reply]);
        return;
      }

      const reply = {
        id: uid(),
        role: 'assistant',
        content: data.reply || 'Sorry, I could not generate a reply.',
      };

      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error('sendMessage error:', err);

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: friendlyErrorMessage(
            err.message,
            'I could not generate a reply yet. Please check the server and API key, then try again.'
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSentence(sentence) {
    if (insightLoading || !sentence) return;

    setInsight(null);
    setNotice(null);
    setSelectedInsightSentence(sentence);
    setInsightLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });

      const data = await readApiJson(res, 'Insight API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Insight API failed');
      }

      setInsight(normalizeInsight(data, sentence));
    } catch (err) {
      console.error('analyzeSentence error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Insight failed. Please check the server connection and try this sentence again.'
        ),
      });
    } finally {
      setInsightLoading(false);
      setSelectedInsightSentence('');
    }
  }

  async function addAssetFromInsight(item) {
    const asset = normalizeAsset(item, {
      sourceType: 'Insight',
      type: 'Pattern',
      notes: 'Saved from sentence insight.',
    });

    const next = [asset, ...(Array.isArray(assets) ? assets : [])];

    try {
      const savedAssets = await persistNewAssets(next, [asset]);
      setAssets(savedAssets);
      setInsight(null);
      setNotice({ type: 'success', message: 'Saved to your expression assets.' });
      setTab('assets');
    } catch (err) {
      console.error('addAssetFromInsight error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Asset save failed. Please try again.'),
      });
    }
  }

  async function parseVideoAssets(videoUrl) {
    const safeUrl = toText(videoUrl);

    if (!safeUrl || videoLoading) return false;

    setNotice(null);
    setVideoLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/video-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: safeUrl }),
      });

      const data = await readApiJson(res, 'Video asset API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Video asset API failed');
      }

      const generatedAssets = normalizeAssetList(data.assets, {
        sourceType: 'Video',
        sourceUrl: safeUrl,
        functionName: 'Video expression asset',
        expressionFunction: 'Expression from video context',
        rootPattern: 'Reusable expression from video',
        notes: 'Captured from a video link for later review.',
      });

      if (generatedAssets.length === 0) {
        throw new Error('No useful assets were found from this video link.');
      }

      const next = [...generatedAssets, ...(Array.isArray(assets) ? assets : [])];

      const savedAssets = await persistNewAssets(next, generatedAssets);
      setAssets(savedAssets);
      setNotice({
        type: 'success',
        message: `Added ${generatedAssets.length} video assets to your library.`,
      });

      return true;
    } catch (err) {
      console.error('parseVideoAssets error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Video parsing failed. If the platform blocks transcripts, paste a transcript in a future version.'
        ),
      });
      return false;
    } finally {
      setVideoLoading(false);
    }
  }

  async function generateDailyAssets() {
    if (dailyLoading) return false;

    const contextAssets = (Array.isArray(assets) ? assets : []).slice(0, 20).map((asset) => ({
      text: toText(asset.text),
      type: normalizeAssetType(asset.type),
      expressionFunction: toText(asset.expressionFunction),
      comboRole: toText(asset.comboRole),
      theme: toText(asset.theme),
      tags: Array.isArray(asset.tags) ? asset.tags.slice(0, 4) : [],
    }));

    setNotice(null);
    setDailyLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/daily-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: contextAssets, practiceGoal: assetGoal }),
      });

      const data = await readApiJson(res, 'Daily recommendation API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Daily recommendation API failed');
      }

      const generatedAssets = normalizeAssetList(data.assets, {
        sourceType: 'Daily',
        functionName: 'Daily recommended expression',
        expressionFunction: 'Daily connected expression',
        rootPattern: 'Reusable daily expression',
        notes: 'Daily recommendation for connected output practice.',
        theme: toText(data.theme) || getAssetGoal(assetGoal).label,
      });

      if (generatedAssets.length === 0) {
        throw new Error('No daily recommendations were generated.');
      }

      const next = [...generatedAssets, ...(Array.isArray(assets) ? assets : [])];

      const savedAssets = await persistNewAssets(next, generatedAssets);
      setAssets(savedAssets);
      setNotice({
        type: 'success',
        message: `Added ${generatedAssets.length} daily recommendations to your library.`,
      });

      return true;
    } catch (err) {
      console.error('generateDailyAssets error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Daily recommendation failed. Please check the server connection and API key.'
        ),
      });
      return false;
    } finally {
      setDailyLoading(false);
    }
  }

  async function deleteAsset(id) {
    const next = (Array.isArray(assets) ? assets : []).filter((a) => a.id !== id);

    try {
      await deleteAssetFromDb(id);
      setAssets(next);
      saveAssets(next);
      setSelectedAssetIds((ids) => ids.filter((x) => x !== id));
    } catch (err) {
      console.error('deleteAsset error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Delete failed. Please try again.'),
      });
    }
  }

  async function generateStructurePlan() {
    const topic = structureTopic.trim();

    if (!topic || structureLoading) {
      if (!topic) {
        setNotice({ type: 'error', message: 'Enter a topic or idea before building a structure.' });
      }
      return;
    }

    const assetContext = (Array.isArray(assets) ? assets : []).slice(0, 20).map((asset) => ({
      text: toText(asset.text),
      type: normalizeAssetType(asset.type),
      expressionFunction: toText(asset.expressionFunction),
      comboRole: toText(asset.comboRole),
      theme: toText(asset.theme),
      tags: Array.isArray(asset.tags) ? asset.tags.slice(0, 4) : [],
    }));

    setNotice(null);
    setStructureLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/structure-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          practiceGoal,
          assets: assetContext,
        }),
      });

      const data = await readApiJson(res, 'Structure API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Structure API failed');
      }

      const layers = Array.isArray(data.layers)
        ? data.layers.map((layer) => ({
            name: toText(layer.name),
            purpose: toText(layer.purpose),
            sentence: toText(layer.sentence),
            smallerMove: toText(layer.smallerMove),
            recommendedAssets: toTextArray(layer.recommendedAssets),
          }))
        : [];

      if (layers.length === 0) {
        throw new Error('No structure layers were generated.');
      }

      const plan = {
        title: toText(data.title) || topic,
        goal: toText(data.goal) || getPracticeGoal(practiceGoal).label,
        bigToSmallPath: toTextArray(data.bigToSmallPath),
        layers,
        sampleAnswer: toText(data.sampleAnswer),
        practicePrompt: toText(data.practicePrompt),
      };

      setStructurePlan(plan);
      setStructureDraft(plan.sampleAnswer);
    } catch (err) {
      console.error('generateStructurePlan error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Structure practice failed. Please check the server connection and API key.'
        ),
      });
    } finally {
      setStructureLoading(false);
    }
  }

  async function saveStructureAsAsset() {
    if (!structurePlan) return;

    const newAssets = buildStructureAssets(structurePlan, structureDraft, practiceGoal);
    const next = [...newAssets, ...(Array.isArray(assets) ? assets : [])];

    try {
      const savedAssets = await persistNewAssets(next, newAssets);
      setAssets(savedAssets);
      setNotice({ type: 'success', message: 'Saved this structure as a Framework set.' });
      setTab('assets');
    } catch (err) {
      console.error('saveStructureAsAsset error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Structure save failed. Please try again.'),
      });
    }
  }

  async function practiceStructureFrame() {
    if (!structurePlan) return;

    const newAssets = buildStructureAssets(structurePlan, structureDraft, practiceGoal);
    const next = [...newAssets, ...(Array.isArray(assets) ? assets : [])];

    try {
      const savedAssets = await persistNewAssets(next, newAssets);
      setAssets(savedAssets);
      setSelectedAssetIds(newAssets.map((asset) => asset.id));
      setPractice(null);
      setTab('recombine');
      setNotice({
        type: 'success',
        message: 'Structure frame is ready in Recombination. Generate a practice to reuse it in a new scene.',
      });
    } catch (err) {
      console.error('practiceStructureFrame error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Could not prepare this frame for Recombination.'),
      });
    }
  }

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice({
        type: 'error',
        message: 'Voice input is not supported in this browser. Chrome or Edge should work better.',
      });
      return;
    }

    if (voiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceListening(true);
      setNotice(null);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        setInput(transcript);
      }
    };

    recognition.onerror = () => {
      setNotice({
        type: 'error',
        message: 'Voice input failed. Please check microphone permission and try again.',
      });
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function speakLive(text) {
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function sendLiveTurn(transcript) {
    const userText = toText(transcript);
    if (!userText || liveLoading) return;

    const userMessage = { id: uid(), role: 'user', content: userText };
    const nextMessages = [...liveMessages, userMessage];

    setLiveMessages(nextMessages);
    setLiveLoading(true);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/api/live-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: liveScenario,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: toText(message.content),
          })),
        }),
      });

      const data = await readApiJson(res, 'Live practice API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Live practice API failed');
      }

      const assistantMessage = {
        id: uid(),
        role: 'assistant',
        content: toText(data.reply),
        rescue: data.rescue || null,
      };

      setLiveMessages((prev) => [...prev, assistantMessage]);
      speakLive(assistantMessage.content);
    } catch (err) {
      console.error('sendLiveTurn error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Live practice failed. Please check the server connection and API key.'
        ),
      });
    } finally {
      setLiveLoading(false);
    }
  }

  async function startLiveSession() {
    setLiveActive(true);
    setLiveSummary(null);
    const opening = {
      id: uid(),
      role: 'assistant',
      content:
        'Let us practice like a voice call. I will ask you questions, and if you get stuck, you can ask in Chinese and I will help you say it naturally in English. First, tell me a little about yourself.',
    };
    setLiveMessages([opening]);
    speakLive(opening.content);
  }

  function stopLiveListening() {
    if (liveRecognitionRef.current) {
      liveRecognitionRef.current.stop();
    }
    setLiveListening(false);
  }

  function startLiveListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice({
        type: 'error',
        message: 'Live voice input is not supported in this browser. Chrome or Edge should work better.',
      });
      return;
    }

    if (liveListening) {
      stopLiveListening();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setLiveListening(true);
      setNotice(null);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        sendLiveTurn(transcript);
      }
    };

    recognition.onerror = () => {
      setNotice({
        type: 'error',
        message: 'Live voice failed. Please check microphone permission and try again.',
      });
    };

    recognition.onend = () => {
      setLiveListening(false);
      liveRecognitionRef.current = null;
    };

    liveRecognitionRef.current = recognition;
    recognition.start();
  }

  async function endLiveSession() {
    stopLiveListening();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setLiveActive(false);

    if (liveMessages.length < 2) return;

    setLiveLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/live-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: liveScenario,
          messages: liveMessages.map((message) => ({
            role: message.role,
            content: toText(message.content),
          })),
        }),
      });

      const data = await readApiJson(res, 'Live summary API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Live summary API failed');
      }

      setLiveSummary({
        feedback: toText(data.feedback),
        assets: normalizeAssetList(data.assets, {
          sourceType: 'Live',
          functionName: 'Live practice expression',
          expressionFunction: 'Fix or improve spoken expression',
          notes: 'Extracted from live voice practice.',
        }),
      });
    } catch (err) {
      console.error('endLiveSession error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Live summary failed. Please check the server connection and API key.'
        ),
      });
    } finally {
      setLiveLoading(false);
    }
  }

  async function saveLiveAsset(asset) {
    const normalized = normalizeAsset(asset, {
      sourceType: 'Live',
      notes: 'Saved from live practice summary.',
    });
    const next = [normalized, ...(Array.isArray(assets) ? assets : [])];
    try {
      const savedAssets = await persistNewAssets(next, [normalized]);
      setAssets(savedAssets);
      setNotice({ type: 'success', message: 'Saved live practice expression to Assets.' });
    } catch (err) {
      console.error('saveLiveAsset error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Live practice asset save failed. Please try again.'),
      });
    }
  }

  async function generatePractice() {
    const selected = (Array.isArray(assets) ? assets : []).filter((a) =>
      selectedAssetIds.includes(a.id)
    );

    if (selected.length < MIN_RECOMBINE_ASSETS || practiceLoading) {
      if (selected.length < MIN_RECOMBINE_ASSETS) {
        setNotice({
          type: 'error',
          message: `Select at least ${MIN_RECOMBINE_ASSETS} assets before generating practice.`,
        });
      }
      return;
    }

    setNotice(null);
    setPracticeLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/recombine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: selected, practiceGoal }),
      });

      const data = await readApiJson(res, 'Recombination API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Recombination API failed');
      }

      setPractice({
        prompt: toText(data.question) || 'Use the selected assets to answer a practice question.',
        scenario: toText(data.scenario) || 'Practice',
        mustUse: Array.isArray(data.mustUse) ? toTextArray(data.mustUse) : selected.map((a) => toText(a.text)),
        sample: toText(data.sampleAnswer),
      });
    } catch (err) {
      console.error('generatePractice error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Practice generation failed. Please check the server connection and try again.'
        ),
      });
    } finally {
      setPracticeLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar tab={tab} setTab={setTab} assetCount={(Array.isArray(assets) ? assets : []).length} />

      <main className="main-panel">
        {notice && (
          <div className={`app-notice ${notice.type}`}>
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notice">
              <X size={15} />
            </button>
          </div>
        )}

        {tab === 'chat' && (
          <ChatPage
            messages={messages}
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            analyzeSentence={analyzeSentence}
            loading={loading}
            insightLoading={insightLoading}
            selectedInsightSentence={selectedInsightSentence}
            chatMode={chatMode}
            setChatMode={setChatMode}
            voiceListening={voiceListening}
            toggleVoiceInput={toggleVoiceInput}
          />
        )}

        {tab === 'assets' && (
          <AssetsPage
            assets={assets}
            deleteAsset={deleteAsset}
            parseVideoAssets={parseVideoAssets}
            videoLoading={videoLoading}
            generateDailyAssets={generateDailyAssets}
            dailyLoading={dailyLoading}
            assetGoal={assetGoal}
            setAssetGoal={setAssetGoal}
          />
        )}

        {tab === 'structure' && (
          <StructurePage
            assets={assets}
            practiceGoal={practiceGoal}
            setPracticeGoal={setPracticeGoal}
            structureTopic={structureTopic}
            setStructureTopic={setStructureTopic}
            structurePlan={structurePlan}
            structureDraft={structureDraft}
            setStructureDraft={setStructureDraft}
            structureLoading={structureLoading}
            generateStructurePlan={generateStructurePlan}
            saveStructureAsAsset={saveStructureAsAsset}
            practiceStructureFrame={practiceStructureFrame}
          />
        )}

        {tab === 'listen' && (
          <ListenPage
            assets={assets}
            practice={practice}
            structurePlan={structurePlan}
          />
        )}

        {tab === 'live' && (
          <LivePracticePage
            scenario={liveScenario}
            setScenario={setLiveScenario}
            messages={liveMessages}
            active={liveActive}
            listening={liveListening}
            loading={liveLoading}
            summary={liveSummary}
            startSession={startLiveSession}
            startListening={startLiveListening}
            endSession={endLiveSession}
            saveAsset={saveLiveAsset}
          />
        )}

        {tab === 'recombine' && (
          <RecombinePage
            assets={assets}
            selectedAssetIds={selectedAssetIds}
            setSelectedAssetIds={setSelectedAssetIds}
            generatePractice={generatePractice}
            practice={practice}
            practiceLoading={practiceLoading}
            practiceGoal={practiceGoal}
            setPracticeGoal={setPracticeGoal}
          />
        )}
      </main>

      {insight && (
        <InsightDrawer
          insight={insight}
          onClose={() => setInsight(null)}
          onSave={() => addAssetFromInsight(insight)}
        />
      )}
    </div>
  );
}

function Sidebar({ tab, setTab, assetCount }) {
  const groups = [
    {
      label: 'Learn',
      items: [
        { id: 'chat', label: 'Conversation', icon: MessageSquare },
        { id: 'assets', label: `Assets (${assetCount})`, icon: Library },
      ],
    },
    {
      label: 'Practice',
      items: [
        { id: 'structure', label: 'Structure', icon: Layers },
        { id: 'listen', label: 'Listen', icon: Headphones },
        { id: 'live', label: 'Live Practice', icon: Phone },
        { id: 'recombine', label: 'Recombination', icon: Shuffle },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">S</div>
        <div>
          <h1>SpeakFrame</h1>
          <p>Expression Growth MVP</p>
        </div>
      </div>

      <nav>
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={tab === item.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-note">
        <Sparkles size={16} />
        <span>MVP loop: ask - click - save - recombine.</span>
      </div>
    </aside>
  );
}

function ChatPage({
  messages,
  input,
  setInput,
  sendMessage,
  analyzeSentence,
  loading,
  insightLoading,
  selectedInsightSentence,
  chatMode,
  setChatMode,
  voiceListening,
  toggleVoiceInput,
}) {
  const isExtractMode = chatMode === 'extract';

  return (
    <section className="page chat-page">
      <PageHeader
        title="Conversation Hub"
        subtitle="Express your own ideas, or paste text to extract reusable chunks, patterns, and native expressions."
      />

      <div className="mode-switch">
        <button
          className={chatMode === 'express' ? 'mode-button active' : 'mode-button'}
          onClick={() => setChatMode('express')}
        >
          Express
          <span>Ask how to say something naturally.</span>
        </button>
        <button
          className={isExtractMode ? 'mode-button active' : 'mode-button'}
          onClick={() => setChatMode('extract')}
        >
          Extract Assets
          <span>Paste text and save useful expressions.</span>
        </button>
      </div>

      <div className="chat-window">
        {insightLoading && selectedInsightSentence && (
          <div className="insight-status">
            <span className="loading-dot" />
            <div>
              <strong>Analyzing selected sentence...</strong>
              <p>{selectedInsightSentence}</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.role}`}>
            <div className="message-bubble">
              {m.role === 'assistant' ? (
                <div className="sentence-list">
                  {splitSentences(m.content).map((s, idx) => {
                    const isSelected = selectedInsightSentence === s;

                    return (
                      <button
                        key={`${m.id}-${idx}`}
                        className={isSelected ? 'sentence-button selected' : 'sentence-button'}
                        onClick={() => analyzeSentence(s)}
                        disabled={insightLoading}
                        title="Click to analyze and save this expression"
                      >
                        <span>{toText(s)}</span>
                        {isSelected && (
                          <span className="sentence-hint">
                            <span className="loading-dot small" />
                            Analyzing...
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="message-bubble">Thinking...</div>
          </div>
        )}
      </div>

      <div className="composer">
        <button
          className={voiceListening ? 'icon-button listening' : 'icon-button muted'}
          title={voiceListening ? 'Listening...' : 'Voice input'}
          onClick={toggleVoiceInput}
        >
          <Mic size={18} />
        </button>

        <textarea
          placeholder={
            isExtractMode
              ? 'Paste transcript or English text here. SpeakFrame will extract chunks, patterns, native expressions, and useful sentences into Assets.'
              : 'Example: I think technical sales fits me, but I do not know how to explain it.'
          }
          onChange={(e) => setInput(e.target.value)}
          value={input}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        <button className="send-button" onClick={sendMessage} disabled={loading}>
          <Send size={18} />
          {loading ? (isExtractMode ? 'Extracting...' : 'Sending...') : isExtractMode ? 'Extract & Save' : 'Send'}
        </button>
      </div>
    </section>
  );
}

function InsightDrawer({ insight, onClose, onSave }) {
  const slots = Array.isArray(insight.slots) ? insight.slots : [];
  const scenarios = Array.isArray(insight.scenarios) ? insight.scenarios : [];
  const examples = Array.isArray(insight.examples) ? insight.examples : [];

  return (
    <aside className="drawer">
      <div className="drawer-header">
        <div>
          <p className="eyebrow">Sentence Insight</p>
          <h2>Reusable expression tree</h2>
        </div>

        <button className="icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="insight-card highlight">
        <label>Selected sentence</label>
        <p>{toText(insight.sourceSentence)}</p>
      </div>

      <InsightField label="Meaning" value={insight.meaning} />
      <InsightField label="Asset Type" value={insight.recommendedType} />
      <InsightField label="Function" value={insight.functionName} />
      <InsightField label="Root Pattern" value={insight.rootPattern} />

      <div className="insight-card">
        <label>Slots</label>
        <div className="pill-row">
          {slots.length === 0 ? (
            <span className="muted-text">No slots found</span>
          ) : (
            slots.map((x, index) => (
              <span className="pill" key={toText(x)}>
                {toText(x)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="insight-card">
        <label>Scenarios</label>
        <div className="pill-row">
          {scenarios.length === 0 ? (
            <span className="muted-text">No scenarios found</span>
          ) : (
            scenarios.map((x) => (
              <span className="pill blue" key={toText(x)}>
                {toText(x)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="insight-card">
        <label>Reusable examples</label>
        {examples.length === 0 ? (
          <p className="muted-text">No examples found</p>
        ) : (
          <ul>
            {examples.map((e) => (
              <li key={toText(e)}>{toText(e)}</li>
            ))}
          </ul>
        )}
      </div>

      <InsightField label="Why save it?" value={insight.notes} />

      <button className="save-button" onClick={onSave}>
        <Save size={18} /> Save Asset
      </button>
    </aside>
  );
}

function InsightField({ label, value }) {
  return (
    <div className="insight-card">
      <label>{label}</label>
      <p>{value || '-'}</p>
    </div>
  );
}

function AssetsPage({
  assets,
  deleteAsset,
  parseVideoAssets,
  videoLoading,
  generateDailyAssets,
  dailyLoading,
  assetGoal,
  setAssetGoal,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    return (Array.isArray(assets) ? assets : []).filter((a) => {
      const typeMatches = typeFilter === 'All' || normalizeAssetType(a.type) === typeFilter;
      const searchMatches = `${toText(a.text)} ${toText(a.functionName)} ${toText(a.expressionFunction)} ${toText(a.rootPattern)} ${(a.scenarios || []).join(' ')} ${(a.tags || []).join(' ')}`
        .toLowerCase()
        .includes(q);

      return typeMatches && searchMatches;
    });
  }, [assets, query, typeFilter]);

  const selectedAsset = useMemo(() => {
    return filtered.find((asset) => asset.id === selectedAssetId) || null;
  }, [filtered, selectedAssetId]);

  useEffect(() => {
    if (selectedAssetId && !filtered.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId('');
    }
  }, [filtered, selectedAssetId]);

  async function handleVideoParse() {
    const didAdd = await parseVideoAssets(videoUrl);

    if (didAdd) {
      setVideoUrl('');
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Asset Library"
        subtitle="Save expressions from conversations and video links, then review them as reusable assets."
      />

      <div className="video-parser">
        <div>
          <p className="eyebrow">Video to Assets</p>
          <h3>Parse useful expressions from a video link</h3>
          <p>
            Paste a public video URL. SpeakFrame will look for valuable chunks, sentence patterns,
            and reusable lines to save into your asset library.
          </p>
        </div>

        <div className="video-form">
          <input
            placeholder="Paste YouTube, course, or public video link..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleVideoParse();
              }
            }}
          />
          <button className="save-button" onClick={handleVideoParse} disabled={videoLoading || !videoUrl.trim()}>
            <Sparkles size={18} />
            {videoLoading ? 'Parsing...' : 'Parse Video'}
          </button>
        </div>
      </div>

      <div className="daily-recommendation">
        <div>
          <p className="eyebrow">Daily Pack</p>
          <h3>Recommend connected expressions for today</h3>
          <p>
            Generate a small set of chunks, patterns, useful sentences, and native expressions
            that can be practiced together instead of collected separately.
          </p>
        </div>

        <div className="daily-actions">
          <select value={assetGoal} onChange={(e) => setAssetGoal(e.target.value)}>
            {ASSET_GOALS.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.label}
              </option>
            ))}
          </select>

          <button className="save-button" onClick={generateDailyAssets} disabled={dailyLoading}>
            <Plus size={18} />
            {dailyLoading ? 'Recommending...' : 'Add Daily Pack'}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="type-filter">
          {ASSET_TYPES.map((type) => (
            <button
              key={type}
              className={typeFilter === type ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="asset-library-layout">
        {filtered.length === 0 ? (
          <EmptyState
            title="No assets yet"
            text="Go to Conversation, click an AI sentence, or parse a video link to save your first asset."
          />
        ) : (
          <div className="asset-grid compact">
            {filtered.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                selected={selectedAsset?.id === a.id}
                onSelect={() => setSelectedAssetId((currentId) => (currentId === a.id ? '' : a.id))}
                onDelete={() => deleteAsset(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedAsset && (
        <AssetDetailOverlay asset={selectedAsset} onClose={() => setSelectedAssetId('')} />
      )}
    </section>
  );
}

function AssetCard({ asset, selected, onSelect, onDelete }) {
  const scenarios = Array.isArray(asset.scenarios) ? asset.scenarios : [];
  const tags = Array.isArray(asset.tags) ? asset.tags : [];

  return (
    <article className={selected ? 'asset-card selected' : 'asset-card'} onClick={onSelect}>
      <div className="asset-top">
        <span className="asset-type">{toText(asset.type) || 'Asset'}</span>

        <button
          className="icon-button danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <h3>{toText(asset.text) || '-'}</h3>
      <p className="asset-function">{toText(asset.expressionFunction) || toText(asset.functionName) || '-'}</p>

      <div className="pill-row">
        {asset.comboRole && <span className="pill role">{toText(asset.comboRole)}</span>}
        {tags.slice(0, 1).map((tag) => (
          <span className="pill" key={toText(tag)}>
            {toText(tag)}
          </span>
        ))}
        {scenarios.slice(0, 2).map((s) => (
          <span className="pill blue" key={toText(s)}>
            {toText(s)}
          </span>
        ))}
      </div>
    </article>
  );
}

function AssetDetailOverlay({ asset, onClose }) {
  const scenarios = Array.isArray(asset?.scenarios) ? asset.scenarios : [];
  const examples = Array.isArray(asset?.examples) ? asset.examples : [];
  const tags = Array.isArray(asset?.tags) ? asset.tags : [];

  return (
    <div className="asset-detail-backdrop" onClick={onClose}>
      <aside className="asset-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asset-detail-header">
          <div className="asset-detail-badges">
            <span className="asset-type">{toText(asset.type) || 'Asset'}</span>
            {asset.sourceType && <span className="source-badge">{toText(asset.sourceType)}</span>}
          </div>

          <button className="icon-button" onClick={onClose} aria-label="Close asset detail">
            <X size={18} />
          </button>
        </div>

        <h2>{toText(asset.text) || '-'}</h2>
      <p className="asset-function">{toText(asset.functionName) || '-'}</p>

        <InsightField label="Expression Function" value={toText(asset.expressionFunction)} />
        <InsightField label="Combo Role" value={toText(asset.comboRole)} />
        <InsightField label="Difficulty" value={toText(asset.difficulty)} />
        <InsightField label="Theme" value={toText(asset.theme)} />
        <InsightField label="Source Sentence" value={toText(asset.sourceSentence)} />
        <InsightField label="Root Pattern" value={toText(asset.rootPattern)} />
        <InsightField label="Notes" value={toText(asset.notes)} />

        <div className="insight-card">
          <label>Tags</label>
          <div className="pill-row">
            {tags.length === 0 ? (
              <span className="muted-text">No tags found</span>
            ) : (
              tags.map((tag) => (
                <span className="pill" key={toText(tag)}>
                  {toText(tag)}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="insight-card">
          <label>Scenarios</label>
          <div className="pill-row">
            {scenarios.length === 0 ? (
              <span className="muted-text">No scenarios found</span>
            ) : (
              scenarios.map((scenario) => (
                <span className="pill blue" key={toText(scenario)}>
                  {toText(scenario)}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="insight-card">
          <label>Reusable Examples</label>
          {examples.length === 0 ? (
            <p className="muted-text">No examples found</p>
          ) : (
            <ul>
              {examples.map((example) => (
                <li key={toText(example)}>{toText(example)}</li>
              ))}
            </ul>
          )}
        </div>

        {asset.sourceUrl && (
          <a className="source-link" href={asset.sourceUrl} target="_blank" rel="noreferrer">
            Open source video
          </a>
        )}
      </aside>
    </div>
  );
}

function DashboardPage({ assets, practice, structurePlan, setTab }) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const recentAssets = safeAssets.slice(0, 4);
  const dailyCount = safeAssets.filter((asset) => toText(asset.sourceType) === 'Daily').length;
  const frameworkCount = safeAssets.filter((asset) => normalizeAssetType(asset.type) === 'Framework').length;
  const listeningReady =
    safeAssets.length > 0 || Boolean(practice?.sample) || Boolean(structurePlan?.sampleAnswer);

  const tasks = [
    {
      label: 'Collect',
      title: 'Ask or extract useful expressions',
      text: 'Turn rough ideas or pasted text into reusable chunks and patterns.',
      action: 'Open Conversation',
      tab: 'chat',
    },
    {
      label: 'Recommend',
      title: 'Add today\'s connected pack',
      text: 'Get four expressions designed to work together in one answer.',
      action: 'Open Assets',
      tab: 'assets',
    },
    {
      label: 'Build',
      title: 'Practice big-to-small structure',
      text: 'Convert one big idea into point, reason, detail, example, and takeaway.',
      action: 'Open Structure',
      tab: 'structure',
    },
    {
      label: 'Listen',
      title: 'Loop the expressions you need',
      text: 'Hear assets, structure layers, or recombined answers until they feel familiar.',
      action: 'Open Listen',
      tab: 'listen',
    },
  ];

  return (
    <section className="page dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Build expressions you can actually use.</h2>
          <p>
            Collect useful language, organize it into structure, recombine it into practice,
            then loop it through listening.
          </p>
        </div>
        <button className="save-button" onClick={() => setTab('chat')}>
          <Plus size={18} />
          Start With An Idea
        </button>
      </div>

      <div className="dashboard-stats">
        <StatCard label="Assets" value={safeAssets.length} text="saved expressions" />
        <StatCard label="Daily" value={dailyCount} text="recommended assets" />
        <StatCard label="Frameworks" value={frameworkCount} text="structure assets" />
        <StatCard label="Listening" value={listeningReady ? 'Ready' : 'Empty'} text="queue sources" />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="section-title">
            <div>
              <p className="eyebrow">Daily Flow</p>
              <h3>Your next best actions</h3>
            </div>
          </div>

          <div className="task-list">
            {tasks.map((task, index) => (
              <button className="task-card" key={task.label} onClick={() => setTab(task.tab)}>
                <span>{index + 1}</span>
                <div>
                  <p className="eyebrow">{task.label}</p>
                  <h3>{task.title}</h3>
                  <p>{task.text}</p>
                </div>
                <strong>{task.action}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="dashboard-side">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">Recent Assets</p>
              <h3>Review material</h3>
            </div>
            <button className="ghost-button small" onClick={() => setTab('assets')}>View All</button>
          </div>

          {recentAssets.length === 0 ? (
            <div className="mini-section">
              <p>No assets yet. Start in Conversation or add a Daily Pack.</p>
            </div>
          ) : (
            <div className="recent-list">
              {recentAssets.map((asset) => (
                <button className="recent-item" key={asset.id} onClick={() => setTab('assets')}>
                  <span className="asset-type">{normalizeAssetType(asset.type)}</span>
                  <strong>{toText(asset.text)}</strong>
                  <p>{toText(asset.expressionFunction) || toText(asset.functionName) || '-'}</p>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function StatCard({ label, value, text }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{text}</span>
    </div>
  );
}

function StructurePage({
  assets,
  practiceGoal,
  setPracticeGoal,
  structureTopic,
  setStructureTopic,
  structurePlan,
  structureDraft,
  setStructureDraft,
  structureLoading,
  generateStructurePlan,
  saveStructureAsAsset,
  practiceStructureFrame,
}) {
  const currentGoal = getPracticeGoal(practiceGoal);
  const assetCount = Array.isArray(assets) ? assets.length : 0;
  const layers = Array.isArray(structurePlan?.layers) ? structurePlan.layers : [];
  const path = Array.isArray(structurePlan?.bigToSmallPath) ? structurePlan.bigToSmallPath : [];

  return (
    <section className="page">
      <PageHeader
        title="Structure Practice"
        subtitle="Build reusable speaking frames: one stable paragraph that can explain an idea, tell a small story, or describe a daily moment clearly."
      />

      <div className="structure-layout">
        <aside className="structure-control">
          <div className="goal-selector">
            <label>Practice Goal</label>
            <select value={practiceGoal} onChange={(e) => setPracticeGoal(e.target.value)}>
              {PRACTICE_GOALS.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.label}
                </option>
              ))}
            </select>
            <p>{currentGoal.purpose}</p>
          </div>

          <div className="insight-card">
            <label>Your Big Idea</label>
            <textarea
              className="structure-topic"
              value={structureTopic}
              placeholder="Example: A small annoying thing happened at a coffee shop. Help me turn it into a reusable small-talk story frame."
              onChange={(e) => setStructureTopic(e.target.value)}
            />
          </div>

          <button className="save-button" onClick={generateStructurePlan} disabled={structureLoading}>
            <Layers size={18} />
            {structureLoading ? 'Building...' : 'Build Structure'}
          </button>

          <div className="mini-section">
            <label>Asset Context</label>
            <p>{assetCount} saved assets can be used as expression material.</p>
          </div>
        </aside>

        <div className="structure-output">
          {!structurePlan ? (
            <EmptyState
              title="Build a reusable paragraph frame"
              text="Enter one idea or small story. The system will turn it into a stable spoken structure you can swap words in and reuse."
            />
          ) : (
            <>
              <div className="structure-hero">
                <p className="eyebrow">Expression Architecture</p>
                <h2>{toText(structurePlan.title)}</h2>
                <p>{toText(structurePlan.practicePrompt) || toText(structurePlan.goal)}</p>
              </div>

              {path.length > 0 && (
                <div className="structure-path">
                  {path.map((item, index) => (
                    <span key={`${toText(item)}-${index}`}>{toText(item)}</span>
                  ))}
                </div>
              )}

              <div className="structure-layers">
                {layers.map((layer, index) => (
                  <div className="structure-layer" key={`${toText(layer.name)}-${index}`}>
                    <div className="layer-index">{index + 1}</div>
                    <div>
                      <p className="eyebrow">{toText(layer.name) || `Layer ${index + 1}`}</p>
                      <h3>{toText(layer.sentence)}</h3>
                      <p>{toText(layer.purpose)}</p>
                      {layer.smallerMove && (
                        <div className="layer-move">
                          <strong>Move smaller:</strong> {toText(layer.smallerMove)}
                        </div>
                      )}
                      {Array.isArray(layer.recommendedAssets) && layer.recommendedAssets.length > 0 && (
                        <div className="pill-row">
                          {layer.recommendedAssets.map((assetText) => (
                            <span className="pill blue" key={toText(assetText)}>
                              {toText(assetText)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="practice-card">
                <p className="eyebrow">Your Output</p>
                <textarea
                  className="answer-box"
                  value={structureDraft}
                  onChange={(e) => setStructureDraft(e.target.value)}
                  placeholder="Rewrite this structure in your own words..."
                />
                <div className="structure-actions">
                  <button className="save-button" onClick={practiceStructureFrame}>
                    <Shuffle size={18} />
                    Practice This Frame
                  </button>
                  <button className="ghost-button" onClick={saveStructureAsAsset}>
                    <Save size={18} />
                    Save Framework Set
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function LivePracticePage({
  scenario,
  setScenario,
  messages,
  active,
  listening,
  loading,
  summary,
  startSession,
  startListening,
  endSession,
  saveAsset,
}) {
  const summaryAssets = Array.isArray(summary?.assets) ? summary.assets : [];

  return (
    <section className="page">
      <PageHeader
        title="Live Practice"
        subtitle="A voice-call style practice room. Speak in English, ask in Chinese when stuck, then save your weak points as assets."
      />

      <div className="live-layout">
        <aside className="live-control">
          <div className="live-phone-card">
            <div className={active ? 'live-orb active' : 'live-orb'}>
              <Phone size={30} />
            </div>
            <h3>{active ? 'Voice practice is live' : 'Ready for a voice call'}</h3>
            <p>
              Use it like a phone call. If you cannot say something, ask in Chinese and the coach will rescue the expression.
            </p>
          </div>

          <div className="goal-selector">
            <label>Practice Scene</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={active}>
              <option value="technical-sales">Technical Sales</option>
              <option value="interview">Interview</option>
              <option value="daily-conversation">Daily Conversation</option>
              <option value="explain-opinion">Explain Opinion</option>
              <option value="daily-questions">Daily Questions</option>
              <option value="part-time-service-job">Part-time Service Job</option>
            </select>
            <p>Choose the situation before starting the call.</p>
          </div>

          {!active ? (
            <button className="save-button" onClick={startSession}>
              <Phone size={18} />
              Start Call
            </button>
          ) : (
            <div className="live-call-actions">
              <button
                className={listening ? 'live-talk-button listening' : 'live-talk-button'}
                onClick={startListening}
                disabled={loading}
              >
                <Mic size={22} />
                {listening ? 'Listening...' : 'Tap To Speak'}
              </button>

              <button className="ghost-button" onClick={endSession} disabled={loading}>
                <Square size={18} />
                End & Summarize
              </button>
            </div>
          )}
        </aside>

        <div className="live-main">
          <div className="live-transcript">
            {messages.length === 0 ? (
              <EmptyState title="No live session yet" text="Start a call, then speak naturally. Your transcript will appear here." />
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`live-message ${message.role}`}>
                  <span>{message.role === 'assistant' ? 'Coach' : 'You'}</span>
                  <p>{toText(message.content)}</p>
                  {message.rescue?.naturalExpression && (
                    <div className="expression-rescue">
                      <strong>Expression rescue</strong>
                      <p>{toText(message.rescue.naturalExpression)}</p>
                      {message.rescue.pattern && <small>{toText(message.rescue.pattern)}</small>}
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="live-message assistant">
                <span>Coach</span>
                <p>Thinking...</p>
              </div>
            )}
          </div>

          {summary && (
            <div className="live-summary">
              <p className="eyebrow">Session Summary</p>
              <h3>What to improve and save</h3>
              <p>{toText(summary.feedback) || 'Review the suggested expressions below.'}</p>

              <div className="live-assets">
                {summaryAssets.map((asset) => (
                  <div className="live-asset-card" key={asset.id}>
                    <span className="asset-type">{toText(asset.type)}</span>
                    <h3>{toText(asset.text)}</h3>
                    <p>{toText(asset.expressionFunction) || toText(asset.functionName)}</p>
                    <button className="ghost-button small" onClick={() => saveAsset(asset)}>
                      <Save size={15} />
                      Save Asset
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ListenPage({ assets, practice, structurePlan }) {
  const [sourceMode, setSourceMode] = useState('assets');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopCount, setLoopCount] = useState(3);
  const [showText, setShowText] = useState(true);
  const [includeMeaning, setIncludeMeaning] = useState(false);
  const stopRef = useRef(false);
  const timerRef = useRef(null);

  const assetItems = useMemo(() => {
    return (Array.isArray(assets) ? assets : []).map((asset) => ({
      id: asset.id,
      label: toText(asset.text) || toText(asset.type) || 'Asset',
      text: getAssetListenText(asset),
      meaning: toText(asset.meaning),
      meta: `${toText(asset.type) || 'Asset'}${toText(asset.expressionFunction) || toText(asset.functionName) ? ` - ${toText(asset.expressionFunction) || toText(asset.functionName)}` : ''}`,
    })).filter((item) => item.text);
  }, [assets]);

  const recombineItems = useMemo(() => {
    if (!practice) return [];

    const items = [];
    if (practice.prompt) {
      items.push({
        id: 'practice-question',
        label: 'Question',
        text: toText(practice.prompt),
        meaning: toText(practice.scenario),
        meta: 'Listen, pause, then answer by yourself.',
      });
    }
    if (practice.sample) {
      items.push({
        id: 'practice-sample',
        label: 'Sample Answer',
        text: toText(practice.sample),
        meaning: 'Reference output',
        meta: 'Shadow this answer after the question.',
      });
    }

    return items.filter((item) => item.text);
  }, [practice]);

  const structureItems = useMemo(() => {
    if (!structurePlan) return [];

    const layerItems = Array.isArray(structurePlan.layers)
      ? structurePlan.layers.map((layer, index) => ({
          id: `structure-${index}`,
          label: toText(layer.name) || `Layer ${index + 1}`,
          text: toText(layer.sentence),
          meaning: toText(layer.purpose),
          meta: toText(layer.smallerMove),
        }))
      : [];

    const sample = toText(structurePlan.sampleAnswer)
      ? [{
          id: 'structure-sample',
          label: 'Full Answer',
          text: toText(structurePlan.sampleAnswer),
          meaning: toText(structurePlan.goal),
          meta: 'Full big-to-small output',
        }]
      : [];

    return [...layerItems, ...sample].filter((item) => item.text);
  }, [structurePlan]);

  const sourceItems = {
    assets: assetItems,
    recombine: recombineItems,
    structure: structureItems,
  };
  const availableItems = sourceItems[sourceMode] || [];
  const queue = sourceMode === 'assets'
    ? availableItems.filter((item) => selectedIds.includes(item.id))
    : availableItems;
  const activeItem = queue[currentIndex] || null;

  useEffect(() => {
    setCurrentIndex(0);
    stopPlayback();
  }, [sourceMode]);

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  function toggleAsset(id) {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return [...ids, id];
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      timerRef.current = window.setTimeout(resolve, ms);
    });
  }

  function speak(text, speechRate = rate) {
    return new Promise((resolve) => {
      if (!text || !window.speechSynthesis) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = Number(speechRate);
      utterance.pitch = 1;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  async function playItem(item) {
    await speak(item.text);
    if (stopRef.current) return;
    await wait(1200);
    if (stopRef.current) return;

    if (includeMeaning && item.meaning) {
      await speak(item.meaning, Math.max(0.75, Number(rate) - 0.05));
      if (stopRef.current) return;
      await wait(900);
    }

    await speak(item.text);
    if (stopRef.current) return;
    await wait(1800);
  }

  async function playQueue(startIndex = 0) {
    if (queue.length === 0) return;

    stopPlayback();
    stopRef.current = false;
    setIsPlaying(true);

    for (let loop = 0; loop < Number(loopCount); loop += 1) {
      for (let index = startIndex; index < queue.length; index += 1) {
        if (stopRef.current) break;
        setCurrentIndex(index);
        await playItem(queue[index]);
      }
      startIndex = 0;
      if (stopRef.current) break;
    }

    setIsPlaying(false);
  }

  function stopPlayback() {
    stopRef.current = true;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }

  function playNext() {
    const nextIndex = queue.length === 0 ? 0 : (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    playQueue(nextIndex);
  }

  function selectAllAssets() {
    setSelectedIds(assetItems.map((item) => item.id));
  }

  return (
    <section className="page">
      <PageHeader
        title="Listen Loop"
        subtitle="Loop the expressions you saved, recombined, or structured so listening feeds directly into speaking output."
      />

      <div className="listen-layout">
        <aside className="listen-control">
          <div className="mode-switch">
            <button
              className={sourceMode === 'assets' ? 'mode-button active' : 'mode-button'}
              onClick={() => setSourceMode('assets')}
            >
              Assets
              <span>Loop saved chunks and patterns.</span>
            </button>
            <button
              className={sourceMode === 'recombine' ? 'mode-button active' : 'mode-button'}
              onClick={() => setSourceMode('recombine')}
            >
              Recombine
              <span>Listen to question and sample answer.</span>
            </button>
            <button
              className={sourceMode === 'structure' ? 'mode-button active' : 'mode-button'}
              onClick={() => setSourceMode('structure')}
            >
              Structure
              <span>Hear the big-to-small layers.</span>
            </button>
          </div>

          <div className="listen-settings">
            <label>
              Speed
              <select
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              >
                <option value="0.3">0.3x slow study</option>
                <option value="0.5">0.5x careful</option>
                <option value="1">1.0x normal</option>
                <option value="1.3">1.3x faster</option>
                <option value="1.5">1.5x challenge</option>
              </select>
              <span>{Number(rate).toFixed(2)}x</span>
            </label>

            <label>
              Loops
              <select value={loopCount} onChange={(e) => setLoopCount(e.target.value)}>
                <option value="1">1</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
              </select>
            </label>

            <button className="ghost-button small" onClick={() => setShowText((value) => !value)}>
              {showText ? <EyeOff size={16} /> : <Eye size={16} />}
              {showText ? 'Hide Text' : 'Show Text'}
            </button>

            <button className="ghost-button small" onClick={() => setIncludeMeaning((value) => !value)}>
              {includeMeaning ? 'Meaning On' : 'Meaning Off'}
            </button>
          </div>

          {sourceMode === 'assets' && (
            <div className="listen-source-list">
              <div className="select-panel-header">
                <div>
                  <h3>Select assets</h3>
                  <p>{selectedIds.length} selected</p>
                </div>
                <button className="ghost-button small" onClick={selectedIds.length ? () => setSelectedIds([]) : selectAllAssets}>
                  {selectedIds.length ? 'Clear' : 'All'}
                </button>
              </div>

              {assetItems.length === 0 ? (
                <p className="muted-text">No assets yet.</p>
              ) : (
                assetItems.map((item) => (
                  <button
                    key={item.id}
                    className={selectedIds.includes(item.id) ? 'select-asset selected' : 'select-asset'}
                    onClick={() => toggleAsset(item.id)}
                  >
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.meta || 'Expression asset'}</span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))
              )}
            </div>
          )}
        </aside>

        <div className="listen-player">
          <div className="listen-now">
            <p className="eyebrow">Now Listening</p>
            <h2>{activeItem ? activeItem.label : 'No item selected'}</h2>
            <p className={showText ? '' : 'hidden-text'}>
              {activeItem ? activeItem.text : 'Choose assets or generate a Recombine / Structure result first.'}
            </p>
            {activeItem?.meta && <span className="listen-meta">{activeItem.meta}</span>}
          </div>

          <div className="listen-actions">
            <button className="save-button" onClick={() => playQueue(currentIndex)} disabled={queue.length === 0 || isPlaying}>
              <Play size={18} />
              Play Loop
            </button>
            <button className="ghost-button" onClick={stopPlayback} disabled={!isPlaying}>
              <Square size={18} />
              Stop
            </button>
            <button className="ghost-button" onClick={playNext} disabled={queue.length === 0}>
              <SkipForward size={18} />
              Next
            </button>
          </div>

          <div className="listen-queue">
            <div className="select-panel-header">
              <div>
                <h3>Playback Queue</h3>
                <p>{queue.length} items, {loopCount} loop(s)</p>
              </div>
            </div>

            {queue.length === 0 ? (
              <EmptyState title="No listening queue yet" text="Select assets, or generate a Recombine / Structure result first." />
            ) : (
              queue.map((item, index) => (
                <button
                  key={item.id}
                  className={index === currentIndex ? 'listen-queue-item active' : 'listen-queue-item'}
                  onClick={() => setCurrentIndex(index)}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong className={showText ? '' : 'hidden-text'}>{item.text}</strong>
                    <p>{item.label}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecombinePage({
  assets,
  selectedAssetIds,
  setSelectedAssetIds,
  generatePractice,
  practice,
  practiceLoading,
  practiceGoal,
  setPracticeGoal,
}) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const [assetFilter, setAssetFilter] = useState('all');
  const currentGoal = getPracticeGoal(practiceGoal);
  const recommendedCombo = getRecommendedCombo(safeAssets, practiceGoal);
  const filteredAssets = safeAssets.filter((asset) => {
    const type = normalizeAssetType(asset.type);
    const sourceType = toText(asset.sourceType);
    const tags = Array.isArray(asset.tags) ? asset.tags.map((tag) => toText(tag).toLowerCase()) : [];

    if (assetFilter === 'frameworks') return type === 'Framework';
    if (assetFilter === 'structure') return sourceType === 'Structure' || tags.includes('structure-sentence');
    if (assetFilter === 'questions') return type === 'Question Pattern';
    if (assetFilter === 'chunks') return type === 'Chunk' || type === 'Pattern' || type === 'Native Expression';
    return true;
  });
  const selectedCount = selectedAssetIds.length;
  const canGenerate =
    selectedCount >= MIN_RECOMBINE_ASSETS &&
    selectedCount <= MAX_RECOMBINE_ASSETS &&
    !practiceLoading;

  function toggle(id) {
    setSelectedAssetIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_RECOMBINE_ASSETS) return ids;
      return [...ids, id];
    });
  }

  return (
    <section className="page">
      <PageHeader
        title="Recombination"
        subtitle="Choose a practice goal, use a recommended combo, or build your own focused set."
      />

      {safeAssets.length === 0 ? (
        <EmptyState title="No assets to recombine" text="Save a few assets first, then come back here." />
      ) : (
        <div className="recombine-layout">
          <div className="select-panel">
            <div className="select-panel-header">
              <div>
                <h3>Select assets</h3>
                <p>{selectedCount}/{MAX_RECOMBINE_ASSETS} selected</p>
              </div>
              <button className="ghost-button small" onClick={() => setSelectedAssetIds([])}>
                Clear
              </button>
            </div>

            <div className="asset-filter-row">
              {[
                ['all', 'All'],
                ['frameworks', 'Frameworks'],
                ['structure', 'Structure Set'],
                ['questions', 'Questions'],
                ['chunks', 'Chunks'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={assetFilter === id ? 'filter-pill active' : 'filter-pill'}
                  onClick={() => setAssetFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="select-list">
              {filteredAssets.map((a) => {
                const isSelected = selectedAssetIds.includes(a.id);
                const isDisabled = !isSelected && selectedCount >= MAX_RECOMBINE_ASSETS;

                return (
                  <button
                    key={a.id}
                    className={isSelected ? 'select-asset selected' : 'select-asset'}
                    onClick={() => toggle(a.id)}
                    disabled={isDisabled}
                  >
                    <div>
                      <strong>{toText(a.text) || '-'}</strong>
                      <span>
                        {toText(a.type) || 'Asset'} - {toText(a.functionName) || '-'}
                      </span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
              {filteredAssets.length === 0 && (
                <div className="mini-section">
                  <p>No assets in this filter yet. Build and save a Structure frame first.</p>
                </div>
              )}
            </div>
          </div>

          <div className="practice-panel">
            <div className="goal-selector">
              <label>Practice Goal</label>
              <select value={practiceGoal} onChange={(e) => setPracticeGoal(e.target.value)}>
                {PRACTICE_GOALS.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.label}
                  </option>
                ))}
              </select>
              <p>{currentGoal.purpose}</p>
            </div>

            <div className="recommended-combo">
              <div>
                <p className="eyebrow">Recommended Combo</p>
                <h3>{currentGoal.label}</h3>
                <p>{currentGoal.purpose}</p>
              </div>

              <button
                className="ghost-button small"
                onClick={() => setSelectedAssetIds(recommendedCombo.map((asset) => asset.id))}
                disabled={recommendedCombo.length < MIN_RECOMBINE_ASSETS}
              >
                Use Recommended
              </button>
            </div>

            {recommendedCombo.length > 0 && (
              <div className="combo-preview">
                {recommendedCombo.map((asset) => (
                  <span key={asset.id}>
                    {toText(asset.comboRole) || 'support'}: {toText(asset.text)}
                  </span>
                ))}
              </div>
            )}

            <div className="practice-actions">
              <div>
                <p className="eyebrow">Selected Assets</p>
                <h3>
                  {selectedCount < MIN_RECOMBINE_ASSETS
                    ? `Choose ${MIN_RECOMBINE_ASSETS}-${MAX_RECOMBINE_ASSETS} assets`
                    : `${selectedCount} assets ready`}
                </h3>
                <p>
                  Use a focused set so the practice has a clear speaking goal.
                </p>
              </div>

              <button className="save-button" onClick={generatePractice} disabled={!canGenerate}>
                <Shuffle size={18} />
                {practiceLoading ? 'Generating...' : 'Generate Practice'}
              </button>
            </div>

            {!practice ? (
              <EmptyState title="Practice will appear here" text={`Choose ${MIN_RECOMBINE_ASSETS}-${MAX_RECOMBINE_ASSETS} assets and generate a focused practice task.`} />
            ) : (
              <PracticeCard practice={practice} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PracticeCard({ practice }) {
  const mustUse = Array.isArray(practice.mustUse) ? practice.mustUse : [];

  return (
    <div className="practice-card">
      <p className="eyebrow">Generated Practice</p>
      <h2>{toText(practice.prompt) || 'Practice question'}</h2>

      {practice.scenario && (
        <div className="insight-card">
          <label>Scenario</label>
          <p>{toText(practice.scenario)}</p>
        </div>
      )}

      <div className="insight-card">
        <label>Must use</label>
        <div className="pill-row">
          {mustUse.map((x) => (
            <span className="pill" key={toText(x)}>
              {toText(x)}
            </span>
          ))}
        </div>
      </div>

      <div className="insight-card">
        <label>Sample answer</label>
        <p>{toText(practice.sample) || '-'}</p>
      </div>

      <textarea className="answer-box" placeholder="Write or speak your answer here later..." />
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">MVP 1.0</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <button className="ghost-button">
        <Plus size={17} /> Future API
      </button>
    </header>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Sparkles size={26} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);





