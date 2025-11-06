import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // This one line adds "/api/v1" to every route in your app
  app.setGlobalPrefix('api/v1');

  await app.listen(3000);
}
bootstrap();
