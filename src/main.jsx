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
  FileText,
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

const LIVE_SCENES = [
  {
    id: 'part-time-service-job',
    label: 'Part-time Service Job',
    prompt: 'Practice a real voice call for restaurant, bar, cafe, retail, or service work.',
  },
  {
    id: 'job-search-interview',
    label: 'Job Interview',
    prompt: 'Practice interview questions about fit, motivation, experience, and availability.',
  },
  {
    id: 'daily-small-talk',
    label: 'Daily Small Talk',
    prompt: 'Practice natural back-and-forth about everyday moments.',
  },
  {
    id: 'workplace-communication',
    label: 'Work Communication',
    prompt: 'Practice updates, clarification, suggestions, and work conversations.',
  },
  {
    id: 'personal-reflection',
    label: 'Personal Reflection',
    prompt: 'Practice explaining feelings, changes, decisions, and personal growth.',
  },
];

const LIVE_FOCUS_OPTIONS = [
  {
    id: 'question-understanding',
    label: 'Question Understanding',
    prompt: 'The coach asks short realistic questions. The learner practices understanding and answering quickly.',
  },
  {
    id: 'natural-response',
    label: 'Natural Response',
    prompt: 'The coach gives light corrections and helps the learner sound more natural.',
  },
  {
    id: 'chunk-practice',
    label: 'Chunk Practice',
    prompt: 'The coach highlights one or two useful chunks and makes the learner reuse them.',
  },
  {
    id: 'shadowing',
    label: 'Shadowing',
    prompt: 'The coach gives one natural line and asks the learner to repeat or adapt it.',
  },
  {
    id: 'rescue-in-chinese',
    label: 'Rescue in Chinese',
    prompt: 'If the learner gets stuck, they can ask in Chinese and the coach gives a natural English line.',
  },
];

const SCENE_LISTENING_PACKS = {
  'part-time-service-job': [
    {
      question: 'Are you looking for part-time work right now?',
      sample: "Yes, I'm looking for a part-time role, ideally in a cafe, restaurant, bar, or retail store.",
    },
    {
      question: 'What kind of shifts are you available for?',
      sample: "I'm mostly available in the evenings and on weekends, but I can be flexible if needed.",
    },
    {
      question: 'Do you have any customer service experience?',
      sample: "I don't have formal experience yet, but I'm comfortable talking to people and learning quickly.",
    },
    {
      question: 'How would you handle a busy shift?',
      sample: "I would stay calm, focus on one task at a time, and ask for help if I was unsure.",
    },
  ],
  'job-search-interview': [
    {
      question: 'Can you tell me a little about yourself?',
      sample: "Sure. I'm someone who enjoys learning practical skills and working with people in real situations.",
    },
    {
      question: 'Why are you interested in this role?',
      sample: "I'm interested in this role because it would help me build experience, confidence, and communication skills.",
    },
    {
      question: 'What strengths would you bring to the team?',
      sample: "I would bring a positive attitude, a willingness to learn, and the ability to stay calm under pressure.",
    },
    {
      question: 'When would you be available to start?',
      sample: "I would be available to start soon, and I can discuss the exact schedule based on what the team needs.",
    },
  ],
  'daily-small-talk': [
    {
      question: 'How has your day been so far?',
      sample: "It's been pretty good. Nothing too special, but I got a few things done and had a calm morning.",
    },
    {
      question: 'What did you get up to over the weekend?',
      sample: "I kept it pretty simple. I stayed home, watched something, and tried to recharge a bit.",
    },
    {
      question: 'Have you tried anything new recently?',
      sample: "Actually, yes. I tried a new place recently, and it turned out better than I expected.",
    },
    {
      question: 'What are you planning to do later?',
      sample: "I don't have anything big planned. I might just relax, make some food, and get ready for tomorrow.",
    },
  ],
  'workplace-communication': [
    {
      question: 'Can you give me a quick update on this?',
      sample: "Sure. I've made some progress, but there are still a couple of details I need to check.",
    },
    {
      question: 'What seems to be the main issue?',
      sample: "The main issue is that the process works, but it takes longer than expected in some cases.",
    },
    {
      question: 'Could you clarify what you mean by that?',
      sample: "Of course. What I mean is that the idea is clear, but the next step still needs to be defined.",
    },
    {
      question: 'What do you suggest we do next?',
      sample: "I think we should start with the simplest option, test it, and then adjust based on the result.",
    },
  ],
  'personal-reflection': [
    {
      question: 'What is something you have been thinking about recently?',
      sample: "I've been thinking about how quickly time passes and how easy it is to miss what's in front of me.",
    },
    {
      question: 'What did you realize from that experience?',
      sample: "What I realized was that small moments can teach you something if you slow down enough to notice them.",
    },
    {
      question: 'How did that change the way you think?',
      sample: "It made me think more carefully about what I focus on and what I tend to take for granted.",
    },
    {
      question: 'What would you like to do differently next time?',
      sample: "Next time, I'd like to be more present instead of always thinking about the next thing.",
    },
  ],
};

function getLiveScene(id) {
  return LIVE_SCENES.find((scene) => scene.id === id) || LIVE_SCENES[0];
}

function getLiveFocus(id) {
  return LIVE_FOCUS_OPTIONS.find((focus) => focus.id === id) || LIVE_FOCUS_OPTIONS[0];
}

function getLiveOpening(sceneId, focusId) {
  const scene = getLiveScene(sceneId);
  const focus = getLiveFocus(focusId);

  if (scene.id === 'part-time-service-job') {
    return `Hi, thanks for calling. Let's practice ${scene.label}. Focus: ${focus.label}. First question: are you looking for part-time work right now?`;
  }

  if (scene.id === 'job-search-interview') {
    return `Hi, welcome. Let's practice ${scene.label}. Focus: ${focus.label}. First question: can you tell me a little about yourself and what kind of role you are looking for?`;
  }

  if (scene.id === 'daily-small-talk') {
    return `Hi, good to hear from you. Let's practice ${scene.label}. Focus: ${focus.label}. First question: what is something small that happened to you recently?`;
  }

  if (scene.id === 'workplace-communication') {
    return `Hi, let's practice ${scene.label}. Focus: ${focus.label}. First question: what is one update or problem you need to explain at work?`;
  }

  return `Hi, let's practice ${scene.label}. Focus: ${focus.label}. First question: what is something you have been thinking about recently?`;
}

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

function loadListeningPacks() {
  try {
    const data = localStorage.getItem('speakframe_listening_packs');
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('loadListeningPacks error:', err);
    return [];
  }
}

function saveListeningPacks(packs) {
  localStorage.setItem('speakframe_listening_packs', JSON.stringify(Array.isArray(packs) ? packs : []));
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

function normalizeStructureSentence(item, index = 0) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const rawSlots = Array.isArray(safeItem.slots) ? safeItem.slots : [];

  return {
    sentence: toText(safeItem.sentence),
    functionName: toText(safeItem.functionName) || `Move ${index + 1}`,
    whyUseful: toText(safeItem.whyUseful),
    slots: rawSlots.map((slot) => {
      const safeSlot = slot && typeof slot === 'object' ? slot : {};

      return {
        label: toText(safeSlot.label),
        current: toText(safeSlot.current),
        swaps: toTextArray(safeSlot.swaps),
      };
    }),
    scenarios: toTextArray(safeItem.scenarios),
    chunks: toTextArray(safeItem.chunks),
  };
}

function normalizeTransferPractice(item) {
  const safeItem = item && typeof item === 'object' ? item : {};

  return {
    scenario: toText(safeItem.scenario),
    swapFocus: toText(safeItem.swapFocus),
    prompt: toText(safeItem.prompt),
    sampleLine: toText(safeItem.sampleLine),
  };
}

function buildStructureLearningNotes(structurePlan) {
  if (!structurePlan) return '';

  const explanation = structurePlan.learningExplanation || {};
  const route = toTextArray(structurePlan.coreFrame?.route || structurePlan.bigToSmallPath).join(' -> ');
  const sentenceLines = (Array.isArray(structurePlan.highValueSentences) ? structurePlan.highValueSentences : [])
    .map((item, index) => `${index + 1}. ${toText(item.sentence)} (${toText(item.functionName)})`)
    .filter(Boolean);
  const reuseSteps = toTextArray(explanation.reuseSteps);

  return [
    toText(explanation.whyThisFrameZh) && `Why this frame works: ${toText(explanation.whyThisFrameZh)}`,
    route && `Speaking route: ${route}`,
    toText(explanation.howToUseZh) && `How to practice: ${toText(explanation.howToUseZh)}`,
    reuseSteps.length > 0 && `Reuse steps: ${reuseSteps.join(' / ')}`,
    toText(explanation.commonMistakeZh) && `Common trap: ${toText(explanation.commonMistakeZh)}`,
    sentenceLines.length > 0 && `Native sentence frameworks:\n${sentenceLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildStructureAssets(structurePlan, structureDraft, practiceGoal) {
  if (!structurePlan) return [];

  const goal = getPracticeGoal(practiceGoal);
  const layers = Array.isArray(structurePlan.layers) ? structurePlan.layers : [];
  const highValueSentences = Array.isArray(structurePlan.highValueSentences)
    ? structurePlan.highValueSentences
    : [];
  const spokenText = toText(structureDraft) || toText(structurePlan.sampleAnswer);
  const path = toTextArray(structurePlan.coreFrame?.route || structurePlan.bigToSmallPath);
  const title = toText(structurePlan.title) || 'Reusable speaking frame';
  const learningNotes = buildStructureLearningNotes(structurePlan);
  const sharedScenarios = [
    goal.label,
    'Recombination practice',
    'Speaking practice',
    toText(structurePlan.situationType?.name),
    ...toTextArray(structurePlan.scenarios),
  ].filter(Boolean);

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
      examples: [spokenText, learningNotes].filter(Boolean),
      tags: ['structure', 'framework', 'recombine', goal.id],
      difficulty: 'B1-B2',
      theme: toText(structurePlan.coreFrame?.name) || toText(structurePlan.goal) || goal.label,
      notes:
        learningNotes ||
        toText(structurePlan.coreFrame?.plainExplanation) ||
        toText(structurePlan.practicePrompt) ||
        'Saved from Structure practice.',
    },
    { sourceType: 'Structure' }
  );

  const sentenceSource = highValueSentences.length > 0
    ? highValueSentences.map((item) => ({
        sentence: item.sentence,
        name: item.functionName,
        purpose: item.whyUseful,
        smallerMove: item.slots
          .map((slot) => [slot.current, ...slot.swaps.slice(0, 2)].filter(Boolean).join(' -> '))
          .filter(Boolean)
          .join('; '),
        recommendedAssets: item.chunks,
        scenarios: item.scenarios,
      }))
    : layers;

  const sentenceAssets = sentenceSource
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
          scenarios: [...sharedScenarios, ...toTextArray(layer.scenarios)],
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

  if (
    lower.includes('transcript text is required') ||
    lower.includes('paste the transcript') ||
    lower.includes('could not read transcript text')
  ) {
    return 'I could not read the full transcript from this link. Paste the full transcript or captions, then generate the listening pack again.';
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
  const [listeningPacks, setListeningPacks] = useState(loadListeningPacks);
  const [structureTopic, setStructureTopic] = useState('');
  const [structurePlan, setStructurePlan] = useState(null);
  const [structureDraft, setStructureDraft] = useState('');
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveAnswer, setLiveAnswer] = useState('');
  const [liveScenario, setLiveScenario] = useState('part-time-service-job');
  const [liveFocus, setLiveFocus] = useState('question-understanding');
  const [liveActive, setLiveActive] = useState(false);
  const [liveListening, setLiveListening] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveMuted, setLiveMuted] = useState(false);
  const [liveMicHint, setLiveMicHint] = useState('');
  const [liveSummary, setLiveSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [selectedInsightSentence, setSelectedInsightSentence] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [notice, setNotice] = useState(null);
  const recognitionRef = useRef(null);
  const liveRecorderRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveAudioContextRef = useRef(null);
  const liveAnalyserLoopRef = useRef(null);
  const liveRecordMaxTimerRef = useRef(null);
  const liveRecordChunksRef = useRef([]);
  const liveRecordCancelRef = useRef(false);
  const liveActiveRef = useRef(false);
  const liveLoadingRef = useRef(false);
  const liveMutedRef = useRef(false);
  const liveSpeakingRef = useRef(false);
  const liveShouldListenRef = useRef(false);
  const liveRestartTimerRef = useRef(null);
  const liveMessagesRef = useRef([]);

  useEffect(() => {
    liveActiveRef.current = liveActive;
  }, [liveActive]);

  useEffect(() => {
    liveLoadingRef.current = liveLoading;
  }, [liveLoading]);

  useEffect(() => {
    liveMutedRef.current = liveMuted;
  }, [liveMuted]);

  useEffect(() => {
    liveMessagesRef.current = liveMessages;
  }, [liveMessages]);

  useEffect(() => () => {
    if (liveRestartTimerRef.current) {
      window.clearTimeout(liveRestartTimerRef.current);
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopLiveListening();
    closeLiveAudioStream();
  }, []);

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
      const highValueSentences = Array.isArray(data.highValueSentences)
        ? data.highValueSentences.map(normalizeStructureSentence).filter((item) => item.sentence)
        : [];

      if (layers.length === 0 && highValueSentences.length === 0) {
        throw new Error('No structure layers were generated.');
      }

      const situationType = data.situationType && typeof data.situationType === 'object' ? data.situationType : {};
      const coreFrame = data.coreFrame && typeof data.coreFrame === 'object' ? data.coreFrame : {};
      const learningExplanation =
        data.learningExplanation && typeof data.learningExplanation === 'object' ? data.learningExplanation : {};
      const transferPractice = Array.isArray(data.transferPractice)
        ? data.transferPractice.map(normalizeTransferPractice).filter((item) => item.scenario || item.prompt)
        : [];
      const normalizedLayers = layers.length > 0
        ? layers
        : highValueSentences.map((item, index) => ({
            name: item.functionName || `Move ${index + 1}`,
            purpose: item.whyUseful,
            sentence: item.sentence,
            smallerMove: item.slots
              .map((slot) => [slot.current, ...slot.swaps.slice(0, 2)].filter(Boolean).join(' -> '))
              .filter(Boolean)
              .join('; '),
            recommendedAssets: item.chunks,
          }));
      const fullSpokenVersion = toText(data.fullSpokenVersion) || toText(data.sampleAnswer);

      const plan = {
        title: toText(data.title) || topic,
        goal: toText(data.goal) || getPracticeGoal(practiceGoal).label,
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
        bigToSmallPath: toTextArray(data.bigToSmallPath || coreFrame.route),
        layers: normalizedLayers,
        sampleAnswer: fullSpokenVersion,
        fullSpokenVersion,
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

  function clearLiveRestartTimer() {
    if (liveRestartTimerRef.current) {
      window.clearTimeout(liveRestartTimerRef.current);
      liveRestartTimerRef.current = null;
    }
  }

  function clearLiveRecordingTimers() {
    if (liveRecordMaxTimerRef.current) {
      window.clearTimeout(liveRecordMaxTimerRef.current);
      liveRecordMaxTimerRef.current = null;
    }
    if (liveAnalyserLoopRef.current) {
      window.cancelAnimationFrame(liveAnalyserLoopRef.current);
      liveAnalyserLoopRef.current = null;
    }
  }

  function closeLiveAudioContext() {
    clearLiveRecordingTimers();
    if (liveAudioContextRef.current) {
      liveAudioContextRef.current.close().catch(() => {});
      liveAudioContextRef.current = null;
    }
  }

  function closeLiveAudioStream() {
    closeLiveAudioContext();
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
    }
  }

  function getLiveAudioMimeType() {
    if (!window.MediaRecorder) return '';
    const candidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || '';
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function scheduleLiveListening(delay = 450) {
    clearLiveRestartTimer();
    if (
      !liveShouldListenRef.current ||
      !liveActiveRef.current ||
      liveMutedRef.current ||
      liveLoadingRef.current ||
      liveSpeakingRef.current
    ) {
      return;
    }

    liveRestartTimerRef.current = window.setTimeout(() => {
      startLiveListening();
    }, delay);
  }

  function speakLive(text, afterSpeak) {
    if (!text) {
      afterSpeak?.();
      return;
    }

    liveSpeakingRef.current = true;
    stopLiveListening({ keepAuto: true });

    if (!window.speechSynthesis) {
      liveSpeakingRef.current = false;
      afterSpeak?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => {
      liveSpeakingRef.current = true;
    };
    utterance.onend = () => {
      liveSpeakingRef.current = false;
      afterSpeak?.();
    };
    utterance.onerror = () => {
      liveSpeakingRef.current = false;
      afterSpeak?.();
    };
    window.speechSynthesis.speak(utterance);
  }

  async function sendLiveAudio(blob, mimeType) {
    if (!blob || blob.size < 1200 || liveLoadingRef.current) {
      liveShouldListenRef.current = true;
      scheduleLiveListening(500);
      return;
    }

    setLiveMicHint('Understanding what you said...');
    setLiveLoading(true);
    liveLoadingRef.current = true;

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch(`${API_BASE}/api/live-transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      const data = await readApiJson(res, 'Live transcription failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Live transcription failed');
      }

      const transcript = toText(data.transcript);
      if (!transcript) {
        setLiveMicHint("I didn't catch that. Try speaking again.");
        liveShouldListenRef.current = true;
        scheduleLiveListening(650);
        return;
      }

      setLiveLoading(false);
      liveLoadingRef.current = false;
      await sendLiveTurn(transcript);
    } catch (err) {
      console.error('sendLiveAudio error:', err);
      setLiveMicHint('Audio transcription failed. I will listen again.');
      liveShouldListenRef.current = true;
      scheduleLiveListening(900);
    } finally {
      setLiveLoading(false);
      liveLoadingRef.current = false;
    }
  }

  async function sendLiveTurn(transcript) {
    const userText = toText(transcript);
    if (!userText || liveLoadingRef.current) return;

    const userMessage = { id: uid(), role: 'user', content: userText };
    const nextMessages = [...liveMessagesRef.current, userMessage];

    setLiveMessages(nextMessages);
    liveMessagesRef.current = nextMessages;
    setLiveLoading(true);
    liveLoadingRef.current = true;
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/api/live-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: liveScenario,
          focus: liveFocus,
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
        naturalVersion: toText(data.naturalVersion),
        feedback: toText(data.feedback),
        usefulChunks: toTextArray(data.usefulChunks),
        scores: data.scores && typeof data.scores === 'object'
          ? {
              clarity: toText(data.scores.clarity),
              naturalness: toText(data.scores.naturalness),
              chunkUse: toText(data.scores.chunkUse),
            }
          : null,
        assets: normalizeAssetList(data.assets, {
          sourceType: 'Drill',
          functionName: 'Scenario drill expression',
          expressionFunction: 'Improve spoken output in a real scene',
          notes: 'Extracted from scenario output drill.',
        }),
      };

      setLiveMessages((prev) => {
        const updated = [...prev, assistantMessage];
        liveMessagesRef.current = updated;
        return updated;
      });
      speakLive(assistantMessage.content, () => {
        liveShouldListenRef.current = false;
      });
    } catch (err) {
      console.error('sendLiveTurn error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Live practice failed. Please check the server connection and API key.'
        ),
      });
      liveShouldListenRef.current = false;
    } finally {
      setLiveLoading(false);
      liveLoadingRef.current = false;
    }
  }

  async function startLiveSession() {
    clearLiveRestartTimer();
    liveShouldListenRef.current = false;
    liveActiveRef.current = true;
    setLiveActive(true);
    setLiveMuted(false);
    setLiveMicHint('');
    setLiveSummary(null);
    setLiveAnswer('');
    setNotice(null);
    const opening = {
      id: uid(),
      role: 'assistant',
      content: getLiveOpening(liveScenario, liveFocus),
    };
    setLiveMessages([opening]);
    liveMessagesRef.current = [opening];
    speakLive(opening.content);
  }

  function stopLiveListening(options = {}) {
    const { keepAuto = false, discard = true } = options;
    if (!keepAuto) {
      liveShouldListenRef.current = false;
    }
    clearLiveRestartTimer();
    clearLiveRecordingTimers();
    liveRecordCancelRef.current = discard;
    if (liveRecorderRef.current && liveRecorderRef.current.state !== 'inactive') {
      liveRecorderRef.current.stop();
    }
    setLiveListening(false);
  }

  function startLiveSilenceDetection(recorder) {
    closeLiveAudioContext();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !liveStreamRef.current) {
      liveRecordMaxTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          liveRecordCancelRef.current = false;
          recorder.stop();
        }
      }, 6500);
      return;
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(liveStreamRef.current);
    const startedAt = Date.now();
    let heardVoice = false;
    let lastVoiceAt = Date.now();

    analyser.fftSize = 1024;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    liveAudioContextRef.current = audioContext;

    const stopAndSend = () => {
      if (recorder.state !== 'inactive') {
        liveRecordCancelRef.current = false;
        recorder.stop();
      }
    };

    const stopAndRetry = () => {
      if (recorder.state !== 'inactive') {
        liveRecordCancelRef.current = true;
        recorder.stop();
      }
    };

    function tick() {
      if (recorder.state === 'inactive') return;

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      const volume = Math.sqrt(sum / data.length);
      const now = Date.now();

      if (volume > 0.018) {
        heardVoice = true;
        lastVoiceAt = now;
      }

      if (heardVoice && now - lastVoiceAt > 1200 && now - startedAt > 900) {
        stopAndSend();
        return;
      }

      if (now - startedAt > 9000) {
        if (heardVoice) {
          stopAndSend();
        } else {
          setLiveMicHint("I don't hear anything yet. Still listening...");
          stopAndRetry();
        }
        return;
      }

      liveAnalyserLoopRef.current = window.requestAnimationFrame(tick);
    }

    liveRecordMaxTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') stopAndSend();
    }, 12000);
    tick();
  }

  async function startLiveListening() {
    if (
      !liveShouldListenRef.current ||
      !liveActiveRef.current ||
      liveMutedRef.current ||
      liveLoadingRef.current ||
      liveSpeakingRef.current ||
      liveRecorderRef.current
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice({
        type: 'error',
        message: 'Live recording is not supported in this browser. Chrome or Edge should work better.',
      });
      return;
    }

    try {
      if (!liveStreamRef.current) {
        liveStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    } catch (err) {
      liveShouldListenRef.current = false;
      liveMutedRef.current = true;
      setLiveMuted(true);
      setNotice({
        type: 'error',
        message: 'Microphone permission is blocked. Please allow microphone access, then resume the call.',
      });
      return;
    }

    const mimeType = getLiveAudioMimeType();
    const recorder = new MediaRecorder(
      liveStreamRef.current,
      mimeType ? { mimeType } : undefined
    );
    liveRecorderRef.current = recorder;
    liveRecordChunksRef.current = [];
    liveRecordCancelRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) liveRecordChunksRef.current.push(event.data);
    };

    recorder.onstart = () => {
      setLiveListening(true);
      setLiveMicHint('Listening. Pause for a moment to send your answer.');
      setNotice(null);
    };

    recorder.onstop = () => {
      setLiveListening(false);
      liveRecorderRef.current = null;
      closeLiveAudioContext();
      const chunks = liveRecordChunksRef.current;
      liveRecordChunksRef.current = [];

      if (liveRecordCancelRef.current) {
        liveRecordCancelRef.current = false;
        if (
          liveActiveRef.current &&
          liveShouldListenRef.current &&
          !liveMutedRef.current &&
          !liveLoadingRef.current &&
          !liveSpeakingRef.current
        ) {
          scheduleLiveListening(550);
        }
        return;
      }

      liveShouldListenRef.current = false;
      const audioBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      sendLiveAudio(audioBlob, audioBlob.type);
    };

    recorder.onerror = () => {
      setLiveListening(false);
      liveRecorderRef.current = null;
      closeLiveAudioContext();
      setLiveMicHint('Recorder had a temporary issue. I will listen again.');
      if (
        liveActiveRef.current &&
        liveShouldListenRef.current &&
        !liveMutedRef.current &&
        !liveLoadingRef.current &&
        !liveSpeakingRef.current
      ) {
        scheduleLiveListening(900);
      }
    };

    try {
      recorder.start();
      startLiveSilenceDetection(recorder);
    } catch (err) {
      liveRecorderRef.current = null;
      setLiveListening(false);
      setLiveMicHint('Recorder did not start. Try Retry Mic.');
    }
  }

  function retryLiveMic() {
    stopLiveListening({ keepAuto: true });
    setLiveMicHint('Retrying microphone...');
    setNotice(null);
    liveMutedRef.current = false;
    setLiveMuted(false);
    liveShouldListenRef.current = true;
    scheduleLiveListening(150);
  }

  function sendCurrentLiveRecording() {
    if (liveRecorderRef.current && liveRecorderRef.current.state !== 'inactive') {
      liveRecordCancelRef.current = false;
      liveRecorderRef.current.stop();
    }
  }

  function submitLiveAnswer() {
    const answer = toText(liveAnswer);
    if (!answer || liveLoadingRef.current) return;
    setLiveAnswer('');
    sendLiveTurn(answer);
  }

  function replayLastCoachLine() {
    const coachLine = [...liveMessagesRef.current]
      .reverse()
      .find((message) => message.role === 'assistant');
    if (coachLine?.content) speakLive(coachLine.content);
  }

  function toggleLiveMute() {
    const nextMuted = !liveMutedRef.current;
    liveMutedRef.current = nextMuted;
    setLiveMuted(nextMuted);

    if (nextMuted) {
      setLiveMicHint('Microphone paused.');
      stopLiveListening({ keepAuto: true });
    } else {
      setLiveMicHint('Resuming microphone...');
      liveShouldListenRef.current = true;
      scheduleLiveListening(100);
    }
  }

  async function endLiveSession() {
    liveShouldListenRef.current = false;
    stopLiveListening();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    liveSpeakingRef.current = false;
    liveActiveRef.current = false;
    setLiveActive(false);
    closeLiveAudioStream();

    if (liveMessagesRef.current.length < 2) return;

    setLiveLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/live-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: liveScenario,
          focus: liveFocus,
          messages: liveMessagesRef.current.map((message) => ({
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
          notes: 'Extracted from scenario output drill.',
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
      notes: 'Saved from scenario drill summary.',
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

  async function saveListeningAsset(asset, defaults = {}) {
    const normalized = normalizeAsset(asset, {
      sourceType: 'Listening',
      functionName: 'Listening asset',
      notes: 'Saved from Video Intensive Listening Lab.',
      ...defaults,
    });
    const next = [normalized, ...(Array.isArray(assets) ? assets : [])];

    try {
      const savedAssets = await persistNewAssets(next, [normalized]);
      setAssets(savedAssets);
      setNotice({ type: 'success', message: 'Saved listening asset to Assets.' });
      return normalized;
    } catch (err) {
      console.error('saveListeningAsset error:', err);
      setNotice({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Listening asset save failed. Please try again.'),
      });
      throw err;
    }
  }

  function saveListeningPack(pack) {
    const normalizedPack = {
      ...pack,
      id: toText(pack?.id) || uid(),
      savedAt: toText(pack?.savedAt) || new Date().toISOString(),
    };
    const nextPacks = [
      normalizedPack,
      ...listeningPacks.filter((item) => item.id !== normalizedPack.id),
    ].slice(0, 20);

    setListeningPacks(nextPacks);
    saveListeningPacks(nextPacks);
    setNotice({ type: 'success', message: 'Saved this listening pack to Daily Feed.' });
    return normalizedPack;
  }

  function deleteListeningPack(id) {
    const nextPacks = listeningPacks.filter((item) => item.id !== id);
    setListeningPacks(nextPacks);
    saveListeningPacks(nextPacks);
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
            listeningPacks={listeningPacks}
            saveListeningPack={saveListeningPack}
            deleteListeningPack={deleteListeningPack}
            saveListeningAsset={saveListeningAsset}
            setNotice={setNotice}
          />
        )}

        {tab === 'live' && (
          <LivePracticePage
            scenario={liveScenario}
            setScenario={setLiveScenario}
            focus={liveFocus}
            setFocus={setLiveFocus}
            answer={liveAnswer}
            setAnswer={setLiveAnswer}
            messages={liveMessages}
            active={liveActive}
            loading={liveLoading}
            summary={liveSummary}
            startSession={startLiveSession}
            submitAnswer={submitLiveAnswer}
            replayQuestion={replayLastCoachLine}
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
        { id: 'live', label: 'Scenario Drill', icon: MessageSquare },
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
  generateDailyAssets,
  dailyLoading,
  assetGoal,
  setAssetGoal,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
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

  return (
    <section className="page">
      <PageHeader
        title="Asset Library"
        subtitle="Save expressions from conversations, listening packs, structures, and daily recommendations, then review them as reusable assets."
      />

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
  const [selectionHelp, setSelectionHelp] = useState(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const layers = Array.isArray(structurePlan?.layers) ? structurePlan.layers : [];
  const path = Array.isArray(structurePlan?.bigToSmallPath) ? structurePlan.bigToSmallPath : [];
  const highValueSentences = Array.isArray(structurePlan?.highValueSentences)
    ? structurePlan.highValueSentences
    : [];
  const transferPractice = Array.isArray(structurePlan?.transferPractice)
    ? structurePlan.transferPractice
    : [];
  const frameRoute = toTextArray(structurePlan?.coreFrame?.route || path);

  function handleStructureSelection(anchorId) {
    const selectedText = window.getSelection?.().toString().trim() || '';

    if (!selectedText || selectedText.length > 280) {
      return;
    }

    setSelectionHelp({
      anchorId,
      text: selectedText,
      data: null,
      error: '',
    });
  }

  async function explainSelection() {
    if (!selectionHelp?.text || selectionLoading) return;

    setSelectionLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/translate-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectionHelp.text,
          context: toText(structurePlan?.fullSpokenVersion || structurePlan?.sampleAnswer),
        }),
      });
      const data = await readApiJson(res, 'Selection explanation failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Selection explanation failed');
      }

      setSelectionHelp((current) => ({
        ...(current || {}),
        data,
        error: '',
      }));
    } catch (err) {
      setSelectionHelp((current) => ({
        ...(current || {}),
        error: friendlyErrorMessage(err.message, 'Selection explanation failed.'),
      }));
    } finally {
      setSelectionLoading(false);
    }
  }

  function renderSelectionHelper(anchorId) {
    if (!selectionHelp?.text || selectionHelp.anchorId !== anchorId) return null;

    return (
      <div className="selection-helper inline" onMouseUp={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow">Selected Text</p>
          <strong>{selectionHelp.text}</strong>
        </div>
        {!selectionHelp.data && !selectionHelp.error && (
          <button className="ghost-button small" onClick={explainSelection} disabled={selectionLoading}>
            {selectionLoading ? 'Explaining...' : 'Explain in Chinese'}
          </button>
        )}
        {selectionHelp.data && (
          <div className="selection-result">
            <p>{toText(selectionHelp.data.meaningZh)}</p>
            <p>{toText(selectionHelp.data.usageZh)}</p>
            {Array.isArray(selectionHelp.data.naturalAlternatives) &&
              selectionHelp.data.naturalAlternatives.length > 0 && (
                <div className="pill-row">
                  {selectionHelp.data.naturalAlternatives.map((item) => (
                    <span className="pill blue" key={toText(item)}>
                      {toText(item)}
                    </span>
                  ))}
                </div>
              )}
            {selectionHelp.data.example && <div className="layer-move">{toText(selectionHelp.data.example)}</div>}
          </div>
        )}
        {selectionHelp.error && <p className="error-text">{selectionHelp.error}</p>}
        <button className="icon-button" onClick={() => setSelectionHelp(null)}>
          <X size={16} />
        </button>
      </div>
    );
  }

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
                <p className="eyebrow">This Situation Is...</p>
                <h2>{toText(structurePlan.title)}</h2>
                <p onMouseUp={() => handleStructureSelection('situation')}>
                  <strong>{toText(structurePlan.situationType?.name) || toText(structurePlan.goal)}</strong>
                  {toText(structurePlan.situationType?.whyThisFrame)
                    ? ` - ${toText(structurePlan.situationType.whyThisFrame)}`
                    : ''}
                </p>
                {renderSelectionHelper('situation')}
                {Array.isArray(structurePlan.situationType?.useWhen) &&
                  structurePlan.situationType.useWhen.length > 0 && (
                    <div className="pill-row">
                      {structurePlan.situationType.useWhen.map((item) => (
                        <span className="pill blue" key={toText(item)}>
                          {toText(item)}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {(structurePlan.learningExplanation?.whyThisFrameZh ||
                structurePlan.learningExplanation?.howToUseZh ||
                structurePlan.learningExplanation?.commonMistakeZh) && (
                <div className="structure-section explanation-section">
                  <p className="eyebrow">Learning Explanation</p>
                  {structurePlan.learningExplanation?.whyThisFrameZh && (
                    <div className="explain-row">
                      <strong>Why this frame works</strong>
                      <p onMouseUp={() => handleStructureSelection('explain-why')}>
                        {toText(structurePlan.learningExplanation.whyThisFrameZh)}
                      </p>
                      {renderSelectionHelper('explain-why')}
                    </div>
                  )}
                  {structurePlan.learningExplanation?.howToUseZh && (
                    <div className="explain-row">
                      <strong>How to practice it</strong>
                      <p onMouseUp={() => handleStructureSelection('explain-how')}>
                        {toText(structurePlan.learningExplanation.howToUseZh)}
                      </p>
                      {renderSelectionHelper('explain-how')}
                    </div>
                  )}
                  {Array.isArray(structurePlan.learningExplanation?.reuseSteps) &&
                    structurePlan.learningExplanation.reuseSteps.length > 0 && (
                      <div className="explain-row">
                        <strong>Reuse steps</strong>
                        <div className="pill-row">
                          {structurePlan.learningExplanation.reuseSteps.map((step) => (
                            <span className="pill" key={toText(step)}>
                              {toText(step)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {structurePlan.learningExplanation?.commonMistakeZh && (
                    <div className="explain-row">
                      <strong>Common trap</strong>
                      <p onMouseUp={() => handleStructureSelection('explain-mistake')}>
                        {toText(structurePlan.learningExplanation.commonMistakeZh)}
                      </p>
                      {renderSelectionHelper('explain-mistake')}
                    </div>
                  )}
                </div>
              )}

              <div className="structure-section">
                <div>
                  <p className="eyebrow">Use This Native Frame</p>
                  <h3>{toText(structurePlan.coreFrame?.name) || 'Reusable speaking route'}</h3>
                  <p onMouseUp={() => handleStructureSelection('core-frame')}>
                    {toText(structurePlan.coreFrame?.plainExplanation) || toText(structurePlan.practicePrompt)}
                  </p>
                  {renderSelectionHelper('core-frame')}
                </div>

                {frameRoute.length > 0 && (
                  <div className="structure-path">
                    {frameRoute.map((item, index) => (
                    <span key={`${toText(item)}-${index}`}>{toText(item)}</span>
                    ))}
                  </div>
                )}

                <div className="structure-layers">
                  {(highValueSentences.length > 0 ? highValueSentences : layers.map((layer) => ({
                    sentence: layer.sentence,
                    functionName: layer.name,
                    whyUseful: layer.purpose,
                    slots: toText(layer.smallerMove)
                      ? [{ label: 'Swap', current: toText(layer.smallerMove), swaps: [] }]
                      : [],
                    chunks: toTextArray(layer.recommendedAssets),
                    scenarios: [],
                  }))).map((item, index) => (
                    <div className="structure-layer" key={`${toText(item.sentence)}-${index}`}>
                      <div className="layer-index">{index + 1}</div>
                      <div>
                        <p className="eyebrow">{toText(item.functionName) || `Sentence ${index + 1}`}</p>
                        <h3 onMouseUp={() => handleStructureSelection(`sentence-${index}`)}>{toText(item.sentence)}</h3>
                        {renderSelectionHelper(`sentence-${index}`)}
                        <p onMouseUp={() => handleStructureSelection(`why-${index}`)}>{toText(item.whyUseful)}</p>
                        {renderSelectionHelper(`why-${index}`)}

                        {Array.isArray(item.slots) && item.slots.length > 0 && (
                          <div className="slot-list">
                            {item.slots.map((slot, slotIndex) => (
                              <div className="slot-item" key={`${toText(slot.label)}-${slotIndex}`}>
                                <strong>{toText(slot.label) || 'Slot'}</strong>
                                <span onMouseUp={() => handleStructureSelection(`slot-${index}-${slotIndex}`)}>
                                  {toText(slot.current)}
                                </span>
                                {renderSelectionHelper(`slot-${index}-${slotIndex}`)}
                                {slot.swaps.length > 0 && (
                                  <div className="pill-row">
                                    {slot.swaps.map((swap) => (
                                      <span className="pill" key={toText(swap)}>
                                        {toText(swap)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {Array.isArray(item.chunks) && item.chunks.length > 0 && (
                          <div className="pill-row">
                            {item.chunks.map((chunk) => (
                              <span className="pill blue" key={toText(chunk)}>
                                {toText(chunk)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {transferPractice.length > 0 && (
                <div className="structure-section">
                  <div>
                    <p className="eyebrow">Practice By Swapping</p>
                    <h3>Move the same frame into new scenes</h3>
                    <p onMouseUp={() => handleStructureSelection('practice-prompt')}>
                      {toText(structurePlan.practicePrompt)}
                    </p>
                    {renderSelectionHelper('practice-prompt')}
                  </div>

                  <div className="transfer-grid">
                    {transferPractice.map((item, index) => (
                      <div className="transfer-card" key={`${toText(item.scenario)}-${index}`}>
                        <p className="eyebrow">{toText(item.scenario) || `Swap ${index + 1}`}</p>
                        <h3 onMouseUp={() => handleStructureSelection(`transfer-focus-${index}`)}>
                          {toText(item.swapFocus)}
                        </h3>
                        {renderSelectionHelper(`transfer-focus-${index}`)}
                        <p onMouseUp={() => handleStructureSelection(`transfer-prompt-${index}`)}>
                          {toText(item.prompt)}
                        </p>
                        {renderSelectionHelper(`transfer-prompt-${index}`)}
                        {item.sampleLine && (
                          <div
                            className="layer-move"
                            onMouseUp={() => handleStructureSelection(`transfer-line-${index}`)}
                          >
                            {toText(item.sampleLine)}
                            {renderSelectionHelper(`transfer-line-${index}`)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="practice-card">
                <p className="eyebrow">Full Spoken Version</p>
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
  focus,
  setFocus,
  answer,
  setAnswer,
  messages,
  active,
  loading,
  summary,
  startSession,
  submitAnswer,
  replayQuestion,
  endSession,
  saveAsset,
}) {
  const summaryAssets = Array.isArray(summary?.assets) ? summary.assets : [];
  const currentScene = getLiveScene(scenario);
  const currentFocus = getLiveFocus(focus);

  return (
    <section className="page">
      <PageHeader
        title="Scenario Drill"
        subtitle="Practice real scenes in a stable loop: listen to the question, answer, improve, then save useful expressions."
      />

      <div className="live-layout">
        <aside className="live-control">
          <div className="live-phone-card">
            <div className={active ? 'live-orb active' : 'live-orb'}>
              <MessageSquare size={30} />
            </div>
            <h3>{active ? 'Drill in progress' : 'Ready for a scene drill'}</h3>
            <p>
              The coach asks, you answer in writing, then SpeakFrame turns your answer into natural reusable English.
            </p>
          </div>

          <div className="goal-selector">
            <label>Practice Scene</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={active}>
              {LIVE_SCENES.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.label}
                </option>
              ))}
            </select>
            <p>{currentScene.prompt}</p>
          </div>

          <div className="goal-selector">
            <label>Practice Focus</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)} disabled={active}>
              {LIVE_FOCUS_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p>{currentFocus.prompt}</p>
          </div>

          {!active ? (
            <button className="save-button" onClick={startSession}>
              <Play size={18} />
              Start Drill
            </button>
          ) : (
            <div className="live-call-actions">
              <div className="live-talk-status">
                <Headphones size={22} />
                <strong>Listen, answer, improve</strong>
                <span>No microphone required. Use replay if you want to hear the question again.</span>
              </div>

              <button className="ghost-button" onClick={replayQuestion} disabled={loading}>
                <Play size={18} />
                Replay Question
              </button>

              <button className="ghost-button" onClick={endSession} disabled={loading || messages.length < 2}>
                <Square size={18} />
                Summarize & Save
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
                  {message.scores && (
                    <div className="drill-score-row">
                      {message.scores.clarity && <span>Clarity: {message.scores.clarity}</span>}
                      {message.scores.naturalness && <span>Natural: {message.scores.naturalness}</span>}
                      {message.scores.chunkUse && <span>Chunks: {message.scores.chunkUse}</span>}
                    </div>
                  )}
                  {message.naturalVersion && (
                    <div className="expression-rescue">
                      <strong>Natural version</strong>
                      <p>{toText(message.naturalVersion)}</p>
                    </div>
                  )}
                  {message.feedback && (
                    <div className="expression-rescue">
                      <strong>Why it works</strong>
                      <p>{toText(message.feedback)}</p>
                    </div>
                  )}
                  {Array.isArray(message.usefulChunks) && message.usefulChunks.length > 0 && (
                    <div className="drill-chip-row">
                      {message.usefulChunks.map((chunk) => (
                        <span className="tag-pill" key={chunk}>{chunk}</span>
                      ))}
                    </div>
                  )}
                  {message.rescue?.naturalExpression && (
                    <div className="expression-rescue">
                      <strong>Expression rescue</strong>
                      <p>{toText(message.rescue.naturalExpression)}</p>
                      {message.rescue.pattern && <small>{toText(message.rescue.pattern)}</small>}
                    </div>
                  )}
                  {Array.isArray(message.assets) && message.assets.length > 0 && (
                    <div className="drill-suggested-assets">
                      {message.assets.map((asset) => (
                        <button className="ghost-button small" key={asset.id} onClick={() => saveAsset(asset)}>
                          <Save size={14} />
                          Save {toText(asset.type) || 'Asset'}
                        </button>
                      ))}
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

          {active && (
            <div className="drill-answer-panel">
              <label>Your Answer</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer in English. If you get stuck, write Chinese like: 这句话怎么说..."
                rows={4}
                disabled={loading}
              />
              <div className="drill-answer-actions">
                <p>Tip: short answer is fine. The coach will make it natural and give you the next question.</p>
                <button className="save-button" onClick={submitAnswer} disabled={loading || !toText(answer)}>
                  <Send size={18} />
                  Submit Answer
                </button>
              </div>
            </div>
          )}

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

function getYouTubeEmbedUrl(url) {
  const raw = toText(url);
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    let videoId = '';

    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.includes('/shorts/')) {
        videoId = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      } else if (parsed.pathname.includes('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  } catch {
    return '';
  }
}

function getListeningTokens(text) {
  return toText(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function getListeningOverlap(target, attempt) {
  const targetWords = [...new Set(getListeningTokens(target))];
  const attemptWords = new Set(getListeningTokens(attempt));
  const caught = targetWords.filter((word) => attemptWords.has(word));
  const missed = targetWords.filter((word) => !attemptWords.has(word)).slice(0, 10);
  const score = targetWords.length ? Math.round((caught.length / targetWords.length) * 100) : 0;

  return { caught, missed, score };
}

function normalizeListeningPackForClient(pack) {
  const safePack = pack && typeof pack === 'object' ? pack : {};
  const sentences = Array.isArray(safePack.sentences)
    ? safePack.sentences.map((item, index) => ({
        ...item,
        id: toText(item.id) || `line-${index + 1}`,
        original: toText(item.original),
        naturalSpeech: toText(item.naturalSpeech) || toText(item.original),
        meaningZh: toText(item.meaningZh),
        listeningProblem: toText(item.listeningProblem),
        functionName: toText(item.functionName),
        pattern: toText(item.pattern),
        whyUse: toText(item.whyUse),
        slots: toTextArray(item.slots),
        chunks: Array.isArray(item.chunks)
          ? item.chunks.map((chunk) => ({
              text: toText(chunk.text || chunk),
              whyHard: toText(chunk.whyHard),
            })).filter((chunk) => chunk.text)
          : [],
        extensionExamples: toTextArray(item.extensionExamples),
        replacementDrills: toTextArray(item.replacementDrills),
        saveSuggestions: normalizeAssetList(item.saveSuggestions, {
          sourceType: 'Listening',
          sourceUrl: toText(safePack.sourceUrl),
        }),
      })).filter((item) => item.original)
    : [];

  return {
    ...safePack,
    id: toText(safePack.id) || uid(),
    sourceTitle: toText(safePack.sourceTitle) || 'Video Listening Pack',
    sourceUrl: toText(safePack.sourceUrl),
    sourceSummary: toText(safePack.sourceSummary),
    listeningGoal: toText(safePack.listeningGoal),
    beforeListening: toTextArray(safePack.beforeListening),
    finalTask: {
      prompt: toText(safePack.finalTask?.prompt) || 'Describe what this video is about in your own English.',
      checklist: toTextArray(safePack.finalTask?.checklist),
    },
    recommendedAssets: normalizeAssetList(safePack.recommendedAssets, {
      sourceType: 'Listening',
      sourceUrl: toText(safePack.sourceUrl),
    }),
    sentences,
  };
}

function ListenPage({
  assets,
  practice,
  structurePlan,
  listeningPacks,
  saveListeningPack,
  deleteListeningPack,
  saveListeningAsset,
  setNotice,
}) {
  const [sourceMode, setSourceMode] = useState('video');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [activePack, setActivePack] = useState(() => normalizeListeningPackForClient((listeningPacks || [])[0]));
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [videoStudyView, setVideoStudyView] = useState('analysis');
  const [sentenceStep, setSentenceStep] = useState(1);
  const [sentenceDrafts, setSentenceDrafts] = useState({});
  const [revealedLines, setRevealedLines] = useState({});
  const [meaningLines, setMeaningLines] = useState({});
  const [swapDrafts, setSwapDrafts] = useState({});
  const [finalSummary, setFinalSummary] = useState('');
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [savedAssetKeys, setSavedAssetKeys] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopCount, setLoopCount] = useState(3);
  const [showText, setShowText] = useState(true);
  const [includeMeaning, setIncludeMeaning] = useState(false);
  const sourceTextRef = useRef('');
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

  const safePacks = Array.isArray(listeningPacks) ? listeningPacks : [];
  const safePack = normalizeListeningPackForClient(activePack);
  const activeSentence = safePack.sentences[activeSentenceIndex] || null;
  const originalSourceUrl = safePack.sourceUrl || sourceUrl;
  const embedUrl = getYouTubeEmbedUrl(originalSourceUrl) || originalSourceUrl;
  const currentDraft = activeSentence ? toText(sentenceDrafts[activeSentence.id]) : '';
  const overlap = activeSentence ? getListeningOverlap(activeSentence.original, currentDraft) : { caught: [], missed: [], score: 0 };
  const isLoopMode = ['assets', 'recombine', 'structure'].includes(sourceMode);
  const sentenceStepLabels = ['Listen', 'Chunks', 'Swap', 'Final'];

  async function uploadListeningSourceFile(file) {
    if (!file || fileLoading) return;

    setFileLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/listening-source-file`, {
        method: 'POST',
        body: formData,
      });
      const data = await readApiJson(res, 'Transcript file upload failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Transcript file upload failed');
      }

      const extractedText = toText(data.text);
      sourceTextRef.current = extractedText;
      setSourceText(extractedText);
      setSourceFileName(file.name);
      setNotice?.({
        type: 'success',
        message: `Transcript loaded from ${file.name}. ${data.sentenceCount || 0} sentence unit(s) detected.`,
      });
    } catch (err) {
      console.error('uploadListeningSourceFile error:', err);
      setNotice?.({
        type: 'error',
        message: getFriendlyApiError(err, 'Transcript file upload failed. Try .txt, .srt, .vtt, .md, .pdf, or .docx.'),
      });
    } finally {
      setFileLoading(false);
    }
  }

  async function generateListeningPack() {
    if (packLoading) return;
    const cleanUrl = sourceUrl.trim();
    const cleanText = (sourceText.trim() || sourceTextRef.current.trim());

    if (!cleanUrl && !cleanText) {
      setNotice?.({ type: 'error', message: 'Paste a video/blog link or transcript text first.' });
      return;
    }

    setPackLoading(true);
    setReview(null);

    try {
      const res = await fetch(`${API_BASE}/api/listening-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: cleanUrl, sourceText: cleanText }),
      });
      const data = await readApiJson(res, 'Listening pack API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Listening pack API failed');
      }

      const normalized = normalizeListeningPackForClient({
        ...data,
        sourceUrl: data.sourceUrl || cleanUrl,
      });
      const savedPack = saveListeningPack(normalized);
      setActivePack(savedPack);
      setActiveSentenceIndex(0);
      setVideoStudyView('analysis');
      setSentenceStep(1);
      setSentenceDrafts({});
      setRevealedLines({});
      setMeaningLines({});
      setSwapDrafts({});
      setFinalSummary('');
    } catch (err) {
      console.error('generateListeningPack error:', err);
      setNotice?.({
        type: 'error',
        message: friendlyErrorMessage(
          err.message,
          'Listening pack generation failed. Paste transcript text if the link does not expose captions.'
        ),
      });
    } finally {
      setPackLoading(false);
    }
  }

  function choosePack(pack) {
    setActivePack(normalizeListeningPackForClient(pack));
    setActiveSentenceIndex(0);
    setVideoStudyView('analysis');
    setSentenceStep(1);
    setSourceMode('video');
    setReview(null);
  }

  function chooseSentence(index) {
    setActiveSentenceIndex(index);
    setVideoStudyView('analysis');
    setSentenceStep(1);
  }

  function startSentenceTest() {
    setVideoStudyView('test');
    setSentenceStep(1);
  }

  function previousTrainingStep() {
    if (sentenceStep > 1) {
      setSentenceStep((step) => Math.max(1, step - 1));
      return;
    }

    if (activeSentenceIndex > 0) {
      setActiveSentenceIndex((index) => index - 1);
      setSentenceStep(3);
    }
  }

  function nextTrainingStep() {
    if (sentenceStep < 3) {
      setSentenceStep((step) => step + 1);
      return;
    }

    if (activeSentenceIndex < safePack.sentences.length - 1) {
      setActiveSentenceIndex((index) => index + 1);
      setSentenceStep(1);
      return;
    }

    setSentenceStep(5);
  }

  function revealLine(id) {
    setRevealedLines((value) => ({ ...value, [id]: true }));
  }

  function toggleMeaning(id) {
    setMeaningLines((value) => ({ ...value, [id]: !value[id] }));
  }

  function updateSentenceDraft(id, value) {
    setSentenceDrafts((drafts) => ({ ...drafts, [id]: value }));
  }

  function updateSwapDraft(id, index, value) {
    setSwapDrafts((drafts) => ({
      ...drafts,
      [`${id}-${index}`]: value,
    }));
  }

  function playSentence(sentence, speechRate = rate) {
    return speak(sentence?.naturalSpeech || sentence?.original || '', speechRate);
  }

  async function playSentenceChunks(sentence, speechRate = Math.max(0.3, Number(rate))) {
    const chunks = Array.isArray(sentence?.chunks) && sentence.chunks.length
      ? sentence.chunks
      : splitSentences(sentence?.original || '').map((text) => ({ text }));

    for (const chunk of chunks) {
      if (stopRef.current) break;
      await speak(chunk.text, speechRate);
      if (stopRef.current) break;
      await wait(450);
    }
  }

  async function savePackAsset(asset, sentence) {
    const key = `${sentence?.id || 'pack'}-${toText(asset.text || asset.assetText)}`;
    await saveListeningAsset(asset, {
      sourceUrl: safePack.sourceUrl,
      sourceType: 'Listening',
      theme: safePack.sourceTitle,
      notes: `Saved from ${safePack.sourceTitle}.`,
    });
    setSavedAssetKeys((keys) => (keys.includes(key) ? keys : [...keys, key]));
  }

  async function reviewFinalSummary() {
    if (!finalSummary.trim() || reviewLoading) {
      if (!finalSummary.trim()) {
        setNotice?.({ type: 'error', message: 'Write your understanding of the video before asking for a score.' });
      }
      return;
    }

    setReviewLoading(true);

    try {
      const sentenceNotes = safePack.sentences.map((sentence) => ({
        original: sentence.original,
        learnerHeard: toText(sentenceDrafts[sentence.id]),
        revealed: Boolean(revealedLines[sentence.id]),
      }));
      const res = await fetch(`${API_BASE}/api/listening-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTitle: safePack.sourceTitle,
          sourceSummary: safePack.sourceSummary,
          userSummary: finalSummary,
          sentenceNotes,
        }),
      });
      const data = await readApiJson(res, 'Listening review API failed');

      if (!res.ok || data.error) {
        throw new Error(data.detail || data.error || 'Listening review API failed');
      }

      setReview({
        ...data,
        assets: normalizeAssetList(data.assets, {
          sourceType: 'Listening',
          sourceUrl: safePack.sourceUrl,
          theme: safePack.sourceTitle,
        }),
      });
    } catch (err) {
      console.error('reviewFinalSummary error:', err);
      setNotice?.({
        type: 'error',
        message: friendlyErrorMessage(err.message, 'Listening review failed. Please try again.'),
      });
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Video Intensive Listening Lab"
        subtitle="Use one real video or transcript: listen without subtitles, write what you hear, reveal, diagnose, drill chunks, extend patterns, then summarize and save the best assets."
      />

      <div className="mode-switch listen-subtabs">
        <button
          className={!isLoopMode ? 'mode-button active' : 'mode-button'}
          onClick={() => setSourceMode('video')}
        >
          Video Study
          <span>Import a video or transcript and study it sentence by sentence.</span>
        </button>
        <button
          className={isLoopMode ? 'mode-button active' : 'mode-button'}
          onClick={() => setSourceMode('assets')}
        >
          Asset Playback
          <span>Loop saved assets, recombination tasks, or structure frames.</span>
        </button>
      </div>

      <div className="listen-layout">
        <aside className="listen-control">
          {!isLoopMode && (
            <>
              <div className="video-lab-builder primary-builder">
                <div>
                  <p className="eyebrow">1 · Import Listening Source</p>
                  <h3>Video + Transcript to Daily Feed</h3>
                  <p>Add the source video, then provide the full transcript so every sentence can become a listening unit.</p>
                </div>
                <label>Video / Blog Link</label>
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="Paste YouTube, blog, course, or public link..."
                />
                <label>Transcript / Captions File</label>
                <label className={`file-upload-box ${fileLoading ? 'is-loading' : ''}`}>
                  <input
                    type="file"
                    accept=".txt,.srt,.vtt,.md,.pdf,.docx,text/plain,text/vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={fileLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      uploadListeningSourceFile(file);
                      e.target.value = '';
                    }}
                  />
                  <FileText size={18} />
                  <span>{fileLoading ? 'Reading file...' : sourceFileName || 'Upload transcript, captions, PDF, or DOCX'}</span>
                </label>
                <label>Or Paste Transcript / Captions</label>
                <textarea
                  value={sourceText}
                  onChange={(e) => {
                    sourceTextRef.current = e.target.value;
                    setSourceText(e.target.value);
                    if (!e.target.value.trim()) setSourceFileName('');
                  }}
                  placeholder="Paste the full transcript or captions here. The app will split every sentence for listening practice."
                />
                <button className="save-button" onClick={generateListeningPack} disabled={packLoading}>
                  <Sparkles size={17} />
                  {packLoading ? 'Building Pack...' : 'Generate Listening Pack'}
                </button>
              </div>

              <div className="daily-feed-list">
                <div className="select-panel-header">
                  <div>
                    <p className="eyebrow">2 · Daily Feed</p>
                    <h3>Saved Packs</h3>
                    <p>{safePacks.length} pack(s)</p>
                  </div>
                </div>
                {safePacks.length === 0 ? (
                  <p className="muted-text">No listening packs yet. Generate one above.</p>
                ) : (
                  safePacks.map((pack) => (
                    <div className="feed-pack-row" key={pack.id}>
                      <button
                        className={pack.id === safePack.id ? 'select-asset selected' : 'select-asset'}
                        onClick={() => choosePack(pack)}
                      >
                        <div>
                          <strong>{toText(pack.sourceTitle)}</strong>
                          <span>{toText(pack.sourceSummary) || `${pack.sentences?.length || 0} sentences`}</span>
                        </div>
                        <ChevronRight size={17} />
                      </button>
                      <button className="icon-button danger" onClick={() => deleteListeningPack(pack.id)} aria-label="Delete pack">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {safePack.sentences.length > 0 && (
                <div className="sentence-list-panel">
                  <div className="select-panel-header">
                    <div>
                      <p className="eyebrow">3 · Sentence Units</p>
                      <h3>Study Lines</h3>
                      <p>{safePack.sentences.length} transcript sentence unit(s)</p>
                    </div>
                  </div>
                  {safePack.sentences.map((sentence, index) => (
                    <button
                      key={sentence.id}
                      className={index === activeSentenceIndex ? 'listen-queue-item active' : 'listen-queue-item'}
                      onClick={() => chooseSentence(index)}
                    >
                      <span>{index + 1}</span>
                      <div>
                        <strong>{revealedLines[sentence.id] ? sentence.original : sentence.functionName || sentence.pattern || 'Daily spoken English'}</strong>
                        <p>{revealedLines[sentence.id] ? sentence.functionName || sentence.pattern : sentence.pattern || sentence.listeningProblem || 'Click to study this line'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {isLoopMode && (
            <>
              <div className="listen-loop-panel">
                <div className="select-panel-header">
              <div>
                    <p className="eyebrow">Playback Source</p>
                    <h3>Practice Saved Output</h3>
                  </div>
                </div>
                <div className="mode-switch compact">
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
            </>
          )}
        </aside>

        {!isLoopMode ? (
          <div className="video-lab">
            {safePack.sentences.length === 0 ? (
              <EmptyState
                title="Generate a listening pack"
                text="Paste a video link or transcript. The app will turn the full transcript into sentence-level listening, analysis, testing, and a small set of worth-saving assets."
              />
            ) : (
              <>
                <div className="video-lab-hero">
                  <div className="video-lab-title-row">
                    <div>
                    <p className="eyebrow">Original Video First</p>
                    <h2>{safePack.sourceTitle}</h2>
                    </div>
                    <span>{safePack.sentences.length} sentence units</span>
                  </div>
                  {embedUrl ? (
                    <div className="embedded-source">
                      <iframe
                        className="video-embed"
                        title={safePack.sourceTitle}
                        src={embedUrl}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                      {originalSourceUrl && (
                        <a className="source-open-link" href={originalSourceUrl} target="_blank" rel="noreferrer">
                          Open in new tab if the page blocks embedded playback
                        </a>
                      )}
                    </div>
                  ) : null}
                  {activeSentence && (
                    <div className="video-control-strip">
                      <button className="ghost-button small" onClick={() => playSentence(activeSentence, 1)}>
                        <Play size={15} />
                        Play current line
                      </button>
                      <button className="ghost-button small" onClick={() => playSentence(activeSentence, 0.5)}>
                        <Play size={15} />
                        Slow line
                      </button>
                      <button className="ghost-button small" onClick={() => playSentenceChunks(activeSentence, rate)}>
                        <Headphones size={15} />
                        Chunk audio
                      </button>
                    </div>
                  )}
                </div>

                <div className="sentence-study-panel">
                    {activeSentence && (
                      <div className="video-study-inner-tabs">
                        <button
                          className={videoStudyView === 'analysis' ? 'filter-chip active' : 'filter-chip'}
                          onClick={() => setVideoStudyView('analysis')}
                        >
                          Study / Analysis
                        </button>
                        <button
                          className={videoStudyView === 'test' ? 'filter-chip active' : 'filter-chip'}
                          onClick={startSentenceTest}
                        >
                          Listening Test
                        </button>
                      </div>
                    )}

                    {activeSentence && videoStudyView === 'analysis' && (
                      <div className="prestudy-panel embedded">
                        <div className="prestudy-header">
                          <div>
                            <p className="eyebrow">Pre-study Analysis</p>
                            <h3>Learn the sentence before the listening test</h3>
                            <p>先把这一句的功能、句型、chunk 和可替换位置看懂，再进入听写测试。</p>
                          </div>
                          <span>Line {activeSentenceIndex + 1}</span>
                        </div>

                        <div className="prestudy-grid">
                          <div className="prestudy-main">
                            <p className="eyebrow">Original sentence</p>
                            <h3>{activeSentence.original}</h3>
                            <p>{activeSentence.meaningZh || activeSentence.functionName}</p>
                          </div>

                          <div className="prestudy-card">
                            <p className="eyebrow">Function</p>
                            <strong>{activeSentence.functionName || 'Daily spoken English'}</strong>
                            <p>{activeSentence.whyUse || 'Notice what this line is doing in the conversation.'}</p>
                          </div>

                          <div className="prestudy-card">
                            <p className="eyebrow">Pattern</p>
                            <strong>{activeSentence.pattern || activeSentence.original}</strong>
                            {activeSentence.slots.length > 0 && (
                              <div className="pill-row">
                                {activeSentence.slots.map((slot) => <span className="pill" key={slot}>{slot}</span>)}
                              </div>
                            )}
                          </div>

                          <div className="prestudy-card">
                            <p className="eyebrow">Sound chunks</p>
                            <div className="pill-row">
                              {activeSentence.chunks.slice(0, 5).map((chunk) => (
                                <button className="pill button-pill" key={chunk.text} onClick={() => speak(chunk.text, rate)}>
                                  {chunk.text}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="sentence-nav">
                          <button className="ghost-button" onClick={() => playSentence(activeSentence, 0.5)}>
                            <Play size={17} />
                            Slow Preview
                          </button>
                          <button className="save-button" onClick={startSentenceTest}>
                            Start Listening Test
                          </button>
                        </div>
                      </div>
                    )}

                    {activeSentence && videoStudyView === 'test' && sentenceStep < 5 && (
                      <>
                        <div className="listening-test-header">
                          <div>
                            <p className="eyebrow">Line {activeSentenceIndex + 1} of {safePack.sentences.length}</p>
                            <h2>{sentenceStepLabels[sentenceStep - 1]}</h2>
                          </div>
                          <div className="test-step-track">
                            {sentenceStepLabels.slice(0, 3).map((label, index) => (
                              <span key={label} className={index + 1 === sentenceStep ? 'active' : index + 1 < sentenceStep ? 'done' : ''}>
                                {index + 1}
                              </span>
                            ))}
                          </div>
                        </div>

                        {sentenceStep === 1 && (
                          <>
                            <div className="listen-now">
                              <p className="eyebrow">Step 1 · Listen, Write, Then Reveal</p>
                              <h2>Question Mode</h2>
                              <p className={revealedLines[activeSentence.id] && showText ? '' : 'hidden-text'}>
                                {activeSentence.original}
                              </p>
                              <div className="listen-actions">
                                <button className="save-button" onClick={() => playSentence(activeSentence, 1)}>
                                  <Play size={17} />
                                  Play Sentence
                                </button>
                                <button className="ghost-button" onClick={() => playSentence(activeSentence, 0.5)}>
                                  <Play size={17} />
                                  Slow
                                </button>
                                <button className="ghost-button" onClick={() => revealLine(activeSentence.id)}>
                                  <Eye size={17} />
                                  Reveal Transcript
                                </button>
                                <button className="ghost-button" onClick={() => toggleMeaning(activeSentence.id)}>
                                  中文
                                </button>
                              </div>
                            </div>

                            <div className="dictation-box">
                              <label>Write the sentence you heard, or describe it in your own words</label>
                              <textarea
                                value={currentDraft}
                                onChange={(e) => updateSentenceDraft(activeSentence.id, e.target.value)}
                                placeholder="Type what you heard here..."
                              />
                              {revealedLines[activeSentence.id] && (
                                <div className="listening-diagnosis">
                                  <strong>Listening match: {overlap.score}%</strong>
                                  <p>Caught: {overlap.caught.length ? overlap.caught.join(', ') : 'not enough yet'}</p>
                                  <p>Missed: {overlap.missed.length ? overlap.missed.join(', ') : 'looks solid'}</p>
                                  <p>{activeSentence.listeningProblem}</p>
                                </div>
                              )}
                              {meaningLines[activeSentence.id] && (
                                <div className="meaning-card">
                                  <strong>中文理解</strong>
                                  <p>{activeSentence.meaningZh || 'No Chinese meaning generated for this line.'}</p>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {sentenceStep === 2 && (
                          <div className="structure-section test-card">
                            <p className="eyebrow">Step 2 · Chunk Listening</p>
                            <h3>Hear it as sound blocks</h3>
                            <button className="save-button inline-action" onClick={() => playSentenceChunks(activeSentence, rate)}>
                              <Headphones size={17} />
                              Play All Chunks
                            </button>
                            <div className="chunk-grid">
                              {activeSentence.chunks.map((chunk) => (
                                <button className="chunk-card" key={chunk.text} onClick={() => speak(chunk.text, rate)}>
                                  <strong>{chunk.text}</strong>
                                  <span>{chunk.whyHard || 'Repeat this as one sound unit.'}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {sentenceStep === 3 && (
                          <div className="structure-section test-card">
                            <p className="eyebrow">Step 3 · Extension Swap Practice</p>
                            <h3>Use the same pattern in new situations</h3>
                            <div className="swap-grid">
                              {(activeSentence.replacementDrills.length ? activeSentence.replacementDrills : activeSentence.extensionExamples).slice(0, 10).map((prompt, index) => (
                                <label className="swap-card" key={`${activeSentence.id}-${index}`}>
                                  <span>{index + 1}. {prompt}</span>
                                  <input
                                    value={swapDrafts[`${activeSentence.id}-${index}`] || ''}
                                    onChange={(e) => updateSwapDraft(activeSentence.id, index, e.target.value)}
                                    placeholder="Type your replacement sentence..."
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="sentence-nav">
                          <button
                            className="ghost-button"
                            onClick={previousTrainingStep}
                            disabled={activeSentenceIndex === 0 && sentenceStep === 1}
                          >
                            Previous
                          </button>
                          <button
                            className="save-button"
                            onClick={nextTrainingStep}
                          >
                            {sentenceStep < 3 ? 'Next Step' : activeSentenceIndex < safePack.sentences.length - 1 ? 'Next Sentence' : 'Final Output'}
                          </button>
                        </div>
                      </>
                    )}

                    {videoStudyView === 'test' && sentenceStep === 5 && (
                      <div className="final-review-panel">
                        <p className="eyebrow">Step 5 · Full Video Output</p>
                        <h3>Describe what this video is mainly about</h3>
                        <p>{safePack.finalTask.prompt}</p>
                        {safePack.finalTask.checklist.length > 0 && (
                          <div className="pill-row">
                            {safePack.finalTask.checklist.map((item) => <span className="pill" key={item}>{item}</span>)}
                          </div>
                        )}
                        {safePack.recommendedAssets.length > 0 && (
                          <div className="structure-section test-card">
                            <p className="eyebrow">Worth Saving</p>
                            <h3>Save the best reusable language from this pack</h3>
                            <div className="suggested-save-grid">
                              {safePack.recommendedAssets.slice(0, 6).map((asset, index) => {
                                const key = `final-${toText(asset.text || asset.assetText)}-${index}`;
                                return (
                                  <div className="live-asset-card" key={key}>
                                    <span className="asset-type">{toText(asset.type) || 'Asset'}</span>
                                    <h3>{toText(asset.text)}</h3>
                                    <p>{toText(asset.functionName) || toText(asset.expressionFunction)}</p>
                                    <button
                                      className="ghost-button small"
                                      onClick={() => savePackAsset(asset, null)}
                                      disabled={savedAssetKeys.includes(`pack-${toText(asset.text || asset.assetText)}`)}
                                    >
                                      <Save size={15} />
                                      {savedAssetKeys.includes(`pack-${toText(asset.text || asset.assetText)}`) ? 'Saved' : 'Save to Assets'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <textarea
                          value={finalSummary}
                          onChange={(e) => setFinalSummary(e.target.value)}
                          placeholder="Write your English summary or retelling here..."
                        />
                        <button className="save-button" onClick={reviewFinalSummary} disabled={reviewLoading}>
                          <Sparkles size={17} />
                          {reviewLoading ? 'Scoring...' : 'Score and Optimize'}
                        </button>

                        {review && (
                          <div className="review-result">
                            <strong>Score: {review.score}/100</strong>
                            <p>{review.understanding}</p>
                            <h4>Optimized English</h4>
                            <p>{review.optimizedEnglish}</p>
                            {Array.isArray(review.mainProblems) && review.mainProblems.length > 0 && (
                              <ul>
                                {review.mainProblems.map((item) => <li key={item}>{item}</li>)}
                              </ul>
                            )}
                            <div className="suggested-save-grid">
                              {(review.assets || []).map((asset, index) => (
                                <div className="live-asset-card" key={`${toText(asset.text)}-${index}`}>
                                  <span className="asset-type">{toText(asset.type)}</span>
                                  <h3>{toText(asset.text)}</h3>
                                  <p>{toText(asset.functionName)}</p>
                                  <button className="ghost-button small" onClick={() => savePackAsset(asset, activeSentence)}>
                                    <Save size={15} />
                                    Save to Assets
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        ) : (
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
        )}
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





