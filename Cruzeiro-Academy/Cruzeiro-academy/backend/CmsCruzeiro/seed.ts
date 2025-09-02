import { PrismaClient } from '.prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'marco.repoles@cruzeiro.com';
  const adminPassword = 'cruzeiro@1921';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: adminEmail,
        password: adminPassword,
      },
    });
    console.log('Usuário admin criado');
  } else {
    console.log('Usuário admin já existe');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
