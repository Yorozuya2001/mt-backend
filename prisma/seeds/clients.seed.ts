import { fakerES as faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  BuyerType,
  Prisma,
  PrismaClient,
  Role,
} from '../../src/generated/prisma/client';

const CLIENT_COUNT = 150;
const SEED_EMAIL_PREFIX = 'cliente.seed.';
const SEED_PASSWORD = 'Cliente123!';
const BATCH_SIZE = 50;

type ProfileVariant = 'full' | 'phoneOnly' | 'minimal';

function buildSeedEmail(index: number): string {
  return `${SEED_EMAIL_PREFIX}${String(index).padStart(3, '0')}@mt.local`;
}

function buildBuyerTypeDistribution(): BuyerType[] {
  const types: BuyerType[] = [
    ...Array.from({ length: 90 }, () => BuyerType.REGULAR),
    ...Array.from({ length: 60 }, () => BuyerType.FRECUENTE),
  ];

  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = faker.number.int({ min: 0, max: i });
    [types[i], types[j]] = [types[j], types[i]];
  }

  return types;
}

function buildProfileVariantDistribution(): ProfileVariant[] {
  const variants: ProfileVariant[] = [
    ...Array.from({ length: 105 }, () => 'full' as const),
    ...Array.from({ length: 30 }, () => 'phoneOnly' as const),
    ...Array.from({ length: 15 }, () => 'minimal' as const),
  ];

  for (let i = variants.length - 1; i > 0; i -= 1) {
    const j = faker.number.int({ min: 0, max: i });
    [variants[i], variants[j]] = [variants[j], variants[i]];
  }

  return variants;
}

function generateUniqueDni(usedDnis: Set<string>): string {
  let dni = '';

  do {
    const length = faker.number.int({ min: 7, max: 10 });
    dni = faker.string.numeric({ length });
  } while (usedDnis.has(dni));

  usedDnis.add(dni);
  return dni;
}

function generatePhone(): string {
  const area = faker.helpers.arrayElement(['11', '221', '351', '261', '341']);
  const part1 = faker.string.numeric(4);
  const part2 = faker.string.numeric(4);
  return `+54 ${area} ${part1}-${part2}`;
}

function buildClientRecord(
  index: number,
  passwordHash: string,
  buyerType: BuyerType,
  profileVariant: ProfileVariant,
  usedDnis: Set<string>,
): Prisma.UserCreateManyInput {
  const isEmailVerified = index <= 120;
  const hasPhoto = index % 7 === 0;

  const dni = profileVariant === 'full' ? generateUniqueDni(usedDnis) : null;
  const phone =
    profileVariant === 'full' || profileVariant === 'phoneOnly'
      ? generatePhone()
      : null;

  return {
    email: buildSeedEmail(index),
    password: passwordHash,
    name: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dni,
    phone,
    role: Role.CLIENT,
    buyerType,
    photoUrl: hasPhoto ? faker.image.avatar() : null,
    isEmailVerified,
    verificationToken: isEmailVerified ? null : randomBytes(32).toString('hex'),
  };
}

export async function seedClients(prisma: PrismaClient): Promise<void> {
  const deleted = await prisma.user.deleteMany({
    where: { email: { startsWith: SEED_EMAIL_PREFIX } },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const buyerTypes = buildBuyerTypeDistribution();
  const profileVariants = buildProfileVariantDistribution();
  const usedDnis = new Set<string>();
  const clients = Array.from({ length: CLIENT_COUNT }, (_, i) =>
    buildClientRecord(
      i + 1,
      passwordHash,
      buyerTypes[i],
      profileVariants[i],
      usedDnis,
    ),
  );

  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    await prisma.user.createMany({
      data: clients.slice(i, i + BATCH_SIZE),
    });
  }

  const regularCount = clients.filter(
    (client) => client.buyerType === BuyerType.REGULAR,
  ).length;
  const frecuenteCount = clients.filter(
    (client) => client.buyerType === BuyerType.FRECUENTE,
  ).length;

  console.log(
    `Seed clientes: borrados ${deleted.count}, creados ${CLIENT_COUNT}`,
  );
  console.log(`  REGULAR: ${regularCount}, FRECUENTE: ${frecuenteCount}`);
  console.log(`  Password dev: ${SEED_PASSWORD}`);
}
