---
devto_id: 4318535
title: Ramen After Dark — A Steaming Comfort-Food Scene Drawn Entirely in CSS
tags: frontendchallenge, devchallenge, css, html
published: true
---

_This is a submission for [Frontend Challenge — Comfort Food Edition, CSS Art](https://dev.to/challenges/frontend-2026-07-29)._

## Inspiration

My comfort-food moment is not only the ramen itself. It is the scene around it: a nearly empty counter, the city gone quiet, steam rising into warm light, and a paper-like moon outside the window.

I created **Ramen After Dark** to capture that pause at the end of the day. The palette uses deep brown-red night tones, warm ceramic, amber broth, and a soft gold moon so the bowl feels like the brightest and safest place in the frame.

## Demo

- [Open the full CSS artwork](https://takahiro-saeki.github.io/comfort-food-challenge/css-art.html)
- [View the HTML and CSS on GitHub](https://github.com/takahiro-saeki/comfort-food-challenge)
- [Explore the related Midnight Broth landing page](https://takahiro-saeki.github.io/comfort-food-challenge/)

{% embed https://takahiro-saeki.github.io/comfort-food-challenge/css-art.html %}

## Journey

### Constructing the bowl from basic shapes

The artwork contains no images, SVG illustration paths, canvas, or JavaScript. The large bowl begins as a rounded rectangle with a thick ceramic border. A second oval creates the broth surface and clips all of the toppings.

Each ingredient is another small CSS shape:

- The egg is an irregular rounded rectangle with an inset yolk.
- Nori uses dark rectangles with crossing gradients for texture.
- Chashu uses rounded shapes and radial gradients.
- Noodles are border arcs layered across the broth.
- Scallions are tiny bordered ellipses.
- Naruto uses a pale rounded shape with a partial pink ring.
- Chopsticks are two long gradients rotated across the scene.

The city silhouette is a row of simple blocks. The moon uses nested circles and radial gradients. Even the ceramic pattern is made from three square borders rotated by 45 degrees.

### Creating depth without a drawing API

The main challenge was preserving the order of overlapping elements. Nori needs to sit behind the noodles, the egg and pork need to remain readable inside a shallow broth ellipse, and the chopsticks must cross both the toppings and bowl rim.

I used isolated stacking contexts and a deliberately small z-index scale. Shadows beneath the bowl and highlights inside the broth create depth without changing the underlying geometry.

### Letting only the steam move

Three steam trails are the only animated elements. They use slow opacity, vertical translation, and horizontal scale changes. Their negative delays keep them from moving in sync.

The rest of the illustration remains still so the motion supports the subject instead of distracting from it. When the visitor prefers reduced motion, the shared stylesheet effectively disables the animation.

### Making one composition work across screen sizes

The artwork uses a 16:10 stage on larger screens and a taller 4:5 stage on mobile. The bowl, toppings, chopsticks, steam, and moon use percentages or clamped sizes, allowing the composition to reframe instead of simply shrinking.

I tested it at 375 and 1440 pixels and verified that the art frame stays within the viewport without horizontal scrolling.

## What I Am Proud Of

The bowl remains recognizable from the full composition down to mobile size, even though every ingredient is an ordinary HTML element. I also like that the artwork became the visual foundation for a separate functional restaurant landing page rather than remaining an isolated experiment.

This challenge was a good reminder that CSS art is closely related to interface work: both rely on hierarchy, constraints, layering, responsive composition, and knowing when a detail is helping the whole.

The complete project is available under the MIT license.
