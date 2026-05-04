import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── 1. Disc Families ──────────────────────────────────────────────────────
  console.log('  → disc_families')

  const queen = await prisma.discFamily.upsert({
    where: { name: 'THE QUEEN' },
    update: {},
    create: { name: 'THE QUEEN', wear_rule_mm: 40, description: 'Quartzite specialist blade' },
  })
  const king = await prisma.discFamily.upsert({
    where: { name: 'THE KING' },
    update: {},
    create: { name: 'THE KING', wear_rule_mm: 20, description: 'Porcelain and quartzite blade' },
  })
  const hercules = await prisma.discFamily.upsert({
    where: { name: 'HERCULES' },
    update: {},
    create: { name: 'HERCULES', wear_rule_mm: 20, description: 'Porcelain specialist blade' },
  })
  const varray = await prisma.discFamily.upsert({
    where: { name: 'V-ARRAY' },
    update: {},
    create: { name: 'V-ARRAY', wear_rule_mm: 40, description: 'Granite and compact quartz blade' },
  })

  // ─── 2. Disc Catalog ───────────────────────────────────────────────────────
  console.log('  → disc_catalog (20 rows)')

  const catalogRows = [
    // THE QUEEN / quartzite
    { family_id: queen.id, material_group: 'quartzite', nominal_diameter: 350, recommended_rpm: 2000, diamond_height: 20, feed_2cm: 1800, life_2cm: 1300, feed_3cm: 1500, life_3cm: 1100, miter_feed: 800 },
    { family_id: queen.id, material_group: 'quartzite', nominal_diameter: 400, recommended_rpm: 1800, diamond_height: 20, feed_2cm: 2000, life_2cm: 1500, feed_3cm: 1500, life_3cm: 1200, miter_feed: 801 },
    { family_id: queen.id, material_group: 'quartzite', nominal_diameter: 450, recommended_rpm: 1600, diamond_height: 20, feed_2cm: 1800, life_2cm: 1650, feed_3cm: 1200, life_3cm: 1250, miter_feed: 802 },
    // THE KING / porcelain
    { family_id: king.id, material_group: 'porcelain', nominal_diameter: 350, recommended_rpm: 2700, diamond_height: 12, feed_2cm: 2500, life_2cm: 950,  feed_3cm: 1500, life_3cm: 1250, miter_feed: 1200 },
    { family_id: king.id, material_group: 'porcelain', nominal_diameter: 400, recommended_rpm: 2600, diamond_height: 12, feed_2cm: 2500, life_2cm: 1000, feed_3cm: 1500, life_3cm: 1400, miter_feed: 1200 },
    { family_id: king.id, material_group: 'porcelain', nominal_diameter: 450, recommended_rpm: 2400, diamond_height: 12, feed_2cm: 2500, life_2cm: 1050, feed_3cm: 1200, life_3cm: 1450, miter_feed: 1200 },
    // THE KING / quartzite
    { family_id: king.id, material_group: 'quartzite', nominal_diameter: 350, recommended_rpm: 2400, diamond_height: 12, feed_2cm: 1800, life_2cm: 700,  feed_3cm: 1500, life_3cm: 650,  miter_feed: 900 },
    { family_id: king.id, material_group: 'quartzite', nominal_diameter: 400, recommended_rpm: 2200, diamond_height: 12, feed_2cm: 2000, life_2cm: 800,  feed_3cm: 1500, life_3cm: 750,  miter_feed: 900 },
    { family_id: king.id, material_group: 'quartzite', nominal_diameter: 450, recommended_rpm: 2000, diamond_height: 12, feed_2cm: 1800, life_2cm: 850,  feed_3cm: 1200, life_3cm: 800,  miter_feed: 900 },
    // HERCULES / porcelain
    { family_id: hercules.id, material_group: 'porcelain', nominal_diameter: 350, recommended_rpm: 2700, diamond_height: 10, feed_2cm: 2500, life_2cm: 680,  feed_3cm: 1500, life_3cm: 1000, miter_feed: 1100 },
    { family_id: hercules.id, material_group: 'porcelain', nominal_diameter: 400, recommended_rpm: 2600, diamond_height: 10, feed_2cm: 2500, life_2cm: 740,  feed_3cm: 1500, life_3cm: 1100, miter_feed: 1100 },
    { family_id: hercules.id, material_group: 'porcelain', nominal_diameter: 450, recommended_rpm: 2400, diamond_height: 10, feed_2cm: 2500, life_2cm: 800,  feed_3cm: 1200, life_3cm: 1200, miter_feed: 1100 },
    // V-ARRAY / granite
    { family_id: varray.id, material_group: 'granite', nominal_diameter: 350, recommended_rpm: 2500, diamond_height: 20, feed_2cm: 3000, life_2cm: 1500, feed_3cm: 2800, life_3cm: 1350, miter_feed: 1500 },
    { family_id: varray.id, material_group: 'granite', nominal_diameter: 400, recommended_rpm: 2400, diamond_height: 20, feed_2cm: 4000, life_2cm: 1700, feed_3cm: 3200, life_3cm: 1500, miter_feed: 2000 },
    { family_id: varray.id, material_group: 'granite', nominal_diameter: 450, recommended_rpm: 2200, diamond_height: 20, feed_2cm: 3600, life_2cm: 1850, feed_3cm: 3000, life_3cm: 1650, miter_feed: 1800 },
    { family_id: varray.id, material_group: 'granite', nominal_diameter: 500, recommended_rpm: 2000, diamond_height: 20, feed_2cm: 3800, life_2cm: 1900, feed_3cm: 3600, life_3cm: 1700, miter_feed: 1900 },
    // V-ARRAY / compact_quartz
    { family_id: varray.id, material_group: 'compact_quartz', nominal_diameter: 350, recommended_rpm: 2500, diamond_height: 20, feed_2cm: 5000, life_2cm: 1300, feed_3cm: 4000, life_3cm: 1100, miter_feed: 2500 },
    { family_id: varray.id, material_group: 'compact_quartz', nominal_diameter: 400, recommended_rpm: 2400, diamond_height: 20, feed_2cm: 6000, life_2cm: 1400, feed_3cm: 4000, life_3cm: 1250, miter_feed: 3000 },
    { family_id: varray.id, material_group: 'compact_quartz', nominal_diameter: 450, recommended_rpm: 2200, diamond_height: 20, feed_2cm: 4500, life_2cm: 1500, feed_3cm: 3500, life_3cm: 1350, miter_feed: 2200 },
    { family_id: varray.id, material_group: 'compact_quartz', nominal_diameter: 500, recommended_rpm: 2000, diamond_height: 20, feed_2cm: 4200, life_2cm: 1600, feed_3cm: 3600, life_3cm: 1300, miter_feed: 2100 },
  ]

  for (const row of catalogRows) {
    await prisma.discCatalog.upsert({
      where: {
        family_id_material_group_nominal_diameter: {
          family_id: row.family_id,
          material_group: row.material_group,
          nominal_diameter: row.nominal_diameter,
        },
      },
      update: {},
      create: row,
    })
  }

  // ─── 3. Wear Reference ─────────────────────────────────────────────────────
  console.log('  → wear_reference (13 rows)')

  const wearRows = [
    // HERCULES
    { family_id: hercules.id, nominal_diameter: 350, measured_new: 360, measured_worn: 340 },
    { family_id: hercules.id, nominal_diameter: 400, measured_new: 410, measured_worn: 390 },
    { family_id: hercules.id, nominal_diameter: 450, measured_new: 460, measured_worn: 440 },
    // THE KING
    { family_id: king.id, nominal_diameter: 350, measured_new: 360, measured_worn: 340 },
    { family_id: king.id, nominal_diameter: 400, measured_new: 410, measured_worn: 390 },
    { family_id: king.id, nominal_diameter: 450, measured_new: 460, measured_worn: 440 },
    // THE QUEEN
    { family_id: queen.id, nominal_diameter: 350, measured_new: 370, measured_worn: 330 },
    { family_id: queen.id, nominal_diameter: 400, measured_new: 420, measured_worn: 380 },
    { family_id: queen.id, nominal_diameter: 450, measured_new: 470, measured_worn: 430 },
    // V-ARRAY
    { family_id: varray.id, nominal_diameter: 350, measured_new: 370, measured_worn: 330 },
    { family_id: varray.id, nominal_diameter: 400, measured_new: 420, measured_worn: 380 },
    { family_id: varray.id, nominal_diameter: 450, measured_new: 470, measured_worn: 430 },
    { family_id: varray.id, nominal_diameter: 500, measured_new: 520, measured_worn: 480 },
  ]

  for (const row of wearRows) {
    await prisma.wearReference.upsert({
      where: {
        family_id_nominal_diameter: {
          family_id: row.family_id,
          nominal_diameter: row.nominal_diameter,
        },
      },
      update: {},
      create: row,
    })
  }

  // ─── 4. EVDS Admin User ────────────────────────────────────────────────────
  console.log('  → users (EVDS admin)')

  const passwordHash = await bcrypt.hash('Evds2076', 12)

  await prisma.user.upsert({
    where: { email: 'admin@evdsdiamond.com' },
    update: {},
    create: {
      name: 'EVDS Admin',
      email: 'admin@evdsdiamond.com',
      password_hash: passwordHash,
      role: 'EVDS_ADMIN',
      is_active: true,
    },
  })

  // ─── Summary ───────────────────────────────────────────────────────────────
  const [families, catalog, wear, users] = await Promise.all([
    prisma.discFamily.count(),
    prisma.discCatalog.count(),
    prisma.wearReference.count(),
    prisma.user.count(),
  ])

  console.log('\n✅ Seed complete:')
  console.log(`   disc_families:  ${families} rows`)
  console.log(`   disc_catalog:   ${catalog} rows`)
  console.log(`   wear_reference: ${wear} rows`)
  console.log(`   users:          ${users} rows`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
