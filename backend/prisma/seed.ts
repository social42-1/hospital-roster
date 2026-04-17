import { PrismaClient, Role, Grade } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.shift.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.roster.deleteMany();
  await prisma.user.deleteMany();

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // Admin
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@hospital.com',
      password: hash('admin123'),
      role: Role.ADMIN,
    },
  });

  // 5 Junior Doctors
  const juniors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan'];
  for (let i = 0; i < juniors.length; i++) {
    await prisma.user.create({
      data: {
        name: `Dr. ${juniors[i]}`,
        email: `${juniors[i].toLowerCase()}@hospital.com`,
        password: hash('doctor123'),
        role: Role.DOCTOR,
        grade: Grade.JUNIOR,
      },
    });
  }

  // 4 Senior Doctors
  const seniors = ['Frank', 'Grace', 'Henry', 'Irene'];
  for (let i = 0; i < seniors.length; i++) {
    await prisma.user.create({
      data: {
        name: `Dr. ${seniors[i]}`,
        email: `${seniors[i].toLowerCase()}@hospital.com`,
        password: hash('doctor123'),
        role: Role.DOCTOR,
        grade: Grade.SENIOR,
      },
    });
  }

  console.log('✅ Seeded: 1 admin, 5 juniors, 4 seniors');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
