export interface Env {
  PROCUREMENT_DB: D1Database;
  PROCUREMENT_FILES_BUCKET: R2Bucket;
  ADMIN_TOKEN?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
}

// Increment this by 0.1 on each published change to surface version on the UI.
const APP_VERSION = "0.2";

// Basic in-memory rate limiter per instance (best-effort only).
const rateWindowMs = 60_000;
const rateLimit = 120;
const rateBuckets = new Map<string, { count: number; reset: number }>();

const landingPage = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>טופס בקשה ליציאה להליך רכש</title>
    <style>
      :root {
        font-family: "Assistant", "Alef", "Segoe UI", system-ui, -apple-system, sans-serif;
        color: #0b1f33;
        background: #f6f8fb;
      }
      body {
        margin: 0;
        padding: 32px;
        background: radial-gradient(circle at 10% 20%, #e3f2ff 0, #f6f8fb 35%, transparent 40%),
          radial-gradient(circle at 90% 10%, #e8f5ff 0, #f6f8fb 30%, transparent 36%);
      }
      .card {
        max-width: 1100px;
        margin: 0 auto;
        background: #ffffff;
        padding: 28px;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        border: 1px solid #e1e7ef;
      }
      h1 {
        margin: 0 0 10px 0;
        letter-spacing: -0.02em;
        font-size: 28px;
      }
      h2 {
        margin: 22px 0 10px 0;
        font-size: 18px;
        color: #0f5bd7;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }
      label {
        font-weight: 700;
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
      }
      input,
      textarea,
      select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #c8d3e0;
        border-radius: 10px;
        font-size: 14px;
        box-sizing: border-box;
        background: #fdfefe;
      }
      textarea {
        min-height: 110px;
        resize: vertical;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 12px 0;
      }
      fieldset {
        border: 1px solid #e1e7ef;
        border-radius: 12px;
        padding: 12px 14px 16px;
        margin: 12px 0;
        background: #fbfdff;
      }
      legend {
        padding: 0 8px;
        font-weight: 700;
        color: #0b1f33;
      }
      .files {
        border: 1px dashed #cbd5e1;
        padding: 14px;
        border-radius: 10px;
        background: #f8fafc;
      }
      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 6px 0;
        font-weight: 600;
      }
      .checkbox-row input[type="checkbox"] {
        width: 18px;
        height: 18px;
      }
      button {
        background: linear-gradient(120deg, #0f5bd7, #138cf0);
        color: #ffffff;
        border: none;
        padding: 12px 18px;
        border-radius: 12px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease;
        font-size: 15px;
      }
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 30px rgba(19, 140, 240, 0.28);
      }
      .status {
        padding: 12px 14px;
        border-radius: 10px;
        background: #f1f5f9;
        border: 1px solid #d8e1ed;
        color: #0b1f33;
        display: none;
        margin-top: 14px;
      }
      .status.show {
        display: block;
      }
      .hidden {
        display: none;
      }
      canvas.signature {
        border: 1px dashed #cbd5e1;
        background: #fff;
        border-radius: 10px;
        width: 100%;
        height: 180px;
        touch-action: none;
      }
      .actions-row {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        align-items: center;
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <h1 style="margin:0;">טופס בקשה ליציאה להליך רכש</h1>
        <span style="background:#0f5bd7;color:#fff;padding:6px 12px;border-radius:12px;font-weight:800;">גרסה ${APP_VERSION}</span>
      </div>
      <p style="margin:0 0 16px 0;color:#475569;">כל השדות החיוניים מסומנים כדרושים. השדות התלויים נפתחים בהתאם לבחירות.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <button type="button" id="login_any" style="background:#10b981;">התחברות עם כל מייל</button>
        <button type="button" id="login_ashdod" style="background:#0f5bd7;">התחברות עם מייל ashdod.muni.il</button>
        <span id="login_status" style="font-weight:700;color:#0b1f33;"></span>
      </div>
      <form id="purchase-form" enctype="multipart/form-data">
        <fieldset>
          <legend>פרטי הבקשה</legend>
          <div class="grid">
            <div class="stack">
              <label for="department">מחלקה מבקשת</label>
              <input id="department" name="department" required placeholder="שם המחלקה" />
            </div>
            <div class="stack">
              <label for="requester_name">שם מבקש/ת הבקשה</label>
              <input id="requester_name" name="requester_name" required placeholder="שם מלא" />
            </div>
            <div class="stack">
              <label for="requester_position">תפקיד</label>
              <input id="requester_position" name="requester_position" placeholder="לא חובה" />
            </div>
          </div>
          <div class="stack">
            <label for="description">תיאור הפריט/שירות המבוקש</label>
            <textarea id="description" name="description" required placeholder="נא לתאר בקצרה את הבקשה"></textarea>
          </div>
          <div class="stack files">
            <label for="spec_file">צרף מפרט טכני מפורט (PDF/Word)</label>
            <input id="spec_file" name="spec_file" type="file" accept=".pdf,.doc,.docx" required />
          </div>
        </fieldset>

        <fieldset>
          <legend>עלויות ורכישות קודמות</legend>
          <div class="grid">
            <div class="stack">
              <label for="estimated_cost">עלות משוערת כוללת (₪)</label>
              <input id="estimated_cost" name="estimated_cost" type="number" min="0" step="0.01" required />
            </div>
            <div class="stack">
              <div class="checkbox-row">
                <input type="checkbox" id="toggle_five_year" />
                <label for="toggle_five_year" style="margin:0;">עלות כוללת ל-5 שנים (אם רלוונטי)</label>
              </div>
              <input id="five_year_cost" name="five_year_cost" type="number" min="0" step="0.01" class="hidden" />
            </div>
          </div>

          <div class="checkbox-row">
            <input type="checkbox" id="prior_purchase" name="prior_purchase" />
            <label for="prior_purchase" style="margin:0;">האם בוצעה רכישה דומה בשנה הנוכחית/הקודמת?</label>
          </div>
          <div class="grid hidden" data-section="prior-purchase-details">
            <div class="stack">
              <label for="prior_purchase_cost">עלות הרכישה הקודמת (₪)</label>
              <input id="prior_purchase_cost" name="prior_purchase_cost" type="number" min="0" step="0.01" />
            </div>
          </div>

          <div class="checkbox-row">
            <input type="checkbox" id="repeat_over_50k" name="repeat_over_50k" />
            <label for="repeat_over_50k" style="margin:0;">האם מדובר ברכישה חוזרת של אותו פריט/שירות בהיקף מעל 50,000₪?</label>
          </div>
          <div class="grid hidden" data-section="repeat-details">
            <div class="stack">
              <label for="last_year_cost">עלות בשנה שעברה (₪)</label>
              <input id="last_year_cost" name="last_year_cost" type="number" min="0" step="0.01" />
            </div>
            <div class="stack">
              <label for="prev_year_cost">עלות לפני שנתיים (₪)</label>
              <input id="prev_year_cost" name="prev_year_cost" type="number" min="0" step="0.01" />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>מכרז קיים</legend>
          <div class="checkbox-row">
            <input type="checkbox" id="using_existing_tender" name="using_existing_tender" />
            <label for="using_existing_tender" style="margin:0;">האם ההליך יתבצע במסגרת מכרז קיים?</label>
          </div>
          <div class="grid hidden" data-section="tender-details">
            <div class="stack">
              <label for="tender_number">מס’ מכרז/הסכם</label>
              <input id="tender_number" name="tender_number" />
            </div>
            <div class="stack">
              <label for="tender_valid_until">תוקף המכרז עד</label>
              <input id="tender_valid_until" name="tender_valid_until" type="date" />
            </div>
          </div>
          <div class="stack hidden" data-section="tender-reason">
            <label for="tender_not_used_reason">סיבה לאי שימוש במכרז קיים</label>
            <textarea id="tender_not_used_reason" name="tender_not_used_reason" placeholder="אם קיים מכרז רלוונטי אך לא נעשה בו שימוש"></textarea>
          </div>
        </fieldset>

        <fieldset>
          <legend>אישורים ותקציב</legend>
          <div class="checkbox-row">
            <input type="checkbox" id="has_electrical_works" name="has_electrical_works" />
            <label for="has_electrical_works" style="margin:0;">האם נדרשות עבודות חשמל/קבלן?</label>
          </div>
          <div class="grid hidden" data-section="engineering-details">
            <div class="stack">
              <label for="engineering_approval_name">שם המאשר (אגף הנדסה/חשמל)</label>
              <input id="engineering_approval_name" name="engineering_approval_name" />
            </div>
            <div class="stack">
              <label for="engineering_approval_date">תאריך אישור</label>
              <input id="engineering_approval_date" name="engineering_approval_date" type="date" />
            </div>
            <div class="stack files">
              <label for="engineering_approval_file">צרף אישור אגף הנדסה/חשמל</label>
              <input id="engineering_approval_file" name="engineering_approval_file" type="file" accept=".pdf,.doc,.docx,image/*" />
            </div>
          </div>

          <div class="grid">
            <div class="stack">
              <label for="budget_account">סעיף תקציבי</label>
              <input id="budget_account" name="budget_account" required />
            </div>
            <div class="stack checkbox-row" style="margin-top:20px;">
              <input type="checkbox" id="cfo_approved" name="cfo_approved" />
              <label for="cfo_approved" style="margin:0;">אישור גזבר מתקבל</label>
            </div>
          </div>

          <div class="stack checkbox-row">
            <input type="checkbox" id="no_additional_engagement" name="no_additional_engagement" checked required />
            <label for="no_additional_engagement" style="margin:0;">אני מאשר/ת שאין התקשרות נוספת מתוכננת</label>
          </div>
          <div class="stack checkbox-row">
            <input type="checkbox" id="all_costs_included" name="all_costs_included" checked required />
            <label for="all_costs_included" style="margin:0;">אני מאשר/ת שכל העלויות נכללו בבקשה</label>
          </div>

          <div class="stack">
            <label for="additional_comments">הערות נוספות</label>
            <textarea id="additional_comments" name="additional_comments" placeholder="הערות או פרטים משלימים"></textarea>
          </div>
        </fieldset>

        <fieldset>
          <legend>חתימה ושליחה</legend>
          <label for="signature_canvas">חתימת מבקש הבקשה: (צייר/י את חתימתך בתוך המסגרת)</label>
          <canvas id="signature_canvas" class="signature"></canvas>
          <div class="actions-row">
            <button type="button" id="clear_signature" style="background:#eef2f7;color:#0b1f33;">נקה חתימה</button>
          </div>
          <button type="submit" style="margin-top:12px;">שלח בקשה</button>
          <div id="status" class="status" role="status"></div>
        </fieldset>
      </form>
    </div>

    <script>
      const form = document.getElementById('purchase-form');
      const statusBox = document.getElementById('status');
      const sections = {
        prior: document.querySelector('[data-section="prior-purchase-details"]'),
        repeat: document.querySelector('[data-section="repeat-details"]'),
        tender: document.querySelector('[data-section="tender-details"]'),
        tenderReason: document.querySelector('[data-section="tender-reason"]'),
        engineering: document.querySelector('[data-section="engineering-details"]'),
        fiveYear: document.getElementById('five_year_cost')
      };

      const signatureCanvas = document.getElementById('signature_canvas');
      const clearButton = document.getElementById('clear_signature');
      const ctx = signatureCanvas.getContext('2d');
      let drawing = false;
      let isSigned = false;

      function resizeCanvas() {
        const rect = signatureCanvas.getBoundingClientRect();
        signatureCanvas.width = rect.width * devicePixelRatio;
        signatureCanvas.height = rect.height * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      function startDraw(event) {
        drawing = true;
        isSigned = true;
        ctx.beginPath();
        const { x, y } = getPos(event);
        ctx.moveTo(x, y);
      }
      function draw(event) {
        if (!drawing) return;
        const { x, y } = getPos(event);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      function endDraw() {
        drawing = false;
      }
      function getPos(event) {
        const rect = signatureCanvas.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      }
      signatureCanvas.addEventListener('mousedown', startDraw);
      signatureCanvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', endDraw);
      signatureCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
      signatureCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
      signatureCanvas.addEventListener('touchend', (e) => { e.preventDefault(); endDraw(); });

      clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        isSigned = false;
      });

      const priorPurchase = document.getElementById('prior_purchase');
      const repeatOver50k = document.getElementById('repeat_over_50k');
      const usingExistingTender = document.getElementById('using_existing_tender');
      const hasElectricalWorks = document.getElementById('has_electrical_works');
      const toggleFiveYear = document.getElementById('toggle_five_year');

      function toggleSection(checkbox, element, requiredFields = []) {
        if (!element) return;
        const show = checkbox.checked;
        element.classList.toggle('hidden', !show);
        requiredFields.forEach((fieldId) => {
          const field = document.getElementById(fieldId);
          if (!field) return;
          field.required = show;
        });
      }

      priorPurchase.addEventListener('change', () => {
        toggleSection(priorPurchase, sections.prior, ['prior_purchase_cost']);
      });
      repeatOver50k.addEventListener('change', () => {
        toggleSection(repeatOver50k, sections.repeat, ['last_year_cost', 'prev_year_cost']);
      });
      usingExistingTender.addEventListener('change', () => {
        toggleSection(usingExistingTender, sections.tender, ['tender_number', 'tender_valid_until']);
        sections.tenderReason.classList.toggle('hidden', usingExistingTender.checked);
      });
      hasElectricalWorks.addEventListener('change', () => {
        toggleSection(hasElectricalWorks, sections.engineering, ['engineering_approval_name']);
      });
      toggleFiveYear.addEventListener('change', () => {
        const show = toggleFiveYear.checked;
        sections.fiveYear.classList.toggle('hidden', !show);
        sections.fiveYear.required = show;
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        statusBox.textContent = 'שולח בקשה...';
        statusBox.classList.add('show');

        if (!isSigned) {
          statusBox.textContent = 'אנא חתום/י לפני שליחה.';
          return;
        }

        const formData = new FormData(form);

        const dataUrl = signatureCanvas.toDataURL('image/png');
        if (dataUrl && dataUrl.length > 30) {
          const blob = await (await fetch(dataUrl)).blob();
          formData.append('signature_canvas', blob, 'signature.png');
        }

        try {
          const res = await fetch('/submit', {
            method: 'POST',
            body: formData
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            statusBox.textContent = data.message || 'הבקשה נשמרה בהצלחה';
            form.reset();
            ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
            isSigned = false;
            Object.values(sections).forEach((el) => {
              if (el && el.classList) el.classList.add('hidden');
            });
          } else {
            statusBox.textContent = data.error || 'שמירת הבקשה נכשלה';
          }
        } catch (err) {
          console.error(err);
          statusBox.textContent = 'שגיאת רשת בעת שליחה';
        }
      });

      // Placeholder login buttons; replace with real auth (e.g., CF Access/OAuth) later.
      const loginAny = document.getElementById('login_any');
      const loginAshdod = document.getElementById('login_ashdod');
      const loginStatus = document.getElementById('login_status');

      loginAny?.addEventListener('click', () => {
        const email = prompt('Enter your email');
        if (email) {
          loginStatus.textContent = 'מחובר כ-' + email;
        }
      });

      loginAshdod?.addEventListener('click', () => {
        const email = prompt('הזן מייל ashdod.muni.il');
        if (!email) return;
        if (!email.toLowerCase().endsWith('@ashdod.muni.il')) {
          alert('נדרש מייל עם סיומת @ashdod.muni.il');
          return;
        }
        loginStatus.textContent = 'מחובר כ-' + email;
      });
    </script>
  </body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const clientId = getClientId(request, url);

    if (isRateLimited(clientId)) {
      return new Response("Too many requests", { status: 429 });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/form")) {
      return new Response(landingPage, {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      return handleAdminList(env, url);
    }

    if (request.method === "GET" && url.pathname === "/_health") {
      return handleHealthCheck(env);
    }

    if (request.method === "POST" && url.pathname === "/submit") {
      if (!passesCsrf(request, url)) {
        return new Response("CSRF validation failed", { status: 403 });
      }
      return handleRequestSubmission(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleHealthCheck(env: Env): Promise<Response> {
  const result: Record<string, unknown> = {
    ok: true,
    d1: "ok",
    r2: "ok",
  };

  try {
    await env.PROCUREMENT_DB.prepare("select 1 as ok").first();
  } catch (err) {
    result.ok = false;
    result.d1 = `error: ${(err as Error).message}`;
  }

  try {
    await env.PROCUREMENT_FILES_BUCKET.list({ limit: 1 });
  } catch (err) {
    result.ok = false;
    result.r2 = `error: ${(err as Error).message}`;
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: result.ok ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
}

async function handleRequestSubmission(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ error: "Expected multipart/form-data" }, 400);
  }

  const formData = await request.formData();
  const requestId = crypto.randomUUID();
  const specFile = getFile(formData, "spec_file");
  const engineeringApprovalFile = getFile(formData, "engineering_approval_file");
  let signatureFile = getFile(formData, "signature_canvas");

  // Fallback: signature sent as data URL string
  if (!signatureFile) {
    const sigDataUrl = stringField(formData.get("signature_canvas"));
    if (sigDataUrl.startsWith("data:")) {
      signatureFile = dataUrlToFile(sigDataUrl, "signature.png");
    }
  }

  const payload = {
    department: stringField(formData.get("department")),
    description: stringField(formData.get("description")),
    estimatedCost: numberField(formData.get("estimated_cost")),
    fiveYearCost: numberField(formData.get("five_year_cost")),
    priorPurchase: boolField(formData.get("prior_purchase")),
    priorPurchaseCost: numberField(formData.get("prior_purchase_cost")),
    repeatOver50k: boolField(formData.get("repeat_over_50k")),
    lastYearCost: numberField(formData.get("last_year_cost")),
    prevYearCost: numberField(formData.get("prev_year_cost")),
    usingExistingTender: boolField(formData.get("using_existing_tender")),
    tenderNumber: stringField(formData.get("tender_number")),
    tenderValidUntil: stringField(formData.get("tender_valid_until")),
    tenderNotUsedReason: stringField(formData.get("tender_not_used_reason")),
    noAdditionalEngagement: boolField(formData.get("no_additional_engagement"), true),
    allCostsIncluded: boolField(formData.get("all_costs_included"), true),
    hasElectricalWorks: boolField(formData.get("has_electrical_works")),
    engineeringApprovalName: stringField(formData.get("engineering_approval_name")),
    engineeringApprovalDate: stringField(formData.get("engineering_approval_date")),
    budgetAccount: stringField(formData.get("budget_account")),
    cfoApproved: boolField(formData.get("cfo_approved")),
    additionalComments: stringField(formData.get("additional_comments")),
    requesterName: stringField(formData.get("requester_name")),
    requesterPosition: stringField(formData.get("requester_position")),
  };

  if (!payload.department || !payload.description || !payload.requesterName || !payload.budgetAccount) {
    return jsonResponse({ error: "שדות חובה חסרים." }, 400);
  }
  if (!payload.estimatedCost && payload.estimatedCost !== 0) {
    return jsonResponse({ error: "נדרש למלא עלות משוערת." }, 400);
  }
  if (!specFile) {
    return jsonResponse({ error: "חובה לצרף מפרט טכני." }, 400);
  }
  if (!signatureFile) {
    return jsonResponse({ error: "חובה לספק חתימה." }, 400);
  }

  // Enforce dependent required fields
  if (payload.priorPurchase && payload.priorPurchaseCost == null) {
    return jsonResponse({ error: "נדרש למלא עלות רכישה קודמת." }, 400);
  }
  if (payload.repeatOver50k && (payload.lastYearCost == null || payload.prevYearCost == null)) {
    return jsonResponse({ error: "נדרש למלא עלויות בשנה שעברה ולפני שנתיים." }, 400);
  }
  if (payload.usingExistingTender && (!payload.tenderNumber || !payload.tenderValidUntil)) {
    return jsonResponse({ error: "נדרש למלא פרטי מכרז ותוקפו." }, 400);
  }
  if (payload.hasElectricalWorks && !payload.engineeringApprovalName) {
    return jsonResponse({ error: "נדרש לציין שם המאשר מאגף הנדסה/חשמל." }, 400);
  }

  try {
    const specFileUrl = await storeSingleFile(env, requestId, specFile, "spec");
    const engineeringFileUrl = engineeringApprovalFile
      ? await storeSingleFile(env, requestId, engineeringApprovalFile, "engineering")
      : null;
    const signatureKey = await storeSingleFile(env, requestId, signatureFile, "signature");

    const insertResult = await env.PROCUREMENT_DB.prepare(
      `
      INSERT INTO Requests (
        department,
        description,
        spec_file_url,
        estimated_cost,
        five_year_cost,
        prior_purchase,
        prior_purchase_cost,
        repeat_over_50k,
        last_year_cost,
        prev_year_cost,
        using_existing_tender,
        tender_number,
        tender_valid_until,
        tender_not_used_reason,
        no_additional_engagement,
        all_costs_included,
        has_electrical_works,
        engineering_approval_name,
        engineering_approval_file_url,
        engineering_approval_date,
        budget_account,
        cfo_approved,
        additional_comments,
        requester_name,
        requester_position,
        signature_image_url,
        submitted_at,
        status
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
        ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28
      );
    `,
    )
      .bind(
        payload.department,
        payload.description,
        specFileUrl,
        payload.estimatedCost,
        payload.fiveYearCost,
        payload.priorPurchase,
        payload.priorPurchaseCost,
        payload.repeatOver50k,
        payload.lastYearCost,
        payload.prevYearCost,
        payload.usingExistingTender,
        payload.tenderNumber || null,
        payload.tenderValidUntil || null,
        payload.tenderNotUsedReason || null,
        payload.noAdditionalEngagement,
        payload.allCostsIncluded,
        payload.hasElectricalWorks,
        payload.engineeringApprovalName || null,
        engineeringFileUrl,
        payload.engineeringApprovalDate || null,
        payload.budgetAccount,
        payload.cfoApproved,
        payload.additionalComments || null,
        payload.requesterName,
        payload.requesterPosition || null,
        signatureKey,
        new Date().toISOString(),
        "pending",
      )
      .run();

    const requestDbId = (insertResult.meta as { last_row_id?: number }).last_row_id ?? null;

    // Store attachment metadata for future auditing/serving
    if (requestDbId !== null) {
      await storeAttachmentMeta(env, requestDbId, "spec", specFile.name || "spec" + requestId, specFileUrl);
      if (engineeringApprovalFile && engineeringFileUrl) {
        await storeAttachmentMeta(
          env,
          requestDbId,
          "engineering",
          engineeringApprovalFile.name || "engineering" + requestId,
          engineeringFileUrl,
        );
      }
      await storeAttachmentMeta(env, requestDbId, "signature", signatureFile.name || "signature" + requestId, signatureKey);
      await logStatusChange(env, requestDbId, null, "pending", "auto-set on submission");
    }

    await sendEmailNotification(env, payload as Record<string, unknown>, requestId);

    return jsonResponse(
      {
        message: "הבקשה נשמרה בהצלחה.",
        requestId,
        specStored: Boolean(specFileUrl),
        signatureStored: Boolean(signatureKey),
      },
      201,
    );
  } catch (err) {
    console.error("Submission failed", err);
    return jsonResponse({ error: (err as Error).message || "Submission failed" }, 500);
  }
}

async function storeSingleFile(
  env: Env,
  requestId: string,
  file: File,
  prefix: string,
): Promise<string> {
  const safeName = sanitizeFilename(file.name || `${prefix}.bin`);
  const key = `requests/${requestId}/${prefix}/${safeName}`;

  await env.PROCUREMENT_FILES_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return key;
}

function getFile(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  if (value instanceof File && value.size > 0) {
    return value;
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function stringField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberField(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function boolField(value: FormDataEntryValue | null, fallback = false): number {
  if (value === null) return fallback ? 1 : 0;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "on" || v === "yes" || v === "true" || v === "1") return 1;
  }
  return 0;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL for signature");
  }
  const [, mime, b64] = match;
  const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new File([buffer], filename, { type: mime || "image/png" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getClientId(request: Request, url: URL): string {
  return request.headers.get("cf-connecting-ip") || url.hostname || "unknown";
}

function isRateLimited(id: string): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(id) || { count: 0, reset: now + rateWindowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + rateWindowMs;
  }
  entry.count += 1;
  rateBuckets.set(id, entry);
  return entry.count > rateLimit;
}

function passesCsrf(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin && safeHost(origin) !== url.host) return false;
  const referer = request.headers.get("referer");
  if (referer && safeHost(referer) !== url.host) return false;
  return true;
}

function safeHost(maybeUrl: string): string | null {
  try {
    return new URL(maybeUrl).host;
  } catch (err) {
    return null;
  }
}

async function storeAttachmentMeta(
  env: Env,
  requestId: number,
  kind: string,
  filename: string,
  storageKey: string,
): Promise<void> {
  await env.PROCUREMENT_DB.prepare(
    `INSERT INTO attachments (request_id, kind, filename, storage_key, uploaded_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'));`,
  )
    .bind(requestId, kind, filename, storageKey)
    .run();
}

async function logStatusChange(
  env: Env,
  requestId: number,
  fromStatus: string | null,
  toStatus: string,
  note: string | null,
): Promise<void> {
  await env.PROCUREMENT_DB.prepare(
    `INSERT INTO status_log (request_id, from_status, to_status, note, created_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'));`,
  )
    .bind(requestId, fromStatus, toStatus, note)
    .run();
}

async function sendEmailNotification(env: Env, payload: Record<string, unknown>, requestId: string): Promise<void> {
  // If email credentials are missing, skip silently to avoid blocking submission.
  if (!env.RESEND_API_KEY) return;
  const to = env.NOTIFY_EMAIL || "";
  const toList = to.split(",").map((t) => t.trim()).filter(Boolean);
  if (!toList.length) return;
  const from = env.FROM_EMAIL || "no-reply@ashdod.muni.il";

  const subject = `בקשה חדשה #${requestId}`;
  const lines = [
    `בקשה חדשה התקבלה.`,
    `מחלקה: ${payload.department ?? ""}`,
    `תיאור: ${payload.description ?? ""}`,
    `עלות: ${payload.estimatedCost ?? ""}`,
    `סטטוס: pending`,
  ];

  const bodyText = lines.join("\n");
  const bodyHtml = `<p>בקשה חדשה התקבלה.</p><ul>
    <li><strong>מחלקה:</strong> ${escapeHtml(String(payload.department ?? ""))}</li>
    <li><strong>תיאור:</strong> ${escapeHtml(String(payload.description ?? ""))}</li>
    <li><strong>עלות:</strong> ${escapeHtml(String(payload.estimatedCost ?? ""))}</li>
    <li><strong>סטטוס:</strong> pending</li>
    <li><strong>מזהה:</strong> ${escapeHtml(requestId)}</li>
  </ul>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: toList,
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });
  } catch (err) {
    // Non-blocking; log and continue.
    console.error("Failed to send email", err);
  }
}

async function handleAdminList(env: Env, url: URL): Promise<Response> {
  // TODO: replace with proper auth (e.g., Cloudflare Access/JWT/mTLS). Simple token check for now.
  const adminToken = url.searchParams.get("adminToken");
  const expected = env.ADMIN_TOKEN || "demo-admin-token";
  if (!adminToken || adminToken !== expected) {
    return new Response("גישה נדחתה (נדרש טוקן ניהול).", { status: 403 });
  }

  const { results, error } = await env.PROCUREMENT_DB.prepare(
    `SELECT id, department, description, submitted_at, status
     FROM Requests
     ORDER BY submitted_at DESC
     LIMIT 20;`,
  ).all();

  if (error) {
    return new Response("שגיאה בטעינת נתונים: " + error, { status: 500 });
  }

  const rows = (results as Array<Record<string, unknown>>).map((row) => {
    const id = row.id ?? "";
    const dept = row.department ?? "";
    const desc = row.description ?? "";
    const date = row.submitted_at ?? "";
    const status = row.status ?? "";
    return `<tr>
      <td>${escapeHtml(String(id))}</td>
      <td>${escapeHtml(String(dept))}</td>
      <td>${escapeHtml(String(desc))}</td>
      <td>${escapeHtml(String(date))}</td>
      <td>${escapeHtml(String(status))}</td>
    </tr>`;
  }).join("");

  const adminPage = `<!doctype html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>רשימת בקשות</title>
      <style>
        body { font-family: "Assistant", "Alef", "Segoe UI", system-ui, sans-serif; background: #f6f8fb; margin: 0; padding: 24px; }
        h1 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
        th, td { padding: 12px 14px; border-bottom: 1px solid #e1e7ef; text-align: right; }
        th { background: #0f5bd7; color: #fff; font-weight: 800; }
        tr:last-child td { border-bottom: none; }
        .notice { margin-bottom: 16px; color: #475569; }
      </style>
    </head>
    <body>
      <h1>רשימת בקשות אחרונות</h1>
      <div class="notice">לתצוגה בלבד. יש להוסיף אימות מלא (למשל Cloudflare Access / JWT) לפני חשיפה.</div>
      <table>
        <thead>
          <tr>
            <th>מזהה</th>
            <th>מחלקה</th>
            <th>תיאור</th>
            <th>תאריך הגשה</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5">אין נתונים</td></tr>'}
        </tbody>
      </table>
    </body>
  </html>`;

  return new Response(adminPage, { headers: { "content-type": "text/html; charset=UTF-8" } });
}
