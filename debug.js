import { answerFromMemory } from './src/services/rag.service.js';

const answer = await answerFromMemory('T0B0RF4MY03', 'what did the team say about the application architecture?');
console.log('Answer:', answer);