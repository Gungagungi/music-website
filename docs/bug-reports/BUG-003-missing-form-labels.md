# BUG-003 — Form fields with no programmatic label

| | |
| --- | --- |
| **Severity** | Major (accessibility — WCAG 2.1 A) |
| **Priority** | High |
| **Status** | Open — reproduced on demand via `SEED_BUGS=1` |
| **Component** | Footer newsletter + checkout address — `app/src/components/Footer.tsx`, `CheckoutForm.tsx` |
| **Requirement** | [`REQ-A11Y-03`](../requirements.md#accessibility) |
| **Test cases** | `TC-352`, `TC-310` … `TC-319` |
| **WCAG** | 4.1.2 Name, Role, Value (A) · 3.3.2 Labels or Instructions (A) |
| **Environment** | Fretline `main`, Chromium 1.62.1, axe-core, `SEED_BUGS=1` + `NEXT_PUBLIC_SEED_BUGS=1` |

## Summary

Two form fields have no accessible name: the footer newsletter email input, present on **every
page**, and the address-complement field in the checkout funnel. A screen reader announces them as
"edit text, blank" with no indication of what to type.

## Steps to reproduce

1. Open any page (the footer is global)
2. Run an axe-core scan, or reach the newsletter field with a screen reader
3. Same for `/commande`, step *Livraison*, on the address-complement field

## Expected

Every input exposes a programmatic name — a `<label for>`, an `aria-label`, or an
`aria-labelledby`. No violation of the `label` rule at serious or critical level.

## Actual

axe-core reports a **critical** violation:

```
[critical] label — Form elements must have labels
  target: input[data-testid="newsletter-email"]
  html:   <input type="email" class="rounded-md border …" data-testid="newsletter-email">

  Element does not have an implicit (wrapped) <label>
  Element does not have an explicit <label>
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute
  Element has no placeholder attribute
  Element's default semantics were not overridden with role="none" or role="presentation"

  tags: wcag2a, wcag412, section508.22.n, EN-301-549, EN-9.4.1.2, RGAA-11.1.1
```

## Impact

The newsletter field is in the footer, so **every page of the site fails a WCAG 2.1 level A
criterion** — 10 of the 13 accessibility tests turn red at once. For a screen-reader user the
field is unusable: nothing announces what it expects. For a voice-control user it is
unaddressable, since there is no name to speak.

Beyond usability, this is regulatory exposure. In France the RGAA applies to public-sector sites
and, since the European Accessibility Act, to a growing share of e-commerce; `RGAA-11.1.1` and
`EN-301-549` both appear in the violation tags above.

A note for whoever fixes it: **a placeholder is not a label.** It disappears on the first
keystroke, is not exposed as a name by every assistive technology, and usually fails contrast.
axe accepts it as a *last-resort* name, which is why the bugged variant removes the placeholder
too — otherwise the scan would pass while the field remained unusable in practice. That subtlety
is the reason the first version of this seeded defect went undetected.

## Root cause

`app/src/components/Footer.tsx` — the bugged branch strips the `<label>`, the `id`, the `name` and
the `placeholder`:

```tsx
{MISSING_LABEL_BUG_ENABLED ? (
  <input type="email" className="…" data-testid="newsletter-email" />
) : (
  <>
    <label htmlFor="newsletter-email" className="text-sm">Votre adresse e-mail</label>
    <input id="newsletter-email" name="email" type="email" placeholder="vous@exemple.fr" … />
  </>
)}
```

`app/src/components/CheckoutForm.tsx` — same pattern on the address-complement field, gated by
`NEXT_PUBLIC_SEED_BUGS` because it is a client component, so the defect is baked in at **build**
time. Reproducing it requires rebuilding, not just restarting — the CI `demo-defauts` job does
exactly that.

## Detection

Caught by 11 tests. The footer being global is what makes the blast radius so wide:

| Test case | Suite | What it asserts |
| --- | --- | --- |
| `TC-310` … `TC-317` | A11y | No serious violation on home, catalogue, product, search, login, registration, comparator, cart |
| `TC-318` | A11y | Same on each checkout step |
| `TC-319` | A11y | Form error messages stay accessible |
| `TC-352` | UI | Dedicated demonstration spec, asserting the `label` rule specifically |

`TC-352` targets the `label` rule alone rather than the whole scan, so its failure message names
the defect instead of drowning it among unrelated findings.

## Suggested fix

Keep the labelled branch. A generic guard is worth adding on top: an accessibility scan on a
representative page in CI already exists, and a lint rule (`jsx-a11y/label-has-associated-control`)
would catch it at authoring time — cheaper than at scan time.
