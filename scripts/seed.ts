import { db } from "../lib/db";
import {
  users,
  rawMaterials,
  baseProducts,
  baseProductIngredients,
  products,
  productBaseRequirements,
  productStages,
} from "../lib/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seed başlıyor...");

  // Users
  const adminHash = await bcrypt.hash("Admin123!", 10);
  const viewerHash = await bcrypt.hash("Viewer123!", 10);

  const [admin] = await db
    .insert(users)
    .values([
      { email: "admin@pastane.com", passwordHash: adminHash, role: "admin", name: "Admin" },
      { email: "viewer@pastane.com", passwordHash: viewerHash, role: "viewer", name: "Viewer" },
    ])
    .onConflictDoNothing()
    .returning();

  // Raw Materials
  const [sut, yumurta, tereyagi, seker, nisasta, un, vanilya, cikolata] = await db
    .insert(rawMaterials)
    .values([
      { name: "Süt", unit: "litre", unitCost: "25", stockQty: "50", minStock: "10" },
      { name: "Yumurta", unit: "adet", unitCost: "7", stockQty: "200", minStock: "50" },
      { name: "Tereyağı", unit: "kg", unitCost: "450", stockQty: "20", minStock: "5" },
      { name: "Şeker", unit: "kg", unitCost: "55", stockQty: "30", minStock: "10" },
      { name: "Mısır Nişastası", unit: "kg", unitCost: "90", stockQty: "10", minStock: "3" },
      { name: "Un", unit: "kg", unitCost: "40", stockQty: "40", minStock: "10" },
      { name: "Vanilya Özü", unit: "ml", unitCost: "2", stockQty: "500", minStock: "100" },
      { name: "Bitter Çikolata", unit: "kg", unitCost: "320", stockQty: "8", minStock: "2" },
    ])
    .onConflictDoNothing()
    .returning();

  if (!sut) {
    console.log("Seed verisi zaten mevcut, atlanıyor...");
    process.exit(0);
  }

  // Base Product: Fransız Kreması
  const [fransizkremasi] = await db
    .insert(baseProducts)
    .values({
      name: "Fransız Kreması",
      unit: "kg",
      yieldQty: "1",
      fireRate: "0.10",
      shelfLifeHours: 48,
      notes: "SKT: 48 saat",
    })
    .returning();

  await db.insert(baseProductIngredients).values([
    { baseProductId: fransizkremasi.id, rawMaterialId: sut.id, qtyPerUnit: "0.6", unit: "litre" },
    { baseProductId: fransizkremasi.id, rawMaterialId: yumurta.id, qtyPerUnit: "4", unit: "adet" },
    { baseProductId: fransizkremasi.id, rawMaterialId: tereyagi.id, qtyPerUnit: "0.05", unit: "kg" },
    { baseProductId: fransizkremasi.id, rawMaterialId: seker.id, qtyPerUnit: "0.16", unit: "kg" },
    { baseProductId: fransizkremasi.id, rawMaterialId: nisasta.id, qtyPerUnit: "0.06", unit: "kg" },
  ]);

  // Product: Ekler
  const [ekler] = await db
    .insert(products)
    .values({
      name: "Ekler",
      description: "Fransız kremalı ekler pasta",
      sellingPrice: "85",
    })
    .returning();

  await db.insert(productBaseRequirements).values({
    productId: ekler.id,
    baseProductId: fransizkremasi.id,
    qtyPerUnit: "0.045",
  });

  await db.insert(productStages).values([
    { productId: ekler.id, stageName: "Hazırlık", stageOrder: 1, dayOffset: -3, durationHours: "1" },
    { productId: ekler.id, stageName: "Pişirme", stageOrder: 2, dayOffset: -2, durationHours: "2.5" },
    { productId: ekler.id, stageName: "Montaj", stageOrder: 3, dayOffset: -1, durationHours: "1.5" },
    { productId: ekler.id, stageName: "Süsleme", stageOrder: 4, dayOffset: 0, durationHours: "1" },
  ]);

  console.log("Seed tamamlandı!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
