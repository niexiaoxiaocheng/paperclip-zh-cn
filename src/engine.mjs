import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import {createTranslator,loadCatalog} from './catalog.mjs';
import {compatibility} from './target.mjs';

// Scoped AST transformations for the explicitly supported upstream build.
export function transformAssets(source,{catalog=loadCatalog(),catalogAsset=compatibility.catalogAsset}={}) {
const dictionary={...catalog};
const catalogCode=fs.readFileSync(path.join(source,'assets',catalogAsset),'utf8');
const brands=new Set([...catalogCode.matchAll(/label:"Sign in with ([^"]+)"/g)].map(m=>m[1]));
for (const match of catalogCode.matchAll(/(?:var |,)[\w$]+="[a-z][a-z0-9_-]+",[\w$]+="([A-Z][^"]+)"/g)) brands.add(match[1]);
brands.add('Paperclip');
for (const brand of brands) {
  dictionary[`Sign in with ${brand}`]=`使用 ${brand} 登录`;
  dictionary[`Connect ${brand}`]=`连接 ${brand}`;
}
const translate=createTranslator(dictionary);
const props = new Set(['children', 'label', 'title', 'description', 'placeholder', 'aria-label', 'emptyMessage', 'tooltip', 'alt', 'helperText', 'primaryLabel', 'submitLabel', 'loadingLabel', 'confirmLabel', 'cancelLabel', 'buttonLabel', 'emptyText', 'message', 'heading', 'subtitle', 'displayName', 'shortLabel', 'actionLabel', 'emptyStateMessage', 'emptyStateActionLabel', 'sectionTitle', 'summary', 'action', 'hint', 'help', 'helpText', 'emptyLabel', 'errorMessage', 'successMessage', 'note', 'caption', 'fallbackLabel', 'emptyDescription', 'searchPlaceholder', 'detail', 'bodyText', 'cancelText', 'confirmText', 'errorText', 'successText', 'loadingText', 'text', 'guidanceMd', 'whenToUse', 'setupHint', 'purpose', 'riskNotes', 'warnings', 'requirements', 'setupSteps', 'notes', 'helper', 'ctaLabel', 'statusLabel', 'unitLabel', 'body']);
for (const key of ['footnote','ariaLabel','aria-description','explanation','helpDescription','emptyTitle','buttonText','confirmMessage','warningMessage','content','supportText','detailText']) props.add(key);
function presentation(node, ancestors, allowLogicalValue=false) {
  const text = node.value ?? node.quasis?.map(q=>q.value.cooked).join(' ');
  if (typeof text==='string' && (text.startsWith('Help me set up a ') || text.startsWith('Join flow:\n') || text.length>1200 && /Use the following workflow|Follow these instructions/.test(text))) return false;
  // Code samples and commands are executable content, even when rendered as JSX.
  if (ancestors.some(a=>a.type==='CallExpression' && ['code','pre'].includes(a.arguments?.[0]?.value))) return false;
  let child = node;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const parent = ancestors[i];
    if (parent.type === 'Property') {
      const key = parent.key.name ?? parent.key.value;
      if (key==='action' && /^[a-z_]+$/.test(text)) return false;
      const eventLabel = /^(issue|agent|heartbeat|approval|project|goal|cost|company|audit|tool_app|tool_connection)\.[a-z_]+$/.test(key);
      const enumLabel = /^(ceo|cto|engineer|designer|pm|qa|devops|researcher|general|active|idle|running|paused|error|terminated|pending_approval|todo|in_progress|in_review|backlog|blocked|done|cancelled|failed|succeeded|completed|today|yesterday|earlier|unknown|open|closed|waiting|in_queue|auth_required|unreachable|fresh|stale|success|warning|critical|high|medium|low|owner|admin|member|operator|viewer|needs_setup|ready|disconnected|connected|draft|expired|archived)$/.test(key) && /^[A-Z][a-z]/.test(text);
      const governanceLabel = ['defaultPolicy','cap','suggest_tasks','ask_user_questions','request_confirmation','request_checkbox_confirmation','request_item_verdicts','connection_intent'].includes(key);
      return parent.value === child && (props.has(key) || eventLabel || enumLabel || governanceLabel);
    }
    if (parent.type === 'ConditionalExpression' && parent.test === child) return false;
    if (parent.type === 'LogicalExpression' && parent.left === child && !allowLogicalValue) return false;
    if (parent.type === 'AssignmentPattern' && parent.right !== child) return false;
    if (parent.type === 'BinaryExpression' && parent.operator !== '+') return false;
    if (parent.type === 'CallExpression' && parent.arguments[0] === child) {
      const method=parent.callee.property?.name;
      return ['success','error','warning','info','notify','confirm'].includes(method) && !['console','logger'].includes(parent.callee.object?.name) ||
        (['ArrowFunctionExpression','FunctionExpression'].includes(parent.arguments[1]?.type) && /^[A-Z][a-z]/.test(text));
    }
    if (['VariableDeclarator', 'ReturnStatement'].includes(parent.type)) {
      if (parent.type==='VariableDeclarator' && brands.has(text)) return false;
      return (/^[A-Z][a-z]/.test(text) || text === 'just now') && !(/^[\w.:/+-]+$/.test(text) && /[_/:]/.test(text));
    }
    if (!['ConditionalExpression', 'LogicalExpression', 'ArrayExpression', 'BinaryExpression', 'Literal', 'AssignmentPattern'].includes(parent.type)) return false;
    child = parent;
  }
  return false;
}
// Step names and command menus sometimes use a static array rather than props.
// Translate only known human phrases there; never machine enum arrays.
function presentationArray(node, ancestors) {
  if (node.value?.startsWith('Help me set up a ') || node.value?.startsWith('Join flow:\n')) return false;
  return ancestors.at(-1)?.type === 'ArrayExpression' &&
    /^[A-Z][a-z]/.test(node.value) &&
    !/[_/{}]/.test(node.value);
}
const missing = new Map();
let changed = 0;
const output = new Map();
const enumChunks=new Set();
function recordMissing(text,name) {
  if (/[a-zA-Z]{2}/.test(text) && !/^(https?:|\/|#)/.test(text)) {
    const files = missing.get(text) || new Set(); files.add(name); missing.set(text,files);
  }
}
for (const name of fs.readdirSync(path.join(source, 'assets')).filter(n => n.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(source, 'assets', name), 'utf8');
  if (!/(children|placeholder|aria-label):/.test(code)) continue;
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const humanizers=new Set();
  for (const statement of ast.body) {
    const call=statement.expression;
    if (call?.type==='CallExpression' && call.arguments[0]?.type==='Identifier' && /^(statusLabel|formatStatus|agentRoleLabel|roleLabel)(?:\$.*)?$/.test(call.arguments[1]?.value ?? '')) humanizers.add(call.arguments[0].name);
  }
  const edits = [];
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return;
    if (node.type==='MemberExpression' && ['status','role','membershipRole','membershipStatus','state'].includes(node.computed ? node.property.value : node.property.name)) {
      const parent=ancestors.at(-1);
      const displayed=presentation(node,ancestors,true) || parent?.type==='TemplateLiteral' && presentation(parent,ancestors.slice(0,-1),true);
      if (displayed) {
        edits.push([node.start,node.end,`__paperclipZhDisplayEnum(${code.slice(node.start,node.end)})`]);
        enumChunks.add(name);
      }
    }
    if (node.type==='ReturnStatement' && ['Identifier','CallExpression','MemberExpression'].includes(node.argument?.type)) {
      const fn=ancestors.findLast(a=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(a.type));
      if (fn?.id && humanizers.has(fn.id.name)) {
        edits.push([node.argument.start,node.argument.end,`__paperclipZhDisplayEnum(${code.slice(node.argument.start,node.argument.end)})`]);
        enumChunks.add(name);
        // The complete return expression is already captured; nested source
        // literals in this expression are machine formatting, not extra edits.
        return;
      }
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && (presentation(node, ancestors) || presentationArray(node, ancestors)) && ancestors.at(-1)?.key !== node) {
      const parent=ancestors.at(-1);
      const isPluralSuffix=node.value==='s' && parent?.type==='ConditionalExpression' && [parent.consequent,parent.alternate].some(n=>n.type==='Literal' && n.value==='');
      const value = isPluralSuffix ? '' : translate(node.value);
      if (typeof value === 'string') edits.push([node.start, node.end, JSON.stringify(value)]);
      else recordMissing(node.value,name);
    }
    if (node.type === 'TemplateLiteral') {
      // The organization switcher interpolates a machine type alongside a user
      // name. Localize that type at its display boundary, keeping the name intact.
      if (presentation(node,ancestors) && node.quasis[0]?.value.cooked==='Open ' && node.quasis.at(-1)?.value.cooked===' switcher') {
        const typeExpression=node.expressions.at(-1);
        if (typeExpression?.type==='Identifier') {
          const expression=code.slice(typeExpression.start,typeExpression.end);
          edits.push([typeExpression.start,typeExpression.end,`(["组织","员工","项目"][["organization","agent","project"].indexOf(${expression})]??${expression})`]);
        }
      }
      for (const quasi of node.quasis) {
        const value = quasi.value.cooked;
        const relative = {'m ago':' 分钟前','h ago':' 小时前','d ago':' 天前','w ago':' 周前','mo ago':' 个月前'}[value];
        const translated = relative ?? (presentation(node, ancestors) ? translate(value) : undefined);
        if (translated !== undefined) {
          const escaped = translated.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
          edits.push([quasi.start, quasi.end, escaped]);
        } else if (presentation(node,ancestors)) recordMissing(value,name);
      }
    }
    if (node.type === 'Literal' && node.value === 'en-US') {
      const parent = ancestors.at(-1);
      if (parent?.type === 'CallExpression' && parent.arguments[0] === node && /^toLocale(Date|Time)?String$/.test(parent.callee.property?.name ?? '')) {
        edits.push([node.start,node.end,'"zh-CN"']);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) value.forEach(v => { if (v?.type) walk(v, [...ancestors, node]); });
      else if (value?.type) walk(value, [...ancestors, node]);
    }
  }
  walk(ast);
  if (edits.length) {
    const pieces=[];
    let cursor=0;
    for (const [start,end,value] of edits.sort((a,b)=>a[0]-b[0])) {
      if (start<cursor) throw Error(`Overlapping translation edits in ${name}`);
      pieces.push(code.slice(cursor,start),value);cursor=end;
    }
    pieces.push(code.slice(cursor));
    const translated=pieces.join('');
    parse(translated, { ecmaVersion: 'latest', sourceType: 'module' });
    output.set(name, translated); changed += edits.length;
  }
}

return {output,enumChunks,missing:[...missing].map(([text,files])=>({text,files:[...files]})),changed,dictionary};
}
