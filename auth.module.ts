import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { SessionSerializer } from './session.serializer';
import { User } from '../database/entities/user.entity';
import { UserRepository } from '../database/repositories/user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // defaultStrategy tells Passport which guard to use when none is specified
    PassportModule.register({ defaultStrategy: 'google', session: true }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, SessionSerializer, UserRepository],
  // UserRepository exported so other modules can use it if needed
  exports: [AuthService, UserRepository],
})
export class AuthModule {}
