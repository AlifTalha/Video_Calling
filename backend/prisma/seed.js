/**
 * Prisma Seed — creates the admin user
 *   email:    admin@gmail.com
 *   password: admin@gmail.com
 *   role:     ADMIN
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "admin@gmail.com";
  const password = "admin@gmail.com";

  const hashed = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "ADMIN" },
    create: {
      username: "admin",
      email,
      password: hashed,
      role: "ADMIN",
    },
  });

  console.log(
    `✓ Admin seeded: id=${admin.id}  email=${admin.email}  role=${admin.role}`,
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
