/**
 * Example client for the Receipt Extractor API with structured schema support
 *
 * This is a simple example of how to use the Receipt Extractor API
 * from a JavaScript application. You can use this as a starting point
 * for integrating with your own frontend.
 */

/**
 * Process a receipt image using the Receipt Extractor API
 *
 * @param {File} imageFile - The receipt image file to process
 * @param {string} apiUrl - The URL of the Receipt Extractor API
 * @param {Object} [options] - Optional configuration
 * @param {string} options.apiKey - API key for authentication (required)
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel the request
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @param {boolean} [options.validateSchema] - Whether to validate the response schema
 * @returns {Promise<Object>} - The extracted receipt data
 */
async function processReceipt(imageFile, apiUrl, options = {}) {
  // Validate inputs
  if (!imageFile || !(imageFile instanceof File)) {
    throw new Error('Please provide a valid image file');
  }

  if (!apiUrl) {
    throw new Error('API URL is required');
  }

  if (!options.apiKey) {
    throw new Error('API key is required for authentication');
  }

  // Check if the file is an image
  if (!imageFile.type.startsWith('image/')) {
    throw new Error('The provided file is not an image');
  }

  // Create form data for the request
  const formData = new FormData();
  formData.append('image', imageFile);

  // Handle timeout with AbortController if needed
  let controller;
  let signal = options.signal;

  if (options.timeout && !signal) {
    controller = new AbortController();
    signal = controller.signal;

    setTimeout(() => {
      controller.abort();
    }, options.timeout);
  }

  try {
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': options.apiKey
      },
      body: formData,
      signal
    });

    // Check if the request was successful
    if (!response.ok) {
      let errorMessage = 'Failed to process receipt';

      try {
        // Try to parse error message from the response
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If parsing fails, use status text
        errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    // Parse and return the response data
    const data = await response.json();

    // Validate that we got a proper structured response
    if (options.validateSchema !== false) {
      validateStructuredReceiptData(data);
    }

    return data;
  } catch (error) {
    // If the error was caused by a timeout, provide a more helpful message
    if (error.name === 'AbortError' && options.timeout) {
      throw new Error(`Request timed out after ${options.timeout}ms`);
    }

    console.error('Error processing receipt:', error);
    throw error;
  } finally {
    // Clean up the AbortController if we created one
    if (controller) {
      controller = null;
    }
  }
}

/**
 * Process a receipt image from a URL
 *
 * @param {string} imageUrl - The URL of the receipt image
 * @param {string} apiUrl - The URL of the Receipt Extractor API
 * @param {Object} [options] - Optional configuration
 * @param {string} options.apiKey - API key for authentication (required)
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel the request
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @param {boolean} [options.validateSchema] - Whether to validate the response schema
 * @returns {Promise<Object>} - The extracted receipt data
 */
async function processReceiptFromUrl(imageUrl, apiUrl, options = {}) {
  // Validate inputs
  if (!imageUrl) {
    throw new Error('Image URL is required');
  }

  if (!apiUrl) {
    throw new Error('API URL is required');
  }

  if (!options.apiKey) {
    throw new Error('API key is required for authentication');
  }

  try {
    // Handle timeout with AbortController if needed
    let controller;
    let signal = options.signal;

    if (options.timeout && !signal) {
      controller = new AbortController();
      signal = controller.signal;

      setTimeout(() => {
        controller.abort();
      }, options.timeout);
    }

    // Fetch the image from the URL
    const imageResponse = await fetch(imageUrl, { signal });

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    // Get the image blob
    const imageBlob = await imageResponse.blob();

    // Convert blob to file with a name
    const fileName = imageUrl.split('/').pop() || 'receipt.jpg';
    const imageFile = new File([imageBlob], fileName, {
      type: imageBlob.type || 'image/jpeg'
    });

    // Process the image file
    return await processReceipt(imageFile, apiUrl, options);
  } catch (error) {
    console.error('Error processing receipt from URL:', error);
    throw error;
  }
}

/**
 * Process a receipt image directly
 *
 * @param {Blob|ArrayBuffer} imageData - The receipt image data
 * @param {string} apiUrl - The URL of the Receipt Extractor API
 * @param {Object} [options] - Optional configuration
 * @param {string} options.apiKey - API key for authentication (required)
 * @param {string} [options.contentType='image/jpeg'] - The content type of the image
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel the request
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @param {boolean} [options.validateSchema] - Whether to validate the response schema
 * @returns {Promise<Object>} - The extracted receipt data
 */
async function processReceiptDirect(imageData, apiUrl, options = {}) {
  // Validate inputs
  if (!imageData) {
    throw new Error('Image data is required');
  }

  if (!apiUrl) {
    throw new Error('API URL is required');
  }

  if (!options.apiKey) {
    throw new Error('API key is required for authentication');
  }

  const contentType = options.contentType || 'image/jpeg';

  try {
    // Handle timeout with AbortController if needed
    let controller;
    let signal = options.signal;

    if (options.timeout && !signal) {
      controller = new AbortController();
      signal = controller.signal;

      setTimeout(() => {
        controller.abort();
      }, options.timeout);
    }

    // Make the API request with the raw image data
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-API-Key': options.apiKey
      },
      body: imageData,
      signal
    });

    // Check if the request was successful
    if (!response.ok) {
      let errorMessage = 'Failed to process receipt';

      try {
        // Try to parse error message from the response
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If parsing fails, use status text
        errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    // Parse and return the response data
    const data = await response.json();

    // Validate that we got a proper structured response
    if (options.validateSchema !== false) {
      validateStructuredReceiptData(data);
    }

    return data;
  } catch (error) {
    // If the error was caused by a timeout, provide a more helpful message
    if (error.name === 'AbortError' && options.timeout) {
      throw new Error(`Request timed out after ${options.timeout}ms`);
    }

    console.error('Error processing receipt directly:', error);
    throw error;
  } finally {
    // Clean up the AbortController if we created one
    if (controller) {
      controller = null;
    }
  }
}

/**
 * Validates that the response matches the structured receipt schema
 *
 * @param {Object} data - The receipt data to validate
 * @throws {Error} If the data doesn't match the expected schema
 */
function validateStructuredReceiptData(data) {
  // Check for required top-level fields
  const requiredFields = ['merchant_name', 'datetime', 'items', 'sub_total', 'vat', 'service_charge', 'total'];

  for (const field of requiredFields) {
    if (data[field] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Check that items is an array
  if (!Array.isArray(data.items)) {
    throw new Error('The "items" field must be an array');
  }

  // Check each item has the required fields
  for (const [index, item] of data.items.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${index} is not an object`);
    }

    if (item.name === undefined) {
      throw new Error(`Item at index ${index} is missing "name" field`);
    }

    if (item.price === undefined) {
      throw new Error(`Item at index ${index} is missing "price" field`);
    }

    if (item.count === undefined) {
      throw new Error(`Item at index ${index} is missing "count" field`);
    }

    // Check types
    if (typeof item.name !== 'string') {
      throw new Error(`Item at index ${index} has "name" that is not a string`);
    }

    if (typeof item.price !== 'number') {
      throw new Error(`Item at index ${index} has "price" that is not a number`);
    }

    if (!Number.isInteger(item.count)) {
      throw new Error(`Item at index ${index} has "count" that is not an integer`);
    }
  }

  // Check that numeric fields are actually numbers
  const numericFields = ['sub_total', 'vat', 'service_charge', 'total'];

  for (const field of numericFields) {
    if (typeof data[field] !== 'number') {
      throw new Error(`The "${field}" field must be a number`);
    }
  }

  // Check that string fields are actually strings
  if (typeof data.merchant_name !== 'string') {
    throw new Error('The "merchant_name" field must be a string');
  }

  if (typeof data.datetime !== 'string') {
    throw new Error('The "datetime" field must be a string');
  }
}

/**
 * Formats the receipt data for display
 *
 * @param {Object} data - The structured receipt data
 * @returns {string} HTML representation of the receipt
 */
function formatReceiptAsHTML(data) {
  if (!data) return '';

  // Format the date/time
  let formattedDate = data.datetime;
  try {
    const date = new Date(data.datetime);
    if (!isNaN(date.getTime())) {
      formattedDate = date.toLocaleString();
    }
  } catch (e) {
    // Keep original format if parsing fails
  }

  // Calculate the total items
  const totalItems = data.items.reduce((sum, item) => sum + item.count, 0);

  // Format currency
  const formatCurrency = (value) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  };

  // Create HTML
  return `
    <div class="receipt">
      <div class="receipt-header">
        <h2>${data.merchant_name}</h2>
        <div class="receipt-date">${formattedDate}</div>
      </div>

      <div class="receipt-items">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.count}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.count)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="receipt-summary">
        <div class="receipt-line">
          <span>Items:</span>
          <span>${totalItems}</span>
        </div>
        <div class="receipt-line">
          <span>Subtotal:</span>
          <span>${formatCurrency(data.sub_total)}</span>
        </div>
        <div class="receipt-line">
          <span>VAT/Tax:</span>
          <span>${formatCurrency(data.vat)}</span>
        </div>
        ${data.service_charge > 0 ? `
        <div class="receipt-line">
          <span>Service Charge:</span>
          <span>${formatCurrency(data.service_charge)}</span>
        </div>
        ` : ''}
        <div class="receipt-line total">
          <span>Total:</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Example usage in a browser environment:
 */

/*
// Process receipt from file input
document.getElementById('receipt-upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      // Process receipt with API key authentication
      const result = await processReceipt(
        file,
        'https://your-worker-url.workers.dev/',
        {
          apiKey: 'your-api-key-here',
          timeout: 30000
        }
      );

      // Display the result
      document.getElementById('receipt-container').innerHTML = formatReceiptAsHTML(result);
      document.getElementById('json-result').textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    }
  }
});
*/

// Export functions for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processReceipt,
    processReceiptFromUrl,
    processReceiptDirect,
    validateStructuredReceiptData,
    formatReceiptAsHTML
  };
}
