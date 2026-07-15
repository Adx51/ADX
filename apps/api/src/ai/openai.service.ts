import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * Thin wrapper around the OpenAI SDK. The whole app must degrade gracefully
 * when no API key is configured, so `isEnabled` is checked by every caller and
 * the service never throws on a missing key.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;

  readonly chatModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  readonly visionModel = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';
  readonly embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY not set — AI features run in fallback mode.');
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /** Returns a parsed JSON object from a structured prompt, or null on failure. */
  async json<T>(system: string, user: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.chat.completions.create({
        model: this.chatModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const content = res.choices[0]?.message?.content;
      return content ? (JSON.parse(content) as T) : null;
    } catch (err) {
      this.logger.error(`OpenAI json() failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Free-form chat completion. Returns null when disabled or on error. */
  async chat(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.chat.completions.create({
        model: this.chatModel,
        messages,
      });
      return res.choices[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.error(`OpenAI chat() failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Vision extraction from an image URL (labels, cases, invoices). */
  async vision<T>(system: string, prompt: string, imageUrl: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.chat.completions.create({
        model: this.visionModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      });
      const content = res.choices[0]?.message?.content;
      return content ? (JSON.parse(content) as T) : null;
    } catch (err) {
      this.logger.error(`OpenAI vision() failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Returns an embedding vector for semantic search, or null when disabled. */
  async embed(text: string): Promise<number[] | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      return res.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.error(`OpenAI embed() failed: ${(err as Error).message}`);
      return null;
    }
  }
}
