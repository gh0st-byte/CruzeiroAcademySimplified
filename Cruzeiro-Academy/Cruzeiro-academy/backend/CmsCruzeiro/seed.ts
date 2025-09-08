import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');

  // Criar escolas iniciais
  const brazilSchool = await prisma.school.upsert({
    where: { slug: 'brazil' },
    update: {},
    create: {
      name: 'Cruzeiro Academy Brasil',
      country: 'Brasil',
      city: 'Belo Horizonte',
      slug: 'brazil',
      description: 'Escola oficial no Brasil',
      status: 'active',
    },
  });

  console.log(`✓ School created: ${brazilSchool.name}`);

  // Fotos iniciais (test)
  await prisma.photo.createMany({
    data: [
      {
        schoolId: brazilSchool.id,
        fileUrl: 'https://example.com/foto1.jpg',
        altText: 'Treino Brasil',
        tag: 'pt-BR',
      },
      {
        schoolId: brazilSchool.id,
        fileUrl: 'https://example.com/photo1.jpg',
        altText: 'Training Brazil',
        tag: 'en-US',
      },
    ],
  });
  console.log('✓ Photos created');

  // Links de formulário (test)
  await prisma.formLink.create({
    data: {
      schoolId: brazilSchool.id,
      url: 'https://forms.gle/exampleBR',
      tag: 'pt-BR',
      description: 'Formulário de inscrição Brasil',
    },
  });
  console.log('✓ Form link created');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
