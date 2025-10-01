// src/ai/flows/strategic-card-play-analyzer.ts
'use server';
/**
 * @fileOverview An AI tool to analyze card placements and suggest optimal 'blind' plays.
 *
 * - analyzeCardPlay - A function that suggests the best blind card placement.
 * - AnalyzeCardPlayInput - The input type for the analyzeCardPlay function.
 * - AnalyzeCardPlayOutput - The return type for the analyzeCardPlay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ColorSchema = z.enum(['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet', 'White', 'Black']);

const CardSchema = z.object({
  frontColor: ColorSchema,
  backColor: ColorSchema,
});

const AnalyzeCardPlayInputSchema = z.object({
  hand: z.array(CardSchema).length(3).describe('The player\'s hand of cards.'),
  centerRow: z.array(CardSchema).describe('The current center row of cards.'),
});
export type AnalyzeCardPlayInput = z.infer<typeof AnalyzeCardPlayInputSchema>;

const AnalyzeCardPlayOutputSchema = z.object({
  suggestion: z.string().describe('A suggestion for the best blind card placement, considering the revealed card colors and potential outcomes.'),
  reasoning: z.string().describe('The AI reasoning behind the suggested placement.'),
});
export type AnalyzeCardPlayOutput = z.infer<typeof AnalyzeCardPlayOutputSchema>;

export async function analyzeCardPlay(input: AnalyzeCardPlayInput): Promise<AnalyzeCardPlayOutput> {
  return analyzeCardPlayFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCardPlayPrompt',
  input: {schema: AnalyzeCardPlayInputSchema},
  output: {schema: AnalyzeCardPlayOutputSchema},
  prompt: `You are a strategic card game expert. Analyze the current game state and suggest the optimal 'blind' card placement to maximize the player's chances of collecting cards.

Consider the revealed card colors in the center row and the potential outcomes of placing a card 'blind' (revealing its back color).

Player's Hand:
{{#each hand}}
  - Front: {{this.frontColor}}, Back: {{this.backColor}}
{{/each}}

Center Row:
{{#each centerRow}}
  - Front: {{this.frontColor}}, Back: {{this.backColor}}
{{/each}}

Suggest the best card from the player's hand to place 'blind' and explain your reasoning. Focus on avoiding duplicate colors and black cards, while aiming to complete a rainbow.

Output your suggestion in the following format:
Suggestion: [card index in hand, e.g., 0, 1, or 2]
Reasoning: [explanation of why this card is the best choice]`, 
});

const analyzeCardPlayFlow = ai.defineFlow(
  {
    name: 'analyzeCardPlayFlow',
    inputSchema: AnalyzeCardPlayInputSchema,
    outputSchema: AnalyzeCardPlayOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
