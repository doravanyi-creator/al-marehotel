require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors()); // Allows your HTML page to talk to this server
app.use(express.json());

// Initialize Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// POST Endpoint for Contact Form
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    console.log(`\n--- New Submission Received: ${email} ---`);

    try {
        // ---------------------------------------------------------
        // 1. SUPABASE: Insert into Database
        // ---------------------------------------------------------
        console.log('1. Saving to Supabase...');
        const { error: sbError } = await supabase
            .from('contact_submissions')
            .insert([{ name, email, message }]);

        if (sbError) throw new Error(`Supabase Error: ${sbError.message}`);
        console.log('✅ Supabase: Success');

        // ---------------------------------------------------------
        // 2. HUBSPOT: Create CRM Contact
        // ---------------------------------------------------------
        console.log('2. Syncing to HubSpot...');
        try {
            await axios.post(
                'https://api.hubapi.com/crm/v3/objects/contacts',
                {
                    properties: {
                        email: email,
                        firstname: name // Mapping 'name' to 'firstname'
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('✅ HubSpot: Contact Created');
        } catch (hubError) {
            if (hubError.response && hubError.response.status === 409) {
                console.log('⚠️ HubSpot: Contact already exists (Skipping)');
            } else {
                console.error('❌ HubSpot Error:', hubError.response?.data?.message || hubError.message);
                // We do not throw here, so Mailchimp can still attempt to run
            }
        }

        // ---------------------------------------------------------
        // 3. MAILCHIMP: Add Subscriber
        // ---------------------------------------------------------
        console.log('3. Adding to Mailchimp Audience...');
        try {
            const mcUrl = `https://${process.env.MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`;
            
            await axios.post(
                mcUrl,
                {
                    email_address: email,
                    status: 'subscribed',
                    merge_fields: {
                        FNAME: name
                    }
                },
                {
                    auth: {
                        username: 'anystring', // Mailchimp uses Basic Auth, username is ignored
                        password: process.env.MAILCHIMP_API_KEY
                    }
                }
            );
            console.log('✅ Mailchimp: Subscriber Added');
        } catch (mcError) {
            // Mailchimp returns 400 with title "Member Exists" if already subscribed
            if (mcError.response && mcError.response.data.title === "Member Exists") {
                console.log('⚠️ Mailchimp: Member already exists (Skipping)');
            } else {
                console.error('❌ Mailchimp Error:', mcError.response?.data?.detail || mcError.message);
            }
        }

        // ---------------------------------------------------------
        // Final Response
        // ---------------------------------------------------------
        res.status(200).json({ success: true, message: 'Inquiry processed successfully' });

    } catch (error) {
        console.error('❌ PIPELINE FAILED:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running securely on http://localhost:${PORT}`));