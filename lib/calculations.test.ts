import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calcBrutQty,
  calcRawMaterialQty,
  calcPortionCost,
  calcFifoDeadline,
} from "./calculations";

describe("calcBrutQty", () => {
  test("fire oranı %10 ile net miktarı brüt miktara çevirir", () => {
    // 100 * (1 + 0.10) * 1.05 = 115.5
    // Not: JS floating point hassasiyeti nedeniyle ~115.50000000000001 üretilir
    const result = calcBrutQty(100, 0.1);
    assert.ok(
      Math.abs(result - 115.5) < 1e-9,
      `Beklenen ~115.5, alınan: ${result}`
    );
  });

  test("fire oranı %0 ile sadece %5 kayıp eklenir", () => {
    // 200 * 1.0 * 1.05 = 210
    const result = calcBrutQty(200, 0);
    assert.equal(result, 210);
  });

  test("net miktar 0 ise brüt miktar da 0 döner", () => {
    const result = calcBrutQty(0, 0.2);
    assert.equal(result, 0);
  });

  test("fire oranı %50 ile hesaplama doğru çalışır", () => {
    // 40 * (1 + 0.50) * 1.05 = 63
    const result = calcBrutQty(40, 0.5);
    assert.equal(result, 63);
  });
});

describe("calcRawMaterialQty", () => {
  test("brüt miktar ile birim başına miktarı çarpar", () => {
    // 115.5 * 2 = 231
    const result = calcRawMaterialQty(115.5, 2);
    assert.equal(result, 231);
  });

  test("birim başına miktar 1 ise brüt miktarı olduğu gibi döner", () => {
    const result = calcRawMaterialQty(50, 1);
    assert.equal(result, 50);
  });

  test("brüt miktar 0 ise sonuç 0 döner", () => {
    const result = calcRawMaterialQty(0, 5);
    assert.equal(result, 0);
  });
});

describe("calcPortionCost", () => {
  test("2 malzeme ile porsiyon maliyetini doğru hesaplar", () => {
    // (10*2 + 5*4) / 10 = 40 / 10 = 4
    const ingredients = [
      { unitCost: 10, qty: 2 },
      { unitCost: 5, qty: 4 },
    ];
    const result = calcPortionCost(ingredients, 10);
    assert.equal(result, 4);
  });

  test("tek malzeme ile hesaplama", () => {
    // (20 * 3) / 6 = 10
    const ingredients = [{ unitCost: 20, qty: 3 }];
    const result = calcPortionCost(ingredients, 6);
    assert.equal(result, 10);
  });

  test("yieldQty 0 olduğunda 0 döner (sıfıra bölme koruması)", () => {
    const ingredients = [{ unitCost: 10, qty: 5 }];
    const result = calcPortionCost(ingredients, 0);
    assert.equal(result, 0);
  });

  test("malzeme listesi boş ise maliyet 0 döner", () => {
    const result = calcPortionCost([], 10);
    assert.equal(result, 0);
  });
});

describe("calcFifoDeadline", () => {
  test("raf ömrü 24 saat için üretim tarihinden 1 gün sonra son kullanma tarihi döner", () => {
    const assemblyDate = new Date("2026-04-10T12:00:00.000Z");
    // üretim + 24 saat = son kullanma tarihi
    const expected = new Date("2026-04-11T12:00:00.000Z");
    const result = calcFifoDeadline(assemblyDate, 24);
    assert.deepEqual(result, expected);
  });

  test("raf ömrü 48 saat için üretim tarihinden 2 gün sonra son kullanma tarihi döner", () => {
    const assemblyDate = new Date("2026-04-10T00:00:00.000Z");
    const expected = new Date("2026-04-12T00:00:00.000Z");
    const result = calcFifoDeadline(assemblyDate, 48);
    assert.deepEqual(result, expected);
  });

  test("raf ömrü 0 saat ise tarihi değiştirmeden döner", () => {
    const assemblyDate = new Date("2026-04-10T06:00:00.000Z");
    const result = calcFifoDeadline(assemblyDate, 0);
    assert.deepEqual(result, assemblyDate);
  });
});
