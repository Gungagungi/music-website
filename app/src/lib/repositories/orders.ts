import { desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { orderItems, orders, products } from '@/db/schema';
import type { Address, CartItem, CartTotals, Order, PaymentMethod } from '@/lib/types';

/** Reads and writes on `orders` and `order_items`. */

/** Raised when the shelf emptied between the cart page and checkout. */
export class OutOfStockError extends Error {
  constructor(readonly productName: string) {
    super(`Stock insuffisant pour « ${productName} ».`);
    this.name = 'OutOfStockError';
  }
}

export interface NewOrder {
  userId: string | null;
  email: string;
  items: CartItem[];
  totals: CartTotals;
  couponCode: string | null;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
}

/**
 * Places an order: re-checks stock, decrements it, and records the sale — all or
 * nothing.
 *
 * This is what the in-memory store could not express, and what ADR-001 listed as
 * the class of defect it put out of reach. Three things matter here:
 *
 * 1. **`FOR UPDATE`** locks every product line for the duration. Two customers
 *    racing for the last unit are serialised by the database: one decrements, the
 *    other re-reads the new value and is refused. Checking and then updating
 *    without the lock leaves a window in which both see stock and both succeed.
 * 2. **`ORDER BY id`** on the lock gives every checkout the same lock ordering.
 *    Without it, two orders over overlapping baskets can each hold what the other
 *    is waiting for, and PostgreSQL kills one for deadlock.
 * 3. **READ COMMITTED**, the default, is enough precisely *because* of the lock.
 *    SERIALIZABLE would add retry-on-serialization-failure handling for no gain.
 */
export async function createOrder(input: NewOrder): Promise<Order> {
  const productIds = [...new Set(input.items.map((item) => item.productId))];

  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ id: products.id, stock: products.stock, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds))
      .orderBy(products.id)
      .for('update');

    const stockById = new Map(locked.map((row) => [row.id, row]));

    // Quantities are summed per product first: the same product can appear on
    // two lines with different colours, and checking each line on its own would
    // let a basket of two half-available lines through.
    const wanted = new Map<string, number>();
    for (const item of input.items) {
      wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, quantity] of wanted) {
      const row = stockById.get(productId);
      if (!row || row.stock < quantity) {
        const name = row?.name ?? input.items.find((i) => i.productId === productId)?.name ?? '';
        throw new OutOfStockError(name);
      }
    }

    for (const [productId, quantity] of wanted) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${quantity}` })
        .where(eq(products.id, productId));
    }

    const [order] = await tx
      .insert(orders)
      .values({
        reference: sql`'FRT-' || lpad(nextval('order_ref_seq')::text, 6, '0')`,
        userId: input.userId,
        email: input.email,
        totals: input.totals,
        couponCode: input.couponCode,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        paymentMethod: input.paymentMethod,
        createdAt: new Date(),
      })
      .returning();

    const lines = input.items.map((item, index) => ({
      orderId: order!.id,
      productId: item.productId,
      sku: item.sku,
      slug: item.slug,
      name: item.name,
      brand: item.brand,
      color: item.color,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      position: index,
    }));
    await tx.insert(orderItems).values(lines);

    return { ...toOrder(order!), items: input.items };
  });
}

type OrderRow = typeof orders.$inferSelect;

function toOrder(row: OrderRow, items: CartItem[] = []): Order {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    email: row.email,
    items,
    totals: row.totals,
    couponCode: row.couponCode,
    shippingAddress: row.shippingAddress,
    billingAddress: row.billingAddress,
    paymentMethod: row.paymentMethod,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    accessToken: row.accessToken,
  };
}

async function itemsByOrder(orderIds: string[], executor: DbOrTx): Promise<Map<string, CartItem[]>> {
  if (orderIds.length === 0) return new Map();
  const rows = await executor
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(orderItems.position);

  const grouped = new Map<string, CartItem[]>();
  for (const row of rows) {
    const line: CartItem = {
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      color: row.color,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      lineTotal: row.lineTotal,
    };
    const existing = grouped.get(row.orderId);
    if (existing) existing.push(line);
    else grouped.set(row.orderId, [line]);
  }
  return grouped;
}

async function hydrate(rows: OrderRow[], executor: DbOrTx): Promise<Order[]> {
  // One query for every order's lines rather than one per order.
  const items = await itemsByOrder(
    rows.map((row) => row.id),
    executor,
  );
  return rows.map((row) => toOrder(row, items.get(row.id) ?? []));
}

export async function ordersForUser(userId: string, executor: DbOrTx = db): Promise<Order[]> {
  const rows = await executor
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  return hydrate(rows, executor);
}

export async function findOrderById(id: string, executor: DbOrTx = db): Promise<Order | undefined> {
  const rows = await executor.select().from(orders).where(eq(orders.id, id)).limit(1);
  return (await hydrate(rows, executor))[0];
}

/**
 * Looks an order up by either identifier, the way `/api/orders/[id]` is called.
 *
 * `id::text` is not redundant: the column is a `uuid`, and comparing it against
 * "FRT-000001" would make PostgreSQL raise a syntax error rather than simply
 * match nothing — turning an ordinary 404 into a 500.
 */
export async function findOrderByIdOrReference(
  identifier: string,
  executor: DbOrTx = db,
): Promise<Order | undefined> {
  const rows = await executor
    .select()
    .from(orders)
    .where(sql`${orders.id}::text = ${identifier} OR ${orders.reference} = ${identifier}`)
    .limit(1);
  return (await hydrate(rows, executor))[0];
}

export async function findOrderByReference(
  reference: string,
  executor: DbOrTx = db,
): Promise<Order | undefined> {
  const rows = await executor
    .select()
    .from(orders)
    .where(eq(orders.reference, reference))
    .limit(1);
  return (await hydrate(rows, executor))[0];
}

export async function countOrders(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(orders);
  return row?.count ?? 0;
}
