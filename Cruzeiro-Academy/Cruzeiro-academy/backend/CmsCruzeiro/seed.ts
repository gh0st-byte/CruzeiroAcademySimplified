import { PrismaClient } from '.prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');
  
  // First, create a default school (tenant)
  const defaultSchool = await prisma.school.upsert({
    where: { slug: 'brazil' },
    update: {},
    create: {
      name: 'Cruzeiro Academy Brasil',
      country: 'BRA',
      country_name: 'Brasil',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      currency: 'BRL',
      domain: 'br.cruzeiroacademy.com',
      slug: 'brazil',
      status: 'active',
    }
  });
  
  console.log(`✓ School created: ${defaultSchool.name}`);
  
  // Create admin user
  const adminEmail = 'marco.repoles@cruzeiro.com';
  const adminUser = await prisma.cmsUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password_hash: 'cruzeiro@1921', // This will be hashed by Keystone
      first_name: 'Marco',
      last_name: 'Repoles',
      role: 'super_admin',
      is_active: true,
      tenant: {
        connect: { id: defaultSchool.id }
      }
    }
  });
  
  console.log(`✓ Admin user created: ${adminUser.email}`);
  
  // Create default content category
  const newsCategory = await prisma.contentCategory.create({
    data: {
      name: 'Notícias',
      slug: 'noticias',
      description: 'Notícias e novidades da academia',
      is_active: true,
      tenant: {
        connect: { id: defaultSchool.id }
      }
    }
  });
  
  console.log(`✓ Category created: ${newsCategory.name}`);
  
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
