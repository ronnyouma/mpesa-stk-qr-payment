const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const QRCode = require('qrcode');
const app = express();

app.use(cors());
app.use(express.json());

// Your Daraja credentials (get from Safaricom Developer Portal)
// Prefer using environment variables for local development instead of hard-coded secrets.
const config = {
    consumerKey: process.env.DARAJA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET',
    passkey: process.env.DARAJA_PASSKEY || 'YOUR_PASSKEY',
    tillNumber: process.env.DARAJA_TILL_NUMBER || '123456', // Your Till number
    shortCode: process.env.DARAJA_SHORTCODE || process.env.DARAJA_TILL_NUMBER || '123456',
    callbackUrl: process.env.DARAJA_CALLBACK_URL || 'https://your-public-url/api/callback' // Must be HTTPS
};

if (config.consumerKey.startsWith('YOUR_') || config.consumerSecret.startsWith('YOUR_') || config.passkey.startsWith('YOUR_')) {
    console.warn('Warning: Safaricom Daraja credentials are not configured. Set environment variables before using STK Push.');
}

// Get OAuth token from Safaricom
async function getAccessToken() {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Token error:', error.response?.data || error.message);
        throw error;
    }
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

// STK Push endpoint
app.post('/api/stkpush', async (req, res) => {
    const { amount, phone } = req.body;
    
    if (!amount || !phone) {
        return res.status(400).json({ success: false, message: 'Missing amount or phone' });
    }
    
    try {
        const token = await getAccessToken();
        
        // Generate password (required by Safaricom)
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(
            `${config.shortCode}${config.passkey}${timestamp}`
        ).toString('base64');
        
        // Prepare STK Push request
        const stkRequest = {
            BusinessShortCode: config.shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerBuyGoodsOnline', // For Till numbers
            Amount: amount,
            PartyA: phone, // Customer's phone
            PartyB: config.tillNumber, // Your Till
            PhoneNumber: phone,
            CallBackURL: config.callbackUrl,
            AccountReference: `PAY${Date.now()}`,
            TransactionDesc: 'Payment for goods'
        };
        
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkRequest,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('STK Push response:', response.data);
        
        if (response.data.ResponseCode === '0') {
            res.json({ 
                success: true, 
                message: 'STK Push sent successfully',
                checkoutRequestID: response.data.CheckoutRequestID
            });
        } else {
            res.json({ success: false, message: response.data.ResponseDescription });
        }
        
    } catch (error) {
        console.error('STK Push error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.errorMessage || 'Payment initiation failed' 
        });
    }
});

app.use(express.static('public')); // Place payment.html in 'public' folder

// Callback endpoint (Safaricom will send payment confirmation here)
app.post('/api/callback', (req, res) => {
    console.log('Callback received:', JSON.stringify(req.body, null, 2));
    
    // Process the callback data
    const { Body } = req.body;
    if (Body && Body.stkCallback) {
        const { ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
        
        if (ResultCode === 0) {
            // Payment successful
            const metadata = {};
            CallbackMetadata.Item.forEach(item => {
                metadata[item.Name] = item.Value;
            });
            
            console.log('Payment successful!', {
                amount: metadata.Amount,
                phone: metadata.PhoneNumber,
                receipt: metadata.MpesaReceiptNumber
            });
            
            // TODO: Update your database, send confirmation email, etc.
        } else {
            console.log('Payment failed:', ResultDesc);
        }
    }
    
    // Always respond to Safaricom to acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});