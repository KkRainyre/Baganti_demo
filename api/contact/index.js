// POST /api/contact — sends the contact form to Baganti through Resend.
// App settings (Azure Static Web App > Environment variables):
//   RESEND_API_KEY  required
//   CONTACT_TO      inbox that receives the form, e.g. your Resend receiving address (default info@baganti.com)
//   CONTACT_FROM    sender on a domain verified in Resend (default Baganti Website <website@deploymops.com>)
const FIELDS = { requestType: 80, name: 120, company: 160, email: 200, family: 80, product: 120, stage: 80, message: 5000 };
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function (context, req) {
    const reply = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    if (raw.website) return reply(200, { ok: true }); // honeypot filled: quietly drop spam

    const d = {};
    for (const [k, max] of Object.entries(FIELDS)) d[k] = String(raw[k] || '').trim().slice(0, max);
    if (!d.name || !d.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return reply(400, { ok: false, error: 'invalid' });

    const key = process.env.RESEND_API_KEY;
    if (!key) { context.log.error('RESEND_API_KEY is not set'); return reply(500, { ok: false, error: 'not-configured' }); }

    const rows = [
        ['Request type', d.requestType || 'Project inquiry'],
        ['Name', d.name],
        ['Company', d.company || '—'],
        ['Email', d.email],
        ['Product family', d.family || 'Not sure'],
        ['Product', d.product || 'Not sure yet'],
        ['Project stage', d.stage || 'Not specified']
    ];
    const text = rows.map(([k, v]) => k + ': ' + v).join('\n') + '\n\n' + d.message;
    const html = '<table cellpadding="4">' + rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join('') +
        '</table><p style="white-space:pre-wrap">' + esc(d.message) + '</p>';

    const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.CONTACT_FROM || 'Baganti Website <website@deploymops.com>',
            to: (process.env.CONTACT_TO || 'info@baganti.com').split(',').map(s => s.trim()),
            reply_to: d.email,
            subject: (d.requestType || 'Website inquiry') + ' — ' + (d.family || 'Baganti') + ' — ' + d.name,
            text,
            html
        })
    });
    if (!r.ok) {
        const detail = await r.text();
        context.log.error('Resend error', r.status, detail);
        let message = '';
        try { message = JSON.parse(detail).message || ''; } catch (e) { /* not JSON */ }
        return reply(502, { ok: false, error: 'send-failed', status: r.status, detail: message });
    }
    return reply(200, { ok: true });
};
