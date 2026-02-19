const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { drink, personality, systemPrompt } = JSON.parse(event.body);

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: 'Spirit/Mocktail preference: ' + drink + '\nPersonality: ' + personality + '\n\nCraft my perfect drink. Respond with ONLY the JSON object, no other text.'
      }]
    });

    const rawResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    console.log('Raw Anthropic response:', rawResponse);

    const parsed = JSON.parse(rawResponse);

    // Extract the text content from the response
    const text = parsed.content && parsed.content[0] && parsed.content[0].text
      ? parsed.content[0].text
      : '';

    console.log('Text from Claude:', text);

    // Try to extract JSON - first strip markdown fences, then try regex
    let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // If it still doesn't start with {, try to find JSON block via regex
    if (!clean.startsWith('{')) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) clean = match[0];
    }

    console.log('Cleaned text:', clean);

    // Return the full parsed API response plus the extracted clean JSON string
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: [{ type: 'text', text: clean }]
      })
    };

  } catch (err) {
    console.log('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
