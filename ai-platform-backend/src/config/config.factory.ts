export function configFactory() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3001', 10),
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    jobRunnerSecret: process.env.JOB_RUNNER_SECRET ?? '',
    awsRegion: process.env.AWS_REGION ?? '',
    s3Bucket: process.env.S3_BUCKET ?? '',
    cloudfrontBaseUrl: process.env.CLOUDFRONT_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    /** When 'true', run unified knowledge retrieval (documents + FAQs + notes) and attach to debug; does not replace existing RAG for prompt. */
    useUnifiedKnowledgeRetrieval: process.env.USE_UNIFIED_KNOWLEDGE_RETRIEVAL === 'true',
    /** When 'true', use unified retrieval result as the only factual knowledge in the prompt (evidence-first); requires retrieval to run. */
    useUnifiedEvidencePrompt: process.env.USE_UNIFIED_EVIDENCE_PROMPT === 'true',
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
