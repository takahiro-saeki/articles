---
devto_id: 4318533
title: Midnight Broth — A Late-Night Ramen Landing Page with an Interactive Bowl Builder
tags: devchallenge, frontendchallenge, webdev, javascript
published: true
---

_This is a submission for [Frontend Challenge — Comfort Food Edition, Perfect Landing](https://dev.to/challenges/frontend-2026-07-29)._

## What I Built

**Midnight Broth** is a landing page for a fictional twelve-seat ramen counter in Shimokitazawa, Tokyo. The concept is built around a familiar kind of comfort: finding one warm, quiet place on the way home after a long day.

I wanted the page to feel like a real restaurant rather than a collection of unrelated UI sections. The story moves from the emotional promise, through the kitchen ritual and menu, into an interactive bowl builder and practical visit information.

The bowl builder lets visitors choose one of three broths and add toppings. The summary updates its name, extras, and estimated total without submitting an order or collecting personal information. A copy button turns the selection into a short text description.

## Demo

- [Open the Midnight Broth landing page](https://takahiro-saeki.github.io/comfort-food-challenge/)
- [View the source on GitHub](https://github.com/takahiro-saeki/comfort-food-challenge)
- [See the companion CSS artwork](https://takahiro-saeki.github.io/comfort-food-challenge/css-art.html)

{% embed https://takahiro-saeki.github.io/comfort-food-challenge/ %}

## Journey

### Starting with the feeling, not the menu

The prompt is about comfort food, so I started with the moment around the food: the last train, low music, a small counter, and the first warm sip. That decision shaped the headline, night palette, pacing, and fictional restaurant details.

The visual system uses deep oxblood, warm cream, muted red, and a restrained gold accent. Playfair Display SC gives the restaurant identity an editorial voice, while Karla keeps navigation, menus, and form controls direct and readable.

### Making the hero without food photography

There are no image assets in this project. The ramen hero is built from CSS gradients, borders, shadows, and positioned HTML elements. Egg, nori, noodles, scallions, broth, chopsticks, moon, and steam all use ordinary boxes and pseudo-elements.

Avoiding stock photography kept the concept original and also removed image loading and layout-shift concerns. The same visual language continues on the dedicated CSS Art page.

### Treating accessibility as part of the concept

I used semantic landmarks, heading order, fieldsets and legends for the builder, visible focus states, and native radio and checkbox controls. The decorative food illustration has one concise accessible description instead of exposing every visual layer to assistive technology.

The page also includes:

- A skip link
- Minimum 44-pixel interactive targets
- High-contrast text and controls
- Keyboard-operable form controls
- An `aria-live` summary for bowl changes
- `prefers-reduced-motion` support
- A clear notice that the interactive menu does not place a real order

### Responsive verification

I tested the layout at 375, 768, 1024, and 1440 pixels. At smaller widths, navigation becomes a compact two-column grid, content cards stack, CTA buttons become full width, and the bowl builder moves from three columns to one. I also checked that neither the landing page nor the CSS artwork introduced horizontal scrolling.

### A small amount of purposeful JavaScript

The page is intentionally framework-free. JavaScript is used only for the interactive bowl summary, clipboard feedback, and reading-progress indicator. The content and navigation remain available without those enhancements.

I am particularly happy that the final page works as both a restaurant story and a product interface. The emotional theme gets visitors to the menu; the interaction lets them turn that feeling into their own bowl.

## Built With

- Semantic HTML
- Modern CSS, including gradients, custom properties, Grid, and `:has()`
- Vanilla JavaScript
- GitHub Pages
- No image assets or UI framework

The complete project is licensed under MIT.
