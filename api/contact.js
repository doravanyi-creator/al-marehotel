export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { name, email, message } = req.body;

    try {
        // 1. SUPABASE
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/contact_submissions`, {
            method: 'POST',
            headers: {
                'apikey': process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, message })
        });

        // 2. HUBSPOT
        await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties: { firstname: name, email: email } })
        });

        // 3. MAILCHIMP
        const dc = process.env.MAILCHIMP_SERVER_PREFIX;
        const listId = process.env.MAILCHIMP_AUDIENCE_ID;
        await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`any:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email_address: email, status: 'subscribed', merge_fields: { FNAME: name } })
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
