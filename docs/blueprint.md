# **App Name**: Tactical Rainbow Online

## Core Features:

- Turn-Based Gameplay: Implement a turn-based system where two players strategically place and flip cards to complete rainbows.
- Card Placement and Flipping: Allow players to place 1-3 cards per turn, with mandatory flipping of existing cards in the row.
- Rainbow Completion Logic: Implement logic to detect and award rainbow completions (6 unique colors), giving cards to the completing player.
- Round Loss Conditions: Enforce round loss conditions: revealing duplicate colors or a black card results in the opponent taking all cards.
- Card Management: Manage hand replenishment to 3 cards after each turn/round and game-end detection when a player can't refill their hand.
- Multiplayer Networking: Real-time multiplayer functionality with rooms, matchmaking, and reconnection support, along with a central server for validation of state and moves.
- Strategic Card Play Analyzer: AI tool to analyze player's card placements to determine the optimal 'blind' placement to maximize card collecting based on revealed card color.

## Style Guidelines:

- Primary color: Soft Indigo (#856FF7), suggesting both intelligence and magic.
- Background color: Light gray (#F0F2F5), creating a calm and uncluttered experience that reduces distractions.
- Accent color: Muted Purple (#9F86C0), guiding user attention while complementing other colors for harmonious navigation.
- Font: 'Inter' sans-serif for both headers and body copy.
- Use colorblind-friendly icons/labels for card colors: (Red, Orange, Yellow, Green, Blue, Indigo, Violet, White, Black).
- Clear display of game state: hands (front/back view as appropriate), center row, turn indicators. Implement strict 'flip/play' flow in UI.
- Light animations for card placement, flipping, and game events.