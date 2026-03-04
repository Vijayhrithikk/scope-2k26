const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Registration = require('../models/Registration');

async function getPhones() {
    try {
        if (!process.env.MONGO_URL) {
            console.error('MONGO_URL not found in .env');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URL);

        const registrations = await Registration.find({ status: 'approved' });
        const phones = new Set();

        registrations.forEach(reg => {
            if (reg.members && Array.isArray(reg.members)) {
                reg.members.forEach(member => {
                    if (member.phone) {
                        // Split by dots or commas if multiple numbers in one field
                        const parts = member.phone.split(/[.,]/);
                        parts.forEach(p => {
                            let clean = p.replace(/\D/g, '');
                            if (clean.length === 10) clean = '91' + clean;
                            if (clean.length >= 10) phones.add(clean);
                        });
                    }
                });
            }
        });

        const sortedPhones = [...phones].sort();
        console.log('\n=====================================');
        console.log('   TOTAL UNIQUE PHONES: ' + sortedPhones.length);
        console.log('=====================================\n');
        console.log(sortedPhones.join(', '));
        console.log('\n=====================================');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

getPhones();
