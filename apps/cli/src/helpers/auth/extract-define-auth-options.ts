import { createJiti } from 'jiti';

export const extractDefineAuthOptions = async (authFilePath: string): Promise<Record<string, unknown>> => {
  const jiti = createJiti(authFilePath);
  const mod = await jiti.import(authFilePath);

  for (const value of Object.values(mod as Record<string, unknown>)) {
    if (value && typeof value === 'object' && 'options' in value) {
      return (value as { options: Record<string, unknown> }).options;
    }
  }

  return {};
};
