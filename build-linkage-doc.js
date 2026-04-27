#!/usr/bin/env node
/*
 * Combined Linkage Map + Dashboard for GHL "Live Location Assets" JSON dumps.
 *
 * Walks the export, indexes every asset by ID, extracts cross-references from:
 *   1. Hard foreign keys (pipeline_id, workflowId, parentId, …)
 *   2. Workflow action deep walk (add_contact_tag, create_opportunity, if_else, …)
 *   3. Token scan of text/HTML for {{contact.X}} / {{custom_values.X}} merge tags
 *   4. Form field "tag" values matching a custom_field ID
 *   5. Trigger condition / branch references
 *   6. Generic ID fallback sweep — any string attribute that equals a known node id
 *
 * Produces a single self-contained HTML report with a list + detail layout:
 *   • Sidebar: searchable, type-grouped asset list with attention chips
 *   • Detail : welcome view (hero stats + cleanup callouts + hot spots)
 *              OR selected-asset view (metadata + 1-hop neighborhood graph
 *              + grouped edges).
 *   • Modal  : full force-directed network graph, opened on demand.
 *
 * Usage: node build-linkage-doc.js <input.json> [output.html]
 */

const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2];
const OUTPUT = process.argv[3] || (INPUT ? INPUT.replace(/\.json$/i, '_Linkages.html') : '');

if (!INPUT || !fs.existsSync(INPUT)) {
  console.error('Usage: node build-linkage-doc.js <input.json> [output.html]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

/* ------------------------------------------------------------------ */
/* 1. INDEX — every asset becomes a node                               */
/* ------------------------------------------------------------------ */

/** Map<id, {id, type, name, collection, extra}> */
const nodes = new Map();
/** Map<type, id[]> */
const byType = new Map();
/** lowercase tag name -> id */
const tagByName = new Map();
/** lowercase "contact.field_key" -> custom_field id */
const cfByKey = new Map();
/** lowercase "custom_values.field_key" -> custom_value id */
const cvByKey = new Map();

function addNode(collection, type, id, name, extra) {
  if (id === undefined || id === null || id === '') return null;
  const key = String(id);
  if (!nodes.has(key)) {
    nodes.set(key, { id: key, type, collection, name: name || key, extra: extra || {} });
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(key);
  }
  return key;
}

(data.custom_fields || []).forEach((f) => {
  const id = addNode('custom_fields', 'custom_field', f.id || f._id, f.name, {
    fieldKey: f.fullEnrichmentData && f.fullEnrichmentData.fieldKey,
    dataType: f.dataType,
    model: f.model,
    folderName: f.folderName,
    parentId: f.parentId,
  });
  const fk = f.fullEnrichmentData && f.fullEnrichmentData.fieldKey;
  if (id && fk) cfByKey.set(String(fk).toLowerCase(), id);
});

(data.custom_values || []).forEach((v) => {
  const id = addNode('custom_values', 'custom_value', v.id, v.name, {
    fieldKey: v.fieldKey,
    value: typeof v.value === 'string' ? v.value.slice(0, 120) : v.value,
  });
  const raw = String(v.fieldKey || '');
  const m = raw.match(/custom_values\.([a-zA-Z0-9_]+)/);
  if (id && m) cvByKey.set(`custom_values.${m[1].toLowerCase()}`, id);
});

(data.tags || []).forEach((t) => {
  const id = addNode('tags', 'tag', t.id, t.name, {
    contacts: t.contactCount || t.contacts,
    opportunities: t.opportunityCount || t.opportunities,
  });
  if (id && t.name) tagByName.set(String(t.name).toLowerCase().trim(), id);
});

(data.pipelines || []).forEach((p) => {
  addNode('pipelines', 'pipeline', p.id, p.name, { stageCount: p.stageCount });
});
(data.pipeline_stages || []).forEach((s) => {
  addNode('pipeline_stages', 'pipeline_stage', s.stageId, s.stageName, {
    pipelineId: s.pipelineId,
    pipelineName: s.pipelineName,
    position: s.stagePosition,
  });
});

(data.calendars || []).forEach((c) => {
  addNode('calendars', 'calendar', c.id, c.name, {
    calendarType: c.calendarType,
    isActive: c.isActive,
    slug: c.widgetSlug,
    groupId: c.groupId,
    formId: c.formId,
  });
});
(data.calendar_groups || []).forEach((g) => {
  addNode('calendar_groups', 'calendar_group', g.id, g.name, { slug: g.slug });
});

(data.forms || []).forEach((f) => {
  addNode('forms', 'form', f._id || f.id, f.name, { totalFields: f.totalFields });
});
(data.surveys || []).forEach((s) => {
  addNode('surveys', 'survey', s._id || s.id, s.name, {});
});

(data.workflow || []).forEach((w) => {
  addNode('workflow', 'workflow', w.id, w.name, {
    status: w.status,
    totalSteps: w.totalSteps,
    emailCount: w.emailCount,
    smsCount: w.smsCount,
  });
});
(data.workflow_triggers || []).forEach((t) => {
  addNode('workflow_triggers', 'workflow_trigger', t.id, t.name, {
    workflowId: t.workflowId,
    workflowName: t.workflowName,
    triggerType: t.type,
    active: t.active,
  });
});

(data.email_templates || []).forEach((e) => {
  addNode('email_templates', 'email_template', e.id, e.name, { templateType: e.templateType });
});

const funnelsRoot = data.funnels || {};
(funnelsRoot.funnels || []).forEach((f) => {
  addNode('funnels', 'funnel', f._id || f.id, f.name, {});
});
(funnelsRoot.pages || []).forEach((p) => {
  addNode('funnels', 'funnel_page', p._id || p.id, p.name || p.pageName, {
    funnelId: p.funnelId || p.parentId,
  });
});
(funnelsRoot.steps || []).forEach((s) => {
  addNode('funnels', 'funnel_step', s._id || s.id, s.name, {
    funnelId: s.funnelId || s.parentId,
  });
});

(data.folders || []).forEach((f) => {
  addNode('folders', 'folder', f._id || f.id, f.name, { parentId: f.parentId, altType: f.altType });
});
(data.media || []).forEach((m) => {
  addNode('media', 'media', m._id || m.id, m.name, {
    type: m.type,
    contentType: m.contentType,
    parentId: m.parentId,
  });
});

(data.knowledge_bases || []).forEach((kb) => {
  addNode('knowledge_bases', 'knowledge_base', kb.id, kb.name, {
    totalFiles: kb.totalFiles,
    totalFaqs: kb.totalFaqs,
  });
});

(data.ai_employees || []).forEach((a) => {
  addNode('ai_employees', 'ai_employee', a.id, a.name, {
    mode: a.mode,
    botType: a.botType,
    channels: a.channels,
  });
});
(data.voice_ai_agents || []).forEach((a) => {
  addNode('voice_ai_agents', 'voice_ai_agent', a._id || a.id, a.agentName, {
    status: a.agentStatus,
    calendarId: a.appointmentCalendarId,
  });
});
(data.conversation_ai || []).forEach((c) => {
  addNode('conversation_ai', 'conversation_ai', c.id, c.name, { botType: c.botType });
});

(data.snippets || []).forEach((s) => {
  addNode('snippets', 'snippet', s.id, s.name, { type: s.type });
});
(data.objects || []).forEach((o) => {
  addNode(
    'objects',
    'object',
    o.id,
    (o.labels && (o.labels.singular || o.labels.plural)) || o.key,
    { key: o.key, type: o.type },
  );
});
(data.links || []).forEach((l) => {
  addNode('links', 'link', l._id || l.id, l.name, {
    shortUrl: l.shortUrl,
    redirectTo: l.redirectTo,
  });
});

/* ------------------------------------------------------------------ */
/* 2. EDGES — programmatic link extraction                             */
/* ------------------------------------------------------------------ */

/** {source, target, label, category, context} */
const edges = [];
const seen = new Set();
function edge(source, target, label, category, context) {
  if (!source || !target) return;
  const s = String(source);
  const t = String(target);
  if (s === t) return;
  if (!nodes.has(s) || !nodes.has(t)) return;
  const k = `${s}|${t}|${label}`;
  if (seen.has(k)) return;
  seen.add(k);
  edges.push({ source: s, target: t, label, category, context: context || null });
}

/* --- 2a. Hard foreign keys --------------------------------------- */

(data.pipeline_stages || []).forEach((s) => {
  edge(s.stageId, s.pipelineId, 'belongs to pipeline', 'fk');
});

(data.workflow_triggers || []).forEach((t) => {
  if (t.workflowId) edge(t.id, t.workflowId, 'fires workflow', 'fk');
  const actions = (t.fullEnrichmentData && t.fullEnrichmentData.actions) || [];
  actions.forEach((act) => {
    if (act.workflow_id) edge(t.id, act.workflow_id, `action: ${act.type || 'add_to_workflow'}`, 'fk');
  });
});

function asIdList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') return v.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

(data.ai_employees || []).forEach((a) => {
  asIdList(a.knowledgeBaseIds).forEach((kbId) => edge(a.id, kbId, 'uses knowledge base', 'fk'));
  if (a.goalActionId && nodes.has(a.goalActionId)) {
    edge(a.id, a.goalActionId, 'goal action', 'fk');
  }
  asIdList(a.actionIds).forEach((aid) => {
    if (nodes.has(aid)) edge(a.id, aid, 'configured action', 'fk');
  });
});

(data.voice_ai_agents || []).forEach((a) => {
  const id = a._id || a.id;
  if (a.appointmentCalendarId) edge(id, a.appointmentCalendarId, 'books appointments on', 'fk');
  asIdList(a.callEndWorkflowIds).forEach((wId) => edge(id, wId, 'call-end workflow', 'fk'));
});

(data.calendars || []).forEach((c) => {
  if (c.groupId) edge(c.id, c.groupId, 'in calendar group', 'fk');
  if (c.formId) edge(c.id, c.formId, 'uses form', 'fk');
});

(data.custom_fields || []).forEach((f) => {
  if (f.parentId) edge(f.id || f._id, f.parentId, 'in custom-field folder', 'fk');
});

(data.folders || []).forEach((f) => {
  if (f.parentId) edge(f._id || f.id, f.parentId, 'in parent folder', 'fk');
});
(data.media || []).forEach((m) => {
  if (m.parentId) edge(m._id || m.id, m.parentId, 'in folder', 'fk');
});

(funnelsRoot.pages || []).forEach((p) => {
  const pid = p.funnelId || p.parentId;
  if (pid) edge(p._id || p.id, pid, 'belongs to funnel', 'fk');
});
(funnelsRoot.steps || []).forEach((s) => {
  const pid = s.funnelId || s.parentId;
  if (pid) edge(s._id || s.id, pid, 'belongs to funnel', 'fk');
});

/* --- 2b. Workflow template deep walk ----------------------------- */

function walkStrings(obj, visit) {
  if (obj == null) return;
  if (typeof obj === 'string') return visit(obj);
  if (Array.isArray(obj)) return obj.forEach((v) => walkStrings(v, visit));
  if (typeof obj === 'object') return Object.values(obj).forEach((v) => walkStrings(v, visit));
}

function scanTokensForCustomRefs(workflowId, text, stepCtx) {
  if (!text || typeof text !== 'string') return;
  const tokRe = /\{\{\s*(contact|custom_values)\.([a-zA-Z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = tokRe.exec(text)) !== null) {
    const ns = m[1].toLowerCase();
    const keyLower = m[2].toLowerCase();
    if (ns === 'custom_values') {
      const cvId = cvByKey.get(`custom_values.${keyLower}`);
      if (cvId) edge(workflowId, cvId, `references custom value in "${stepCtx.stepName}"`, 'token', stepCtx);
    } else {
      const cfId = cfByKey.get(`contact.${keyLower}`);
      if (cfId) edge(workflowId, cfId, `references custom field in "${stepCtx.stepName}"`, 'token', stepCtx);
      const raw = m[2];
      if (nodes.has(raw)) {
        const n = nodes.get(raw);
        if (n.type === 'custom_field') {
          edge(workflowId, raw, `references custom field in "${stepCtx.stepName}"`, 'token', stepCtx);
        }
      }
    }
  }
}

function scanWorkflowStep(workflowId, step) {
  const stepName = step.name || step.type || 'step';
  const stepCtx = { stepId: step.id, stepName, stepType: step.type };
  const attrs = step.attributes || {};

  switch (step.type) {
    case 'add_contact_tag':
    case 'remove_contact_tag': {
      (attrs.tags || []).forEach((name) => {
        const tagId = tagByName.get(String(name).toLowerCase().trim());
        if (tagId) {
          const label =
            step.type === 'add_contact_tag'
              ? `adds tag in "${stepName}"`
              : `removes tag in "${stepName}"`;
          edge(workflowId, tagId, label, 'action', stepCtx);
        }
      });
      break;
    }
    case 'create_opportunity':
    case 'internal_create_opportunity': {
      if (attrs.pipeline_id) edge(workflowId, attrs.pipeline_id, `creates opportunity in pipeline`, 'action', stepCtx);
      if (attrs.pipeline_stage_id) edge(workflowId, attrs.pipeline_stage_id, `creates opportunity at stage`, 'action', stepCtx);
      break;
    }
    case 'internal_update_opportunity': {
      if (attrs.pipeline_id) edge(workflowId, attrs.pipeline_id, `updates opportunity pipeline`, 'action', stepCtx);
      if (attrs.pipeline_stage_id) edge(workflowId, attrs.pipeline_stage_id, `moves to stage`, 'action', stepCtx);
      break;
    }
    case 'remove_opportunity': {
      if (attrs.pipeline_id) edge(workflowId, attrs.pipeline_id, `removes opportunity from pipeline`, 'action', stepCtx);
      break;
    }
    case 'update_contact_field': {
      (attrs.fields || []).forEach((f) => {
        if (f.field) edge(workflowId, f.field, `updates custom field "${f.title || ''}"`, 'action', stepCtx);
      });
      break;
    }
    case 'add_to_workflow': {
      if (attrs.workflow_id) edge(workflowId, attrs.workflow_id, `add_to_workflow in "${stepName}"`, 'action', stepCtx);
      break;
    }
    case 'remove_from_workflow': {
      if (attrs.workflow_id) edge(workflowId, attrs.workflow_id, `remove_from_workflow in "${stepName}"`, 'action', stepCtx);
      break;
    }
    case 'if_else': {
      (attrs.branches || []).forEach((br) => {
        (br.segments || []).forEach((seg) => {
          (seg.conditions || []).forEach((c) => {
            if (c.conditionSubType === 'tags' && Array.isArray(c.conditionValue)) {
              c.conditionValue.forEach((name) => {
                const tagId = tagByName.get(String(name).toLowerCase().trim());
                if (tagId) edge(workflowId, tagId, `if/else branch "${br.name}" matches tag`, 'condition', stepCtx);
              });
            }
            const fld = c.field || c.customFieldId || c.fieldId;
            if (fld && nodes.has(fld) && nodes.get(fld).type === 'custom_field') {
              edge(workflowId, fld, `if/else branch "${br.name}" checks custom field`, 'condition', stepCtx);
            }
          });
        });
      });
      break;
    }
  }

  walkStrings(attrs, (s) => scanTokensForCustomRefs(workflowId, s, stepCtx));

  walkStrings(attrs, (s) => {
    if (typeof s !== 'string') return;
    if (s.length < 12 || s.length > 48) return;
    if (!/^[A-Za-z0-9_-]+$/.test(s)) return;
    if (!nodes.has(s)) return;
    if (s === workflowId) return;
    const target = nodes.get(s);
    if (target.type === 'tag' || target.type === 'custom_field' || target.type === 'custom_value') return;
    edge(workflowId, s, `${target.type} referenced in "${stepName}"`, 'action', stepCtx);
  });
}

(data.workflow || []).forEach((w) => {
  const templates =
    (w.fullEnrichmentData && w.fullEnrichmentData.workflowData && w.fullEnrichmentData.workflowData.templates) || [];
  templates.forEach((step) => scanWorkflowStep(w.id, step));
});

/* --- 2c. Workflow trigger condition scan ------------------------- */

(data.workflow_triggers || []).forEach((t) => {
  const conds = (t.fullEnrichmentData && (t.fullEnrichmentData.filters || t.fullEnrichmentData.conditions)) || [];
  const stepCtx = { stepId: t.id, stepName: t.name, stepType: 'trigger' };
  walkStrings(conds, (str) => {
    const re = /(?:^|[^a-zA-Z0-9_])(contact|custom_values)\.([a-zA-Z0-9_]+)/g;
    let m;
    while ((m = re.exec(str)) !== null) {
      const ns = m[1].toLowerCase();
      const key = m[2];
      if (ns === 'custom_values') {
        const cvId = cvByKey.get(`custom_values.${key.toLowerCase()}`);
        if (cvId) edge(t.id, cvId, `trigger references custom value`, 'condition', stepCtx);
      } else {
        const cfId = cfByKey.get(`contact.${key.toLowerCase()}`);
        if (cfId) edge(t.id, cfId, `trigger references custom field`, 'condition', stepCtx);
        if (nodes.has(key) && nodes.get(key).type === 'custom_field') {
          edge(t.id, key, `trigger references custom field`, 'condition', stepCtx);
        }
      }
    }
  });
  walkStrings(conds, (str) => {
    const v = String(str).toLowerCase().trim();
    if (tagByName.has(v)) {
      edge(t.id, tagByName.get(v), `trigger condition on tag`, 'condition', stepCtx);
    }
  });
});

/* --- 2d. Form field tag ID = custom field ------------------------ */

(data.forms || []).forEach((f) => {
  const fields =
    (f.fullEnrichmentData && f.fullEnrichmentData.formData && f.fullEnrichmentData.formData.form && f.fullEnrichmentData.formData.form.fields) || [];
  fields.forEach((fld) => {
    const tag = fld && fld.tag;
    if (tag && nodes.has(tag) && nodes.get(tag).type === 'custom_field') {
      const labelPreview =
        typeof fld.label === 'string'
          ? fld.label.replace(/<[^>]+>/g, '').slice(0, 60)
          : '';
      edge(f._id || f.id, tag, `collects custom field${labelPreview ? ' ("' + labelPreview + '")' : ''}`, 'form_field');
    }
  });
});

/* --- 2e. Survey page/field scan ---------------------------------- */

(data.surveys || []).forEach((s) => {
  const id = s._id || s.id;
  const root = s.fullEnrichmentData || s;
  walkStrings(root, (str) => {
    scanTokensForCustomRefs(id, str, { stepId: id, stepName: s.name || 'survey', stepType: 'survey' });
  });
});

/* --- 2f. Email template token scan ------------------------------- */

(data.email_templates || []).forEach((e) => {
  walkStrings(e, (str) => {
    scanTokensForCustomRefs(e.id, str, { stepId: e.id, stepName: e.name || 'email_template', stepType: 'email_template' });
  });
});

/* ------------------------------------------------------------------ */
/* 3. Reverse indexes + stats                                          */
/* ------------------------------------------------------------------ */

const outbound = new Map();
const inbound = new Map();
edges.forEach((e) => {
  if (!outbound.has(e.source)) outbound.set(e.source, []);
  outbound.get(e.source).push(e);
  if (!inbound.has(e.target)) inbound.set(e.target, []);
  inbound.get(e.target).push(e);
});

const stats = {
  totalNodes: nodes.size,
  totalEdges: edges.length,
  edgesByCategory: {},
  nodesByType: {},
  orphanCount: 0,
};
edges.forEach((e) => {
  stats.edgesByCategory[e.category] = (stats.edgesByCategory[e.category] || 0) + 1;
});
byType.forEach((ids, type) => {
  stats.nodesByType[type] = ids.length;
});
const orphanIds = [];
nodes.forEach((n, id) => {
  if (!outbound.has(id) && !inbound.has(id)) {
    stats.orphanCount++;
    orphanIds.push(id);
  }
});

/* ------------------------------------------------------------------ */
/* 4. Collection ordering & labels                                     */
/* ------------------------------------------------------------------ */

const TYPE_META = {
  workflow: { label: 'Workflows', emoji: '⚙️', order: 1, color: '#8B5CF6' },
  workflow_trigger: { label: 'Workflow Triggers', emoji: '🎯', order: 2, color: '#A855F7' },
  tag: { label: 'Tags', emoji: '🏷️', order: 3, color: '#EC4899' },
  custom_field: { label: 'Custom Fields', emoji: '🧩', order: 4, color: '#10B981' },
  custom_value: { label: 'Custom Values', emoji: '🔤', order: 5, color: '#14B8A6' },
  pipeline: { label: 'Pipelines', emoji: '🪣', order: 6, color: '#F59E0B' },
  pipeline_stage: { label: 'Pipeline Stages', emoji: '📍', order: 7, color: '#FBBF24' },
  calendar: { label: 'Calendars', emoji: '📅', order: 8, color: '#3B82F6' },
  calendar_group: { label: 'Calendar Groups', emoji: '🗂️', order: 9, color: '#60A5FA' },
  form: { label: 'Forms', emoji: '📝', order: 10, color: '#0D9488' },
  survey: { label: 'Surveys', emoji: '📊', order: 11, color: '#0EA5E9' },
  email_template: { label: 'Email Templates', emoji: '✉️', order: 12, color: '#F97316' },
  funnel: { label: 'Funnels', emoji: '🚀', order: 13, color: '#EF4444' },
  funnel_page: { label: 'Funnel Pages', emoji: '📄', order: 14, color: '#F87171' },
  funnel_step: { label: 'Funnel Steps', emoji: '➡️', order: 15, color: '#FCA5A5' },
  folder: { label: 'Folders', emoji: '📁', order: 16, color: '#9CA3AF' },
  media: { label: 'Media', emoji: '🖼️', order: 17, color: '#6366F1' },
  knowledge_base: { label: 'Knowledge Bases', emoji: '📚', order: 18, color: '#8B5CF6' },
  ai_employee: { label: 'AI Employees', emoji: '🤖', order: 19, color: '#D946EF' },
  voice_ai_agent: { label: 'Voice AI Agents', emoji: '🎙️', order: 20, color: '#C026D3' },
  conversation_ai: { label: 'Conversation AI', emoji: '💬', order: 21, color: '#A21CAF' },
  snippet: { label: 'Snippets', emoji: '📎', order: 22, color: '#84CC16' },
  object: { label: 'Custom Objects', emoji: '📦', order: 23, color: '#65A30D' },
  link: { label: 'Short Links', emoji: '🔗', order: 24, color: '#06B6D4' },
};

function typeMeta(t) {
  return TYPE_META[t] || { label: t, emoji: '•', order: 99, color: '#94A3B8' };
}

const typesPresent = Array.from(byType.keys()).sort(
  (a, b) => typeMeta(a).order - typeMeta(b).order,
);

/* ------------------------------------------------------------------ */
/* 5. Analytics                                                         */
/* ------------------------------------------------------------------ */

const nodeDegree = new Map();
nodes.forEach((n, id) => {
  nodeDegree.set(id, (outbound.get(id) || []).length + (inbound.get(id) || []).length);
});
const topNodes = Array.from(nodes.values())
  .map((n) => ({ n, degree: nodeDegree.get(n.id) || 0 }))
  .filter((x) => x.degree > 0)
  .sort((a, b) => b.degree - a.degree)
  .slice(0, 20);

function unreferenced(type) {
  return (byType.get(type) || [])
    .filter((id) => !inbound.has(id))
    .map((id) => nodes.get(id));
}
const deadTags = unreferenced('tag');
const deadCustomFields = unreferenced('custom_field');
const deadEmailTemplates = unreferenced('email_template');

/* ------------------------------------------------------------------ */
/* 6. Force-directed layout (server-side, used by the modal)           */
/* ------------------------------------------------------------------ */

function computeLayout(nodeList, edgeList) {
  const n = nodeList.length;
  if (n === 0) return { width: 1600, height: 1100, positions: {} };
  const W = 1600;
  const H = 1100;
  const CX = W / 2;
  const CY = H / 2;
  const area = W * H;
  const k = Math.sqrt(area / Math.max(1, n));
  const positions = new Map();

  const typeIdx = new Map();
  typesPresent.forEach((t, i) => typeIdx.set(t, i));
  const typeCount = typesPresent.length;

  nodeList.forEach((nd, i) => {
    const ti = typeIdx.get(nd.type) || 0;
    const perType = (byType.get(nd.type) || []).length;
    const angleBase = (ti / Math.max(1, typeCount)) * Math.PI * 2;
    const radius = 180 + ((ti % 3) * 60) + (perType > 30 ? 120 : 0);
    const jitter = (Math.sin(i * 13.37) * 0.5 + 0.5) * 80;
    const subAngle = angleBase + ((i % 40) - 20) * 0.06;
    positions.set(nd.id, {
      x: CX + Math.cos(subAngle) * (radius + jitter),
      y: CY + Math.sin(subAngle) * (radius + jitter),
    });
  });

  nodeList.forEach((nd, i) => {
    if (!outbound.has(nd.id) && !inbound.has(nd.id)) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      positions.set(nd.id, { x: CX + Math.cos(a) * 700, y: CY + Math.sin(a) * 480 });
    }
  });

  const connected = nodeList.filter((nd) => outbound.has(nd.id) || inbound.has(nd.id));
  const connectedIds = new Set(connected.map((nd) => nd.id));
  const relevantEdges = edgeList.filter(
    (e) => connectedIds.has(e.source) && connectedIds.has(e.target),
  );

  const iterations = connected.length > 400 ? 80 : 140;
  let temp = Math.min(W, H) / 8;
  const cooling = Math.pow(0.02, 1 / iterations);
  const minD = 4;

  const pos = new Map();
  connected.forEach((nd) => pos.set(nd.id, { ...positions.get(nd.id) }));
  const disp = new Map();

  for (let iter = 0; iter < iterations; iter++) {
    connected.forEach((nd) => disp.set(nd.id, { x: 0, y: 0 }));
    for (let a = 0; a < connected.length; a++) {
      const pa = pos.get(connected[a].id);
      const da = disp.get(connected[a].id);
      for (let b = a + 1; b < connected.length; b++) {
        const pb = pos.get(connected[b].id);
        const db = disp.get(connected[b].id);
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) d = minD;
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        da.x += ux * f;
        da.y += uy * f;
        db.x -= ux * f;
        db.y -= uy * f;
      }
    }
    relevantEdges.forEach((e) => {
      const ps = pos.get(e.source);
      const pt = pos.get(e.target);
      if (!ps || !pt) return;
      const dx = ps.x - pt.x;
      const dy = ps.y - pt.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) d = minD;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp.get(e.source).x -= ux * f;
      disp.get(e.source).y -= uy * f;
      disp.get(e.target).x += ux * f;
      disp.get(e.target).y += uy * f;
    });
    connected.forEach((nd) => {
      const p = pos.get(nd.id);
      const d = disp.get(nd.id);
      d.x += (CX - p.x) * 0.005;
      d.y += (CY - p.y) * 0.005;
    });
    connected.forEach((nd) => {
      const p = pos.get(nd.id);
      const d = disp.get(nd.id);
      const m = Math.sqrt(d.x * d.x + d.y * d.y);
      if (m < 0.001) return;
      const lim = Math.min(m, temp);
      p.x += (d.x / m) * lim;
      p.y += (d.y / m) * lim;
      p.x = Math.max(40, Math.min(W - 40, p.x));
      p.y = Math.max(40, Math.min(H - 40, p.y));
    });
    temp *= cooling;
  }

  connected.forEach((nd) => positions.set(nd.id, pos.get(nd.id)));
  return {
    width: W,
    height: H,
    positions: Object.fromEntries(positions),
  };
}

const layout = computeLayout(Array.from(nodes.values()), edges);

/* ------------------------------------------------------------------ */
/* 7. HTML rendering — list + detail layout                             */
/* ------------------------------------------------------------------ */

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function num(n) {
  return Number(n || 0).toLocaleString();
}

// Build the compact data payload that the client JS consumes. Edges are
// flattened per-node (outbound + inbound) so the detail/mini-graph render
// is O(1) without scanning the full edge list.
const compactNodes = {};
nodes.forEach((n, id) => {
  const e = (outbound.get(id) || []).map((x) => [x.target, x.label, x.category]);
  const i = (inbound.get(id) || []).map((x) => [x.source, x.label, x.category]);
  const xObj = {};
  for (const k of Object.keys(n.extra || {})) {
    const v = n.extra[k];
    if (v !== undefined && v !== null && v !== '') xObj[k] = v;
  }
  const hasX = Object.keys(xObj).length > 0;
  compactNodes[id] = {
    n: n.name,
    t: n.type,
    x: hasX ? xObj : 0,
    e: e.length ? e : 0,
    i: i.length ? i : 0,
  };
});
const compactTypes = {};
typesPresent.forEach((t) => {
  const m = typeMeta(t);
  compactTypes[t] = { l: m.label, c: m.color, e: m.emoji };
});
const compactGroups = {};
typesPresent.forEach((t) => {
  compactGroups[t] = (byType.get(t) || []).slice().sort((a, b) => {
    const an = (nodes.get(a).name || '').toLowerCase();
    const bn = (nodes.get(b).name || '').toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
});

const exportMeta = data._exportMetadata || {};
const inlineData = {
  meta: {
    locationId: exportMeta.locationId || '',
    exportDate: exportMeta.exportDate || '',
    totalNodes: nodes.size,
    totalEdges: edges.length,
    orphanCount: stats.orphanCount,
    connectedCount: nodes.size - stats.orphanCount,
  },
  types: compactTypes,
  nodes: compactNodes,
  groups: compactGroups,
  attention: {
    orphans: orphanIds,
    deadTags: deadTags.map((n) => n.id),
    deadFields: deadCustomFields.map((n) => n.id),
    deadEmails: deadEmailTemplates.map((n) => n.id),
    hot: topNodes.slice(0, 10).map((x) => ({ id: x.n.id, d: x.degree })),
  },
  layoutW: layout.width,
  layoutH: layout.height,
  layout: layout.positions,
};

const safePayload = JSON.stringify(inlineData)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Asset Linkage · ${esc(exportMeta.locationId || 'Location')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --border: #e5e7eb;
  --border-strong: #d1d5db;
  --text: #0f172a;
  --text-2: #334155;
  --muted: #64748b;
  --muted-2: #94a3b8;
  --accent: #8B5CF6;
  --accent-hover: #7c3aed;
  --accent-soft: #f5f3ff;
  --warn: #f59e0b;
  --warn-soft: #fffbeb;
  --danger: #ef4444;
  --danger-soft: #fef2f2;
  --success: #10b981;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  font-size: 14px; line-height: 1.5; color: var(--text); background: var(--bg);
  -webkit-font-smoothing: antialiased;
  height: 100vh; overflow: hidden;
}
button { font-family: inherit; cursor: pointer; }
a { color: var(--accent-hover); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ---------- App shell ---------- */
.app {
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: 56px 1fr;
  height: 100vh; overflow: hidden;
}
.topbar {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 16px;
  padding: 0 20px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.topbar .brand { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.topbar .logo { font-size: 18px; }
.topbar .title { font-size: 14px; font-weight: 600; color: var(--text); }
.topbar .loc {
  font-family: var(--mono); font-size: 11.5px; color: var(--muted);
  padding: 2px 8px; background: var(--accent-soft); border-radius: 999px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px;
}
.topbar .search-wrap {
  flex: 1; position: relative; max-width: 540px;
}
.topbar #search {
  width: 100%; padding: 8px 36px 8px 36px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface); font-size: 13.5px; color: var(--text);
  font-family: inherit;
}
.topbar #search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,92,246,.15); }
.topbar .search-wrap::before {
  content: ""; position: absolute; left: 11px; top: 50%; width: 14px; height: 14px;
  transform: translateY(-50%);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path fill-rule='evenodd' d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z' clip-rule='evenodd'/></svg>");
  background-repeat: no-repeat;
}
.topbar kbd {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  padding: 1px 6px; font-family: var(--mono); font-size: 11px;
  border: 1px solid var(--border); border-radius: 4px; color: var(--muted); background: var(--surface);
}
.topbar #search.has-value + kbd { display: none; }
.btn {
  appearance: none; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-2); font-size: 12.5px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px; transition: all .12s;
}
.btn:hover { border-color: var(--accent); color: var(--accent-hover); background: var(--accent-soft); }

/* ---------- Sidebar ---------- */
.sidebar {
  border-right: 1px solid var(--border); background: var(--surface);
  overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column;
}
.sidebar .attention {
  padding: 10px 12px; border-bottom: 1px solid var(--border);
  display: flex; flex-wrap: wrap; gap: 6px;
}
.chip {
  appearance: none; border: 1px solid var(--border); background: var(--surface);
  padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 500;
  color: var(--muted); display: inline-flex; align-items: center; gap: 5px;
  cursor: pointer; transition: all .12s;
}
.chip:hover { border-color: var(--border-strong); color: var(--text-2); }
.chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.chip .ct { font-variant-numeric: tabular-nums; }
.chip.warn { background: var(--warn-soft); color: #92400e; border-color: #fcd34d; }
.chip.warn.active { background: var(--warn); color: #fff; border-color: var(--warn); }
.chip.danger { background: var(--danger-soft); color: #991b1b; border-color: #fecaca; }
.chip.danger.active { background: var(--danger); color: #fff; border-color: var(--danger); }

.sidebar .types { flex: 1; padding: 6px 0 12px; }
.type-group { border-bottom: 1px solid #f1f5f9; }
.type-group:last-child { border-bottom: none; }
.type-group > summary {
  list-style: none; cursor: pointer; padding: 9px 14px;
  display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 12.5px;
  color: var(--text-2); user-select: none;
}
.type-group > summary::-webkit-details-marker { display: none; }
.type-group > summary::before {
  content: "▸"; color: var(--muted-2); font-size: 9px; width: 10px;
  display: inline-block; transition: transform .12s;
}
.type-group[open] > summary::before { transform: rotate(90deg); }
.type-group > summary:hover { background: var(--surface-2); color: var(--text); }
.type-group .tg-emoji { font-size: 13px; }
.type-group .tg-label { flex: 1; }
.type-group .tg-count {
  font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums;
  background: var(--surface-2); border: 1px solid var(--border); padding: 0 6px; border-radius: 999px;
}
.type-group .tg-issue {
  font-size: 10.5px; color: var(--warn); padding: 0 6px; background: var(--warn-soft);
  border: 1px solid #fde68a; border-radius: 999px; margin-left: 4px; font-variant-numeric: tabular-nums;
}
.type-group ul.assets {
  list-style: none; margin: 0; padding: 2px 0 6px;
}
.type-group .asset-item {
  appearance: none; width: 100%; text-align: left;
  background: transparent; border: none; padding: 5px 14px 5px 32px;
  font-size: 12.5px; color: var(--text-2); border-radius: 0;
  display: flex; align-items: center; gap: 8px; min-width: 0;
  position: relative;
}
.type-group .asset-item:hover { background: var(--surface-2); color: var(--text); }
.type-group .asset-item.active { background: var(--accent-soft); color: var(--accent-hover); font-weight: 600; }
.type-group .asset-item .ai-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.type-group .asset-item .ai-deg {
  font-size: 10.5px; color: var(--muted-2); font-variant-numeric: tabular-nums;
}
.type-group .asset-item .ai-flag {
  width: 6px; height: 6px; border-radius: 50%; background: var(--warn); flex-shrink: 0;
}
.type-group .asset-item.hidden { display: none; }
.type-group.hidden { display: none; }
.no-results {
  padding: 24px 14px; text-align: center; color: var(--muted); font-size: 12.5px;
  display: none;
}
.no-results.show { display: block; }

/* ---------- Detail ---------- */
.detail { overflow-y: auto; padding: 0; background: var(--bg); }
.detail-inner { max-width: 920px; margin: 0 auto; padding: 32px 36px 56px; }

/* Welcome view */
.welcome h1 {
  font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 6px;
}
.welcome .subtitle { color: var(--muted); font-size: 13.5px; margin: 0 0 28px; }
.hero-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 32px;
}
.hero-stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px 20px;
}
.hero-stat .num {
  font-size: 28px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.hero-stat .lab { font-size: 12px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .04em; }
.hero-stat.danger .num { color: var(--danger); }

.section-h {
  font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase;
  letter-spacing: .06em; margin: 8px 0 12px;
}
.attention-cards {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px; margin-bottom: 28px;
}
.attention-card {
  appearance: none; text-align: left; background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all .12s;
  display: flex; align-items: center; gap: 12px;
}
.attention-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.attention-card .ac-icon { font-size: 22px; flex-shrink: 0; }
.attention-card .ac-num { font-size: 18px; font-weight: 700; color: var(--text); }
.attention-card .ac-lab { font-size: 12px; color: var(--muted-2); }
.attention-card.warn { border-color: #fde68a; background: var(--warn-soft); }
.attention-card.warn:hover { border-color: var(--warn); background: #fef3c7; }
.attention-card.warn .ac-num { color: #92400e; }
.attention-card.danger { border-color: #fecaca; background: var(--danger-soft); }
.attention-card.danger:hover { border-color: var(--danger); background: #fee2e2; }
.attention-card.danger .ac-num { color: var(--danger); }

.hot-list {
  list-style: none; margin: 0 0 28px; padding: 0;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  overflow: hidden;
}
.hot-list li { border-bottom: 1px solid var(--border); }
.hot-list li:last-child { border-bottom: none; }
.hot-list button {
  appearance: none; width: 100%; text-align: left; background: transparent; border: none;
  padding: 11px 16px; display: flex; align-items: center; gap: 12px; color: var(--text);
}
.hot-list button:hover { background: var(--surface-2); }
.hot-list .rank { font-variant-numeric: tabular-nums; color: var(--muted-2); font-size: 12px; min-width: 24px; }
.hot-list .h-emoji { font-size: 14px; }
.hot-list .h-name { flex: 1; font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hot-list .h-kind { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.hot-list .h-deg {
  font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--accent-hover);
  background: var(--accent-soft); padding: 2px 9px; border-radius: 999px; font-weight: 600;
}

.welcome-hint { color: var(--muted); font-size: 12.5px; text-align: center; padding: 12px 0; }

/* Asset detail view */
.asset-view { display: none; }
.asset-view.active { display: block; }
.welcome.hidden { display: none; }

.av-head {
  display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;
  padding-bottom: 14px; border-bottom: 1px solid var(--border);
}
.av-emoji {
  width: 40px; height: 40px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.av-titles { flex: 1; min-width: 0; }
.av-kind {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
  color: var(--muted); margin-bottom: 2px;
}
.av-name { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 6px; word-break: break-word; }
.av-id { font-family: var(--mono); font-size: 11.5px; color: var(--muted-2); }
.av-id code { background: var(--surface-2); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px; }
.av-actions { display: flex; gap: 6px; flex-shrink: 0; }

.av-degree {
  display: flex; gap: 14px; margin-bottom: 22px;
  font-size: 12.5px; color: var(--muted-2);
}
.av-degree b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.av-degree .deg-arr { color: var(--accent); font-weight: 700; margin-right: 4px; }

.av-meta {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 18px; margin-bottom: 22px;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 24px;
}
.av-meta .mp { font-size: 12.5px; }
.av-meta .mp .k {
  display: block; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em;
  font-weight: 600; margin-bottom: 2px;
}
.av-meta .mp .v { color: var(--text); word-break: break-word; }
.av-meta.empty { display: none; }

.av-section { margin-bottom: 22px; }
.av-section h3 {
  font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase;
  letter-spacing: .06em; margin: 0 0 10px;
  display: flex; align-items: center; gap: 8px;
}
.av-section h3 .count {
  background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2);
  font-size: 10.5px; padding: 1px 7px; border-radius: 999px; font-variant-numeric: tabular-nums;
}

.mini-graph {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 8px;
}
.mini-graph svg { width: 100%; display: block; }
.mini-empty { color: var(--muted); font-size: 12.5px; padding: 22px; text-align: center; }

.edge-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
}
.edge-list li {
  padding: 9px 14px; display: flex; align-items: center; gap: 10px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.edge-list li:last-child { border-bottom: none; }
.edge-list .eg-arr { color: var(--accent); font-weight: 700; flex-shrink: 0; }
.edge-list .eg-label { color: var(--text-2); font-size: 12.5px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edge-list .eg-target {
  appearance: none; background: transparent; border: none; padding: 0; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--accent-hover);
  font-weight: 500; max-width: 280px; min-width: 0;
}
.edge-list .eg-target:hover { text-decoration: underline; }
.edge-list .eg-target .eg-emoji { font-size: 12px; }
.edge-list .eg-target .eg-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edge-list .eg-target .eg-kind { color: var(--muted-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }

/* ---------- Modal: full network graph ---------- */
.modal {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.modal[hidden] { display: none; }
.modal-overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, .55); backdrop-filter: blur(2px); }
.modal-panel {
  position: relative; background: var(--surface); border-radius: 14px;
  width: 100%; max-width: 1280px; height: calc(100vh - 48px);
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 16px 48px rgba(15, 23, 42, .25);
}
.modal-head {
  display: flex; align-items: center; gap: 12px; padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); flex: 1; }
.modal-close {
  appearance: none; background: var(--surface-2); border: 1px solid var(--border);
  width: 30px; height: 30px; border-radius: 8px; font-size: 18px; color: var(--muted-2);
  display: inline-flex; align-items: center; justify-content: center;
}
.modal-close:hover { color: var(--danger); background: var(--danger-soft); border-color: var(--danger); }
.modal-body { flex: 1; min-height: 0; position: relative; background: #fafaf9;
  background-image: radial-gradient(circle, #e5e7eb 1px, transparent 1px);
  background-size: 24px 24px; cursor: grab;
}
.modal-body.dragging { cursor: grabbing; }
.modal-body svg { width: 100%; height: 100%; display: block; user-select: none; }
.modal-loader {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--accent-hover); font-weight: 600; background: rgba(255,255,255,.85);
}
.gedge { stroke: #cbd5e1; stroke-width: 0.8; stroke-opacity: 0.5; pointer-events: none; }
.gedge.fk { stroke: #10b981; }
.gedge.action { stroke: #f97316; }
.gedge.token { stroke: #3b82f6; }
.gedge.condition { stroke: #d946ef; }
.gedge.form_field { stroke: #14b8a6; }
.gedge.highlight { stroke-opacity: 1; stroke-width: 2; }
.gedge.dim { stroke-opacity: 0.05; }
.gnode { cursor: pointer; }
.gnode circle { transition: stroke-width .12s; }
.gnode.selected circle { stroke: #0f172a; stroke-width: 3; }
.gnode.highlight circle { stroke: var(--accent-hover); stroke-width: 3; }
.gnode.dim { opacity: 0.18; }

@media (max-width: 880px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 56px auto 1fr; }
  .sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: 40vh; }
  .topbar { flex-wrap: wrap; gap: 10px; padding: 10px 14px; height: auto; }
  .detail-inner { padding: 20px 16px 40px; }
}
</style>
</head>
<body>
<div class="app">
  <header class="topbar">
    <div class="brand">
      <span class="logo">🔗</span>
      <span class="title">Asset Linkage</span>
      ${exportMeta.locationId ? `<span class="loc" title="Location ID">${esc(exportMeta.locationId)}</span>` : ''}
    </div>
    <div class="search-wrap">
      <input id="search" type="search" placeholder="Search ${num(nodes.size)} assets…" autocomplete="off" autofocus>
      <kbd>/</kbd>
    </div>
    <button id="open-graph" class="btn" title="Open full network graph">📊 Graph</button>
  </header>

  <aside class="sidebar">
    <div class="attention" id="attention-chips"></div>
    <nav class="types" id="types"></nav>
    <div class="no-results" id="no-results">No assets match your search.</div>
  </aside>

  <main class="detail">
    <div class="detail-inner">
      <!-- Welcome view (default) -->
      <div class="welcome" id="welcome">
        <h1>${num(nodes.size)} assets · ${num(edges.length)} connections</h1>
        <p class="subtitle">${exportMeta.exportDate ? `Exported ${esc(new Date(exportMeta.exportDate).toLocaleString())}` : 'Linkage map'}</p>

        <div class="hero-stats">
          <div class="hero-stat">
            <div class="num">${num(nodes.size - stats.orphanCount)}</div>
            <div class="lab">Connected · ${Math.round(100 * (nodes.size - stats.orphanCount) / Math.max(1, nodes.size))}%</div>
          </div>
          <div class="hero-stat">
            <div class="num">${num(edges.length)}</div>
            <div class="lab">Cross-references</div>
          </div>
          <div class="hero-stat ${stats.orphanCount > 0 ? 'danger' : ''}">
            <div class="num">${num(stats.orphanCount)}</div>
            <div class="lab">Orphans</div>
          </div>
        </div>

        <h2 class="section-h">Needs attention</h2>
        <div class="attention-cards" id="attention-cards"></div>

        <h2 class="section-h">Most referenced assets</h2>
        <ol class="hot-list" id="hot-list"></ol>

        <p class="welcome-hint">Tip: press <kbd style="font-family:var(--mono);font-size:11px;border:1px solid var(--border);border-radius:4px;padding:1px 6px;background:var(--surface);color:var(--muted)">/</kbd> to focus search · click any chip or asset to drill in.</p>
      </div>

      <!-- Asset detail view (shown when an asset is selected) -->
      <article class="asset-view" id="asset-view" hidden>
        <header class="av-head">
          <span class="av-emoji" id="av-emoji">·</span>
          <div class="av-titles">
            <div class="av-kind" id="av-kind"></div>
            <h1 class="av-name" id="av-name"></h1>
            <div class="av-id">ID: <code id="av-id"></code></div>
          </div>
          <div class="av-actions">
            <button class="btn" id="av-graph">📊 In graph</button>
            <button class="btn" id="av-back">← Back</button>
          </div>
        </header>

        <div class="av-degree" id="av-degree"></div>
        <div class="av-meta" id="av-meta"></div>

        <section class="av-section" id="av-mini-section">
          <h3>1-hop neighborhood</h3>
          <div class="mini-graph" id="av-mini"></div>
        </section>

        <section class="av-section" id="av-uses-section" hidden>
          <h3>Uses <span class="count" id="av-uses-count"></span></h3>
          <ul class="edge-list" id="av-uses"></ul>
        </section>

        <section class="av-section" id="av-usedby-section" hidden>
          <h3>Used by <span class="count" id="av-usedby-count"></span></h3>
          <ul class="edge-list" id="av-usedby"></ul>
        </section>
      </article>
    </div>
  </main>
</div>

<!-- Modal: full force-directed graph -->
<div class="modal" id="modal" hidden>
  <div class="modal-overlay" id="modal-overlay"></div>
  <div class="modal-panel">
    <header class="modal-head">
      <h3>Full network · ${num(nodes.size)} nodes · ${num(edges.length)} connections</h3>
      <button class="modal-close" id="modal-close">×</button>
    </header>
    <div class="modal-body" id="modal-body">
      <div class="modal-loader" id="modal-loader" hidden>Rendering graph…</div>
    </div>
  </div>
</div>

<script>
window.LINK = ${safePayload};

(function () {
  var L = window.LINK;
  var T = L.types;
  var N = L.nodes;
  var G = L.groups;
  var A = L.attention;

  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function tm(t) { return T[t] || { l: t, c: '#94A3B8', e: '•' }; }
  function deg(id) { var nd = N[id]; if (!nd) return 0; return (nd.e ? nd.e.length : 0) + (nd.i ? nd.i.length : 0); }

  /* -------- Sidebar: type list + attention chips ----------- */
  var deadById = {};
  ['orphans','deadTags','deadFields','deadEmails'].forEach(function(k){ (A[k]||[]).forEach(function(id){ deadById[id] = true; }); });

  function buildSidebar() {
    // Attention chips (clickable filters)
    var chips = $('attention-chips');
    var defs = [
      { key: 'orphans',    label: 'Orphans',     count: A.orphans.length,   cls: 'danger' },
      { key: 'deadTags',   label: 'Dead tags',   count: A.deadTags.length,  cls: 'warn' },
      { key: 'deadFields', label: 'Dead fields', count: A.deadFields.length,cls: 'warn' },
      { key: 'deadEmails', label: 'Dead emails', count: A.deadEmails.length,cls: 'warn' },
    ].filter(function(d){ return d.count > 0; });
    if (defs.length === 0) {
      chips.innerHTML = '<span style="font-size:11.5px;color:var(--muted);padding:2px 4px">No cleanup needed — every asset is referenced.</span>';
    } else {
      chips.innerHTML = defs.map(function(d){
        return '<button class="chip ' + d.cls + '" data-attn="' + d.key + '">' + esc(d.label) + ' <span class="ct">' + fmt(d.count) + '</span></button>';
      }).join('');
    }

    // Type groups
    var typesEl = $('types');
    var html = '';
    Object.keys(G).forEach(function (t) {
      var meta = tm(t);
      var ids = G[t];
      var deadCount = ids.filter(function(id){ return deadById[id]; }).length;
      html += '<details class="type-group" data-type="' + esc(t) + '">';
      html += '<summary>';
      html += '<span class="tg-emoji">' + meta.e + '</span>';
      html += '<span class="tg-label">' + esc(meta.l) + '</span>';
      html += '<span class="tg-count">' + fmt(ids.length) + '</span>';
      if (deadCount > 0) html += '<span class="tg-issue" title="Unreferenced">' + fmt(deadCount) + '</span>';
      html += '</summary>';
      html += '<ul class="assets">';
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var nd = N[id];
        var d = deg(id);
        var isDead = !!deadById[id];
        html += '<li><button class="asset-item" data-id="' + esc(id) + '">';
        if (isDead) html += '<span class="ai-flag" title="Unreferenced"></span>';
        html += '<span class="ai-name">' + esc(nd.n) + '</span>';
        if (d > 0) html += '<span class="ai-deg">' + d + '</span>';
        html += '</button></li>';
      }
      html += '</ul></details>';
    });
    typesEl.innerHTML = html;
  }

  /* -------- Welcome view: attention cards + hot list -------- */
  function buildWelcome() {
    var ac = $('attention-cards');
    var cards = [];
    if (A.orphans.length)    cards.push({ icon: '🪦', num: A.orphans.length,    lab: 'orphan assets',    key: 'orphans',    cls: 'danger' });
    if (A.deadTags.length)   cards.push({ icon: '🏷️', num: A.deadTags.length,   lab: 'unused tags',       key: 'deadTags',   cls: 'warn' });
    if (A.deadFields.length) cards.push({ icon: '🧩', num: A.deadFields.length, lab: 'unused fields',     key: 'deadFields', cls: 'warn' });
    if (A.deadEmails.length) cards.push({ icon: '✉️', num: A.deadEmails.length, lab: 'unused emails',     key: 'deadEmails', cls: 'warn' });
    if (cards.length === 0) cards.push({ icon: '✨', num: 0, lab: 'Nothing to clean up · every asset is referenced', key: '', cls: '' });
    ac.innerHTML = cards.map(function (c) {
      return '<button class="attention-card ' + c.cls + '" ' + (c.key ? 'data-attn="' + c.key + '"' : '') + '>'
           + '<span class="ac-icon">' + c.icon + '</span>'
           + '<div><div class="ac-num">' + fmt(c.num) + '</div><div class="ac-lab">' + esc(c.lab) + '</div></div>'
           + '</button>';
    }).join('');

    var hl = $('hot-list');
    hl.innerHTML = A.hot.map(function (h, i) {
      var nd = N[h.id]; if (!nd) return '';
      var meta = tm(nd.t);
      return '<li><button data-id="' + esc(h.id) + '">'
        + '<span class="rank">' + (i + 1) + '</span>'
        + '<span class="h-emoji">' + meta.e + '</span>'
        + '<span class="h-name">' + esc(nd.n) + '</span>'
        + '<span class="h-kind">' + esc(meta.l.replace(/s$/, '')) + '</span>'
        + '<span class="h-deg">' + h.d + ' refs</span>'
        + '</button></li>';
    }).join('');
  }

  /* -------- Asset detail rendering -------- */
  function renderAsset(id) {
    var nd = N[id];
    if (!nd) return false;
    var meta = tm(nd.t);
    $('welcome').classList.add('hidden');
    var av = $('asset-view');
    av.hidden = false;
    av.classList.add('active');

    var emoji = $('av-emoji');
    emoji.textContent = meta.e;
    emoji.style.background = meta.c + '22';
    emoji.style.color = meta.c;

    $('av-kind').textContent = meta.l.replace(/s$/, '');
    $('av-name').textContent = nd.n;
    $('av-id').textContent = id;
    $('av-graph').setAttribute('data-focus', id);

    var outs = nd.e || [];
    var ins = nd.i || [];
    var degEl = $('av-degree');
    degEl.innerHTML =
      '<span><span class="deg-arr">→</span><b>' + outs.length + '</b> uses</span>' +
      '<span><span class="deg-arr">←</span><b>' + ins.length + '</b> used by</span>';

    // Metadata pairs (excluding empty + repeated id)
    var mp = $('av-meta');
    if (nd.x && Object.keys(nd.x).length) {
      mp.classList.remove('empty');
      mp.innerHTML = Object.keys(nd.x).map(function (k) {
        var v = nd.x[k];
        if (typeof v === 'object') v = JSON.stringify(v);
        return '<div class="mp"><span class="k">' + esc(formatKey(k)) + '</span><span class="v">' + esc(v) + '</span></div>';
      }).join('');
      mp.style.display = '';
    } else {
      mp.style.display = 'none';
    }

    // Mini neighborhood graph
    renderMiniGraph(id, outs, ins);

    // Uses / Used by
    fillEdges('av-uses', outs, '→');
    fillEdges('av-usedby', ins, '←');
    $('av-uses-section').hidden = outs.length === 0;
    $('av-usedby-section').hidden = ins.length === 0;
    $('av-uses-count').textContent = outs.length;
    $('av-usedby-count').textContent = ins.length;

    // Highlight in sidebar
    document.querySelectorAll('.asset-item.active').forEach(function (el) { el.classList.remove('active'); });
    var item = document.querySelector('.asset-item[data-id="' + cssEscape(id) + '"]');
    if (item) {
      item.classList.add('active');
      var grp = item.closest('details.type-group');
      if (grp && !grp.open) grp.open = true;
      if (item.scrollIntoView) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    document.querySelector('.detail').scrollTop = 0;
    history.replaceState(null, '', '#' + id);
    return true;
  }
  function clearAsset() {
    var av = $('asset-view');
    av.hidden = true;
    av.classList.remove('active');
    $('welcome').classList.remove('hidden');
    document.querySelectorAll('.asset-item.active').forEach(function (el) { el.classList.remove('active'); });
    history.replaceState(null, '', location.pathname + location.search);
  }
  function formatKey(k) {
    return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function fillEdges(targetId, list, arrow) {
    var el = $(targetId);
    if (!list.length) { el.innerHTML = ''; return; }
    // Group by category for visual grouping (light separator only)
    var html = '';
    list.forEach(function (e) {
      var otherId = e[0], label = e[1], cat = e[2];
      var other = N[otherId];
      if (!other) {
        html += '<li><span class="eg-arr">' + arrow + '</span><span class="eg-label">' + esc(label) + '</span>'
              + '<span class="eg-target" style="color:var(--danger)">missing · ' + esc(otherId) + '</span></li>';
        return;
      }
      var m = tm(other.t);
      html += '<li>'
        + '<span class="eg-arr">' + arrow + '</span>'
        + '<span class="eg-label">' + esc(label) + '</span>'
        + '<button class="eg-target" data-id="' + esc(otherId) + '">'
        + '<span class="eg-emoji">' + m.e + '</span>'
        + '<span class="eg-name">' + esc(other.n) + '</span>'
        + '<span class="eg-kind">· ' + esc(m.l.replace(/s$/, '')) + '</span>'
        + '</button></li>';
    });
    el.innerHTML = html;
  }
  function cssEscape(s) {
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\\\' + c; });
  }

  /* -------- Mini neighborhood graph (radial 1-hop) -------- */
  function renderMiniGraph(id, outs, ins) {
    var el = $('av-mini');
    var section = $('av-mini-section');
    if (!outs.length && !ins.length) {
      el.innerHTML = '<div class="mini-empty">No connections — this asset is an orphan.</div>';
      section.hidden = false;
      return;
    }
    section.hidden = false;

    // Collect unique neighbors with primary direction & label
    var seen = {};
    var neighbors = [];
    outs.forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; neighbors.push({ id: e[0], dir: 'out', label: e[1], cat: e[2] }); } });
    ins.forEach(function (e) { if (!seen[e[0]]) { seen[e[0]] = 1; neighbors.push({ id: e[0], dir: 'in', label: e[1], cat: e[2] }); } });

    // Layout: center + circle of neighbors (cap to 30 visible)
    var W = 600, H = 360;
    var CX = W / 2, CY = H / 2;
    var max = Math.min(neighbors.length, 30);
    var hidden = neighbors.length - max;
    var ring = Math.min(135, 60 + max * 4);
    var nd = N[id];
    var meta = tm(nd.t);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + SVGNS + '">';

    // Draw edges
    for (var i = 0; i < max; i++) {
      var nb = neighbors[i];
      var ang = (i / max) * Math.PI * 2 - Math.PI / 2;
      var x = CX + Math.cos(ang) * ring;
      var y = CY + Math.sin(ang) * ring;
      svg += '<line x1="' + CX + '" y1="' + CY + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" '
        + 'stroke="' + edgeColor(nb.cat) + '" stroke-width="1.4" stroke-opacity="0.7"></line>';
    }
    // Center node
    svg += '<circle cx="' + CX + '" cy="' + CY + '" r="22" fill="' + meta.c + '" stroke="#fff" stroke-width="3"></circle>';
    svg += '<text x="' + CX + '" y="' + (CY + 4) + '" text-anchor="middle" font-size="14" fill="#fff" font-family="-apple-system, sans-serif">' + meta.e + '</text>';
    // Neighbor nodes + labels
    for (var j = 0; j < max; j++) {
      var nb2 = neighbors[j];
      var nb2node = N[nb2.id];
      var ang2 = (j / max) * Math.PI * 2 - Math.PI / 2;
      var x2 = CX + Math.cos(ang2) * ring;
      var y2 = CY + Math.sin(ang2) * ring;
      var nbMeta = tm(nb2node.t);
      var arrow = nb2.dir === 'out' ? '→' : '←';

      svg += '<g class="mg-node" data-id="' + esc(nb2.id) + '" style="cursor:pointer">';
      svg += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="11" fill="' + nbMeta.c + '" stroke="#fff" stroke-width="2"></circle>';
      svg += '<text x="' + x2.toFixed(1) + '" y="' + (y2 + 3.5).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#fff" font-family="-apple-system, sans-serif">' + nbMeta.e + '</text>';

      // Label position outside the ring
      var lx = CX + Math.cos(ang2) * (ring + 22);
      var ly = CY + Math.sin(ang2) * (ring + 22);
      var anchor = lx > CX + 8 ? 'start' : (lx < CX - 8 ? 'end' : 'middle');
      var nameShort = nb2node.n.length > 22 ? nb2node.n.slice(0, 20) + '…' : nb2node.n;
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + anchor + '" font-size="10.5" fill="#334155" font-family="-apple-system, sans-serif">'
           + esc(arrow + ' ' + nameShort) + '</text>';
      svg += '<title>' + esc(nb2.dir === 'out' ? 'uses' : 'used by') + ': ' + esc(nb2node.n) + '\\n' + esc(nb2.label) + '</title>';
      svg += '</g>';
    }
    if (hidden > 0) {
      svg += '<text x="' + CX + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="#94A3B8">… and ' + hidden + ' more</text>';
    }
    svg += '</svg>';
    el.innerHTML = svg;
    // Wire up click on neighbor circles
    el.querySelectorAll('.mg-node').forEach(function (g) {
      g.addEventListener('click', function () { renderAsset(g.getAttribute('data-id')); });
    });
  }
  function edgeColor(cat) {
    return ({ fk: '#10b981', action: '#f97316', token: '#3b82f6', condition: '#d946ef', form_field: '#14b8a6' })[cat] || '#94A3B8';
  }

  /* -------- Search filter -------- */
  var searchInput = $('search');
  var allItems = null;
  function refreshItems() { allItems = Array.prototype.slice.call(document.querySelectorAll('.asset-item')); }
  function runSearch() {
    var q = (searchInput.value || '').trim().toLowerCase();
    searchInput.classList.toggle('has-value', q.length > 0);
    if (!allItems) refreshItems();
    var matched = 0;
    allItems.forEach(function (el) {
      var name = (el.querySelector('.ai-name').textContent || '').toLowerCase();
      var id = el.getAttribute('data-id').toLowerCase();
      var hit = !q || name.indexOf(q) !== -1 || id.indexOf(q) !== -1;
      el.classList.toggle('hidden', !hit);
      if (hit) matched++;
    });
    document.querySelectorAll('details.type-group').forEach(function (grp) {
      var visible = grp.querySelectorAll('.asset-item:not(.hidden)').length;
      grp.classList.toggle('hidden', visible === 0);
      if (q && visible > 0) grp.open = true;
    });
    $('no-results').classList.toggle('show', q && matched === 0);
  }
  searchInput.addEventListener('input', runSearch);

  /* -------- Attention filter (chips + welcome cards) -------- */
  var activeAttn = null;
  function applyAttnFilter(key) {
    activeAttn = (activeAttn === key) ? null : key;
    if (!allItems) refreshItems();
    document.querySelectorAll('.chip[data-attn]').forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-attn') === activeAttn);
    });
    if (!activeAttn) {
      // Reset filter and rerun search (which may itself be empty)
      allItems.forEach(function (el) { el.classList.remove('hidden'); });
      document.querySelectorAll('details.type-group').forEach(function (g) { g.classList.remove('hidden'); });
      runSearch();
      return;
    }
    var ids = A[activeAttn] || [];
    var idSet = {};
    ids.forEach(function (id) { idSet[id] = 1; });
    allItems.forEach(function (el) {
      var hit = idSet[el.getAttribute('data-id')];
      el.classList.toggle('hidden', !hit);
    });
    document.querySelectorAll('details.type-group').forEach(function (grp) {
      var visible = grp.querySelectorAll('.asset-item:not(.hidden)').length;
      grp.classList.toggle('hidden', visible === 0);
      if (visible > 0) grp.open = true;
    });
    searchInput.value = '';
    searchInput.classList.remove('has-value');
    $('no-results').classList.toggle('show', ids.length === 0);
  }

  /* -------- Click delegation -------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var item = t.closest && t.closest('.asset-item, .eg-target, .hot-list button');
    if (item && item.getAttribute('data-id')) {
      e.preventDefault();
      renderAsset(item.getAttribute('data-id'));
      return;
    }
    var attn = t.closest && t.closest('[data-attn]');
    if (attn) {
      e.preventDefault();
      applyAttnFilter(attn.getAttribute('data-attn'));
      return;
    }
    if (t.id === 'av-back') { clearAsset(); return; }
    if (t.id === 'av-graph' || (t.closest && t.closest('#av-graph'))) {
      var id = $('av-graph').getAttribute('data-focus');
      openModal(id);
      return;
    }
    if (t.id === 'open-graph' || (t.closest && t.closest('#open-graph'))) { openModal(null); return; }
    if (t.id === 'modal-close' || t.id === 'modal-overlay') { closeModal(); return; }
  });

  /* -------- Keyboard -------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault(); searchInput.focus(); searchInput.select();
    } else if (e.key === 'Escape') {
      if (!$('modal').hidden) { closeModal(); return; }
      if (document.activeElement === searchInput) {
        searchInput.value = ''; runSearch(); searchInput.blur();
      } else if (!$('asset-view').hidden) {
        clearAsset();
      }
    }
  });

  /* -------- Modal: full force-directed graph (lazy) -------- */
  var modalRendered = false;
  var modalState = null;
  function openModal(focusId) {
    var modal = $('modal');
    modal.hidden = false;
    if (!modalRendered) {
      var loader = $('modal-loader');
      loader.hidden = false;
      setTimeout(function () {
        renderModalGraph();
        loader.hidden = true;
        if (focusId) focusInModal(focusId);
      }, 30);
    } else if (focusId) {
      focusInModal(focusId);
    }
  }
  function closeModal() { $('modal').hidden = true; }

  function renderModalGraph() {
    modalRendered = true;
    var W = L.layoutW, H = L.layoutH;
    var pos = L.layout;
    var body = $('modal-body');
    var svg = '<svg id="m-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" xmlns="' + SVGNS + '"><g id="m-vp">';
    // Edges from per-node outbound (deduplicated naturally since we only iterate outbounds)
    var edges = [];
    Object.keys(N).forEach(function (id) {
      var nd = N[id];
      if (!nd.e) return;
      nd.e.forEach(function (e) {
        var p1 = pos[id], p2 = pos[e[0]];
        if (!p1 || !p2) return;
        edges.push({ s: id, t: e[0], c: e[2], x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
    });
    var edgeStr = edges.map(function (e) {
      return '<line class="gedge ' + e.c + '" data-s="' + esc(e.s) + '" data-t="' + esc(e.t) + '" '
        + 'x1="' + e.x1.toFixed(1) + '" y1="' + e.y1.toFixed(1) + '" x2="' + e.x2.toFixed(1) + '" y2="' + e.y2.toFixed(1) + '"></line>';
    }).join('');
    svg += '<g id="m-edges">' + edgeStr + '</g><g id="m-nodes">';
    Object.keys(N).forEach(function (id) {
      var nd = N[id];
      var p = pos[id];
      if (!p) return;
      var d = deg(id);
      var r = (4 + Math.min(12, Math.sqrt(d) * 1.8)).toFixed(1);
      var meta = tm(nd.t);
      svg += '<g class="gnode" data-id="' + esc(id) + '" transform="translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')">'
        + '<circle r="' + r + '" fill="' + meta.c + '" stroke="#fff" stroke-width="1.4"></circle>'
        + '<title>' + esc(nd.n) + ' — ' + esc(meta.l.replace(/s$/, '')) + ' (' + d + ' refs)</title>'
        + '</g>';
    });
    svg += '</g></g></svg>';
    body.innerHTML = svg + body.innerHTML; // preserve loader (hidden)
    wireModalInteractivity();
  }
  function wireModalInteractivity() {
    var svg = $('m-svg');
    var vp = $('m-vp');
    var body = $('modal-body');
    var vx = 0, vy = 0, vs = 1;
    var drag = null;
    function apply() { vp.setAttribute('transform', 'translate(' + vx + ',' + vy + ') scale(' + vs + ')'); }
    body.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.gnode')) return;
      drag = { x: e.clientX, y: e.clientY, vx: vx, vy: vy };
      body.classList.add('dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      vx = drag.vx + (e.clientX - drag.x);
      vy = drag.vy + (e.clientY - drag.y);
      apply();
    });
    window.addEventListener('mouseup', function () { drag = null; body.classList.remove('dragging'); });
    body.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = svg.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var newVs = Math.max(0.2, Math.min(4, vs * (1 + (-e.deltaY * 0.0015))));
      var ratio = newVs / vs;
      vx = mx - (mx - vx) * ratio;
      vy = my - (my - vy) * ratio;
      vs = newVs;
      apply();
    }, { passive: false });
    svg.querySelectorAll('.gnode').forEach(function (g) {
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = g.getAttribute('data-id');
        highlightInModal(id);
        // Selecting in modal also navigates the detail panel
        renderAsset(id);
      });
    });
    body.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.gnode')) return;
      clearModalHighlight();
    });
    modalState = {
      apply: apply,
      setView: function (x, y, s) { vx = x; vy = y; vs = s; apply(); },
      svg: svg, body: body
    };
  }
  function highlightInModal(id) {
    var nodes = document.querySelectorAll('#m-svg .gnode');
    var edges = document.querySelectorAll('#m-svg .gedge');
    var neigh = { [id]: 1 };
    var inc = [];
    edges.forEach(function (e) {
      var s = e.getAttribute('data-s'), t = e.getAttribute('data-t');
      if (s === id || t === id) { inc.push(e); neigh[s] = 1; neigh[t] = 1; }
    });
    nodes.forEach(function (g) {
      var nid = g.getAttribute('data-id');
      g.classList.toggle('selected', nid === id);
      g.classList.toggle('highlight', nid !== id && !!neigh[nid]);
      g.classList.toggle('dim', !neigh[nid]);
    });
    edges.forEach(function (e) {
      var hi = inc.indexOf(e) !== -1;
      e.classList.toggle('highlight', hi);
      e.classList.toggle('dim', !hi);
    });
  }
  function clearModalHighlight() {
    document.querySelectorAll('#m-svg .gnode, #m-svg .gedge').forEach(function (el) {
      el.classList.remove('selected', 'highlight', 'dim');
    });
  }
  function focusInModal(id) {
    if (!modalState) return;
    var p = L.layout[id];
    if (!p) return;
    var rect = modalState.svg.getBoundingClientRect();
    var vb = modalState.svg.viewBox.baseVal;
    var newVs = 2;
    var px = p.x * (rect.width / vb.width);
    var py = p.y * (rect.height / vb.height);
    var nx = rect.width / 2 - px * newVs;
    var ny = rect.height / 2 - py * newVs;
    modalState.setView(nx, ny, newVs);
    highlightInModal(id);
  }

  /* -------- Init -------- */
  buildSidebar();
  buildWelcome();
  refreshItems();
  // Open initial asset from hash
  var initial = (location.hash || '').slice(1);
  if (initial && N[initial]) {
    setTimeout(function () { renderAsset(initial); }, 0);
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT, html);

console.log(`✅ Wrote ${OUTPUT}`);
console.log(`   Nodes:    ${num(nodes.size)} (${num(stats.orphanCount)} orphans, ${num(nodes.size - stats.orphanCount)} connected)`);
console.log(`   Edges:    ${num(edges.length)}`);
console.log(`   Types:    ${typesPresent.length}`);
console.log(`   Top node: ${topNodes[0] ? `"${topNodes[0].n.name}" (deg ${topNodes[0].degree})` : '—'}`);
console.log(`   Edges by category: ${JSON.stringify(stats.edgesByCategory)}`);
