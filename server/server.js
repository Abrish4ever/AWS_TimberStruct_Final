// =============================================================
//  TimberStruct — Express REST API  v4.0
//  Port     : 4000
//  Database : MySQL timber-db
//
//  PROCUREMENT FASTENER ROUTES (4 categories only):
//    GET    /api/procurement/stats           KPI totals
//    GET    /api/procurement/orders          list orders
//    GET    /api/procurement/orders/:id      single order
//    POST   /api/procurement/orders          create one order
//    POST   /api/procurement/orders/bulk     create multiple orders
//    PUT    /api/procurement/orders/:id      update order
//    DELETE /api/procurement/orders/:id      delete order
//    POST   /api/procurement/rfq             dispatch RFQ to suppliers
//    GET    /api/procurement/rfq             list RFQ dispatches
//    PUT    /api/procurement/rfq/:id         update RFQ status
//    GET    /api/procurement/fasteners       get EC5 fastener schedule
//    POST   /api/procurement/fasteners       save fastener schedule
// =============================================================
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { qry, exec, testConnection } = require('./db');

const app        = express();
const PORT       = process.env.PORT       || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'timberstruct-secret-2025';

// ─── Email transporter (Nodemailer) ──────────────────────────
// Uses Gmail App Password. Set MAIL_USER + MAIL_PASS in .env
// Transport is created immediately — no verify() gate that blocks first send.

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT || 587),
  secure: false,   // STARTTLS on port 587
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
  tls: {
    rejectUnauthorized: false,  // allow self-signed certs in dev
  },
});

// Log SMTP config on startup (never crashes server)
if (process.env.MAIL_USER) {
  console.log(`📧  SMTP configured → ${process.env.MAIL_USER} via ${process.env.MAIL_HOST || 'smtp.gmail.com'}`);
} else {
  console.info('ℹ️   SMTP: set MAIL_USER + MAIL_PASS in .env to enable emails');
}

/**
 * Build the RFQ email body and send it to a supplier.
 * Never throws — logs and resolves false on failure.
 */
async function sendRFQEmail({ supplier, orders, deadline, message, deliveryAddr, dispatchedBy }) {
  // Skip silently only if no email address or no credentials configured
  if (!supplier.email)            { console.warn('[email] no supplier email — skipped'); return false; }
  if (!process.env.MAIL_USER)     { console.info('[email] MAIL_USER not set — skipped');  return false; }

  const totalEst = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);

  // Build items table rows
  const itemRows = orders.map(o => `
    <tr style="border-bottom:1px solid #e5e5e5;">
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#111;">${o.item_name || '—'}</td>
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#888;text-align:center;">${o.fastener_type_cat || '—'}</td>
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#555;text-align:center;">${o.diameter_mm || '—'} ${o.length_mm_val ? '× ' + o.length_mm_val : ''}</td>
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#555;text-align:center;">${o.grade_spec || '—'}</td>
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-align:right;color:#111;">${Number(o.quantity || 0).toLocaleString()} ${o.unit || 'pcs'}</td>
      <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-align:right;color:#C8861A;">KES ${Number(o.total_price || 0).toLocaleString()}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0E0E0E;">
    <tr><td style="padding:24px 40px;">
      <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:2px;color:#fff;">TIMBER</span>
      <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:2px;color:#C8861A;">STRUCT</span>
      <p style="margin:4px 0 0;font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;">
        Timber Engineering Platform · East Africa
      </p>
    </td></tr>
  </table>

  <!-- Amber band -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#C8861A;">
    <tr><td style="padding:12px 40px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fff;">
        REQUEST FOR QUOTATION
      </span>
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:36px 40px 0;">

      <p style="font-size:15px;color:#111;margin:0 0 8px;">
        Dear <strong>${supplier.contact || supplier.name}</strong>,
      </p>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
        TimberStruct requests your competitive quotation for the fastener items listed below.
        ${message ? `<br/><br/><em style="color:#333;">"${message}"</em>` : ''}
      </p>

      <!-- Details bar -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f6f2;border:1px solid #e5e5e5;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:14px 20px;border-right:1px solid #e5e5e5;">
            <p style="margin:0;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Quote Deadline</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111;">${deadline || 'As soon as possible'}</p>
          </td>
          <td style="padding:14px 20px;border-right:1px solid #e5e5e5;">
            <p style="margin:0;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Delivery Address</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111;">${deliveryAddr || 'To be confirmed'}</p>
          </td>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Requested By</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111;">${dispatchedBy}</p>
          </td>
        </tr>
      </table>

      <!-- Items table -->
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin:0 0 8px;">
        Fastener Schedule
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <thead>
          <tr style="background:#0E0E0E;">
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C8861A;text-align:left;">Item</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;text-align:center;">Type</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;text-align:center;">Spec</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;text-align:center;">Grade</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;text-align:right;">Qty</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;text-align:right;">Est. Value</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#f8f6f2;border-top:2px solid #C8861A;">
            <td colspan="4" style="padding:12px 14px;font-size:13px;color:#555;">
              ${orders.length} line item${orders.length !== 1 ? 's' : ''}
            </td>
            <td colspan="2" style="padding:12px 14px;text-align:right;">
              <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Total Est.&nbsp;&nbsp;</span>
              <span style="font-size:17px;font-weight:900;color:#C8861A;">KES ${totalEst.toLocaleString()}</span>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Reply CTA -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#FFF8ED;border:1px solid rgba(200,134,26,0.3);border-radius:8px;margin-bottom:32px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
            Please reply to this email with your best prices, lead times and payment terms.
            Quote reference: <strong>RFQ-${Date.now().toString().slice(-6)}</strong>
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0E0E0E;margin-top:40px;">
    <tr><td style="padding:20px 40px;">
      <p style="margin:0;font-size:11px;color:#555;line-height:1.6;">
        TimberStruct · Nairobi, Kenya · info@timberstruct.co.ke<br/>
        This is an automated RFQ from the TimberStruct procurement platform.
      </p>
    </td></tr>
  </table>

</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from:    process.env.MAIL_FROM || `"TimberStruct" <${process.env.MAIL_USER}>`,
      to:      `"${supplier.contact || supplier.name}" <${supplier.email}>`,
      subject: `RFQ from TimberStruct — ${orders.length} fastener item${orders.length !== 1 ? 's' : ''} (please quote)`,
      html,
    });
    console.log(`✅ [email] RFQ sent → ${supplier.email}  messageId: ${info.messageId}`);
    return true;
  } catch (e) {
    console.error(`❌ [email] Failed → ${supplier.email}: ${e.message}`);
    return false;
  }
}

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// ─── Auth middleware ─────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ─── Response helpers ─────────────────────────────────────────
const ok   = (res, data)    => res.json({ success: true, data, error: null });
const fail = (res, code, e) => res.status(code).json({ success: false, data: null, error: e });

// ─── Valid values ────────────────────────────────────────────
const VALID_CATS   = ['screws','bolts','nails','hangers'];
const VALID_STATUS = ['rfq','quoted','in_transit','delivered','pending','cancelled'];

// =============================================================
//  HEALTH
// =============================================================
app.get('/api/ping', (_q, r) => r.json({ ok:true, time:new Date().toISOString() }));

app.get('/api/health', async (_q, res) => {
  try {
    const [r] = await qry('SELECT COUNT(*) AS n FROM users');
    ok(res, { status:'ok', users:r.n });
  } catch(e){ fail(res,500,e.message); }
});

app.get('/api/test', async (_q, res) => {
  try {
    const rows = await qry('SELECT id,name,email,role FROM users');
    ok(res, { status:'MySQL connected', users:rows });
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  AUTH
// =============================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'Email and password are required');
    const users = await qry('SELECT * FROM users WHERE LOWER(email)=LOWER(?)', [email.trim()]);
    if (!users.length) return fail(res, 401, 'No account found with that email');
    const user = users[0];
    if (!await bcrypt.compare(password, user.password)) return fail(res, 401, 'Incorrect password');
    const token = jwt.sign({ id:user.id, email:user.email, role:user.role, name:user.name }, JWT_SECRET, { expiresIn:'7d' });
    console.log(`[auth] login: ${user.email}`);
    ok(res, { token, user:{ id:user.id, name:user.name, email:user.email, role:user.role } });
  } catch(e){ console.error(e); fail(res,500,'Login error'); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone=null, company=null } = req.body;
    if (!name||!email||!password) return fail(res,400,'Name, email and password are required');
    if (password.length<6)        return fail(res,400,'Password must be at least 6 characters');
    const ex = await qry('SELECT id FROM users WHERE LOWER(email)=LOWER(?)',[email.trim()]);
    if (ex.length) return fail(res,400,'An account with this email already exists');
    const hash = await bcrypt.hash(password, 10);
    const r    = await exec('INSERT INTO users (name,email,password,role,phone,company) VALUES (?,?,?,?,?,?)',
      [name.trim(), email.trim().toLowerCase(), hash, 'client', phone, company]);
    const token = jwt.sign({ id:r.insertId, email:email.toLowerCase(), role:'client', name:name.trim() }, JWT_SECRET, { expiresIn:'7d' });
    console.log(`[auth] register: ${email}`);
    res.status(201).json({ success:true, token, user:{ id:r.insertId, name:name.trim(), email:email.toLowerCase(), role:'client' } });
  } catch(e){ console.error(e); fail(res,500,'Registration error'); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const u = await qry('SELECT id,name,email,role,phone,company,created_at FROM users WHERE id=?',[req.user.id]);
    if (!u.length) return fail(res,404,'User not found');
    ok(res, u[0]);
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  DASHBOARD
// =============================================================
app.get('/api/dashboard/stats', auth, async (req, res) => {
  try {
    const [projects, orders, events, appts] = await Promise.all([
      qry('SELECT * FROM projects'),
      qry('SELECT * FROM procurement_orders'),
      qry('SELECT e.*,p.name AS project_name FROM events e LEFT JOIN projects p ON e.project_id=p.id ORDER BY e.created_at DESC LIMIT 10'),
      qry("SELECT * FROM appointments WHERE status='pending'"),
    ]);
    const by = s => projects.filter(p=>p.status===s).length;
    ok(res,{
      totalProjects:projects.length,
      activeProjects:projects.filter(p=>p.status!=='completed').length,
      totalBudget:projects.reduce((s,p)=>s+Number(p.budget||0),0),
      totalSpent:projects.reduce((s,p)=>s+Number(p.spent||0),0),
      pendingOrders:orders.filter(o=>['rfq','in_transit'].includes(o.status)).length,
      deliveredOrders:orders.filter(o=>o.status==='delivered').length,
      pendingAppointments:appts.length,
      recentEvents:events,
      projectsByStatus:{ design:by('design'),rfq:by('rfq'),procurement:by('procurement'),completed:by('completed') },
    });
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  PROJECTS
// =============================================================
app.get('/api/projects', auth, async (req, res) => {
  try { ok(res, await qry('SELECT p.*,u.name AS engineer_name FROM projects p LEFT JOIN users u ON p.engineer_id=u.id ORDER BY p.created_at DESC')); }
  catch(e){ fail(res,500,e.message); }
});
app.get('/api/projects/:id', auth, async (req, res) => {
  try {
    const id=req.params.id;
    const [projects,members,orders,events] = await Promise.all([
      qry('SELECT p.*,u.name AS engineer_name FROM projects p LEFT JOIN users u ON p.engineer_id=u.id WHERE p.id=?',[id]),
      qry('SELECT * FROM structural_members WHERE project_id=? ORDER BY id',[id]),
      qry('SELECT * FROM procurement_orders WHERE project_id=? ORDER BY id',[id]),
      qry('SELECT * FROM events WHERE project_id=? ORDER BY created_at DESC',[id]),
    ]);
    if (!projects.length) return fail(res,404,'Project not found');
    ok(res,{...projects[0],members,orders,events});
  } catch(e){ fail(res,500,e.message); }
});
app.post('/api/projects', auth, async (req, res) => {
  try {
    const {name,client,type,status='design',span_m,load_kn,timber_grade='C24',budget=0,start_date,end_date,location,description}=req.body;
    const {insertId}=await exec(
      'INSERT INTO projects (name,client,type,status,span_m,load_kn,timber_grade,budget,start_date,end_date,location,description,engineer_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [name,client,type,status,span_m||null,load_kn||null,timber_grade,budget,start_date||null,end_date||null,location||null,description||null,req.user.id]
    );
    await exec('INSERT INTO events (project_id,user_id,type,message,severity) VALUES (?,?,?,?,?)',[insertId,req.user.id,'project_created',`Project "${name}" created`,'info']);
    res.status(201); ok(res,{id:insertId,name,client,type,status});
  } catch(e){ fail(res,500,e.message); }
});
app.put('/api/projects/:id', auth, async (req, res) => {
  try {
    const{name,client,type,status,span_m,load_kn,timber_grade,budget,spent,progress,start_date,end_date,location,description}=req.body;
    await exec('UPDATE projects SET name=?,client=?,type=?,status=?,span_m=?,load_kn=?,timber_grade=?,budget=?,spent=?,progress=?,start_date=?,end_date=?,location=?,description=? WHERE id=?',
      [name,client,type,status,span_m,load_kn,timber_grade,budget,spent,progress,start_date,end_date,location,description,req.params.id]);
    ok(res,{success:true});
  } catch(e){ fail(res,500,e.message); }
});
app.delete('/api/projects/:id', auth, async (req, res) => {
  try { await exec('DELETE FROM projects WHERE id=?',[req.params.id]); ok(res,{success:true}); }
  catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  STRUCTURAL MEMBERS
// =============================================================
app.get('/api/projects/:id/members', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM structural_members WHERE project_id=?',[req.params.id])); }
  catch(e){ fail(res,500,e.message); }
});
app.post('/api/projects/:id/members', auth, async (req, res) => {
  try {
    const{type,length_mm,width_mm,depth_mm,quantity=1,grade,load_kn,slenderness_ratio,utilisation_pct,status='pending',notes}=req.body;
    const{insertId}=await exec(
      'INSERT INTO structural_members (project_id,type,length_mm,width_mm,depth_mm,quantity,grade,load_kn,slenderness_ratio,utilisation_pct,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.params.id,type,length_mm,width_mm,depth_mm,quantity,grade,load_kn,slenderness_ratio,utilisation_pct,status,notes||null]
    );
    res.status(201); ok(res,{id:insertId});
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  STRUCTURAL DESIGNS
// =============================================================
app.post('/api/designs', auth, async (req, res) => {
  try {
    const{project_name,client,location,engineer,reference,notes,structure_type='truss',
          service_class='1',load_duration='medium_term',span_mm,height_mm,pitch_deg,
          dead_load,live_load,wind_load,snow_load,gov_load,status='analysed',members=[]}=req.body;
    if(!project_name) return fail(res,400,'project_name is required');
    const{insertId:did}=await exec(
      'INSERT INTO structural_designs (user_id,project_name,client,location,engineer,reference,notes,structure_type,service_class,load_duration,span_mm,height_mm,pitch_deg,dead_load,live_load,wind_load,snow_load,gov_load,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id,project_name,client||null,location||null,engineer||null,reference||null,notes||null,
       structure_type,service_class,load_duration,span_mm||null,height_mm||null,pitch_deg||null,
       dead_load||null,live_load||null,wind_load||null,snow_load||null,gov_load||null,status]
    );
    for(const m of members){
      await exec(
        'INSERT INTO design_members (design_id,label,member_type,width_mm,depth_mm,length_mm,grade,design_load_kn,quantity,capacity_kn,utilisation_pct,lambda,lambda_rel,kc,moment_knm,stress_nmm2,defl_inst_mm,defl_fin_mm,defl_limit_mm,weight_kg,ec5_pass,ec5_warning) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [did,m.label||'Member',m.type==='strut'||m.type==='post'?'strut':'rafter',
         m.width||47,m.depth||200,m.length||6000,m.grade||'C24',m.load||3.5,m.qty||1,
         m.capacity||null,m.utilisation||null,m.lambda||null,m.lambdaRel||null,m.kc||null,
         m.moment||null,m.stress||null,m.deflection_inst||null,m.deflection_fin||null,m.lim_fin||null,
         m.weight||null,m.pass!=null?(m.pass?1:0):null,m.warning!=null?(m.warning?1:0):null]
      );
    }
    res.status(201); ok(res,{id:did,project_name,members_count:members.length});
  } catch(e){ console.error(e); fail(res,500,e.message); }
});
app.get('/api/designs', auth, async (req, res) => {
  try {
    ok(res, await qry('SELECT id,project_name,client,location,status,structure_type,span_mm,gov_load,created_at,updated_at FROM structural_designs WHERE user_id=? ORDER BY updated_at DESC',[req.user.id]));
  } catch(e){ fail(res,500,e.message); }
});
app.get('/api/designs/:id', auth, async (req, res) => {
  try {
    const d=await qry('SELECT * FROM structural_designs WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
    if(!d.length) return fail(res,404,'Design not found');
    const[members,fasteners]=await Promise.all([
      qry('SELECT * FROM design_members WHERE design_id=? ORDER BY id',[req.params.id]),
      qry('SELECT * FROM fastener_schedules WHERE design_id=? ORDER BY id',[req.params.id]),
    ]);
    ok(res,{...d[0],members,fasteners});
  } catch(e){ fail(res,500,e.message); }
});
app.put('/api/designs/:id', auth, async (req, res) => {
  try {
    await exec('UPDATE structural_designs SET status=?,notes=? WHERE id=? AND user_id=?',
      [req.body.status,req.body.notes||null,req.params.id,req.user.id]);
    ok(res,{success:true});
  } catch(e){ fail(res,500,e.message); }
});
app.delete('/api/designs/:id', auth, async (req, res) => {
  try {
    await exec('DELETE FROM structural_designs WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
    ok(res,{success:true});
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  PROCUREMENT — FASTENER SCHEDULES
// =============================================================
// GET /api/procurement/fasteners?design_id=1
app.get('/api/procurement/fasteners', auth, async (req, res) => {
  try {
    const{design_id}=req.query;
    if(design_id){
      return ok(res, await qry('SELECT * FROM fastener_schedules WHERE design_id=? ORDER BY id',[design_id]));
    }
    // latest design for this user
    const d=await qry('SELECT id FROM structural_designs WHERE user_id=? ORDER BY updated_at DESC LIMIT 1',[req.user.id]);
    if(!d.length) return ok(res,[]);
    ok(res, await qry('SELECT * FROM fastener_schedules WHERE design_id=? ORDER BY id',[d[0].id]));
  } catch(e){ fail(res,500,e.message); }
});

// POST /api/procurement/fasteners — save fastener schedule
app.post('/api/procurement/fasteners', auth, async (req, res) => {
  try {
    const{design_id, fasteners=[]}=req.body;
    if(!design_id) return fail(res,400,'design_id is required');
    await exec('DELETE FROM fastener_schedules WHERE design_id=?',[design_id]);
    let saved=0;
    for(const f of fasteners){
      if(!VALID_CATS.includes(f.cat)) continue;
      await exec(
        'INSERT INTO fastener_schedules (design_id,fastener_type,diameter,length,grade_spec,mto_qty,unit,unit_cost_kes,total_cost_kes,used_in,description,ordered) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)',
        [design_id,f.item||f.name,f.diameter||null,f.length||null,f.grade||null,
         f.qty||0,f.unit||'pcs',f.unit_cost||null,f.total||null,f.used_in||null,f.ec5||null]
      );
      saved++;
    }
    ok(res,{saved});
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  PROCUREMENT — STATS
// =============================================================
app.get('/api/procurement/stats', auth, async (req, res) => {
  try {
    const orders=await qry(
      "SELECT * FROM procurement_orders WHERE user_id=? AND item_type IN ('fastener','connector')",
      [req.user.id]
    );
    const by  = s => orders.filter(o=>o.status===s);
    const byC = c => orders.filter(o=>o.fastener_type_cat===c);
    const sum = a => a.reduce((s,o)=>s+Number(o.total_price||0),0);
    ok(res,{
      total_orders:   orders.length,
      total_value:    sum(orders),
      delivered_value:sum(by('delivered')),
      rfq_count:      by('rfq').length,
      quoted_count:   by('quoted').length,
      in_transit:     by('in_transit').length,
      delivered:      by('delivered').length,
      by_category:{
        screws:  {count:byC('screws').length,  value:sum(byC('screws'))  },
        bolts:   {count:byC('bolts').length,   value:sum(byC('bolts'))   },
        nails:   {count:byC('nails').length,   value:sum(byC('nails'))   },
        hangers: {count:byC('hangers').length, value:sum(byC('hangers')) },
      },
    });
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  PROCUREMENT — ORDERS
// =============================================================

// GET /api/procurement/orders?cat=bolts&status=rfq&source=structural
app.get('/api/procurement/orders', auth, async (req, res) => {
  try {
    const{cat,status,source,limit=100}=req.query;
    let sql=`SELECT o.*,s.email AS supplier_email,s.phone AS supplier_phone,s.lead_days
             FROM procurement_orders o
             LEFT JOIN suppliers s ON s.name=o.supplier
             WHERE o.user_id=? AND o.item_type IN ('fastener','connector')`;
    const params=[req.user.id];
    if(cat    && VALID_CATS.includes(cat))   { sql+=' AND o.fastener_type_cat=?'; params.push(cat); }
    if(status && VALID_STATUS.includes(status)){ sql+=' AND o.status=?';          params.push(status); }
    if(source && ['structural','manual','file_upload'].includes(source)){ sql+=' AND o.source=?'; params.push(source); }
    sql+=' ORDER BY o.created_at DESC LIMIT ?';
    params.push(Number(limit));
    ok(res, await qry(sql,params));
  } catch(e){ fail(res,500,e.message); }
});

// GET /api/procurement/orders/:id
app.get('/api/procurement/orders/:id', auth, async (req, res) => {
  try {
    const rows=await qry(
      `SELECT o.*,s.email AS supplier_email,s.phone AS supplier_phone,s.lead_days
       FROM procurement_orders o LEFT JOIN suppliers s ON s.name=o.supplier
       WHERE o.id=? AND o.user_id=?`,
      [req.params.id,req.user.id]
    );
    if(!rows.length) return fail(res,404,'Order not found');
    ok(res,rows[0]);
  } catch(e){ fail(res,500,e.message); }
});

// POST /api/procurement/orders — single order
app.post('/api/procurement/orders', auth, async (req, res) => {
  try {
    const{supplier,cat,item,diameter,length,grade,qty,unit='pcs',
          unit_cost,total,used_in,source='manual',design_id=null,
          req_date=null,delivery_addr=null,notes=null}=req.body;
    if(!supplier)               return fail(res,400,'supplier is required');
    if(!item)                   return fail(res,400,'item is required');
    if(!VALID_CATS.includes(cat)) return fail(res,400,`cat must be one of: ${VALID_CATS.join(', ')}`);
    if(!qty||qty<=0)            return fail(res,400,'qty must be a positive number');
    const tot=total||(Number(qty)*Number(unit_cost||0));
    const{insertId}=await exec(
      `INSERT INTO procurement_orders
         (user_id,design_id,supplier,item_name,item_type,fastener_type,fastener_type_cat,
          diameter_mm,length_mm_val,grade_spec,used_in,quantity,unit,unit_price,total_price,
          status,source,order_date,required_date,delivery_addr,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'rfq',?,CURDATE(),?,?,?)`,
      [req.user.id,design_id,supplier,item,'fastener',item,cat,
       diameter||null,length||null,grade||null,used_in||null,qty,unit,unit_cost||null,tot,
       source,req_date||null,delivery_addr||null,notes||null]
    );
    if(design_id&&source==='structural'){
      await exec('UPDATE fastener_schedules SET ordered=1,order_id=? WHERE design_id=? AND fastener_type=?',
        [insertId,design_id,item]);
    }
    console.log(`[order] created: ${item} (${cat}) ×${qty} → ${supplier}`);
    res.status(201); ok(res,{id:insertId,item,cat,qty,supplier,status:'rfq'});
  } catch(e){ console.error(e); fail(res,500,e.message); }
});

// POST /api/procurement/orders/bulk
app.post('/api/procurement/orders/bulk', auth, async (req, res) => {
  try {
    const{orders=[],supplier,req_date=null,delivery_addr=null}=req.body;
    if(!orders.length) return fail(res,400,'orders array is empty');
    if(!supplier)      return fail(res,400,'supplier is required');
    const bad=orders.find(o=>!VALID_CATS.includes(o.cat));
    if(bad) return fail(res,400,`Invalid category "${bad.cat}". Use: ${VALID_CATS.join(', ')}`);
    const created=[];
    for(const o of orders){
      if(!o.item||!o.qty) continue;
      const tot=o.total||(Number(o.qty)*Number(o.unit_cost||0));
      const{insertId}=await exec(
        `INSERT INTO procurement_orders
           (user_id,design_id,supplier,item_name,item_type,fastener_type,fastener_type_cat,
            diameter_mm,length_mm_val,grade_spec,used_in,quantity,unit,unit_price,total_price,
            status,source,order_date,required_date,delivery_addr,notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'rfq',?,CURDATE(),?,?,?)`,
        [req.user.id,o.design_id||null,supplier,o.item,'fastener',o.item,o.cat,
         o.diameter||null,o.length||null,o.grade||null,o.used_in||null,o.qty,o.unit||'pcs',
         o.unit_cost||null,tot,o.source||'manual',req_date||null,delivery_addr||null,o.notes||null]
      );
      if(o.design_id&&o.source==='structural'){
        await exec('UPDATE fastener_schedules SET ordered=1,order_id=? WHERE design_id=? AND fastener_type=?',
          [insertId,o.design_id,o.item]);
      }
      created.push({id:insertId,item:o.item,cat:o.cat});
    }
    console.log(`[order] bulk: ${created.length} orders → ${supplier}`);
    res.status(201); ok(res,{created_count:created.length,orders:created});
  } catch(e){ console.error(e); fail(res,500,e.message); }
});

// PUT /api/procurement/orders/:id
app.put('/api/procurement/orders/:id', auth, async (req, res) => {
  try {
    const{status,delivery_date,notes,supplier,qty,unit_cost,required_date,delivery_addr}=req.body;
    if(status&&!VALID_STATUS.includes(status))
      return fail(res,400,`status must be one of: ${VALID_STATUS.join(', ')}`);
    await exec(
      `UPDATE procurement_orders
         SET status        = COALESCE(?,status),
             delivery_date = COALESCE(?,delivery_date),
             notes         = COALESCE(?,notes),
             supplier      = COALESCE(?,supplier),
             quantity      = COALESCE(?,quantity),
             unit_price    = COALESCE(?,unit_price),
             required_date = COALESCE(?,required_date),
             delivery_addr = COALESCE(?,delivery_addr)
       WHERE id=? AND user_id=?`,
      [status||null,delivery_date||null,notes||null,supplier||null,
       qty||null,unit_cost||null,required_date||null,delivery_addr||null,
       req.params.id,req.user.id]
    );
    ok(res,{success:true});
  } catch(e){ fail(res,500,e.message); }
});

// DELETE /api/procurement/orders/:id
// Permanently deletes the order from the database.
// Only the owner (user_id match) can delete their own orders.
app.delete('/api/procurement/orders/:id', auth, async (req, res) => {
  try {
    const orderId = req.params.id;

    // Fetch the order first so we can log what was deleted
    const rows = await qry(
      'SELECT * FROM procurement_orders WHERE id=? AND user_id=?',
      [orderId, req.user.id]
    );
    if (!rows.length) return fail(res, 404, 'Order not found or you do not have permission to delete it');

    const order = rows[0];

    // Prevent deleting an order that is already in_transit or delivered
    if (['in_transit', 'delivered'].includes(order.status)) {
      return fail(res, 409, `Cannot delete an order with status "${order.status}". Update the status to cancelled first.`);
    }

    // If this order came from a structural design, un-mark the fastener schedule
    if (order.design_id && order.source === 'structural') {
      await exec(
        'UPDATE fastener_schedules SET ordered=0, order_id=NULL WHERE order_id=?',
        [orderId]
      );
    }

    // Delete from database
    await exec('DELETE FROM procurement_orders WHERE id=? AND user_id=?', [orderId, req.user.id]);

    console.log(`[order] deleted: id=${orderId} item="${order.item_name}" by user=${req.user.id}`);
    ok(res, { success: true, deleted: { id: order.id, item: order.item_name, supplier: order.supplier } });
  } catch (e) { console.error(e); fail(res, 500, e.message); }
});

// =============================================================
//  PROCUREMENT — RFQ DISPATCH
//  POST /api/procurement/rfq
//  Always dispatches ALL selected orders to ALL selected suppliers.
//  Multiple dispatch is fully allowed — no 409 blocking.
//  Sends branded HTML email to each supplier via Nodemailer.
//  Marks all dispatched orders status='rfq' in the DB.
// =============================================================
app.post('/api/procurement/rfq', auth, async (req, res) => {
  try {
    const {
      supplier_ids  = [],
      order_ids     = [],
      deadline      = null,
      message       = null,
      delivery_addr = null,
    } = req.body;

    if (!supplier_ids.length) return fail(res, 400, 'supplier_ids is required');
    if (!order_ids.length)    return fail(res, 400, 'order_ids is required');

    // ── 1. Verify all orders belong to this user ──────────────
    const owned = await qry(
      `SELECT * FROM procurement_orders
       WHERE id IN (${order_ids.map(() => '?').join(',')}) AND user_id=?`,
      [...order_ids, req.user.id]
    );
    if (owned.length !== order_ids.length)
      return fail(res, 403, 'Some order IDs are invalid or do not belong to you');

    // ── 2. Fetch suppliers ────────────────────────────────────
    const supps = await qry(
      `SELECT * FROM suppliers WHERE id IN (${supplier_ids.map(() => '?').join(',')})`,
      supplier_ids
    );
    if (!supps.length) return fail(res, 404, 'No matching suppliers found');

    // ── 3. For each supplier: insert RFQ record + send email ──
    const dispatched    = [];
    const emailResults  = [];

    for (const s of supps) {
      const { insertId } = await exec(
        `INSERT INTO rfq_dispatches
           (user_id, supplier_id, supplier_name, order_ids, deadline, message, delivery_addr, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'sent')`,
        [
          req.user.id, s.id, s.name,
          JSON.stringify(owned.map(o => o.id)),
          deadline || null, message || null, delivery_addr || null,
        ]
      );

      // Send email — non-blocking, failure does not abort the dispatch
      const emailSent = await sendRFQEmail({
        supplier:     s,
        orders:       owned,
        deadline,
        message,
        deliveryAddr: delivery_addr,
        dispatchedBy: req.user.name || req.user.email,
      });

      dispatched.push({ rfq_id: insertId, supplier: s.name, email_sent: emailSent });
      emailResults.push({ supplier: s.name, email: s.email, sent: emailSent });
    }

    // ── 4. Mark all orders as 'rfq' ──────────────────────────
    await exec(
      `UPDATE procurement_orders
       SET status = 'rfq'
       WHERE id IN (${owned.map(() => '?').join(',')}) AND user_id = ?`,
      [...owned.map(o => o.id), req.user.id]
    );

    console.log(`[rfq] dispatched to ${dispatched.length} supplier(s), ${owned.length} order(s) → status=rfq`);

    ok(res, {
      dispatched_count: dispatched.length,
      orders_count:     owned.length,
      dispatches:       dispatched,
      email_results:    emailResults,
    });
  } catch (e) { console.error(e); fail(res, 500, e.message); }
});

// GET /api/procurement/rfq
app.get('/api/procurement/rfq', auth, async (req, res) => {
  try {
    ok(res, await qry(
      `SELECT r.*,s.email AS supplier_email,s.phone AS supplier_phone,s.lead_days
       FROM rfq_dispatches r LEFT JOIN suppliers s ON s.id=r.supplier_id
       WHERE r.user_id=? ORDER BY r.sent_at DESC`,
      [req.user.id]
    ));
  } catch(e){ fail(res,500,e.message); }
});

// PUT /api/procurement/rfq/:id
app.put('/api/procurement/rfq/:id', auth, async (req, res) => {
  try {
    const{status,quote_value,notes}=req.body;
    await exec(
      `UPDATE rfq_dispatches
         SET status=COALESCE(?,status),
             quote_value=COALESCE(?,quote_value),
             notes=COALESCE(?,notes),
             quoted_at=IF(?='quoted',NOW(),quoted_at)
       WHERE id=? AND user_id=?`,
      [status||null,quote_value||null,notes||null,status,req.params.id,req.user.id]
    );
    ok(res,{success:true});
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  SUPPLIERS
// =============================================================
app.get('/api/suppliers', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM suppliers WHERE active=1 ORDER BY rating DESC')); }
  catch(e){ fail(res,500,e.message); }
});
app.post('/api/suppliers', auth, async (req, res) => {
  try {
    const{name,region,rating=4.0,lead_days=7,speciality,contact,email,phone,items_supplied}=req.body;
    const{insertId}=await exec(
      'INSERT INTO suppliers (name,region,rating,lead_days,speciality,contact,email,phone,items_supplied) VALUES (?,?,?,?,?,?,?,?,?)',
      [name,region,rating,lead_days,speciality,contact,email,phone,JSON.stringify(items_supplied||[])]
    );
    res.status(201); ok(res,{id:insertId});
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  APPOINTMENTS  (public)
// =============================================================
app.post('/api/appointments', async (req, res) => {
  try {
    const{client_name,client_email,client_phone,project_type,preferred_date,message}=req.body;
    if(!client_name) return fail(res,400,'Name is required');
    const{insertId}=await exec(
      'INSERT INTO appointments (client_name,client_email,client_phone,project_type,preferred_date,message) VALUES (?,?,?,?,?,?)',
      [client_name,client_email||null,client_phone||null,project_type||null,preferred_date||null,message||null]
    );
    res.status(201); ok(res,{id:insertId,message:'Appointment received!'});
  } catch(e){ fail(res,500,e.message); }
});
app.get('/api/appointments', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM appointments ORDER BY created_at DESC')); }
  catch(e){ fail(res,500,e.message); }
});
app.put('/api/appointments/:id', auth, async (req, res) => {
  try { await exec('UPDATE appointments SET status=? WHERE id=?',[req.body.status,req.params.id]); ok(res,{success:true}); }
  catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  TESTIMONIALS  (public)
// =============================================================
app.get('/api/testimonials', async (_q, res) => {
  try { ok(res, await qry('SELECT * FROM testimonials ORDER BY id')); }
  catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  EVENTS
// =============================================================
app.get('/api/events', auth, async (req, res) => {
  try {
    ok(res, await qry('SELECT e.*,p.name AS project_name FROM events e LEFT JOIN projects p ON e.project_id=p.id ORDER BY e.created_at DESC LIMIT 50'));
  } catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  LEGACY COMPAT — old order routes still work
// =============================================================
app.get('/api/orders', auth, async (req, res) => {
  try { ok(res, await qry('SELECT o.*,p.name AS project_name FROM procurement_orders o LEFT JOIN projects p ON o.project_id=p.id ORDER BY o.created_at DESC')); }
  catch(e){ fail(res,500,e.message); }
});

// =============================================================
//  START
// =============================================================
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🪵  TimberStruct API v4.0 — http://localhost:${PORT}`);
    console.log(`    /api/ping`);
    console.log(`    /api/procurement/orders`);
    console.log(`    /api/procurement/stats`);
    console.log(`    /api/procurement/rfq\n`);
  });
}
start();
