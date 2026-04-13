import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { AuthModule } from '../auth/auth.module'
import { UploadModule } from '../upload/upload.module'

@Module({
  imports: [forwardRef(() => AuthModule), UploadModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
