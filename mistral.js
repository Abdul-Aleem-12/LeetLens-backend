import { Mistral } from '@mistralai/mistralai';
import * as dotenv from 'dotenv';

dotenv.config();
const apiKey = process.env.MISTRAL_API_KEY;

const client = new Mistral({ apiKey: apiKey  });
let x = 10;
while(x--){
async function getChatResponse() {
  try {
    const chatResponse = await client.chat.complete({
      model: 'mistral-tiny',
      messages: [{ role: 'user', content: 'how much leetcode problem is enough to crack interview as a fresher limit 50 words' }],
    });
    console.log('Chat:', chatResponse.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

getChatResponse();
}
