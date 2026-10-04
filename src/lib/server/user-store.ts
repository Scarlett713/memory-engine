import fs from 'fs/promises';
import { nanoid } from 'nanoid';
import type { User, RegisterRequest, UserProfile } from '@/types/user';
import { hashPassword } from '@/lib/auth';
import {
  quarantineFile,
  readJsonFile,
  runExclusive,
  writeJsonAtomic,
} from '@/lib/server/json-store';
import {
  ensureStorageLayout,
  getUsersFilePath,
} from '@/lib/server/storage';

/**
 * 读侧不再覆盖写。
 * 原实现在 catch 里无条件 writeFile('[]')，一次 JSON 解析失败就会把
 * 整个账号文件清空 —— 这里只在文件确实缺失时创建，损坏时留隔离副本。
 */
async function readUsers(): Promise<User[]> {
  // 与项目库共用 storage 目录：路径由 LOCAL_STORAGE_DIR 决定，不在这里拼。
  await ensureStorageLayout();

  const usersFilePath = getUsersFilePath();
  const result = await readJsonFile<User[]>(usersFilePath);

  if (result.status === 'ok') {
    return Array.isArray(result.data) ? result.data : [];
  }

  if (result.status === 'missing') {
    try {
      // wx = 独占创建，两个并发首启动只有一个能建成
      await fs.writeFile(usersFilePath, '[]', { encoding: 'utf-8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    return [];
  }

  await quarantineFile(usersFilePath);
  return [];
}

async function writeUsers(users: User[]): Promise<void> {
  await ensureStorageLayout();
  await writeJsonAtomic(getUsersFilePath(), users);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function createUser(data: RegisterRequest): Promise<UserProfile> {
  // 锁包住 read → 查重 → 追加 → write：否则两个并发注册同邮箱会双双通过查重。
  return runExclusive(getUsersFilePath(), async () => {
    const users = await readUsers();

    const exists = users.some(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (exists) throw new Error('EMAIL_EXISTS');

    const now = new Date().toISOString();
    const newUser: User = {
      id: nanoid(),
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      userType: data.userType,
      orgName: data.userType === 'org' ? data.orgName : undefined,
      createdAt: now,
      lastLoginAt: now,
    };

    users.push(newUser);
    await writeUsers(users);
    return toProfile(newUser);
  });
}

export async function updateLastLogin(userId: string): Promise<void> {
  await runExclusive(getUsersFilePath(), async () => {
    const users = await readUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].lastLoginAt = new Date().toISOString();
      await writeUsers(users);
    }
  });
}

export function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    orgName: user.orgName,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
