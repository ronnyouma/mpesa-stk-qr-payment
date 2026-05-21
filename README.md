# payhero-qr-payment

This project is a Payhero payment demo.

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

## Payhero credentials

Set these environment variables before starting the app:

- `PAYHERO_API_USERNAME`
- `PAYHERO_API_PASSWORD`
- `PAYHERO_MERCHANT_ID`
- `PAYHERO_CALLBACK_URL`
- `PAYHERO_BASE_URL` (e.g. `https://backend.payhero.co.ke/api/v2`)
- `PAYHERO_API_URL` (optional; set this when the full payment endpoint path is known, such as `https://backend.payhero.co.ke/api/v2/payments`)

If `PAYHERO_API_URL` is not provided, the app will try a set of common Payhero payment paths under `PAYHERO_BASE_URL`.

If Payhero responds with HTTP 400, the app now logs the response body and tries common phone field names (`phoneNumber`, `msisdn`, `mobileNumber`, `phone`, `customerPhoneNumber`).

Example in PowerShell:

```powershell
$env:PAYHERO_API_USERNAME = 'YOUR_PAYHERO_API_USERNAME'
$env:PAYHERO_API_PASSWORD = 'YOUR_PAYHERO_API_PASSWORD'
$env:PAYHERO_MERCHANT_ID = 'your-merchant-id'
$env:PAYHERO_CALLBACK_URL = 'https://your-ngrok-url.ngrok.io/api/callback'
$env:PAYHERO_BASE_URL = 'https://backend.payhero.co.ke/api/v2'
# Optional full endpoint override if needed:
$env:PAYHERO_API_URL = 'https://backend.payhero.co.ke/api/v2/payments'
start-local.cmd
```

If Payhero provides a sandbox URL, set `PAYHERO_BASE_URL` to that sandbox endpoint.

## Callback URL

Payhero requires a public HTTPS callback URL.

For local testing, use a tunnel such as `ngrok`:

```powershell
ngrok http 3000
```

Then use the given HTTPS URL in `PAYHERO_CALLBACK_URL`, for example:

```text
https://abcd1234.ngrok.io/api/callback
```

## Payment page

The app serves the payment form from `public/payment.html`.

- Amount and phone input are validated in the browser.
- The form sends a POST request to `/api/payhero`.
- Payhero sends payment confirmation to `/api/callback`.

## QR code link

Open:

```text
http://localhost:3000/qrcode
```

This generates a QR code that points to the payment page.

## Deploy to Render

This project is ready for deployment to Render.

1. Create a new Web Service on Render.
2. Connect your GitHub repository `payhero-qr-payment`.
3. Set the build command to:

```bash
npm install
```

4. Set the start command to:

```bash
npm start
```

5. Add the following environment variables in Render:

- `PAYHERO_API_USERNAME`
- `PAYHERO_API_PASSWORD`
- `PAYHERO_MERCHANT_ID`
- `PAYHERO_CALLBACK_URL`
- `PAYHERO_BASE_URL`
- `PAYHERO_API_URL` (optional; only if you need to override the full payment endpoint path)

6. Deploy the service.

Once deployed, use the Render URL and set `PAYHERO_CALLBACK_URL` to your public HTTPS callback endpoint, for example:

```text
https://your-app.onrender.com/api/callback
```

## Publish to GitHub

To push this repository to GitHub, run:

```bash
git init
git add .
git commit -m "Initial commit for payhero-qr-payment"
git remote add origin https://github.com/<your-github-username>/payhero-qr-payment.git
git branch -M main
git push -u origin main
```

Replace `<your-github-username>` with your GitHub username.
