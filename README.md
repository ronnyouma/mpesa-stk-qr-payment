# stk-push

This project is a Safaricom Daraja STK Push demo.

## Local setup using bundled Node

The project includes a local portable Node runtime under `.node/node-v20.16.0-win-x64`.

> Note: the portable runtime is only used for local development when your machine does not have global Node.js installed.

### Install dependencies

From `c:\Users\LENOVO\stk-push`:

```powershell
install-local.cmd
```

### Start the server

```powershell
start-local.cmd
```

Then open:

```text
http://localhost:3000/payment.html
```

## Daraja credentials

Set these environment variables before starting the app:

- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_PASSKEY`
- `DARAJA_TILL_NUMBER`
- `DARAJA_SHORTCODE` (optional; defaults to `DARAJA_TILL_NUMBER`)
- `DARAJA_CALLBACK_URL`

Example in PowerShell:

```powershell
$env:DARAJA_CONSUMER_KEY = 'your-consumer-key'
$env:DARAJA_CONSUMER_SECRET = 'your-consumer-secret'
$env:DARAJA_PASSKEY = 'your-passkey'
$env:DARAJA_TILL_NUMBER = '4287364'
$env:DARAJA_SHORTCODE = '4287364'
$env:DARAJA_CALLBACK_URL = 'https://your-ngrok-url.ngrok.io/api/callback'
start-local.cmd
```

## Callback URL

Safaricom requires a public HTTPS callback URL for Daraja.

For local testing, use a tunnel such as `ngrok`:

```powershell
ngrok http 3000
```

Then use the given HTTPS URL in `DARAJA_CALLBACK_URL`, for example:

```text
https://abcd1234.ngrok.io/api/callback
```

## Payment page

The app serves the payment form from `public/payment.html`.

- Amount and phone input are validated in the browser.
- The form sends a POST request to `/api/stkpush`.
- Daraja sends payment confirmation to `/api/callback`.

## QR code link

Open:

```text
http://localhost:3000/qrcode
```

This generates a QR code that points to the payment page.

## Deploy to Render

This project is ready for deployment to Render.

1. Create a new Web Service on Render.
2. Connect your GitHub repository `mpesa-stk-qr-payment`.
3. Set the build command to:

```bash
npm install
```

4. Set the start command to:

```bash
npm start
```

5. Add the following environment variables in Render:

- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_PASSKEY`
- `DARAJA_TILL_NUMBER`
- `DARAJA_SHORTCODE`
- `DARAJA_CALLBACK_URL`

6. Deploy the service.

Once deployed, use the Render URL and set `DARAJA_CALLBACK_URL` to your public HTTPS callback endpoint.

## Publish to GitHub

To push this repository to GitHub, run:

```bash
git init
git add .
git commit -m "Initial commit for mpesa-stk-qr-payment"
git remote add origin https://github.com/<your-github-username>/mpesa-stk-qr-payment.git
git branch -M main
git push -u origin main
```

Replace `<your-github-username>` with your GitHub username.
