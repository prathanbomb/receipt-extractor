# Receipt Extractor API - Deployment Guide

This guide will help you deploy the Receipt Extractor API to Cloudflare Workers.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account
- Google Gemini API key

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/receipt-extractor.git
cd receipt-extractor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your Cloudflare Account

If you haven't already, log in to your Cloudflare account with Wrangler:

```bash
npx wrangler login
```

### 4. Add Required API Keys as Secrets

Add the necessary API keys as secrets to your worker:

```bash
# Add your Gemini API key for connecting to Google's API
npx wrangler secret put GEMINI_API_KEY

# Add your authentication API key for securing your own API
npx wrangler secret put API_KEY
```

When prompted, enter your API keys. These keys will be securely stored and only accessible from your worker.

#### Creating a Secure API Key

For the `API_KEY` that will be used to authenticate requests to your API, create a strong, random key. You can generate one using:

```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows with PowerShell
$bytes = New-Object Byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Use this generated value when prompted for your `API_KEY`.

### 5. Customize Your Prompt Template (Optional)

If you want to customize how receipt data is extracted, you can set a custom prompt:

```bash
npx wrangler secret put PROMPT_TEMPLATE
```

### 6. Configure Gemini Model and Parameters (Optional)

You can customize the API behavior by modifying the environment variables in `wrangler.jsonc`:

```json
"vars": {
  "GEMINI_MODEL": "gemini-pro-vision",
  "GEMINI_TEMPERATURE": "0.1",
  "GEMINI_MAX_OUTPUT_TOKENS": "800",
  "USE_SCHEMA": "true"
}
```

Available configuration options:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `GEMINI_MODEL` | The Gemini model to use | `gemini-pro-vision` |
| `GEMINI_TEMPERATURE` | Controls randomness (0.0 to 1.0) | `0.1` |
| `GEMINI_MAX_OUTPUT_TOKENS` | Maximum output length | `800` |
| `USE_SCHEMA` | Use structured schema output | `true` |

### 7. Configure Different Environments (Optional)

You can set different configurations for development and production environments:

```json
"env": {
  "production": {
    "vars": {
      "GEMINI_MODEL": "gemini-1.5-pro-vision",
      "USE_SCHEMA": "true"
    }
  },
  "development": {
    "vars": {
      "GEMINI_MODEL": "gemini-pro-vision",
      "USE_SCHEMA": "false"
    }
  }
}
```

You can deploy to specific environments with:
```bash
npx wrangler deploy --env production
```

### 8. Deploy to Cloudflare

Deploy your worker to Cloudflare:

```bash
npm run deploy
```

This will build and deploy your worker to Cloudflare. After successful deployment, you'll receive a URL for your worker (e.g., `https://receipt-extractor.yourusername.workers.dev`).

### 9. Test Your Deployment

You can test your deployment using curl:

```bash
# Replace with your actual API key and worker URL
curl -X POST \
  -H "X-API-Key: your-api-key-here" \
  -F "image=@path/to/receipt.jpg" \
  https://receipt-extractor.yourusername.workers.dev/
```

## Security Considerations

### API Key Security

1. **Secret Management**:
   - Never commit API keys to version control
   - Use Wrangler secrets for storing sensitive information
   - Consider using a secrets management service for production environments

2. **API Key Best Practices**:
   - Use a strong, random key (at least 32 characters)
   - Regularly rotate your API key
   - Use different keys for development and production

3. **Additional Security Measures**:
   - Configure CORS restrictions for production environments if needed
   - Consider implementing IP-based restrictions
   - Implement rate limiting for production deployments

### Handling Sensitive Receipt Data

Receipt images may contain sensitive information such as:
- Credit card numbers (partial or full)
- Personal contact information
- Purchase history

Ensure your application:
- Does not log or store receipt images unnecessarily
- Follows data protection regulations for your region
- Implements appropriate data retention policies

## Custom Domains (Optional)

If you want to use a custom domain for your API:

1. Go to the Cloudflare Workers dashboard
2. Select your worker
3. Click on "Triggers" and then "Custom Domains"
4. Follow the instructions to set up a custom domain

## Monitoring and Logs

To view logs from your worker:

```bash
npx wrangler tail
```

You can also set up alerts and monitoring through the Cloudflare dashboard.

## Troubleshooting

If you encounter issues with your deployment:

1. Check your worker logs: `npx wrangler tail`
2. Verify your API keys are correctly set
3. Test locally with `npm run dev` before deploying
4. Check that the Gemini model specified in your configuration is actually available
5. Try decreasing the `GEMINI_MAX_OUTPUT_TOKENS` value if you're getting timeouts
6. Ensure your images are not too large (Cloudflare has request size limits)

### Common Issues

#### Authentication Issues

- **401 Unauthorized**: API key is missing in the request
- **403 Forbidden**: API key is invalid

Try testing with curl to verify your API key is working:

```bash
curl -X POST \
  -H "X-API-Key: your-api-key-here" \
  -F "image=@path/to/receipt.jpg" \
  https://your-worker-url.workers.dev/
```

#### API Processing Issues

- **Error: Gemini API error (400): Invalid request**
  - Check that your API key is valid and has access to the specified model
  - Verify that your image is in a supported format
  - Try simplifying your prompt template

- **Error: Unexpected Gemini API response format**
  - Try a different Gemini model
  - Check that your prompt is properly instructing the model to return JSON

- **Error: Failed to parse JSON from Gemini response**
  - The model might be returning non-JSON content
  - Try adjusting the temperature parameter to get more consistent output
  - Make sure your prompt explicitly asks for JSON format

For more help, refer to:
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI documentation](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Google Gemini API documentation](https://ai.google.dev/docs)
