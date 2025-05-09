/**
 * Receipt Extractor - Cloudflare Worker
 *
 * This worker accepts receipt images and sends them to the Gemini API for processing.
 * It returns the extracted information as JSON following a specific schema.
 * API is secured with an API key authentication.
 */

export interface Env {
  // Gemini API key should be added as a secret
  GEMINI_API_KEY: string;
  // API Key for authentication
  API_KEY: string;
  // Optional configuration
  GEMINI_MODEL?: string;
  GEMINI_TEMPERATURE?: string;
  GEMINI_MAX_OUTPUT_TOKENS?: string;
  PROMPT_TEMPLATE?: string;
  // Flag to use structured schema or not
  USE_SCHEMA?: string;
}

/**
 * Default structured schema for receipt data
 */
const DEFAULT_SCHEMA = {
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
};

/**
 * Main worker function that handles incoming requests
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Add CORS headers to allow API access from other domains
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };

    // Handle OPTIONS request (preflight CORS request)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Check if the request is a POST with an image
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'This API only accepts POST requests with image data' }), {
        status: 405,
        headers: {
          'Allow': 'POST, OPTIONS',
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Verify API key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is required. Please provide it in the X-API-Key header or as a Bearer token in the Authorization header.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Check if the API key is valid
    if (apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Invalid API key.' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    try {
      // Handle different content types
      const contentType = request.headers.get('content-type') || '';

      let imageData: ArrayBuffer;

      if (contentType.includes('multipart/form-data')) {
        // Process form data
        const formData = await request.formData();
        const imageFile = formData.get('image');

        if (!imageFile || !(imageFile instanceof File)) {
          return new Response(JSON.stringify({ error: 'Please include an image file with the key "image"' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        imageData = await imageFile.arrayBuffer();
      } else if (contentType.includes('image/')) {
        // Direct image upload
        imageData = await request.arrayBuffer();
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported content type. Please upload an image directly or use multipart/form-data.' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Check if we have image data
      if (!imageData || imageData.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'Invalid or empty image data' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Determine if we should use the structured schema
      const useSchema = env.USE_SCHEMA?.toLowerCase() === 'true' || env.USE_SCHEMA === '1';

      // Send to Gemini API for processing
      const extractedData = await extractReceiptDataWithGemini(imageData, env, useSchema);

      // Return the extracted data
      return new Response(JSON.stringify(extractedData), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error processing receipt image:', error);
      return new Response(JSON.stringify({
        error: `Error processing receipt: ${error.message}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Function to encode image data as base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Default prompt template for receipt extraction
 */
const DEFAULT_PROMPT_TEMPLATE = "Extract all information from this receipt. Please include date, merchant name, items purchased, prices, total amount, payment method, and any other relevant information. Format the response as a JSON object.";

/**
 * Structured schema prompt template
 */
const SCHEMA_PROMPT_TEMPLATE = `Extract the following information from this receipt image and return it as a valid JSON object:

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

Format numbers as decimal values without currency symbols (e.g., 10.99 not $10.99).
If any required field is not found on the receipt, use reasonable defaults:
- For missing VAT or service charge, use 0
- For missing datetime, use a reasonable estimate based on any date information visible
- Always convert currencies to numerical values

The response MUST follow this exact JSON structure:
{
  "merchant_name": string,
  "datetime": string,
  "items": [
    {
      "name": string,
      "price": number,
      "count": integer
    }
  ],
  "sub_total": number,
  "vat": number,
  "service_charge": number,
  "total": number
}`;

/**
 * Function to send the image to Gemini API and extract receipt data
 */
async function extractReceiptDataWithGemini(imageData: ArrayBuffer, env: Env, useSchema: boolean = false): Promise<any> {
  // Get configuration from environment variables or use defaults
  const modelName = env.GEMINI_MODEL || 'gemini-pro-vision';
  const temperature = parseFloat(env.GEMINI_TEMPERATURE || '0.1');
  const maxOutputTokens = parseInt(env.GEMINI_MAX_OUTPUT_TOKENS || '800', 10);

  // Choose the appropriate prompt template based on useSchema flag
  let promptTemplate;
  if (useSchema) {
    promptTemplate = env.PROMPT_TEMPLATE || SCHEMA_PROMPT_TEMPLATE;
  } else {
    promptTemplate = env.PROMPT_TEMPLATE || DEFAULT_PROMPT_TEMPLATE;
  }

  // Convert image to base64
  const base64Image = arrayBufferToBase64(imageData);

  // Create the request to Gemini API
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  const requestData: any = {
    contents: [
      {
        parts: [
          {
            text: promptTemplate
          },
          {
            inline_data: {
              mime_type: "image/jpeg", // Assuming JPEG, but Gemini handles various formats
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature,
      topP: 0.1,
      topK: 16,
      maxOutputTokens,
    }
  };

  // If using schema, add schema parameter for structured output if the model supports it
  if (useSchema && modelName.includes('gemini-1.5')) {
    requestData.tools = [{
      functionDeclarations: [{
        name: "extract_receipt_data",
        description: "Extracts structured data from a receipt image",
        parameters: DEFAULT_SCHEMA
      }]
    }];

    // Add tool choice for models that support structured output
    requestData.toolConfig = {
      toolChoice: {
        functionCall: {
          name: "extract_receipt_data"
        }
      }
    };
  }

  // Send request to Gemini API
  const response = await fetch(`${apiUrl}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const geminiResponse = await response.json();

  // Extract and parse the JSON from Gemini's response
  let extractedData;

  try {
    // Check for function calls first (for structured schema with Gemini 1.5+)
    const functionCall = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (functionCall && functionCall.name === 'extract_receipt_data') {
      // Parse the function arguments as JSON
      return JSON.parse(functionCall.args);
    }

    // Traditional response handling
    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Unexpected Gemini API response format');
    }

    // Try to parse JSON from the text response
    // Sometimes Gemini might wrap the JSON in markdown code blocks
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                      responseText.match(/```\n([\s\S]*?)\n```/) ||
                      [null, responseText];

    const jsonText = jsonMatch[1] || responseText;
    extractedData = JSON.parse(jsonText.trim());

    // If we're using the schema, validate the response against our schema
    if (useSchema) {
      extractedData = validateAndCleanResponseForSchema(extractedData);
    }
  } catch (error) {
    // If parsing fails, return the raw text
    extractedData = {
      raw_text: geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No text found in response',
      error: 'Failed to parse JSON from Gemini response'
    };
  }

  return extractedData;
}

/**
 * Validates and cleans the response to conform to our schema
 */
function validateAndCleanResponseForSchema(data: any): any {
  // Create a clean object with default values
  const cleanData: any = {
    merchant_name: data.merchant_name || data.merchantName || data.merchant || "",
    datetime: data.datetime || data.date || data.dateTime || "",
    items: [],
    sub_total: ensureNumber(data.sub_total || data.subTotal || data.subtotal || 0),
    vat: ensureNumber(data.vat || data.tax || 0),
    service_charge: ensureNumber(data.service_charge || data.serviceCharge || data.tip || 0),
    total: ensureNumber(data.total || 0)
  };

  // Process items if they exist
  if (Array.isArray(data.items)) {
    cleanData.items = data.items.map((item: any) => {
      return {
        name: item.name || item.description || "",
        price: ensureNumber(item.price || item.unit_price || 0),
        count: ensureInteger(item.count || item.quantity || 1)
      };
    });
  }

  return cleanData;
}

/**
 * Ensures a value is a number
 */
function ensureNumber(value: any): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove any currency symbols or commas
    const cleaned = value.replace(/[$€£¥,]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

/**
 * Ensures a value is an integer
 */
function ensureInteger(value: any): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof value === 'number') {
    return Math.round(value);
  }

  return 1;
}
