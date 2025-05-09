// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Mock environment with API key and configuration
const mockEnv = {
  GEMINI_API_KEY: 'mock-gemini-api-key',
  API_KEY: 'mock-api-key',
  GEMINI_MODEL: 'gemini-pro-vision',
  GEMINI_TEMPERATURE: '0.1',
  GEMINI_MAX_OUTPUT_TOKENS: '800',
  USE_SCHEMA: 'true',
};

// Mock structured response data
const mockStructuredResponse = {
  merchant_name: "Test Store",
  datetime: "2025-05-10T14:30:00",
  items: [
    {
      name: "Test Item 1",
      price: 10.99,
      count: 1
    },
    {
      name: "Test Item 2",
      price: 5.99,
      count: 2
    }
  ],
  sub_total: 22.97,
  vat: 1.84,
  service_charge: 0,
  total: 24.81
};

// Mock unstructured response data
const mockUnstructuredResponse = {
  merchant: "Test Store",
  date: "2025-05-10",
  items: [
    { description: "Test Item 1", price: "$10.99" },
    { description: "Test Item 2", price: "$5.99", quantity: 2 }
  ],
  subtotal: "$22.97",
  tax: "$1.84",
  total: "$24.81"
};

// Mock function call response for Gemini 1.5 models
const mockFunctionCallResponse = {
  candidates: [{
    content: {
      parts: [{
        functionCall: {
          name: "extract_receipt_data",
          args: {
            merchant_name: "Test Store",
            datetime: "2025-05-10T14:30:00",
            items: [
              {
                name: "Test Item 1",
                price: 10.99,
                count: 1
              },
              {
                name: "Test Item 2",
                price: 5.99,
                count: 2
              }
            ],
            sub_total: 22.97,
            vat: 1.84,
            service_charge: 0,
            total: 24.81
          }
        }
      }]
    }
  }]
};

// Mock fetch responses
global.fetch = vi.fn();

describe('Receipt Extractor API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles OPTIONS requests for CORS', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'OPTIONS'
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key');
  });

  it('rejects requests without API key', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: new Uint8Array(10)
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
    const responseData = await response.json();
    expect(responseData.error).toContain('API key is required');
  });

  it('rejects requests with invalid API key', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-API-Key': 'invalid-api-key'
      },
      body: new Uint8Array(10)
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(403);
    const responseData = await response.json();
    expect(responseData.error).toContain('Invalid API key');
  });

  it('accepts API key in X-API-Key header', async () => {
    // Mock successful Gemini API response with structured data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockStructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-API-Key': 'mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(mockStructuredResponse);
  });

  it('accepts API key in Authorization header as Bearer token', async () => {
    // Mock successful Gemini API response with structured data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockStructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Authorization': 'Bearer mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(mockStructuredResponse);
  });

  it('rejects non-POST/OPTIONS requests', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'GET',
      headers: {
        'X-API-Key': 'mock-api-key'
      }
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(405);
    const responseData = await response.json();
    expect(responseData.error).toContain('only accepts POST requests');
  });

  it('handles direct image uploads with structured schema', async () => {
    // Mock successful Gemini API response with structured data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockStructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-API-Key': 'mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();

    // Check that the structured schema is followed
    expect(responseData).toHaveProperty('merchant_name', 'Test Store');
    expect(responseData).toHaveProperty('datetime', '2025-05-10T14:30:00');
    expect(responseData).toHaveProperty('items');
    expect(Array.isArray(responseData.items)).toBe(true);
    expect(responseData.items.length).toBe(2);
    expect(responseData.items[0]).toHaveProperty('name', 'Test Item 1');
    expect(responseData.items[0]).toHaveProperty('price', 10.99);
    expect(responseData.items[0]).toHaveProperty('count', 1);
    expect(responseData).toHaveProperty('sub_total', 22.97);
    expect(responseData).toHaveProperty('vat', 1.84);
    expect(responseData).toHaveProperty('service_charge', 0);
    expect(responseData).toHaveProperty('total', 24.81);
  });

  it('handles function calling with Gemini 1.5 models', async () => {
    // Mock environment with Gemini 1.5 model
    const gemini15Env = {
      ...mockEnv,
      GEMINI_MODEL: 'gemini-1.5-pro-vision'
    };

    // Mock successful Gemini API response with function call
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFunctionCallResponse)
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-API-Key': 'mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, gemini15Env, ctx);

    await waitOnExecutionContext(ctx);

    // Verify the response matches our expected structured data
    expect(response.status).toBe(200);
    const responseData = await response.json();

    // Check for function call parameters
    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toHaveProperty('tools');
    expect(requestBody).toHaveProperty('toolConfig');

    // Check that the structured schema is followed in the response
    expect(responseData).toEqual(mockFunctionCallResponse.candidates[0].content.parts[0].functionCall.args);
  });

  it('handles unstructured responses with data normalization', async () => {
    // Mock environment with unstructured schema
    const unstructuredEnv = {
      ...mockEnv,
      USE_SCHEMA: 'false'
    };

    // Mock successful Gemini API response with unstructured data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockUnstructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-API-Key': 'mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, unstructuredEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();

    // Should match the unstructured data without normalization
    expect(responseData).toEqual(mockUnstructuredResponse);
  });

  it('normalizes unstructured data when schema validation is enabled', async () => {
    // Mock successful Gemini API response with unstructured data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockUnstructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a small test image
    const mockImageData = new Uint8Array(10);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-API-Key': 'mock-api-key'
      },
      body: mockImageData
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();

    // Check that the data has been normalized to match the structured schema
    expect(responseData).toHaveProperty('merchant_name');
    expect(responseData).toHaveProperty('datetime');
    expect(responseData).toHaveProperty('items');
    expect(Array.isArray(responseData.items)).toBe(true);

    // Numbers should be converted from strings
    expect(typeof responseData.sub_total).toBe('number');
    expect(typeof responseData.vat).toBe('number');
    expect(typeof responseData.total).toBe('number');

    // Items should be normalized
    expect(responseData.items[0]).toHaveProperty('name');
    expect(responseData.items[0]).toHaveProperty('price');
    expect(responseData.items[0]).toHaveProperty('count');
    expect(typeof responseData.items[0].price).toBe('number');
    expect(typeof responseData.items[0].count).toBe('number');
  });

  it('handles multipart form data uploads with valid API key', async () => {
    // Mock successful Gemini API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(mockStructuredResponse)
            }]
          }
        }]
      })
    });

    // Create a mock FormData request
    const formData = new FormData();
    const mockImageFile = new File([new Uint8Array(10)], 'receipt.jpg', { type: 'image/jpeg' });
    formData.append('image', mockImageFile);

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'X-API-Key': 'mock-api-key'
      },
      body: formData
    });

    // Mock the formData method
    request.formData = vi.fn().mockResolvedValue(formData);

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(mockStructuredResponse);
  });

  it('handles missing image in form data', async () => {
    // Create a mock FormData request without an image
    const formData = new FormData();
    formData.append('wrong_key', 'some value');

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'X-API-Key': 'mock-api-key'
      },
      body: formData
    });

    // Mock the formData method
    request.formData = vi.fn().mockResolvedValue(formData);

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toContain('include an image file with the key "image"');
  });

  it('handles unsupported content types', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'mock-api-key'
      },
      body: JSON.stringify({ text: 'This is not an image' })
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toContain('Unsupported content type');
  });

  it('handles Gemini API errors', async () => {
    // Mock failed Gemini API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Invalid request')
    });

    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-API-Key': 'mock-api-key'
      },
      body: new Uint8Array(10)
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error).toContain('Error processing receipt');
  });

  it('handles invalid or empty image data', async () => {
    const request = new IncomingRequest('http://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-API-Key': 'mock-api-key'
      },
      body: new Uint8Array(0) // Empty array
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);

    await waitOnExecutionContext(ctx);

    // Verify response
    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toContain('Invalid or empty image data');
  });
});
