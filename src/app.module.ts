import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    // 1. Load the .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Configure TypeORM (the database connection)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // Make .env variables available here
      inject: [ConfigService], // Inject the service to read them
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),

        // This is your "auto-entity loading"
        autoLoadEntities: true,

        // This syncs your database tables with your code
        // (Use in development only)
        synchronize: true,
      }),
    }),
    // --- END CONFIGURATION ---
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
