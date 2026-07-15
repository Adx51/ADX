import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';

export interface SommelierAnswer {
  answer: string;
  bottleIds: string[];
}

/**
 * Conversational sommelier grounded in the user's actual inventory. The current
 * cellar is serialized into the prompt as context so answers reference real
 * bottles ("Que boire ce soir avec une côte de bœuf ?", "Mon meilleur Bordeaux ?").
 */
@Injectable()
export class SommelierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiService,
  ) {}

  async ask(userId: string, question: string): Promise<SommelierAnswer> {
    const bottles = await this.loadInventory(userId);

    if (!this.ai.isEnabled) {
      return {
        answer:
          'L’assistant sommelier nécessite une clé OpenAI. En attendant, voici votre inventaire : ' +
          bottles.map((b) => b.label).slice(0, 10).join(', ') +
          '.',
        bottleIds: [],
      };
    }

    const context = bottles
      .map(
        (b) =>
          `#${b.id} — ${b.label} | ${b.color ?? '?'} | région: ${b.region ?? '?'} | ` +
          `à boire ${b.drinkFrom ?? '?'}-${b.drinkUntil ?? '?'} | valeur ~${b.estimatedValue ?? '?'}€`,
      )
      .join('\n');

    const raw = await this.ai.json<SommelierAnswer>(
      `Tu es le sommelier personnel de l'utilisateur. Réponds en français, avec chaleur
et précision, en t'appuyant UNIQUEMENT sur les bouteilles de sa cave listées ci-dessous.
Cite les bouteilles pertinentes. Retourne UNIQUEMENT un JSON :
{ "answer": string, "bottleIds": string[] } où bottleIds sont les identifiants (#id) cités.

CAVE DE L'UTILISATEUR :
${context || '(cave vide)'}`,
      question,
    );

    return raw ?? { answer: 'Je n’ai pas pu formuler de réponse.', bottleIds: [] };
  }

  private async loadInventory(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { cellarId: true },
    });
    const cellarIds = memberships.map((m) => m.cellarId);

    const bottles = await this.prisma.bottle.findMany({
      where: { cellarId: { in: cellarIds }, status: 'IN_STOCK' },
      include: { wine: true },
      take: 500,
    });

    return bottles.map((b) => ({
      id: b.id,
      label: [b.wine.domain, b.wine.cuvee, b.wine.vintage].filter(Boolean).join(' '),
      color: b.wine.color,
      region: b.wine.region,
      drinkFrom: b.wine.drinkFrom,
      drinkUntil: b.wine.drinkUntil,
      estimatedValue: b.estimatedValue ? Number(b.estimatedValue) : null,
    }));
  }
}
