import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async create(userId: string, type: NotificationType, message: string) {
    const notification = this.notificationRepo.create({
      recipient: { id: userId } as User,
      type,
      message,
    });
    return this.notificationRepo.save(notification);
  }

  async findAllForUser(userId: string) {
    return this.notificationRepo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string) {
    await this.notificationRepo.update(id, { isRead: true });
    return { message: 'Notification marked as read' };
  }
}
