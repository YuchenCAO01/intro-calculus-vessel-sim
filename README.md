# Filling Vessels — an introduction to calculus

Interactive classroom simulation for **VCE Year 11 Maths** (Mathematical Methods, introduction to
rates of change). Water is poured into a vessel at a **constant flow rate** while the graph of
water height **h** against volume poured **V** is drawn live beside it.

**Live site:** https://yuchencao01.github.io/intro-calculus-vessel-sim/

## What students see

| Vessel | Graph of *h* against *V* |
| --- | --- |
| Constant width | straight line — constant gradient |
| Wider at top | concave down — gradient decreasing |
| Narrower at top | concave up — gradient increasing |
| Irregular width | straight pieces where the sides are straight, curves where the width changes |
| Sudden step | two straight lines meeting at a sharp corner — the gradient jumps, with no curve |

Every vessel is scaled to the **same capacity (1000 mL)** and the **same height (20 cm)**, so the
graphs all start and finish at the same point and can be compared directly. The two panels share
one vertical scale: *h* = 0 … 20 cm sits at exactly the same screen heights on both sides, so the
water line and its point on the graph are always level with each other.

## Controls

- **Start / Pause** (or `Space`) — pour at a constant rate
- **Reset** (or `R`) — empty the vessel and clear the graph
- **Vessel shape** — four selectable profiles
- **Flow rate** — 40–200 mL/s, for pacing a discussion
- **Show gradient d*h*/d*V*** — draws the tangent at the current point and prints its value

## Teaching notes

The vessel is a solid of revolution with radius *r*(*y*), so the volume needed to reach height *h* is

$$V(h) = \int_0^h \pi\,r(y)^2\,\mathrm{d}y$$

The curve on the right is the inverse of that integral, and its gradient is

$$\frac{\mathrm{d}h}{\mathrm{d}V} = \frac{1}{A(h)} = \frac{1}{\pi r(h)^2}$$

which is exactly the point of the activity: **wide vessel → small gradient → flat graph**, and
**narrow vessel → large gradient → steep graph**. Because the flow is constant (*V* = *Qt*), the
same graph read against time has the same shape.

Suggested sequence: pick a vessel, ask the class to **sketch the graph before pressing Start**, run
it, then compare. Use *Show gradient* to link the shape of the curve to the value of d*h*/d*V*.

## Running locally

No build step — it is plain HTML, CSS and JavaScript.

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## Deployment

Served straight from the repository: **Settings → Pages → Build and deployment → Deploy from a
branch → `main` / `/ (root)`**. Every push to `main` republishes the site — there is nothing to
build, so no Actions workflow is involved.

GitHub Pages serves assets with `cache-control: max-age=600`, so `index.html` loads `styles.css`
and `app.js` with a `?v=` query string. **Bump that number when you change either file**, otherwise
returning visitors keep the cached copy for up to ten minutes.

## Licence

MIT — see [LICENSE](LICENSE).
