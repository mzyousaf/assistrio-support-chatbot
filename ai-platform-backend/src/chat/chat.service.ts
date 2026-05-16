import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  constructor(private readonly config: ConfigService) {}

  async reply(_botId: string, message: string): Promise<{ reply: string }> {
    const _apiKey = this.config.get<string>('openaiApiKey');
    // TODO: demo/trial chat with OpenAI
    return { reply: `Echo: ${message}` };
  }
}
