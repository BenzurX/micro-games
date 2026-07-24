<!--
FOOTHOLD - TUTORIAL MESSAGES
=============================
Edit the text below to change what the tutorial says. The game fetches this file at
runtime (GameScene.js's preload()), so changes here show up next time you reload the
tutorial - no code edit needed. Just refresh the page (hard-refresh / clear cache if the
game is running as an installed PWA, since it caches assets offline).

RULES:

1. Don't rename the "## " headings, don't add/remove/reorder Steps - the seven Steps below
   are fixed in code (which tile, which action) and this file only supplies their TEXT,
   matched in order (Step 1's text goes with the game's first scripted move, and so on).
   The comment line under each heading just tells you what that step's trigger is - it's
   not read by the game, only for your reference while editing.

2. Write each message as one paragraph. Line breaks inside it are ignored and collapsed
   to single spaces; the game re-wraps it to fit the box automatically.

3. To render a resource name as a small icon + bold word (e.g. "Wood"), wrap it in angle
   brackets: <gold> <wood> <stone> <special>. Same idea for the two home bases:
   <enemy-castle> and <player-castle> render a castle icon + "CASTLE" label, tinted red
   and blue to match. Keep a normal space on both sides of these tokens, same as any
   other word - don't glue it directly to punctuation (write "the <gold> tile" not
   "the<gold>tile" or "<gold>, gold").

   <expand> <build> <upgrade> <siege> are action names - no icon, just the word itself
   (rendered lowercase as-is) bolded and colored yellow/green/purple/orange to match that
   action's board highlight color. These have no icon to bump into, so you don't need to
   worry about spacing around them - write them straight into a sentence same as any word.

4. Wrap text in double asterisks to bold it, e.g. **Welcome to Foothold!** - same idea as
   markdown bold. Don't nest it inside a <res> token (those are already bold).

5. The "Waiting" section's text should include the literal placeholder <RES> somewhere -
   the game swaps it for whichever resource the current step needs (so the same message
   works for every step). Leave it exactly as <RES>, capital letters, angle brackets -
   it's a placeholder, not a resource token like the ones in rule 3.

6. Don't delete the "Intro", "Free Roam", "Castle Ready", or "Waiting" sections - each
   one is shown at a specific moment (see list below) and the game falls back to a
   generic built-in line if one goes missing, but the tutorial reads worse without your
   own copy there.

WHEN EACH SECTION SHOWS:
  Intro             A pop-up card shown once, right when the tutorial board loads -
                    before Step 1. Dismissed with its own "Got it" button or the ×.
  Step 1, 2, 3...   One at a time, in order, while its scripted move is legal to make.
  Waiting           Instead of a Step's message, whenever that step's move isn't
                    affordable yet - i.e. the player needs to End Turn and collect
                    income first. Only shown during the guided Steps.
  Free Roam         Shown once every guarded Step is done - the player can Siege the
                    AI's remaining tiles in any order. Stays up even once only the
                    enemy home is left and the home siege isn't affordable yet - no
                    separate "waiting" text for that, just keep ending turns.
  Castle Ready      Free-roam, AI has nothing left but its home base, and the player
                    CAN afford to siege it right now - the final nudge to go win.
-->

## Intro

**Welcome to Foothold!** Expand your territory, capture resources, and take the enemy <enemy-castle> in order to win. You will slowly gain resources such as <gold>, <wood> and <stone> over time, but capturing resource nodes will increase your income further.

## Step 1: Build Wood

<!-- Triggers on: tap the wood tile at (3,2) -->

In order to <build> on resource nodes, you'll need <wood>. Start by claiming the <wood> resource node to the left of your <player-castle> highlighted with a green border. Notice by claiming this, you will get **+5** <wood> a turn, and it will cost **5** <wood> to build.

## Step 2: Build Stone

<!-- Triggers on: tap the stone tile at (2,3) -->

Next, <build> on the <stone> tile in order generate income for that resource. <stone> allows you to <upgrade> tiles to double their income.

## Step 3: Build Gold

<!-- Triggers on: tap the gold tile at (2,2) -->

In order to <expand> your territory, you'll need <gold>. Claim that highlighted tile to gain **+5** <gold> income. <gold> allows you to <expand> into neutral tiles and eventually <siege> enemy tiles at double the cost.

## Step 4: Upgrade Gold

<!-- Triggers on: Upgrade the same gold tile at (2,2) -->

Now you can <upgrade> your <gold> tile by spending <stone> in order to double its income. You can <upgrade> any resource node once and it will gain an special symbol in the top right of the tile.

## Step 5: Build Special

<!-- Triggers on: build then upgrade the special tile at (2,1) -->

When you <build> on the <special> node, you gain a little bit of everything, **+3** <gold>, <wood> and <stone> income. When you <upgrade> it, you gain **+6** to all income. A very **valuable** resource! Make sure to <upgrade> it as well.

## Step 6: Expand

<!-- Triggers on: Expand the empty tile at (1,1) -->

Tap the empty tile above to <expand> your territory. Claiming an empty tile will only cost **5** <gold>, but claiming an enemy tile will cost **10**.

## Step 7: Siege

<!-- Triggers on: siege the enemy gold tile at (0,1) -->

Now <siege> the enemy <gold> tile. When you <siege> an empty tile, it only takes **10** <gold>, but enemy resource node costs **10** <gold> and **5** <wood> to re-<build> since it was damaged in your attack. Any existing <upgrade> will need to be rebuilt as well.

## Free Roam

Now it's up to you to continue <expand> your kingdom and <siege> enemy territory until you have **50** <gold> to <siege> the enemy <enemy-castle>! Can you get a **Complete Foothold?**

## Castle Ready

The enemy <enemy-castle> is ready for capture. Quickly, <siege> it to win the tutorial!

## Waiting

You are out of resources to continue expanding for this turn. Tap **End Turn** to collect this turn's income.
