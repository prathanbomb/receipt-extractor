#!/usr/bin/env python3
"""
Example Python client for the Receipt Extractor API.

This script demonstrates how to use the Receipt Extractor API from Python.
It includes examples for sending images directly and via multipart form data.

Requirements:
    pip install requests pillow
"""

import os
import json
import base64
import requests
from typing import Dict, Any, Optional, Union
from pathlib import Path


class ReceiptExtractorClient:
    """Client for interacting with the Receipt Extractor API."""

    def __init__(self, api_url: str, api_key: str, timeout: int = 30):
        """
        Initialize the Receipt Extractor client.

        Args:
            api_url: The URL of the Receipt Extractor API
            api_key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.api_url = api_url
        self.api_key = api_key
        self.timeout = timeout

        if not api_key:
            raise ValueError("API key is required for authentication")

    def process_receipt_file(self, image_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Process a receipt image from a file.

        Args:
            image_path: Path to the image file

        Returns:
            Dict containing the extracted receipt data

        Raises:
            FileNotFoundError: If the image file doesn't exist
            ValueError: If the file is not a valid image
            requests.RequestException: If there's an error with the API request
        """
        # Convert to Path object if string
        if isinstance(image_path, str):
            image_path = Path(image_path)

        # Check if file exists
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        # Determine content type based on file extension
        extension = image_path.suffix.lower()
        content_type_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.heic': 'image/heic'
        }

        content_type = content_type_map.get(extension)
        if not content_type:
            raise ValueError(f"Unsupported image format: {extension}")

        # Read the image file
        with open(image_path, 'rb') as f:
            image_data = f.read()

        # Method 1: Send as multipart form data
        files = {'image': (image_path.name, image_data, content_type)}
        return self._send_request(files=files)

    def process_receipt_bytes(self, image_data: bytes, content_type: str) -> Dict[str, Any]:
        """
        Process a receipt image from bytes.

        Args:
            image_data: The raw image data as bytes
            content_type: The MIME type of the image (e.g., 'image/jpeg')

        Returns:
            Dict containing the extracted receipt data

        Raises:
            ValueError: If the content type is not supported
            requests.RequestException: If there's an error with the API request
        """
        if not content_type.startswith('image/'):
            raise ValueError(f"Unsupported content type: {content_type}")

        # Method 2: Send image directly
        headers = {
            'Content-Type': content_type,
            'X-API-Key': self.api_key
        }
        return self._send_request(data=image_data, headers=headers)

    def process_receipt_url(self, image_url: str) -> Dict[str, Any]:
        """
        Process a receipt image from a URL.

        Args:
            image_url: URL of the image to process

        Returns:
            Dict containing the extracted receipt data

        Raises:
            requests.RequestException: If there's an error fetching the image or with the API request
            ValueError: If the content type is not supported
        """
        # Fetch the image from the URL
        response = requests.get(image_url, timeout=self.timeout)
        response.raise_for_status()  # Raise exception for HTTP errors

        # Get content type from response headers
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            raise ValueError(f"URL did not return an image (got {content_type})")

        # Process the image bytes
        return self.process_receipt_bytes(response.content, content_type)

    def _send_request(self, data: Optional[bytes] = None,
                     files: Optional[Dict] = None,
                     headers: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Send a request to the Receipt Extractor API.

        Args:
            data: Raw binary data to send (used for direct image upload)
            files: Files dict for multipart form data
            headers: Request headers

        Returns:
            Dict containing the extracted receipt data

        Raises:
            requests.RequestException: If there's an error with the API request
            ValueError: If the API returns an error
        """
        # Prepare headers with API key
        if headers is None:
            headers = {}

        # Add API key if not already in headers
        if 'X-API-Key' not in headers and 'Authorization' not in headers:
            headers['X-API-Key'] = self.api_key

        # Send the request to the API
        try:
            response = requests.post(
                self.api_url,
                data=data,
                files=files,
                headers=headers,
                timeout=self.timeout
            )

            # Check if the request was successful
            if not response.ok:
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', f"API error: {response.status_code}")
                except ValueError:
                    error_message = f"API error: {response.status_code} {response.text}"

                raise ValueError(error_message)

            # Parse and return the response data
            return response.json()
        except requests.exceptions.Timeout:
            raise ValueError(f"Request timed out after {self.timeout} seconds")
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Network error: {str(e)}")

    def validate_schema(self, data: Dict[str, Any]) -> bool:
        """
        Validate that the response matches the expected schema.

        Args:
            data: The receipt data to validate

        Returns:
            True if the data is valid

        Raises:
            ValueError: If the data doesn't match the expected schema
        """
        # Check required fields
        required_fields = ['merchant_name', 'datetime', 'items', 'sub_total', 'vat', 'service_charge', 'total']

        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Check that items is a list
        if not isinstance(data['items'], list):
            raise ValueError("The 'items' field must be a list")

        # Check each item
        for i, item in enumerate(data['items']):
            if not isinstance(item, dict):
                raise ValueError(f"Item at index {i} is not a dictionary")

            # Check required item fields
            if 'name' not in item:
                raise ValueError(f"Item at index {i} is missing 'name' field")

            if 'price' not in item:
                raise ValueError(f"Item at index {i} is missing 'price' field")

            if 'count' not in item:
                raise ValueError(f"Item at index {i} is missing 'count' field")

            # Check types
            if not isinstance(item['name'], str):
                raise ValueError(f"Item at index {i} has 'name' that is not a string")

            if not isinstance(item['price'], (int, float)):
                raise ValueError(f"Item at index {i} has 'price' that is not a number")

            if not isinstance(item['count'], int):
                raise ValueError(f"Item at index {i} has 'count' that is not an integer")

        # Check numeric fields
        numeric_fields = ['sub_total', 'vat', 'service_charge', 'total']

        for field in numeric_fields:
            if not isinstance(data[field], (int, float)):
                raise ValueError(f"The '{field}' field must be a number")

        # Check string fields
        if not isinstance(data['merchant_name'], str):
            raise ValueError("The 'merchant_name' field must be a string")

        if not isinstance(data['datetime'], str):
            raise ValueError("The 'datetime' field must be a string")

        return True


def main():
    """Example usage of the ReceiptExtractorClient."""
    import argparse

    parser = argparse.ArgumentParser(description='Process receipt images using the Receipt Extractor API.')
    parser.add_argument('--api-url', required=True, help='URL of the Receipt Extractor API')
    parser.add_argument('--api-key', required=True, help='API key for authentication')
    parser.add_argument('--image', help='Path to a receipt image file')
    parser.add_argument('--url', help='URL of a receipt image')
    parser.add_argument('--timeout', type=int, default=30, help='Request timeout in seconds (default: 30)')
    parser.add_argument('--output', help='Path to save the JSON output (optional)')
    parser.add_argument('--validate', action='store_true', help='Validate the schema of the response')

    args = parser.parse_args()

    if not args.image and not args.url:
        parser.error('Either --image or --url must be provided')

    client = ReceiptExtractorClient(args.api_url, args.api_key, timeout=args.timeout)

    try:
        if args.image:
            print(f"Processing receipt image: {args.image}")
            result = client.process_receipt_file(args.image)
        else:
            print(f"Processing receipt from URL: {args.url}")
            result = client.process_receipt_url(args.url)

        # Validate schema if requested
        if args.validate:
            print("Validating schema...")
            client.validate_schema(result)
            print("Schema validation successful")

        # Pretty print the result
        print("\nExtracted Data:")
        formatted_json = json.dumps(result, indent=2)
        print(formatted_json)

        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                f.write(formatted_json)
            print(f"\nResults saved to: {args.output}")

    except Exception as e:
        print(f"Error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
