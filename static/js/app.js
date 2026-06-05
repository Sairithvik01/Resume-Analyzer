/* ================================================================
   ResumeAI — Main Application Controller
   Handles file upload, API communication, and result rendering.
   ================================================================ */

/* ================================================================
   STATE & DOM REFS
================================================================ */
let analysisData = null;
const API_BASE_URL = (window.RESUME_AI_API_BASE || '').replace(/\/$/, '');

const uploadForm     = document.getElementById('upload-form');
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const fileInfo       = document.getElementById('file-info');
const fileName       = document.getElementById('file-name');
const fileSize       = document.getElementById('file-size');
const clearFileBtn   = document.getElementById('clear-file');
const analyzeBtn     = document.getElementById('analyze-btn');
const uploadSection  = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const errorToast     = document.getElementById('error-toast');
const errorMessage   = document.getElementById('error-message');

/* ================================================================
   FILE HANDLING
================================================================ */
const ALLOWED = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function validateFile(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
        showError('Unsupported file type. Please upload PDF, DOCX, PNG, JPG, or WEBP.');
        return false;
    }
    if (file.size > MAX_SIZE) {
        showError('File too large. Maximum size is 10 MB.');
        return false;
    }
    return true;
}

function setFile(file) {
    if (!validateFile(file)) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    analyzeBtn.disabled = false;
    dropZone.querySelector('#drop-text').innerHTML = '<span class="text-emerald-400 font-medium">✓ File ready</span>';
}

function clearFile() {
    fileInput.value = '';
    analysisData = null;
    fileInfo.classList.add('hidden');
    analyzeBtn.disabled = true;
    dropZone.querySelector('#drop-text').innerHTML = '<span class="text-cyan-400 font-medium">Click to upload</span> or drag and drop your resume';
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) setFile(e.target.files[0]);
});

clearFileBtn.addEventListener('click', clearFile);

// Drag & Drop
['dragenter','dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drop-active'); });
});
['dragleave','drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drop-active'); });
});
dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});

/* ================================================================
   LOADING STEPS
================================================================ */
const STEPS = ['step-parse', 'step-strip', 'step-ai', 'step-render'];

function activateStep(stepId) {
    STEPS.forEach(id => {
        const el = document.getElementById(id);
        const dot = el.querySelector('.step-dot');
        const inner = dot.querySelector('div');
        const label = el.querySelector('span');
        if (id === stepId) {
            dot.className = 'step-dot w-5 h-5 rounded-full border-2 border-cyan-500 flex items-center justify-center flex-shrink-0';
            inner.className = 'w-2 h-2 rounded-full bg-cyan-500 animate-pulse';
            label.className = 'text-cyan-300';
        } else if (STEPS.indexOf(id) < STEPS.indexOf(stepId)) {
            dot.className = 'step-dot w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center flex-shrink-0';
            inner.className = 'w-2 h-2 rounded-full bg-emerald-500';
            label.className = 'text-emerald-400';
        }
    });
}

function resetSteps() {
    STEPS.forEach(id => {
        const el = document.getElementById(id);
        const dot = el.querySelector('.step-dot');
        const inner = dot.querySelector('div');
        const label = el.querySelector('span');
        dot.className = 'step-dot w-5 h-5 rounded-full border-2 border-gray-700 flex items-center justify-center flex-shrink-0';
        inner.className = 'w-2 h-2 rounded-full bg-gray-700';
        label.className = 'text-gray-500';
    });
}

/* ================================================================
   FORM SUBMISSION
================================================================ */
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files.length) return;

    // Show loading
    resultsSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    analyzeBtn.disabled = true;
    resetSteps();

    // Step animation
    activateStep('step-parse');
    await sleep(600);
    activateStep('step-strip');
    await sleep(400);
    activateStep('step-ai');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('target_role', document.getElementById('target-role').value);
    formData.append('experience_level', document.getElementById('experience-level').value);

    try {
        const analyzeUrl = API_BASE_URL ? `${API_BASE_URL}/analyze` : '/analyze';
        const res = await fetch(analyzeUrl, { method: 'POST', body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.detail || err?.message || `HTTP ${res.status}`);
        }

        activateStep('step-render');
        await sleep(300);

        const data = await res.json();
        analysisData = data;
        renderResults(data);

        loadingSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        loadingSection.classList.add('hidden');
        showError(err.message);
    } finally {
        analyzeBtn.disabled = false;
    }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ================================================================
   ERROR DISPLAY
================================================================ */
function showError(msg) {
    errorMessage.textContent = msg;
    errorToast.classList.remove('hidden');
    errorToast.querySelector('div').className = 'glass rounded-xl p-4 border-l-4 border-red-500 shadow-2xl toast';
    setTimeout(() => errorToast.classList.add('hidden'), 5000);
}

/* ================================================================
   RENDER RESULTS — Master Orchestrator
================================================================ */
function renderResults(data) {
    renderScore(data.healthScore);
    renderPros(data.pros);
    renderCons(data.cons);
    renderCompanyMatchup(data.companyMatchup);
    renderKeywords(data.atsStrategy.missingKeywords);
    renderRewrites(data.atsStrategy.rewrittenBullets);
    renderFixes(data.atsStrategy.formattingFixes);
    renderActionPlan(data.actionPlan);
}

/* ================================================================
   RENDER: Score Gauge
================================================================ */
function renderScore(hs) {
    const circle = document.getElementById('score-circle');
    const text   = document.getElementById('score-text');
    const circumference = 2 * Math.PI * 54; // ~339.292

    // Color based on score
    let color;
    if (hs.overall >= 70) color = '#10b981';
    else if (hs.overall >= 45) color = '#f59e0b';
    else color = '#ef4444';
    circle.style.stroke = color;

    // Animate circle fill + counter
    let start = null;
    function tick(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 1500, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(hs.overall * ease);
        text.textContent = current;
        circle.style.strokeDashoffset = circumference - (current / 100) * circumference;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Sub-score progress bars
    const container = document.getElementById('sub-scores-container');
    const subs = [
        { label: 'Formatting',        value: hs.formatting },
        { label: 'Impact & Metrics',  value: hs.impact },
        { label: 'Industry Relevance',value: hs.relevance },
        { label: 'ATS Parseability',  value: hs.atsParseability },
        { label: 'Keyword Density',   value: hs.keywordDensity },
    ];
    container.innerHTML = subs.map(s => {
        const barColor = s.value >= 70 ? 'bg-emerald-500' : s.value >= 45 ? 'bg-amber-500' : 'bg-red-500';
        return `
            <div>
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-400">${s.label}</span>
                    <span class="text-gray-300 font-semibold">${s.value}/100</span>
                </div>
                <div class="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div class="progress-fill h-full rounded-full ${barColor}" style="width:0%" data-target="${s.value}"></div>
                </div>
            </div>`;
    }).join('');

    // Animate bars after DOM paint
    setTimeout(() => {
        container.querySelectorAll('.progress-fill').forEach(bar => {
            bar.style.width = bar.dataset.target + '%';
        });
    }, 100);
}

/* ================================================================
   RENDER: Pros
================================================================ */
function renderPros(pros) {
    const c = document.getElementById('pros-container');
    c.innerHTML = (pros || []).map(p => `
        <div class="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 glass-hover transition-all duration-300 cursor-default">
            <h4 class="text-sm font-semibold text-emerald-400 mb-1">✓ ${esc(p.title)}</h4>
            <p class="text-xs text-gray-400 leading-relaxed">${esc(p.description)}</p>
        </div>`).join('');
}

/* ================================================================
   RENDER: Cons
================================================================ */
function renderCons(cons) {
    const c = document.getElementById('cons-container');
    c.innerHTML = (cons || []).map(item => {
        const sev = (item.severity || 'major').toLowerCase();
        return `
        <div class="p-4 rounded-xl bg-red-500/5 border border-red-500/10 glass-hover transition-all duration-300 cursor-default">
            <div class="flex items-center gap-2 mb-1">
                <h4 class="text-sm font-semibold text-red-400">✗ ${esc(item.title)}</h4>
                <span class="badge-${sev} text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">${sev}</span>
            </div>
            <p class="text-xs text-gray-400 leading-relaxed">${esc(item.description)}</p>
        </div>`;
    }).join('');
}

/* ================================================================
   RENDER: Company Matchup (3 Tiers)
================================================================ */
function renderCompanyMatchup(cm) {
    // Tier 1 — High Probability
    document.getElementById('tier1-container').innerHTML = (cm.tier1 || []).map(c => `
        <div class="p-4 rounded-xl bg-emerald-500/5 border-l-4 border-emerald-500 glass-hover transition-all duration-300">
            <h4 class="text-sm font-semibold text-emerald-300 mb-1">${esc(c.company)}</h4>
            <p class="text-xs text-gray-400 leading-relaxed">${esc(c.reason)}</p>
        </div>`).join('');

    // Tier 2 — Medium Probability
    document.getElementById('tier2-container').innerHTML = (cm.tier2 || []).map(c => `
        <div class="p-4 rounded-xl bg-amber-500/5 border-l-4 border-amber-500 glass-hover transition-all duration-300">
            <h4 class="text-sm font-semibold text-amber-300 mb-1">${esc(c.company)}</h4>
            <p class="text-xs text-gray-400 leading-relaxed"><span class="text-amber-400 font-medium">Gap:</span> ${esc(c.gap)}</p>
        </div>`).join('');

    // Tier 3 — Low Probability
    document.getElementById('tier3-container').innerHTML = (cm.tier3 || []).map(c => `
        <div class="p-4 rounded-xl bg-red-500/5 border-l-4 border-red-500 glass-hover transition-all duration-300">
            <h4 class="text-sm font-semibold text-red-300 mb-1">${esc(c.company)}</h4>
            <p class="text-xs text-gray-400 leading-relaxed"><span class="text-red-400 font-medium">Blocker:</span> ${esc(c.blocker)}</p>
        </div>`).join('');
}

/* ---- Tier Tab Switching ---- */
let currentTier = 'tier1';

function showTier(tier) {
    document.querySelectorAll('.tier-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(tier + '-panel').classList.remove('hidden');

    document.querySelectorAll('.tier-tab').forEach(t => {
        t.className = 'tier-tab px-4 py-2 rounded-lg text-sm font-medium border border-white/5 text-gray-400 hover:text-gray-200 transition-all';
    });
    const activeTab = document.getElementById('tab-' + tier);
    const tierClass = tier === 'tier1' ? 'active-tier1' : tier === 'tier2' ? 'active-tier2' : 'active-tier3';
    activeTab.className = `tier-tab ${tierClass} px-4 py-2 rounded-lg text-sm font-medium border transition-all`;
    currentTier = tier;
}

/* ================================================================
   RENDER: Missing Keywords
================================================================ */
function renderKeywords(keywords) {
    const c = document.getElementById('keywords-container');
    c.innerHTML = (keywords || []).map(k => `
        <div class="keyword-pill px-3 py-1.5 rounded-lg text-xs font-medium cursor-default group relative">
            ${esc(k.keyword)}
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-gray-900 border border-white/10 text-xs text-gray-300 w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                ${esc(k.reason)}
            </div>
        </div>`).join('');
}

/* ================================================================
   RENDER: Rewritten Bullets (X-Y-Z)
================================================================ */
function renderRewrites(rewrites) {
    const c = document.getElementById('rewrites-container');
    c.innerHTML = (rewrites || []).map((r, i) => `
        <div class="rounded-xl overflow-hidden border border-white/5">
            <div class="diff-original px-4 py-3">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase text-red-400 tracking-wider">Before</span>
                </div>
                <p class="text-xs text-gray-400 leading-relaxed">${esc(r.original)}</p>
            </div>
            <div class="diff-rewritten px-4 py-3">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">After (X-Y-Z)</span>
                    <button onclick="copyText(this, \`${escAttr(r.rewritten)}\`)" class="copy-btn text-[10px] text-gray-500 hover:text-cyan-400 px-2 py-1 rounded-md hover:bg-white/5 transition-all">
                        Copy
                    </button>
                </div>
                <p class="text-xs text-emerald-200 leading-relaxed font-medium">${esc(r.rewritten)}</p>
            </div>
        </div>`).join('');
}

/* ================================================================
   RENDER: Formatting Fixes
================================================================ */
function renderFixes(fixes) {
    const c = document.getElementById('fixes-container');
    c.innerHTML = (fixes || []).map(f => {
        const sev = (f.severity || 'medium').toLowerCase();
        return `
        <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 glass-hover transition-all duration-300">
            <div class="flex items-start gap-3">
                <span class="badge-${sev} text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">${sev}</span>
                <div>
                    <h4 class="text-sm font-medium text-gray-200 mb-1">${esc(f.issue)}</h4>
                    <p class="text-xs text-gray-400 leading-relaxed"><span class="text-cyan-400 font-medium">Fix:</span> ${esc(f.fix)}</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ================================================================
   RENDER: Action Plan
================================================================ */
function renderActionPlan(plan) {
    const c = document.getElementById('action-container');
    const priorityStyles = {
        'P0': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'badge-critical' },
        'P1': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'badge-major' },
        'P2': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'badge-minor' },
    };
    c.innerHTML = (plan || []).map(item => {
        const p = item.priority?.toUpperCase() || 'P1';
        const s = priorityStyles[p] || priorityStyles['P1'];
        return `
        <div class="flex items-start gap-4 p-4 rounded-xl ${s.bg} border ${s.border} glass-hover transition-all duration-300">
            <span class="${s.badge} text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex-shrink-0">${p}</span>
            <div class="flex-1">
                <p class="text-sm text-gray-200 font-medium">${esc(item.action)}</p>
                <p class="text-xs text-gray-500 mt-1">Impact: ${esc(item.impact)}</p>
            </div>
        </div>`;
    }).join('');
}

/* ================================================================
   UTILITIES
================================================================ */

/** HTML-escape a string to prevent XSS */
function esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
}

/** Escape string for use inside template literal attributes */
function escAttr(str) {
    return (str || '').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
}

/** Copy text to clipboard with visual feedback on the button */
function copyText(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
}

/* ================================================================
   EXPORT: Download analysis as Markdown
================================================================ */
function exportMarkdown() {
    if (!analysisData) return;
    const d = analysisData;
    let md = `# Resume Analysis Report\n\n`;
    md += `## Health Score: ${d.healthScore.overall}/100\n`;
    md += `| Dimension | Score |\n|---|---|\n`;
    md += `| Formatting | ${d.healthScore.formatting} |\n`;
    md += `| Impact | ${d.healthScore.impact} |\n`;
    md += `| Relevance | ${d.healthScore.relevance} |\n`;
    md += `| ATS Parseability | ${d.healthScore.atsParseability} |\n`;
    md += `| Keyword Density | ${d.healthScore.keywordDensity} |\n\n`;

    md += `## Strengths\n`;
    (d.pros||[]).forEach(p => md += `- **${p.title}**: ${p.description}\n`);

    md += `\n## Weaknesses\n`;
    (d.cons||[]).forEach(c => md += `- **[${c.severity}] ${c.title}**: ${c.description}\n`);

    md += `\n## Company Matchup\n`;
    md += `### Tier 1 — High Probability\n`;
    (d.companyMatchup.tier1||[]).forEach(c => md += `- **${c.company}**: ${c.reason}\n`);
    md += `### Tier 2 — Medium Probability\n`;
    (d.companyMatchup.tier2||[]).forEach(c => md += `- **${c.company}**: Gap — ${c.gap}\n`);
    md += `### Tier 3 — Low Probability\n`;
    (d.companyMatchup.tier3||[]).forEach(c => md += `- **${c.company}**: Blocker — ${c.blocker}\n`);

    md += `\n## ATS Strategy\n`;
    md += `### Missing Keywords\n`;
    (d.atsStrategy.missingKeywords||[]).forEach(k => md += `- **${k.keyword}**: ${k.reason}\n`);
    md += `### Rewritten Bullets (X-Y-Z)\n`;
    (d.atsStrategy.rewrittenBullets||[]).forEach(r => {
        md += `- **Before:** ${r.original}\n  **After:** ${r.rewritten}\n`;
    });
    md += `### Formatting Fixes\n`;
    (d.atsStrategy.formattingFixes||[]).forEach(f => md += `- **[${f.severity}] ${f.issue}**: ${f.fix}\n`);

    md += `\n## Action Plan\n`;
    (d.actionPlan||[]).forEach(a => md += `- **[${a.priority}]** ${a.action} — *Impact: ${a.impact}*\n`);

    md += `\n---\n*Generated by ResumeAI on ${new Date().toLocaleDateString()}*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume-analysis-report.md';
    a.click();
    URL.revokeObjectURL(url);
}
