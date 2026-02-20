require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Registration = require('./models/Registration'); // Import our model

const JWT_SECRET = process.env.JWT_SECRET || 'scope2k26-secret-key';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'scope2k26admin';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// --- MongoDB Connection ---
// --- MongoDB Connection Logic for Serverless ---
let isConnected = false;

async function connectToDatabase() {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(process.env.MONGO_URL);
        isConnected = db.connections[0].readyState;
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Connection error:', error);
        // Don't crash, let middleware handle retry or throw
    }
}

// Middleware to ensure DB connection on every request
app.use(async (req, res, next) => {
    await connectToDatabase();
    next();
});

// --- Excel Helper Removed --- (Using Mongoose now)

// --- Helper: Format registration for frontend ---
function formatReg(doc) {
    return {
        id: doc._id,
        teamName: doc.teamName,
        teamLead: doc.teamLead,
        teamSize: doc.teamSize,
        email: doc.email,
        transactionId: doc.transactionId,
        status: doc.status,
        teamId: doc.teamId,
        registeredAt: doc.registeredAt,
        // Map members array to flat structure for frontend compatibility if needed, 
        // or just send members array. Admin dashboard uses member1_name etc.
        // Let's keep member1_name format for compatibility or update frontend?
        // Updating frontend is better, but to be safe let's map it here.
        member1_name: doc.members[0]?.name || '',
        member1_year: doc.members[0]?.year || '',
        member1_branch: doc.members[0]?.branch || '',
        member1_phone: doc.members[0]?.phone || '',
        member2_name: doc.members[1]?.name || '',
        member2_year: doc.members[1]?.year || '',
        member2_branch: doc.members[1]?.branch || '',
        member2_phone: doc.members[1]?.phone || '',
        member3_name: doc.members[2]?.name || '',
        member3_year: doc.members[2]?.year || '',
        member3_branch: doc.members[2]?.branch || '',
        member3_phone: doc.members[2]?.phone || '',
        member4_name: doc.members[3]?.name || '',
        member4_year: doc.members[3]?.year || '',
        member4_branch: doc.members[3]?.branch || '',
        member4_phone: doc.members[3]?.phone || ''
    };
}

// --- Team ID Generator ---
async function getNextTeamId() {
    const lastApproved = await Registration.findOne({ status: 'approved', teamId: { $ne: '' } })
        .sort({ teamId: -1 })
        .limit(1);

    let nextNum = 0;
    if (lastApproved && lastApproved.teamId) {
        const match = lastApproved.teamId.match(/SCOPE-(\d+)/);
        if (match) nextNum = parseInt(match[1]);
    }
    return `SCOPE-${String(nextNum + 1).padStart(2, '0')}`;
}

// --- Email Helper ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- QR Code Generator ---
async function generateTeamQR(registration, baseUrl) {
    const verifyUrl = `${baseUrl}/verify/${registration.teamId}`;
    return await QRCode.toDataURL(verifyUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#0a0e1a', light: '#ffffff' },
        errorCorrectionLevel: 'H'
    });
}

// --- Get member rows for email ---
function getMemberRows(reg) {
    const rows = [];
    // Handle both Mongoose array and compatibility flat fields
    const members = reg.members && reg.members.length > 0 ? reg.members : [];

    // If members array is empty, try flat fields (legacy checks)
    if (members.length === 0) {
        for (let i = 1; i <= 4; i++) {
            if (reg[`member${i}_name`]) {
                members.push({
                    name: reg[`member${i}_name`],
                    year: reg[`member${i}_year`],
                    branch: reg[`member${i}_branch`],
                    phone: reg[`member${i}_phone`]
                });
            }
        }
    }

    members.forEach(m => {
        rows.push(`
            <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px;">${m.name}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:14px;">Year ${m.year}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:14px;">${m.branch}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:14px;">${m.phone}</td>
            </tr>`);
    });
    return rows.join('');
}

// --- APPROVAL EMAIL with QR ---
async function sendApprovalEmail(registration, baseUrl) {
    const qrDataUrl = await generateTeamQR(registration, baseUrl);

    const html = `
    <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:620px;margin:0 auto;background:#0a0e1a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#00d4ff 0%,#3b82f6 50%,#8b5cf6 100%);padding:40px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🎉</div>
            <h1 style="margin:0;font-size:28px;color:#fff;font-weight:800;letter-spacing:-0.5px;">Registration Approved!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Welcome aboard — you're in for Scope 2K26</p>
        </div>

        <!-- Team ID Card -->
        <div style="padding:32px;text-align:center;">
            <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border:2px solid #00d4ff;border-radius:16px;padding:28px;margin-bottom:28px;position:relative;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Your Unique Team ID</p>
                <h2 style="margin:0;font-size:42px;font-weight:900;color:#00d4ff;letter-spacing:2px;">${registration.teamId}</h2>
                <div style="width:60px;height:3px;background:linear-gradient(90deg,#00d4ff,#8b5cf6);margin:12px auto 0;border-radius:2px;"></div>
            </div>

            <!-- QR Code -->
            <div style="background:#ffffff;border-radius:16px;padding:24px;display:inline-block;margin-bottom:24px;">
                <img src="cid:teamqrcode" alt="Team QR Code" style="width:220px;height:220px;display:block;" />
                <p style="margin:12px 0 0;color:#374151;font-size:12px;font-weight:600;">Scan this QR at the event for verification</p>
            </div>

            <!-- Team Details -->
            <div style="text-align:left;background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #1e293b;">
                <h3 style="color:#00d4ff;margin:0 0 16px;font-size:16px;font-weight:700;">📋 Team Details</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:13px;width:130px;">Team Name</td>
                        <td style="padding:10px 0;color:#f1f5f9;font-size:14px;font-weight:600;">${registration.teamName}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:13px;border-top:1px solid #1e293b;">Team Lead</td>
                        <td style="padding:10px 0;color:#f1f5f9;font-size:14px;border-top:1px solid #1e293b;">${registration.teamLead}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:13px;border-top:1px solid #1e293b;">Team Size</td>
                        <td style="padding:10px 0;color:#f1f5f9;font-size:14px;border-top:1px solid #1e293b;">${registration.teamSize} Member${parseInt(registration.teamSize) > 1 ? 's' : ''}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:13px;border-top:1px solid #1e293b;">Transaction ID</td>
                        <td style="padding:10px 0;color:#f1f5f9;font-size:14px;border-top:1px solid #1e293b;font-family:monospace;">${registration.transactionId}</td>
                    </tr>
                </table>
            </div>

            <!-- Members Table -->
            <div style="text-align:left;background:#0f172a;border-radius:12px;overflow:hidden;margin-bottom:24px;border:1px solid #1e293b;">
                <div style="padding:16px 20px;background:#1e293b;">
                    <h3 style="color:#00d4ff;margin:0;font-size:14px;font-weight:700;">👥 Team Members</h3>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <tr style="background:#0f172a;">
                        <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Name</th>
                        <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Year</th>
                        <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Branch</th>
                        <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Phone</th>
                    </tr>
                    ${getMemberRows(registration)}
                </table>
            </div>

            <!-- Event Info -->
            <div style="background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(139,92,246,0.08));border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
                <h3 style="color:#f1f5f9;margin:0 0 16px;font-size:16px;font-weight:700;">📍 Event Details</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Event</td><td style="padding:8px 0;color:#f1f5f9;font-size:14px;font-weight:600;">Scope 2K26</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Date</td><td style="padding:8px 0;color:#00d4ff;font-size:14px;font-weight:600;">March 5, 2026</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Venue</td><td style="padding:8px 0;color:#f1f5f9;font-size:14px;">Raghu Engineering College, Visakhapatnam</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Prize Pool</td><td style="padding:8px 0;color:#f59e0b;font-size:14px;font-weight:700;">Up to ₹20,000</td></tr>
                </table>
            </div>

            <!-- Important Note -->
            <div style="background:#1e293b;border-radius:12px;padding:20px;text-align:center;">
                <p style="margin:0 0 4px;color:#f59e0b;font-size:13px;font-weight:700;">⚠️ Important</p>
                <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">Keep this email safe. Show your <strong style="color:#00d4ff;">QR code</strong> or <strong style="color:#00d4ff;">Team ID</strong> at the venue for entry. Arrive on time!</p>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;background:#0f172a;text-align:center;border-top:1px solid #1e293b;">
            <p style="margin:0 0 4px;color:#475569;font-size:12px;">© 2026 Scope 2K26 — Raghu Engineering College</p>
            <p style="margin:0;color:#334155;font-size:11px;">All rights reserved</p>
        </div>
    </div>`;

    try {
        const qrBase64 = qrDataUrl.split(',')[1];
        const qrBuffer = Buffer.from(qrBase64, 'base64');

        await transporter.sendMail({
            from: `"Scope 2K26 — REC" <${process.env.EMAIL_USER}>`,
            to: registration.email,
            subject: `🎉 Approved! Team ID: ${registration.teamId} — Scope 2K26`,
            html: html,
            attachments: [{
                filename: `${registration.teamId}-qr.png`,
                content: qrBuffer,
                contentType: 'image/png',
                cid: 'teamqrcode'
            }]
        });
        console.log(`✅ Approval email with QR sent to ${registration.email}`);
        return true;
    } catch (err) {
        console.error('❌ Email error:', err.message);
        return false;
    }
}

// --- REJECTION EMAIL ---
async function sendRejectionEmail(registration) {
    const html = `
    <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:620px;margin:0 auto;background:#0a0e1a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:36px 32px;text-align:center;">
            <h1 style="margin:0;font-size:26px;color:#fff;font-weight:800;">Registration Update</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Scope 2K26 — Raghu Engineering College</p>
        </div>

        <!-- Body -->
        <div style="padding:32px;">
            <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 16px;">Dear <strong>${registration.teamLead}</strong>,</p>
            <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 16px;">We regret to inform you that your registration for team <strong style="color:#f1f5f9;">"${registration.teamName}"</strong> could not be approved at this time.</p>
            
            <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0;">
                <p style="margin:0 0 8px;color:#f59e0b;font-size:13px;font-weight:700;">Possible Reasons:</p>
                <ul style="margin:0;padding:0 0 0 20px;color:#94a3b8;font-size:13px;line-height:2;">
                    <li>Invalid or unverifiable transaction ID</li>
                    <li>Incomplete payment of ₹400</li>
                    <li>Duplicate registration</li>
                </ul>
            </div>

            <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 20px;">You may re-register with valid payment details or contact our coordinators:</p>
            
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;text-align:center;">
                <p style="margin:0 0 4px;color:#e2e8f0;font-size:14px;"><strong>K. Sandeep</strong> — <a href="tel:+917670996681" style="color:#00d4ff;text-decoration:none;">7670996681</a></p>
                <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>P. Akhil</strong> — <a href="tel:+917670850910" style="color:#00d4ff;text-decoration:none;">7670850910</a></p>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;background:#0f172a;text-align:center;border-top:1px solid #1e293b;">
            <p style="margin:0;color:#475569;font-size:12px;">© 2026 Scope 2K26 — Raghu Engineering College. All rights reserved.</p>
        </div>
    </div>`;

    try {
        await transporter.sendMail({
            from: `"Scope 2K26 — REC" <${process.env.EMAIL_USER}>`,
            to: registration.email,
            subject: `Registration Update — Scope 2K26`,
            html: html
        });
        console.log(`📧 Rejection email sent to ${registration.email}`);
        return true;
    } catch (err) {
        console.error('❌ Email error:', err.message);
        return false;
    }
}

// --- API Routes ---

// Register
app.post('/api/register', async (req, res) => {
    try {
        const members = [];
        if (req.body.members) {
            for (let i = 0; i < req.body.members.length; i++) {
                if (req.body.members[i]) members.push(req.body.members[i]);
            }
        }

        const newReg = new Registration({
            teamName: req.body.teamName,
            teamLead: req.body.teamLead,
            teamSize: req.body.teamSize,
            email: req.body.email,
            transactionId: req.body.transactionId,
            members: members
        });

        await newReg.save();
        res.json({ success: true, message: 'Registration successful!', id: newReg._id });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Registration failed.' });
    }
});

// Get registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ registeredAt: -1 });
        const data = registrations.map(formatReg);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch registrations.' });
    }
});

// Approve
app.put('/api/registrations/:id/approve', async (req, res) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });

        reg.status = 'approved';
        reg.teamId = await getNextTeamId();
        await reg.save();

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        await sendApprovalEmail(formatReg(reg), baseUrl);

        res.json({ success: true, message: `Approved with ID: ${reg.teamId}`, teamId: reg.teamId });
    } catch (err) {
        console.error('Approve error:', err);
        res.status(500).json({ success: false, message: 'Failed to approve.' });
    }
});

// Reject
app.put('/api/registrations/:id/reject', async (req, res) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });

        reg.status = 'rejected';
        reg.teamId = '';
        await reg.save();

        await sendRejectionEmail(formatReg(reg));
        res.json({ success: true, message: 'Registration rejected.' });
    } catch (err) {
        console.error('Reject error:', err);
        res.status(500).json({ success: false, message: 'Failed to reject.' });
    }
});

// Edit
app.put('/api/registrations/:id/edit', async (req, res) => {
    try {
        const updateData = {};
        if (req.body.teamName) updateData.teamName = req.body.teamName;
        if (req.body.teamLead) updateData.teamLead = req.body.teamLead;
        if (req.body.email) updateData.email = req.body.email;
        if (req.body.transactionId) updateData.transactionId = req.body.transactionId;

        // Note: Members editing is complex, for now we stick to basic fields as per original scope
        // or frontend needs update to send structured members

        await Registration.findByIdAndUpdate(req.params.id, updateData);
        res.json({ success: true, message: 'Registration updated.' });
    } catch (err) {
        console.error('Edit error:', err);
        res.status(500).json({ success: false, message: 'Failed to update.' });
    }
});

// Stats
app.get('/api/stats', async (req, res) => {
    try {
        const total = await Registration.countDocuments();
        const approved = await Registration.countDocuments({ status: 'approved' });
        const pending = await Registration.countDocuments({ status: 'pending' });
        const rejected = await Registration.countDocuments({ status: 'rejected' });

        res.json({ success: true, stats: { total, approved, pending, rejected, revenue: approved * 400 } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to get stats.' });
    }
});

// Export (simplified as CSV for now, or just basic JSON dump, originally Excel)
// To keep Excel export working, we fetch from Mongo and use XLSX
const XLSX = require('xlsx');
app.get('/api/export', async (req, res) => {
    try {
        const docs = await Registration.find().sort({ registeredAt: -1 });
        const data = docs.map(formatReg);

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

        const tempFile = path.join(__dirname, 'temp_export.xlsx');
        XLSX.writeFile(wb, tempFile);

        res.download(tempFile, 'scope2k26_registrations.xlsx', () => {
            // Cleanup temp file if needed, but not critical for now
            // fs.unlinkSync(tempFile);
        });
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ success: false, message: 'Export failed.' });
    }
});

// --- Admin Login (returns JWT token) ---
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASS) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
});

// --- Middleware: Verify JWT token ---
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });

    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
}

// Verify Page — Admin Protected (with token auto-login)
app.get('/verify/:teamId', (req, res) => {
    const teamId = req.params.teamId;
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify — Scope 2K26</title>
        <link rel="icon" href="/scope-logo-circle.png" type="image/png">
        <style>
            *{margin:0;padding:0;box-sizing:border-box;}
            body{font-family:'Segoe UI',sans-serif;background:#050816;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
            .container{max-width:500px;width:100%;}
            .loading{text-align:center;color:#94a3b8;font-size:0.95rem;}
            .loading .spinner{width:32px;height:32px;border:3px solid #1e293b;border-top-color:#00d4ff;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;}
            @keyframes spin{to{transform:rotate(360deg);}}

            .login-view{text-align:center;display:none;}
            .login-view .icon{font-size:3rem;margin-bottom:16px;}
            .login-view h1{font-size:1.5rem;color:#00d4ff;margin-bottom:6px;}
            .login-view p{color:#94a3b8;font-size:0.9rem;margin-bottom:24px;}
            .login-view input{width:100%;padding:14px 18px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;color:#e2e8f0;font-size:1.1rem;text-align:center;letter-spacing:2px;outline:none;margin-bottom:12px;}
            .login-view input:focus{border-color:#00d4ff;box-shadow:0 0 15px rgba(0,212,255,0.15);}
            .login-view button{width:100%;padding:14px;background:linear-gradient(135deg,#00d4ff,#8b5cf6);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;transition:transform 0.2s;}
            .login-view button:hover{transform:scale(1.02);}
            .login-error{color:#ef4444;font-size:0.85rem;margin-top:8px;display:none;}
            .badge-id{display:inline-block;padding:6px 16px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:50px;font-family:monospace;font-weight:700;color:#00d4ff;font-size:0.95rem;margin-bottom:20px;}

            .team-view{display:none;}
            .card{background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:28px;margin-bottom:16px;}
            .status-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
            .status-badge{padding:6px 16px;border-radius:50px;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}
            .status-approved{background:rgba(34,197,94,0.12);color:#22c55e;}
            .status-pending{background:rgba(245,158,11,0.12);color:#f59e0b;}
            .status-rejected{background:rgba(239,68,68,0.12);color:#ef4444;}
            .team-id{font-family:monospace;font-size:1.6rem;font-weight:900;color:#00d4ff;margin-bottom:4px;}
            .team-name{font-size:1.1rem;font-weight:600;margin-bottom:4px;}
            .team-lead{color:#94a3b8;font-size:0.9rem;}
            .divider{border:none;border-top:1px solid #1e293b;margin:20px 0;}
            .members-title{font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:12px;}
            .member-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid #1e293b;border-radius:10px;margin-bottom:8px;}
            .member-row .name{font-weight:600;font-size:0.9rem;}
            .member-row .phone{color:#94a3b8;font-size:0.85rem;font-family:monospace;}
            .checkin-btn{display:block;width:100%;padding:16px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-size:1.1rem;font-weight:700;cursor:pointer;transition:all 0.3s;}
            .checkin-btn:hover{background:#16a34a;transform:scale(1.02);}
            .checkin-btn.checked{background:#475569;cursor:default;}
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Loading (shown while checking token) -->
            <div class="loading" id="loadingView">
                <div class="spinner"></div>
                <p>Checking authorization...</p>
            </div>

            <!-- Login (shown if no valid token) -->
            <div class="login-view" id="loginView">
                <div class="icon">🔒</div>
                <h1>Admin Verification</h1>
                <p>Enter admin password to view team details</p>
                <div class="badge-id">${teamId}</div>
                <input type="password" id="adminPwd" placeholder="••••••••">
                <button onclick="loginAndVerify()">Unlock & Verify</button>
                <p class="login-error" id="loginError">Incorrect password. Try again.</p>
            </div>

            <!-- Team Details -->
            <div class="team-view" id="teamView"></div>
        </div>

        <script>
            const TEAM_ID = '${teamId}';

            document.getElementById('adminPwd').addEventListener('keypress', e => {
                if (e.key === 'Enter') loginAndVerify();
            });

            // On page load: check if we have a stored token
            (async function init() {
                const token = localStorage.getItem('admin_token');
                if (token) {
                    // Try to fetch team with stored token
                    const ok = await fetchTeamWithToken(token);
                    if (ok) return; // Success — team is displayed
                    // Token expired or invalid — clear it
                    localStorage.removeItem('admin_token');
                }
                // No valid token — show login
                document.getElementById('loadingView').style.display = 'none';
                document.getElementById('loginView').style.display = 'block';
                document.getElementById('adminPwd').focus();
            })();

            async function fetchTeamWithToken(token) {
                try {
                    const res = await fetch('/api/verify/' + TEAM_ID, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (data.success) {
                        document.getElementById('loadingView').style.display = 'none';
                        renderTeam(data.team);
                        return true;
                    }
                } catch (e) {}
                return false;
            }

            async function loginAndVerify() {
                const pwd = document.getElementById('adminPwd').value;
                if (!pwd) return;

                try {
                    // Step 1: Login to get token
                    const loginRes = await fetch('/api/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: pwd })
                    });
                    const loginData = await loginRes.json();

                    if (!loginData.success) {
                        document.getElementById('loginError').style.display = 'block';
                        document.getElementById('adminPwd').value = '';
                        return;
                    }

                    // Step 2: Store token
                    localStorage.setItem('admin_token', loginData.token);

                    // Step 3: Fetch team with token
                    const ok = await fetchTeamWithToken(loginData.token);
                    if (!ok) {
                        document.getElementById('loginError').textContent = 'Team not found.';
                        document.getElementById('loginError').style.display = 'block';
                    }
                } catch (err) {
                    document.getElementById('loginError').textContent = 'Network error.';
                    document.getElementById('loginError').style.display = 'block';
                }
            }

            function renderTeam(t) {
                document.getElementById('loginView').style.display = 'none';
                const tv = document.getElementById('teamView');
                tv.style.display = 'block';

                const statusClass = 'status-' + t.status;
                let memberHTML = '';
                for (let i = 1; i <= 4; i++) {
                    if (t['member' + i + '_name']) {
                        memberHTML += '<div class="member-row"><span class="name">' + t['member' + i + '_name'] + '</span><span class="phone">' + (t['member' + i + '_phone'] || '\u2014') + '</span></div>';
                    }
                }

                tv.innerHTML =
                    '<div class="card">' +
                        '<div class="status-bar"><span class="status-badge ' + statusClass + '">' + t.status.toUpperCase() + '</span></div>' +
                        '<div class="team-id">' + t.teamId + '</div>' +
                        '<div class="team-name">' + t.teamName + '</div>' +
                        '<div class="team-lead">Lead: ' + t.teamLead + '</div>' +
                        '<hr class="divider">' +
                        '<div class="members-title">Team Members</div>' +
                        memberHTML +
                    '</div>' +
                    '<button class="checkin-btn" id="checkinBtn" onclick="checkIn()">\u2705 Check In Team</button>';
            }

            function checkIn() {
                const btn = document.getElementById('checkinBtn');
                btn.innerHTML = '\u2705 Checked In';
                btn.classList.add('checked');
                btn.onclick = null;
            }
        </script>
    </body>
    </html>`);
});

// API: Verify team (token-protected)
app.get('/api/verify/:teamId', verifyToken, async (req, res) => {
    try {
        const reg = await Registration.findOne({ teamId: req.params.teamId });
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Team not found.' });
        }
        res.json({ success: true, team: formatReg(reg) });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'admin.html')));

// Export for Vercel
module.exports = app;

// Start server if not running in serverless environment (e.g. locally)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Connected to MongoDB`);
    });
}
