import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import type { User, RegisterRequest, UserProfile } from '@/types/user';
import { hashPassword } from '@/lib/auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function readUsers(): Promise<User[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, '[]', 'utf-8');
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
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
}

export async function updateLastLogin(userId: string): Promise<void> {
  const users = await readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index !== -1) {
    users[index].lastLoginAt = new Date().toISOString();
    await writeUsers(users);
  }
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
