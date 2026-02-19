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

    const prompt = systemPrompt + '\n\nSpirit/Mocktail preference: ' + drink + '\nPersonality: ' + personality + '\n\nRespond with ONLY the JSON object, no other text.';

    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 1024
      }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-1.5-flash';

    const rawResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/' + model + ':generateContent?key=' + apiKey,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    console.log('Raw Gemini response:', rawResponse);

    const parsed = JSON.parse(rawResponse);

    const text = parsed.candidates &&
                 parsed.candidates[0] &&
                 parsed.candidates[0].content &&
                 parsed.candidates[0].content.parts &&
                 parsed.candidates[0].content.parts[0]
                 ? parsed.candidates[0].content.parts[0].text
                 : '';

    console.log('Text from Gemini:', text);

    // Strip markdown fences and extract JSON block
    let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!clean.startsWith('{')) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) clean = match[0];
    }

    console.log('Clean JSON:', clean);

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
