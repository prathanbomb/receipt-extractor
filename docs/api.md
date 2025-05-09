# Receipt Extractor API Documentation

## Overview

The Receipt Extractor API is a service that extracts structured data from receipt images using Google's Gemini API. This API allows you to convert unstructured receipt images into structured, machine-readable JSON data.

## Base URL

```
https://your-worker-url.workers.dev/
```

Replace `your-worker-url` with your actual Cloudflare Worker URL.

## Authentication

The API is secured with API key authentication. You must include your API key in every request using one of the following methods:

1. **X-API-Key Header** (recommended):
```
X-API-Key: your-api-key-here
```

2. **Authorization Header** (Bearer token):
```
Authorization: Bearer your-api-key-here
```

### API Key Setup

Set up your API key using Wrangler:

```bash
npx wrangler secret put API_KEY
```

When prompted, enter a strong and secure API key. This key will be securely stored and only accessible from your worker.

### Security Best Practices

- Keep your API key secret and never share it publicly
- Use HTTPS for all requests to ensure the API key is transmitted securely
- Regularly rotate your API key
- Consider implementing additional security measures like IP whitelisting for production environments

## Configuration

The API can be configured with the following parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `GEMINI_MODEL` | The Gemini model to use | `gemini-pro-vision` |
| `GEMINI_TEMPERATURE` | Controls randomness (0.0 to 1.0) | `0.1` |
| `GEMINI_MAX_OUTPUT_TOKENS` | Maximum output length | `800` |
| `USE_SCHEMA` | Use structured schema output | `true` |
| `PROMPT_TEMPLATE` | Custom prompt template for extraction | See below |

Default prompt template (when `USE_SCHEMA` is `false`):
```
Extract all information from this receipt. Please include date, merchant name, items purchased, prices, total amount, payment method, and any other relevant information. Format the response as a JSON object.
```

Structured schema prompt template (when `USE_SCHEMA` is `true`):
```
Extract the following information from this receipt image and return it as a valid JSON object:

1. "merchant_name": The name of the store or business (string)
2. "datetime": The date and time of the transaction (string in ISO format when possible)
3. "items": An array of purchased items, where each item has:
   - "name": Item description (string)
   - "price": Individual item price (number, not string)
   - "count": Quantity of this item (integer)
4. "sub_total": The subtotal before tax, VAT or service charges (number)
5. "vat": The VAT or tax amount (number)
6. "service_charge": Any service charges or tips (number, use 0 if none)
7. "total": The final total amount (number)

Format numbers as decimal values without currency symbols.
```

These parameters can be configured in the `wrangler.jsonc` file or set as secrets for the Cloudflare Worker.

## Structured Data Schema

When `USE_SCHEMA` is enabled (default), the API returns data in a consistent structured format with the following JSON schema:

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "price": {
            "type": "number"
          },
          "count": {
            "type": "integer"
          }
        },
        "required": [
          "name",
          "price",
          "count"
        ]
      }
    },
    "vat": {
      "type": "number"
    },
    "service_charge": {
      "type": "number"
    },
    "merchant_name": {
      "type": "string"
    },
    "datetime": {
      "type": "string"
    },
    "sub_total": {
      "type": "number"
    },
    "total": {
      "type": "number"
    }
  },
  "required": [
    "vat",
    "service_charge",
    "merchant_name",
    "datetime",
    "sub_total",
    "total"
  ]
}
```

The API includes additional logic to validate, clean, and coerce data to ensure it conforms to this schema. For example:
- String prices are converted to numbers
- Missing fields are populated with appropriate defaults (0 for numbers, "" for strings)
- Field names are normalized (e.g., "subtotal", "subTotal", and "sub_total" all map to "sub_total")
- String quantities are converted to integers

## Endpoints

### Extract Receipt Data

```
POST /
```

Extracts information from a receipt image.

#### Request

The API supports two methods for uploading receipt images:

**Method 1: Direct Image Upload**

Send the raw image data directly in the request body:

- Content-Type: Must match the image format (e.g., `image/jpeg`, `image/png`)
- X-API-Key: Your API key
- Body: Raw binary image data

Example:
```
POST / HTTP/1.1
Host: your-worker-url.workers.dev
Content-Type: image/jpeg
X-API-Key: your-api-key-here

[Binary image data]
```

**Method 2: Multipart Form Data**

Send the image as part of a form:

- Content-Type: `multipart/form-data`
- X-API-Key: Your API key
- Form fields:
  - `image`: The receipt image file

Example:
```
POST / HTTP/1.1
Host: your-worker-url.workers.dev
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
X-API-Key: your-api-key-here

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="image"; filename="receipt.jpg"
Content-Type: image/jpeg

[Binary image data]
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### Response

**Success Response (200 OK)**

With structured schema enabled (default):

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

With structured schema disabled:

The response will vary based on the receipt content but will include all relevant information extracted from the receipt.

**Error Response (4xx or 5xx)**

```json
{
  "error": "Error message describing the issue"
}
```

#### Common Error Codes

- `400 Bad Request`: Invalid image format, missing image, or other client errors
- `401 Unauthorized`: Missing API key
- `403 Forbidden`: Invalid API key
- `405 Method Not Allowed`: Only POST method is supported
- `500 Internal Server Error`: Server-side error or issue with the Gemini API

## CORS Support

The API includes CORS headers to allow cross-origin requests from any domain:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key`

This allows you to call the API directly from browser-based JavaScript applications.

## Rate Limiting

There are currently no explicit rate limits implemented in the API. However, the underlying Gemini API may have its own rate limits that could affect the service.

For production environments, consider implementing rate limiting based on:
- API key
- Client IP address
- Request frequency

## Model Selection and Structured Output

For the best structured output results, it's recommended to use the `gemini-1.5-pro-vision` model, which has better support for structured outputs. When using this model with `USE_SCHEMA=true`, the API will use Gemini's function calling capability to get more consistent structured results.

Available Gemini models:
- `gemini-pro-vision`: The standard Gemini Pro Vision model
- `gemini-1.5-pro-vision`: The advanced Gemini 1.5 Pro Vision model (if available)

## Customizing the Prompt

You can customize the prompt template used to extract information from receipts by setting the `PROMPT_TEMPLATE` secret:

```bash
npx wrangler secret put PROMPT_TEMPLATE
```

When customizing the prompt with `USE_SCHEMA=true`, ensure your prompt clearly instructs the model to follow the structured output format.

## Example Usage

### cURL

```bash
# Method 1: Direct upload
curl -X POST \
  -H "Content-Type: image/jpeg" \
  -H "X-API-Key: your-api-key-here" \
  --data-binary "@path/to/receipt.jpg" \
  https://your-worker-url.workers.dev/

# Method 2: Form data
curl -X POST \
  -H "X-API-Key: your-api-key-here" \
  -F "image=@path/to/receipt.jpg" \
  https://your-worker-url.workers.dev/
```

### JavaScript

```javascript
// Method 1: Using FormData (recommended)
const formData = new FormData();
formData.append('image', imageFile); // imageFile is a File object

fetch('https://your-worker-url.workers.dev/', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key-here'
  },
  body: formData
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Method 2: Direct upload
fetch('https://your-worker-url.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'image/jpeg', // Match your image format
    'X-API-Key': 'your-api-key-here'
  },
  body: imageBlob // imageBlob is a Blob object
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### Python

```python
import requests

# Method 1: Using files parameter (multipart/form-data)
with open('path/to/receipt.jpg', 'rb') as f:
    response = requests.post(
        'https://your-worker-url.workers.dev/',
        headers={'X-API-Key': 'your-api-key-here'},
        files={'image': ('receipt.jpg', f, 'image/jpeg')}
    )

# Method 2: Direct upload
with open('path/to/receipt.jpg', 'rb') as f:
    image_data = f.read()
    response = requests.post(
        'https://your-worker-url.workers.dev/',
        headers={
            'Content-Type': 'image/jpeg',
            'X-API-Key': 'your-api-key-here'
        },
        data=image_data
    )

if response.ok:
    receipt_data = response.json()
    print(receipt_data)
else:
    print(f"Error: {response.status_code}")
    print(response.text)
```

## Client Libraries

For easier integration, see the example client libraries included in the project:

- `examples/receipt-extractor-client.js`: JavaScript client
- `examples/receipt_extractor_client.py`: Python client

These clients handle authentication, error handling, and data validation for you.

## Data Processing and Schema Validation

The API includes a validation and normalization process to ensure that the response data conforms to the required schema:

1. Field name normalization - Different naming conventions from Gemini are mapped to the expected schema names:
   - `merchantName` or `merchant` → `merchant_name`
   - `date` or `dateTime` → `datetime`
   - `subTotal` or `subtotal` → `sub_total`
   - `tax` → `vat`
   - `serviceCharge` or `tip` → `service_charge`

2. Data type conversion:
   - Price strings with currency symbols (e.g., "$10.99") are converted to numeric values (10.99)
   - String quantities are converted to integers
   - Missing values are populated with appropriate defaults (0 for numbers, "" for strings)

3. Item processing:
   - Each item is ensured to have `name`, `price`, and `count` properties
   - Item descriptions may be normalized from various fields (`description`, `name`, etc.)
   - If quantity/count is missing, defaults to 1

This processing ensures that your applications always receive consistently structured data, even if the raw Gemini API response varies.

## Limitations

- The API currently supports common image formats (JPEG, PNG, GIF, etc.)
- Image size may be limited by Cloudflare's request size limits
- The accuracy of extraction depends on the quality of the input image and the capabilities of the Gemini API
- Very long receipts or receipts with unusual formatting may result in partial extraction
- Different Gemini models may have different capabilities and limitations
- For structured output, the `gemini-1.5-pro-vision` model generally produces more consistent results

## Troubleshooting

If you encounter issues with the API:

1. **Authentication Issues**:
   - Ensure your API key is correct and included in the request headers
   - Check for any spaces or special characters that might need to be URL-encoded
   - Verify you're using the correct header (`X-API-Key` or `Authorization: Bearer`)

2. **Request Issues**:
   - Ensure your image is in a supported format
   - Check that the image size is within reasonable limits
   - Verify content types match the actual format of your data

3. **Response Issues**:
   - If using `USE_SCHEMA=true`, ensure your application can handle the structured format
   - For poor extraction results, try a different Gemini model or adjust the temperature
   - If specific fields are consistently missing, consider customizing the prompt template

4. **Server Issues**:
   - Check Cloudflare logs for any errors
   - Verify the Gemini API key is correctly set and valid
   - Check for any rate limiting or quota issues with the Gemini API

For additional help, see the provided client libraries which include error handling and validation functionality.
