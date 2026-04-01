import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ThemesModule } from './modules/themes/themes.module'
import { QuestionsModule } from './modules/questions/questions.module'
import { SessionsModule } from './modules/sessions/sessions.module'
import { StorageModule } from './modules/storage/storage.module'
import { JobsModule } from './modules/jobs/jobs.module'
import { UsersModule } from './modules/users/users.module'
import { AiModule } from './modules/ai/ai.module'
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        enableOfflineQueue: false,
      },
    }),
    ThemesModule,
    QuestionsModule,
    SessionsModule,
    StorageModule,
    JobsModule,
    UsersModule,
    AiModule,
    FeedbacksModule,
  ],
})
export class AppModule {}
