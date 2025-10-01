'use client';
import { useState } from 'react';
import type { AnalyzeCardPlayInput } from '@/ai/flows/strategic-card-play-analyzer';
import { analyzeCardPlay } from '@/ai/flows/strategic-card-play-analyzer';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2 } from 'lucide-react';
import type { Card as GameCard, CenterRowCard } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AIAdvisorProps {
  hand: GameCard[];
  centerRow: CenterRowCard[];
  disabled: boolean;
}

export function AIAdvisor({ hand, centerRow, disabled }: AIAdvisorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ suggestion: string; reasoning: string } | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsLoading(true);
    setSuggestion(null);

    const input: AnalyzeCardPlayInput = {
      hand: hand.map(card => ({
        frontColor: card.frontColor,
        backColor: card.backColor,
      })),
      centerRow: centerRow.map(card => ({
        frontColor: card.isFaceUp ? card.frontColor : card.backColor,
        backColor: card.isFaceUp ? card.backColor : card.frontColor,
      })),
    };

    try {
      const result = await analyzeCardPlay(input);
      setSuggestion(result);
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error de la IA',
        description: 'No se pudo obtener la sugerencia de la IA.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled || isLoading} onClick={handleAnalyze}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
          Consejo de la IA
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Consejo Estratégico</CardTitle>
            <CardDescription>La IA sugiere tu mejor jugada "a ciegas".</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analizando...</div>}
            {suggestion && (
              <div className="space-y-2 text-sm">
                <p><strong>Sugerencia:</strong> {suggestion.suggestion}</p>
                <p><strong>Razonamiento:</strong> <span className="text-muted-foreground">{suggestion.reasoning}</span></p>
              </div>
            )}
            {!isLoading && !suggestion && <p className="text-sm text-muted-foreground">Haz clic para obtener un consejo.</p>}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
