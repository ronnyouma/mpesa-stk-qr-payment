const express = require('express');
const axios = require('axios');
const cors = require('cors');
const QRCode = require('qrcode');
const app = express();

app.use(cors());
app.use(express.json());

// Payhero configuration. Set these values in your environment.
const config = {
    username: process.env.PAYHERO_API_USERNAME || 'YOUR_PAYHERO_API_USERNAME',
    password: process.env.PAYHERO_API_PASSWORD || 'YOUR_PAYHERO_API_PASSWORD',
    channelId: process.env.PAYHERO_CHANNEL_ID || process.env.PAYHERO_MERCHANT_ID || 'YOUR_CHANNEL_ID',
    provider: process.env.PAYHERO_PROVIDER || 'sasapay',
    networkCode: process.env.PAYHERO_NETWORK_CODE || '63902',
    callbackUrl: process.env.PAYHERO_CALLBACK_URL || 'https://your-public-url/api/callback',
    baseUrl: process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke/api/v2',
    apiUrl: process.env.PAYHERO_API_URL || ''
};

if (config.username.startsWith('YOUR_') || config.password.startsWith('YOUR_') || config.channelId.startsWith('YOUR_')) {
    console.warn('Warning: Payhero credentials are not configured. Set environment variables before using Payhero.');
}

function getCheckoutUrlFromResponse(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    return data.checkoutUrl || data.paymentUrl || data.redirectUrl || data.url || data.data?.checkoutUrl || data.data?.paymentUrl;
}

function getPaymentReferenceFromResponse(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    return data.CheckoutRequestID || data.checkout_request_id || data.reference || data.data?.CheckoutRequestID || data.data?.reference || null;
}

async function createPayheroPayment(amount, phone) {
    const externalReference = `INV-${Date.now()}`;
    const basePayload = {
        amount,
        phone_number: phone,
        provider: config.provider,
        external_reference: externalReference,
        callback_url: config.callbackUrl
    };

    if (config.channelId && !config.channelId.startsWith('YOUR_')) {
        basePayload.channel_id = Number.isNaN(Number(config.channelId)) ? config.channelId : Number(config.channelId);
    }

    if (config.provider === 'sasapay') {
        basePayload.network_code = config.networkCode;
    }

    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const headers = {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
    };

    async function tryPost(url, payload) {
        try {
            console.log('Trying Payhero URL:', url, 'payloadKeys:', Object.keys(payload).join(', '));
            const response = await axios.post(url, payload, { headers });
            return { success: true, data: response.data };
        } catch (error) {
            const status = error.response?.status;
            const responseData = error.response?.data;
            if (status === 404) {
                console.warn('Payhero URL not found:', url);
                return { success: false, notFound: true };
            }

            console.warn('Payhero request failed:', {
                url,
                status,
                payloadKeys: Object.keys(payload),
                responseData
            });

            return {
                success: false,
                error: Object.assign(new Error(`Payhero request failed ${status || ''}`.trim()), {
                    status,
                    responseData,
                    url,
                    payload
                })
            };
        }
    }

    async function tryUrl(url) {
        const result = await tryPost(url, basePayload);
        if (result.success) {
            return result.data;
        }
        if (result.notFound) {
            return null;
        }
        throw result.error;
    }

    let lastError = null;
    if (config.apiUrl) {
        const apiUrl = config.apiUrl.replace(/\/+$/, '');
        try {
            return await tryUrl(apiUrl);
        } catch (error) {
            lastError = error;
            throw lastError;
        }
    }

    const candidatePaths = [
        '/payments',
        '/payment',
        '/payment/create',
        '/payment/init',
        '/checkout',
        '/charge',
        '/transaction',
        '/transactions',
        '/invoices',
        '/v2/payments',
        '/v1/payments'
    ];

    const base = config.baseUrl.replace(/\/+$/, '');
    for (const path of candidatePaths) {
        const apiUrl = base + path;
        try {
            return await tryUrl(apiUrl);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`Unable to find a valid Payhero endpoint. Tried ${candidatePaths.length} candidate paths based on base URL ${base}`);
}

app.get('/', (req, res) => {
    res.redirect('/payment.html');
});

app.get('/qrcode', async (req, res) => {
    try {
        const origin = `${req.protocol}://${req.get('host')}`;
        const paymentUrl = `${origin}/payment.html`;
        const qrDataUrl = await QRCode.toDataURL(paymentUrl, { margin: 2, width: 320 });

        res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Scan to Pay</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 30px; background: #f5f5f5; }
        .card { display: inline-block; background: #ffffff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
        img { width: 320px; height: 320px; }
        a { color: #1a73e8; word-break: break-all; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Scan to pay</h1>
        <p>Scan this QR code to open the payment page.</p>
        <img src="${qrDataUrl}" alt="Payment QR Code" />
        <p><a href="${paymentUrl}">${paymentUrl}</a></p>
    </div>
</body>
</html>`);
    } catch (error) {
        console.error('QR code error:', error);
        res.status(500).send('Unable to generate QR code');
    }
});

app.post('/api/payhero', async (req, res) => {
    const { amount, phone } = req.body;

    if (!amount || !phone) {
        return res.status(400).json({ success: false, message: 'Missing amount or phone' });
    }

    try {
        const data = await createPayheroPayment(amount, phone);
        const checkoutUrl = getCheckoutUrlFromResponse(data);
        const paymentReference = getPaymentReferenceFromResponse(data);

        res.json({
            success: true,
            message: checkoutUrl ? 'Payhero checkout created successfully' : 'Payhero STK push created successfully. Check your phone to complete payment.',
            checkoutUrl,
            paymentReference,
            status: data?.status,
            manualInstructions: data?.manual_instructions,
            paymentData: data
        });
    } catch (error) {
        console.error('Payhero payment error:', {
            message: error.message,
            status: error.status,
            responseData: error.responseData,
            url: error.url
        });

        const status = Number.isInteger(error.status) ? error.status : 500;
        res.status(status).json({
            success: false,
            message: error.responseData?.message || error.message || 'Payment initiation failed',
            details: error.responseData || { url: error.url }
        });
    }
});

app.use(express.static('public')); // Place payment.html in 'public' folder

app.post('/api/callback', (req, res) => {
    console.log('Payhero callback received:', JSON.stringify(req.body, null, 2));

    // Process callback for your business logic.
    // Example payload fields may include: paymentId, status, amount, phoneNumber.
    const { paymentId, status, amount, phoneNumber } = req.body;
    if (status === 'COMPLETED') {
        console.log('Payment completed:', { paymentId, amount, phoneNumber });
    } else {
        console.log('Payment callback status:', status, { paymentId, amount, phoneNumber });
    }

    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
