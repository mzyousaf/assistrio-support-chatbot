import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async message(@Body() body: { botId: string; message: string }) {
    return this.chatService.reply(body.botId, body.message);
  }
}
