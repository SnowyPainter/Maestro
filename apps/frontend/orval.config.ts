import { defineConfig } from 'orval';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); // 루트 .env 불러오기

const OPENAPI_FILE = '../../apps/backend/contracts/openapi.yaml';
const API_BASE = process.env.VITE_API_BASE || 'http://localhost:8000';

export default defineConfig({
  api: {
    input: OPENAPI_FILE,
    output: {
      target: 'src/lib/api/generated.ts',
      client: 'react-query',
      httpClient: 'fetch',
      baseUrl: API_BASE,
      clean: true,
    },
  },
});
