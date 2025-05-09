# Receipt Extractor API

A Cloudflare Worker API that extracts information from receipt images using Google's Gemini API.

## Features

- Extract structured data from receipt images
- Process images and convert unstructured content to JSON
- Support for direct image uploads and multipart form data
- CORS support for cross-origin requests
- Configurable Gemini API model and parameters
- Structured schema output format
- API key authentication for security

## How It Works

1. Send a receipt image to the API endpoint with your API key
2. The image is converted to base64 and sent to the Gemini API
3. Gemini analyzes the image and extracts relevant receipt information
4. The API returns a JSON object with structured receipt data

## Setup

### Prerequisites

- Node.js (v16 or newer)
- Cloudflare account
- Google Gemini API key (from [Google AI Studio](https://ai.google.dev/))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/receipt-extractor.git
cd receipt-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Add required secrets:
```bash
# Add the Gemini API key
npx wrangler secret put GEMINI_API_KEY

# Add your API key for authenticating clients
npx wrangler secret put API_KEY
```

4. [Optional] Configure custom prompt template:
```bash
npx wrangler secret put PROMPT_TEMPLATE
```

5. Deploy to Cloudflare:
```bash
npm run deploy
```

### Configuration

You can configure the following parameters in the `wrangler.jsonc` file:

```json
"vars": {
  "GEMINI_MODEL": "gemini-pro-vision",
  "GEMINI_TEMPERATURE": "0.1",
  "GEMINI_MAX_OUTPUT_TOKENS": "800",
  "USE_SCHEMA": "true"
}
```

Available parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `GEMINI_MODEL` | The Gemini model to use | `gemini-pro-vision` |
| `GEMINI_TEMPERATURE` | Controls randomness (0.0 to 1.0) | `0.1` |
| `GEMINI_MAX_OUTPUT_TOKENS` | Maximum output length | `800` |
| `USE_SCHEMA` | Use structured schema output | `true` |
| `PROMPT_TEMPLATE` | Custom prompt template for extraction | See code for default |

You can use different configurations for development and production environments:

```json
"env": {
  "production": {
    "vars": {
      "GEMINI_MODEL": "gemini-1.5-pro-vision",
      "USE_SCHEMA": "true"
    }
  }
}
```

### Authentication

The API is secured with an API key. You need to include your API key in every request using one of these methods:

1. **X-API-Key header** (recommended):
```
X-API-Key: your-api-key-here
```

2. **Authorization header** (Bearer token):
```
Authorization: Bearer your-api-key-here
```

You set the API key using the `wrangler secret put API_KEY` command. Keep this key secure and don't share it publicly.

### Structured Schema

When `USE_SCHEMA` is set to `true`, the API returns data in the following structured format:

```json
{
  "merchant_name": "ACME STORE",
  "datetime": "2025-05-10T14:30:00",
  "items": [
    {
      "name": "Apples",
      "price": 3.99,
      "count": 1
    },
    {
      "name": "Bread",
      "price": 2.49,
      "count": 1
    }
  ],
  "sub_total": 10.77,
  "vat": 0.86,
  "service_charge": 0,
  "total": 11.63
}
```

This schema ensures consistent output format with proper data types for numerical values.

### Local Development

Run the development server:
```bash
npm run dev
```

This will start a local development server at http://localhost:8787.

## API Usage

### Direct Image Upload

Send the receipt image directly in the request body:

```bash
curl -X POST \
  -H "Content-Type: image/jpeg" \
  -H "X-API-Key: your-api-key-here" \
  --data-binary "@path/to/receipt.jpg" \
  https://your-worker-url.workers.dev/
```

### Multipart Form Upload

Upload the image as part of a form:

```bash
curl -X POST \
  -H "X-API-Key: your-api-key-here" \
  -F "image=@path/to/receipt.jpg" \
  https://your-worker-url.workers.dev/
```

### Response Example

With `USE_SCHEMA` enabled, the response follows the structured format:

```json
{
  "merchant_name": "ACME STORE",
  "datetime": "2025-05-10T14:30:00",
  "items": [
    {
      "name": "Apples",
      "price": 3.99,
      "count": 1
    },
    {
      "name": "Bread",
      "price": 2.49,
      "count": 1
    },
    {
      "name": "Milk",
      "price": 4.29,
      "count": 1
    }
  ],
  "sub_total": 10.77,
  "vat": 0.86,
  "service_charge": 0,
  "total": 11.63
}
```

### Error Responses

The API returns appropriate HTTP status codes and JSON error messages:

```json
{
  "error": "Error message describing the issue"
}
```

Common error codes:
- 400: Bad Request (invalid image, missing data)
- 401: Unauthorized (missing API key)
- 403: Forbidden (invalid API key)
- 405: Method Not Allowed (only POST is supported)
- 500: Internal Server Error (API processing error)

## Security Considerations

- The API key should be kept secret and only shared with trusted parties
- Use HTTPS for all requests to ensure the API key is transmitted securely
- Consider implementing rate limiting in a production environment
- Regularly rotate the API key to enhance security
- For additional security, consider implementing IP whitelisting

## Integrating with Frontend Applications

You can easily integrate this API with any frontend application. See the examples directory for client implementations in JavaScript and Python.

## Testing

Run tests with:
```bash
npm test
```

## License

MIT
