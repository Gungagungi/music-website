# BUG-001 — Percentage discount truncated to whole euros

| | |
| --- | --- |
| **Severity** | Major |
| **Priority** | High |
| **Status** | Open — reproduced on demand via `SEED_BUGS=1` |
| **Component** | Cart / coupons — `app/src/lib/cart.ts` |
| **Requirement** | [`REQ-COUPON-01`](../requirements.md#cart-and-checkout), `REQ-API-40` |
| **Test cases** | `TC-350`, `TC-110`, `TC-270`, `TC-274`, `TC-126` |
| **Environment** | Fretline `main`, Chromium 1.62.1, Linux, `SEED_BUGS=1` |

## Summary

A percentage coupon deducts less than the percentage it announces. The discount is truncated down
to a whole number of euros, so any cart whose subtotal is not a round euro amount is charged more
than the advertised price.

## Steps to reproduce

1. Add 2 × **Boss DS-1 Distortion** (SKU `BOS-DS1DIS-050`, €41.30) to the cart — subtotal €82.60
2. Open `/panier`
3. Apply coupon **BIENVENUE10** (−10%)
4. Read the discount line in the summary

## Expected

10% of €82.60 = **−€8.26**. The discount matches the announced percentage to the cent.

## Actual

**−€8.00**. The customer is overcharged by **€0.26** on this cart.

```
Error: Montant attendu : -8,26 € (-826 centimes)
Montant affiché : « - 8,00 € »
  at tests/ui/bugs-connus.spec.ts:42:39
```

## Impact

Small per order, systematic across all of them. Every coupon-bearing cart whose subtotal is not a
round euro amount is affected — which is most of them, since prices end in `,30`, `,55`, `,90`.
The loss is bounded by €0.99 per order and always falls on the customer's side, so it reads as a
deceptive commercial practice rather than a rounding preference. The advertised percentage and the
amount charged do not agree, and that is a claim a shop makes in writing.

Discovery is unlikely through normal use: the total looks plausible, the discount line is present,
nothing errors. It surfaces when a customer or an accountant checks the arithmetic.

## Root cause

`app/src/lib/cart.ts`, `discountFor()`:

```ts
if (COUPON_ROUNDING_BUG_ENABLED) {
  return Math.floor((base * coupon.value) / 100 / 100) * 100;
}
return applyPercent(base, coupon.value);
```

The extra `/ 100` … `* 100` converts to euros, floors, and converts back — discarding the cents.
The correct path, `applyPercent()`, rounds half away from zero at cent precision.

Reproduces identically through the API (`POST /api/cart/coupon`) and the preview endpoint
(`POST /api/coupons/validate`), which locates the defect in the shared calculation rather than in
either presentation layer.

## Detection

Caught by 5 tests across 3 suites, without anyone having written a test aimed at this bug:

| Test case | Suite | What it asserts |
| --- | --- | --- |
| `TC-110` | UI | The cart discount matches the coupon percentage |
| `TC-126` | UI | The cart discount carries through to the order total |
| `TC-270` | API | `POST /api/cart/coupon` returns the exact discount |
| `TC-274` | API | The preview endpoint returns the same amount |
| `TC-350` | UI | Dedicated demonstration spec |

That breadth is the direct consequence of one framework decision: `toShowPrice()` compares parsed
integer cents, not rendered strings. An assertion written as `toContainText('8,')` would have
passed on the bug.

## Suggested fix

Delete the branch and keep `applyPercent()`. Any change to monetary rounding should come with a
test at a subtotal that is not a whole euro — a fixture priced at €80.00 would have hidden this
defect completely.
