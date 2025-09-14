// orval.config.ts
import { defineConfig } from 'orval'

export default defineConfig({
  // ① 기존: react-query 훅/클라이언트 생성
  maestro: {
    input: '../../apps/backend/contracts/openapi.yaml',
    output: {
      target: 'src/lib/api/generated.ts',
      client: 'react-query',
      override: {
        mutator: { path: 'src/lib/api/fetcher.ts', name: 'apiFetch' },
      },
    },
  },

  // ② 추가: Zod 스키마 동시 생성
  maestroSchemas: {
    input: '../../apps/backend/contracts/openapi.yaml',
    output: {
      target: 'src/lib/schemas/api.zod.ts',   // 생성될 파일
      client: 'zod',                           // ← 이게 포인트
      fileExtension: '.zod.ts',                // 가독성/충돌 방지
      override: {
        zod: {
          generate: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
        },
      },
    },
  },
})
