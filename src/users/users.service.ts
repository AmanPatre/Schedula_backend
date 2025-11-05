import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';
import { SignInUserDto } from './dto/signin-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const newUser = this.usersRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      role: createUserDto.role,
    });

    const savedUser = await this.usersRepository.save(newUser);

    const { password, ...result } = savedUser;
    return result;
  }

  async signin(signInUserDto: SignInUserDto) {
    // 1. Find the user by email
    const user = await this.usersRepository.findOne({
      where: { email: signInUserDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check if the password is correct
    const isMatch = await bcrypt.compare(signInUserDto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. If password is correct, create and return a JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // The "sign" method creates the token
    const accessToken = this.jwtService.sign(payload);

    // Return the token in an object
    return {
      accessToken,
    };
  }

  findAll() {
    return this.usersRepository.find();
  }

  findOne(id: string) {
    return `This action returns a #${id} user`;
  }

  update(id: string) {
    return `This action updates a #${id} user`;
  }

  remove(id: string) {
    return `This action removes a #${id} user`;
  }
}
