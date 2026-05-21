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
    merchantId: process.env.PAYHERO_MERCHANT_ID || 'YOUR_MERCHANT_ID',
    callbackUrl: process.env.PAYHERO_CALLBACK_URL || 'https://your-public-url/api/callback',
    baseUrl: process.env.PAYHERO_BASE_URL || 'https://api.payhero.com'
};

if (config.username.startsWith('YOUR_') || config.password.startsWith('YOUR_') || config.merchantId.startsWith('YOUR_')) {
    console.warn('Warning: Payhero credentials are not configured. Set environment variables before using Payhero.');
}

function getCheckoutUrlFromResponse(data) {
    return data.checkoutUrl || data.paymentUrl || data.redirectUrl || data.url || data.data?.checkoutUrl || data.data?.paymentUrl;
}

async function createPayheroPayment(amount, phone) {
    const payload = {
        merchantId: config.merchantId,
        amount,
        currency: 'KES',
        phoneNumber: phone,
        callbackUrl: config.callbackUrl,
        description: 'Payhero payment for goods',
        metadata: {
            source: 'Payhero QR Checkout'
        }
    };

    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const headers = {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
    };

    const response = await axios.post(`${config.baseUrl}/v1/payments`, payload, { headers });
    return response.data;
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

        if (!checkoutUrl) {
            console.error('Payhero response did not include a checkout URL:', data);
            return res.status(500).json({ success: false, message: 'Payment created but checkout URL was not returned' });
        }

        res.json({
            success: true,
            message: 'Payhero payment created successfully',
            checkoutUrl,
            paymentData: data
        });
    } catch (error) {
        console.error('Payhero payment error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.message || error.message || 'Payment initiation failed'
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