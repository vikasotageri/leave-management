export const isApiKeyConfigured = () => {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return !!(key && key !== "sk-your-openai-api-key-here");
};
