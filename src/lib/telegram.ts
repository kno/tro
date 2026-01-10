import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { prisma } from '@/lib/db';

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? '';

export function ensureTelegramConfig() {
  if (!apiId || !apiHash) {
    throw new Error('Telegram API credentials are missing.');
  }
}

export function createClient(sessionString: string) {
  ensureTelegramConfig();
  return new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export async function getTelegramSession(userId: string) {
  return prisma.telegramSession.findUnique({
    where: { userId },
  });
}

export async function saveTelegramSession(userId: string, sessionString: string, phoneNumber: string) {
  return prisma.telegramSession.upsert({
    where: { userId },
    create: { userId, sessionString, phoneNumber },
    update: { sessionString, phoneNumber },
  });
}

export async function createTelegramChallenge(userId: string, phoneNumber: string, phoneCodeHash: string) {
  return prisma.telegramLoginChallenge.upsert({
    where: { userId },
    create: { userId, phoneNumber, phoneCodeHash },
    update: { phoneNumber, phoneCodeHash },
  });
}

export async function getTelegramChallenge(userId: string) {
  return prisma.telegramLoginChallenge.findUnique({
    where: { userId },
  });
}

export async function sendLoginCode(userId: string, phoneNumber: string) {
  const client = createClient('');
  await client.connect();
  const result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber,
      apiId,
      apiHash,
      settings: new Api.CodeSettings({}),
    }),
  );

  await createTelegramChallenge(userId, phoneNumber, result.phoneCodeHash);
  await client.disconnect();
}

export async function verifyLoginCode(userId: string, code: string) {
  const challenge = await getTelegramChallenge(userId);
  if (!challenge) {
    throw new Error('No se encontró un desafío activo.');
  }

  const client = createClient('');
  await client.connect();
  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: challenge.phoneNumber,
      phoneCodeHash: challenge.phoneCodeHash,
      phoneCode: code,
    }),
  );

  const sessionString = client.session.save();
  await saveTelegramSession(userId, sessionString, challenge.phoneNumber);
  await client.disconnect();
}

export async function listChannels(userId: string) {
  const session = await getTelegramSession(userId);
  if (!session) {
    return [];
  }

  const client = createClient(session.sessionString);
  await client.connect();
  const dialogs = await client.getDialogs({});
  const channels = dialogs
    .filter((dialog) => dialog.isChannel)
    .map((dialog) => ({
      id: dialog.id.toString(),
      title: dialog.title ?? 'Canal sin nombre',
    }));
  await client.disconnect();
  return channels;
}

export async function listChannelFiles(userId: string, channelId: string) {
  const session = await getTelegramSession(userId);
  if (!session) {
    return [];
  }

  const client = createClient(session.sessionString);
  await client.connect();
  const messages = await client.getMessages(channelId, { limit: 50 });
  const files = messages
    .filter((message) => message.media && message.media.className === 'MessageMediaDocument')
    .map((message) => {
      const document = message.document;
      const size = document?.size ?? 0;
      const name =
        document?.attributes?.find((attr) => attr.className === 'DocumentAttributeFilename')
          ?.fileName ?? `archivo-${message.id}`;
      return {
        id: message.id,
        messageId: message.id,
        name,
        size,
      };
    });
  await client.disconnect();
  return files;
}

export async function downloadMessageFile(userId: string, channelId: string, messageId: number) {
  const session = await getTelegramSession(userId);
  if (!session) {
    throw new Error('No hay sesión de Telegram activa.');
  }

  const client = createClient(session.sessionString);
  await client.connect();
  const message = await client.getMessages(channelId, { ids: [messageId] });
  const file = message[0];
  if (!file?.media) {
    throw new Error('El mensaje no contiene archivos.');
  }

  const buffer = await client.downloadMedia(file, {});
  const document = file.document;
  const fileName =
    document?.attributes?.find((attr) => attr.className === 'DocumentAttributeFilename')
      ?.fileName ?? `archivo-${file.id}`;

  await client.disconnect();
  return { buffer, fileName };
}
