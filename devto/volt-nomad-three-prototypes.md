---
title: "I Built Three Games and Chose None: Picking a Direction by Whether I Wanted to Play Again"
tags: gamedev, godot, gamejam, indie
canonical_url: https://zenn.dev/hirodeath/articles/volt-nomad-three-prototypes
published: false
---

This article is an English version of my original Japanese post.

One risk in a game jam is discovering near the deadline that you do not want to finish the game you chose.

For AI Browser Game Jam 4, I tried to face that risk on day one. I interpreted the theme, CHARGE, in three different ways, built three playable prototypes, and compared them before deciding where to go next.

The finished game became [VOLT NOMAD](https://tsgamestudio.itch.io/volt-nomad). This post is about the concepts I retired and what they contributed to the final game.

## Three Meanings of CHARGE

CHARGE can mean stored energy, an attack, or a bill. Instead of selecting one meaning on paper, I assigned each interpretation to a different genre.

### CHARGEBACK

CHARGEBACK was a deck-building battle about fraudulent charges, subscriptions, and hidden fees.

Credit acted as both a resource and a health-like limit. The deck had defensive, debt, and audit archetypes. Some cards became stronger as available credit fell, while others retaliated when an enemy charged the account.

I liked designing the interactions, but the game asked players to read card descriptions and understand several relationships before the payoff appeared. That felt heavy for a short judging session.

### ZERO PERCENT CITY

ZERO PERCENT CITY was a side-scrolling action game about a small maintenance robot crossing a city after an energy collapse.

The battery drained while the player searched for charging stations, gained a dash and double jump, and climbed toward the city core. Here, CHARGE was both remaining time and a reason to keep exploring.

I liked its world, but movement, combat, level design, and camera behavior all needed careful polish. It deserved more production time than this jam could give it.

### CAPACITOR DEFENSE

CAPACITOR DEFENSE was a tower defense game about extending cables from a reactor and linking capacitors, arc towers, and pulse towers.

Electricity moved visibly through the network, and adjacent structures strengthened each other. Of the three prototypes, it made the theme easiest to see on screen.

The problem was distance. The player spent time understanding placement and then watching a wave play out. Direct input did not create the immediate response I wanted.

## I Stopped Asking Whether It Worked

All three games ran in a browser. They supported more than mouse input and already included English and Japanese. I could have selected the most complete one and kept building.

Instead, I changed the comparison question.

I stopped asking whether a prototype worked and asked whether I wanted to start another run.

That question removed feature count and code volume from the decision. After returning to the title, did I instinctively want to begin again? Did I want to try a different choice?

None of the three gave me a strong enough yes, so I made a fourth prototype. One click dealt immediate damage and generated CHARGE. That resource then funded the systems that gradually made manual clicking less important.

This loop, where direct input builds future automation, became the center of VOLT NOMAD.

## Retired Ideas Still Shaped the Final Game

Retiring a prototype did not mean losing everything it taught me.

The build combinations from CHARGEBACK influenced the five gear trees. The lonely machine world of ZERO PERCENT CITY remained in VOLT NOMAD's underground setting. The visible power flow and automated attacks from CAPACITOR DEFENSE returned in the relationship between CHARGE and the growing arsenal.

I retired the code paths, not every discovery inside them.

## The Fourth Prototype Still Had to Pass Small Gates

After choosing the new direction, I did not build all six hunts at once.

The first version covered only 30 seconds. I checked whether attacking and collecting CHARGE felt good. Next came a five-minute vertical slice with one encounter and upgrades. Only then did I connect the route where players choose three beasts and reach a boss and normal ending.

The reason was simple: I did not want content volume to conceal a weak core loop.

Adding enemies and art can make development look busy. It does not matter to players if the opening interaction is dull. I wanted to prove the smallest piece before paying for the next layer.

## To Discard Early, I Had to Build Something Real

If I had compared the three ideas only as written pitches, I might have chosen ZERO PERCENT CITY. Its setting sounded strongest on paper. The automation loop that eventually won was less impressive in a description and much better under my hands.

A prototype is not only a way to prove the correct direction. It can also give you enough evidence to abandon an attractive but unsuitable one.

I originally expected to build three games and discard two. In practice, I retired all three. I still do not consider that time wasted. Without that comparison, I would not have found the fourth game I wanted to finish.
