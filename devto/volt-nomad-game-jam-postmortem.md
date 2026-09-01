---
title: "AI Made Me Faster, but a Game Jam Made Me Finish: The Making of VOLT NOMAD"
tags: gamedev, godot, ai, gamejam
canonical_url: https://zenn.dev/hirodeath/articles/volt-nomad-game-jam-postmortem
published: false
---

This article is an English version of my original Japanese post.

In August 2026, I made a browser game called [VOLT NOMAD](https://tsgamestudio.itch.io/volt-nomad) for AI Browser Game Jam 4.

Every click attacks an enemy and generates CHARGE. You spend that same resource across five gear trees. At first, manual input is your main source of damage. As your build grows, cannons and drones take over.

The finished game has a short route where you choose three of six machine beasts, followed by an optional complete route. It supports English and Japanese, plus mouse, keyboard, touch, and gamepad input.

This is not a breakdown of every feature. It is about why this game reached a finished, public state when many personal projects do not.

## I Entered the Event Before I Had a Game

The first decision was not a mechanic. It was entering the jam.

The theme was CHARGE. Development started on August 1, and the deadline was August 15. I did not yet know what I would make, but I already knew where and when I had to submit it.

Personal projects can always wait for a better idea or one more polish pass. That freedom also makes it easy to avoid declaring something finished. The jam replaced “I will improve this eventually” with “someone needs to be able to play this by a specific date.”

I built three concepts on August 1 and narrowed the direction on the following day. On August 3, I connected the campaign routes with temporary art. From August 4 through 8, I rebuilt the combat, added gear trees, bosses, and the true ending. The project became VOLT NOMAD on August 9. The remaining days went into story, onboarding, a trailer, and release candidate checks.

I did not see this exact game at the start. I reached it by leaving a playable build at the end of each day.

## I Built Three Games and Retired All Three

The first prototypes were very different.

CHARGEBACK was a deck-building battle about fraudulent charges and subscriptions. ZERO PERCENT CITY was a side-scrolling action game where battery charge acted as a time limit. CAPACITOR DEFENSE was a tower defense game about routing electricity through a circuit network.

All three ran. They had English and Japanese text, plus controller support. They were more than paper ideas.

But a working game and a game I want to play again are different things.

After comparing them, I decided not to finish any of the three. I built a fourth core loop where CHARGE connected immediate attacks to long-term automation. That prototype became Project Charge, then VOLT NOMAD.

Discarding working code felt expensive. Doing it on the first weekend was still much cheaper than spending the whole jam polishing a direction I did not believe in.

## I Built 30 Seconds, Then 5 Minutes, Then 20 Minutes

The production plan had three gates:

1. Does the attack and CHARGE loop feel good for 30 seconds?
2. Does a five-minute slice make me want to try a different upgrade path?
3. Does a 20-minute route feel like a complete game through its normal ending?

If the 30-second build was weak, I would not add levels or art. If the five-minute build offered no meaningful choice, I would not hide that problem under more content. Only after the normal route worked would I spend time on later bosses and the true ending.

The design changed substantially along the way. An early version revolved around filling and discharging six cells. The final version uses direct attacks against machine beasts. What stayed constant was the habit of playing a small, complete slice before increasing production cost.

## AI Gave Me Speed and More Options

Codex helped across planning, Godot implementation, testing, balancing, and submission preparation. PixelLab produced pixel art candidates, and Suno produced music candidates.

What I could not delegate was deciding what felt right.

I played each iteration, described discomfort, compared options, and decided what to keep. I reviewed 92 PixelLab candidates, often inside Godot rather than in an image gallery. I listened to music in context to check whether it masked attack sounds or looped awkwardly. The final game uses 18 original tracks.

When AI makes candidate generation faster, selection becomes a larger part of the human job.

## The Deadline Mattered More Than the Speed

AI helped me build VOLT NOMAD quickly, but speed alone did not finish it.

The jam supplied a deadline and a place to show the result. AI expanded implementation speed and the range of options. I played, rejected, selected, and decided where the project should stop.

I came away with one very simple lesson. The next time I want to make a game, I will probably enter an event before I have perfected the idea.

The slides from my short talk are also available: [How AI and a Game Jam Helped Me Finish a Game](https://speakerdeck.com/takahirosaeki/ai-to-game-jam-de-gemu-o-kansei-saseta-hanashi).

