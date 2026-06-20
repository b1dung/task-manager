import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Invite } from '@/modules/invites/entities/invite.entity';
import { User } from '@/modules/users/entities/user.entity';

const INVITE_TTL_DAYS = 7;

export interface CreatedInvite {
  invite: Invite;
  token: string;
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Create a single-use, time-limited invite. Returns the raw token (shown once). */
  async create(
    email: string,
    roleId: string | null,
    invitedBy: string,
  ): Promise<CreatedInvite> {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Email này đã có tài khoản');
    }

    // Revoke any still-pending invite for the same email so only one is valid.
    await this.inviteRepository.delete({
      email: normalizedEmail,
      acceptedAt: IsNull(),
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = this.inviteRepository.create({
      email: normalizedEmail,
      roleId,
      tokenHash: this.hashToken(token),
      invitedBy,
      expiresAt,
      acceptedAt: null,
    });
    const saved = await this.inviteRepository.save(invite);
    return { invite: saved, token };
  }

  /** Pending (unaccepted, unexpired) invites, newest first. */
  async findPending(): Promise<Invite[]> {
    return this.inviteRepository.find({
      where: { acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string): Promise<void> {
    const result = await this.inviteRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }
  }

  /** Resolve a raw token to a valid, pending invite, or null if invalid/expired/used. */
  async findValidByToken(token: string): Promise<Invite | null> {
    if (!token) return null;
    const invite = await this.inviteRepository.findOne({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!invite) return null;
    if (invite.acceptedAt) return null;
    if (invite.expiresAt.getTime() < Date.now()) return null;
    return invite;
  }

  async markAccepted(id: string): Promise<void> {
    await this.inviteRepository.update(id, { acceptedAt: new Date() });
  }
}
