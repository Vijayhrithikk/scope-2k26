const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Registration = require('../models/Registration');

async function sendBulkInvite() {
    try {
        if (!process.env.MONGO_URL || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Missing environment variables in .env');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ Connected to MongoDB');

        const approvedTeams = await Registration.find({ status: 'approved' });
        console.log(`📋 Found ${approvedTeams.length} approved teams.`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const whatsappLink = 'https://chat.whatsapp.com/KmgN6VFz9h2E2psvsq53IZ';
        let successCount = 0;
        let failCount = 0;

        console.log('🚀 Starting bulk mailing...');

        for (const team of approvedTeams) {
            const html = `
            <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e1a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;color:#f1f5f9;">
                <div style="background:linear-gradient(135deg,#25d366 0%,#128c7e 100%);padding:40px 32px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;">📢</div>
                    <h1 style="margin:0;font-size:24px;color:#fff;font-weight:800;">Official WhatsApp Group</h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Scope 2K26 — Raghu Engineering College</p>
                </div>
                
                <div style="padding:32px;">
                    <p style="font-size:16px;line-height:1.6;margin-bottom:20px;">Dear Team <strong>${team.teamName}</strong>,</p>
                    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin-bottom:24px;">
                        Congratulations on your registration for <strong>Scope 2K26</strong>! To stay updated with the latest announcements, schedules, and event details, please join our official WhatsApp group.
                    </p>
                    
                    <div style="text-align:center;margin:32px 0;">
                        <a href="${whatsappLink}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 14px 0 rgba(37,211,102,0.39);">Join WhatsApp Group</a>
                    </div>
                    
                    <div style="background:#1e293b;border-radius:12px;padding:20px;border-left:4px solid #f59e0b;">
                        <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                            <strong>Note:</strong> This group is exclusively for participants. All important event-day instructions will be shared here.
                        </p>
                    </div>
                </div>

                <div style="padding:24px;background:#0f172a;text-align:center;border-top:1px solid #1e293b;">
                    <p style="margin:0;color:#475569;font-size:12px;">© 2026 Scope 2K26 — Raghu Engineering College</p>
                </div>
            </div>`;

            try {
                await transporter.sendMail({
                    from: `"Scope 2K26 — Organizers" <${process.env.EMAIL_USER}>`,
                    to: team.email,
                    subject: `📢 Join Official WhatsApp Group — Team ${team.teamName}`,
                    html: html
                });
                successCount++;
                console.log(`[${successCount + failCount}/${approvedTeams.length}] ✅ Sent to ${team.teamName} (${team.email})`);
            } catch (err) {
                failCount++;
                console.error(`[${successCount + failCount}/${approvedTeams.length}] ❌ Failed for ${team.teamName}: ${err.message}`);
            }

            // Small delay to prevent spam flagging
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n=====================================');
        console.log('📊 MAILING COMPLETED');
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log('=====================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Fatal Error:', err);
        process.exit(1);
    }
}

sendBulkInvite();
