import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SlotsModule } from './slots/slots.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TimesModule } from './times/times.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EngagementModule } from './engagement/engagement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const ssl =
          configService.get<string>('DB_SSL') === 'true' || isProduction
            ? { rejectUnauthorized: false }
            : false;
        const synchronize =
          configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true' ||
          (!isProduction &&
            configService.get<string>('TYPEORM_SYNCHRONIZE') !== 'false');

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl,
            autoLoadEntities: true,
            synchronize,
          };
        }

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          ssl,
          autoLoadEntities: true,
          synchronize,
        };
      },
    }),

    ScheduleModule.forRoot(),

    UsersModule,
    PatientsModule,
    DoctorsModule,
    SlotsModule,
    AppointmentsModule,
    TimesModule,
    NotificationsModule,
    AnalyticsModule,
    EngagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
