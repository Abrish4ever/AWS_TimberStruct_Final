// =============================================================
//  TimberStruct — Express REST API
//  Port     : 4000
//  Database : MySQL (timber-db via db.js)
// =============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { qry, exec, testConnection } = require('./db');

const app        = express();
const PORT       = process.env.PORT       || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'timberstruct-secret-2025';

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// ── Auth middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ── Response helpers ──────────────────────────────────────────
const ok  = (res, data)    => res.json({ success: true,  data, error: null });
const err = (res, code, e) => res.status(code).json({ success: false, data: null, error: e });

// =============================================================
//  HEALTH & DEBUG
// =============================================================
app.get('/api/ping', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/health', async (_req, res) => {
  try {
    const rows = await qry('SELECT COUNT(*) AS total FROM users');
    ok(res, { status: 'ok', userCount: rows[0].total, time: new Date().toISOString() });
  } catch (e) { err(res, 500, e.message); }
});

app.get('/api/test', async (_req, res) => {
  try {
    const [count, users] = await Promise.all([
      qry('SELECT COUNT(*) AS count FROM users'),
      qry('SELECT id, name, email, role, created_at FROM users'),
    ]);
    ok(res, { status: 'MySQL connected ✅', userCount: count[0].count, users });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  AUTH
// =============================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return err(res, 400, 'Email and password are required');

    const users = await qry('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!users.length)
      return err(res, 401, 'No account found with that email');

    const user  = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return err(res, 401, 'Incorrect password');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET, { expiresIn: '7d' }
    );
    console.log(`✅ Login: ${user.email} (${user.role})`);
    ok(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error('Login error:', e);
    err(res, 500, 'Server error during login');
  }
});

// POST /api/auth/register  — client self-signup
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone = null, company = null } = req.body;
    if (!name || !email || !password)
      return err(res, 400, 'Name, email and password are required');
    if (password.length < 6)
      return err(res, 400, 'Password must be at least 6 characters');

    const existing = await qry('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length) return err(res, 400, 'An account with this email already exists');

    const hash   = await bcrypt.hash(password, 10);
    const result = await exec(
      'INSERT INTO users (name, email, password, role, phone, company) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hash, 'client', phone, company]
    );
    const token = jwt.sign(
      { id: result.insertId, email: email.trim().toLowerCase(), role: 'client', name: name.trim() },
      JWT_SECRET, { expiresIn: '7d' }
    );
    console.log(`✅ Register: ${email} (client)`);
    res.status(201).json({
      success: true,
      token,
      user: { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: 'client' }
    });
  } catch (e) {
    console.error('Register error:', e);
    err(res, 500, 'Server error during registration');
  }
});

// GET /api/auth/me
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const users = await qry(
      'SELECT id, name, email, role, phone, company, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!users.length) return err(res, 404, 'User not found');
    ok(res, users[0]);
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  DASHBOARD
// =============================================================
app.get('/api/dashboard/stats', auth, async (req, res) => {
  try {
    const [projects, orders, events, appts] = await Promise.all([
      qry('SELECT * FROM projects'),
      qry('SELECT * FROM procurement_orders'),
      qry(`SELECT e.*, p.name AS project_name FROM events e
           LEFT JOIN projects p ON e.project_id = p.id
           ORDER BY e.created_at DESC LIMIT 10`),
      qry("SELECT * FROM appointments WHERE status = 'pending'"),
    ]);
    const by = s => projects.filter(p => p.status === s).length;
    ok(res, {
      totalProjects      : projects.length,
      activeProjects     : projects.filter(p => p.status !== 'completed').length,
      totalBudget        : projects.reduce((s, p) => s + Number(p.budget || 0), 0),
      totalSpent         : projects.reduce((s, p) => s + Number(p.spent  || 0), 0),
      pendingOrders      : orders.filter(o => ['rfq','in_transit'].includes(o.status)).length,
      deliveredOrders    : orders.filter(o => o.status === 'delivered').length,
      pendingAppointments: appts.length,
      recentEvents       : events,
      projectsByStatus   : { design:by('design'), rfq:by('rfq'), procurement:by('procurement'), completed:by('completed') },
    });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  PROJECTS
// =============================================================
app.get('/api/projects', auth, async (req, res) => {
  try {
    ok(res, await qry(`
      SELECT p.*, u.name AS engineer_name FROM projects p
      LEFT JOIN users u ON p.engineer_id = u.id
      ORDER BY p.created_at DESC`));
  } catch (e) { err(res, 500, e.message); }
});

app.get('/api/projects/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const [projects, members, orders, events] = await Promise.all([
      qry(`SELECT p.*, u.name AS engineer_name FROM projects p
           LEFT JOIN users u ON p.engineer_id = u.id WHERE p.id = ?`, [id]),
      qry('SELECT * FROM structural_members WHERE project_id = ? ORDER BY id', [id]),
      qry('SELECT * FROM procurement_orders  WHERE project_id = ? ORDER BY id', [id]),
      qry('SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC', [id]),
    ]);
    if (!projects.length) return err(res, 404, 'Project not found');
    ok(res, { ...projects[0], members, orders, events });
  } catch (e) { err(res, 500, e.message); }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, client, type, status='design', span_m, load_kn,
            timber_grade='C24', budget=0, start_date, end_date, location, description } = req.body;
    const { insertId } = await exec(
      `INSERT INTO projects (name,client,type,status,span_m,load_kn,timber_grade,budget,
       start_date,end_date,location,description,engineer_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name,client,type,status,span_m||null,load_kn||null,timber_grade,budget,
       start_date||null,end_date||null,location||null,description||null,req.user.id]
    );
    await exec('INSERT INTO events (project_id,user_id,type,message,severity) VALUES (?,?,?,?,?)',
      [insertId, req.user.id, 'project_created', `Project "${name}" created`, 'info']);
    res.status(201); ok(res, { id: insertId, name, client, type, status });
  } catch (e) { err(res, 500, e.message); }
});

app.put('/api/projects/:id', auth, async (req, res) => {
  try {
    const { name,client,type,status,span_m,load_kn,timber_grade,
            budget,spent,progress,start_date,end_date,location,description } = req.body;
    await exec(
      `UPDATE projects SET name=?,client=?,type=?,status=?,span_m=?,load_kn=?,
       timber_grade=?,budget=?,spent=?,progress=?,start_date=?,end_date=?,
       location=?,description=? WHERE id=?`,
      [name,client,type,status,span_m,load_kn,timber_grade,budget,spent,
       progress,start_date,end_date,location,description,req.params.id]
    );
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});

app.delete('/api/projects/:id', auth, async (req, res) => {
  try {
    await exec('DELETE FROM projects WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  STRUCTURAL MEMBERS
// =============================================================
app.get('/api/projects/:id/members', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM structural_members WHERE project_id = ?', [req.params.id])); }
  catch (e) { err(res, 500, e.message); }
});

app.post('/api/projects/:id/members', auth, async (req, res) => {
  try {
    const { type,length_mm,width_mm,depth_mm,quantity=1,grade,load_kn,
            slenderness_ratio,utilisation_pct,status='pending',notes } = req.body;
    const { insertId } = await exec(
      `INSERT INTO structural_members (project_id,type,length_mm,width_mm,depth_mm,quantity,
       grade,load_kn,slenderness_ratio,utilisation_pct,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.params.id,type,length_mm,width_mm,depth_mm,quantity,grade,
       load_kn,slenderness_ratio,utilisation_pct,status,notes||null]
    );
    res.status(201); ok(res, { id: insertId });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  PROCUREMENT ORDERS
// =============================================================
app.get('/api/orders', auth, async (req, res) => {
  try {
    ok(res, await qry(`
      SELECT o.*, p.name AS project_name FROM procurement_orders o
      LEFT JOIN projects p ON o.project_id = p.id ORDER BY o.created_at DESC`));
  } catch (e) { err(res, 500, e.message); }
});

app.post('/api/orders', auth, async (req, res) => {
  try {
    const { project_id,supplier,species,grade,section,quantity_m,
            unit_price,total_price,status='rfq',order_date,delivery_date,notes } = req.body;
    const { insertId } = await exec(
      `INSERT INTO procurement_orders (project_id,supplier,species,grade,section,quantity_m,
       unit_price,total_price,status,order_date,delivery_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [project_id,supplier,species,grade,section,quantity_m,unit_price,
       total_price||0,status,order_date||null,delivery_date||null,notes||null]
    );
    res.status(201); ok(res, { id: insertId });
  } catch (e) { err(res, 500, e.message); }
});

app.put('/api/orders/:id', auth, async (req, res) => {
  try {
    await exec('UPDATE procurement_orders SET status=?,delivery_date=?,notes=? WHERE id=?',
      [req.body.status, req.body.delivery_date||null, req.body.notes||null, req.params.id]);
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  SUPPLIERS
// =============================================================
app.get('/api/suppliers', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM suppliers WHERE active = 1 ORDER BY rating DESC')); }
  catch (e) { err(res, 500, e.message); }
});

app.post('/api/suppliers', auth, async (req, res) => {
  try {
    const { name,region,rating=4.0,lead_days=7,speciality,contact,email,phone } = req.body;
    const { insertId } = await exec(
      'INSERT INTO suppliers (name,region,rating,lead_days,speciality,contact,email,phone) VALUES (?,?,?,?,?,?,?,?)',
      [name,region,rating,lead_days,speciality,contact,email,phone]
    );
    res.status(201); ok(res, { id: insertId });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  APPOINTMENTS  (public — no auth required)
// =============================================================
app.post('/api/appointments', async (req, res) => {
  try {
    const { client_name,client_email,client_phone,project_type,preferred_date,message } = req.body;
    if (!client_name) return err(res, 400, 'Name is required');
    const { insertId } = await exec(
      `INSERT INTO appointments (client_name,client_email,client_phone,project_type,preferred_date,message)
       VALUES (?,?,?,?,?,?)`,
      [client_name,client_email||null,client_phone||null,project_type||null,preferred_date||null,message||null]
    );
    res.status(201); ok(res, { id: insertId, message: 'Appointment request received! We will contact you within 24 hours.' });
  } catch (e) { err(res, 500, e.message); }
});

app.get('/api/appointments', auth, async (req, res) => {
  try { ok(res, await qry('SELECT * FROM appointments ORDER BY created_at DESC')); }
  catch (e) { err(res, 500, e.message); }
});

app.put('/api/appointments/:id', auth, async (req, res) => {
  try {
    await exec('UPDATE appointments SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  TESTIMONIALS  (public)
// =============================================================
app.get('/api/testimonials', async (_req, res) => {
  try { ok(res, await qry('SELECT * FROM testimonials ORDER BY id')); }
  catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  EVENTS
// =============================================================
app.get('/api/events', auth, async (req, res) => {
  try {
    ok(res, await qry(`
      SELECT e.*, p.name AS project_name FROM events e
      LEFT JOIN projects p ON e.project_id = p.id
      ORDER BY e.created_at DESC LIMIT 50`));
  } catch (e) { err(res, 500, e.message); }
});

// =============================================================
//  START
// =============================================================
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🪵  TimberStruct API running`);
    console.log(`    → http://localhost:${PORT}/api/ping`);
    console.log(`    → http://localhost:${PORT}/api/health`);
    console.log(`    → http://localhost:${PORT}/api/test\n`);
  });
}

start();

// =============================================================
//  STRUCTURAL DESIGNS  (save / load analysis results)
// =============================================================

// Save a complete design with all members
app.post('/api/designs', auth, async (req, res) => {
  try {
    const {
      project_name, client, location, engineer, reference, notes,
      structure_type='truss', service_class='1', load_duration='medium_term',
      span_mm, height_mm, pitch_deg,
      dead_load, live_load, wind_load, snow_load, gov_load,
      status='analysed', members=[]
    } = req.body;

    if (!project_name) return err(res, 400, 'Project name is required');

    const { insertId: designId } = await exec(
      `INSERT INTO structural_designs
         (user_id,project_name,client,location,engineer,reference,notes,
          structure_type,service_class,load_duration,span_mm,height_mm,pitch_deg,
          dead_load,live_load,wind_load,snow_load,gov_load,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id,project_name,client||null,location||null,engineer||null,
       reference||null,notes||null,structure_type,service_class,load_duration,
       span_mm||null,height_mm||null,pitch_deg||null,
       dead_load||null,live_load||null,wind_load||null,snow_load||null,gov_load||null,status]
    );

    // Insert all members
    for (const m of members) {
      await exec(
        `INSERT INTO design_members
           (design_id,label,member_type,width_mm,depth_mm,length_mm,grade,
            design_load_kn,quantity,capacity_kn,utilisation_pct,lambda,lambda_rel,kc,
            moment_knm,stress_nmm2,defl_inst_mm,defl_fin_mm,defl_limit_mm,
            weight_kg,ec5_pass,ec5_warning)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [designId, m.label||'Member',
         m.type==='strut'||m.type==='post'?'strut':'rafter',
         m.width||47, m.depth||200, m.length||6000,
         m.grade||'C24', m.load||3.5, m.qty||1,
         m.capacity||null, m.utilisation||null,
         m.lambda||null, m.lambdaRel||null, m.kc||null,
         m.moment||null, m.stress||null,
         m.deflection_inst||null, m.deflection_fin||null, m.lim_fin||null,
         m.weight||null,
         m.pass!==undefined?(m.pass?1:0):null,
         m.warning!==undefined?(m.warning?1:0):null]
      );
    }

    console.log(`✅ Design saved: "${project_name}" (${members.length} members) by user ${req.user.id}`);
    res.status(201); ok(res, { id: designId, project_name, members_count: members.length });
  } catch (e) { console.error(e); err(res, 500, e.message); }
});

// List all designs for current user
app.get('/api/designs', auth, async (req, res) => {
  try {
    ok(res, await qry(
      `SELECT id,project_name,client,location,status,structure_type,
              span_mm,gov_load,created_at,updated_at
       FROM structural_designs WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    ));
  } catch (e) { err(res, 500, e.message); }
});

// Get a single design with all members
app.get('/api/designs/:id', auth, async (req, res) => {
  try {
    const designs = await qry(
      'SELECT * FROM structural_designs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!designs.length) return err(res, 404, 'Design not found');
    const members = await qry(
      'SELECT * FROM design_members WHERE design_id = ? ORDER BY id',
      [req.params.id]
    );
    ok(res, { ...designs[0], members });
  } catch (e) { err(res, 500, e.message); }
});

// Update design status
app.put('/api/designs/:id', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await exec(
      'UPDATE structural_designs SET status=?, notes=? WHERE id=? AND user_id=?',
      [status, notes||null, req.params.id, req.user.id]
    );
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});

// Delete a design
app.delete('/api/designs/:id', auth, async (req, res) => {
  try {
    await exec('DELETE FROM structural_designs WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    ok(res, { success: true });
  } catch (e) { err(res, 500, e.message); }
});
