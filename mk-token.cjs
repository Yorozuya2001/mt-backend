require('dotenv/config');
const jwt = require('jsonwebtoken');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./src/generated/prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  const user = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
  });
  if (!user) {
    console.error('NO_ADMIN');
    process.exit(1);
  }
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  console.log(token);
  await prisma.$disconnect();
})();
