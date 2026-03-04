export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { name, email, message } = req.body;

    try {
        // 1. SUPABASE: Insert data into your table
        const supabaseRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/contact_submissions`, {
            method: 'POST',
            headers: {
                'apikey': process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ name, email, message })
        });

        // 2. HUBSPOT: Create a contact in CRM
        const hubspotRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: { 
                    firstname: name, 
                    email: email 
                }
            })
        });

        // 3. MAILCHIMP: Add to Audience (Triggers Welcome Email)
        // Mailchimp uses a unique "Server Prefix" (e.g., us21) in the URL
        const dc = process.env.MAILCHIMP_SERVER_PREFIX; 
        const listId = process.env.MAILCHIMP_AUDIENCE_ID;
        const mailchimpRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`, {
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

        // Return success even if Mailchimp/Hubspot fails (graceful handling)
        return res.status(200).json({ message: 'Lead captured successfully' });

    } catch (error) {
        console.error('Pipeline Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
