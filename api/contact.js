export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { name, email, message } = req.body;

    // Helper to log errors without crashing the whole script
    const results = { supabase: false, hubspot: false, mailchimp: false };

    try {
        // 1. SUPABASE (Database)
        const sb = await fetch(`${process.env.SUPABASE_URL}/rest/v1/contact_submissions`, {
            method: 'POST',
            headers: {
                'apikey': process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, message })
        });
        if (sb.ok) results.supabase = true;

        // 2. HUBSPOT (CRM)
        const hs = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties: { firstname: name, email: email } })
        });
        if (hs.ok) results.hubspot = true;

        // 3. MAILCHIMP (Email Marketing)
        const dc = process.env.MAILCHIMP_SERVER_PREFIX;
        const listId = process.env.MAILCHIMP_AUDIENCE_ID;
        const mc = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`any:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_address: email,
                status: 'subscribed',
                merge_fields: { FNAME: name }
            })
        });
        if (mc.ok) results.mailchimp = true;

        // SUCCESS: Even if one failed, we send 200 to keep the user moving
        return res.status(200).json({ success: true, details: results });

    } catch (error) {
        console.error('Fatal Pipeline Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
